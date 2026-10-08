from datetime import datetime, timedelta, timezone
from decimal import Decimal
from unittest.mock import patch
import uuid

import pytest
from fastapi import HTTPException

from app.models.driver import Driver
from app.models.driver_vehicle_assignment import DriverVehicleAssignment
from app.models.enums import (
    DriverStatus,
    PickupPriority,
    PickupStatus,
    RouteStatus,
    RouteStopType,
    VehicleStatus,
    VehicleType,
)
from app.models.pickup import Pickup
from app.models.route import Route
from app.models.route_stop import RouteStop
from app.models.user import User, UserRole
from app.models.vehicle import Vehicle
from app.models.warehouse import Warehouse
from app.models.customer import Customer
from app.models.customer_location import CustomerLocation
from app.services.route_optimization_service import optimize_and_dispatch


def make_user(db, role=UserRole.DRIVER, suffix=None):
    if suffix is None:
        suffix = uuid.uuid4().hex

    user = User(
        auth_user_id=uuid.uuid4(),
        name=f"Test User {suffix}",
        email=f"user-{suffix}@test.local",
        role=role,
        is_active=True,
    )
    db.add(user)
    db.flush()
    return user


def make_driver(db, suffix=None):
    if suffix is None:
        suffix = uuid.uuid4().hex

    user = make_user(db, UserRole.DRIVER, suffix)

    driver = Driver(
        user_id=user.id,
        employee_id=f"EMP-{suffix}",
        phone="9876543210",
        license_number=f"LIC-{suffix}",
        license_expiry=datetime.now(timezone.utc).date() + timedelta(days=365),
        status=DriverStatus.ACTIVE,
        is_available=True,
    )
    db.add(driver)
    db.flush()

    return user, driver


def make_vehicle(db, suffix=None):
    if suffix is None:
        suffix = uuid.uuid4().hex

    vehicle = Vehicle(
        registration_number=f"KA01-{suffix}",
        vehicle_type=VehicleType.VAN,
        capacity_kg=Decimal("500.00"),
        status=VehicleStatus.AVAILABLE,
    )
    db.add(vehicle)
    db.flush()

    return vehicle


def make_assignment(db, suffix=None):
    if suffix is None:
        suffix = uuid.uuid4().hex

    user, driver = make_driver(db, suffix)
    vehicle = make_vehicle(db, suffix)

    assignment = DriverVehicleAssignment(
        driver_id=driver.id,
        vehicle_id=vehicle.id,
    )
    db.add(assignment)
    db.flush()

    return user, driver, vehicle, assignment


def make_warehouse(db, suffix=None, active=True):
    if suffix is None:
        suffix = uuid.uuid4().hex

    warehouse = Warehouse(
        code=f"WH-{suffix}",
        name=f"Warehouse {suffix}",
        address="123 Warehouse Road",
        city="Bengaluru",
        state="Karnataka",
        postal_code="560001",
        latitude=12.9716000,
        longitude=77.5946000,
        active=active,
    )
    db.add(warehouse)
    db.flush()

    return warehouse


def make_customer_and_location(
    db,
    suffix=None,
    latitude=12.935200,
    longitude=77.624500,
):
    if suffix is None:
        suffix = uuid.uuid4().hex

    user = make_user(
        db,
        role=UserRole.CUSTOMER,
        suffix=f"customer-{suffix}",
    )

    customer = Customer(
        user_id=user.id,
        customer_type="PHARMACY",
        legal_name=f"Customer Legal {suffix}",
        display_name=f"Customer {suffix}",
        phone="9876500000",
        email=f"customer-{suffix}@test.local",
        is_active=True,
    )
    db.add(customer)
    db.flush()

    location = CustomerLocation(
        customer_id=customer.id,
        location_code=f"LOC-{suffix}",
        name=f"Location {suffix}",
        address_line_1="456 Store Road",
        city="Bengaluru",
        state="Karnataka",
        postal_code="560002",
        latitude=latitude,
        longitude=longitude,
        contact_name="Test Contact",
        contact_phone="9876500001",
        service_time_seconds=300,
        pickup_enabled=True,
        is_active=True,
    )
    db.add(location)
    db.flush()

    return user, customer, location


def make_pickup(
    db,
    suffix=None,
    scheduled_date=None,
    weight=10,
    priority=PickupPriority.NORMAL,
    latitude=12.935200,
    longitude=77.624500,
):
    if suffix is None:
        suffix = uuid.uuid4().hex

    _, customer, location = make_customer_and_location(
        db,
        suffix=suffix,
        latitude=latitude,
        longitude=longitude,
    )

    pickup = Pickup(
        pickup_code=f"PK-{suffix}",
        customer_id=customer.id,
        location_id=location.id,
        status=PickupStatus.SCHEDULED,
        priority=priority,
        scheduled_date=scheduled_date,
        estimated_weight_kg=Decimal(str(weight)),
        verification_token=f"token-{suffix}",
    )
    db.add(pickup)
    db.flush()

    return pickup


def fake_active_configuration(value):
    return type(
        "FakeConfiguration",
        (),
        {"value": str(value)},
    )()


def fake_problem_stats(route):
    pickup_indices = route[:-1]

    return (
        float(len(pickup_indices) * 1000),
        float(len(pickup_indices) * 600),
        float(len(pickup_indices) * 10),
    )


def test_optimize_and_dispatch_creates_route_and_assigns_pickups(db):
    route_date = datetime.now(timezone.utc).replace(
        hour=0,
        minute=0,
        second=0,
        microsecond=0,
    )

    warehouse = make_warehouse(db, "basic")
    driver_user, driver, vehicle, assignment = make_assignment(db, "basic")

    pickup = make_pickup(
        db,
        suffix="basic",
        scheduled_date=route_date + timedelta(hours=9),
        weight=20,
    )

    with patch(
        "app.services.route_optimization_service.get_configuration_float",
        side_effect=[100.0, 240.0, 100.0, 30.0],
    ), patch(
        "app.services.route_optimization_service.get_active_version",
        side_effect=[
            fake_active_configuration(100.0),
            fake_active_configuration(240.0),
        ],
    ), patch(
        "app.services.route_optimization_service.settings.OSRM_BASE_URL",
        None,
    ), patch(
        "app.services.route_optimization_service.solve",
    ) as solve_mock:
        problem = type(
            "FakeProblem",
            (),
            {
                "stats": staticmethod(fake_problem_stats),
            },
        )()

        solve_mock.return_value = (
            problem,
            [[0, 1]],
            [],
            [],
        )

        result = optimize_and_dispatch(
            db=db,
            warehouse_id=warehouse.id,
            route_date=route_date,
        )

    assert result["warehouse_id"] == warehouse.id
    assert result["vehicles_available"] == 1
    assert result["routes_created"] == 1
    assert result["pickups_assigned"] == 1
    assert result["routing_source"] == "HAVERSINE_FALLBACK"

    route = (
        db.query(Route)
        .filter(Route.id == result["routes"][0]["route_id"])
        .one()
    )

    assert route.warehouse_id == warehouse.id
    assert route.driver_id == driver.id
    assert route.vehicle_id == vehicle.id
    assert route.status == RouteStatus.ASSIGNED
    assert route.planned_distance_km == 1.0
    assert route.planned_duration_seconds == 600

    db.refresh(pickup)
    db.refresh(driver)
    db.refresh(vehicle)

    assert pickup.status == PickupStatus.ASSIGNED
    assert driver.is_available is False
    assert vehicle.status == VehicleStatus.ASSIGNED

    stops = (
        db.query(RouteStop)
        .filter(RouteStop.route_id == route.id)
        .order_by(RouteStop.sequence_number)
        .all()
    )

    assert len(stops) == 2

    assert stops[0].sequence_number == 1
    assert stops[0].stop_type == RouteStopType.PICKUP
    assert stops[0].pickup_id == pickup.id

    assert stops[1].sequence_number == 2
    assert stops[1].stop_type == RouteStopType.WAREHOUSE
    assert stops[1].warehouse_id == warehouse.id

    solve_mock.assert_called_once()


def test_optimize_and_dispatch_raises_when_warehouse_missing(db):
    route_date = datetime.now(timezone.utc)

    with pytest.raises(HTTPException) as exc:
        optimize_and_dispatch(
            db=db,
            warehouse_id=999999999,
            route_date=route_date,
        )

    assert exc.value.status_code == 404
    assert exc.value.detail == "Warehouse not found"


def test_optimize_and_dispatch_raises_when_warehouse_inactive(db):
    route_date = datetime.now(timezone.utc)

    warehouse = make_warehouse(
        db,
        suffix="inactive",
        active=False,
    )

    with pytest.raises(HTTPException) as exc:
        optimize_and_dispatch(
            db=db,
            warehouse_id=warehouse.id,
            route_date=route_date,
        )

    assert exc.value.status_code == 400
    assert exc.value.detail == "Warehouse is inactive"


def test_optimize_and_dispatch_raises_when_no_available_fleet(db):
    route_date = datetime.now(timezone.utc)

    warehouse = make_warehouse(db, "nofleet")

    user = make_user(
        db,
        role=UserRole.DRIVER,
        suffix="nofleet",
    )

    driver = Driver(
        user_id=user.id,
        employee_id="EMP-NOFLEET",
        phone="9876543210",
        license_number="LIC-NOFLEET",
        license_expiry=datetime.now(timezone.utc).date() + timedelta(days=365),
        status=DriverStatus.ACTIVE,
        is_available=False,
    )
    db.add(driver)
    db.flush()

    vehicle = make_vehicle(db, "nofleet")

    assignment = DriverVehicleAssignment(
        driver_id=driver.id,
        vehicle_id=vehicle.id,
    )
    db.add(assignment)
    db.flush()

    with pytest.raises(HTTPException) as exc:
        optimize_and_dispatch(
            db=db,
            warehouse_id=warehouse.id,
            route_date=route_date,
        )

    assert exc.value.status_code == 409
    assert exc.value.detail == "No available driver-vehicle assignments"


def test_optimize_and_dispatch_raises_when_no_scheduled_pickups(db):
    route_date = datetime.now(timezone.utc)

    warehouse = make_warehouse(db, "nopickups")
    make_assignment(db, "nopickups")

    with pytest.raises(HTTPException) as exc:
        optimize_and_dispatch(
            db=db,
            warehouse_id=warehouse.id,
            route_date=route_date,
        )

    assert exc.value.status_code == 400
    assert exc.value.detail == "No scheduled pickups for this date"


def test_optimize_and_dispatch_rejects_pickup_above_weight_limit(db):
    route_date = datetime.now(timezone.utc)

    warehouse = make_warehouse(db, "weight")
    make_assignment(db, "weight")

    make_pickup(
        db,
        suffix="weight",
        scheduled_date=route_date + timedelta(hours=8),
        weight=150,
    )

    with patch(
        "app.services.route_optimization_service.get_configuration_float",
        side_effect=[100.0, 240.0, 100.0],
    ):
        with pytest.raises(HTTPException) as exc:
            optimize_and_dispatch(
                db=db,
                warehouse_id=warehouse.id,
                route_date=route_date,
            )

    assert exc.value.status_code == 400
    assert exc.value.detail["message"] == (
        "Pickup exceeds the configured maximum pickup weight"
    )


def test_optimize_and_dispatch_rejects_uncovered_pickups(db):
    route_date = datetime.now(timezone.utc)

    warehouse = make_warehouse(db, "uncovered")
    make_assignment(db, "uncovered")

    pickup = make_pickup(
        db,
        suffix="uncovered",
        scheduled_date=route_date + timedelta(hours=8),
        weight=10,
    )

    with patch(
        "app.services.route_optimization_service.get_configuration_float",
        side_effect=[100.0, 240.0, 100.0, 30.0],
    ), patch(
        "app.services.route_optimization_service.get_active_version",
        side_effect=[
            fake_active_configuration(100.0),
            fake_active_configuration(240.0),
        ],
    ), patch(
        "app.services.route_optimization_service.solve",
        return_value=(
            object(),
            [[1]],
            [0],
            [],
        ),
    ):
        with pytest.raises(HTTPException) as exc:
            optimize_and_dispatch(
                db=db,
                warehouse_id=warehouse.id,
                route_date=route_date,
            )

    assert exc.value.status_code == 409
    assert exc.value.detail["message"] == (
        "Not all scheduled pickups can be assigned with the available fleet"
    )
    assert pickup.id in exc.value.detail["pickup_ids"]


def test_optimize_and_dispatch_rejects_unreachable_pickups(db):
    route_date = datetime.now(timezone.utc)

    warehouse = make_warehouse(db, "unreachable")
    make_assignment(db, "unreachable")

    pickup = make_pickup(
        db,
        suffix="unreachable",
        scheduled_date=route_date + timedelta(hours=8),
        weight=10,
    )

    with patch(
        "app.services.route_optimization_service.get_configuration_float",
        side_effect=[100.0, 240.0, 100.0, 30.0],
    ), patch(
        "app.services.route_optimization_service.get_active_version",
        side_effect=[
            fake_active_configuration(100.0),
            fake_active_configuration(240.0),
        ],
    ), patch(
        "app.services.route_optimization_service.solve",
        return_value=(
            object(),
            [[1]],
            [],
            [0],
        ),
    ):
        with pytest.raises(HTTPException) as exc:
            optimize_and_dispatch(
                db=db,
                warehouse_id=warehouse.id,
                route_date=route_date,
            )

    assert exc.value.status_code == 409
    assert exc.value.detail["message"] == (
        "Not all scheduled pickups can be assigned with the available fleet"
    )
    assert pickup.id in exc.value.detail["pickup_ids"]


def test_optimize_and_dispatch_raises_when_optimizer_returns_no_routes(db):
    route_date = datetime.now(timezone.utc)

    warehouse = make_warehouse(db, "emptyroutes")
    make_assignment(db, "emptyroutes")

    make_pickup(
        db,
        suffix="emptyroutes",
        scheduled_date=route_date + timedelta(hours=8),
        weight=10,
    )

    with patch(
        "app.services.route_optimization_service.get_configuration_float",
        side_effect=[100.0, 240.0, 100.0, 30.0],
    ), patch(
        "app.services.route_optimization_service.get_active_version",
        side_effect=[
            fake_active_configuration(100.0),
            fake_active_configuration(240.0),
        ],
    ), patch(
        "app.services.route_optimization_service.solve",
        return_value=(
            object(),
            [[]],
            [],
            [],
        ),
    ):
        with pytest.raises(HTTPException) as exc:
            optimize_and_dispatch(
                db=db,
                warehouse_id=warehouse.id,
                route_date=route_date,
            )

    assert exc.value.status_code == 409
    assert exc.value.detail == "Optimizer produced no non-empty routes"


def test_optimize_and_dispatch_uses_osrm_when_configured(db):
    route_date = datetime.now(timezone.utc)

    warehouse = make_warehouse(db, "osrm")
    make_assignment(db, "osrm")

    make_pickup(
        db,
        suffix="osrm",
        scheduled_date=route_date + timedelta(hours=8),
        weight=10,
    )

    with patch(
        "app.services.route_optimization_service.get_configuration_float",
        side_effect=[100.0, 240.0, 100.0, 30.0],
    ), patch(
        "app.services.route_optimization_service.get_active_version",
        side_effect=[
            fake_active_configuration(100.0),
            fake_active_configuration(240.0),
        ],
    ), patch(
        "app.services.route_optimization_service.settings.OSRM_BASE_URL",
        "http://test-osrm",
    ), patch(
        "app.services.route_optimization_service.OSRMProvider",
    ) as provider_cls, patch(
        "app.services.route_optimization_service.solve",
    ) as solve_mock:
        problem = type(
            "FakeProblem",
            (),
            {
                "stats": staticmethod(fake_problem_stats),
            },
        )()

        solve_mock.return_value = (
            problem,
            [[0, 1]],
            [],
            [],
        )

        result = optimize_and_dispatch(
            db=db,
            warehouse_id=warehouse.id,
            route_date=route_date,
        )

    assert result["routing_source"] == "OSRM"
    provider_cls.assert_called_once_with("http://test-osrm")
    solve_mock.assert_called_once()