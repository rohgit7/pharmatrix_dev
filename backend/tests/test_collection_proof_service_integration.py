import asyncio
import uuid
from datetime import datetime, timezone
from unittest.mock import Mock, patch

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

from app.services.collection_proof_service import (
    upload_collection_proof,
)


# ---------------------------------------------------------
# Setup
# ---------------------------------------------------------

def make_proof_setup(db):
    suffix = uuid.uuid4().hex

    driver_user = User(
        auth_user_id=uuid.uuid4(),
        name=f"Proof Driver {suffix}",
        email=f"proof-driver-{suffix}@test.local",
        role=UserRole.DRIVER,
        is_active=True,
    )
    db.add(driver_user)
    db.flush()

    customer_user = User(
        auth_user_id=uuid.uuid4(),
        name=f"Proof Customer {suffix}",
        email=f"proof-customer-{suffix}@test.local",
        role=UserRole.CUSTOMER,
        is_active=True,
    )
    db.add(customer_user)
    db.flush()

    customer = Customer(
        user_id=customer_user.id,
        customer_type=CustomerType.PHARMACY,
        legal_name="Proof Test Pharmacy",
        display_name="Proof Test Pharmacy",
        phone="9876543210",
        email=customer_user.email,
        is_active=True,
    )
    db.add(customer)
    db.flush()

    location = CustomerLocation(
        customer_id=customer.id,
        location_code=f"PRF-{suffix[:10]}",
        name="Proof Test Branch",
        address_line_1="Proof Road",
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
        verification_token=f"proof-token-{suffix}",
        qr_verified_at=datetime.now(timezone.utc),
        otp_verified_at=datetime.now(timezone.utc),
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
        name="Proof Test Warehouse",
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
        execution_status=RouteStopStatus.IN_PROGRESS,
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
# Valid JPG
# ---------------------------------------------------------

def test_upload_collection_proof_persists_storage_path(
    db,
):
    setup = make_proof_setup(db)

    try:
        upload_mock = Mock()
        bucket_mock = Mock()
        bucket_mock.upload = upload_mock

        storage_mock = Mock()
        storage_mock.storage.from_.return_value = (
            bucket_mock
        )

        class FakeUploadFile:
            filename = "collection.jpg"
            content_type = "image/jpeg"

            async def read(self):
                return (
                    b"\xff\xd8\xff\xe0"
                    b"\x00\x10JFIF"
                    b"test-image"
                )

        with patch(
            "app.services.collection_proof_service.get_supabase_admin",
            return_value=storage_mock,
        ):
            updated_stop = asyncio.run(
                upload_collection_proof(
                    db=db,
                    user=setup["driver_user"],
                    route_id=setup["route"].id,
                    stop_id=setup["stop"].id,
                    file=FakeUploadFile(),
                )
            )

        assert updated_stop.id == setup["stop"].id

        assert (
            updated_stop.proof_storage_path
            is not None
        )

        assert updated_stop.proof_storage_path.startswith(
            f"routes/{setup['route'].id}/"
            f"stops/{setup['stop'].id}/"
        )

        assert updated_stop.proof_storage_path.endswith(
            ".jpg"
        )

        assert (
            updated_stop.proof_uploaded_at
            is not None
        )

        upload_mock.assert_called_once()

        args = upload_mock.call_args.args

        assert args[0] == (
            updated_stop.proof_storage_path
        )

        assert args[1].startswith(
            b"\xff\xd8\xff"
        )

        options = args[2]

        assert options["content-type"] == "image/jpeg"
        assert options["upsert"] is False

        db.refresh(setup["stop"])

        assert (
            setup["stop"].proof_storage_path
            == updated_stop.proof_storage_path
        )

        assert (
            setup["stop"].proof_uploaded_at
            is not None
        )

    finally:
        cleanup_setup(db, setup)


# ---------------------------------------------------------
# Missing QR
# ---------------------------------------------------------

def test_upload_requires_qr_verification(db):
    setup = make_proof_setup(db)

    setup["pickup"].qr_verified_at = None
    db.commit()

    try:
        class FakeUploadFile:
            filename = "collection.jpg"
            content_type = "image/jpeg"

            async def read(self):
                return b"\xff\xd8\xff\xe0test"

        with pytest.raises(HTTPException) as exc_info:
            asyncio.run(
                upload_collection_proof(
                    db=db,
                    user=setup["driver_user"],
                    route_id=setup["route"].id,
                    stop_id=setup["stop"].id,
                    file=FakeUploadFile(),
                )
            )

        assert exc_info.value.status_code == 409
        assert exc_info.value.detail == (
            "Pickup QR has not been verified"
        )

    finally:
        cleanup_setup(db, setup)


# ---------------------------------------------------------
# Missing OTP
# ---------------------------------------------------------

def test_upload_requires_otp_verification(db):
    setup = make_proof_setup(db)

    setup["pickup"].otp_verified_at = None
    db.commit()

    try:
        class FakeUploadFile:
            filename = "collection.jpg"
            content_type = "image/jpeg"

            async def read(self):
                return b"\xff\xd8\xff\xe0test"

        with pytest.raises(HTTPException) as exc_info:
            asyncio.run(
                upload_collection_proof(
                    db=db,
                    user=setup["driver_user"],
                    route_id=setup["route"].id,
                    stop_id=setup["stop"].id,
                    file=FakeUploadFile(),
                )
            )

        assert exc_info.value.status_code == 409
        assert exc_info.value.detail == (
            "Customer OTP has not been verified"
        )

    finally:
        cleanup_setup(db, setup)


# ---------------------------------------------------------
# Unsupported MIME
# ---------------------------------------------------------

def test_upload_rejects_unsupported_mime_type(
    db,
):
    setup = make_proof_setup(db)

    try:
        class FakeUploadFile:
            filename = "collection.pdf"
            content_type = "application/pdf"

            async def read(self):
                return b"%PDF-1.7"

        with pytest.raises(HTTPException) as exc_info:
            asyncio.run(
                upload_collection_proof(
                    db=db,
                    user=setup["driver_user"],
                    route_id=setup["route"].id,
                    stop_id=setup["stop"].id,
                    file=FakeUploadFile(),
                )
            )

        assert exc_info.value.status_code == 400
        assert exc_info.value.detail == (
            "Only JPG and PNG images are allowed"
        )

    finally:
        cleanup_setup(db, setup)


# ---------------------------------------------------------
# Invalid signature
# ---------------------------------------------------------

def test_upload_rejects_invalid_image_signature(
    db,
):
    setup = make_proof_setup(db)

    try:
        class FakeUploadFile:
            filename = "collection.jpg"
            content_type = "image/jpeg"

            async def read(self):
                return b"not-a-real-jpeg"

        with pytest.raises(HTTPException) as exc_info:
            asyncio.run(
                upload_collection_proof(
                    db=db,
                    user=setup["driver_user"],
                    route_id=setup["route"].id,
                    stop_id=setup["stop"].id,
                    file=FakeUploadFile(),
                )
            )

        assert exc_info.value.status_code == 400
        assert exc_info.value.detail == (
            "File content does not match "
            "the declared file type"
        )

    finally:
        cleanup_setup(db, setup)


# ---------------------------------------------------------
# Duplicate proof
# ---------------------------------------------------------

def test_upload_rejects_duplicate_proof(db):
    setup = make_proof_setup(db)

    setup["stop"].proof_storage_path = (
        "routes/existing/proof.jpg"
    )
    db.commit()

    try:
        class FakeUploadFile:
            filename = "collection.jpg"
            content_type = "image/jpeg"

            async def read(self):
                return b"\xff\xd8\xff\xe0test"

        with pytest.raises(HTTPException) as exc_info:
            asyncio.run(
                upload_collection_proof(
                    db=db,
                    user=setup["driver_user"],
                    route_id=setup["route"].id,
                    stop_id=setup["stop"].id,
                    file=FakeUploadFile(),
                )
            )

        assert exc_info.value.status_code == 409
        assert exc_info.value.detail == (
            "Collection proof has already been uploaded"
        )

    finally:
        cleanup_setup(db, setup)