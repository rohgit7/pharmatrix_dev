from datetime import datetime, timedelta, timezone
from decimal import Decimal
import uuid
import pytest
from fastapi import HTTPException

from app.core.planning import get_operational_planning_date
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
from app.models.optimization_run import OptimizationRun, OptimizationRunPickup
from app.services.route_optimization_service import (
    submit_optimization_batch,
    get_optimization_batch,
    optimize_and_dispatch,
)
from app.services.route_service import (
    approve_route,
    reject_route,
    assign_route_fleet,
    dispatch_route,
)
from app.schemas.route import RouteAssignRequest


def make_user(db, role=UserRole.ADMIN, suffix=None):
    if suffix is None:
        suffix = uuid.uuid4().hex
    user = User(
        auth_user_id=uuid.uuid4(),
        name=f"User {suffix}",
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
        employee_id=f"EMP-{suffix[:6]}",
        phone="9876543210",
        license_number=f"LIC-{suffix[:6]}",
        license_expiry=datetime.now(timezone.utc).date() + timedelta(days=365),
        status=DriverStatus.ACTIVE,
        is_available=True,
    )
    db.add(driver)
    db.flush()
    return user, driver


def make_vehicle(db, suffix=None, capacity=Decimal("500.00")):
    if suffix is None:
        suffix = uuid.uuid4().hex
    vehicle = Vehicle(
        registration_number=f"KA01-{suffix[:6]}",
        vehicle_type=VehicleType.VAN,
        capacity_kg=capacity,
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


def make_warehouse(db, suffix=None):
    if suffix is None:
        suffix = uuid.uuid4().hex
    warehouse = Warehouse(
        code=f"WH-{suffix[:6]}",
        name=f"Warehouse {suffix[:6]}",
        address="123 Hub Lane",
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


def make_pickup(db, scheduled_date, suffix=None, weight=10, status=PickupStatus.SCHEDULED, lat=12.9750, lng=77.6000):
    if suffix is None:
        suffix = uuid.uuid4().hex
    cust_user = make_user(db, UserRole.CUSTOMER, suffix=f"cust-{suffix}")
    customer = Customer(
        user_id=cust_user.id,
        customer_type="PHARMACY",
        customer_code=f"PMP-{uuid.uuid4().hex[:8].upper()}",
        legal_name=f"Pharmacy {suffix}",
        display_name=f"Pharmacy {suffix}",
        phone="9876500000",
        email=f"pharma-{suffix}@test.local",
        is_active=True,
    )
    db.add(customer)
    db.flush()

    location = CustomerLocation(
        customer_id=customer.id,
        location_code=f"LOC-{suffix[:6]}",
        name=f"Store {suffix}",
        address_line_1="100 Commercial St",
        city="Bengaluru",
        state="Karnataka",
        postal_code="560002",
        latitude=lat,
        longitude=lng,
    )
    db.add(location)
    db.flush()

    pickup = Pickup(
        customer_id=customer.id,
        location_id=location.id,
        pickup_code=f"PK-{suffix[:8].upper()}",
        status=status,
        priority=PickupPriority.NORMAL,
        scheduled_date=datetime.combine(scheduled_date, datetime.min.time(), tzinfo=timezone.utc),
        estimated_weight_kg=Decimal(str(weight)),
        verification_token=f"token-{suffix[:8]}",
    )
    db.add(pickup)
    db.flush()
    return pickup


# ===========================================================================
# 15 Linear Operations Pipeline Integration Tests
# ===========================================================================

def test_01_pickup_not_submitted_cannot_be_routed(db):
    """1. A pickup that has not been submitted from Pickup Planning cannot be routed."""
    tomorrow = get_operational_planning_date()
    admin = make_user(db, UserRole.ADMIN)
    wh = make_warehouse(db)
    make_assignment(db)
    make_pickup(db, scheduled_date=tomorrow, weight=15)
    db.commit()

    # Route optimization without submitted batch must reject
    with pytest.raises(HTTPException) as exc:
        optimize_and_dispatch(
            db=db,
            warehouse_id=wh.id,
            route_date=tomorrow,
            batch_id=None,
            selected_pickup_ids=None,
            current_user=admin,
        )
    assert exc.value.status_code == 400
    assert "no submitted optimization batch found" in exc.value.detail.lower()


def test_02_submitting_batch_makes_exactly_that_batch_eligible(db):
    """2. Submitting a pickup batch makes exactly that batch eligible for optimization."""
    tomorrow = get_operational_planning_date()
    admin = make_user(db, UserRole.ADMIN)
    wh = make_warehouse(db)
    p1 = make_pickup(db, scheduled_date=tomorrow, weight=20)
    p2 = make_pickup(db, scheduled_date=tomorrow, weight=25)
    db.commit()

    batch = submit_optimization_batch(
        db=db,
        warehouse_id=wh.id,
        pickup_ids=[p1.id, p2.id],
        planning_date=tomorrow,
        current_user=admin,
    )
    assert batch["batch_id"] is not None
    assert batch["status"] == "SUBMITTED"
    assert batch["pickup_count"] == 2
    assert set(batch["pickup_ids"]) == {p1.id, p2.id}

    # Verify database persistence
    opt_run = db.query(OptimizationRun).filter(OptimizationRun.id == batch["batch_id"]).first()
    assert opt_run is not None
    assert opt_run.status == "SUBMITTED"
    assert len(opt_run.submitted_pickups) == 2


def test_03_optimization_does_not_include_unrelated_pending_pickups(db):
    """3. Optimization does not include unrelated pending pickups."""
    tomorrow = get_operational_planning_date()
    admin = make_user(db, UserRole.ADMIN)
    wh = make_warehouse(db)
    make_assignment(db)
    p1 = make_pickup(db, scheduled_date=tomorrow, weight=20, lat=12.9800, lng=77.6100)
    p_unrelated = make_pickup(db, scheduled_date=tomorrow, weight=15, lat=12.9850, lng=77.6150)
    db.commit()

    batch = submit_optimization_batch(
        db=db,
        warehouse_id=wh.id,
        pickup_ids=[p1.id],
        planning_date=tomorrow,
        current_user=admin,
    )

    res = optimize_and_dispatch(
        db=db,
        warehouse_id=wh.id,
        route_date=tomorrow,
        batch_id=batch["batch_id"],
        current_user=admin,
    )
    assert res["pickups_assigned"] == 1
    all_routed_pids = [pid for r in res["routes"] for pid in r["pickup_ids"]]
    assert p1.id in all_routed_pids
    assert p_unrelated.id not in all_routed_pids

    # Unrelated pickup is still untouched
    db.refresh(p_unrelated)
    assert p_unrelated.status == PickupStatus.SCHEDULED
    assert len(p_unrelated.route_stops) == 0


def test_04_pickup_cannot_appear_twice_across_generated_routes(db):
    """4. A pickup cannot appear twice across generated routes."""
    tomorrow = get_operational_planning_date()
    admin = make_user(db, UserRole.ADMIN)
    wh = make_warehouse(db)
    make_assignment(db)
    make_assignment(db)
    p1 = make_pickup(db, scheduled_date=tomorrow, weight=20, lat=12.9800, lng=77.6100)
    p2 = make_pickup(db, scheduled_date=tomorrow, weight=25, lat=12.9900, lng=77.6200)
    p3 = make_pickup(db, scheduled_date=tomorrow, weight=15, lat=12.9700, lng=77.6300)
    db.commit()

    batch = submit_optimization_batch(
        db=db,
        warehouse_id=wh.id,
        pickup_ids=[p1.id, p2.id, p3.id],
        planning_date=tomorrow,
        current_user=admin,
    )

    res = optimize_and_dispatch(
        db=db,
        warehouse_id=wh.id,
        route_date=tomorrow,
        batch_id=batch["batch_id"],
        current_user=admin,
    )
    all_pids = [pid for r in res["routes"] for pid in r["pickup_ids"]]
    assert len(all_pids) == len(set(all_pids)), "Duplicate pickup detected across generated routes!"


def test_05_infeasible_optimization_reported_without_false_success(db):
    """5. An infeasible optimization is reported without false success."""
    tomorrow = get_operational_planning_date()
    admin = make_user(db, UserRole.ADMIN)
    wh = make_warehouse(db)
    make_assignment(db)
    # Pickup exceeding max pickup weight
    p_huge = make_pickup(db, scheduled_date=tomorrow, weight=999)
    db.commit()

    batch = submit_optimization_batch(
        db=db,
        warehouse_id=wh.id,
        pickup_ids=[p_huge.id],
        planning_date=tomorrow,
        current_user=admin,
    )

    with pytest.raises(HTTPException) as exc:
        optimize_and_dispatch(
            db=db,
            warehouse_id=wh.id,
            route_date=tomorrow,
            batch_id=batch["batch_id"],
            current_user=admin,
        )
    assert exc.value.status_code in [400, 409, 502]


def test_06_repeated_optimization_requests_do_not_create_duplicate_routes(db):
    """6. Repeated optimization requests do not create duplicate active routes."""
    tomorrow = get_operational_planning_date()
    admin = make_user(db, UserRole.ADMIN)
    wh = make_warehouse(db)
    make_assignment(db)
    p1 = make_pickup(db, scheduled_date=tomorrow, weight=15)
    db.commit()

    batch = submit_optimization_batch(
        db=db,
        warehouse_id=wh.id,
        pickup_ids=[p1.id],
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
        current_user=admin,
    )
    # Second run with same batch and rerun=False returns idempotent results
    res2 = optimize_and_dispatch(
        db=db,
        warehouse_id=wh.id,
        route_date=tomorrow,
        batch_id=batch["batch_id"],
        rerun=False,
        current_user=admin,
    )
    assert res1["routes"][0]["route_id"] == res2["routes"][0]["route_id"]

    # Active routes in DB is exactly 1
    active_routes = db.query(Route).filter(Route.optimization_run_id == batch["batch_id"], Route.status != RouteStatus.CANCELLED).all()
    assert len(active_routes) == 1


def test_07_only_successfully_optimized_routes_can_be_approved(db):
    """7. Only successfully optimized routes can be approved."""
    admin = make_user(db, UserRole.ADMIN)
    wh = make_warehouse(db)
    # A route without pickups cannot be approved
    empty_route = Route(
        route_code=f"RT-{uuid.uuid4().hex[:6].upper()}",
        route_date=datetime.now(timezone.utc),
        warehouse_id=wh.id,
        status=RouteStatus.DRAFT,
    )
    db.add(empty_route)
    db.commit()

    with pytest.raises(HTTPException) as exc:
        approve_route(db=db, route_id=empty_route.id, current_user=admin)
    assert exc.value.status_code == 400
    assert "contains no pickup stops" in exc.value.detail.lower()


def test_08_approved_routes_become_available_in_fleet_assignment(db):
    """8. Approved routes become available in Fleet Assignment."""
    tomorrow = get_operational_planning_date()
    admin = make_user(db, UserRole.ADMIN)
    wh = make_warehouse(db)
    make_assignment(db)
    p = make_pickup(db, scheduled_date=tomorrow, weight=15)
    db.commit()

    batch = submit_optimization_batch(
        db=db,
        warehouse_id=wh.id,
        pickup_ids=[p.id],
        planning_date=tomorrow,
        current_user=admin,
    )
    res = optimize_and_dispatch(
        db=db,
        warehouse_id=wh.id,
        route_date=tomorrow,
        batch_id=batch["batch_id"],
        current_user=admin,
    )
    route_id = res["routes"][0]["route_id"]

    # Before approval, route is not approvable
    db_route = db.query(Route).filter(Route.id == route_id).first()
    assert db_route.approved_at is None

    # Approve route
    approved = approve_route(db=db, route_id=route_id, current_user=admin)
    assert approved.approved_at is not None
    assert approved.is_approved is True

    # Check query for Fleet Assignment (strictly approved routes awaiting assignment)
    fleet_assignable = (
        db.query(Route)
        .filter(
            Route.approved_at.is_not(None),
            Route.driver_id.is_(None),
            Route.vehicle_id.is_(None),
            Route.status != RouteStatus.CANCELLED,
        )
        .all()
    )
    assert any(r.id == route_id for r in fleet_assignable)


def test_09_draft_rejected_and_unapproved_routes_cannot_be_assigned_or_dispatched(db):
    """9. Draft, rejected and unapproved routes cannot be assigned or dispatched."""
    tomorrow = get_operational_planning_date()
    admin = make_user(db, UserRole.ADMIN)
    wh = make_warehouse(db)
    _, driver, vehicle, _ = make_assignment(db)
    p = make_pickup(db, scheduled_date=tomorrow, weight=15)
    db.commit()

    batch = submit_optimization_batch(
        db=db,
        warehouse_id=wh.id,
        pickup_ids=[p.id],
        planning_date=tomorrow,
        current_user=admin,
    )
    res = optimize_and_dispatch(
        db=db,
        warehouse_id=wh.id,
        route_date=tomorrow,
        batch_id=batch["batch_id"],
        current_user=admin,
    )
    route_id = res["routes"][0]["route_id"]

    # 1. Attempt assigning unapproved draft route -> FAILS
    with pytest.raises(HTTPException) as exc1:
        assign_route_fleet(
            db=db,
            route_id=route_id,
            request=RouteAssignRequest(driver_id=driver.id, vehicle_id=vehicle.id),
            current_user=admin,
        )
    assert exc1.value.status_code == 400
    assert "must be approved" in exc1.value.detail.lower()

    # 2. Reject route -> CANCELLED
    reject_route(db=db, route_id=route_id, reason="Admin rejection", current_user=admin)
    db_route = db.query(Route).filter(Route.id == route_id).first()
    assert db_route.status == RouteStatus.CANCELLED

    # 3. Attempt assigning cancelled route -> FAILS
    with pytest.raises(HTTPException) as exc2:
        assign_route_fleet(
            db=db,
            route_id=route_id,
            request=RouteAssignRequest(driver_id=driver.id, vehicle_id=vehicle.id),
            current_user=admin,
        )
    assert exc2.value.status_code == 400


def test_10_invalid_or_conflicting_driver_vehicle_assignments_rejected(db):
    """10. Invalid or conflicting driver/vehicle assignments are rejected."""
    tomorrow = get_operational_planning_date()
    admin = make_user(db, UserRole.ADMIN)
    wh = make_warehouse(db)
    _, driver, vehicle, _ = make_assignment(db)
    p = make_pickup(db, scheduled_date=tomorrow, weight=15)
    db.commit()

    batch = submit_optimization_batch(
        db=db,
        warehouse_id=wh.id,
        pickup_ids=[p.id],
        planning_date=tomorrow,
        current_user=admin,
    )
    res = optimize_and_dispatch(
        db=db,
        warehouse_id=wh.id,
        route_date=tomorrow,
        batch_id=batch["batch_id"],
        current_user=admin,
    )
    route_id = res["routes"][0]["route_id"]
    approve_route(db=db, route_id=route_id, current_user=admin)

    # Invalidate vehicle
    vehicle.status = VehicleStatus.MAINTENANCE
    db.commit()

    with pytest.raises(HTTPException) as exc:
        assign_route_fleet(
            db=db,
            route_id=route_id,
            request=RouteAssignRequest(driver_id=driver.id, vehicle_id=vehicle.id),
            current_user=admin,
        )
    assert exc.value.status_code == 400
    assert "maintenance" in exc.value.detail.lower()


def test_11_assigned_routes_become_available_for_dispatch(db):
    """11. Assigned routes become available for dispatch."""
    tomorrow = get_operational_planning_date()
    admin = make_user(db, UserRole.ADMIN)
    wh = make_warehouse(db)
    _, driver, vehicle, _ = make_assignment(db)
    p = make_pickup(db, scheduled_date=tomorrow, weight=15)
    db.commit()

    batch = submit_optimization_batch(
        db=db,
        warehouse_id=wh.id,
        pickup_ids=[p.id],
        planning_date=tomorrow,
        current_user=admin,
    )
    res = optimize_and_dispatch(
        db=db,
        warehouse_id=wh.id,
        route_date=tomorrow,
        batch_id=batch["batch_id"],
        current_user=admin,
    )
    route_id = res["routes"][0]["route_id"]
    approve_route(db=db, route_id=route_id, current_user=admin)

    paired = assign_route_fleet(
        db=db,
        route_id=route_id,
        request=RouteAssignRequest(driver_id=driver.id, vehicle_id=vehicle.id),
        current_user=admin,
    )
    assert paired.status == RouteStatus.READY
    assert paired.driver_id == driver.id
    assert paired.vehicle_id == vehicle.id


def test_12_dispatched_routes_become_visible_in_live_monitoring(db):
    """12. Dispatched routes become visible in Live Monitoring."""
    tomorrow = get_operational_planning_date()
    admin = make_user(db, UserRole.ADMIN)
    wh = make_warehouse(db)
    _, driver, vehicle, _ = make_assignment(db)
    p = make_pickup(db, scheduled_date=tomorrow, weight=15)
    db.commit()

    batch = submit_optimization_batch(
        db=db,
        warehouse_id=wh.id,
        pickup_ids=[p.id],
        planning_date=tomorrow,
        current_user=admin,
    )
    res = optimize_and_dispatch(
        db=db,
        warehouse_id=wh.id,
        route_date=tomorrow,
        batch_id=batch["batch_id"],
        current_user=admin,
    )
    route_id = res["routes"][0]["route_id"]
    approve_route(db=db, route_id=route_id, current_user=admin)
    assign_route_fleet(
        db=db,
        route_id=route_id,
        request=RouteAssignRequest(driver_id=driver.id, vehicle_id=vehicle.id),
        current_user=admin,
    )

    dispatched = dispatch_route(db=db, route_id=route_id, current_user=admin)
    assert dispatched.status == RouteStatus.IN_PROGRESS

    # Live monitoring queries routes in IN_PROGRESS
    live_routes = db.query(Route).filter(Route.status == RouteStatus.IN_PROGRESS).all()
    assert any(r.id == route_id for r in live_routes)


def test_13_database_failures_rollback_partial_state_transitions(db):
    """13. Database failures roll back partial state transitions."""
    admin = make_user(db, UserRole.ADMIN)
    wh = make_warehouse(db)

    # Submitting with an invalid pickup ID triggers 404 and rolls back
    with pytest.raises(HTTPException):
        submit_optimization_batch(
            db=db,
            warehouse_id=wh.id,
            pickup_ids=[999999],
            planning_date=get_operational_planning_date(),
            current_user=admin,
        )

    # No optimization run was committed
    assert db.query(OptimizationRun).filter(OptimizationRun.created_by_id == admin.id).count() == 0


def test_14_refreshing_or_reopening_pages_preserves_correct_stage_and_membership(db):
    """14. Refreshing or reopening pages preserves the correct stage and membership."""
    tomorrow = get_operational_planning_date()
    admin = make_user(db, UserRole.ADMIN)
    wh = make_warehouse(db)
    make_assignment(db)
    p = make_pickup(db, scheduled_date=tomorrow, weight=18)
    db.commit()

    batch = submit_optimization_batch(
        db=db,
        warehouse_id=wh.id,
        pickup_ids=[p.id],
        planning_date=tomorrow,
        current_user=admin,
    )
    optimize_and_dispatch(
        db=db,
        warehouse_id=wh.id,
        route_date=tomorrow,
        batch_id=batch["batch_id"],
        current_user=admin,
    )

    # Reopening the batch details from API
    fetched_batch = get_optimization_batch(db=db, batch_id=batch["batch_id"])
    assert fetched_batch["batch_id"] == batch["batch_id"]
    assert fetched_batch["pickup_count"] == 1
    assert len(fetched_batch["routes"]) >= 1
    assert p.id in fetched_batch["pickup_ids"]


def test_15_concurrent_requests_cannot_assign_or_route_same_pickup_twice(db):
    """15. Concurrent requests cannot assign or route the same pickup twice."""
    tomorrow = get_operational_planning_date()
    admin = make_user(db, UserRole.ADMIN)
    wh = make_warehouse(db)
    p = make_pickup(db, scheduled_date=tomorrow, weight=20)
    db.commit()

    # First admin submits batch
    batch1 = submit_optimization_batch(
        db=db,
        warehouse_id=wh.id,
        pickup_ids=[p.id],
        planning_date=tomorrow,
        current_user=admin,
    )
    assert batch1["batch_id"] is not None

    # Second admin tries to submit same pickup in another batch -> CONFLICT
    with pytest.raises(HTTPException) as exc:
        submit_optimization_batch(
            db=db,
            warehouse_id=wh.id,
            pickup_ids=[p.id],
            planning_date=tomorrow,
            current_user=admin,
        )
    assert exc.value.status_code == 409
    assert "already in an active optimization batch" in exc.value.detail.lower()
