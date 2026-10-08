from datetime import datetime, timezone
from types import SimpleNamespace
from unittest.mock import patch

from fastapi import FastAPI, HTTPException
from fastapi.testclient import TestClient

from app.api.driver_routes import router
from app.core.auth import get_current_user
from app.models.enums import (
    RouteStatus,
    RouteStopStatus,
    RouteStopType,
    UserRole,
)


# ---------------------------------------------------------
# Test application
# ---------------------------------------------------------

test_app = FastAPI()
test_app.include_router(router)


# ---------------------------------------------------------
# Users
# ---------------------------------------------------------

driver_user = SimpleNamespace(
    id=100,
    role=UserRole.DRIVER,
)

customer_user = SimpleNamespace(
    id=200,
    role=UserRole.CUSTOMER,
)


def override_driver_user():
    return driver_user


def override_customer_user():
    return customer_user


test_app.dependency_overrides[
    get_current_user
] = override_driver_user

client = TestClient(test_app)


# ---------------------------------------------------------
# Fixtures
# ---------------------------------------------------------

def make_pickup_stop():
    return SimpleNamespace(
        sequence_number=1,
        stop_type=RouteStopType.PICKUP,
        pickup=SimpleNamespace(
            id=501,
            pickup_code="PK-DRIVER001",
            location=SimpleNamespace(
                id=601,
                name="Customer Branch",
                address="123 Test Road",
                city="Bengaluru",
                state="Karnataka",
                postal_code="560001",
                latitude=12.9716,
                longitude=77.5946,
            ),
        ),
        arrival_time=None,
        departure_time=None,
        proof_storage_path=None,
        execution_status=RouteStopStatus.PENDING,
    )


def make_warehouse_stop():
    return SimpleNamespace(
        sequence_number=2,
        stop_type=RouteStopType.WAREHOUSE,
        warehouse=SimpleNamespace(
            id=701,
            name="Test Warehouse",
            address="Warehouse Road",
            city="Bengaluru",
            state="Karnataka",
            postal_code="560010",
            latitude=12.9800,
            longitude=77.6000,
        ),
        arrival_time=None,
        departure_time=None,
        execution_status=RouteStopStatus.PENDING,
    )


def make_route():
    return SimpleNamespace(
        id=10,
        route_code="ROUTE-001",
        route_date=datetime.now(timezone.utc),
        status=RouteStatus.ASSIGNED,
        vehicle_id=801,
        vehicle=SimpleNamespace(
            registration_number="KA01AB1234",
        ),
        warehouse=SimpleNamespace(
            id=701,
            name="Test Warehouse",
            address="Warehouse Road",
            city="Bengaluru",
            state="Karnataka",
            latitude=12.9800,
            longitude=77.6000,
        ),
        planned_distance_km=25.5,
        planned_duration_seconds=3600,
        stops=[
            make_pickup_stop(),
            make_warehouse_stop(),
        ],
    )


# ---------------------------------------------------------
# Today's route
# ---------------------------------------------------------

@patch(
    "app.api.driver_routes.get_driver_route_for_date"
)
def test_get_today_route_endpoint(
    get_route_mock,
):
    route = make_route()

    get_route_mock.return_value = route

    response = client.get(
        "/api/driver/routes/today"
    )

    assert response.status_code == 200

    body = response.json()

    assert body["id"] == 10
    assert body["route_code"] == "ROUTE-001"
    assert body["status"] == "ASSIGNED"
    assert body["vehicle_id"] == 801
    assert body["vehicle_registration_number"] == (
        "KA01AB1234"
    )

    assert body["warehouse_id"] == 701
    assert body["warehouse_name"] == "Test Warehouse"
    assert body["warehouse_city"] == "Bengaluru"

    assert body["planned_distance_km"] == 25.5
    assert body["planned_duration_seconds"] == 3600

    assert len(body["stops"]) == 2

    pickup_stop = body["stops"][0]

    assert pickup_stop["sequence_number"] == 1
    assert pickup_stop["stop_type"] == "PICKUP"
    assert pickup_stop["pickup_id"] == 501
    assert pickup_stop["pickup_code"] == "PK-DRIVER001"
    assert pickup_stop["location_id"] == 601
    assert pickup_stop["location_name"] == "Customer Branch"
    assert pickup_stop["city"] == "Bengaluru"
    assert pickup_stop["proof_uploaded"] is False
    assert pickup_stop["execution_status"] == "PENDING"

    warehouse_stop = body["stops"][1]

    assert warehouse_stop["sequence_number"] == 2
    assert warehouse_stop["stop_type"] == "WAREHOUSE"
    assert warehouse_stop["warehouse_id"] == 701
    assert warehouse_stop["warehouse_name"] == (
        "Test Warehouse"
    )

    get_route_mock.assert_called_once()

    call_kwargs = get_route_mock.call_args.kwargs

    assert call_kwargs["user"] is driver_user
    assert call_kwargs["route_date"] is not None
    assert call_kwargs["db"] is not None


@patch(
    "app.api.driver_routes.get_driver_route_for_date"
)
def test_get_today_route_returns_404_when_no_route(
    get_route_mock,
):
    get_route_mock.return_value = None

    response = client.get(
        "/api/driver/routes/today"
    )

    assert response.status_code == 404

    assert response.json()["detail"] == (
        "No route assigned for today"
    )


def test_driver_route_rejects_non_driver():
    test_app.dependency_overrides[
        get_current_user
    ] = override_customer_user

    response = client.get(
        "/api/driver/routes/today"
    )

    assert response.status_code == 403

    assert response.json()["detail"] == (
        "Insufficient permissions"
    )

    test_app.dependency_overrides[
        get_current_user
    ] = override_driver_user
