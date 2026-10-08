import hashlib
import uuid
from datetime import datetime, timedelta, timezone

import pytest
from fastapi import HTTPException

from app.models.customer import Customer
from app.models.customer_location import CustomerLocation
from app.models.enums import (
    CustomerType,
    PickupPriority,
    PickupStatus,
    UserRole,
)
from app.models.pickup import Pickup
from app.models.user import User
from app.services.pickup_verification_service import (
    OTP_REQUEST_COOLDOWN_SECONDS,
    OTP_REQUESTS_PER_WINDOW,
    hash_otp,
    request_otp,
)


def make_customer_setup(db, suffix):
    user = User(
        auth_user_id=uuid.uuid4(),
        name=f"OTP Test User {suffix}",
        email=f"otp-{suffix}@test.local",
        role=UserRole.CUSTOMER,
        is_active=True,
    )

    db.add(user)
    db.flush()

    customer = Customer(
        user_id=user.id,
        customer_type=CustomerType.PHARMACY,
        legal_name="OTP Test Pharmacy Pvt Ltd",
        display_name="OTP Test Pharmacy",
        phone="9876543210",
        email=user.email,
        is_active=True,
    )

    db.add(customer)
    db.flush()

    location = CustomerLocation(
        customer_id=customer.id,
        location_code=f"OTP-{suffix[:10]}",
        name="OTP Test Branch",
        address_line_1="123 OTP Road",
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
        verification_token=f"verification-{suffix}",
    )

    db.add(pickup)
    db.commit()
    db.refresh(pickup)

    return user, customer, location, pickup


def cleanup_setup(
    db,
    *,
    pickup,
    location,
    customer,
    user,
):
    db.delete(pickup)
    db.delete(location)
    db.delete(customer)
    db.delete(user)
    db.commit()


def test_request_otp_persists_hash_expiry_and_request_metadata(db):
    suffix = uuid.uuid4().hex

    user, customer, location, pickup = make_customer_setup(
        db,
        suffix,
    )

    try:
        before = datetime.now(timezone.utc)

        updated_pickup, otp = request_otp(
            db=db,
            user=user,
            pickup_id=pickup.id,
        )

        after = datetime.now(timezone.utc)

        assert updated_pickup.id == pickup.id

        assert len(otp) == 6
        assert otp.isdigit()

        assert updated_pickup.otp_hash == (
            hashlib.sha256(
                otp.encode("utf-8")
            ).hexdigest()
        )

        assert updated_pickup.otp_hash == hash_otp(otp)

        assert updated_pickup.otp_expires_at is not None

        expected_min = before + timedelta(minutes=10)
        expected_max = after + timedelta(minutes=10)

        assert (
            expected_min
            <= updated_pickup.otp_expires_at
            <= expected_max
        )

        assert updated_pickup.otp_attempts == 0
        assert updated_pickup.otp_request_count == 1
        assert updated_pickup.otp_last_requested_at is not None
        assert updated_pickup.otp_request_window_started_at is not None
        assert updated_pickup.otp_verified_at is None

        saved_pickup = db.get(
            Pickup,
            pickup.id,
        )

        assert saved_pickup.otp_hash == updated_pickup.otp_hash
        assert saved_pickup.otp_request_count == 1

    finally:
        cleanup_setup(
            db,
            pickup=pickup,
            location=location,
            customer=customer,
            user=user,
        )


def test_request_otp_rejects_cancelled_pickup(db):
    suffix = uuid.uuid4().hex

    user, customer, location, pickup = make_customer_setup(
        db,
        suffix,
    )

    pickup.status = PickupStatus.CANCELLED
    db.commit()

    try:
        with pytest.raises(HTTPException) as exc_info:
            request_otp(
                db=db,
                user=user,
                pickup_id=pickup.id,
            )

        assert exc_info.value.status_code == 400
        assert exc_info.value.detail == (
            "OTP cannot be generated for this pickup"
        )

    finally:
        cleanup_setup(
            db,
            pickup=pickup,
            location=location,
            customer=customer,
            user=user,
        )


def test_request_otp_rejects_collected_pickup(db):
    suffix = uuid.uuid4().hex

    user, customer, location, pickup = make_customer_setup(
        db,
        suffix,
    )

    pickup.status = PickupStatus.COLLECTED
    db.commit()

    try:
        with pytest.raises(HTTPException) as exc_info:
            request_otp(
                db=db,
                user=user,
                pickup_id=pickup.id,
            )

        assert exc_info.value.status_code == 400
        assert exc_info.value.detail == (
            "OTP cannot be generated for this pickup"
        )

    finally:
        cleanup_setup(
            db,
            pickup=pickup,
            location=location,
            customer=customer,
            user=user,
        )


def test_request_otp_enforces_cooldown(db):
    suffix = uuid.uuid4().hex

    user, customer, location, pickup = make_customer_setup(
        db,
        suffix,
    )

    pickup.otp_last_requested_at = (
        datetime.now(timezone.utc)
        - timedelta(
            seconds=OTP_REQUEST_COOLDOWN_SECONDS - 10
        )
    )
    pickup.otp_request_count = 1
    pickup.otp_request_window_started_at = (
        datetime.now(timezone.utc)
        - timedelta(minutes=5)
    )
    db.commit()

    try:
        with pytest.raises(HTTPException) as exc_info:
            request_otp(
                db=db,
                user=user,
                pickup_id=pickup.id,
            )

        assert exc_info.value.status_code == 429
        assert exc_info.value.detail == (
            "Please wait before requesting another OTP"
        )

    finally:
        cleanup_setup(
            db,
            pickup=pickup,
            location=location,
            customer=customer,
            user=user,
        )


def test_request_otp_enforces_window_limit(db):
    suffix = uuid.uuid4().hex

    user, customer, location, pickup = make_customer_setup(
        db,
        suffix,
    )

    now = datetime.now(timezone.utc)

    pickup.otp_last_requested_at = (
        now - timedelta(minutes=2)
    )
    pickup.otp_request_window_started_at = (
        now - timedelta(minutes=10)
    )
    pickup.otp_request_count = (
        OTP_REQUESTS_PER_WINDOW
    )

    db.commit()

    try:
        with pytest.raises(HTTPException) as exc_info:
            request_otp(
                db=db,
                user=user,
                pickup_id=pickup.id,
            )

        assert exc_info.value.status_code == 429
        assert exc_info.value.detail == (
            "Maximum OTP requests exceeded. "
            "Please try again later."
        )

    finally:
        cleanup_setup(
            db,
            pickup=pickup,
            location=location,
            customer=customer,
            user=user,
        )


def test_request_otp_resets_expired_request_window(db):
    suffix = uuid.uuid4().hex

    user, customer, location, pickup = make_customer_setup(
        db,
        suffix,
    )

    now = datetime.now(timezone.utc)

    pickup.otp_last_requested_at = (
        now - timedelta(minutes=2)
    )
    pickup.otp_request_window_started_at = (
        now - timedelta(hours=2)
    )
    pickup.otp_request_count = 5

    db.commit()

    try:
        _, otp = request_otp(
            db=db,
            user=user,
            pickup_id=pickup.id,
        )

        db.refresh(pickup)

        assert len(otp) == 6
        assert otp.isdigit()
        assert pickup.otp_request_count == 1
        assert pickup.otp_request_window_started_at > (
            now - timedelta(seconds=10)
        )

    finally:
        cleanup_setup(
            db,
            pickup=pickup,
            location=location,
            customer=customer,
            user=user,
        )


def test_request_otp_rejects_pickup_owned_by_another_customer(
    db,
):
    suffix_a = uuid.uuid4().hex
    suffix_b = uuid.uuid4().hex

    user_a, customer_a, location_a, pickup = (
        make_customer_setup(db, suffix_a)
    )

    user_b, customer_b, location_b, pickup_b = (
        make_customer_setup(db, suffix_b)
    )

    try:
        with pytest.raises(HTTPException) as exc_info:
            request_otp(
                db=db,
                user=user_b,
                pickup_id=pickup.id,
            )

        assert exc_info.value.status_code == 404
        assert exc_info.value.detail == (
            "Pickup not found"
        )

    finally:
        cleanup_setup(
            db,
            pickup=pickup,
            location=location_a,
            customer=customer_a,
            user=user_a,
        )

        cleanup_setup(
            db,
            pickup=pickup_b,
            location=location_b,
            customer=customer_b,
            user=user_b,
        )

def test_request_otp_rejects_after_maximum_requests_in_window(db):
    user = customer = location = pickup = None

    try:
        user, customer, location, pickup = make_customer_setup(
            db,
            "otp-limit",
        )

        # Simulate 5 requests already made in the current window.
        pickup.otp_request_count = 5
        pickup.otp_request_window_started_at = datetime.now(timezone.utc)
        db.commit()

        with pytest.raises(HTTPException) as exc:
            request_otp(
                db,
                user,
                pickup.id,
            )

        assert exc.value.status_code == 429
        assert "Maximum OTP requests exceeded" in exc.value.detail

    finally:
        if pickup is not None:
            db.delete(pickup)

        if location is not None:
            db.delete(location)

        if customer is not None:
            db.delete(customer)

        if user is not None:
            db.delete(user)

        db.commit()

def test_request_otp_rejects_within_cooldown(db):
    user = customer = location = pickup = None

    try:
        user, customer, location, pickup = make_customer_setup(
            db,
            "otp-cooldown",
        )

        now = datetime.now(timezone.utc)

        pickup.otp_last_requested_at = now
        pickup.otp_request_window_started_at = now
        pickup.otp_request_count = 1
        db.commit()

        with pytest.raises(HTTPException) as exc:
            request_otp(
                db,
                user,
                pickup.id,
            )

        assert exc.value.status_code == 429
        assert "Please wait before requesting another OTP" in exc.value.detail

    finally:
        if pickup is not None:
            db.delete(pickup)
        if location is not None:
            db.delete(location)
        if customer is not None:
            db.delete(customer)
        if user is not None:
            db.delete(user)

        db.commit()