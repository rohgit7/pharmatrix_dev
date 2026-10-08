import uuid
from datetime import datetime, timedelta, timezone

import pytest
from fastapi import HTTPException

from app.models.customer import Customer
from app.models.customer_location import CustomerLocation
from app.models.enums import (
    CustomerType,
    PickupPriority,
    PickupStatus,
    RouteStatus,
    RouteStopType,
    UserRole,
)
from app.models.pickup import Pickup
from app.models.route import Route
from app.models.route_stop import RouteStop
from app.models.user import User
from app.models.warehouse import Warehouse
from app.services.route_service import (
    create_route,
    generate_route_code,
    get_route,
    list_routes,
)


# ---------------------------------------------------------
# Setup helpers
# ---------------------------------------------------------


def make_user(db):
    suffix = uuid.uuid4().hex

    user = User(
        auth_user_id=uuid.uuid4(),
        name=f"Route Test User {suffix}",
        email=f"route-{suffix}@test.local",
        role=UserRole.CUSTOMER,
        is_active=True,
    )

    db.add(user)
    db.flush()

    return user


def make_customer(db, user):
    customer = Customer(
        user_id=user.id,
        customer_type=CustomerType.PHARMACY,
        legal_name=f"Route Test Pharmacy {uuid.uuid4().hex[:8]}",
        display_name="Route Test Pharmacy",
        phone="9876543210",
        email=user.email,
        gst_number=f"29RT{uuid.uuid4().hex[:10].upper()}",
        is_active=True,
    )

    db.add(customer)
    db.flush()

    return customer


def make_location(db, customer):
    location = CustomerLocation(
        customer_id=customer.id,
        location_code=f"LOC-{uuid.uuid4().hex[:10]}",
        name="Route Test Branch",
        address_line_1="123 Route Test Road",
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

    return location


def make_pickup(
    db,
    customer,
    location,
    *,
    scheduled_date,
    status=PickupStatus.SCHEDULED,
):
    pickup = Pickup(
        pickup_code=f"PU-{uuid.uuid4().hex[:10].upper()}",
        customer_id=customer.id,
        location_id=location.id,
        status=status,
        priority=PickupPriority.NORMAL,
        requested_date=scheduled_date - timedelta(days=1),
        scheduled_date=scheduled_date,
        estimated_weight_kg=10,
        verification_token=uuid.uuid4().hex,
    )

    db.add(pickup)
    db.flush()

    return pickup


def make_warehouse(db, *, active=True):
    warehouse = Warehouse(
        code=f"WH-{uuid.uuid4().hex[:10].upper()}",
        name="Route Test Warehouse",
        address="456 Warehouse Road",
        city="Bengaluru",
        state="Karnataka",
        postal_code="560002",
        latitude=12.9800,
        longitude=77.6000,
        active=active,
    )

    db.add(warehouse)
    db.flush()

    return warehouse


def cleanup(
    db,
    *,
    route=None,
    pickups=None,
    location=None,
    customer=None,
    user=None,
    warehouse=None,
):
    if route is not None:
        db.delete(route)

    if pickups:
        for pickup in pickups:
            if pickup is not None:
                db.delete(pickup)

    if location is not None:
        db.delete(location)

    if customer is not None:
        db.delete(customer)

    if user is not None:
        db.delete(user)

    if warehouse is not None:
        db.delete(warehouse)

    db.commit()


# ---------------------------------------------------------
# Route code
# ---------------------------------------------------------


def test_generate_route_code_uses_route_date():
    route_date = datetime(2026, 10, 6, 8, 30, tzinfo=timezone.utc)

    code = generate_route_code(route_date)

    assert code.startswith("RT-20261006-")
    assert len(code) == len("RT-20261006-ABC123")


# ---------------------------------------------------------
# Create route
# ---------------------------------------------------------


def test_create_route_persists_route_and_ordered_stops(db):
    user = make_user(db)
    customer = make_customer(db, user)
    location = make_location(db, customer)
    warehouse = make_warehouse(db)

    route_date = datetime(
        2026,
        10,
        6,
        8,
        0,
        tzinfo=timezone.utc,
    )

    pickup_a = make_pickup(
        db,
        customer,
        location,
        scheduled_date=datetime(
            2026,
            10,
            6,
            10,
            0,
            tzinfo=timezone.utc,
        ),
    )

    pickup_b = make_pickup(
        db,
        customer,
        location,
        scheduled_date=datetime(
            2026,
            10,
            6,
            11,
            0,
            tzinfo=timezone.utc,
        ),
    )

    route = None

    try:
        route = create_route(
            db=db,
            warehouse_id=warehouse.id,
            route_date=route_date,
            pickup_ids=[pickup_a.id, pickup_b.id],
        )

        assert route.id is not None
        assert route.route_code.startswith("RT-20261006-")
        assert route.route_date == route_date
        assert route.warehouse_id == warehouse.id
        assert route.status == RouteStatus.DRAFT

        stops = (
            db.query(RouteStop)
            .filter(RouteStop.route_id == route.id)
            .order_by(RouteStop.sequence_number)
            .all()
        )

        assert len(stops) == 3

        assert stops[0].sequence_number == 1
        assert stops[0].stop_type == RouteStopType.PICKUP
        assert stops[0].pickup_id == pickup_a.id
        assert stops[0].warehouse_id is None

        assert stops[1].sequence_number == 2
        assert stops[1].stop_type == RouteStopType.PICKUP
        assert stops[1].pickup_id == pickup_b.id
        assert stops[1].warehouse_id is None

        assert stops[2].sequence_number == 3
        assert stops[2].stop_type == RouteStopType.WAREHOUSE
        assert stops[2].pickup_id is None
        assert stops[2].warehouse_id == warehouse.id

    finally:
        cleanup(
            db,
            route=route,
            pickups=[pickup_a, pickup_b],
            location=location,
            customer=customer,
            user=user,
            warehouse=warehouse,
        )


def test_create_route_rejects_duplicate_pickup_ids(db):
    user = make_user(db)
    customer = make_customer(db, user)
    location = make_location(db, customer)
    warehouse = make_warehouse(db)

    route_date = datetime(
        2026,
        10,
        6,
        8,
        0,
        tzinfo=timezone.utc,
    )

    pickup = make_pickup(
        db,
        customer,
        location,
        scheduled_date=route_date,
    )

    try:
        with pytest.raises(HTTPException) as exc_info:
            create_route(
                db=db,
                warehouse_id=warehouse.id,
                route_date=route_date,
                pickup_ids=[pickup.id, pickup.id],
            )

        assert exc_info.value.status_code == 400
        assert exc_info.value.detail == (
            "Duplicate pickup IDs are not allowed"
        )

    finally:
        cleanup(
            db,
            pickups=[pickup],
            location=location,
            customer=customer,
            user=user,
            warehouse=warehouse,
        )


def test_create_route_rejects_missing_warehouse(db):
    route_date = datetime(
        2026,
        10,
        6,
        8,
        0,
        tzinfo=timezone.utc,
    )

    with pytest.raises(HTTPException) as exc_info:
        create_route(
            db=db,
            warehouse_id=999999999,
            route_date=route_date,
            pickup_ids=[],
        )

    assert exc_info.value.status_code == 404
    assert exc_info.value.detail == "Warehouse not found"


def test_create_route_rejects_inactive_warehouse(db):
    user = make_user(db)
    customer = make_customer(db, user)
    location = make_location(db, customer)
    warehouse = make_warehouse(db, active=False)

    route_date = datetime(
        2026,
        10,
        6,
        8,
        0,
        tzinfo=timezone.utc,
    )

    pickup = make_pickup(
        db,
        customer,
        location,
        scheduled_date=route_date,
    )

    try:
        with pytest.raises(HTTPException) as exc_info:
            create_route(
                db=db,
                warehouse_id=warehouse.id,
                route_date=route_date,
                pickup_ids=[pickup.id],
            )

        assert exc_info.value.status_code == 400
        assert exc_info.value.detail == "Warehouse is inactive"

    finally:
        cleanup(
            db,
            pickups=[pickup],
            location=location,
            customer=customer,
            user=user,
            warehouse=warehouse,
        )


def test_create_route_rejects_missing_pickup(db):
    warehouse = make_warehouse(db)

    route_date = datetime(
        2026,
        10,
        6,
        8,
        0,
        tzinfo=timezone.utc,
    )

    try:
        with pytest.raises(HTTPException) as exc_info:
            create_route(
                db=db,
                warehouse_id=warehouse.id,
                route_date=route_date,
                pickup_ids=[999999999],
            )

        assert exc_info.value.status_code == 404
        assert exc_info.value.detail.startswith(
            "Pickup(s) not found:"
        )

    finally:
        cleanup(
            db,
            warehouse=warehouse,
        )


def test_create_route_rejects_non_scheduled_pickup(db):
    user = make_user(db)
    customer = make_customer(db, user)
    location = make_location(db, customer)
    warehouse = make_warehouse(db)

    route_date = datetime(
        2026,
        10,
        6,
        8,
        0,
        tzinfo=timezone.utc,
    )

    pickup = make_pickup(
        db,
        customer,
        location,
        scheduled_date=route_date,
        status=PickupStatus.REQUESTED,
    )

    try:
        with pytest.raises(HTTPException) as exc_info:
            create_route(
                db=db,
                warehouse_id=warehouse.id,
                route_date=route_date,
                pickup_ids=[pickup.id],
            )

        assert exc_info.value.status_code == 400
        assert "must be SCHEDULED" in exc_info.value.detail

    finally:
        cleanup(
            db,
            pickups=[pickup],
            location=location,
            customer=customer,
            user=user,
            warehouse=warehouse,
        )


def test_create_route_rejects_pickup_without_scheduled_date(db):
    user = make_user(db)
    customer = make_customer(db, user)
    location = make_location(db, customer)
    warehouse = make_warehouse(db)

    route_date = datetime(
        2026,
        10,
        6,
        8,
        0,
        tzinfo=timezone.utc,
    )

    pickup = make_pickup(
        db,
        customer,
        location,
        scheduled_date=route_date,
    )

    pickup.scheduled_date = None
    db.flush()

    try:
        with pytest.raises(HTTPException) as exc_info:
            create_route(
                db=db,
                warehouse_id=warehouse.id,
                route_date=route_date,
                pickup_ids=[pickup.id],
            )

        assert exc_info.value.status_code == 400
        assert "does not have a scheduled date" in exc_info.value.detail

    finally:
        cleanup(
            db,
            pickups=[pickup],
            location=location,
            customer=customer,
            user=user,
            warehouse=warehouse,
        )


def test_create_route_rejects_pickup_on_different_date(db):
    user = make_user(db)
    customer = make_customer(db, user)
    location = make_location(db, customer)
    warehouse = make_warehouse(db)

    route_date = datetime(
        2026,
        10,
        6,
        8,
        0,
        tzinfo=timezone.utc,
    )

    pickup = make_pickup(
        db,
        customer,
        location,
        scheduled_date=datetime(
            2026,
            10,
            7,
            10,
            0,
            tzinfo=timezone.utc,
        ),
    )

    try:
        with pytest.raises(HTTPException) as exc_info:
            create_route(
                db=db,
                warehouse_id=warehouse.id,
                route_date=route_date,
                pickup_ids=[pickup.id],
            )

        assert exc_info.value.status_code == 400
        assert "while the route is for" in exc_info.value.detail

    finally:
        cleanup(
            db,
            pickups=[pickup],
            location=location,
            customer=customer,
            user=user,
            warehouse=warehouse,
        )


def test_create_route_rejects_pickup_already_assigned_to_route(db):
    user = make_user(db)
    customer = make_customer(db, user)
    location = make_location(db, customer)
    warehouse = make_warehouse(db)

    route_date = datetime(
        2026,
        10,
        6,
        8,
        0,
        tzinfo=timezone.utc,
    )

    pickup = make_pickup(
        db,
        customer,
        location,
        scheduled_date=route_date,
    )

    first_route = None
    second_route = None

    try:
        first_route = create_route(
            db=db,
            warehouse_id=warehouse.id,
            route_date=route_date,
            pickup_ids=[pickup.id],
        )

        with pytest.raises(HTTPException) as exc_info:
            second_route = create_route(
                db=db,
                warehouse_id=warehouse.id,
                route_date=route_date,
                pickup_ids=[pickup.id],
            )

        assert exc_info.value.status_code == 409
        assert "already assigned to route ID" in exc_info.value.detail

    finally:
        cleanup(
            db,
            route=first_route,
            pickups=[pickup],
            location=location,
            customer=customer,
            user=user,
            warehouse=warehouse,
        )


# ---------------------------------------------------------
# Get route
# ---------------------------------------------------------


def test_get_route_returns_route_with_stops_and_warehouse(db):
    user = make_user(db)
    customer = make_customer(db, user)
    location = make_location(db, customer)
    warehouse = make_warehouse(db)

    route_date = datetime(
        2026,
        10,
        6,
        8,
        0,
        tzinfo=timezone.utc,
    )

    pickup = make_pickup(
        db,
        customer,
        location,
        scheduled_date=route_date,
    )

    route = None

    try:
        route = create_route(
            db=db,
            warehouse_id=warehouse.id,
            route_date=route_date,
            pickup_ids=[pickup.id],
        )

        result = get_route(
            db=db,
            route_id=route.id,
        )

        assert result.id == route.id
        assert result.route_code == route.route_code
        assert result.warehouse.id == warehouse.id
        assert len(result.stops) == 2

        assert result.stops[0].stop_type == RouteStopType.PICKUP
        assert result.stops[0].pickup_id == pickup.id

        assert result.stops[1].stop_type == RouteStopType.WAREHOUSE
        assert result.stops[1].warehouse_id == warehouse.id

    finally:
        cleanup(
            db,
            route=route,
            pickups=[pickup],
            location=location,
            customer=customer,
            user=user,
            warehouse=warehouse,
        )


def test_get_route_rejects_missing_route(db):
    with pytest.raises(HTTPException) as exc_info:
        get_route(
            db=db,
            route_id=999999999,
        )

    assert exc_info.value.status_code == 404
    assert exc_info.value.detail == "Route not found"


# ---------------------------------------------------------
# List routes
# ---------------------------------------------------------


def test_list_routes_returns_routes_in_date_descending_order(db):
    user = make_user(db)
    customer = make_customer(db, user)
    location = make_location(db, customer)
    warehouse = make_warehouse(db)

    route_date_a = datetime(
        2026,
        10,
        5,
        8,
        0,
        tzinfo=timezone.utc,
    )

    route_date_b = datetime(
        2026,
        10,
        6,
        8,
        0,
        tzinfo=timezone.utc,
    )

    pickup_a = make_pickup(
        db,
        customer,
        location,
        scheduled_date=route_date_a,
    )

    pickup_b = make_pickup(
        db,
        customer,
        location,
        scheduled_date=route_date_b,
    )

    route_a = None
    route_b = None

    try:
        route_a = create_route(
            db=db,
            warehouse_id=warehouse.id,
            route_date=route_date_a,
            pickup_ids=[pickup_a.id],
        )

        route_b = create_route(
            db=db,
            warehouse_id=warehouse.id,
            route_date=route_date_b,
            pickup_ids=[pickup_b.id],
        )

        routes = list_routes(db)

        ids = [route.id for route in routes]

        assert route_b.id in ids
        assert route_a.id in ids

        assert ids.index(route_b.id) < ids.index(route_a.id)

    finally:
        # Delete both routes before deleting the shared warehouse.
        if route_a is not None:
            db.delete(route_a)

        if route_b is not None:
            db.delete(route_b)

        db.commit()

        # Now the warehouse can safely be deleted.
        cleanup(
            db,
            pickups=[pickup_a, pickup_b],
            location=location,
            customer=customer,
            user=user,
            warehouse=warehouse,
        )


def test_list_routes_filters_by_status(db):
    user = make_user(db)
    customer = make_customer(db, user)
    location = make_location(db, customer)
    warehouse = make_warehouse(db)

    route_date = datetime(
        2026,
        10,
        6,
        8,
        0,
        tzinfo=timezone.utc,
    )

    pickup = make_pickup(
        db,
        customer,
        location,
        scheduled_date=route_date,
    )

    route = None

    try:
        route = create_route(
            db=db,
            warehouse_id=warehouse.id,
            route_date=route_date,
            pickup_ids=[pickup.id],
        )

        draft_routes = list_routes(
            db,
            status_filter=RouteStatus.DRAFT,
        )

        draft_ids = [item.id for item in draft_routes]

        assert route.id in draft_ids

        non_draft_routes = list_routes(
            db,
            status_filter=RouteStatus.COMPLETED,
        )

        non_draft_ids = [item.id for item in non_draft_routes]

        assert route.id not in non_draft_ids

    finally:
        cleanup(
            db,
            route=route,
            pickups=[pickup],
            location=location,
            customer=customer,
            user=user,
            warehouse=warehouse,
        )