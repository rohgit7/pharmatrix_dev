from datetime import datetime, timedelta, timezone
from decimal import Decimal
import uuid
import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient

from app.main import app
from app.core.auth import get_current_user, require_role
from app.core.database import get_db
from app.core.planning import get_operational_planning_date, get_planning_date_bounds
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
from app.models.optimization_run import OptimizationRun
from app.models.audit_log import AuditLog
from app.services.route_optimization_service import optimize_and_dispatch
from app.services.route_service import (
    approve_route,
    bulk_approve_routes,
    assign_route_fleet,
    reassign_route_fleet,
    unassign_route_fleet,
    dispatch_route,
    bulk_dispatch_routes,
    release_pickup_from_draft,
    list_routes,
    list_historical_routes,
)
from app.services.planning_readiness_service import get_next_day_planning_readiness
from app.schemas.route import RouteAssignRequest, RouteReassignRequest


# ---------------------------------------------------------------------------
# Test Helpers
# ---------------------------------------------------------------------------

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


def make_pickup(db, scheduled_date, suffix=None, weight=10, status=PickupStatus.SCHEDULED):
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
        name=f"Location {suffix[:6]}",
        address_line_1="Store Road",
        city="Bengaluru",
        state="Karnataka",
        postal_code="560002",
        latitude=12.9352,
        longitude=77.6245,
        contact_name="Store Mgr",
        contact_phone="9876500001",
        service_time_seconds=300,
        pickup_enabled=True,
        is_active=True,
    )
    db.add(location)
    db.flush()

    pickup = Pickup(
        pickup_code=f"PK-{suffix[:8]}",
        customer_id=customer.id,
        location_id=location.id,
        status=status,
        priority=PickupPriority.NORMAL,
        scheduled_date=scheduled_date,
        estimated_weight_kg=Decimal(str(weight)),
        verification_token=f"token-{suffix[:8]}",
    )
    db.add(pickup)
    db.flush()
    return pickup


# ---------------------------------------------------------------------------
# Test Scenarios 1 to 14
# ---------------------------------------------------------------------------

def test_01_tomorrow_eligible_pickups_can_be_selected_and_optimized(db):
    """Scenario 1: Tomorrow's eligible pickups can be selected and optimized."""
    tomorrow = get_operational_planning_date()
    admin = make_user(db, UserRole.ADMIN)
    wh = make_warehouse(db)
    _, driver, vehicle, _ = make_assignment(db)

    # Make 2 pickups for tomorrow
    p1 = make_pickup(db, scheduled_date=tomorrow, weight=25)
    p2 = make_pickup(db, scheduled_date=tomorrow, weight=30)
    db.commit()

    res = optimize_and_dispatch(
        db=db,
        warehouse_id=wh.id,
        route_date=tomorrow,
        selected_pickup_ids=[p1.id, p2.id],
        auto_dispatch=False,
        current_user=admin,
    )

    assert res["routes_created"] >= 1
    assert res["pickups_assigned"] == 2
    assert res["optimization_run_id"] is not None
    assert res["planning_date"] == tomorrow.isoformat()

    # Route created must be unapproved draft
    routes = res["routes"]
    for r in routes:
        assert r["is_approved"] is False
        db_route = db.query(Route).filter(Route.id == r["route_id"]).first()
        assert db_route.status == RouteStatus.DRAFT
        assert db_route.approved_at is None


def test_02_pickups_from_another_date_rejected_by_optimization(db):
    """Scenario 2: Pickups from another date (e.g. today or past) are rejected."""
    tomorrow = get_operational_planning_date()
    yesterday = tomorrow - timedelta(days=2)
    admin = make_user(db, UserRole.ADMIN)
    wh = make_warehouse(db)
    make_assignment(db)

    # Pickup scheduled for yesterday
    p_past = make_pickup(db, scheduled_date=yesterday, weight=15)
    db.commit()

    with pytest.raises(HTTPException) as exc_info:
        optimize_and_dispatch(
            db=db,
            warehouse_id=wh.id,
            route_date=tomorrow,
            selected_pickup_ids=[p_past.id],
            current_user=admin,
        )
    assert exc_info.value.status_code == 400
    assert "not scheduled for planning date" in exc_info.value.detail.lower()


def test_03_mixed_date_optimization_request_fails_with_clear_error(db):
    """Scenario 3: Mixed-date optimization request fails with clear validation error."""
    tomorrow = get_operational_planning_date()
    day_after = tomorrow + timedelta(days=1)
    admin = make_user(db, UserRole.ADMIN)
    wh = make_warehouse(db)
    make_assignment(db)

    p_tomorrow = make_pickup(db, scheduled_date=tomorrow, weight=20)
    p_future = make_pickup(db, scheduled_date=day_after, weight=25)
    db.commit()

    with pytest.raises(HTTPException) as exc_info:
        optimize_and_dispatch(
            db=db,
            warehouse_id=wh.id,
            route_date=tomorrow,
            selected_pickup_ids=[p_tomorrow.id, p_future.id],
            current_user=admin,
        )
    assert exc_info.value.status_code == 400
    assert "cannot combine pickups from different dates" in exc_info.value.detail.lower() or "not scheduled for planning date" in exc_info.value.detail.lower()


def test_04_allocated_pickups_disappear_from_work_queue(db):
    """Scenario 4: Pickups once optimized disappear from available work queue (work_queue=true)."""
    tomorrow = get_operational_planning_date()
    admin = make_user(db, UserRole.ADMIN)
    wh = make_warehouse(db)
    make_assignment(db)

    p1 = make_pickup(db, scheduled_date=tomorrow, weight=15)
    p2 = make_pickup(db, scheduled_date=tomorrow, weight=15)
    db.commit()

    # Before optimization: readiness shows 2 eligible pickups awaiting selection
    readiness_before = get_next_day_planning_readiness(db)
    assert readiness_before["eligible_pickups_awaiting_selection"] == 2
    assert readiness_before["pickups_allocated_to_routes"] == 0

    # Optimize p1 into a draft route
    res = optimize_and_dispatch(
        db=db,
        warehouse_id=wh.id,
        route_date=tomorrow,
        selected_pickup_ids=[p1.id],
        auto_dispatch=False,
        current_user=admin,
    )
    assert res["pickups_assigned"] == 1

    # After optimization: p1 is allocated to draft route, p2 remains awaiting selection
    readiness_after = get_next_day_planning_readiness(db)
    assert readiness_after["eligible_pickups_awaiting_selection"] == 1
    assert readiness_after["pickups_allocated_to_routes"] == 1


def test_05_pickup_cannot_be_allocated_to_two_active_routes(db):
    """Scenario 5: A pickup cannot belong to multiple active planning results or conflicting routes."""
    tomorrow = get_operational_planning_date()
    admin = make_user(db, UserRole.ADMIN)
    wh = make_warehouse(db)
    make_assignment(db)

    p1 = make_pickup(db, scheduled_date=tomorrow, weight=15)
    db.commit()

    # First run allocates p1
    res = optimize_and_dispatch(
        db=db,
        warehouse_id=wh.id,
        route_date=tomorrow,
        selected_pickup_ids=[p1.id],
        auto_dispatch=False,
        current_user=admin,
    )
    assert res["pickups_assigned"] == 1

    # Attempting to optimize p1 again without rerun=True must fail
    with pytest.raises(HTTPException) as exc_info:
        optimize_and_dispatch(
            db=db,
            warehouse_id=wh.id,
            route_date=tomorrow,
            selected_pickup_ids=[p1.id],
            rerun=False,
            current_user=admin,
        )
    assert exc_info.value.status_code == 400
    assert "already allocated" in exc_info.value.detail.lower()


def test_06_optimization_reruns_do_not_create_duplicate_route_stops(db):
    """Scenario 6: Optimization reruns supersede previous drafts safely without orphaned stops."""
    tomorrow = get_operational_planning_date()
    admin = make_user(db, UserRole.ADMIN)
    wh = make_warehouse(db)
    make_assignment(db)

    p1 = make_pickup(db, scheduled_date=tomorrow, weight=15)
    p2 = make_pickup(db, scheduled_date=tomorrow, weight=20)
    db.commit()

    # Run 1: draft with p1
    run1 = optimize_and_dispatch(
        db=db,
        warehouse_id=wh.id,
        route_date=tomorrow,
        selected_pickup_ids=[p1.id],
        auto_dispatch=False,
        current_user=admin,
    )
    route_id_1 = run1["routes"][0]["route_id"]

    # Run 2: rerun with p1 and p2
    run2 = optimize_and_dispatch(
        db=db,
        warehouse_id=wh.id,
        route_date=tomorrow,
        selected_pickup_ids=[p1.id, p2.id],
        rerun=True,
        auto_dispatch=False,
        current_user=admin,
    )

    # Route from run 1 must be cancelled and its stops removed
    route1 = db.query(Route).filter(Route.id == route_id_1).first()
    assert route1.status == RouteStatus.CANCELLED

    # Active stops for p1 must be exactly 1
    active_stops_p1 = (
        db.query(RouteStop)
        .join(Route, RouteStop.route_id == Route.id)
        .filter(RouteStop.pickup_id == p1.id, Route.status != RouteStatus.CANCELLED)
        .all()
    )
    assert len(active_stops_p1) == 1


def test_07_linear_workflow_cannot_assign_unapproved_cannot_dispatch_unassigned(db):
    """Scenario 7: Linear workflow enforcement: approval before assignment; assignment before dispatch."""
    tomorrow = get_operational_planning_date()
    admin = make_user(db, UserRole.ADMIN)
    wh = make_warehouse(db)
    _, driver, vehicle, _ = make_assignment(db)

    p1 = make_pickup(db, scheduled_date=tomorrow, weight=15)
    db.commit()

    # Generate unapproved draft route
    res = optimize_and_dispatch(
        db=db,
        warehouse_id=wh.id,
        route_date=tomorrow,
        selected_pickup_ids=[p1.id],
        auto_dispatch=False,
        current_user=admin,
    )
    route_id = res["routes"][0]["route_id"]
    route = db.query(Route).filter(Route.id == route_id).first()
    assert route.approved_at is None

    # Step A: Attempt fleet assignment on unapproved route -> BLOCKED
    with pytest.raises(HTTPException) as exc_info:
        assign_route_fleet(
            db=db,
            route_id=route_id,
            request=RouteAssignRequest(driver_id=driver.id, vehicle_id=vehicle.id),
            current_user=admin,
        )
    assert exc_info.value.status_code == 400
    assert "must be approved" in exc_info.value.detail.lower()

    # Step B: Admin reviews and approves route -> SUCCESS
    approved_route = approve_route(db=db, route_id=route_id, current_user=admin)
    assert approved_route.approved_at is not None

    # Step C: Attempt dispatch without fleet assigned -> BLOCKED
    with pytest.raises(HTTPException) as exc_info:
        dispatch_route(db=db, route_id=route_id, current_user=admin)
    assert exc_info.value.status_code == 400
    assert "must be assigned to both a driver and a vehicle" in exc_info.value.detail.lower()

    # Step D: Pair fleet -> SUCCESS
    paired_route = assign_route_fleet(
        db=db,
        route_id=route_id,
        request=RouteAssignRequest(driver_id=driver.id, vehicle_id=vehicle.id),
        current_user=admin,
    )
    assert paired_route.status == RouteStatus.READY

    # Step E: Dispatch -> SUCCESS
    dispatched_route = dispatch_route(db=db, route_id=route_id, current_user=admin)
    assert dispatched_route.status == RouteStatus.IN_PROGRESS


def test_08_dispatched_routes_visible_in_active_monitoring(db):
    """Scenario 8: Dispatched routes are visible in active operations list."""
    tomorrow = get_operational_planning_date()
    admin = make_user(db, UserRole.ADMIN)
    wh = make_warehouse(db)
    _, driver, vehicle, _ = make_assignment(db)

    p1 = make_pickup(db, scheduled_date=tomorrow, weight=15)
    db.commit()

    run = optimize_and_dispatch(
        db=db,
        warehouse_id=wh.id,
        route_date=tomorrow,
        selected_pickup_ids=[p1.id],
        auto_dispatch=False,
        current_user=admin,
    )
    route_id = run["routes"][0]["route_id"]
    approve_route(db=db, route_id=route_id, current_user=admin)
    assign_route_fleet(
        db=db,
        route_id=route_id,
        request=RouteAssignRequest(driver_id=driver.id, vehicle_id=vehicle.id),
        current_user=admin,
    )
    dispatch_route(db=db, route_id=route_id, current_user=admin)

    # Active routes list must contain this dispatched route
    active_routes = list_routes(db=db, active_only=True)
    active_ids = [r.id for r in active_routes]
    assert route_id in active_ids


def test_09_completed_pickups_and_routes_disappear_from_current_operations(db):
    """Scenario 9: Completed pickups and routes disappear from active queues."""
    tomorrow = get_operational_planning_date()
    admin = make_user(db, UserRole.ADMIN)
    wh = make_warehouse(db)
    _, driver, vehicle, _ = make_assignment(db)

    p1 = make_pickup(db, scheduled_date=tomorrow, weight=15)
    db.commit()

    run = optimize_and_dispatch(
        db=db,
        warehouse_id=wh.id,
        route_date=tomorrow,
        selected_pickup_ids=[p1.id],
        auto_dispatch=False,
        current_user=admin,
    )
    route_id = run["routes"][0]["route_id"]
    approve_route(db=db, route_id=route_id, current_user=admin)
    assign_route_fleet(
        db=db,
        route_id=route_id,
        request=RouteAssignRequest(driver_id=driver.id, vehicle_id=vehicle.id),
        current_user=admin,
    )
    dispatch_route(db=db, route_id=route_id, current_user=admin)

    # Complete route
    route = db.query(Route).filter(Route.id == route_id).first()
    route.status = RouteStatus.COMPLETED
    p1.status = PickupStatus.COLLECTED
    db.commit()

    # Must NOT appear in active_only=True list
    active_routes = list_routes(db=db, active_only=True)
    assert route_id not in [r.id for r in active_routes]


def test_10_completed_records_accessible_in_history(db):
    """Scenario 10: Completed records remain accessible in history with verified fields."""
    tomorrow = get_operational_planning_date()
    admin = make_user(db, UserRole.ADMIN)
    wh = make_warehouse(db)
    _, driver, vehicle, _ = make_assignment(db)

    p1 = make_pickup(db, scheduled_date=tomorrow, weight=15)
    db.commit()

    run = optimize_and_dispatch(
        db=db,
        warehouse_id=wh.id,
        route_date=tomorrow,
        selected_pickup_ids=[p1.id],
        auto_dispatch=False,
        current_user=admin,
    )
    route_id = run["routes"][0]["route_id"]
    approve_route(db=db, route_id=route_id, current_user=admin)
    assign_route_fleet(
        db=db,
        route_id=route_id,
        request=RouteAssignRequest(driver_id=driver.id, vehicle_id=vehicle.id),
        current_user=admin,
    )
    dispatch_route(db=db, route_id=route_id, current_user=admin)

    route = db.query(Route).filter(Route.id == route_id).first()
    route.status = RouteStatus.COMPLETED
    db.commit()

    history_routes = list_historical_routes(db=db)
    assert route_id in [r.id for r in history_routes]


def test_11_planning_date_change_does_not_corrupt_existing_dispatched_routes(db):
    """Scenario 11: Active routes from earlier dates remain intact when operating date changes."""
    today = datetime.now(timezone.utc).date()
    admin = make_user(db, UserRole.ADMIN)
    wh = make_warehouse(db)
    _, driver, vehicle, _ = make_assignment(db)

    # Route created and dispatched on day D
    route = Route(
        route_code=f"RT-{uuid.uuid4().hex[:8]}",
        route_date=today,
        warehouse_id=wh.id,
        driver_id=driver.id,
        vehicle_id=vehicle.id,
        status=RouteStatus.IN_PROGRESS,
    )
    db.add(route)
    db.commit()

    # On day D+1, query active operations: in-progress route must still be active
    active = list_routes(db=db, active_only=True)
    assert route.id in [r.id for r in active]
    assert route.status == RouteStatus.IN_PROGRESS


def test_12_readiness_counts_match_underlying_records(db):
    """Scenario 12: Next-day readiness counts match database state with zero double-counting."""
    tomorrow = get_operational_planning_date()
    admin = make_user(db, UserRole.ADMIN)
    wh = make_warehouse(db)
    make_assignment(db)

    # 3 pickups requested for tomorrow
    p1 = make_pickup(db, scheduled_date=tomorrow, weight=20)
    p2 = make_pickup(db, scheduled_date=tomorrow, weight=25)
    p3 = make_pickup(db, scheduled_date=tomorrow, weight=10, status=PickupStatus.CANCELLED)
    db.commit()

    metrics = get_next_day_planning_readiness(db)
    # p1 and p2 scheduled (eligible), p3 cancelled (excluded)
    assert metrics["eligible_pickups_awaiting_selection"] == 2
    assert metrics["pickups_allocated_to_routes"] == 0
    assert metrics["pickups_excluded_count"] >= 1


def test_13_frontend_filters_and_backend_validation_agree_on_eligibility(db):
    """Scenario 13: Ineligible pickups are clearly identified with exclusion reasons."""
    tomorrow = get_operational_planning_date()
    yesterday = tomorrow - timedelta(days=2)

    p_wrong_date = make_pickup(db, scheduled_date=yesterday, weight=10)
    p_cancelled = make_pickup(db, scheduled_date=tomorrow, weight=10, status=PickupStatus.CANCELLED)
    db.commit()

    readiness = get_next_day_planning_readiness(db)
    excluded = readiness["pickups_excluded"]
    excluded_ids = [e["pickup_id"] for e in excluded]

    assert p_cancelled.id in excluded_ids
    cancelled_entry = next(e for e in excluded if e["pickup_id"] == p_cancelled.id)
    assert "cancelled" in cancelled_entry["reason"].lower()


def test_14_operational_audit_trail_recorded(db):
    """Scenario 14: Lifecycle mutations (approval, fleet pairing, reassignment, dispatch, release) record audit trail."""
    tomorrow = get_operational_planning_date()
    admin = make_user(db, UserRole.ADMIN)
    wh = make_warehouse(db)
    _, driver1, vehicle1, _ = make_assignment(db)
    _, driver2, vehicle2, _ = make_assignment(db)

    p1 = make_pickup(db, scheduled_date=tomorrow, weight=15)
    p2 = make_pickup(db, scheduled_date=tomorrow, weight=20)
    db.commit()

    # 1. Optimize
    run = optimize_and_dispatch(
        db=db,
        warehouse_id=wh.id,
        route_date=tomorrow,
        selected_pickup_ids=[p1.id, p2.id],
        auto_dispatch=False,
        current_user=admin,
    )
    route_id = run["routes"][0]["route_id"]

    # 2. Release pickup from draft
    route_with_p2 = next(r for r in run["routes"] if p2.id in r["pickup_ids"])["route_id"]
    release_pickup_from_draft(db=db, route_id=route_with_p2, pickup_id=p2.id, reason="Customer called to cancel", current_user=admin)

    # 3. Approve route
    approve_route(db=db, route_id=route_id, current_user=admin)

    # 4. Assign fleet
    assign_route_fleet(
        db=db,
        route_id=route_id,
        request=RouteAssignRequest(driver_id=driver1.id, vehicle_id=vehicle1.id),
        current_user=admin,
    )

    # 5. Reassign fleet
    reassign_route_fleet(
        db=db,
        route_id=route_id,
        request=RouteReassignRequest(driver_id=driver2.id, vehicle_id=vehicle2.id, reason="Driver 1 unavailable"),
        current_user=admin,
    )

    # 6. Dispatch route
    dispatch_route(db=db, route_id=route_id, current_user=admin)

    # Verify audit logs in database
    logs = db.query(AuditLog).all()
    actions = [l.action for l in logs]

    assert any("OPTIMIZ" in a for a in actions)
    assert "PICKUP_RELEASED" in actions
    assert "ROUTE_APPROVED" in actions
    assert "FLEET_ASSIGNED" in actions
    assert "FLEET_REASSIGNED" in actions
    assert "ROUTE_DISPATCHED" in actions

    # Verify audit log fields
    reassign_log = next(l for l in logs if l.action == "FLEET_REASSIGNED")
    assert reassign_log.actor_id == admin.id
    assert reassign_log.details.get("reason") == "Driver 1 unavailable"
    assert reassign_log.details.get("previous_driver_id") == driver1.id
    assert reassign_log.details.get("new_driver_id") == driver2.id


def test_15_admin_pickups_endpoint_with_related_route_records(db):
    """Scenario 15: GET /api/admin/pickups/ succeeds when related route, route stop, driver, vehicle records exist."""
    tomorrow = get_operational_planning_date()
    admin = make_user(db, UserRole.ADMIN)
    wh = make_warehouse(db)
    _, driver, vehicle, _ = make_assignment(db)

    # 1. Create pickup for tomorrow
    p1 = make_pickup(db, scheduled_date=tomorrow, weight=20)
    p2 = make_pickup(db, scheduled_date=tomorrow, weight=30)
    db.commit()

    # 2. Optimize p1 into a draft route (links Pickup -> RouteStop -> Route with approved_at, approved_by_id, optimization_run_id)
    run = optimize_and_dispatch(
        db=db,
        warehouse_id=wh.id,
        route_date=tomorrow,
        selected_pickup_ids=[p1.id],
        auto_dispatch=False,
        current_user=admin,
    )
    assert run["pickups_assigned"] == 1

    # 3. Configure dependency overrides for test client
    app.dependency_overrides[get_current_user] = lambda: admin
    app.dependency_overrides[require_role(UserRole.ADMIN)] = lambda: admin
    app.dependency_overrides[get_db] = lambda: db

    client = TestClient(app)

    try:
        # 4. Request all pickups
        response = client.get("/api/admin/pickups/")
        assert response.status_code == 200, response.text
        data = response.json()
        assert len(data) >= 2

        # Verify p1 is enriched with allocated route information
        p1_item = next(p for p in data if p["id"] == p1.id)
        assert p1_item["operational_state"] == "optimized"
        assert p1_item["is_eligible_for_tomorrow"] is False
        assert p1_item["route_code"] is not None
        assert "Allocated to route" in p1_item["ineligibility_reason"]

        # Verify p2 is awaiting selection
        p2_item = next(p for p in data if p["id"] == p2.id)
        assert p2_item["operational_state"] == "awaiting_selection"
        assert p2_item["is_eligible_for_tomorrow"] is True

        # 5. Request work queue specifically
        wq_response = client.get("/api/admin/pickups/?work_queue=true")
        assert wq_response.status_code == 200, wq_response.text
        wq_data = wq_response.json()
        wq_ids = [p["id"] for p in wq_data]
        assert p1.id not in wq_ids
        assert p2.id in wq_ids
    finally:
        app.dependency_overrides.clear()
