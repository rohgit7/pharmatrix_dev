from datetime import datetime, timezone
from uuid import uuid4
from app.core.config import settings
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.api.admin_disposal_shipments import (
    router as disposal_shipment_router,
)
from app.api.admin_pickups import router as admin_pickup_router
from app.api.admin_route_optimization import (
    router as route_optimization_router,
)
from app.api.admin_routes import router as admin_route_router
from app.api.admin_warehouse_intakes import (
    router as warehouse_intake_router,
)
from app.api.driver_route_execution import (
    router as driver_route_router,
)
from app.api.pickups import router as pickup_router

from app.core.auth import get_current_user
from app.core.database import get_db

from app.models.customer import Customer
from app.models.customer_location import CustomerLocation
from app.models.driver import Driver
from app.models.driver_vehicle_assignment import (
    DriverVehicleAssignment,
)
from app.models.enums import (
    CustomerType,
    DriverStatus,
    RouteStatus,
    UserRole,
    VehicleStatus,
    VehicleType,
)
from app.models.facility import Facility
from app.models.pickup import Pickup
from app.models.route import Route
from app.models.user import User
from app.models.vehicle import Vehicle
from app.models.warehouse import Warehouse

from app.services.configuration_service import create_configuration


# =========================================================
# Test application
# =========================================================

app = FastAPI()

app.include_router(pickup_router)
app.include_router(admin_pickup_router)
app.include_router(admin_route_router)
app.include_router(route_optimization_router)
app.include_router(driver_route_router)
app.include_router(warehouse_intake_router)
app.include_router(disposal_shipment_router)


# =========================================================
# Authentication / DB overrides
# =========================================================

current_user = None
test_db = None


def override_current_user():
    return current_user


def override_get_db():
    yield test_db


app.dependency_overrides[get_current_user] = override_current_user
app.dependency_overrides[get_db] = override_get_db

client = TestClient(app)


def set_role(user):
    global current_user
    current_user = user


# =========================================================
# E2E workflow
# =========================================================

def test_complete_operational_workflow(db):
    """
    Customer
        ↓
    Pickup request
        ↓
    Admin schedules pickup
        ↓
    Route optimization / dispatch
        ↓
    Driver starts route
        ↓
    Driver executes pickup
        ↓
    Warehouse intake
        ↓
    Disposal shipment
    """

    global test_db
    test_db = db

    # ---------------------------------------------------------
    # 1. Create users
    # ---------------------------------------------------------

    admin_user = User(
        auth_user_id=uuid4(),
        name="E2E Admin",
        email="e2e.admin@example.com",
        role=UserRole.ADMIN,
        is_active=True,
    )

    customer_user = User(
        auth_user_id=uuid4(),
        name="E2E Customer",
        email="e2e.customer@example.com",
        role=UserRole.CUSTOMER,
        is_active=True,
    )

    driver_user = User(
        auth_user_id=uuid4(),
        name="E2E Driver",
        email="e2e.driver@example.com",
        role=UserRole.DRIVER,
        is_active=True,
    )

    facility_user = User(
        auth_user_id=uuid4(),
        name="E2E Facility",
        email="e2e.facility@example.com",
        role=UserRole.FACILITY,
        is_active=True,
    )

    db.add_all(
        [
            admin_user,
            customer_user,
            driver_user,
            facility_user,
        ]
    )

    db.flush()

    # ---------------------------------------------------------
    # 2. Create customer
    # ---------------------------------------------------------

    customer = Customer(
        user_id=customer_user.id,
        customer_type=CustomerType.PHARMACY,
        legal_name="E2E Pharmacy Pvt Ltd",
        display_name="E2E Pharmacy",
        phone="9000000001",
        email=customer_user.email,
        is_active=True,
    )

    db.add(customer)
    db.flush()

    # ---------------------------------------------------------
    # 3. Create customer pickup location
    # ---------------------------------------------------------

    location = CustomerLocation(
        customer_id=customer.id,
        location_code="E2E-LOC-001",
        name="E2E Pharmacy Location",
        address_line_1="1 Test Street",
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

    # ---------------------------------------------------------
    # 4. Create warehouse
    # ---------------------------------------------------------

    warehouse = Warehouse(
        code="E2E-WH-001",
        name="E2E Warehouse",
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

    # ---------------------------------------------------------
    # 5. Create driver
    # ---------------------------------------------------------

    driver = Driver(
        user_id=driver_user.id,
        employee_id="E2E-DRV-001",
        phone="9000000002",
        license_number="E2E-LIC-001",
        status=DriverStatus.ACTIVE,
        is_available=True,
    )

    db.add(driver)
    db.flush()

    # ---------------------------------------------------------
    # 6. Create vehicle
    # ---------------------------------------------------------

    vehicle = Vehicle(
        registration_number="KA01E2E0001",
        vehicle_type=list(VehicleType)[0],
        capacity_kg=1000,
        status=VehicleStatus.AVAILABLE,
    )

    db.add(vehicle)
    db.flush()

    # ---------------------------------------------------------
    # 7. Assign vehicle to driver
    # ---------------------------------------------------------

    driver_vehicle_assignment = DriverVehicleAssignment(
        driver_id=driver.id,
        vehicle_id=vehicle.id,
        assigned_at=datetime.now(timezone.utc),
    )

    db.add(driver_vehicle_assignment)
    db.flush()

    # ---------------------------------------------------------
    # 8. Create disposal facility
    # ---------------------------------------------------------

    facility = Facility(
        user_id=facility_user.id,
        facility_code="E2E-FAC-001",
        legal_name="E2E Disposal Facility",
        phone="9000000003",
        email=facility_user.email,
        license_number="E2E-FAC-LIC-001",
        address="Facility Road",
        city="Bengaluru",
        state="Karnataka",
        postal_code="560002",
        latitude=12.9800,
        longitude=77.6000,
        active=True,
    )

    db.add(facility)

    # ---------------------------------------------------------
    # 9. Create required configuration
    # ---------------------------------------------------------

# ---------------------------------------------------------
# 9. Create required configuration
# ---------------------------------------------------------

    create_configuration(
        db,
        key="operations.max_pickup_weight_kg",
        value=50,
        data_type="INTEGER",
        created_by=admin_user.id,
        reason="E2E workflow test",
    )

    create_configuration(
        db,
        key="logistics.max_route_distance_km",
        value=100,
        data_type="INTEGER",
        created_by=admin_user.id,
        reason="E2E workflow test",
    )

    create_configuration(
        db,
        key="logistics.max_route_duration_minutes",
        value=480,
        data_type="INTEGER",
        created_by=admin_user.id,
        reason="E2E workflow test",
    )
    create_configuration(
        db,
        key="logistics.optimizer_time_limit_seconds",
        value=30,
        data_type="INTEGER",
        created_by=admin_user.id,
        reason="E2E workflow test",
    )
    create_configuration(
        db,
        key="weight.collection_tolerance",
        value=5,
        data_type="DECIMAL",
        created_by=admin_user.id,
        reason="E2E workflow test",
    )


    db.commit()

    # ---------------------------------------------------------
    # 10. Customer creates pickup
    # ---------------------------------------------------------

    set_role(customer_user)

    route_date = datetime.now(timezone.utc)

    pickup_response = client.post(
        "/api/pickups/",
        json={
            "location_id": location.id,
            "requested_date": route_date.isoformat(),
            "estimated_weight_kg": 25,
            "notes": "E2E workflow pickup",
        },
    )

    assert pickup_response.status_code == 201, (
        pickup_response.text
    )

    pickup_data = pickup_response.json()
    pickup_id = pickup_data["id"]

    # ---------------------------------------------------------
    # 11. Admin schedules pickup
    # ---------------------------------------------------------

    set_role(admin_user)

    schedule_response = client.post(
        f"/api/admin/pickups/{pickup_id}/schedule",
        json={
            "scheduled_date": route_date.isoformat(),
        },
    )

    assert schedule_response.status_code == 200, (
        schedule_response.text
    )

    scheduled_pickup = schedule_response.json()

    assert scheduled_pickup["id"] == pickup_id
    assert scheduled_pickup["status"] == "SCHEDULED"

    # ---------------------------------------------------------
    # 12. Admin optimizes and dispatches route
    # ---------------------------------------------------------
    settings.OSRM_BASE_URL = None
    optimize_response = client.post(
        "/api/admin/routes/optimize",
        json={
            "warehouse_id": warehouse.id,
            "route_date": route_date.isoformat(),
        },
    )

    assert optimize_response.status_code == 201, (
        optimize_response.text
    )

    optimization_data = optimize_response.json()

    assert optimization_data["routes_created"] == 1
    assert optimization_data["pickups_assigned"] == 1
    assert optimization_data["routes"]

    route_summary = optimization_data["routes"][0]

    route_id = route_summary["route_id"]

    assert route_summary["driver_id"] == driver.id
    assert route_summary["vehicle_id"] == vehicle.id

    # ---------------------------------------------------------
    # 13. Verify assigned route
    # ---------------------------------------------------------

    db.expire_all()

    route = db.get(Route, route_id)

    assert route is not None
    assert route.status == RouteStatus.ASSIGNED
    assert route.driver_id == driver.id
    assert route.vehicle_id == vehicle.id

    # ---------------------------------------------------------
    # 14. Verify pickup assignment
    # ---------------------------------------------------------

    pickup = db.get(Pickup, pickup_id)

    assert pickup is not None
    assert pickup.status.value == "ASSIGNED"

    # ---------------------------------------------------------
    # 15. Driver starts route
    # ---------------------------------------------------------

    set_role(driver_user)

    start_response = client.post(
        f"/api/driver/routes/{route_id}/start"
    )

    assert start_response.status_code == 200, (
        start_response.text
    )

    start_data = start_response.json()

    assert start_data["route_id"] == route_id
    assert start_data["status"] == "IN_PROGRESS"

    # ---------------------------------------------------------
    # 16. Verify route and driver state
    # ---------------------------------------------------------

    db.expire_all()

    route = db.get(Route, route_id)
    driver = db.get(Driver, driver.id)

    assert route is not None
    assert route.status == RouteStatus.IN_PROGRESS
    assert driver.is_available is False

    # ---------------------------------------------------------
    # 17. Get route stops
    # ---------------------------------------------------------

    assert route.stops
    assert len(route.stops) == 2

    pickup_stop = next(
        stop
        for stop in route.stops
        if stop.pickup_id == pickup_id
    )

    warehouse_stop = next(
        stop
        for stop in route.stops
        if stop.warehouse_id == warehouse.id
    )

    assert pickup_stop is not None
    assert warehouse_stop is not None

    # ---------------------------------------------------------
    # 18. Driver arrives at pickup
    # ---------------------------------------------------------

    arrive_response = client.post(
        f"/api/driver/routes/"
        f"{route_id}/stops/{pickup_stop.id}/arrive"
    )

    assert arrive_response.status_code == 200, (
        arrive_response.text
    )

    arrive_data = arrive_response.json()

    assert arrive_data["stop_id"] == pickup_stop.id
    assert arrive_data["status"] == "ARRIVED"

    # ---------------------------------------------------------
    # 19. Simulate pickup verification / proof
    # ---------------------------------------------------------

    now = datetime.now(timezone.utc)

    db.expire_all()

    pickup = db.get(Pickup, pickup_id)
    route = db.get(Route, route_id)

    pickup.qr_verified_at = now
    pickup.otp_verified_at = now

    pickup_stop = next(
        stop
        for stop in route.stops
        if stop.id == pickup_stop.id
    )

    pickup_stop.proof_storage_path = (
        "routes/e2e/proof.jpg"
    )

    db.commit()

    # ---------------------------------------------------------
    # 20. Driver completes pickup
    # ---------------------------------------------------------

    complete_response = client.post(
        f"/api/driver/routes/"
        f"{route_id}/stops/{pickup_stop.id}/complete",
        json={
            "collected_weight_kg": 20,
            "notes": "E2E pickup completed successfully",
        },
    )

    assert complete_response.status_code == 200, (
        complete_response.text
    )

    complete_data = complete_response.json()

    assert complete_data["stop_id"] == pickup_stop.id
    assert complete_data["status"] == "COMPLETED"

    # ---------------------------------------------------------
    # 21. Verify pickup was collected
    # ---------------------------------------------------------

    db.expire_all()

    pickup = db.get(Pickup, pickup_id)

    assert pickup is not None
    assert pickup.status.value == "COLLECTED"
    assert pickup.collected_at is not None

    # ---------------------------------------------------------
    # 22. Driver arrives at warehouse
    # ---------------------------------------------------------

    arrive_warehouse_response = client.post(
        f"/api/driver/routes/"
        f"{route_id}/stops/{warehouse_stop.id}/arrive"
    )

    assert arrive_warehouse_response.status_code == 200, (
        arrive_warehouse_response.text
    )

    warehouse_arrival_data = (
        arrive_warehouse_response.json()
    )

    assert warehouse_arrival_data["stop_id"] == (
        warehouse_stop.id
    )
    assert warehouse_arrival_data["status"] == "ARRIVED"

    # ---------------------------------------------------------
    # 23. Driver completes warehouse handover
    # ---------------------------------------------------------

    complete_warehouse_response = client.post(
        f"/api/driver/routes/"
        f"{route_id}/stops/{warehouse_stop.id}/complete",
        json={
            "collected_weight_kg": 20,
        },
    )

    assert complete_warehouse_response.status_code == 200, (
        complete_warehouse_response.text
    )

    warehouse_complete_data = (
        complete_warehouse_response.json()
    )

    assert warehouse_complete_data["stop_id"] == (
        warehouse_stop.id
    )
    assert warehouse_complete_data["status"] == "COMPLETED"