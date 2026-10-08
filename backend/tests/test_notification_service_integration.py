import uuid

from app.models.enums import (
    NotificationChannel,
    NotificationStatus,
    NotificationType,
    UserRole,
)
from app.models.notification import Notification
from app.models.user import User
from app.services.notification_service import (
    create_notification,
    mark_notification_failed,
    mark_notification_read,
    mark_notification_sent,
)


def make_user(db):
    suffix = uuid.uuid4().hex

    user = User(
        auth_user_id=uuid.uuid4(),
        name=f"Notification Test {suffix}",
        email=f"notification-{suffix}@test.local",
        role=UserRole.CUSTOMER,
        is_active=True,
    )

    db.add(user)
    db.flush()

    return user


def test_create_notification_persists_pending_notification(db):
    user = make_user(db)

    notification = create_notification(
        db=db,
        user_id=user.id,
        notification_type=NotificationType.PICKUP_REQUESTED,
        channel=NotificationChannel.IN_APP,
        title="Pickup Requested",
        body="Pickup PK-001 has been requested successfully.",
        event_key="PICKUP_REQUESTED:100",
        metadata={
            "pickup_id": 100,
            "pickup_code": "PK-001",
        },
    )

    assert notification.id is not None
    assert notification.user_id == user.id
    assert notification.notification_type == (
        NotificationType.PICKUP_REQUESTED
    )
    assert notification.channel == NotificationChannel.IN_APP
    assert notification.status == NotificationStatus.PENDING
    assert notification.title == "Pickup Requested"
    assert notification.body == (
        "Pickup PK-001 has been requested successfully."
    )
    assert notification.event_key == "PICKUP_REQUESTED:100"
    assert notification.notification_metadata == {
        "pickup_id": 100,
        "pickup_code": "PK-001",
    }

    saved = db.get(Notification, notification.id)

    assert saved is not None
    assert saved.user_id == user.id


def test_create_notification_returns_existing_notification_for_duplicate_event(
    db,
):
    user = make_user(db)

    first = create_notification(
        db=db,
        user_id=user.id,
        notification_type=NotificationType.PICKUP_REQUESTED,
        channel=NotificationChannel.IN_APP,
        title="Pickup Requested",
        body="First notification",
        event_key="PICKUP_REQUESTED:200",
        metadata={"pickup_id": 200},
    )

    second = create_notification(
        db=db,
        user_id=user.id,
        notification_type=NotificationType.PICKUP_REQUESTED,
        channel=NotificationChannel.IN_APP,
        title="Different Title",
        body="Different notification",
        event_key="PICKUP_REQUESTED:200",
        metadata={"pickup_id": 999},
    )

    assert second.id == first.id
    assert second.title == "Pickup Requested"
    assert second.body == "First notification"
    assert second.notification_metadata == {
        "pickup_id": 200,
    }

    notifications = (
        db.query(Notification)
        .filter(
            Notification.user_id == user.id,
            Notification.event_key == "PICKUP_REQUESTED:200",
        )
        .all()
    )

    assert len(notifications) == 1


def test_mark_notification_sent_updates_status_and_provider_message_id(
    db,
):
    user = make_user(db)

    notification = create_notification(
        db=db,
        user_id=user.id,
        notification_type=NotificationType.PICKUP_COMPLETED,
        channel=NotificationChannel.IN_APP,
        title="Pickup Completed",
        body="Pickup completed.",
        event_key="PICKUP_COMPLETED:300",
    )

    assert notification.sent_at is None
    assert notification.provider_message_id is None

    mark_notification_sent(
        db=db,
        notification=notification,
        provider_message_id="provider-msg-001",
    )

    assert notification.status == NotificationStatus.SENT
    assert notification.sent_at is not None
    assert notification.provider_message_id == "provider-msg-001"


def test_mark_notification_failed_updates_status_and_reason(db):
    user = make_user(db)

    notification = create_notification(
        db=db,
        user_id=user.id,
        notification_type=NotificationType.SHIPMENT_DISPATCHED,
        channel=NotificationChannel.IN_APP,
        title="Shipment Dispatched",
        body="Shipment is in transit.",
        event_key="SHIPMENT_DISPATCHED:400",
    )

    mark_notification_failed(
        db=db,
        notification=notification,
        reason="Notification provider unavailable",
    )

    assert notification.status == NotificationStatus.FAILED
    assert notification.failure_reason == (
        "Notification provider unavailable"
    )


def test_mark_notification_read_sets_read_timestamp(db):
    user = make_user(db)

    notification = create_notification(
        db=db,
        user_id=user.id,
        notification_type=NotificationType.DRIVER_ASSIGNED,
        channel=NotificationChannel.IN_APP,
        title="Route Assigned",
        body="Route RT-001 has been assigned to you.",
        event_key="DRIVER_ASSIGNED:500",
    )

    assert notification.read_at is None

    mark_notification_read(
        db=db,
        notification=notification,
    )

    assert notification.read_at is not None