import uuid
from datetime import datetime, timedelta, timezone

import pytest
from fastapi import HTTPException

from app.models.configuration import (
    Configuration,
    ConfigurationVersion,
)
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
    VehicleType,
    WarehouseIntakeStatus,
)
from app.models.notification import Notification
from app.models.pickup import Pickup
from app.models.route import Route
from app.models.route_stop import RouteStop
from app.models.user import User
from app.models.vehicle import Vehicle
from app.models.warehouse import Warehouse
from app.models.warehouse_intake import WarehouseIntake
from app.services.route_execution_service import (
    arrive_at_stop,
    complete_stop,
    start_route,
)


# ---------------------------------------------------------
# Setup
# ---------------------------------------------------------

def make_route_setup(db):
    suffix = uuid.uuid4().hex

    driver_user = User(
        auth_user_id=uuid.uuid4(),
        name=f"Route Driver {suffix}",
        email=f"route-driver-{suffix}@test.local",
        role=UserRole.DRIVER,
        is_active=True,
    )
    db.add(driver_user)
    db.flush()

    customer_user = User(
        auth_user_id=uuid.uuid4(),
        name=f"Route Customer {suffix}",
        email=f"route-customer-{suffix}@test.local",
        role=UserRole.CUSTOMER,
        is_active=True,
    )
    db.add(customer_user)
    db.flush()

    customer = Customer(
        user_id=customer_user.id,
        customer_type=CustomerType.PHARMACY,
        legal_name="Route Test Pharmacy",
        display_name="Route Test Pharmacy",
        phone="9876543210",
        email=customer_user.email,
        is_active=True,
    )
    db.add(customer)
    db.flush()

    location = CustomerLocation(
        customer_id=customer.id,
        location_code=f"RT-{suffix[:10]}",
        name="Route Test Branch",
        address_line_1="123 Route Road",
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
        verification_token=f"verify-{suffix}",
    )
    db.add(pickup)
    db.flush()

    driver = Driver(
        user_id=driver_user.id,
        employee_id=f"EMP-{suffix[:10]}",
        phone="9988776655",
        license_number=f"LIC-{suffix[:10]}",
        is_available=True,
    )
    db.add(driver)
    db.flush()

    vehicle = Vehicle(
        registration_number=f"KA-{suffix[:10]}",
        vehicle_type=list(VehicleType)[0],
        capacity_kg=100,
    )
    db.add(vehicle)
    db.flush()

    warehouse = Warehouse(
        code=f"WH-{suffix[:10]}",
        name="Route Test Warehouse",
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
        vehicle_id=vehicle.id,
        status=RouteStatus.ASSIGNED,
        planned_distance_km=25.5,
        planned_duration_seconds=3600,
    )
    db.add(route)
    db.flush()

    pickup_stop = RouteStop(
        route_id=route.id,
        sequence_number=1,
        stop_type=RouteStopType.PICKUP,
        pickup_id=pickup.id,
        execution_status=RouteStopStatus.PENDING,
    )

    warehouse_stop = RouteStop(
        route_id=route.id,
        sequence_number=2,
        stop_type=RouteStopType.WAREHOUSE,
        warehouse_id=warehouse.id,
        execution_status=RouteStopStatus.PENDING,
    )

    db.add_all([
        pickup_stop,
        warehouse_stop,
    ])

    # -----------------------------------------------------
    # Ensure collection tolerance configuration exists
    # -----------------------------------------------------

    config = (
        db.query(Configuration)
        .filter(
            Configuration.key
            == "weight.collection_tolerance"
        )
        .first()
    )

    created_config = False

    if config is None:
        config = Configuration(
            key="weight.collection_tolerance",
            description="Allowed collection weight tolerance",
            data_type="DECIMAL",
            scope="GLOBAL",
            is_active=True,
        )
        db.add(config)
        db.flush()

        version = ConfigurationVersion(
            configuration_id=config.id,
            version=1,
            value=0.5,
            status="ACTIVE",
            effective_from=(
                datetime.now(timezone.utc)
                - timedelta(minutes=1)
            ),
            created_by=driver_user.id,
            reason="Route execution integration test",
        )
        db.add(version)
        db.flush()

        config.current_version_id = version.id
        created_config = True

    db.commit()

    db.refresh(driver_user)
    db.refresh(customer_user)
    db.refresh(customer)
    db.refresh(location)
    db.refresh(pickup)
    db.refresh(driver)
    db.refresh(vehicle)
    db.refresh(warehouse)
    db.refresh(route)

    db.refresh(pickup_stop)
    db.refresh(warehouse_stop)

    return {
        "suffix": suffix,
        "driver_user": driver_user,
        "customer_user": customer_user,
        "customer": customer,
        "location": location,
        "pickup": pickup,
        "driver": driver,
        "vehicle": vehicle,
        "warehouse": warehouse,
        "route": route,
        "pickup_stop": pickup_stop,
        "warehouse_stop": warehouse_stop,
        "config": config if created_config else None,
    }


def cleanup_route_setup(db, setup):
    warehouse_intake = (
        db.query(WarehouseIntake)
        .filter(
            WarehouseIntake.route_id
            == setup["route"].id
        )
        .first()
    )

    if warehouse_intake is not None:
        db.delete(warehouse_intake)

    db.query(Notification).filter(
        Notification.user_id
        == setup["customer_user"].id
    ).delete(
        synchronize_session=False
    )

    db.delete(setup["route"])
    db.delete(setup["pickup"])
    db.delete(setup["location"])
    db.delete(setup["customer"])
    db.delete(setup["vehicle"])
    db.delete(setup["driver"])

    if setup["config"] is not None:
        db.delete(setup["config"])

    db.delete(setup["warehouse"])
    db.delete(setup["customer_user"])
    db.delete(setup["driver_user"])

    db.commit()


# ---------------------------------------------------------
# Start route
# ---------------------------------------------------------

def test_start_route_persists_route_and_driver_state(db):
    setup = make_route_setup(db)

    try:
        route = start_route(
            db=db,
            user=setup["driver_user"],
            route_id=setup["route"].id,
        )

        assert route.status == RouteStatus.IN_PROGRESS

        db.refresh(setup["route"])
        db.refresh(setup["driver"])

        assert (
            setup["route"].status
            == RouteStatus.IN_PROGRESS
        )
        assert setup["driver"].is_available is False

    finally:
        cleanup_route_setup(db, setup)


# ---------------------------------------------------------
# Stop ordering
# ---------------------------------------------------------

def test_arrive_rejects_incomplete_previous_stop(db):
    setup = make_route_setup(db)

    try:
        start_route(
            db=db,
            user=setup["driver_user"],
            route_id=setup["route"].id,
        )

        with pytest.raises(HTTPException) as exc_info:
            arrive_at_stop(
                db=db,
                user=setup["driver_user"],
                route_id=setup["route"].id,
                stop_id=setup["warehouse_stop"].id,
            )

        assert exc_info.value.status_code == 409
        assert exc_info.value.detail == (
            "Previous route stop must be completed first"
        )

    finally:
        cleanup_route_setup(db, setup)


# ---------------------------------------------------------
# Full route lifecycle
# ---------------------------------------------------------

def test_full_route_lifecycle_to_warehouse(
    db,
):
    setup = make_route_setup(db)

    try:
        # 1. Start route
        started_route = start_route(
            db=db,
            user=setup["driver_user"],
            route_id=setup["route"].id,
        )

        assert (
            started_route.status
            == RouteStatus.IN_PROGRESS
        )

        # 2. Arrive at pickup
        pickup_stop = arrive_at_stop(
            db=db,
            user=setup["driver_user"],
            route_id=setup["route"].id,
            stop_id=setup["pickup_stop"].id,
        )

        assert (
            pickup_stop.execution_status
            == RouteStopStatus.ARRIVED
        )
        assert pickup_stop.arrived_at is not None

        # Simulate successful QR verification,
        # OTP verification and proof upload.
        now = datetime.now(timezone.utc)

        setup["pickup"].qr_verified_at = now
        setup["pickup"].otp_verified_at = now
        pickup_stop.proof_storage_path = (
            "routes/test/proof.jpg"
        )
        db.commit()

        # 3. Complete pickup
        completed_pickup = complete_stop(
            db=db,
            user=setup["driver_user"],
            route_id=setup["route"].id,
            stop_id=setup["pickup_stop"].id,
            collected_weight_kg=10.0,
        )

        assert (
            completed_pickup.execution_status
            == RouteStopStatus.COMPLETED
        )
        assert completed_pickup.completed_at is not None

        db.refresh(setup["pickup"])

        assert (
            setup["pickup"].status
            == PickupStatus.COLLECTED
        )
        assert (
            setup["pickup"].collected_at is not None
        )

        # 4. Arrive at warehouse
        warehouse_stop = arrive_at_stop(
            db=db,
            user=setup["driver_user"],
            route_id=setup["route"].id,
            stop_id=setup["warehouse_stop"].id,
        )

        assert (
            warehouse_stop.execution_status
            == RouteStopStatus.ARRIVED
        )

        # 5. Complete warehouse handover
        completed_warehouse = complete_stop(
            db=db,
            user=setup["driver_user"],
            route_id=setup["route"].id,
            stop_id=setup["warehouse_stop"].id,
        )

        assert (
            completed_warehouse.execution_status
            == RouteStopStatus.COMPLETED
        )
        assert (
            completed_warehouse.completed_at
            is not None
        )

        db.refresh(setup["route"])
        db.refresh(setup["driver"])

        assert (
            setup["route"].status
            == RouteStatus.COMPLETED
        )
        assert setup["driver"].is_available is True

        intake = (
            db.query(WarehouseIntake)
            .filter(
                WarehouseIntake.route_id
                == setup["route"].id
            )
            .first()
        )

        assert intake is not None
        assert intake.status == (
            WarehouseIntakeStatus.PENDING
        )
        assert float(
            intake.expected_weight_kg
        ) == pytest.approx(10.0)

        notification = (
            db.query(Notification)
            .filter(
                Notification.user_id
                == setup["customer_user"].id,
                Notification.event_key
                == (
                    f"PICKUP_COMPLETED:"
                    f"{setup['pickup'].id}"
                ),
            )
            .first()
        )

        assert notification is not None

    finally:
        cleanup_route_setup(db, setup)


# ---------------------------------------------------------
# Pickup completion guards
# ---------------------------------------------------------

def test_complete_pickup_requires_qr_verification(
    db,
):
    setup = make_route_setup(db)

    try:
        start_route(
            db=db,
            user=setup["driver_user"],
            route_id=setup["route"].id,
        )

        arrive_at_stop(
            db=db,
            user=setup["driver_user"],
            route_id=setup["route"].id,
            stop_id=setup["pickup_stop"].id,
        )

        setup["pickup"].otp_verified_at = (
            datetime.now(timezone.utc)
        )
        setup["pickup_stop"].proof_storage_path = (
            "routes/test/proof.jpg"
        )
        db.commit()

        with pytest.raises(HTTPException) as exc_info:
            complete_stop(
                db=db,
                user=setup["driver_user"],
                route_id=setup["route"].id,
                stop_id=setup["pickup_stop"].id,
                collected_weight_kg=10.0,
            )

        assert exc_info.value.status_code == 409
        assert exc_info.value.detail == (
            "Pickup QR has not been verified"
        )

    finally:
        cleanup_route_setup(db, setup)


def test_complete_pickup_requires_proof(
    db,
):
    setup = make_route_setup(db)

    try:
        start_route(
            db=db,
            user=setup["driver_user"],
            route_id=setup["route"].id,
        )

        arrive_at_stop(
            db=db,
            user=setup["driver_user"],
            route_id=setup["route"].id,
            stop_id=setup["pickup_stop"].id,
        )

        now = datetime.now(timezone.utc)

        setup["pickup"].qr_verified_at = now
        setup["pickup"].otp_verified_at = now

        db.commit()

        with pytest.raises(HTTPException) as exc_info:
            complete_stop(
                db=db,
                user=setup["driver_user"],
                route_id=setup["route"].id,
                stop_id=setup["pickup_stop"].id,
                collected_weight_kg=10.0,
            )

        assert exc_info.value.status_code == 409
        assert exc_info.value.detail == (
            "Collection proof has not been uploaded"
        )

    finally:
        cleanup_route_setup(db, setup)