import uuid
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone, timedelta

import pytest
from sqlalchemy import create_engine, select
from sqlalchemy.orm import sessionmaker

from app.models.configuration import Configuration
from app.models.configuration_change import ConfigurationChange
from app.models.user import User, UserRole
from app.services.configuration_change_service import (
    create_change_request,
)


def test_concurrent_change_requests_allow_only_one(db):
    engine = db.get_bind()

    TestingSessionLocal = sessionmaker(
        bind=engine,
        autoflush=False,
        autocommit=False,
    )

    # ---------------------------------------------------------
    # Setup shared data
    # ---------------------------------------------------------

    suffix = uuid.uuid4().hex

    user_a = User(
        auth_user_id=uuid.uuid4(),
        name=f"Concurrency User A {suffix}",
        email=f"concurrency-a-{suffix}@test.local",
        role=UserRole.ADMIN,
        is_active=True,
    )

    user_b = User(
        auth_user_id=uuid.uuid4(),
        name=f"Concurrency User B {suffix}",
        email=f"concurrency-b-{suffix}@test.local",
        role=UserRole.ADMIN,
        is_active=True,
    )

    configuration = Configuration(
        key=f"concurrency.test.{suffix}",
        description="Concurrency test",
        data_type="STRING",
        scope="GLOBAL",
        is_active=True,
    )

    db.add_all([user_a, user_b, configuration])
    db.commit()

    configuration_id = configuration.id
    user_a_id = user_a.id
    user_b_id = user_b.id

    # ---------------------------------------------------------
    # Run two requests in separate transactions
    # ---------------------------------------------------------

    def submit_change(created_by: int):
        session = TestingSessionLocal()

        try:
            change = create_change_request(
                session,
                configuration_id=configuration_id,
                proposed_value=f"value-{created_by}",
                risk_level="HIGH",
                reason="Concurrency test",
                created_by=created_by,
                change_reference=f"CONC-{created_by}",
                effective_from=datetime.now(timezone.utc) + timedelta(minutes=5),
            )

            session.commit()

            return {
                "success": True,
                "change_id": change.id,
                "created_by": created_by,
            }

        except ValueError as exc:
            session.rollback()

            return {
                "success": False,
                "error": str(exc),
                "created_by": created_by,
            }

        finally:
            session.close()

    with ThreadPoolExecutor(max_workers=2) as executor:
        futures = [
            executor.submit(submit_change, user_a_id),
            executor.submit(submit_change, user_b_id),
        ]

        results = [
            future.result()
            for future in futures
        ]

    # ---------------------------------------------------------
    # Exactly one request should succeed
    # ---------------------------------------------------------

    successful = [
        result
        for result in results
        if result["success"]
    ]

    failed = [
        result
        for result in results
        if not result["success"]
    ]

    assert len(successful) == 1, (
        f"Expected exactly one successful request. "
        f"Actual results: {results}"
    )
    assert len(failed) == 1

    assert failed[0]["error"] == (
        "A pending change already exists for this configuration"
    )

    # ---------------------------------------------------------
    # Verify actual DB state
    # ---------------------------------------------------------

    changes = db.scalars(
        select(ConfigurationChange)
        .where(
            ConfigurationChange.configuration_id
            == configuration_id
        )
    ).all()

    assert len(changes) == 1
    assert changes[0].status == "PENDING_APPROVAL"