import uuid
from datetime import datetime, timezone
from decimal import Decimal

from app.models.customer import Customer
from app.models.customer_location import CustomerLocation
from app.models.disposal_certificate import DisposalCertificate
from app.models.disposal_shipment import DisposalShipment
from app.models.driver import Driver
from app.models.enums import (
    DisposalShipmentStatus,
    DriverStatus,
    PickupPriority,
    PickupStatus,
    RouteStatus,
    RouteStopStatus,
    RouteStopType,
    UserRole,
    VehicleStatus,
    VehicleType,
    WarehouseIntakeStatus,
)
from app.models.facility import Facility
from app.models.pickup import Pickup
from app.models.route import Route
from app.models.route_stop import RouteStop
from app.models.user import User
from app.models.vehicle import Vehicle
from app.models.warehouse import Warehouse
from app.models.warehouse_intake import WarehouseIntake
from app.services.customer_disposal_service import (
    get_customer_disposal_records,
)


def make_user(
    db,
    suffix,
    role,
):
    user = User(
        auth_user_id=uuid.uuid4(),
        name=f"Disposal Test {role.value} {suffix}",
        email=f"disposal-{role.value.lower()}-{suffix}@test.local",
        role=role,
        is_active=True,
    )

    db.add(user)
    db.flush()

    return user


def cleanup_disposal_chain(
    db,
    *,
    certificate,
    shipment,
    intake,
    route_stop,
    route,
    pickup,
    customer_location,
    customer,
    facility,
    driver,
    vehicle,
    warehouse,
    customer_user,
    driver_user,
    facility_user,
):
    # Child records first
    if certificate:
        db.delete(certificate)

    if shipment:
        db.delete(shipment)

    if intake:
        db.delete(intake)

    if route_stop:
        db.delete(route_stop)

    if route:
        db.delete(route)

    if pickup:
        db.delete(pickup)

    if customer_location:
        db.delete(customer_location)

    if customer:
        db.delete(customer)

    if facility:
        db.delete(facility)

    if driver:
        db.delete(driver)

    if vehicle:
        db.delete(vehicle)

    if warehouse:
        db.delete(warehouse)

    if customer_user:
        db.delete(customer_user)

    if driver_user:
        db.delete(driver_user)

    if facility_user:
        db.delete(facility_user)

    db.commit()


def test_customer_disposal_service_returns_complete_chain(
    db,
):
    suffix = uuid.uuid4().hex

    customer_user = make_user(
        db,
        suffix,
        UserRole.CUSTOMER,
    )

    driver_user = make_user(
        db,
        suffix,
        UserRole.DRIVER,
    )

    facility_user = make_user(
        db,
        suffix,
        UserRole.FACILITY,
    )

    customer = Customer(
        user_id=customer_user.id,
        customer_type="PHARMACY",
        legal_name="Disposal Test Pharmacy",
        display_name="Disposal Pharmacy",
        phone="9876543210",
        email=f"pharmacy-{suffix}@test.local",
        gst_number="29ABCDE1234F1Z5",
        is_active=True,
    )

    db.add(customer)
    db.flush()

    customer_location = CustomerLocation(
        customer_id=customer.id,
        location_code=f"LOC-{suffix[:10]}",
        name="Main Branch",
        address_line_1="123 Test Road",
        city="Bengaluru",
        state="Karnataka",
        postal_code="560001",
        latitude=12.9716,
        longitude=77.5946,
        service_time_seconds=300,
    )

    warehouse = Warehouse(
        code=f"WH-{suffix[:10]}",
        name="Test Warehouse",
        address="Warehouse Road",
        city="Bengaluru",
        state="Karnataka",
        postal_code="560010",
        latitude=12.9800,
        longitude=77.6000,
        active=True,
    )

    driver = Driver(
        user_id=driver_user.id,
        employee_id=f"EMP-{suffix[:10]}",
        phone="9988776655",
        license_number=f"LIC-{suffix}",
        status=DriverStatus.ACTIVE,
        is_available=True,
    )

    vehicle = Vehicle(
        registration_number=f"KA01-{suffix[:8]}",
        vehicle_type=VehicleType.VAN,
        capacity_kg=500,
        status=VehicleStatus.AVAILABLE,
    )

    facility = Facility(
        user_id=facility_user.id,
        facility_code=f"FAC-{suffix[:10]}",
        legal_name="Green Disposal Facility",
        phone="9999999999",
        email=f"facility-{suffix}@test.local",
        license_number=f"FAC-LIC-{suffix}",
        address="Disposal Road",
        city="Bengaluru",
        state="Karnataka",
        postal_code="560020",
        latitude=12.9900,
        longitude=77.6100,
        active=True,
    )

    db.add_all([
        customer_location,
        warehouse,
        driver,
        vehicle,
        facility,
    ])
    db.flush()

    pickup = Pickup(
        pickup_code=f"PU-{suffix[:20]}",
        customer_id=customer.id,
        location_id=customer_location.id,
        status=PickupStatus.COLLECTED,
        priority=PickupPriority.NORMAL,
        estimated_weight_kg=12.50,
        verification_token=f"VERIFY-{suffix}",
    )

    db.add(pickup)
    db.flush()

    route = Route(
        route_code=f"ROUTE-{suffix[:20]}",
        route_date=datetime.now(timezone.utc),
        warehouse_id=warehouse.id,
        driver_id=driver.id,
        vehicle_id=vehicle.id,
        status=RouteStatus.COMPLETED,
        planned_distance_km=25.5,
        planned_duration_seconds=3600,
    )

    db.add(route)
    db.flush()

    route_stop = RouteStop(
        route_id=route.id,
        sequence_number=1,
        stop_type=RouteStopType.PICKUP,
        pickup_id=pickup.id,
        execution_status=RouteStopStatus.COMPLETED,
        collected_weight_kg=12.50,
    )

    db.add(route_stop)
    db.flush()

    intake = WarehouseIntake(
        intake_code=f"INT-{suffix[:20]}",
        route_id=route.id,
        warehouse_id=warehouse.id,
        driver_id=driver.id,
        vehicle_id=vehicle.id,
        status=WarehouseIntakeStatus.RECEIVED,
        expected_weight_kg=12.50,
        received_weight_kg=12.20,
        received_at=datetime.now(timezone.utc),
    )

    db.add(intake)
    db.flush()

    shipment = DisposalShipment(
        shipment_code=f"SHIP-{suffix[:20]}",
        intake_id=intake.id,
        facility_id=facility.id,
        status=DisposalShipmentStatus.RECEIVED,
        expected_weight_kg=12.50,
        received_weight_kg=12.20,
        dispatched_at=datetime.now(timezone.utc),
        received_at=datetime.now(timezone.utc),
    )

    db.add(shipment)
    db.flush()

    certificate = DisposalCertificate(
        certificate_code=f"CERT-{suffix[:20]}",
        shipment_id=shipment.id,
        certificate_number=f"CERT-NO-{suffix}",
        storage_path=(
            f"facilities/{facility.id}/certificates/test.pdf"
        ),
        file_name="test.pdf",
        content_type="application/pdf",
        issued_at=datetime.now(timezone.utc),
    )

    db.add(certificate)
    db.commit()

    try:
        records = get_customer_disposal_records(
            db=db,
            customer_id=customer.id,
        )

        assert len(records) == 1

        record = records[0]

        assert record["pickup_id"] == pickup.id
        assert record["pickup_code"] == pickup.pickup_code

        assert record["shipment_id"] == shipment.id
        assert record["shipment_code"] == shipment.shipment_code

        assert record["facility_name"] == (
            "Green Disposal Facility"
        )

        assert record["expected_weight_kg"] == Decimal("12.50")
        assert record["received_weight_kg"] == Decimal("12.20")

        assert record["shipment_status"] == (
            DisposalShipmentStatus.RECEIVED
        )

        assert record["dispatched_at"] is not None
        assert record["received_at"] is not None
        assert record["certificate_available"] is True

    finally:
        cleanup_disposal_chain(
            db,
            certificate=certificate,
            shipment=shipment,
            intake=intake,
            route_stop=route_stop,
            route=route,
            pickup=pickup,
            customer_location=customer_location,
            customer=customer,
            facility=facility,
            driver=driver,
            vehicle=vehicle,
            warehouse=warehouse,
            customer_user=customer_user,
            driver_user=driver_user,
            facility_user=facility_user,
        )


def test_customer_disposal_service_handles_pickup_without_route(
    db,
):
    suffix = uuid.uuid4().hex

    customer_user = make_user(
        db,
        suffix,
        UserRole.CUSTOMER,
    )

    customer = Customer(
        user_id=customer_user.id,
        customer_type="PHARMACY",
        legal_name="Partial Disposal Pharmacy",
        display_name="Partial Pharmacy",
        phone="9876543210",
        email=f"partial-{suffix}@test.local",
        is_active=True,
    )

    db.add(customer)
    db.flush()

    customer_location = CustomerLocation(
        customer_id=customer.id,
        location_code=f"LOC-{suffix[:10]}",
        name="Main Branch",
        address_line_1="123 Partial Road",
        city="Bengaluru",
        state="Karnataka",
        postal_code="560001",
        latitude=12.9716,
        longitude=77.5946,
    )

    db.add(customer_location)
    db.flush()

    pickup = Pickup(
        pickup_code=f"PU-{suffix[:20]}",
        customer_id=customer.id,
        location_id=customer_location.id,
        status=PickupStatus.COLLECTED,
        priority=PickupPriority.NORMAL,
        estimated_weight_kg=5.00,
        verification_token=f"VERIFY-{suffix}",
    )

    db.add(pickup)
    db.commit()

    try:
        records = get_customer_disposal_records(
            db=db,
            customer_id=customer.id,
        )

        assert len(records) == 1

        record = records[0]

        assert record["pickup_id"] == pickup.id
        assert record["pickup_code"] == pickup.pickup_code

        assert record["shipment_id"] is None
        assert record["shipment_code"] is None
        assert record["facility_name"] is None

        assert record["expected_weight_kg"] is None
        assert record["received_weight_kg"] is None
        assert record["shipment_status"] is None
        assert record["dispatched_at"] is None
        assert record["received_at"] is None
        assert record["certificate_available"] is False

    finally:
        db.delete(pickup)
        db.delete(customer_location)
        db.delete(customer)
        db.delete(customer_user)
        db.commit()