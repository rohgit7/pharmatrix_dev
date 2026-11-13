import pytest
from datetime import datetime, timedelta, timezone
from uuid import uuid4
from decimal import Decimal
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.core.database import Base
from app.models.customer import Customer
from app.models.customer_location import CustomerLocation
from app.models.driver import Driver
from app.models.enums import (
    CustomerType,
    DriverStatus,
    PickupPriority,
    PickupStatus,
    RouteStatus,
    RouteStopStatus,
    RouteStopType,
    UserRole,
)
from app.models.event import PickupEvent
from app.models.invoice import Invoice
from app.models.pickup import Pickup
from app.models.route import Route
from app.models.route_stop import RouteStop
from app.models.user import User
from app.models.vehicle import Vehicle
from app.services.pickup_event_service import (
    get_chronological_pickup_events,
    record_pickup_event,
)
from app.services.pickup_monitoring_service import (
    compute_lifecycle_timeline,
    compute_pickup_exceptions_and_delays,
    get_driver_live_location_for_pickup,
    haversine_distance_m,
    build_pickup_monitoring_detail,
)


@pytest.fixture
def sqlite_db():
    from app.models.audit_log import AuditLog
    from sqlalchemy import event

    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
    )

    @event.listens_for(engine, "connect")
    def register_sqlite_functions(dbapi_connection, connection_record):
        dbapi_connection.create_function("gen_random_uuid", 0, lambda: uuid4().hex)

    # Create only the tables required for pickup lifecycle testing
    tables = [
        User.__table__,
        Customer.__table__,
        CustomerLocation.__table__,
        Driver.__table__,
        Vehicle.__table__,
        Route.__table__,
        Pickup.__table__,
        RouteStop.__table__,
        PickupEvent.__table__,
        AuditLog.__table__,
    ]
    for table in tables:
        table.create(engine, checkfirst=True)

    Session = sessionmaker(bind=engine)
    session = Session()

    yield session

    session.close()
    for table in reversed(tables):
        table.drop(engine, checkfirst=True)


def create_mock_customer(db, user, name="Apollo Pharmacy", ctype=CustomerType.PHARMACY):
    cust_code = f"CUST-{uuid4().hex[:6].upper()}"
    customer = Customer(
        user_id=user.id,
        public_id=uuid4(),
        legal_name=f"{name} Private Limited",
        customer_code=cust_code,
        display_name=name,
        customer_type=ctype,
        phone="9876543210",
        is_active=True,
    )
    db.add(customer)
    db.commit()
    return customer


def create_mock_location(db, customer, name="Indiranagar Facility", lat=12.9784, lng=77.6408):
    loc_code = f"LOC-{uuid4().hex[:6].upper()}"
    loc = CustomerLocation(
        customer_id=customer.id,
        location_code=loc_code,
        name=name,
        address_line_1="100ft Road",
        city="Bangalore",
        state="Karnataka",
        postal_code="560038",
        latitude=lat,
        longitude=lng,
    )
    db.add(loc)
    db.commit()
    return loc


def test_haversine_distance():
    # Bangalore MG Road (12.9716, 77.5946) to Indiranagar (12.9784, 77.6408) is ~5 km
    dist = haversine_distance_m(12.9716, 77.5946, 12.9784, 77.6408)
    assert 4800 < dist < 5300


def test_compute_lifecycle_timeline_requested(sqlite_db):
    user = User(auth_user_id=uuid4(), email="test@pharma.com", role=UserRole.CUSTOMER, name="Apollo Pharmacy")
    sqlite_db.add(user)
    sqlite_db.commit()

    customer = create_mock_customer(sqlite_db, user, name="Apollo Pharmacy", ctype=CustomerType.PHARMACY)

    loc = create_mock_location(sqlite_db, customer, name="Apollo Indiranagar", lat=12.9784, lng=77.6408)

    pickup = Pickup(
        customer_id=customer.id,
        location_id=loc.id,
        pickup_code="PK-TEST0001",
        verification_token="token123",
        status=PickupStatus.REQUESTED,
        priority=PickupPriority.NORMAL,
        estimated_weight_kg=10.0,
    )
    sqlite_db.add(pickup)
    sqlite_db.commit()
    sqlite_db.refresh(pickup)

    stages, progress_pct, current_stage = compute_lifecycle_timeline(
        pickup=pickup,
        route_stop=None,
        route=None,
        invoice=None,
        payment=None,
    )

    assert len(stages) == 11
    assert stages[0].stage_id == "REQUESTED"
    assert stages[0].state == "COMPLETED"
    assert stages[1].stage_id == "SCHEDULED"
    assert stages[1].state == "CURRENT"
    assert progress_pct >= 9  # 1 of 11 stages completed
    assert current_stage == "Pickup Scheduled"


def test_compute_lifecycle_timeline_collected_completed(sqlite_db):
    now = datetime.now(timezone.utc)
    user = User(auth_user_id=uuid4(), email="hosp@pharma.com", role=UserRole.CUSTOMER, name="Manipal Hospital")
    sqlite_db.add(user)
    sqlite_db.commit()

    customer = create_mock_customer(sqlite_db, user, name="Manipal Hospital", ctype=CustomerType.HOSPITAL)

    loc = create_mock_location(sqlite_db, customer, name="Manipal HAL", lat=12.9584, lng=77.6565)

    pickup = Pickup(
        customer_id=customer.id,
        location_id=loc.id,
        pickup_code="PK-TEST0002",
        verification_token="token456",
        status=PickupStatus.COLLECTED,
        priority=PickupPriority.HIGH,
        estimated_weight_kg=15.0,
        scheduled_date=now,
        collected_at=now,
        qr_verified_at=now,
        otp_verified_at=now,
    )
    sqlite_db.add(pickup)
    sqlite_db.commit()

    stages, progress_pct, current_stage = compute_lifecycle_timeline(
        pickup=pickup,
        route_stop=None,
        route=None,
        invoice=None,
        payment=None,
    )

    assert progress_pct == 100
    assert current_stage == "Completed"
    for stage in stages:
        assert stage.state == "COMPLETED"


def test_compute_lifecycle_timeline_cancelled(sqlite_db):
    pickup = Pickup(
        customer_id=1,
        location_id=1,
        pickup_code="PK-TEST0003",
        verification_token="token789",
        status=PickupStatus.CANCELLED,
        priority=PickupPriority.NORMAL,
        failure_reason="Customer facility closed for deep sanitation",
    )

    stages, progress_pct, current_stage = compute_lifecycle_timeline(
        pickup=pickup,
        route_stop=None,
        route=None,
        invoice=None,
        payment=None,
    )

    assert progress_pct == 0
    assert current_stage == "Cancelled"
    assert any(s.state == "CANCELLED" for s in stages)


def test_compute_exceptions_and_delays():
    now = datetime.now(timezone.utc)
    # Pickup scheduled 2 hours ago but status is still REQUESTED and no driver
    pickup = Pickup(
        customer_id=1,
        location_id=1,
        pickup_code="PK-DELAY01",
        verification_token="tok",
        status=PickupStatus.SCHEDULED,
        priority=PickupPriority.NORMAL,
        scheduled_date=now - timedelta(hours=2),
        estimated_weight_kg=10.0,
    )

    is_delayed, reasons, _ = compute_pickup_exceptions_and_delays(
        pickup=pickup,
        route_stop=None,
        route=None,
        invoice=None,
        now=now,
    )

    assert is_delayed is True
    assert len(reasons) > 0
    assert any("elapsed" in r.lower() or "overdue" in r.lower() for r in reasons)


def test_compute_weight_discrepancy_alert():
    now = datetime.now(timezone.utc)
    pickup = Pickup(
        customer_id=1,
        location_id=1,
        pickup_code="PK-DISCREPANCY01",
        verification_token="tok",
        status=PickupStatus.IN_PROGRESS,
        priority=PickupPriority.NORMAL,
        scheduled_date=now,
        estimated_weight_kg=10.0,
    )
    stop = RouteStop(
        route_id=1,
        sequence_number=1,
        stop_type=RouteStopType.PICKUP,
        execution_status=RouteStopStatus.IN_PROGRESS,
        collected_weight_kg=18.5,  # 85% discrepancy
    )

    is_delayed, reasons, _ = compute_pickup_exceptions_and_delays(
        pickup=pickup,
        route_stop=stop,
        route=None,
        invoice=None,
        now=now,
    )

    assert any("weight discrepancy" in r.lower() for r in reasons)


def test_pickup_event_recording_and_chronology(sqlite_db):
    user = User(auth_user_id=uuid4(), email="admin@pharma.com", role=UserRole.ADMIN, name="Admin Controller")
    sqlite_db.add(user)
    sqlite_db.commit()

    customer = create_mock_customer(sqlite_db, user, name="Test Clinic", ctype=CustomerType.CLINIC)

    loc = create_mock_location(sqlite_db, customer, name="Test Loc", lat=12.9716, lng=77.5946)

    pickup = Pickup(
        customer_id=customer.id,
        location_id=loc.id,
        pickup_code="PK-EVENT-TEST",
        verification_token="tok1",
        status=PickupStatus.REQUESTED,
        priority=PickupPriority.NORMAL,
    )
    sqlite_db.add(pickup)
    sqlite_db.commit()

    # Record two events
    t1 = datetime(2026, 11, 13, 10, 0, tzinfo=timezone.utc)
    t2 = datetime(2026, 11, 13, 10, 30, tzinfo=timezone.utc)

    record_pickup_event(
        db=sqlite_db,
        pickup_id=pickup.id,
        event_type="PICKUP_SCHEDULED",
        title="Pickup Scheduled",
        description="Scheduled for 14:00",
        actor_type="ADMIN",
        actor_id=user.id,
        actor_name=user.name,
        created_at=t1,
    )

    record_pickup_event(
        db=sqlite_db,
        pickup_id=pickup.id,
        event_type="DRIVER_ASSIGNED",
        title="Driver Assigned",
        description="Assigned to Driver DRV-01",
        actor_type="ADMIN",
        actor_id=user.id,
        actor_name=user.name,
        created_at=t2,
    )
    sqlite_db.commit()

    events = get_chronological_pickup_events(sqlite_db, pickup)
    assert len(events) >= 2
    # Verify chronological ordering
    timestamps = [e["created_at"] for e in events]
    assert timestamps == sorted(timestamps)


def test_driver_live_location_unavailable_and_available(sqlite_db):
    user = User(auth_user_id=uuid4(), email="driver@pharma.com", role=UserRole.DRIVER, name="Ramesh Driver")
    sqlite_db.add(user)
    sqlite_db.commit()

    driver = Driver(
        user_id=user.id,
        employee_id="DRV-001",
        phone="9876543210",
        license_number="DL-001",
        status=DriverStatus.ACTIVE,
        is_available=True,
    )
    sqlite_db.add(driver)

    vehicle = Vehicle(
        registration_number="KA-01-AB-1234",
        vehicle_type="VAN",
        capacity_kg=Decimal("1000.00"),
    )
    sqlite_db.add(vehicle)
    sqlite_db.commit()

    customer = create_mock_customer(sqlite_db, user, name="Hospital Alpha", ctype=CustomerType.HOSPITAL)

    loc = create_mock_location(sqlite_db, customer, name="Alpha Facility", lat=12.9352, lng=77.6245)

    pickup = Pickup(
        customer_id=customer.id,
        location_id=loc.id,
        pickup_code="PK-GPS-TEST",
        verification_token="tokgps",
        status=PickupStatus.IN_PROGRESS,
        priority=PickupPriority.NORMAL,
    )
    sqlite_db.add(pickup)
    sqlite_db.commit()

    route = Route(
        route_code="RT-TEST01",
        route_date=datetime.now(timezone.utc),
        warehouse_id=1,
        driver_id=driver.id,
        vehicle_id=vehicle.id,
        status=RouteStatus.IN_PROGRESS,
    )
    sqlite_db.add(route)
    sqlite_db.commit()

    stop = RouteStop(
        route_id=route.id,
        pickup_id=pickup.id,
        sequence_number=1,
        stop_type=RouteStopType.PICKUP,
        execution_status=RouteStopStatus.IN_PROGRESS,
    )
    sqlite_db.add(stop)
    sqlite_db.commit()
    sqlite_db.refresh(pickup)

    # 1. Without driver GPS telemetry
    loc_resp = get_driver_live_location_for_pickup(sqlite_db, pickup)
    assert loc_resp.is_live is False
    assert loc_resp.unavailable_reason is not None

    # 2. Driver transmits GPS telemetry
    driver.current_latitude = 12.9380
    driver.current_longitude = 77.6210
    driver.last_location_update = datetime.now(timezone.utc)
    sqlite_db.commit()

    loc_resp_live = get_driver_live_location_for_pickup(sqlite_db, pickup)
    assert loc_resp_live.is_live is True
    assert loc_resp_live.current_latitude == 12.9380
    assert loc_resp_live.current_longitude == 77.6210
    assert loc_resp_live.distance_meters is not None
    assert loc_resp_live.distance_meters > 0
