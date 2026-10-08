import hashlib
import uuid
from datetime import datetime, timedelta, timezone

import pytest
from fastapi import HTTPException

from app.models.customer import Customer
from app.models.customer_location import CustomerLocation
from app.models.driver import Driver
from app.models.enums import (
    CustomerType,
    PickupPriority,
    PickupStatus,
    RouteStatus,
    RouteStopStatus,
    RouteStopType,
    UserRole,
)
from app.models.pickup import Pickup
from app.models.route import Route
from app.models.route_stop import RouteStop
from app.models.user import User
from app.models.warehouse import Warehouse

from app.services.pickup_verification_driver_service import (
    verify_otp,
    verify_qr,
)


# ---------------------------------------------------------
# Setup
# ---------------------------------------------------------

def make_driver_route_setup(db):
    suffix = uuid.uuid4().hex

    driver_user = User(
        auth_user_id=uuid.uuid4(),
        name=f"Driver Verify {suffix}",
        email=f"driver-verify-{suffix}@test.local",
        role=UserRole.DRIVER,
        is_active=True,
    )
    db.add(driver_user)
    db.flush()

    customer_user = User(
        auth_user_id=uuid.uuid4(),
        name=f"Verification Customer {suffix}",
        email=f"verify-customer-{suffix}@test.local",
        role=UserRole.CUSTOMER,
        is_active=True,
    )
    db.add(customer_user)
    db.flush()

    customer = Customer(
        user_id=customer_user.id,
        customer_type=CustomerType.PHARMACY,
        legal_name="Driver Verification Pharmacy",
        display_name="Driver Verification Pharmacy",
        phone="9876543210",
        email=customer_user.email,
        is_active=True,
    )
    db.add(customer)
    db.flush()

    location = CustomerLocation(
        customer_id=customer.id,
        location_code=f"DRV-{suffix[:10]}",
        name="Verification Branch",
        address_line_1="Verification Road",
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
        status=PickupStatus.SCHEDULED,
        priority=PickupPriority.NORMAL,
        requested_date=datetime.now(timezone.utc),
        estimated_weight_kg=10,
        verification_token=f"qr-token-{suffix}",
    )
    db.add(pickup)
    db.flush()

    driver = Driver(
        user_id=driver_user.id,
        employee_id=f"EMP-{suffix[:10]}",
        phone="9988776655",
        license_number=f"LIC-{suffix[:10]}",
        is_available=False,
    )
    db.add(driver)
    db.flush()

    warehouse = Warehouse(
        code=f"WH-{suffix[:10]}",
        name="Verification Warehouse",
        address="Warehouse Road",
        city="Bengaluru",
        state="Karnataka",
        postal_code="560010",
        latitude=12.9800,
        longitude=77.6000,
        active=True,
    )
    db.add(warehouse)
    db.flush()

    route = Route(
        route_code=f"ROUTE-{suffix[:10]}",
        route_date=datetime.now(timezone.utc),
        warehouse_id=warehouse.id,
        driver_id=driver.id,
        status=RouteStatus.IN_PROGRESS,
    )
    db.add(route)
    db.flush()

    stop = RouteStop(
        route_id=route.id,
        sequence_number=1,
        stop_type=RouteStopType.PICKUP,
        pickup_id=pickup.id,
        execution_status=RouteStopStatus.PENDING,
    )
    db.add(stop)

    db.commit()

    db.refresh(driver_user)
    db.refresh(customer_user)
    db.refresh(customer)
    db.refresh(location)
    db.refresh(pickup)
    db.refresh(driver)
    db.refresh(warehouse)
    db.refresh(route)
    db.refresh(stop)

    return {
        "driver_user": driver_user,
        "customer_user": customer_user,
        "customer": customer,
        "location": location,
        "pickup": pickup,
        "driver": driver,
        "warehouse": warehouse,
        "route": route,
        "stop": stop,
    }


def cleanup_setup(db, setup):
    db.delete(setup["route"])
    db.delete(setup["pickup"])
    db.delete(setup["location"])
    db.delete(setup["customer"])
    db.delete(setup["driver"])
    db.delete(setup["warehouse"])
    db.delete(setup["customer_user"])
    db.delete(setup["driver_user"])
    db.commit()


# ---------------------------------------------------------
# QR verification
# ---------------------------------------------------------

def test_verify_qr_persists_arrival_and_verification(
    db,
):
    setup = make_driver_route_setup(db)

    try:
        stop = verify_qr(
            db=db,
            user=setup["driver_user"],
            route_id=setup["route"].id,
            stop_id=setup["stop"].id,
            qr_token=setup["pickup"].verification_token,
        )

        assert stop.id == setup["stop"].id
        assert (
            stop.execution_status
            == RouteStopStatus.ARRIVED
        )
        assert stop.arrived_at is not None

        db.refresh(setup["pickup"])
        db.refresh(setup["stop"])

        assert setup["pickup"].qr_verified_at is not None
        assert (
            setup["stop"].execution_status
            == RouteStopStatus.ARRIVED
        )

    finally:
        cleanup_setup(db, setup)


def test_verify_qr_rejects_invalid_token(db):
    setup = make_driver_route_setup(db)

    try:
        with pytest.raises(HTTPException) as exc_info:
            verify_qr(
                db=db,
                user=setup["driver_user"],
                route_id=setup["route"].id,
                stop_id=setup["stop"].id,
                qr_token="wrong-token",
            )

        assert exc_info.value.status_code == 403
        assert exc_info.value.detail == (
            "Invalid pickup QR code"
        )

        db.refresh(setup["pickup"])
        db.refresh(setup["stop"])

        assert setup["pickup"].qr_verified_at is None
        assert (
            setup["stop"].execution_status
            == RouteStopStatus.PENDING
        )

    finally:
        cleanup_setup(db, setup)


def test_verify_qr_rejects_non_pickup_stop(db):
    setup = make_driver_route_setup(db)

    try:
        setup["stop"].stop_type = (
            RouteStopType.WAREHOUSE
        )
        setup["stop"].pickup_id = None
        setup["stop"].warehouse_id = (
            setup["warehouse"].id
        )
        db.commit()

        with pytest.raises(HTTPException) as exc_info:
            verify_qr(
                db=db,
                user=setup["driver_user"],
                route_id=setup["route"].id,
                stop_id=setup["stop"].id,
                qr_token=setup["pickup"].verification_token,
            )

        assert exc_info.value.status_code == 400
        assert exc_info.value.detail == (
            "QR verification is only for pickup stops"
        )

    finally:
        cleanup_setup(db, setup)


# ---------------------------------------------------------
# OTP verification
# ---------------------------------------------------------

def test_verify_otp_rejects_before_qr(db):
    setup = make_driver_route_setup(db)

    try:
        otp = "123456"

        setup["pickup"].otp_hash = (
            hashlib.sha256(
                otp.encode("utf-8")
            ).hexdigest()
        )
        setup["pickup"].otp_expires_at = (
            datetime.now(timezone.utc)
            + timedelta(minutes=10)
        )
        db.commit()

        with pytest.raises(HTTPException) as exc_info:
            verify_otp(
                db=db,
                user=setup["driver_user"],
                route_id=setup["route"].id,
                stop_id=setup["stop"].id,
                otp=otp,
            )

        assert exc_info.value.status_code == 409
        assert exc_info.value.detail == (
            "Pickup QR must be verified first"
        )

    finally:
        cleanup_setup(db, setup)


def test_verify_otp_persists_verification(
    db,
):
    setup = make_driver_route_setup(db)

    try:
        otp = "123456"

        setup["pickup"].qr_verified_at = (
            datetime.now(timezone.utc)
        )
        setup["pickup"].otp_hash = (
            hashlib.sha256(
                otp.encode("utf-8")
            ).hexdigest()
        )
        setup["pickup"].otp_expires_at = (
            datetime.now(timezone.utc)
            + timedelta(minutes=10)
        )
        db.commit()

        # QR verification normally moves the stop
        # to ARRIVED before OTP verification.
        setup["stop"].execution_status = (
            RouteStopStatus.ARRIVED
        )
        db.commit()

        stop = verify_otp(
            db=db,
            user=setup["driver_user"],
            route_id=setup["route"].id,
            stop_id=setup["stop"].id,
            otp=otp,
        )

        assert stop.id == setup["stop"].id
        assert (
            stop.execution_status
            == RouteStopStatus.IN_PROGRESS
        )

        db.refresh(setup["pickup"])
        db.refresh(setup["stop"])

        assert setup["pickup"].otp_verified_at is not None
        assert setup["pickup"].otp_attempts == 1
        assert (
            setup["stop"].execution_status
            == RouteStopStatus.IN_PROGRESS
        )

    finally:
        cleanup_setup(db, setup)


def test_verify_otp_rejects_invalid_otp(
    db,
):
    setup = make_driver_route_setup(db)

    try:
        valid_otp = "123456"

        setup["pickup"].qr_verified_at = (
            datetime.now(timezone.utc)
        )
        setup["pickup"].otp_hash = (
            hashlib.sha256(
                valid_otp.encode("utf-8")
            ).hexdigest()
        )
        setup["pickup"].otp_expires_at = (
            datetime.now(timezone.utc)
            + timedelta(minutes=10)
        )

        setup["stop"].execution_status = (
            RouteStopStatus.ARRIVED
        )

        db.commit()

        with pytest.raises(HTTPException) as exc_info:
            verify_otp(
                db=db,
                user=setup["driver_user"],
                route_id=setup["route"].id,
                stop_id=setup["stop"].id,
                otp="999999",
            )

        assert exc_info.value.status_code == 400
        assert exc_info.value.detail == (
            "Invalid OTP"
        )

        db.refresh(setup["pickup"])

        assert setup["pickup"].otp_verified_at is None
        assert setup["pickup"].otp_attempts == 1

    finally:
        cleanup_setup(db, setup)


def test_verify_otp_rejects_expired_otp(
    db,
):
    setup = make_driver_route_setup(db)

    try:
        otp = "123456"

        setup["pickup"].qr_verified_at = (
            datetime.now(timezone.utc)
        )
        setup["pickup"].otp_hash = (
            hashlib.sha256(
                otp.encode("utf-8")
            ).hexdigest()
        )
        setup["pickup"].otp_expires_at = (
            datetime.now(timezone.utc)
            - timedelta(minutes=1)
        )

        setup["stop"].execution_status = (
            RouteStopStatus.ARRIVED
        )

        db.commit()

        with pytest.raises(HTTPException) as exc_info:
            verify_otp(
                db=db,
                user=setup["driver_user"],
                route_id=setup["route"].id,
                stop_id=setup["stop"].id,
                otp=otp,
            )

        assert exc_info.value.status_code == 400
        assert exc_info.value.detail == (
            "OTP has expired"
        )

    finally:
        cleanup_setup(db, setup)

def test_verify_otp_rejects_expired_otp(db):
    setup = make_driver_route_setup(db)

    pickup = setup["pickup"]
    stop = setup["stop"]
    driver = setup["driver"]
    route = setup["route"]

    pickup.qr_verified_at = datetime.now(timezone.utc)
    pickup.otp_hash = hashlib.sha256("123456".encode("utf-8")).hexdigest()
    pickup.otp_expires_at = datetime.now(timezone.utc) - timedelta(minutes=1)
    pickup.otp_attempts = 0

    stop.execution_status = RouteStopStatus.ARRIVED

    db.commit()

    try:
        with pytest.raises(HTTPException) as exc:
            verify_otp(
                db,
                driver,
                route.id,
                stop.id,
                "123456",
            )

        assert exc.value.status_code == 400
        assert exc.value.detail == "OTP has expired"

    finally:
        db.delete(stop)
        db.delete(route)
        db.delete(pickup)
        db.delete(setup["location"])
        db.delete(setup["customer"])
        db.delete(setup["warehouse"])
        db.delete(driver)
        db.commit()

def test_verify_otp_rejects_after_maximum_attempts(db):
    setup = make_driver_route_setup(db)

    pickup = setup["pickup"]
    stop = setup["stop"]
    driver = setup["driver"]
    route = setup["route"]

    pickup.qr_verified_at = datetime.now(timezone.utc)
    pickup.otp_hash = hashlib.sha256("123456".encode("utf-8")).hexdigest()
    pickup.otp_expires_at = datetime.now(timezone.utc) + timedelta(minutes=10)
    pickup.otp_attempts = 5

    stop.execution_status = RouteStopStatus.ARRIVED

    db.commit()

    try:
        with pytest.raises(HTTPException) as exc:
            verify_otp(
                db,
                driver,
                route.id,
                stop.id,
                "123456",
            )

        assert exc.value.status_code == 429
        assert exc.value.detail == "Maximum OTP attempts exceeded"

    finally:
        db.delete(stop)
        db.delete(route)
        db.delete(pickup)
        db.delete(setup["location"])
        db.delete(setup["customer"])
        db.delete(setup["warehouse"])
        db.delete(driver)
        db.commit()

def test_verify_otp_rejects_invalid_otp(db):
    setup = make_driver_route_setup(db)

    pickup = setup["pickup"]
    stop = setup["stop"]
    driver = setup["driver"]
    route = setup["route"]

    pickup.qr_verified_at = datetime.now(timezone.utc)
    pickup.otp_hash = hashlib.sha256("123456".encode("utf-8")).hexdigest()
    pickup.otp_expires_at = datetime.now(timezone.utc) + timedelta(minutes=10)
    pickup.otp_attempts = 0

    stop.execution_status = RouteStopStatus.ARRIVED

    db.commit()

    try:
        with pytest.raises(HTTPException) as exc:
            verify_otp(
                db,
                driver,
                route.id,
                stop.id,
                "999999",
            )

        assert exc.value.status_code == 400
        assert exc.value.detail == "Invalid OTP"

        db.refresh(pickup)
        assert pickup.otp_attempts == 1

    finally:
        db.delete(stop)
        db.delete(route)
        db.delete(pickup)
        db.delete(setup["location"])
        db.delete(setup["customer"])
        db.delete(setup["warehouse"])
        db.delete(driver)
        db.commit()