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
    RouteStopStatus,
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
        customer_code=f"PMP-{uuid.uuid4().hex[:12].upper()}",
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


def fake_optimizer_problem(pickup_count):
    return type(
        "FakeProblem",
        (),
        {
            "n": pickup_count,
            "W": pickup_count,
            "ok": staticmethod(lambda route, vehicle_index: True),
            "stats": staticmethod(fake_problem_stats),
        },
    )()


def patch_single_pickup_optimizer():
    return (
        patch(
            "app.services.route_optimization_service.get_configuration_float",
            side_effect=[100.0, 240.0, 100.0, 30.0],
        ),
        patch(
            "app.services.route_optimization_service.get_active_version",
            side_effect=[
                fake_active_configuration(100.0),
                fake_active_configuration(240.0),
            ],
        ),
        patch(
            "app.services.route_optimization_service.settings.OSRM_BASE_URL",
            None,
        ),
        patch(
            "app.services.route_optimization_service.solve",
            return_value=(
                fake_optimizer_problem(1),
                [[0, 1]],
                [],
                [],
            ),
        ),
    )


@pytest.mark.parametrize(
    "vehicle_status",
    [VehicleStatus.AVAILABLE, VehicleStatus.ASSIGNED],
)
def test_optimize_and_dispatch_creates_route_and_assigns_pickups(db, vehicle_status):
    route_date = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)

    warehouse = make_warehouse(db, "basic")
    driver_user, driver, vehicle, assignment = make_assignment(db, "basic")
    vehicle.status = vehicle_status

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
        problem = fake_optimizer_problem(1)

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


def test_optimize_and_dispatch_reuses_existing_unassigned_draft_route(db):
    route_date = datetime(2026, 10, 21, tzinfo=timezone.utc)
    warehouse = make_warehouse(db, "draft-rerun")
    make_assignment(db, "draft-rerun")
    pickup = make_pickup(
        db,
        suffix="draft-rerun",
        scheduled_date=route_date + timedelta(hours=8),
        weight=10,
    )
    draft = Route(
        route_code="RT-20261021-DRAFTRN",
        route_date=route_date,
        warehouse_id=warehouse.id,
        status=RouteStatus.DRAFT,
    )
    db.add(draft)
    db.flush()
    db.add_all(
        [
            RouteStop(
                route_id=draft.id,
                sequence_number=1,
                stop_type=RouteStopType.PICKUP,
                pickup_id=pickup.id,
            ),
            RouteStop(
                route_id=draft.id,
                sequence_number=2,
                stop_type=RouteStopType.WAREHOUSE,
                warehouse_id=warehouse.id,
            ),
        ]
    )
    db.flush()
    draft_id = draft.id

    patches = patch_single_pickup_optimizer()
    with patches[0], patches[1], patches[2], patches[3]:
        result = optimize_and_dispatch(db, warehouse.id, route_date)

    assert result["routes_created"] == 1
    assert result["routes"][0]["route_id"] == draft_id
    routes = (
        db.query(Route)
        .filter(Route.warehouse_id == warehouse.id, Route.route_date == route_date)
        .all()
    )
    assert [route.id for route in routes] == [draft_id]
    stops = (
        db.query(RouteStop)
        .filter(RouteStop.route_id == draft_id)
        .order_by(RouteStop.sequence_number)
        .all()
    )
    assert [stop.pickup_id for stop in stops if stop.pickup_id is not None] == [
        pickup.id
    ]
    assert len(stops) == 2
    assert routes[0].status == RouteStatus.ASSIGNED


def test_optimize_and_dispatch_rolls_back_draft_replacement_on_failure(db):
    route_date = datetime(2026, 10, 21, tzinfo=timezone.utc)
    warehouse = make_warehouse(db, "draft-rollback")
    make_assignment(db, "draft-rollback")
    pickup = make_pickup(
        db,
        suffix="draft-rollback",
        scheduled_date=route_date + timedelta(hours=8),
        weight=10,
    )
    draft = Route(
        route_code="RT-20261021-DRAFTRBK",
        route_date=route_date,
        warehouse_id=warehouse.id,
        status=RouteStatus.DRAFT,
    )
    db.add(draft)
    db.flush()
    old_pickup_stop = RouteStop(
        route_id=draft.id,
        sequence_number=1,
        stop_type=RouteStopType.PICKUP,
        pickup_id=pickup.id,
    )
    old_warehouse_stop = RouteStop(
        route_id=draft.id,
        sequence_number=2,
        stop_type=RouteStopType.WAREHOUSE,
        warehouse_id=warehouse.id,
    )
    db.add_all([old_pickup_stop, old_warehouse_stop])
    db.commit()
    draft_id = draft.id

    patches = patch_single_pickup_optimizer()
    with patches[0], patches[1], patches[2], patches[3], patch(
        "app.services.route_optimization_service.notify_driver_assigned",
        side_effect=RuntimeError("notification persistence failed"),
    ):
        with pytest.raises(RuntimeError, match="notification persistence failed"):
            optimize_and_dispatch(db, warehouse.id, route_date)

    restored_draft = db.query(Route).filter(Route.id == draft_id).one()
    restored_stops = (
        db.query(RouteStop)
        .filter(RouteStop.route_id == draft_id)
        .order_by(RouteStop.sequence_number)
        .all()
    )
    db.refresh(pickup)
    assert restored_draft.status == RouteStatus.DRAFT
    assert restored_draft.driver_id is None
    assert restored_draft.vehicle_id is None
    assert [stop.pickup_id for stop in restored_stops] == [pickup.id, None]
    assert pickup.status == PickupStatus.SCHEDULED


@pytest.mark.parametrize(
    ("route_status", "pickup_status"),
    [
        (RouteStatus.ASSIGNED, PickupStatus.ASSIGNED),
        (RouteStatus.IN_PROGRESS, PickupStatus.IN_PROGRESS),
        (RouteStatus.COMPLETED, PickupStatus.COLLECTED),
    ],
)
def test_optimize_and_dispatch_preserves_protected_routes_and_stops(
    db,
    route_status,
    pickup_status,
):
    route_date = datetime(2026, 10, 21, tzinfo=timezone.utc)
    warehouse = make_warehouse(db, f"protected-{route_status.value.lower()}")
    make_assignment(db, f"optimizer-{route_status.value.lower()}")
    _, protected_driver, protected_vehicle, _ = make_assignment(
        db,
        f"protected-{route_status.value.lower()}",
    )
    protected_driver.is_available = False
    protected_vehicle.status = VehicleStatus.ASSIGNED
    protected_pickup = make_pickup(
        db,
        suffix=f"protected-{route_status.value.lower()}",
        scheduled_date=route_date + timedelta(hours=7),
        weight=10,
    )
    protected_pickup.status = pickup_status
    protected_route = Route(
        route_code=f"RT-20261021-PROT{route_status.value[:4]}",
        route_date=route_date,
        warehouse_id=warehouse.id,
        driver_id=protected_driver.id,
        vehicle_id=protected_vehicle.id,
        status=route_status,
    )
    db.add(protected_route)
    db.flush()
    protected_stop = RouteStop(
        route_id=protected_route.id,
        sequence_number=1,
        stop_type=RouteStopType.PICKUP,
        pickup_id=protected_pickup.id,
        execution_status=(
            RouteStopStatus.COMPLETED
            if route_status == RouteStatus.COMPLETED
            else (
                RouteStopStatus.IN_PROGRESS
                if route_status == RouteStatus.IN_PROGRESS
                else RouteStopStatus.PENDING
            )
        ),
    )
    db.add(protected_stop)
    new_pickup = make_pickup(
        db,
        suffix=f"new-{route_status.value.lower()}",
        scheduled_date=route_date + timedelta(hours=8),
        weight=10,
    )
    protected_route_id = protected_route.id
    protected_stop_id = protected_stop.id

    patches = patch_single_pickup_optimizer()
    with patches[0], patches[1], patches[2], patches[3]:
        result = optimize_and_dispatch(db, warehouse.id, route_date)

    db.refresh(protected_route)
    db.refresh(protected_stop)
    assert result["pickups_assigned"] == 1
    assert protected_route.status == route_status
    assert protected_route.driver_id == protected_driver.id
    assert protected_route.vehicle_id == protected_vehicle.id
    assert protected_stop.id == protected_stop_id
    assert protected_stop.route_id == protected_route_id
    assert protected_stop.pickup_id == protected_pickup.id
    assert (
        db.query(RouteStop)
        .filter(RouteStop.pickup_id == protected_pickup.id)
        .count()
        == 1
    )
    assert (
        db.query(RouteStop)
        .filter(RouteStop.pickup_id == new_pickup.id)
        .count()
        == 1
    )


def test_optimize_and_dispatch_raises_when_warehouse_missing(db):
    route_date = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0).replace(
    hour=0, minute=0, second=0, microsecond=0
)

    with pytest.raises(HTTPException) as exc:
        optimize_and_dispatch(
            db=db,
            warehouse_id=999999999,
            route_date=route_date,
        )

    assert exc.value.status_code == 404
    assert exc.value.detail == "Warehouse not found"


def test_optimize_and_dispatch_raises_when_warehouse_inactive(db):
    route_date = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0).replace(
    hour=0, minute=0, second=0, microsecond=0
)

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
    route_date = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0).replace(
    hour=0, minute=0, second=0, microsecond=0
)

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


def test_optimize_and_dispatch_returns_empty_result_when_no_scheduled_pickups(db):
    route_date = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0).replace(
    hour=0, minute=0, second=0, microsecond=0
)

    warehouse = make_warehouse(db, "nopickups")
    make_assignment(db, "nopickups")

    result = optimize_and_dispatch(
        db=db,
        warehouse_id=warehouse.id,
        route_date=route_date,
    )

    assert result["routes_created"] == 0
    assert result["pickups_assigned"] == 0
    assert result["routes"] == []


def test_optimize_and_dispatch_rejects_pickup_above_weight_limit(db):
    route_date = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0).replace(
    hour=0, minute=0, second=0, microsecond=0
)

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
    route_date = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0).replace(
    hour=0, minute=0, second=0, microsecond=0
)

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
            fake_optimizer_problem(1),
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
    unassigned_pickup_ids = [
        item["pickup_id"] for item in exc.value.detail["unassigned_pickups"]
    ]
    assert pickup.id in unassigned_pickup_ids


def test_optimize_and_dispatch_rejects_unreachable_pickups(db):
    route_date = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0).replace(
    hour=0, minute=0, second=0, microsecond=0
)

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
            fake_optimizer_problem(1),
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
    unassigned_pickup_ids = [
        item["pickup_id"] for item in exc.value.detail["unassigned_pickups"]
    ]
    assert pickup.id in unassigned_pickup_ids


def test_optimize_and_dispatch_raises_when_optimizer_returns_no_routes(db):
    route_date = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0).replace(
    hour=0, minute=0, second=0, microsecond=0
)

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
            fake_optimizer_problem(1),
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

    assert exc.value.status_code == 502
    assert exc.value.detail["message"] == "Route optimizer returned invalid output"


def test_optimize_and_dispatch_uses_osrm_when_configured(db):
    route_date = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0).replace(
    hour=0, minute=0, second=0, microsecond=0
)

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
        problem = fake_optimizer_problem(1)

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


# ---------------------------------------------------------------------------
# New tests: correctness requirements from the integration spec
# ---------------------------------------------------------------------------


def test_optimize_and_dispatch_response_contains_routing_source(db):
    """routing_source must be present in the API response."""
    route_date = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    warehouse = make_warehouse(db, "rtsource")
    make_assignment(db, "rtsource")
    make_pickup(db, suffix="rtsource", scheduled_date=route_date + timedelta(hours=9), weight=10)

    patches = patch_single_pickup_optimizer()
    with patches[0], patches[1], patches[2], patches[3]:
        result = optimize_and_dispatch(db, warehouse.id, route_date)

    assert "routing_source" in result
    assert result["routing_source"] in {"OSRM", "HAVERSINE_FALLBACK"}


def test_optimize_and_dispatch_stop_locations_use_real_db_coordinates(db):
    """stop_locations in the response must use the real CustomerLocation lat/lon,
    not synthetic values."""
    route_date = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    warehouse = make_warehouse(db, "stoploc")
    make_assignment(db, "stoploc")

    # Create a pickup with a specific, unique coordinate pair that must appear
    # verbatim in stop_locations.
    expected_lat = 12.345678
    expected_lng = 77.654321

    pickup = make_pickup(
        db,
        suffix="stoploc",
        scheduled_date=route_date + timedelta(hours=9),
        weight=10,
        latitude=expected_lat,
        longitude=expected_lng,
    )

    patches = patch_single_pickup_optimizer()
    with patches[0], patches[1], patches[2], patches[3]:
        result = optimize_and_dispatch(db, warehouse.id, route_date)

    assert result["routes_created"] == 1
    route_summary = result["routes"][0]
    assert "stop_locations" in route_summary
    assert len(route_summary["stop_locations"]) == 1

    stop_loc = route_summary["stop_locations"][0]
    assert stop_loc["pickup_id"] == pickup.id
    assert abs(stop_loc["lat"] - expected_lat) < 1e-6, (
        f"Expected lat {expected_lat}, got {stop_loc['lat']} — real DB coordinates must be used"
    )
    assert abs(stop_loc["lng"] - expected_lng) < 1e-6, (
        f"Expected lng {expected_lng}, got {stop_loc['lng']} — real DB coordinates must be used"
    )


def test_optimize_and_dispatch_uses_actual_warehouse_coordinates(db):
    """The correct warehouse (the one passed by ID) must be used as the depot.
    The optimizer's `solve` call must receive the warehouse's real lat/lon."""
    route_date = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)

    warehouse = Warehouse(
        code="WH-COORD-TEST",
        name="Coordinate Test Warehouse",
        address="1 Test Road",
        city="Bengaluru",
        state="Karnataka",
        postal_code="560001",
        latitude=13.111111,
        longitude=77.222222,
        active=True,
    )
    db.add(warehouse)
    db.flush()

    make_assignment(db, "coord-test")
    make_pickup(db, suffix="coord-test", scheduled_date=route_date + timedelta(hours=9), weight=10)

    captured_warehouse = {}

    def capturing_solve(stores, warehouse, config, provider, log=print):
        captured_warehouse["coords"] = warehouse
        problem = fake_optimizer_problem(len(stores))
        routes = [[i for i in range(len(stores))] + [len(stores)]]
        return problem, routes, [], []

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
        side_effect=capturing_solve,
    ):
        optimize_and_dispatch(db, warehouse.id, route_date)

    assert "coords" in captured_warehouse, "solve() was not called"
    wh_lat, wh_lon = captured_warehouse["coords"]
    assert abs(wh_lat - 13.111111) < 1e-6, "Wrong warehouse latitude passed to optimizer"
    assert abs(wh_lon - 77.222222) < 1e-6, "Wrong warehouse longitude passed to optimizer"


def test_optimize_and_dispatch_excludes_cancelled_and_completed_pickups(db):
    """Cancelled and collected pickups must not be included in the optimization run."""
    route_date = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    warehouse = make_warehouse(db, "exclude-status")
    make_assignment(db, "exclude-status")

    scheduled_pickup = make_pickup(
        db,
        suffix="exclude-sched",
        scheduled_date=route_date + timedelta(hours=9),
        weight=10,
    )

    # Cancelled pickup — must never reach the optimizer
    cancelled_pickup = make_pickup(
        db,
        suffix="exclude-cancel",
        scheduled_date=route_date + timedelta(hours=10),
        weight=10,
    )
    cancelled_pickup.status = PickupStatus.CANCELLED
    db.flush()

    # Collected pickup — must never reach the optimizer
    collected_pickup = make_pickup(
        db,
        suffix="exclude-collect",
        scheduled_date=route_date + timedelta(hours=11),
        weight=10,
    )
    collected_pickup.status = PickupStatus.COLLECTED
    db.flush()

    captured_stores = {}

    def capturing_solve(stores, warehouse, config, provider, log=print):
        captured_stores["stores"] = stores
        problem = fake_optimizer_problem(len(stores))
        routes = [[i for i in range(len(stores))] + [len(stores)]]
        return problem, routes, [], []

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
        side_effect=capturing_solve,
    ):
        optimize_and_dispatch(db, warehouse.id, route_date)

    store_ids = {s.id for s in captured_stores.get("stores", [])}
    assert str(scheduled_pickup.id) in store_ids, "Scheduled pickup must reach the optimizer"
    assert str(cancelled_pickup.id) not in store_ids, "Cancelled pickup must not reach the optimizer"
    assert str(collected_pickup.id) not in store_ids, "Collected pickup must not reach the optimizer"


def test_optimize_and_dispatch_reports_missing_coordinates_as_error(db):
    """Pickups without a valid location must cause a 409 error, not silent exclusion."""
    route_date = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    warehouse = make_warehouse(db, "missing-coords")
    make_assignment(db, "missing-coords")

    # Create a pickup whose location we will manually detach to simulate
    # a pickup with no location.
    pickup = make_pickup(
        db,
        suffix="missing-coords",
        scheduled_date=route_date + timedelta(hours=9),
        weight=10,
    )
    # Detach the location by overriding location_id with a non-existent value
    # to simulate the "pickup.location is None" scenario by patching the
    # _scheduled_pickups helper to return a pickup without a loaded location.
    class PickupWithoutLocation:
        id = pickup.id
        location = None
        estimated_weight_kg = pickup.estimated_weight_kg
        priority = pickup.priority
        scheduled_date = pickup.scheduled_date
        status = pickup.status

    with patch(
        "app.services.route_optimization_service._scheduled_pickups",
        return_value=[PickupWithoutLocation()],
    ), patch(
        "app.services.route_optimization_service.get_configuration_float",
        side_effect=[100.0, 240.0, 100.0],
    ):
        with pytest.raises(HTTPException) as exc:
            optimize_and_dispatch(db, warehouse.id, route_date)

    assert exc.value.status_code == 409
    assert "missing valid locations" in exc.value.detail["message"]


def test_optimize_and_dispatch_two_vehicles_cover_all_pickups(db):
    """With two vehicles, all feasible pickups must be assigned across the fleet
    without duplication."""
    route_date = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    warehouse = make_warehouse(db, "twoveh")
    make_assignment(db, "twoveh-a")
    make_assignment(db, "twoveh-b")

    pickup_a = make_pickup(
        db, suffix="twoveh-a", scheduled_date=route_date + timedelta(hours=8), weight=10,
        latitude=12.9352, longitude=77.6245,
    )
    pickup_b = make_pickup(
        db, suffix="twoveh-b", scheduled_date=route_date + timedelta(hours=9), weight=10,
        latitude=12.9452, longitude=77.6145,
    )

    # Two vehicles, two pickups, each goes to one vehicle
    two_vehicle_problem = fake_optimizer_problem(2)

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
        return_value=(
            two_vehicle_problem,
            [[0, 2], [1, 2]],   # vehicle 0 takes pickup 0, vehicle 1 takes pickup 1
            [],
            [],
        ),
    ):
        result = optimize_and_dispatch(db, warehouse.id, route_date)

    assert result["routes_created"] == 2
    assert result["pickups_assigned"] == 2

    all_assigned_pickup_ids = [
        pid
        for route in result["routes"]
        for pid in route["pickup_ids"]
    ]
    assert sorted(all_assigned_pickup_ids) == sorted([pickup_a.id, pickup_b.id]), (
        "Both pickups must be assigned exactly once across the two vehicles"
    )
    assert len(all_assigned_pickup_ids) == len(set(all_assigned_pickup_ids)), (
        "No pickup may be assigned more than once"
    )

