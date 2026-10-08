from datetime import datetime, timezone, timedelta
import uuid

import pytest

from app.models.enums import (
    OperationalExceptionStatus,
    OperationalExceptionType,
    UserRole,
)
from app.models.operational_exception import OperationalException
from app.models.user import User

from app.services.operational_exception_service import (
    create_operational_exception,
    list_operational_exceptions,
    get_operational_exception,
    resolve_operational_exception,
)


def make_user(db, role=UserRole.ADMIN):
    suffix = uuid.uuid4().hex

    user = User(
        auth_user_id=uuid.uuid4(),
        name=f"Exception Test User {suffix}",
        email=f"exception-{suffix}@test.local",
        role=role,
        is_active=True,
    )

    db.add(user)
    db.flush()

    return user


def make_exception(db, source_id=None):
    if source_id is None:
        source_id = uuid.uuid4().int % 1000000

    return create_operational_exception(
        db,
        exception_type=OperationalExceptionType.DISPOSAL_SHIPMENT_DISCREPANCY,
        source_type="DISPOSAL_SHIPMENT",
        source_id=source_id,
        reason="Expected weight differs from received weight.",
    )


def test_create_operational_exception(db):
    exception = make_exception(db, 1001)

    assert exception.id is not None
    assert (
        exception.exception_type
        == OperationalExceptionType.DISPOSAL_SHIPMENT_DISCREPANCY
    )
    assert exception.status == OperationalExceptionStatus.OPEN
    assert exception.source_type == "DISPOSAL_SHIPMENT"
    assert exception.source_id == 1001
    assert exception.reason == (
        "Expected weight differs from received weight."
    )
    assert exception.opened_at is not None


def test_duplicate_open_exception_returns_existing(db):
    first = make_exception(db, 1002)

    second = create_operational_exception(
        db,
        exception_type=OperationalExceptionType.DISPOSAL_SHIPMENT_DISCREPANCY,
        source_type="DISPOSAL_SHIPMENT",
        source_id=1002,
        reason="Another reason",
    )

    assert second.id == first.id
    assert second.reason == first.reason


def test_resolved_exception_allows_new_exception(db):
    first = make_exception(db, 1003)

    admin = make_user(db, UserRole.ADMIN)

    resolve_operational_exception(
        db,
        exception_id=first.id,
        resolved_by_user_id=admin.id,
        resolution_notes="Resolved.",
    )

    second = create_operational_exception(
        db,
        exception_type=OperationalExceptionType.DISPOSAL_SHIPMENT_DISCREPANCY,
        source_type="DISPOSAL_SHIPMENT",
        source_id=1003,
        reason="New discrepancy.",
    )

    assert second.id != first.id
    assert second.status == OperationalExceptionStatus.OPEN


def test_list_operational_exceptions(db):
    first = make_exception(db, 1004)
    second = make_exception(db, 1005)

    results = list_operational_exceptions(db)

    ids = {exception.id for exception in results}

    assert first.id in ids
    assert second.id in ids


def test_list_filter_by_status(db):
    exception = make_exception(db, 1006)

    results = list_operational_exceptions(
        db,
        status_filter=OperationalExceptionStatus.OPEN,
    )

    assert exception.id in {item.id for item in results}

    results = list_operational_exceptions(
        db,
        status_filter=OperationalExceptionStatus.RESOLVED,
    )

    assert exception.id not in {item.id for item in results}


def test_list_filter_by_exception_type(db):
    exception = make_exception(db, 1007)

    results = list_operational_exceptions(
        db,
        exception_type=OperationalExceptionType.DISPOSAL_SHIPMENT_DISCREPANCY,
    )

    assert exception.id in {item.id for item in results}


def test_get_operational_exception(db):
    exception = make_exception(db, 1008)

    result = get_operational_exception(
        db,
        exception.id,
    )

    assert result is not None
    assert result.id == exception.id


def test_get_missing_operational_exception(db):
    result = get_operational_exception(
        db,
        999999999,
    )

    assert result is None


def test_resolve_operational_exception(db):
    exception = make_exception(db, 1009)
    admin = make_user(db, UserRole.ADMIN)

    result = resolve_operational_exception(
        db,
        exception_id=exception.id,
        resolved_by_user_id=admin.id,
        resolution_notes="Discrepancy verified and resolved.",
    )

    assert result.status == OperationalExceptionStatus.RESOLVED
    assert result.resolved_by_user_id == admin.id
    assert result.resolution_notes == (
        "Discrepancy verified and resolved."
    )
    assert result.resolved_at is not None


def test_resolve_missing_exception(db):
    admin = make_user(db, UserRole.ADMIN)

    with pytest.raises(ValueError, match="not found"):
        resolve_operational_exception(
            db,
            exception_id=999999999,
            resolved_by_user_id=admin.id,
            resolution_notes="Test.",
        )


def test_resolve_already_resolved_exception(db):
    exception = make_exception(db, 1010)
    admin = make_user(db, UserRole.ADMIN)

    resolve_operational_exception(
        db,
        exception_id=exception.id,
        resolved_by_user_id=admin.id,
        resolution_notes="First resolution.",
    )

    with pytest.raises(ValueError, match="already resolved"):
        resolve_operational_exception(
            db,
            exception_id=exception.id,
            resolved_by_user_id=admin.id,
            resolution_notes="Second resolution.",
        )


def test_resolve_requires_existing_user(db):
    exception = make_exception(db, 1011)

    with pytest.raises(ValueError, match="Resolving user not found"):
        resolve_operational_exception(
            db,
            exception_id=exception.id,
            resolved_by_user_id=999999999,
            resolution_notes="Test.",
        )


def test_resolve_requires_admin(db):
    exception = make_exception(db, 1012)
    user = make_user(db, UserRole.DRIVER)

    with pytest.raises(
        ValueError,
        match="Only administrators can resolve",
    ):
        resolve_operational_exception(
            db,
            exception_id=exception.id,
            resolved_by_user_id=user.id,
            resolution_notes="Driver attempting resolution.",
        )