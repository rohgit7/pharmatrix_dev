from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from unittest.mock import Mock, patch
from app.services.configuration_change_service import (
    approve_change_request,
    create_rollback_request,
)
import pytest

from app.services.configuration_change_service import create_rollback_request


def make_mock_db():
    db = Mock()

    configuration = SimpleNamespace(
        id=1,
        key="test.configuration",
        data_type="STRING",
        current_version_id=2,
        is_active=True,
    )

    target_version = SimpleNamespace(
        id=1,
        configuration_id=1,
        value="previous-value",
    )

    current_version = SimpleNamespace(
        id=2,
        value="current-value",
    )

    # create_rollback_request() calls db.scalar()
    # in this order:
    # 1. configuration
    # 2. target version
    # 3. existing pending change
    db.scalar.side_effect = [
        configuration,
        target_version,
        None,
    ]

    db.get.return_value = current_version

    return db, configuration, target_version


@patch(
    "app.services.configuration_change_service.record_configuration_audit"
)
@patch(
    "app.services.configuration_change_service.validate_configuration_constraints"
)
@patch(
    "app.services.configuration_change_service.validate_configuration_value"
)
@patch(
    "app.services.configuration_change_service._ensure_no_future_scheduled_version"
)
def test_valid_future_rollback(
    ensure_future_mock,
    validate_value_mock,
    validate_constraints_mock,
    audit_mock,
):
    db, configuration, target_version = make_mock_db()

    validate_value_mock.return_value = target_version.value

    effective_from = datetime.now(timezone.utc) + timedelta(hours=2)

    change = create_rollback_request(
        db,
        configuration_id=configuration.id,
        rollback_to_version_id=target_version.id,
        reason="Rollback test",
        created_by=1,
        effective_from=effective_from,
    )

    assert change.configuration_id == configuration.id
    assert change.rollback_of_version_id == target_version.id
    assert change.proposed_value == target_version.value
    assert change.status == "PENDING_APPROVAL"
    assert change.risk_level == "HIGH"
    assert change.effective_from == effective_from

    ensure_future_mock.assert_called_once_with(
        db,
        configuration.id,
    )

    db.add.assert_called_once_with(change)
    db.flush.assert_called_once()
    audit_mock.assert_called_once()


def test_naive_effective_from_is_rejected():
    db, configuration, target_version = make_mock_db()

    naive_datetime = datetime.now() + timedelta(hours=2)

    with pytest.raises(
        ValueError,
        match="effective_from must include timezone information",
    ):
        with patch(
            "app.services.configuration_change_service.validate_configuration_value",
            return_value=target_version.value,
        ), patch(
            "app.services.configuration_change_service.validate_configuration_constraints"
        ):
            create_rollback_request(
                db,
                configuration_id=configuration.id,
                rollback_to_version_id=target_version.id,
                reason="Rollback test",
                created_by=1,
                effective_from=naive_datetime,
            )

    db.add.assert_not_called()


def test_past_effective_from_is_rejected():
    db, configuration, target_version = make_mock_db()

    past_datetime = datetime.now(timezone.utc) - timedelta(hours=1)

    with pytest.raises(
        ValueError,
        match="effective_from cannot be in the past",
    ):
        with patch(
            "app.services.configuration_change_service.validate_configuration_value",
            return_value=target_version.value,
        ), patch(
            "app.services.configuration_change_service.validate_configuration_constraints"
        ):
            create_rollback_request(
                db,
                configuration_id=configuration.id,
                rollback_to_version_id=target_version.id,
                reason="Rollback test",
                created_by=1,
                effective_from=past_datetime,
            )

    db.add.assert_not_called()


@patch(
    "app.services.configuration_change_service.validate_configuration_value"
)
@patch(
    "app.services.configuration_change_service.validate_configuration_constraints"
)
@patch(
    "app.services.configuration_change_service._ensure_no_future_scheduled_version"
)
def test_conflicting_future_schedule_is_rejected(
    ensure_future_mock,
    validate_constraints_mock,
    validate_value_mock,
):
    db, configuration, target_version = make_mock_db()

    validate_value_mock.return_value = target_version.value

    ensure_future_mock.side_effect = ValueError(
        "A future scheduled version already exists"
    )

    effective_from = datetime.now(timezone.utc) + timedelta(hours=2)

    with pytest.raises(
        ValueError,
        match="A future scheduled version already exists",
    ):
        create_rollback_request(
            db,
            configuration_id=configuration.id,
            rollback_to_version_id=target_version.id,
            reason="Rollback test",
            created_by=1,
            effective_from=effective_from,
        )

    db.add.assert_not_called()
    db.flush.assert_not_called()

@patch(
    "app.services.configuration_change_service.record_configuration_audit"
)
@patch(
    "app.services.configuration_change_service.validate_configuration_constraints"
)
@patch(
    "app.services.configuration_change_service.validate_configuration_value"
)
@patch(
    "app.services.configuration_change_service._ensure_no_future_scheduled_version"
)
def test_approve_future_rollback_creates_scheduled_version(
    ensure_future_mock,
    validate_value_mock,
    validate_constraints_mock,
    audit_mock,
):
    db = Mock()

    future_time = datetime.now(timezone.utc) + timedelta(hours=3)

    change = SimpleNamespace(
        id=10,
        configuration_id=1,
        status="PENDING_APPROVAL",
        created_by=1,
        proposed_value="previous-value",
        effective_from=future_time,
        reason="Scheduled rollback",
        change_reference="RB-001",
        rollback_of_version_id=5,
    )

    configuration = SimpleNamespace(
        id=1,
        key="test.configuration",
        data_type="STRING",
        current_version_id=6,
    )

    latest_version = SimpleNamespace(
        id=6,
        version=6,
        value="current-value",
        status="ACTIVE",
    )

    db.scalar.side_effect = [
        change,
        configuration,
        latest_version,
    ]

    validate_value_mock.return_value = change.proposed_value

    def assign_version_id(obj):
        obj.id = 7

    db.add.side_effect = assign_version_id

    result = approve_change_request(
        db,
        change_id=change.id,
        approver_id=2,
        comment="Approved scheduled rollback",
    )

    assert result.id == 7
    assert result.configuration_id == configuration.id
    assert result.version == 7
    assert result.value == "previous-value"
    assert result.status == "SCHEDULED"
    assert result.effective_from == future_time
    assert result.created_by == change.created_by
    assert result.approved_by == 2
    assert result.rollback_of_version_id == change.rollback_of_version_id

    # Future version must not replace the current active version yet.
    assert configuration.current_version_id == 6
    assert latest_version.status == "ACTIVE"

    ensure_future_mock.assert_called_once_with(
        db,
        configuration.id,
    )

    assert change.status == "APPROVED"
    assert change.approved_by == 2
    assert change.review_comment == "Approved scheduled rollback"

    db.add.assert_called_once_with(result)
    db.flush.call_count >= 2

    audit_mock.assert_called_once()
@patch(
    "app.services.configuration_change_service.record_configuration_audit"
)
@patch(
    "app.services.configuration_change_service.validate_configuration_constraints"
)
@patch(
    "app.services.configuration_change_service.validate_configuration_value"
)
def test_approve_immediate_rollback_creates_active_version(
    validate_value_mock,
    validate_constraints_mock,
    audit_mock,
):
    db = Mock()

    change = SimpleNamespace(
        id=20,
        configuration_id=1,
        status="PENDING_APPROVAL",
        created_by=1,
        proposed_value="previous-value",
        effective_from=None,
        reason="Immediate rollback",
        change_reference="RB-002",
        rollback_of_version_id=5,
        approved_by=None,
        review_comment=None,
        reviewed_at=None,
    )

    configuration = SimpleNamespace(
        id=1,
        key="test.configuration",
        data_type="STRING",
        current_version_id=6,
    )

    latest_version = SimpleNamespace(
        id=6,
        version=6,
        value="current-value",
        status="ACTIVE",
    )

    db.scalar.side_effect = [
        change,
        configuration,
        latest_version,
    ]

    validate_value_mock.return_value = change.proposed_value

    def assign_version_id(obj):
        obj.id = 7

    db.add.side_effect = assign_version_id

    result = approve_change_request(
        db,
        change_id=change.id,
        approver_id=2,
        comment="Approved immediate rollback",
    )

    assert result.id == 7
    assert result.status == "ACTIVE"
    assert result.value == "previous-value"
    assert result.previous_version_id == latest_version.id
    assert result.rollback_of_version_id == change.rollback_of_version_id

    # Immediate rollback replaces the current version.
    assert latest_version.status == "EXPIRED"
    assert configuration.current_version_id == result.id

    assert change.status == "APPROVED"
    assert change.approved_by == 2
    assert change.review_comment == "Approved immediate rollback"

    audit_mock.assert_called_once()


def test_maker_cannot_approve_rollback():
    db = Mock()

    change = SimpleNamespace(
        id=30,
        configuration_id=1,
        status="PENDING_APPROVAL",
        created_by=5,
    )

    db.scalar.return_value = change

    with pytest.raises(
        ValueError,
        match="The maker cannot approve their own change",
    ):
        approve_change_request(
            db,
            change_id=change.id,
            approver_id=5,
        )

    db.add.assert_not_called()

def test_approve_change_rejects_missing_configuration():
    db = Mock()

    change = SimpleNamespace(
        id=40,
        configuration_id=999,
        status="PENDING_APPROVAL",
        created_by=1,
    )

    db.scalar.side_effect = [
        change,
        None,
    ]

    with patch(
        "app.services.configuration_change_service.validate_configuration_value"
    ) as validate_value_mock, patch(
        "app.services.configuration_change_service.validate_configuration_constraints"
    ) as validate_constraints_mock:

        with pytest.raises(
            ValueError,
            match="Configuration not found",
        ):
            approve_change_request(
                db,
                change_id=change.id,
                approver_id=2,
            )

    validate_value_mock.assert_not_called()
    validate_constraints_mock.assert_not_called()
    db.add.assert_not_called()
    db.flush.assert_not_called()