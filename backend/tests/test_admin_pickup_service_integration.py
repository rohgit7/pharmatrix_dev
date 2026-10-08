import uuid
from datetime import datetime, timedelta, timezone

import pytest
from fastapi import HTTPException

from app.models.customer import Customer
from app.models.customer_location import CustomerLocation
from app.models.enums import (
    CustomerType,
    NotificationChannel,
    NotificationType,
    PickupPriority,
    PickupStatus,
    UserRole,
)
from app.models.notification import Notification
from app.models.pickup import Pickup
from app.models.user import User
from app.services.pickup_service import (
    cancel_pickup,
    schedule_pickup,
)


def make_pickup_setup(db, suffix):
    user = User(
        auth_user_id=uuid.uuid4(),
        name=f"Admin Pickup Test {suffix}",
        email=f"admin-pickup-{suffix}@test.local",
        role=UserRole.CUSTOMER,
        is_active=True,
    )

    db.add(user)
    db.flush()

    customer = Customer(
        user_id=user.id,
        customer_type=CustomerType.PHARMACY,
        legal_name="Admin Pickup Pharmacy",
        display_name="Admin Pickup Pharmacy",
        phone="9876543210",
        email=user.email,
        is_active=True,
    )

    db.add(customer)
    db.flush()

    location = CustomerLocation(
        customer_id=customer.id,
        location_code=f"ADM-{suffix[:10]}",
        name="Admin Pickup Branch",
        address_line_1="123 Admin Road",
        city="Bengaluru",
        state="Karnataka",
        postal_code="560001",
        latitude=12.9716,
        longitude=77.5946,
        service_time_seconds=300,
        pickup_enabled=True,
        is_active=True,
    )

    db.add(location)
    db.flush()

    pickup = Pickup(
        pickup_code=f"PK-{suffix[:10]}",
        customer_id=customer.id,
        location_id=location.id,
        status=PickupStatus.REQUESTED,
        priority=PickupPriority.NORMAL,
        requested_date=(
            datetime.now(timezone.utc)
            + timedelta(days=1)
        ),
        estimated_weight_kg=10,
        verification_token=f"verify-{suffix}",
    )

    db.add(pickup)
    db.commit()
    db.refresh(pickup)

    return user, customer, location, pickup


def cleanup_setup(
    db,
    *,
    pickup,
    notification=None,
    location,
    customer,
    user,
):
    if notification is not None:
        db.delete(notification)

    db.delete(pickup)
    db.delete(location)
    db.delete(customer)
    db.delete(user)
    db.commit()


def test_schedule_pickup_persists_status_and_notification(
    db,
):
    suffix = uuid.uuid4().hex

    user, customer, location, pickup = (
        make_pickup_setup(db, suffix)
    )

    try:
        scheduled_date = (
            datetime.now(timezone.utc)
            + timedelta(days=2)
        )

        updated_pickup = schedule_pickup(
            db=db,
            pickup_id=pickup.id,
            scheduled_date=scheduled_date,
        )

        assert updated_pickup.id == pickup.id
        assert updated_pickup.status == (
            PickupStatus.SCHEDULED
        )
        assert updated_pickup.scheduled_date == (
            scheduled_date
        )

        db.refresh(pickup)

        assert pickup.status == PickupStatus.SCHEDULED
        assert pickup.scheduled_date == scheduled_date

        notification = (
            db.query(Notification)
            .filter(
                Notification.user_id == user.id,
                Notification.channel
                == NotificationChannel.IN_APP,
                Notification.event_key
                == f"PICKUP_SCHEDULED:{pickup.id}",
            )
            .first()
        )

        assert notification is not None
        assert (
            notification.notification_type
            == NotificationType.PICKUP_SCHEDULED
        )
        assert notification.status.value == "PENDING"
        assert notification.title == "Pickup Scheduled"
        assert pickup.pickup_code in notification.body

        assert notification.notification_metadata[
            "pickup_id"
        ] == pickup.id

    finally:
        notification = (
            db.query(Notification)
            .filter(
                Notification.user_id == user.id,
                Notification.event_key
                == f"PICKUP_SCHEDULED:{pickup.id}",
            )
            .first()
        )

        cleanup_setup(
            db,
            pickup=pickup,
            notification=notification,
            location=location,
            customer=customer,
            user=user,
        )


def test_schedule_pickup_rejects_non_requested_status(
    db,
):
    suffix = uuid.uuid4().hex

    user, customer, location, pickup = (
        make_pickup_setup(db, suffix)
    )

    pickup.status = PickupStatus.COLLECTED
    db.commit()

    try:
        with pytest.raises(HTTPException) as exc_info:
            schedule_pickup(
                db=db,
                pickup_id=pickup.id,
                scheduled_date=(
                    datetime.now(timezone.utc)
                    + timedelta(days=1)
                ),
            )

        assert exc_info.value.status_code == 400
        assert exc_info.value.detail == (
            "Pickup cannot be scheduled from status COLLECTED"
        )

        db.refresh(pickup)

        assert pickup.status == PickupStatus.COLLECTED

    finally:
        cleanup_setup(
            db,
            pickup=pickup,
            location=location,
            customer=customer,
            user=user,
        )


def test_schedule_pickup_rejects_missing_pickup(db):
    with pytest.raises(HTTPException) as exc_info:
        schedule_pickup(
            db=db,
            pickup_id=999999999,
            scheduled_date=(
                datetime.now(timezone.utc)
                + timedelta(days=1)
            ),
        )

    assert exc_info.value.status_code == 404
    assert exc_info.value.detail == "Pickup not found"


def test_cancel_requested_pickup(db):
    suffix = uuid.uuid4().hex

    user, customer, location, pickup = (
        make_pickup_setup(db, suffix)
    )

    try:
        updated_pickup = cancel_pickup(
            db=db,
            pickup_id=pickup.id,
            reason="Customer requested cancellation",
        )

        assert updated_pickup.status == (
            PickupStatus.CANCELLED
        )
        assert updated_pickup.failure_reason == (
            "Customer requested cancellation"
        )

        db.refresh(pickup)

        assert pickup.status == PickupStatus.CANCELLED
        assert pickup.failure_reason == (
            "Customer requested cancellation"
        )

    finally:
        cleanup_setup(
            db,
            pickup=pickup,
            location=location,
            customer=customer,
            user=user,
        )


def test_cancel_scheduled_pickup(db):
    suffix = uuid.uuid4().hex

    user, customer, location, pickup = (
        make_pickup_setup(db, suffix)
    )

    pickup.status = PickupStatus.SCHEDULED
    pickup.scheduled_date = (
        datetime.now(timezone.utc)
        + timedelta(days=1)
    )
    db.commit()

    try:
        updated_pickup = cancel_pickup(
            db=db,
            pickup_id=pickup.id,
            reason="Customer no longer available",
        )

        assert updated_pickup.status == (
            PickupStatus.CANCELLED
        )
        assert updated_pickup.failure_reason == (
            "Customer no longer available"
        )

    finally:
        cleanup_setup(
            db,
            pickup=pickup,
            location=location,
            customer=customer,
            user=user,
        )


def test_cancel_collected_pickup_is_rejected(db):
    suffix = uuid.uuid4().hex

    user, customer, location, pickup = (
        make_pickup_setup(db, suffix)
    )

    pickup.status = PickupStatus.COLLECTED
    db.commit()

    try:
        with pytest.raises(HTTPException) as exc_info:
            cancel_pickup(
                db=db,
                pickup_id=pickup.id,
                reason="Too late",
            )

        assert exc_info.value.status_code == 400
        assert exc_info.value.detail == (
            "Pickup cannot be cancelled from status COLLECTED"
        )

        db.refresh(pickup)

        assert pickup.status == PickupStatus.COLLECTED

    finally:
        cleanup_setup(
            db,
            pickup=pickup,
            location=location,
            customer=customer,
            user=user,
        )


def test_cancel_already_cancelled_pickup_is_rejected(
    db,
):
    suffix = uuid.uuid4().hex

    user, customer, location, pickup = (
        make_pickup_setup(db, suffix)
    )

    pickup.status = PickupStatus.CANCELLED
    pickup.failure_reason = "Already cancelled"
    db.commit()

    try:
        with pytest.raises(HTTPException) as exc_info:
            cancel_pickup(
                db=db,
                pickup_id=pickup.id,
                reason="Cancel again",
            )

        assert exc_info.value.status_code == 400
        assert exc_info.value.detail == (
            "Pickup cannot be cancelled from status CANCELLED"
        )

    finally:
        cleanup_setup(
            db,
            pickup=pickup,
            location=location,
            customer=customer,
            user=user,
        )