from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from unittest.mock import Mock, patch

from app.services.configuration_activation_service import (
    activate_due_configuration_versions,
)


@patch(
    "app.services.configuration_activation_service.record_configuration_audit"
)
def test_activate_due_scheduled_version(
    audit_mock,
):
    db = Mock()

    now = datetime.now(timezone.utc)

    scheduled_version = SimpleNamespace(
        id=3,
        configuration_id=1,
        status="SCHEDULED",
        effective_from=now - timedelta(minutes=1),
        value="new-value",
        created_by=10,
        approved_by=20,
        reason="Scheduled rollback",
        change_reference="RB-001",
    )

    configuration = SimpleNamespace(
        id=1,
        is_active=True,
        current_version_id=2,
    )

    previous_version = SimpleNamespace(
        id=2,
        value="old-value",
        status="ACTIVE",
        effective_until=None,
    )

    db.scalars.return_value.all.return_value = [
        scheduled_version
    ]

    db.scalar.return_value = configuration
    db.get.return_value = previous_version

    result = activate_due_configuration_versions(db)

    assert result == 1

    assert scheduled_version.status == "ACTIVE"
    assert configuration.current_version_id == 3

    assert previous_version.status == "EXPIRED"
    assert previous_version.effective_until is not None

    audit_mock.assert_called_once()

    audit_kwargs = audit_mock.call_args.kwargs

    assert audit_kwargs["configuration_id"] == 1
    assert audit_kwargs["configuration_version_id"] == 3
    assert audit_kwargs["actor_id"] == 20
    assert audit_kwargs["old_value"] == "old-value"
    assert audit_kwargs["new_value"] == "new-value"
    assert (
        audit_kwargs["action"]
        == "CONFIGURATION_VERSION_ACTIVATED"
    )


@patch(
    "app.services.configuration_activation_service.record_configuration_audit"
)
def test_future_scheduled_version_is_not_activated(
    audit_mock,
):
    db = Mock()

    future_version = SimpleNamespace(
        id=3,
        configuration_id=1,
        status="SCHEDULED",
        effective_from=(
            datetime.now(timezone.utc)
            + timedelta(hours=1)
        ),
    )

    db.scalars.return_value.all.return_value = []

    result = activate_due_configuration_versions(db)

    assert result == 0
    audit_mock.assert_not_called()