from datetime import datetime, timezone, timedelta
import uuid

from sqlalchemy import select

from app.models.enums import (
    NotificationChannel,
    NotificationStatus,
    NotificationType,
    OperationalExceptionStatus,
    OperationalExceptionType,
    UserRole,
)
from app.models.notification import Notification
from app.models.user import User

from app.services.operational_exception_service import (
    create_operational_exception,
    process_exception_escalations,
)


class SessionProxy:
    def __init__(self, session):
        self._session = session

    def __getattr__(self, name):
        return getattr(self._session, name)

    def close(self):
        pass


def make_user(db, role=UserRole.ADMIN):
    suffix = uuid.uuid4().hex

    user = User(
        auth_user_id=uuid.uuid4(),
        name=f"Escalation Test User {suffix}",
        email=f"escalation-{suffix}@test.local",
        role=role,
        is_active=True,
    )

    db.add(user)
    db.flush()

    return user


def make_exception(db):
    source_id = uuid.uuid4().int % 2_000_000_000

    return create_operational_exception(
        db,
        exception_type=OperationalExceptionType.DISPOSAL_SHIPMENT_DISCREPANCY,
        source_type="DISPOSAL_SHIPMENT",
        source_id=source_id,
        reason="Test escalation exception.",
    )


def patch_escalation_dependencies(db, monkeypatch):
    test_db = SessionProxy(db)

    monkeypatch.setattr(
        "app.core.database.SessionLocal",
        lambda: test_db,
    )

    monkeypatch.setattr(
        "app.services.operational_exception_service.get_configuration_float",
        lambda db, key: 30.0,
    )


def test_escalates_old_open_exception(db, monkeypatch):
    admin = make_user(db, UserRole.ADMIN)

    exception = make_exception(db)

    exception.opened_at = (
        datetime.now(timezone.utc) - timedelta(minutes=60)
    )

    db.commit()

    patch_escalation_dependencies(db, monkeypatch)

    result = process_exception_escalations()

    assert result >= 1

    db.refresh(exception)

    assert exception.status == OperationalExceptionStatus.ESCALATED
    assert exception.escalated_at is not None

    notification = db.scalar(
        select(Notification).where(
            Notification.user_id == admin.id,
            Notification.event_key
            == f"EXCEPTION_ESCALATED:{exception.id}",
        )
    )

    assert notification is not None

    assert (
        notification.notification_type
        == NotificationType.EXCEPTION_ESCALATED
    )

    assert notification.channel == NotificationChannel.IN_APP

    assert notification.status == NotificationStatus.PENDING

    assert notification.title == "Operational Exception Escalated"

    assert exception.exception_type.value in notification.body
    assert exception.source_type in notification.body
    assert str(exception.source_id) in notification.body
    assert exception.reason in notification.body


def test_does_not_escalate_recent_exception(db, monkeypatch):
    make_user(db, UserRole.ADMIN)

    exception = make_exception(db)

    exception.opened_at = (
        datetime.now(timezone.utc) - timedelta(minutes=5)
    )

    db.commit()

    patch_escalation_dependencies(db, monkeypatch)

    process_exception_escalations()

    db.refresh(exception)

    assert exception.status == OperationalExceptionStatus.OPEN
    assert exception.escalated_at is None


def test_does_not_escalate_resolved_exception(db, monkeypatch):
    make_user(db, UserRole.ADMIN)

    exception = make_exception(db)

    exception.status = OperationalExceptionStatus.RESOLVED

    exception.opened_at = (
        datetime.now(timezone.utc) - timedelta(minutes=60)
    )

    db.commit()

    patch_escalation_dependencies(db, monkeypatch)

    process_exception_escalations()

    db.refresh(exception)

    assert exception.status == OperationalExceptionStatus.RESOLVED
    assert exception.escalated_at is None


def test_escalation_notifies_all_admins(db, monkeypatch):
    admin1 = make_user(db, UserRole.ADMIN)
    admin2 = make_user(db, UserRole.ADMIN)

    exception = make_exception(db)

    exception.opened_at = (
        datetime.now(timezone.utc) - timedelta(minutes=60)
    )

    db.commit()

    patch_escalation_dependencies(db, monkeypatch)

    result = process_exception_escalations()

    assert result >= 1

    db.refresh(exception)

    assert exception.status == OperationalExceptionStatus.ESCALATED

    notifications = db.scalars(
        select(Notification).where(
            Notification.event_key
            == f"EXCEPTION_ESCALATED:{exception.id}"
        )
    ).all()

    notified_user_ids = {
        notification.user_id
        for notification in notifications
    }

    assert admin1.id in notified_user_ids
    assert admin2.id in notified_user_ids

    for notification in notifications:
        assert (
            notification.notification_type
            == NotificationType.EXCEPTION_ESCALATED
        )
        assert notification.channel == NotificationChannel.IN_APP
        assert notification.status == NotificationStatus.PENDING


def test_escalation_is_idempotent(db, monkeypatch):
    admin = make_user(db, UserRole.ADMIN)

    exception = make_exception(db)

    exception.opened_at = (
        datetime.now(timezone.utc) - timedelta(minutes=60)
    )

    db.commit()

    patch_escalation_dependencies(db, monkeypatch)

    first_result = process_exception_escalations()

    assert first_result >= 1

    db.refresh(exception)

    assert exception.status == OperationalExceptionStatus.ESCALATED
    assert exception.escalated_at is not None

    first_notifications = db.scalars(
        select(Notification).where(
            Notification.user_id == admin.id,
            Notification.event_key
            == f"EXCEPTION_ESCALATED:{exception.id}",
        )
    ).all()

    assert len(first_notifications) == 1

    second_result = process_exception_escalations()

    assert second_result == 0

    second_notifications = db.scalars(
        select(Notification).where(
            Notification.user_id == admin.id,
            Notification.event_key
            == f"EXCEPTION_ESCALATED:{exception.id}",
        )
    ).all()

    assert len(second_notifications) == 1