import asyncio
import uuid
from datetime import date, datetime, timezone
from decimal import Decimal
from types import SimpleNamespace
from unittest.mock import Mock

import pytest
from fastapi import HTTPException
from sqlalchemy import select

from app.models.customer import Customer
from app.models.customer_location import CustomerLocation
from app.models.disposal_certificate import DisposalCertificate
from app.models.disposal_shipment import (
    DisposalShipment,
    DisposalShipmentItem,
)
from app.models.enums import (
    CustomerType,
    DisposalShipmentStatus,
    DriverStatus,
    NotificationChannel,
    NotificationType,
    PickupPriority,
    PickupStatus,
    RouteStatus,
    RouteStopStatus,
    RouteStopType,
    VehicleStatus,
    VehicleType,
    WasteBinColor,
    WasteType,
    WarehouseIntakeStatus,
)
from app.models.facility import Facility
from app.models.notification import Notification
from app.models.pickup import Pickup
from app.models.route import Route
from app.models.route_stop import RouteStop
from app.models.user import User, UserRole
from app.models.vehicle import Vehicle
from app.models.driver import Driver
from app.models.warehouse import Warehouse
from app.models.warehouse_intake import WarehouseIntake
from app.models.warehouse_intake_item import WarehouseIntakeItem

from app.services.disposal_certificate_service import (
    MAX_FILE_SIZE,
    upload_disposal_certificate,
)


# =========================================================
# Helpers
# =========================================================

class FakeUploadFile:
    def __init__(
        self,
        *,
        filename: str,
        content_type: str,
        contents: bytes,
    ):
        self.filename = filename
        self.content_type = content_type
        self._contents = contents

    async def read(self):
        return self._contents


def make_upload_file(
    *,
    filename: str,
    content_type: str,
    contents: bytes,
):
    return FakeUploadFile(
        filename=filename,
        content_type=content_type,
        contents=contents,
    )


def make_user(
    db,
    *,
    role: UserRole,
    name: str,
    email: str,
):
    user = User(
        auth_user_id=uuid.uuid4(),
        name=name,
        email=email,
        role=role,
        is_active=True,
    )
    db.add(user)
    db.flush()
    return user


def make_facility(
    db,
    *,
    user_id: int,
    code: str = "FAC-CERT-001",
):
    facility = Facility(
        user_id=user_id,
        facility_code=code,
        legal_name="Certificate Test Facility",
        phone="9876543210",
        email=f"{code.lower()}@test.local",
        license_number=f"LIC-{code}",
        license_expiry=date(2030, 12, 31),
        address="Facility Road",
        city="Bengaluru",
        state="Karnataka",
        postal_code="560020",
        latitude=12.9716,
        longitude=77.5946,
        active=True,
    )
    db.add(facility)
    db.flush()
    return facility


def make_warehouse(db):
    warehouse = Warehouse(
        code=f"WH-CERT-{uuid.uuid4().hex[:6].upper()}",
        name="Certificate Test Warehouse",
        address="Warehouse Road",
        city="Bengaluru",
        state="Karnataka",
        postal_code="560001",
        latitude=12.9716,
        longitude=77.5946,
        active=True,
    )
    db.add(warehouse)
    db.flush()
    return warehouse


def make_driver(db):
    user = make_user(
        db,
        role=UserRole.DRIVER,
        name="Certificate Driver",
        email=f"driver-{uuid.uuid4().hex[:8]}@test.local",
    )

    driver = Driver(
        user_id=user.id,
        employee_id=f"EMP-CERT-{uuid.uuid4().hex[:6].upper()}",
        phone="9876543211",
        license_number=f"DL-CERT-{uuid.uuid4().hex[:6].upper()}",
        license_expiry=date(2030, 12, 31),
        status=DriverStatus.ACTIVE,
        is_available=True,
    )
    db.add(driver)
    db.flush()

    return driver


def make_vehicle(db):
    vehicle = Vehicle(
        registration_number=f"KA01CERT{uuid.uuid4().hex[:4].upper()}",
        vehicle_type=VehicleType.VAN,
        capacity_kg=500,
        status=VehicleStatus.AVAILABLE,
    )
    db.add(vehicle)
    db.flush()
    return vehicle


def make_customer(db):
    user = make_user(
        db,
        role=UserRole.CUSTOMER,
        name="Certificate Customer",
        email=f"customer-{uuid.uuid4().hex[:8]}@test.local",
    )

    customer = Customer(
        user_id=user.id,
        customer_type=CustomerType.PHARMACY,
        legal_name="Certificate Test Pharmacy",
        display_name="Certificate Test Pharmacy",
        phone="9876543212",
        email=user.email,
        is_active=True,
    )
    db.add(customer)
    db.flush()

    location = CustomerLocation(
        customer_id=customer.id,
        location_code=f"LOC-CERT-{uuid.uuid4().hex[:6].upper()}",
        name="Certificate Customer Location",
        address_line_1="Customer Road",
        city="Bengaluru",
        state="Karnataka",
        postal_code="560002",
        latitude=12.9720,
        longitude=77.5950,
        contact_name="Certificate Contact",
        contact_phone="9876543212",
        service_time_seconds=300,
        pickup_enabled=True,
        is_active=True,
    )
    db.add(location)
    db.flush()

    return user, customer, location


def make_completed_route_with_pickup(
    db,
    *,
    warehouse,
    driver,
    vehicle,
):
    customer_user, customer, location = make_customer(db)

    pickup = Pickup(
        pickup_code=f"PU-CERT-{uuid.uuid4().hex[:6].upper()}",
        customer_id=customer.id,
        location_id=location.id,
        status=PickupStatus.COLLECTED,
        priority=PickupPriority.NORMAL,
        estimated_weight_kg=Decimal("10.00"),
        verification_token=f"TOKEN-{uuid.uuid4().hex}",
    )
    db.add(pickup)
    db.flush()

    route = Route(
        route_code=f"RT-CERT-{uuid.uuid4().hex[:6].upper()}",
        route_date=date.today(),
        warehouse_id=warehouse.id,
        driver_id=driver.id,
        vehicle_id=vehicle.id,
        status=RouteStatus.COMPLETED,
    )
    db.add(route)
    db.flush()

    pickup_stop = RouteStop(
        route_id=route.id,
        sequence_number=1,
        stop_type=RouteStopType.PICKUP,
        pickup_id=pickup.id,
        execution_status=RouteStopStatus.COMPLETED,
        collected_weight_kg=Decimal("10.00"),
    )
    db.add(pickup_stop)

    warehouse_stop = RouteStop(
        route_id=route.id,
        sequence_number=2,
        stop_type=RouteStopType.WAREHOUSE,
        warehouse_id=warehouse.id,
        execution_status=RouteStopStatus.COMPLETED,
    )
    db.add(warehouse_stop)

    db.flush()

    return customer_user, customer, route


def make_shipment(
    db,
    *,
    facility,
    warehouse,
    driver,
    vehicle,
    status=DisposalShipmentStatus.RECEIVED,
    include_customer_route=True,
):
    if include_customer_route:
        _, _, route = make_completed_route_with_pickup(
            db,
            warehouse=warehouse,
            driver=driver,
            vehicle=vehicle,
        )
    else:
        route = Route(
            route_code=f"RT-CERT-{uuid.uuid4().hex[:6].upper()}",
            route_date=date.today(),
            warehouse_id=warehouse.id,
            driver_id=driver.id,
            vehicle_id=vehicle.id,
            status=RouteStatus.COMPLETED,
        )
        db.add(route)
        db.flush()

    intake = WarehouseIntake(
        intake_code=f"INT-CERT-{uuid.uuid4().hex[:6].upper()}",
        route_id=route.id,
        warehouse_id=warehouse.id,
        driver_id=driver.id,
        vehicle_id=vehicle.id,
        status=WarehouseIntakeStatus.RECEIVED,
        expected_weight_kg=Decimal("10.00"),
        received_weight_kg=Decimal("10.00"),
        received_at=datetime.now(timezone.utc),
    )
    db.add(intake)
    db.flush()

    intake_item = WarehouseIntakeItem(
        intake_id=intake.id,
        bin_color=WasteBinColor.YELLOW,
        waste_type=WasteType.SOILED,
        expected_weight_kg=Decimal("10.00"),
        received_weight_kg=Decimal("10.00"),
    )
    db.add(intake_item)
    db.flush()

    shipment = DisposalShipment(
        shipment_code=f"DS-CERT-{uuid.uuid4().hex[:6].upper()}",
        intake_id=intake.id,
        facility_id=facility.id,
        status=status,
        expected_weight_kg=Decimal("10.00"),
    )
    db.add(shipment)
    db.flush()

    shipment_item = DisposalShipmentItem(
        shipment_id=shipment.id,
        warehouse_intake_item_id=intake_item.id,
        expected_weight_kg=Decimal("10.00"),
    )
    db.add(shipment_item)
    db.flush()

    return shipment, shipment_item


def valid_pdf():
    return b"%PDF-1.7\ncertificate test"


# =========================================================
# Successful upload
# =========================================================

def test_upload_disposal_certificate_success(
    db,
    monkeypatch,
):
    facility_user = make_user(
        db,
        role=UserRole.FACILITY,
        name="Certificate Facility User",
        email=f"facility-{uuid.uuid4().hex[:8]}@test.local",
    )

    facility = make_facility(
        db,
        user_id=facility_user.id,
    )

    warehouse = make_warehouse(db)
    driver = make_driver(db)
    vehicle = make_vehicle(db)

    shipment, _ = make_shipment(
        db,
        facility=facility,
        warehouse=warehouse,
        driver=driver,
        vehicle=vehicle,
    )

    upload_mock = Mock()

    monkeypatch.setattr(
        "app.services.disposal_certificate_service.supabase_admin",
        SimpleNamespace(
            storage=SimpleNamespace(
                from_=lambda bucket: SimpleNamespace(
                    upload=upload_mock,
                )
            )
        ),
    )

    file = make_upload_file(
        filename="certificate.pdf",
        content_type="application/pdf",
        contents=valid_pdf(),
    )

    issued_at = datetime(2026, 10, 6, tzinfo=timezone.utc)

    certificate = asyncio.run(
        upload_disposal_certificate(
            db=db,
            shipment_id=shipment.id,
            certificate_number="CERT-2026-001",
            issued_at=issued_at,
            file=file,
            notes="Final disposal certificate",
        )
    )

    db.commit()

    assert certificate.id is not None
    assert certificate.shipment_id == shipment.id
    assert certificate.certificate_number == "CERT-2026-001"
    assert certificate.file_name == "certificate.pdf"
    assert certificate.content_type == "application/pdf"
    assert certificate.issued_at == issued_at
    assert certificate.notes == "Final disposal certificate"

    assert certificate.certificate_code.startswith("DC-")
    assert certificate.storage_path.startswith(
        f"shipments/{shipment.id}/"
    )
    assert certificate.storage_path.endswith(".pdf")

    db.refresh(shipment)

    assert shipment.status == DisposalShipmentStatus.DISPOSED

    upload_mock.assert_called_once()

    upload_args = upload_mock.call_args.args

    assert upload_args[0] == certificate.storage_path
    assert upload_args[1] == valid_pdf()

    upload_options = upload_mock.call_args.args[2]

    assert upload_options["content-type"] == "application/pdf"
    assert upload_options["upsert"] is False


# =========================================================
# Valid image formats
# =========================================================

@pytest.mark.parametrize(
    "filename,content_type,contents",
    [
        (
            "certificate.jpg",
            "image/jpeg",
            b"\xFF\xD8\xFFcertificate",
        ),
        (
            "certificate.png",
            "image/png",
            b"\x89PNG\r\n\x1a\ncertificate",
        ),
    ],
)
def test_upload_disposal_certificate_accepts_valid_images(
    db,
    monkeypatch,
    filename,
    content_type,
    contents,
):
    facility_user = make_user(
        db,
        role=UserRole.FACILITY,
        name="Image Facility User",
        email=f"facility-{uuid.uuid4().hex[:8]}@test.local",
    )

    facility = make_facility(
        db,
        user_id=facility_user.id,
        code=f"FAC-{uuid.uuid4().hex[:6].upper()}",
    )

    warehouse = make_warehouse(db)
    driver = make_driver(db)
    vehicle = make_vehicle(db)

    shipment, _ = make_shipment(
        db,
        facility=facility,
        warehouse=warehouse,
        driver=driver,
        vehicle=vehicle,
        include_customer_route=False,
    )

    upload_mock = Mock()

    monkeypatch.setattr(
        "app.services.disposal_certificate_service.supabase_admin",
        SimpleNamespace(
            storage=SimpleNamespace(
                from_=lambda bucket: SimpleNamespace(
                    upload=upload_mock,
                )
            )
        ),
    )

    file = make_upload_file(
        filename=filename,
        content_type=content_type,
        contents=contents,
    )

    certificate = asyncio.run(
        upload_disposal_certificate(
            db=db,
            shipment_id=shipment.id,
            certificate_number="CERT-IMG-001",
            issued_at=datetime.now(timezone.utc),
            file=file,
        )
    )

    db.commit()

    assert certificate.content_type == content_type
    assert certificate.file_name == filename
    assert certificate.storage_path.endswith(
        ".jpg" if content_type == "image/jpeg" else ".png"
    )

    db.refresh(shipment)

    assert shipment.status == DisposalShipmentStatus.DISPOSED


# =========================================================
# Shipment validation
# =========================================================

def test_upload_certificate_rejects_missing_shipment(db):
    file = make_upload_file(
        filename="certificate.pdf",
        content_type="application/pdf",
        contents=valid_pdf(),
    )

    with pytest.raises(HTTPException) as exc:
        asyncio.run(
            upload_disposal_certificate(
                db=db,
                shipment_id=999999999,
                certificate_number="CERT-404",
                issued_at=datetime.now(timezone.utc),
                file=file,
            )
        )

    assert exc.value.status_code == 404
    assert exc.value.detail == "Disposal shipment not found"


@pytest.mark.parametrize(
    "status",
    [
        DisposalShipmentStatus.CREATED,
        DisposalShipmentStatus.IN_TRANSIT,
        DisposalShipmentStatus.CANCELLED,
        DisposalShipmentStatus.DISPOSED,
    ],
)
def test_upload_certificate_requires_received_or_discrepancy_status(
    db,
    status,
):
    facility_user = make_user(
        db,
        role=UserRole.FACILITY,
        name="Status Facility User",
        email=f"facility-{uuid.uuid4().hex[:8]}@test.local",
    )

    facility = make_facility(
        db,
        user_id=facility_user.id,
        code=f"FAC-{uuid.uuid4().hex[:6].upper()}",
    )

    warehouse = make_warehouse(db)
    driver = make_driver(db)
    vehicle = make_vehicle(db)

    shipment, _ = make_shipment(
        db,
        facility=facility,
        warehouse=warehouse,
        driver=driver,
        vehicle=vehicle,
        status=status,
        include_customer_route=False,
    )

    file = make_upload_file(
        filename="certificate.pdf",
        content_type="application/pdf",
        contents=valid_pdf(),
    )

    with pytest.raises(HTTPException) as exc:
        asyncio.run(
            upload_disposal_certificate(
                db=db,
                shipment_id=shipment.id,
                certificate_number="CERT-STATUS",
                issued_at=datetime.now(timezone.utc),
                file=file,
            )
        )

    assert exc.value.status_code == 409
    assert exc.value.detail == (
        "Shipment must be received before uploading disposal certificate"
    )


def test_upload_certificate_accepts_discrepancy_status(
    db,
    monkeypatch,
):
    facility_user = make_user(
        db,
        role=UserRole.FACILITY,
        name="Discrepancy Facility User",
        email=f"facility-{uuid.uuid4().hex[:8]}@test.local",
    )

    facility = make_facility(
        db,
        user_id=facility_user.id,
        code=f"FAC-{uuid.uuid4().hex[:6].upper()}",
    )

    warehouse = make_warehouse(db)
    driver = make_driver(db)
    vehicle = make_vehicle(db)

    shipment, _ = make_shipment(
        db,
        facility=facility,
        warehouse=warehouse,
        driver=driver,
        vehicle=vehicle,
        status=DisposalShipmentStatus.DISCREPANCY,
        include_customer_route=False,
    )

    upload_mock = Mock()

    monkeypatch.setattr(
        "app.services.disposal_certificate_service.supabase_admin",
        SimpleNamespace(
            storage=SimpleNamespace(
                from_=lambda bucket: SimpleNamespace(
                    upload=upload_mock,
                )
            )
        ),
    )

    file = make_upload_file(
        filename="certificate.pdf",
        content_type="application/pdf",
        contents=valid_pdf(),
    )

    certificate = asyncio.run(
        upload_disposal_certificate(
            db=db,
            shipment_id=shipment.id,
            certificate_number="CERT-DISCREPANCY",
            issued_at=datetime.now(timezone.utc),
            file=file,
        )
    )

    db.commit()

    assert certificate.shipment_id == shipment.id

    db.refresh(shipment)

    assert shipment.status == DisposalShipmentStatus.DISPOSED


# =========================================================
# Duplicate certificate
# =========================================================

def test_upload_certificate_rejects_duplicate_certificate(
    db,
    monkeypatch,
):
    facility_user = make_user(
        db,
        role=UserRole.FACILITY,
        name="Duplicate Facility User",
        email=f"facility-{uuid.uuid4().hex[:8]}@test.local",
    )

    facility = make_facility(
        db,
        user_id=facility_user.id,
        code=f"FAC-{uuid.uuid4().hex[:6].upper()}",
    )

    warehouse = make_warehouse(db)
    driver = make_driver(db)
    vehicle = make_vehicle(db)

    shipment, _ = make_shipment(
        db,
        facility=facility,
        warehouse=warehouse,
        driver=driver,
        vehicle=vehicle,
    )

    existing = DisposalCertificate(
        certificate_code=f"DC-{uuid.uuid4().hex[:8].upper()}",
        shipment_id=shipment.id,
        certificate_number="EXISTING-CERT",
        storage_path=f"shipments/{shipment.id}/existing.pdf",
        file_name="existing.pdf",
        content_type="application/pdf",
        issued_at=datetime.now(timezone.utc),
        uploaded_at=datetime.now(timezone.utc),
    )

    db.add(existing)
    db.commit()

    upload_mock = Mock()

    monkeypatch.setattr(
        "app.services.disposal_certificate_service.supabase_admin",
        SimpleNamespace(
            storage=SimpleNamespace(
                from_=lambda bucket: SimpleNamespace(
                    upload=upload_mock,
                )
            )
        ),
    )

    file = make_upload_file(
        filename="certificate.pdf",
        content_type="application/pdf",
        contents=valid_pdf(),
    )

    with pytest.raises(HTTPException) as exc:
        asyncio.run(
            upload_disposal_certificate(
                db=db,
                shipment_id=shipment.id,
                certificate_number="SECOND-CERT",
                issued_at=datetime.now(timezone.utc),
                file=file,
            )
        )

    assert exc.value.status_code == 409
    assert exc.value.detail == (
        "Disposal certificate already exists for this shipment"
    )

    upload_mock.assert_not_called()


# =========================================================
# File validation
# =========================================================

def test_upload_certificate_rejects_unsupported_content_type(db):
    facility_user = make_user(
        db,
        role=UserRole.FACILITY,
        name="File Facility User",
        email=f"facility-{uuid.uuid4().hex[:8]}@test.local",
    )

    facility = make_facility(
        db,
        user_id=facility_user.id,
        code=f"FAC-{uuid.uuid4().hex[:6].upper()}",
    )

    warehouse = make_warehouse(db)
    driver = make_driver(db)
    vehicle = make_vehicle(db)

    shipment, _ = make_shipment(
        db,
        facility=facility,
        warehouse=warehouse,
        driver=driver,
        vehicle=vehicle,
        include_customer_route=False,
    )

    file = make_upload_file(
        filename="certificate.txt",
        content_type="text/plain",
        contents=b"not a certificate",
    )

    with pytest.raises(HTTPException) as exc:
        asyncio.run(
            upload_disposal_certificate(
                db=db,
                shipment_id=shipment.id,
                certificate_number="CERT-TXT",
                issued_at=datetime.now(timezone.utc),
                file=file,
            )
        )

    assert exc.value.status_code == 400
    assert exc.value.detail == (
        "Only PDF, JPG and PNG files are allowed"
    )


def test_upload_certificate_rejects_invalid_file_signature(db):
    facility_user = make_user(
        db,
        role=UserRole.FACILITY,
        name="Signature Facility User",
        email=f"facility-{uuid.uuid4().hex[:8]}@test.local",
    )

    facility = make_facility(
        db,
        user_id=facility_user.id,
        code=f"FAC-{uuid.uuid4().hex[:6].upper()}",
    )

    warehouse = make_warehouse(db)
    driver = make_driver(db)
    vehicle = make_vehicle(db)

    shipment, _ = make_shipment(
        db,
        facility=facility,
        warehouse=warehouse,
        driver=driver,
        vehicle=vehicle,
        include_customer_route=False,
    )

    file = make_upload_file(
        filename="certificate.pdf",
        content_type="application/pdf",
        contents=b"THIS IS NOT A PDF",
    )

    with pytest.raises(HTTPException) as exc:
        asyncio.run(
            upload_disposal_certificate(
                db=db,
                shipment_id=shipment.id,
                certificate_number="CERT-BAD-SIGNATURE",
                issued_at=datetime.now(timezone.utc),
                file=file,
            )
        )

    assert exc.value.status_code == 400
    assert exc.value.detail == (
        "File content does not match the declared file type"
    )


def test_upload_certificate_rejects_file_over_10_mb(db):
    facility_user = make_user(
        db,
        role=UserRole.FACILITY,
        name="Large File Facility User",
        email=f"facility-{uuid.uuid4().hex[:8]}@test.local",
    )

    facility = make_facility(
        db,
        user_id=facility_user.id,
        code=f"FAC-{uuid.uuid4().hex[:6].upper()}",
    )

    warehouse = make_warehouse(db)
    driver = make_driver(db)
    vehicle = make_vehicle(db)

    shipment, _ = make_shipment(
        db,
        facility=facility,
        warehouse=warehouse,
        driver=driver,
        vehicle=vehicle,
        include_customer_route=False,
    )

    contents = b"%PDF-" + b"x" * MAX_FILE_SIZE

    file = make_upload_file(
        filename="large.pdf",
        content_type="application/pdf",
        contents=contents,
    )

    with pytest.raises(HTTPException) as exc:
        asyncio.run(
            upload_disposal_certificate(
                db=db,
                shipment_id=shipment.id,
                certificate_number="CERT-LARGE",
                issued_at=datetime.now(timezone.utc),
                file=file,
            )
        )

    assert exc.value.status_code == 400
    assert exc.value.detail == (
        "Certificate file cannot exceed 10 MB"
    )


# =========================================================
# Notification
# =========================================================

def test_upload_certificate_notifies_customer_once(
    db,
    monkeypatch,
):
    facility_user = make_user(
        db,
        role=UserRole.FACILITY,
        name="Notification Facility User",
        email=f"facility-{uuid.uuid4().hex[:8]}@test.local",
    )

    facility = make_facility(
        db,
        user_id=facility_user.id,
        code=f"FAC-{uuid.uuid4().hex[:6].upper()}",
    )

    warehouse = make_warehouse(db)
    driver = make_driver(db)
    vehicle = make_vehicle(db)

    customer_user, customer, route = make_completed_route_with_pickup(
        db,
        warehouse=warehouse,
        driver=driver,
        vehicle=vehicle,
    )

    intake = WarehouseIntake(
        intake_code=f"INT-CERT-{uuid.uuid4().hex[:6].upper()}",
        route_id=route.id,
        warehouse_id=warehouse.id,
        driver_id=driver.id,
        vehicle_id=vehicle.id,
        status=WarehouseIntakeStatus.RECEIVED,
        expected_weight_kg=Decimal("10.00"),
        received_weight_kg=Decimal("10.00"),
        received_at=datetime.now(timezone.utc),
    )
    db.add(intake)
    db.flush()

    intake_item = WarehouseIntakeItem(
        intake_id=intake.id,
        bin_color=WasteBinColor.YELLOW,
        waste_type=WasteType.SOILED,
        expected_weight_kg=Decimal("10.00"),
        received_weight_kg=Decimal("10.00"),
    )
    db.add(intake_item)
    db.flush()

    shipment = DisposalShipment(
        shipment_code=f"DS-CERT-{uuid.uuid4().hex[:6].upper()}",
        intake_id=intake.id,
        facility_id=facility.id,
        status=DisposalShipmentStatus.RECEIVED,
        expected_weight_kg=Decimal("10.00"),
    )
    db.add(shipment)
    db.flush()

    shipment_item = DisposalShipmentItem(
        shipment_id=shipment.id,
        warehouse_intake_item_id=intake_item.id,
        expected_weight_kg=Decimal("10.00"),
    )
    db.add(shipment_item)
    db.flush()

    upload_mock = Mock()

    monkeypatch.setattr(
        "app.services.disposal_certificate_service.supabase_admin",
        SimpleNamespace(
            storage=SimpleNamespace(
                from_=lambda bucket: SimpleNamespace(
                    upload=upload_mock,
                )
            )
        ),
    )

    file = make_upload_file(
        filename="certificate.pdf",
        content_type="application/pdf",
        contents=valid_pdf(),
    )

    asyncio.run(
        upload_disposal_certificate(
            db=db,
            shipment_id=shipment.id,
            certificate_number="CERT-NOTIFY",
            issued_at=datetime.now(timezone.utc),
            file=file,
        )
    )

    db.commit()

    notifications = db.scalars(
        select(Notification).where(
            Notification.user_id == customer_user.id,
            Notification.notification_type
            == NotificationType.DISPOSAL_COMPLETED,
            Notification.channel
            == NotificationChannel.IN_APP,
        )
    ).all()

    assert len(notifications) == 1

    notification = notifications[0]

    assert notification.title == "Disposal Completed"
    assert shipment.shipment_code in notification.body
    assert notification.event_key == (
        f"DISPOSAL_COMPLETED:{shipment.id}"
    )
    assert notification.notification_metadata["shipment_id"] == (
        shipment.id
    )
    assert notification.notification_metadata["shipment_code"] == (
        shipment.shipment_code
    )


# =========================================================
# Storage cleanup on persistence failure
# =========================================================

def test_upload_certificate_deletes_storage_file_when_persistence_fails(
    db,
    monkeypatch,
):
    facility_user = make_user(
        db,
        role=UserRole.FACILITY,
        name="Rollback Facility User",
        email=f"facility-{uuid.uuid4().hex[:8]}@test.local",
    )

    facility = make_facility(
        db,
        user_id=facility_user.id,
        code=f"FAC-{uuid.uuid4().hex[:6].upper()}",
    )

    warehouse = make_warehouse(db)
    driver = make_driver(db)
    vehicle = make_vehicle(db)

    shipment, _ = make_shipment(
        db,
        facility=facility,
        warehouse=warehouse,
        driver=driver,
        vehicle=vehicle,
        include_customer_route=False,
    )

    upload_mock = Mock()
    delete_mock = Mock()

    monkeypatch.setattr(
        "app.services.disposal_certificate_service.supabase_admin",
        SimpleNamespace(
            storage=SimpleNamespace(
                from_=lambda bucket: SimpleNamespace(
                    upload=upload_mock,
                    remove=delete_mock,
                )
            )
        ),
    )

    def failing_flush(*args, **kwargs):
        raise RuntimeError("database persistence failure")

    monkeypatch.setattr(db, "flush", failing_flush)

    file = make_upload_file(
        filename="certificate.pdf",
        content_type="application/pdf",
        contents=valid_pdf(),
    )

    with pytest.raises(RuntimeError, match="database persistence failure"):
        asyncio.run(
            upload_disposal_certificate(
                db=db,
                shipment_id=shipment.id,
                certificate_number="CERT-ROLLBACK",
                issued_at=datetime.now(timezone.utc),
                file=file,
            )
        )

    upload_mock.assert_called_once()
    delete_mock.assert_called_once()

    delete_args = delete_mock.call_args.args

    assert len(delete_args) == 1
    assert delete_args[0][0].startswith(
        f"shipments/{shipment.id}/"
    )
    assert delete_args[0][0].endswith(".pdf")