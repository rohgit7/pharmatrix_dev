import uuid

from app.models.enums import (
    NotificationChannel,
    NotificationType,
    UserRole,
)
from app.models.notification import Notification
from app.models.user import User
from app.services.notification_events import (
    notify_disposal_completed,
    notify_driver_assigned,
    notify_pickup_completed,
    notify_pickup_requested,
    notify_pickup_scheduled,
    notify_shipment_dispatched,
    notify_shipment_received,
)


def make_user(db):
    suffix = uuid.uuid4().hex

    user = User(
        auth_user_id=uuid.uuid4(),
        name=f"Notification Event Test {suffix}",
        email=f"notification-event-{suffix}@test.local",
        role=UserRole.CUSTOMER,
        is_active=True,
    )

    db.add(user)
    db.flush()

    return user


def test_notify_pickup_requested_creates_correct_notification(db):
    user = make_user(db)

    notification = notify_pickup_requested(
        db,
        customer_user_id=user.id,
        pickup_id=101,
        pickup_code="PK-101",
    )

    assert notification.user_id == user.id
    assert notification.notification_type == (
        NotificationType.PICKUP_REQUESTED
    )
    assert notification.channel == NotificationChannel.IN_APP
    assert notification.title == "Pickup Requested"
    assert notification.body == (
        "Pickup PK-101 has been requested successfully."
    )
    assert notification.event_key == "PICKUP_REQUESTED:101"
    assert notification.notification_metadata == {
        "pickup_id": 101,
        "pickup_code": "PK-101",
    }


def test_notify_pickup_scheduled_creates_correct_notification(db):
    user = make_user(db)

    notification = notify_pickup_scheduled(
        db,
        customer_user_id=user.id,
        pickup_id=102,
        pickup_code="PK-102",
        scheduled_date="2026-10-10",
    )

    assert notification.user_id == user.id
    assert notification.notification_type == (
        NotificationType.PICKUP_SCHEDULED
    )
    assert notification.channel == NotificationChannel.IN_APP
    assert notification.title == "Pickup Scheduled"
    assert notification.body == (
        "Pickup PK-102 has been scheduled for 2026-10-10."
    )
    assert notification.event_key == "PICKUP_SCHEDULED:102"
    assert notification.notification_metadata == {
        "pickup_id": 102,
        "pickup_code": "PK-102",
        "scheduled_date": "2026-10-10",
    }


def test_notify_driver_assigned_creates_correct_notification(db):
    user = make_user(db)

    notification = notify_driver_assigned(
        db,
        driver_user_id=user.id,
        route_id=103,
        route_code="RT-20261010-ABC123",
    )

    assert notification.user_id == user.id
    assert notification.notification_type == (
        NotificationType.DRIVER_ASSIGNED
    )
    assert notification.channel == NotificationChannel.IN_APP
    assert notification.title == "Route Assigned"
    assert notification.body == (
        "Route RT-20261010-ABC123 has been assigned to you."
    )
    assert notification.event_key == "DRIVER_ASSIGNED:103"
    assert notification.notification_metadata == {
        "route_id": 103,
        "route_code": "RT-20261010-ABC123",
    }


def test_notify_pickup_completed_creates_correct_notification(db):
    user = make_user(db)

    notification = notify_pickup_completed(
        db,
        customer_user_id=user.id,
        pickup_id=104,
        pickup_code="PK-104",
    )

    assert notification.user_id == user.id
    assert notification.notification_type == (
        NotificationType.PICKUP_COMPLETED
    )
    assert notification.channel == NotificationChannel.IN_APP
    assert notification.title == "Pickup Completed"
    assert notification.body == (
        "Pickup PK-104 has been completed."
    )
    assert notification.event_key == "PICKUP_COMPLETED:104"
    assert notification.notification_metadata == {
        "pickup_id": 104,
        "pickup_code": "PK-104",
    }


def test_notify_shipment_dispatched_creates_correct_notification(db):
    user = make_user(db)

    notification = notify_shipment_dispatched(
        db,
        facility_user_id=user.id,
        shipment_id=105,
        shipment_code="SH-105",
    )

    assert notification.user_id == user.id
    assert notification.notification_type == (
        NotificationType.SHIPMENT_DISPATCHED
    )
    assert notification.channel == NotificationChannel.IN_APP
    assert notification.title == "Shipment Dispatched"
    assert notification.body == (
        "Disposal shipment SH-105 is in transit."
    )
    assert notification.event_key == "SHIPMENT_DISPATCHED:105"
    assert notification.notification_metadata == {
        "shipment_id": 105,
        "shipment_code": "SH-105",
    }


def test_notify_shipment_received_creates_correct_notification(db):
    user = make_user(db)

    notification = notify_shipment_received(
        db,
        customer_user_id=user.id,
        shipment_id=106,
        shipment_code="SH-106",
    )

    assert notification.user_id == user.id
    assert notification.notification_type == (
        NotificationType.SHIPMENT_RECEIVED
    )
    assert notification.channel == NotificationChannel.IN_APP
    assert notification.title == "Shipment Received"
    assert notification.body == (
        "Shipment SH-106 has been received at the disposal facility."
    )
    assert notification.event_key == "SHIPMENT_RECEIVED:106"
    assert notification.notification_metadata == {
        "shipment_id": 106,
        "shipment_code": "SH-106",
    }


def test_notify_disposal_completed_creates_correct_notification(db):
    user = make_user(db)

    notification = notify_disposal_completed(
        db,
        customer_user_id=user.id,
        shipment_id=107,
        shipment_code="SH-107",
    )

    assert notification.user_id == user.id
    assert notification.notification_type == (
        NotificationType.DISPOSAL_COMPLETED
    )
    assert notification.channel == NotificationChannel.IN_APP
    assert notification.title == "Disposal Completed"
    assert notification.body == (
        "Disposal for shipment SH-107 has been completed."
    )
    assert notification.event_key == "DISPOSAL_COMPLETED:107"
    assert notification.notification_metadata == {
        "shipment_id": 107,
        "shipment_code": "SH-107",
    }


def test_notification_event_wrapper_persists_notification(db):
    user = make_user(db)

    notification = notify_pickup_requested(
        db,
        customer_user_id=user.id,
        pickup_id=108,
        pickup_code="PK-108",
    )

    saved = db.get(Notification, notification.id)

    assert saved is not None
    assert saved.user_id == user.id
    assert saved.event_key == "PICKUP_REQUESTED:108"