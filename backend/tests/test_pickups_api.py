from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from unittest.mock import patch

from fastapi import FastAPI, HTTPException
from fastapi.testclient import TestClient

from app.api.pickups import router
from app.core.auth import get_current_user
from app.core.database import get_db
from app.models.enums import (
    PickupPriority,
    PickupStatus,
    UserRole,
)


# ---------------------------------------------------------
# Test application
# ---------------------------------------------------------

test_app = FastAPI()
test_app.include_router(router)


# ---------------------------------------------------------
# Fake users
# ---------------------------------------------------------

customer_user = SimpleNamespace(
    id=100,
    role=UserRole.CUSTOMER,
)

admin_user = SimpleNamespace(
    id=200,
    role=UserRole.ADMIN,
)


def override_customer_user():
    return customer_user


def override_admin_user():
    return admin_user


test_app.dependency_overrides[
    get_current_user
] = override_customer_user

client = TestClient(test_app)


# ---------------------------------------------------------
# Fixtures
# ---------------------------------------------------------

def make_pickup():
    now = datetime.now(timezone.utc)

    return SimpleNamespace(
        id=1,
        pickup_code="PK-ABC123",
        customer_id=10,
        location_id=50,
        status=PickupStatus.REQUESTED,
        priority=PickupPriority.NORMAL,
        requested_date=now + timedelta(days=1),
        scheduled_date=None,
        notes="Pickup test",
        failure_reason=None,
        collected_at=None,
        created_at=now,
        updated_at=now,
    )


# ---------------------------------------------------------
# Create pickup
# ---------------------------------------------------------

@patch(
    "app.api.pickups.create_pickup"
)
def test_create_pickup_endpoint(
    create_pickup_mock,
):
    pickup = make_pickup()

    create_pickup_mock.return_value = pickup

    requested_date = (
        datetime.now(timezone.utc)
        + timedelta(days=1)
    )

    response = client.post(
        "/api/pickups/",
        json={
            "location_id": 50,
            "requested_date": requested_date.isoformat(),
            "priority": "NORMAL",
            "estimated_weight_kg": 12.5,
            "notes": "Pickup test",
        },
    )

    assert response.status_code == 201

    body = response.json()

    assert body["id"] == 1
    assert body["pickup_code"] == "PK-ABC123"
    assert body["customer_id"] == 10
    assert body["location_id"] == 50
    assert body["status"] == "REQUESTED"
    assert body["priority"] == "NORMAL"
    assert body["notes"] == "Pickup test"

    create_pickup_mock.assert_called_once()

    call_kwargs = create_pickup_mock.call_args.kwargs

    assert call_kwargs["db"] is not None
    assert call_kwargs["current_user"] is customer_user
    assert call_kwargs["location_id"] == 50
    assert call_kwargs["priority"] == PickupPriority.NORMAL
    assert call_kwargs["estimated_weight_kg"] == 12.5
    assert call_kwargs["notes"] == "Pickup test"
    assert call_kwargs["requested_date"] is not None


@patch(
    "app.api.pickups.create_pickup"
)
def test_create_pickup_returns_service_http_error(
    create_pickup_mock,
):
    create_pickup_mock.side_effect = HTTPException(
        status_code=400,
        detail="Pickup is disabled for this location",
    )

    response = client.post(
        "/api/pickups/",
        json={
            "location_id": 50,
            "estimated_weight_kg": 5,
        },
    )

    assert response.status_code == 400

    assert response.json()["detail"] == (
        "Pickup is disabled for this location"
    )


def test_create_pickup_validates_weight():
    response = client.post(
        "/api/pickups/",
        json={
            "location_id": 50,
            "estimated_weight_kg": 0,
        },
    )

    assert response.status_code == 422


def test_create_pickup_validates_required_location():
    response = client.post(
        "/api/pickups/",
        json={
            "estimated_weight_kg": 5,
        },
    )

    assert response.status_code == 422


# ---------------------------------------------------------
# List pickups
# ---------------------------------------------------------

@patch(
    "app.api.pickups.list_customer_pickups"
)
def test_list_my_pickups_endpoint(
    list_pickups_mock,
):
    pickup = make_pickup()

    list_pickups_mock.return_value = [
        pickup
    ]

    response = client.get(
        "/api/pickups/"
    )

    assert response.status_code == 200

    body = response.json()

    assert len(body) == 1
    assert body[0]["id"] == 1
    assert body[0]["pickup_code"] == "PK-ABC123"
    assert body[0]["status"] == "REQUESTED"

    list_pickups_mock.assert_called_once()

    call_kwargs = list_pickups_mock.call_args.kwargs

    assert call_kwargs["current_user"] is customer_user
    assert call_kwargs["db"] is not None


@patch(
    "app.api.pickups.list_customer_pickups"
)
def test_list_my_pickups_returns_empty_list(
    list_pickups_mock,
):
    list_pickups_mock.return_value = []

    response = client.get(
        "/api/pickups/"
    )

    assert response.status_code == 200
    assert response.json() == []


# ---------------------------------------------------------
# Get pickup
# ---------------------------------------------------------

@patch(
    "app.api.pickups.get_customer_pickup"
)
def test_get_my_pickup_endpoint(
    get_pickup_mock,
):
    pickup = make_pickup()

    get_pickup_mock.return_value = pickup

    response = client.get(
        "/api/pickups/1"
    )

    assert response.status_code == 200

    body = response.json()

    assert body["id"] == 1
    assert body["pickup_code"] == "PK-ABC123"
    assert body["customer_id"] == 10
    assert body["location_id"] == 50

    get_pickup_mock.assert_called_once()

    call_kwargs = get_pickup_mock.call_args.kwargs

    assert call_kwargs["pickup_id"] == 1
    assert call_kwargs["current_user"] is customer_user
    assert call_kwargs["db"] is not None


@patch(
    "app.api.pickups.get_customer_pickup"
)
def test_get_my_pickup_returns_404(
    get_pickup_mock,
):
    get_pickup_mock.side_effect = HTTPException(
        status_code=404,
        detail="Pickup not found",
    )

    response = client.get(
        "/api/pickups/999"
    )

    assert response.status_code == 404

    assert response.json()["detail"] == (
        "Pickup not found"
    )


# ---------------------------------------------------------
# Authorization
# ---------------------------------------------------------

def test_create_pickup_rejects_non_customer():
    test_app.dependency_overrides[
        get_current_user
    ] = override_admin_user

    response = client.post(
        "/api/pickups/",
        json={
            "location_id": 50,
            "estimated_weight_kg": 5,
        },
    )

    assert response.status_code == 403

    assert response.json()["detail"] == (
        "Insufficient permissions"
    )

    test_app.dependency_overrides[
        get_current_user
    ] = override_customer_user


def test_list_pickups_rejects_non_customer():
    test_app.dependency_overrides[
        get_current_user
    ] = override_admin_user

    response = client.get(
        "/api/pickups/"
    )

    assert response.status_code == 403

    assert response.json()["detail"] == (
        "Insufficient permissions"
    )

    test_app.dependency_overrides[
        get_current_user
    ] = override_customer_user


def test_get_pickup_rejects_non_customer():
    test_app.dependency_overrides[
        get_current_user
    ] = override_admin_user

    response = client.get(
        "/api/pickups/1"
    )

    assert response.status_code == 403

    assert response.json()["detail"] == (
        "Insufficient permissions"
    )

    test_app.dependency_overrides[
        get_current_user
    ] = override_customer_user