import uuid
from datetime import datetime, timezone
import pytest
from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.core.planning import get_operational_planning_date
from app.models.customer import Customer
from app.models.customer_location import CustomerLocation
from app.models.driver import Driver
from app.models.driver_vehicle_assignment import DriverVehicleAssignment
from app.models.enums import DriverStatus, PickupPriority, PickupStatus, RouteStatus, UserRole, VehicleStatus, VehicleType
from app.models.optimization_run import OptimizationRun
from app.models.pickup import Pickup
from app.models.route import Route
from app.models.user import User
from app.models.vehicle import Vehicle
from app.models.warehouse import Warehouse
from app.services.route_optimization_service import (
    get_optimization_batch,
    optimize_and_dispatch,
    submit_optimization_batch,
)
from app.services.route_service import approve_route


def make_user(db: Session, role: UserRole, suffix: str = None) -> User:
    if suffix is None:
        suffix = uuid.uuid4().hex[:8]
    user = User(
        auth_user_id=uuid.uuid4(),
        name=f"User {suffix}",
        email=f"user-{suffix}@example.com",
        role=role,
        is_active=True,
    )
    db.add(user)
    db.flush()
    return user


def make_driver(db: Session, suffix: str = None) -> tuple[User, Driver]:
    if suffix is None:
        suffix = uuid.uuid4().hex[:8]
    user = make_user(db, UserRole.DRIVER, suffix=f"drv-{suffix}")
    driver = Driver(
        user_id=user.id,
        employee_id=f"DRV-{suffix[:6].upper()}",
        phone="9876543210",
        license_number=f"LIC-{suffix[:6].upper()}",
        status=DriverStatus.ACTIVE,
        is_available=True,
    )
    db.add(driver)
    db.flush()
    return user, driver


def make_vehicle(db: Session, suffix: str = None, capacity: float = 100.0) -> Vehicle:
    if suffix is None:
        suffix = uuid.uuid4().hex[:8]
    vehicle = Vehicle(
        registration_number=f"KA-01-{suffix[:4].upper()}",
        vehicle_type=VehicleType.VAN,
        capacity_kg=capacity,
        status=VehicleStatus.ASSIGNED,
    )
    db.add(vehicle)
    db.flush()
    return vehicle


def make_warehouse(db: Session, suffix: str = None) -> Warehouse:
    if suffix is None:
        suffix = uuid.uuid4().hex[:8]
    warehouse = Warehouse(
        code=f"WH-{suffix[:6]}",
        name=f"Warehouse {suffix[:6]}",
        address="Central Hub",
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


def make_customer_with_pickup(
    db: Session,
    scheduled_date: datetime,
    lat: float,
    lng: float,
    weight: float = 10.0,
    suffix: str = None,
) -> tuple[Customer, CustomerLocation, Pickup]:
    if suffix is None:
        suffix = uuid.uuid4().hex[:8]
    cust_user = make_user(db, UserRole.CUSTOMER, suffix=f"cust-{suffix}")
    customer = Customer(
        user_id=cust_user.id,
        customer_type="PHARMACY",
        customer_code=f"CUST-{suffix.upper()}",
        legal_name=f"Pharma {suffix}",
        display_name=f"Pharma {suffix}",
        phone="9876543210",
        email=f"cust-{suffix}@test.local",
        is_active=True,
    )
    db.add(customer)
    db.flush()

    location = CustomerLocation(
        customer_id=customer.id,
        location_code=f"LOC-{suffix[:6].upper()}",
        name=f"Location {suffix[:6]}",
        address_line_1="MG Road",
        city="Bengaluru",
        state="Karnataka",
        postal_code="560001",
        latitude=lat,
        longitude=lng,
        service_time_seconds=300,
        pickup_enabled=True,
        is_active=True,
    )
    db.add(location)
    db.flush()

    pickup = Pickup(
        pickup_code=f"PK-{suffix[:8].upper()}",
        customer_id=customer.id,
        location_id=location.id,
        status=PickupStatus.SCHEDULED,
        priority=PickupPriority.NORMAL,
        scheduled_date=scheduled_date,
        estimated_weight_kg=weight,
        verification_token=uuid.uuid4().hex,
    )
    db.add(pickup)
    db.flush()
    return customer, location, pickup


def test_two_pickups_one_driver_one_vehicle_feasible_route(db: Session):
    """
    Scenario: 2 customers, 2 pickups for tomorrow, 1 driver, 1 vehicle.
    The vehicle is assigned to the driver beforehand.
    Optimization generates 1 feasible route combining both pickups in DRAFT status
    without requiring driver/vehicle pre-assignment.
    """
    tomorrow = get_operational_planning_date()
    admin = make_user(db, UserRole.ADMIN)
    wh = make_warehouse(db)

    # 1 driver and 1 vehicle assigned to each other
    _, driver = make_driver(db)
    vehicle = make_vehicle(db, capacity=100.0)
    assignment = DriverVehicleAssignment(driver_id=driver.id, vehicle_id=vehicle.id)
    db.add(assignment)
    db.flush()

    # 2 customers and pickups within reachable distance in Bengaluru (~1-2 km from warehouse)
    _, _, p1 = make_customer_with_pickup(db, scheduled_date=tomorrow, lat=12.9750, lng=77.6000, weight=12.0)
    _, _, p2 = make_customer_with_pickup(db, scheduled_date=tomorrow, lat=12.9680, lng=77.5900, weight=15.0)
    db.commit()

    # Submit batch explicitly from Pickup Planning
    batch = submit_optimization_batch(
        db=db,
        warehouse_id=wh.id,
        pickup_ids=[p1.id, p2.id],
        planning_date=tomorrow,
        current_user=admin,
    )
    assert batch["batch_id"] is not None
    assert batch["pickup_count"] == 2

    # Optimize routes
    result = optimize_and_dispatch(
        db=db,
        warehouse_id=wh.id,
        route_date=tomorrow,
        batch_id=batch["batch_id"],
        num_vehicles=4,
        vehicle_capacity_kg=500,
        max_distance_km=120,
        auto_dispatch=False,
        rerun=False,
        actor=admin,
    )

    # Must create exactly 1 route holding BOTH pickups
    assert result["routes_created"] == 1
    assert result["pickups_assigned"] == 2
    route_info = result["routes"][0]
    assert set(route_info["pickup_ids"]) == {p1.id, p2.id}
    assert route_info["is_approved"] is False

    # Stored in DB as DRAFT with no driver or vehicle pre-assigned
    db_route = db.query(Route).filter(Route.id == route_info["route_id"]).first()
    assert db_route.status == RouteStatus.DRAFT
    assert db_route.driver_id is None
    assert db_route.vehicle_id is None
    assert db_route.approved_at is None


def test_repeated_optimization_request_idempotency(db: Session):
    """
    Scenario: Repeated optimization request without rerun=True returns
    the persisted route and does NOT duplicate routes or route stops.
    """
    tomorrow = get_operational_planning_date()
    admin = make_user(db, UserRole.ADMIN)
    wh = make_warehouse(db)

    _, driver = make_driver(db)
    vehicle = make_vehicle(db, capacity=100.0)
    db.add(DriverVehicleAssignment(driver_id=driver.id, vehicle_id=vehicle.id))
    db.flush()

    _, _, p1 = make_customer_with_pickup(db, scheduled_date=tomorrow, lat=12.9750, lng=77.6000, weight=10.0)
    _, _, p2 = make_customer_with_pickup(db, scheduled_date=tomorrow, lat=12.9680, lng=77.5900, weight=10.0)
    db.commit()

    batch = submit_optimization_batch(
        db=db,
        warehouse_id=wh.id,
        pickup_ids=[p1.id, p2.id],
        planning_date=tomorrow,
        current_user=admin,
    )

    # First run
    res1 = optimize_and_dispatch(
        db=db,
        warehouse_id=wh.id,
        route_date=tomorrow,
        batch_id=batch["batch_id"],
        rerun=False,
        actor=admin,
    )

    # Second run without rerun=True
    res2 = optimize_and_dispatch(
        db=db,
        warehouse_id=wh.id,
        route_date=tomorrow,
        batch_id=batch["batch_id"],
        rerun=False,
        actor=admin,
    )

    assert res2["routing_source"] == "PERSISTED"
    assert res1["routes"][0]["route_id"] == res2["routes"][0]["route_id"]

    # Exactly 1 active route in DB for this batch
    active_routes = db.query(Route).filter(
        Route.optimization_run_id == batch["batch_id"],
        Route.status != RouteStatus.CANCELLED,
    ).all()
    assert len(active_routes) == 1


def test_repeated_optimization_request_with_rerun(db: Session):
    """
    Scenario: Repeated optimization request with rerun=True replaces
    the draft route cleanly without leaving duplicate active routes.
    """
    tomorrow = get_operational_planning_date()
    admin = make_user(db, UserRole.ADMIN)
    wh = make_warehouse(db)

    _, driver = make_driver(db)
    vehicle = make_vehicle(db, capacity=100.0)
    db.add(DriverVehicleAssignment(driver_id=driver.id, vehicle_id=vehicle.id))
    db.flush()

    _, _, p1 = make_customer_with_pickup(db, scheduled_date=tomorrow, lat=12.9750, lng=77.6000, weight=10.0)
    _, _, p2 = make_customer_with_pickup(db, scheduled_date=tomorrow, lat=12.9680, lng=77.5900, weight=10.0)
    db.commit()

    batch = submit_optimization_batch(
        db=db,
        warehouse_id=wh.id,
        pickup_ids=[p1.id, p2.id],
        planning_date=tomorrow,
        current_user=admin,
    )

    # First run
    res1 = optimize_and_dispatch(
        db=db,
        warehouse_id=wh.id,
        route_date=tomorrow,
        batch_id=batch["batch_id"],
        rerun=False,
        actor=admin,
    )
    first_route_id = res1["routes"][0]["route_id"]

    # Second run with rerun=True
    res2 = optimize_and_dispatch(
        db=db,
        warehouse_id=wh.id,
        route_date=tomorrow,
        batch_id=batch["batch_id"],
        rerun=True,
        actor=admin,
    )
    second_route_id = res2["routes"][0]["route_id"]

    # First route is cancelled, exactly 1 active route exists
    old_route = db.query(Route).filter(Route.id == first_route_id).first()
    assert old_route.status == RouteStatus.CANCELLED

    active_routes = db.query(Route).filter(
        Route.optimization_run_id == batch["batch_id"],
        Route.status != RouteStatus.CANCELLED,
    ).all()
    assert len(active_routes) == 1
    assert active_routes[0].id == second_route_id


def test_genuine_duplicate_route_conflict(db: Session):
    """
    Scenario: Genuine duplicate route conflict when attempting to submit
    or optimize pickups already assigned to active routes.
    """
    tomorrow = get_operational_planning_date()
    admin = make_user(db, UserRole.ADMIN)
    wh = make_warehouse(db)

    _, _, p1 = make_customer_with_pickup(db, scheduled_date=tomorrow, lat=12.9750, lng=77.6000, weight=10.0)
    _, _, p2 = make_customer_with_pickup(db, scheduled_date=tomorrow, lat=12.9680, lng=77.5900, weight=10.0)
    db.commit()

    batch1 = submit_optimization_batch(
        db=db,
        warehouse_id=wh.id,
        pickup_ids=[p1.id, p2.id],
        planning_date=tomorrow,
        current_user=admin,
    )
    optimize_and_dispatch(
        db=db,
        warehouse_id=wh.id,
        route_date=tomorrow,
        batch_id=batch1["batch_id"],
        rerun=False,
        actor=admin,
    )

    # Attempting to submit another batch containing p1 raises 409 Conflict
    with pytest.raises(HTTPException) as exc:
        submit_optimization_batch(
            db=db,
            warehouse_id=wh.id,
            pickup_ids=[p1.id],
            planning_date=tomorrow,
            current_user=admin,
        )
    assert exc.value.status_code == 409
    assert "already assigned to active routes" in exc.value.detail.lower()


def test_infeasible_pickups_distance_conflict_clear_message(db: Session):
    """
    Scenario: When pickups are out of range (unreachable within max distance/duration),
    the system raises 409 Conflict with an actionable message indicating unreachable pickups
    and depot distances, rather than a generic record conflict.
    """
    tomorrow = get_operational_planning_date()
    admin = make_user(db, UserRole.ADMIN)
    wh = make_warehouse(db)

    # Location in Mumbai (18.922, 72.834), ~1126 km away from Bengaluru warehouse
    _, _, p_far = make_customer_with_pickup(
        db,
        scheduled_date=tomorrow,
        lat=18.922,
        lng=72.834,
        weight=10.0,
    )
    db.commit()

    batch = submit_optimization_batch(
        db=db,
        warehouse_id=wh.id,
        pickup_ids=[p_far.id],
        planning_date=tomorrow,
        current_user=admin,
    )

    with pytest.raises(HTTPException) as exc:
        optimize_and_dispatch(
            db=db,
            warehouse_id=wh.id,
            route_date=tomorrow,
            batch_id=batch["batch_id"],
            max_distance_km=120,
            actor=admin,
        )
    assert exc.value.status_code == 409
    detail = exc.value.detail
    assert isinstance(detail, dict)
    assert "infeasible route plan" in detail["message"].lower()
    assert "unreachable" in detail["message"].lower()
    assert "km" in detail["message"].lower()
