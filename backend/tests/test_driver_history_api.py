from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
from types import SimpleNamespace
from unittest.mock import MagicMock, patch
from uuid import UUID, uuid4

import pytest
from fastapi import HTTPException

from app.api.driver_history import (
    _get_driver_or_404,
    get_driver_pickup_detail,
    get_driver_work_summary,
    list_driver_pickup_history,
)
from app.models.enums import (
    CustomerType,
    DriverStatus,
    OperationalExceptionStatus,
    OperationalExceptionType,
    PickupPriority,
    PickupStatus,
    RouteStatus,
    RouteStopStatus,
    RouteStopType,
    UserRole,
)


# ---------------------------------------------------------------------------
# Test Fixtures & Factories
# ---------------------------------------------------------------------------

DRIVER_USER_ID = 101
DRIVER_ID = 5
OTHER_DRIVER_ID = 99
PICKUP_UUID = UUID("11111111-2222-3333-4444-555555555555")
OTHER_PICKUP_UUID = UUID("99999999-8888-7777-6666-555555555555")

driver_user = SimpleNamespace(id=DRIVER_USER_ID, role=UserRole.DRIVER)
non_driver_user = SimpleNamespace(id=999, role=UserRole.CUSTOMER)

mock_driver = SimpleNamespace(
    id=DRIVER_ID,
    user_id=DRIVER_USER_ID,
    driver_code="DRV-001",
    status=DriverStatus.ACTIVE,
)


def make_customer():
    return SimpleNamespace(
        id=1,
        display_name="Metro General Hospital",
        legal_name="Metro Healthcare Ltd",
        customer_type=CustomerType.HOSPITAL,
    )


def make_location():
    return SimpleNamespace(
        id=10,
        name="Main Biomedical Disposal Bay",
        address_line_1="100 Medical Center Blvd",
        address_line_2="Suite 400",
        city="Mumbai",
        state="Maharashtra",
        postal_code="400001",
        contact_name="Dr. A. Sharma",
        contact_phone="+919876543210",
        latitude=Decimal("19.0760"),
        longitude=Decimal("72.8777"),
    )


def make_route(driver_id=DRIVER_ID, status=RouteStatus.COMPLETED):
    now = datetime.now(timezone.utc)
    return SimpleNamespace(
        id=20,
        driver_id=driver_id,
        route_code="RT-20261113-001",
        route_date=now.date(),
        status=status,
        created_at=now - timedelta(hours=6),
        approved_at=now - timedelta(hours=5),
        planned_distance_km=Decimal("42.5"),
        vehicle=SimpleNamespace(registration_number="MH-01-AB-1234"),
        warehouse=SimpleNamespace(name="Central Biomedical Hub"),
    )


def make_pickup(
    pickup_id=1,
    public_id=PICKUP_UUID,
    code="PKP-2026-0001",
    status=PickupStatus.COLLECTED,
):
    now = datetime.now(timezone.utc)
    return SimpleNamespace(
        id=pickup_id,
        public_id=public_id,
        pickup_code=code,
        status=status,
        priority=PickupPriority.NORMAL,
        customer_id=1,
        location_id=10,
        requested_date=now - timedelta(days=1),
        scheduled_date=now.date(),
        collected_at=now - timedelta(hours=1) if status == PickupStatus.COLLECTED else None,
        estimated_weight_kg=Decimal("18.5"),
        qr_verified_at=now - timedelta(minutes=75) if status == PickupStatus.COLLECTED else None,
        otp_verified_at=now - timedelta(minutes=70) if status == PickupStatus.COLLECTED else None,
        notes="Urgent biohazard bags",
        failure_reason="Clinic closed on arrival" if status == PickupStatus.FAILED else None,
        created_at=now - timedelta(days=1),
        updated_at=now - timedelta(hours=1),
        customer=make_customer(),
        location=make_location(),
        route_stops=[],
    )


def make_route_stop(
    stop_id=1,
    route=None,
    pickup=None,
    execution_status=RouteStopStatus.COMPLETED,
    weight=Decimal("19.2"),
    has_proof=True,
):
    now = datetime.now(timezone.utc)
    stop = SimpleNamespace(
        id=stop_id,
        route_id=route.id if route else 20,
        pickup_id=pickup.id if pickup else 1,
        stop_type=RouteStopType.PICKUP,
        sequence_number=1,
        execution_status=execution_status,
        arrived_at=now - timedelta(minutes=80),
        completed_at=now - timedelta(minutes=65) if execution_status == RouteStopStatus.COMPLETED else None,
        collected_weight_kg=weight if execution_status == RouteStopStatus.COMPLETED else None,
        proof_storage_path="proofs/stop_1.jpg" if has_proof else None,
        proof_uploaded_at=now - timedelta(minutes=66) if has_proof else None,
        failure_reason="Premises locked" if execution_status == RouteStopStatus.FAILED else None,
        route=route,
        pickup=pickup,
    )
    if pickup:
        pickup.route_stops = [stop]
    return stop


# ---------------------------------------------------------------------------
# Mock Query & Session
# ---------------------------------------------------------------------------

class MockQuery:
    def __init__(self, data=None):
        self._data = data if data is not None else []

    def join(self, *args, **kwargs):
        return self

    def filter(self, *args, **kwargs):
        return self

    def distinct(self):
        return self

    def options(self, *args, **kwargs):
        return self

    def order_by(self, *args, **kwargs):
        return self

    def offset(self, n):
        return self

    def limit(self, n):
        return self

    def count(self):
        return len(self._data)

    def all(self):
        return list(self._data)

    def first(self):
        return self._data[0] if self._data else None


class MockSession:
    def __init__(self, driver=mock_driver, summary_records=None, list_results=None, detail_pickup=None, exceptions=None):
        self.driver = driver
        self.summary_records = summary_records or []
        self.list_results = list_results or []
        self.detail_pickup = detail_pickup
        self.exceptions = exceptions or []

    def query(self, *entities):
        entity_repr = str(entities)
        # Check Driver lookup
        if "Driver" in entity_repr:
            return MockQuery([self.driver] if self.driver else [])

        # Check Summary RouteStop/Route/Pickup records
        if "RouteStop" in entity_repr and "Route" in entity_repr and "Pickup" in entity_repr and "Customer" not in entity_repr:
            return MockQuery(self.summary_records)

        # Check distinct working days func.date(Route.route_date)
        if "date" in entity_repr or "Route.route_date" in entity_repr:
            days = set(r[1].route_date for r in self.summary_records)
            return MockQuery([(d,) for d in days])

        # Check completed routes
        if "Route" in entity_repr and len(entities) == 1:
            routes = list({r[1].id: r[1] for r in self.summary_records}.values())
            return MockQuery(routes)

        # Check List query with Customer and CustomerLocation
        if "Customer" in entity_repr and "CustomerLocation" in entity_repr:
            return MockQuery(self.list_results)

        # Check Detail Pickup query
        if "Pickup" in entity_repr and len(entities) == 1:
            return MockQuery([self.detail_pickup] if self.detail_pickup else [])

        # Check Operational Exceptions
        if "OperationalException" in entity_repr:
            return MockQuery(self.exceptions)

        return MockQuery([])


# ---------------------------------------------------------------------------
# Unit Tests
# ---------------------------------------------------------------------------

def test_summary_empty_history():
    """Driver with zero assignments returns clean empty summary metrics."""
    db = MockSession(driver=mock_driver, summary_records=[])
    res = get_driver_work_summary(current_user=driver_user, db=db)

    assert res.total_pickups == 0
    assert res.completed_pickups == 0
    assert res.cancelled_pickups == 0
    assert res.failed_pickups == 0
    assert res.in_progress_pickups == 0
    assert res.total_collected_weight_kg == 0.0
    assert res.total_working_days == 0
    assert res.avg_pickups_per_day == 0.0
    assert res.performance.completion_rate_percentage == 0.0
    assert res.performance.completed_this_week == 0
    assert res.performance.completed_this_month == 0


def test_summary_with_completed_cancelled_failed():
    """Verifies dynamic metrics calculation with completed, cancelled, and failed pickups."""
    route = make_route(driver_id=DRIVER_ID, status=RouteStatus.COMPLETED)

    # 1 Completed
    p1 = make_pickup(1, code="PKP-1", status=PickupStatus.COLLECTED)
    s1 = make_route_stop(1, route, p1, execution_status=RouteStopStatus.COMPLETED, weight=Decimal("20.5"))

    # 2 Cancelled
    p2 = make_pickup(2, code="PKP-2", status=PickupStatus.CANCELLED)
    s2 = make_route_stop(2, route, p2, execution_status=RouteStopStatus.PENDING, weight=None)

    # 3 Failed
    p3 = make_pickup(3, code="PKP-3", status=PickupStatus.FAILED)
    s3 = make_route_stop(3, route, p3, execution_status=RouteStopStatus.FAILED, weight=None)

    records = [
        (s1, route, p1),
        (s2, route, p2),
        (s3, route, p3),
    ]

    db = MockSession(driver=mock_driver, summary_records=records)
    res = get_driver_work_summary(current_user=driver_user, db=db)

    assert res.total_pickups == 3
    assert res.completed_pickups == 1
    assert res.cancelled_pickups == 1
    assert res.failed_pickups == 1
    assert res.total_collected_weight_kg == 20.5
    assert res.total_working_days == 1
    assert res.avg_pickups_per_day == 1.0
    assert res.performance.completion_rate_percentage == 33.3
    assert res.performance.completed_this_week == 1
    assert res.performance.completed_this_month == 1
    assert res.performance.collected_weight_this_month_kg == 20.5
    assert res.performance.total_distance_km == 42.5
    assert res.performance.avg_collection_duration_minutes == 15.0


def test_list_driver_pickup_history():
    """Verifies listing and transformation of historical pickups."""
    route = make_route()
    pickup = make_pickup(1, code="PKP-001", status=PickupStatus.COLLECTED)
    stop = make_route_stop(1, route, pickup, execution_status=RouteStopStatus.COMPLETED, weight=Decimal("15.75"))
    customer = make_customer()
    location = make_location()

    list_records = [(stop, route, pickup, customer, location)]
    db = MockSession(driver=mock_driver, list_results=list_records)

    res = list_driver_pickup_history(
        page=1,
        page_size=10,
        status="all",
        search=None,
        sort_by="recent",
        current_user=driver_user,
        db=db,
    )

    assert res.total == 1
    assert len(res.items) == 1
    item = res.items[0]
    assert item.pickup_code == "PKP-001"
    assert item.status == "COMPLETED"
    assert item.customer_name == "Metro General Hospital"
    assert item.collected_weight_kg == 15.75
    assert item.has_proof is True
    assert item.qr_verified is True
    assert item.otp_verified is True


def test_list_pickups_status_mapping():
    """Verifies that all lifecycle statuses (completed, cancelled, failed, in_progress, pending) map to clear labels."""
    route = make_route()
    customer = make_customer()
    location = make_location()

    # Cancelled
    p_cancelled = make_pickup(2, code="PKP-002", status=PickupStatus.CANCELLED)
    s_cancelled = make_route_stop(2, route, p_cancelled, execution_status=RouteStopStatus.PENDING)

    # Failed
    p_failed = make_pickup(3, code="PKP-003", status=PickupStatus.FAILED)
    s_failed = make_route_stop(3, route, p_failed, execution_status=RouteStopStatus.FAILED)

    # In Progress
    p_prog = make_pickup(4, code="PKP-004", status=PickupStatus.IN_PROGRESS)
    s_prog = make_route_stop(4, route, p_prog, execution_status=RouteStopStatus.ARRIVED)

    records = [
        (s_cancelled, route, p_cancelled, customer, location),
        (s_failed, route, p_failed, customer, location),
        (s_prog, route, p_prog, customer, location),
    ]
    db = MockSession(driver=mock_driver, list_results=records)

    res = list_driver_pickup_history(
        page=1,
        page_size=10,
        current_user=driver_user,
        db=db,
    )

    assert len(res.items) == 3
    assert res.items[0].status == "CANCELLED"
    assert res.items[1].status == "FAILED"
    assert res.items[2].status == "IN_PROGRESS"


def test_list_pickups_pagination_metadata():
    """Verifies total_pages, offset, and page limits are correctly calculated."""
    route = make_route()
    customer = make_customer()
    location = make_location()

    # 5 items
    records = []
    for i in range(5):
        p = make_pickup(i + 1, code=f"PKP-00{i+1}")
        s = make_route_stop(i + 1, route, p)
        records.append((s, route, p, customer, location))

    db = MockSession(driver=mock_driver, list_results=records)

    res = list_driver_pickup_history(
        page=2,
        page_size=2,
        current_user=driver_user,
        db=db,
    )

    assert res.total == 5
    assert res.page == 2
    assert res.page_size == 2
    assert res.total_pages == 3


@patch("app.api.driver_history.create_signed_storage_url")
def test_get_driver_pickup_detail_success(mock_create_signed_url):
    """Verifies detail endpoint returns full Sections A-F with chronological timeline and signed proof URL."""
    mock_create_signed_url.return_value = "https://storage.supabase.co/signed/proofs/stop_1.jpg?token=abc"

    route = make_route()
    pickup = make_pickup(1, public_id=PICKUP_UUID, code="PKP-2026-0001", status=PickupStatus.COLLECTED)
    stop = make_route_stop(1, route, pickup, execution_status=RouteStopStatus.COMPLETED, weight=Decimal("20.0"))

    exc = SimpleNamespace(
        id=7,
        exception_type=OperationalExceptionType.PICKUP_FAILED,
        status=OperationalExceptionStatus.RESOLVED,
        created_at=datetime.now(timezone.utc),
    )

    db = MockSession(driver=mock_driver, detail_pickup=pickup, exceptions=[exc])

    res = get_driver_pickup_detail(
        pickup_identifier=str(PICKUP_UUID),
        current_user=driver_user,
        db=db,
    )

    assert res.id == 1
    assert res.public_id == PICKUP_UUID
    assert res.pickup_code == "PKP-2026-0001"
    assert res.status == "COMPLETED"

    # Location details
    assert res.contact_name == "Dr. A. Sharma"
    assert res.contact_phone == "+919876543210"

    # Collection weights & discrepancy
    assert res.estimated_weight_kg == 18.5
    assert res.collected_weight_kg == 20.0
    assert res.weight_discrepancy_kg == 1.5

    # Verification status
    assert res.qr_verified is True
    assert res.otp_verified is True
    assert res.otp_verified_at is not None

    # Evidence signed URL
    assert res.proof_signed_url == "https://storage.supabase.co/signed/proofs/stop_1.jpg?token=abc"

    # Operational Exceptions
    assert len(res.exceptions) == 1
    assert res.exceptions[0].exception_type == "PICKUP_FAILED"

    # Timeline (sorted chronologically)
    stages = [ev.stage for ev in res.timeline]
    assert "requested" in stages
    assert "scheduled" in stages
    assert "assigned" in stages
    assert "arrived" in stages
    assert "weighed" in stages
    assert "qr_verified" in stages
    assert "otp_verified" in stages
    assert "proof_uploaded" in stages
    assert "completed" in stages

    # Timeline timestamps strictly non-decreasing
    for i in range(len(res.timeline) - 1):
        t1 = res.timeline[i].timestamp
        t2 = res.timeline[i + 1].timestamp
        dt1 = t1 if t1.tzinfo else t1.replace(tzinfo=timezone.utc)
        dt2 = t2 if t2.tzinfo else t2.replace(tzinfo=timezone.utc)
        assert dt1 <= dt2


def test_pickup_detail_assigned_to_other_driver_forbidden():
    """Enforces authorization: 403 Forbidden when pickup is assigned to another driver."""
    other_route = make_route(driver_id=OTHER_DRIVER_ID)
    pickup = make_pickup(2, public_id=OTHER_PICKUP_UUID, code="PKP-OTHER")
    make_route_stop(2, other_route, pickup)

    db = MockSession(driver=mock_driver, detail_pickup=pickup)

    with pytest.raises(HTTPException) as exc_info:
        get_driver_pickup_detail(
            pickup_identifier=str(OTHER_PICKUP_UUID),
            current_user=driver_user,
            db=db,
        )

    assert exc_info.value.status_code == 403
    assert "another driver" in exc_info.value.detail.lower()


def test_pickup_detail_not_found():
    """Returns 404 when pickup is not found."""
    db = MockSession(driver=mock_driver, detail_pickup=None)

    with pytest.raises(HTTPException) as exc_info:
        get_driver_pickup_detail(
            pickup_identifier="NON-EXISTENT",
            current_user=driver_user,
            db=db,
        )

    assert exc_info.value.status_code == 404


def test_non_driver_profile_not_found():
    """Non-driver profile raises 404 Driver profile not found."""
    db = MockSession(driver=None)

    with pytest.raises(HTTPException) as exc_info:
        _get_driver_or_404(db, non_driver_user)

    assert exc_info.value.status_code == 404
    assert "driver profile not found" in exc_info.value.detail.lower()
