import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy import select

from app.models.configuration import (
    Configuration,
    ConfigurationVersion,
)
from app.models.configuration_audit import ConfigurationAudit
from app.models.configuration_change import ConfigurationChange
from app.models.user import User, UserRole
from app.services.configuration_change_service import (
    approve_change_request,
    create_rollback_request,
)
from app.services.configuration_activation_service import (
    activate_due_configuration_versions,
)


def test_full_scheduled_rollback_lifecycle(db):
    # ---------------------------------------------------------
    # 1. Create two real users
    # ---------------------------------------------------------

    maker = User(
        auth_user_id=uuid.uuid4(),
        name="Rollback Maker",
        email=f"rollback-maker-{uuid.uuid4()}@test.local",
        role=UserRole.ADMIN,
        is_active=True,
    )

    approver = User(
        auth_user_id=uuid.uuid4(),
        name="Rollback Approver",
        email=f"rollback-approver-{uuid.uuid4()}@test.local",
        role=UserRole.ADMIN,
        is_active=True,
    )

    db.add_all([maker, approver])
    db.flush()

    # ---------------------------------------------------------
    # 2. Create configuration
    # ---------------------------------------------------------

    configuration = Configuration(
        key=f"integration.rollback.{uuid.uuid4().hex}",
        description="Rollback integration test",
        data_type="STRING",
        scope="GLOBAL",
        is_active=True,
    )

    db.add(configuration)
    db.flush()

    # ---------------------------------------------------------
    # 3. Create current version
    # ---------------------------------------------------------

    current_version = ConfigurationVersion(
        configuration_id=configuration.id,
        version=1,
        value="current-value",
        status="ACTIVE",
        effective_from=datetime.now(timezone.utc)
        - timedelta(hours=1),
        created_by=maker.id,
        approved_by=maker.id,
        approved_at=datetime.now(timezone.utc),
        reason="Initial configuration",
    )

    db.add(current_version)
    db.flush()

    configuration.current_version_id = current_version.id
    db.flush()

    # ---------------------------------------------------------
    # 4. Create rollback target version
    # ---------------------------------------------------------

    rollback_target = ConfigurationVersion(
        configuration_id=configuration.id,
        version=2,
        value="previous-value",
        status="EXPIRED",
        effective_from=datetime.now(timezone.utc)
        - timedelta(hours=2),
        created_by=maker.id,
        approved_by=maker.id,
        approved_at=datetime.now(timezone.utc)
        - timedelta(hours=1),
        reason="Previous configuration",
        previous_version_id=current_version.id,
    )

    db.add(rollback_target)
    db.flush()

    # ---------------------------------------------------------
    # 5. Create scheduled rollback request
    # ---------------------------------------------------------

    scheduled_time = (
        datetime.now(timezone.utc)
        + timedelta(hours=1)
    )

    change = create_rollback_request(
        db,
        configuration_id=configuration.id,
        rollback_to_version_id=rollback_target.id,
        reason="Scheduled rollback integration test",
        created_by=maker.id,
        change_reference="INTEGRATION-RB-001",
        effective_from=scheduled_time,
    )

    assert change.id is not None
    assert change.status == "PENDING_APPROVAL"
    assert change.rollback_of_version_id == rollback_target.id
    assert change.proposed_value == "previous-value"
    assert change.effective_from == scheduled_time

    # ---------------------------------------------------------
    # 6. Approve using a different admin
    # ---------------------------------------------------------

    scheduled_version = approve_change_request(
        db,
        change_id=change.id,
        approver_id=approver.id,
        comment="Approved integration test",
    )

    assert scheduled_version.id is not None
    assert scheduled_version.status == "SCHEDULED"
    assert (
        scheduled_version.rollback_of_version_id
        == rollback_target.id
    )
    assert scheduled_version.value == "previous-value"

    # The current version must still be the old version.
    assert (
        configuration.current_version_id
        == current_version.id
    )

    assert current_version.status == "ACTIVE"

    # ---------------------------------------------------------
    # 7. Make the scheduled version due
    # ---------------------------------------------------------

    scheduled_version.effective_from = (
        datetime.now(timezone.utc)
        - timedelta(minutes=1)
    )

    db.flush()

    # ---------------------------------------------------------
    # 8. Activate due scheduled version
    # ---------------------------------------------------------

    activated_count = activate_due_configuration_versions(
        db
    )

    assert activated_count == 1

    # ---------------------------------------------------------
    # 9. Verify final database state
    # ---------------------------------------------------------

    db.refresh(configuration)
    db.refresh(current_version)
    db.refresh(scheduled_version)
    db.refresh(change)

    assert (
        configuration.current_version_id
        == scheduled_version.id
    )

    assert current_version.status == "EXPIRED"

    assert scheduled_version.status == "ACTIVE"

    assert scheduled_version.value == "previous-value"

    assert change.status == "APPROVED"
    assert change.approved_by == approver.id

    # ---------------------------------------------------------
    # 10. Verify audit trail
    # ---------------------------------------------------------

    audits = db.scalars(
        select(ConfigurationAudit)
        .where(
            ConfigurationAudit.configuration_id
            == configuration.id
        )
        .order_by(ConfigurationAudit.id)
    ).all()

    actions = [audit.action for audit in audits]

    assert "CHANGE_REQUEST_CREATED" in actions
    assert "CONFIGURATION_ROLLED_BACK" in actions
    assert "CONFIGURATION_VERSION_ACTIVATED" in actions