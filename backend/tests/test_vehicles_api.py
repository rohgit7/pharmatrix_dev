from datetime import datetime, timezone
from decimal import Decimal
from types import SimpleNamespace
from unittest.mock import patch

from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.api.vehicles import router
from app.core.auth import get_current_user
from app.models.enums import (
    UserRole,
    VehicleStatus,
    VehicleType,
)


# ---------------------------------------------------------
# Test application
# ---------------------------------------------------------

test_app = FastAPI()
test_app.include_router(router)


# ---------------------------------------------------------
# Users
# ---------------------------------------------------------

admin_user = SimpleNamespace(
    id=100,
    role=UserRole.ADMIN,
)

driver_user = SimpleNamespace(
    id=200,
    role=UserRole.DRIVER,
)


def override_admin_user():
    return admin_user


def override_driver_user():
    return driver_user


test_app.dependency_overrides[
    get_current_user
] = override_admin_user

client = TestClient(test_app)


# ---------------------------------------------------------
# Helpers
# ---------------------------------------------------------

def make_vehicle(
    *,
    vehicle_id=1,
):
    now = datetime.now(timezone.utc)

    return SimpleNamespace(
        id=vehicle_id,
        registration_number="KA01AB1234",
        vehicle_type=VehicleType.VAN,
        capacity_kg=Decimal("100.00"),
        status=VehicleStatus.AVAILABLE,
        created_at=now,
        updated_at=now,
    )


# ---------------------------------------------------------
# Create
# ---------------------------------------------------------

@patch("app.api.vehicles.create_vehicle")
def test_create_vehicle_endpoint(
    create_vehicle_mock,
):
    create_vehicle_mock.return_value = make_vehicle()

    response = client.post(
        "/api/admin/vehicles/",
        json={
            "registration_number": "KA01AB1234",
            "vehicle_type": "VAN",
            "capacity_kg": "100.00",
        },
    )

    assert response.status_code == 201

    body = response.json()

    assert body["id"] == 1
    assert body["registration_number"] == (
        "KA01AB1234"
    )
    assert body["vehicle_type"] == "VAN"
    assert Decimal(body["capacity_kg"]) == Decimal(
        "100.00"
    )
    assert body["status"] == "AVAILABLE"

    create_vehicle_mock.assert_called_once()

    args = create_vehicle_mock.call_args.args

    assert args[0] is not None

    data = args[1]

    assert data.registration_number == "KA01AB1234"
    assert data.vehicle_type == VehicleType.VAN
    assert data.capacity_kg == Decimal("100.00")


def test_create_vehicle_validates_capacity():
    response = client.post(
        "/api/admin/vehicles/",
        json={
            "registration_number": "KA01AB1234",
            "vehicle_type": "VAN",
            "capacity_kg": "0",
        },
    )

    assert response.status_code == 422


# ---------------------------------------------------------
# List
# ---------------------------------------------------------

@patch("app.api.vehicles.list_vehicles")
def test_list_vehicles_endpoint(
    list_vehicles_mock,
):
    list_vehicles_mock.return_value = [
        make_vehicle(vehicle_id=1),
        make_vehicle(vehicle_id=2),
    ]

    response = client.get(
        "/api/admin/vehicles/?skip=10&limit=20"
    )

    assert response.status_code == 200

    body = response.json()

    assert len(body) == 2
    assert body[0]["id"] == 1
    assert body[1]["id"] == 2

    list_vehicles_mock.assert_called_once()

    args = list_vehicles_mock.call_args.args

    assert args[0] is not None
    assert args[1] == 10
    assert args[2] == 20


def test_list_vehicles_rejects_invalid_pagination():
    response = client.get(
        "/api/admin/vehicles/?skip=-1"
    )

    assert response.status_code == 422

    response = client.get(
        "/api/admin/vehicles/?limit=101"
    )

    assert response.status_code == 422


# ---------------------------------------------------------
# Get
# ---------------------------------------------------------

@patch("app.api.vehicles.get_vehicle")
def test_get_vehicle_endpoint(
    get_vehicle_mock,
):
    get_vehicle_mock.return_value = make_vehicle()

    response = client.get(
        "/api/admin/vehicles/1"
    )

    assert response.status_code == 200

    body = response.json()

    assert body["id"] == 1
    assert body["registration_number"] == (
        "KA01AB1234"
    )
    assert body["status"] == "AVAILABLE"

    get_vehicle_mock.assert_called_once()

    args = get_vehicle_mock.call_args.args

    assert args[0] is not None
    assert args[1] == 1


# ---------------------------------------------------------
# Update
# ---------------------------------------------------------

@patch("app.api.vehicles.update_vehicle")
def test_update_vehicle_endpoint(
    update_vehicle_mock,
):
    updated = make_vehicle()

    updated.registration_number = "KA02XY9999"
    updated.capacity_kg = Decimal("150.00")

    update_vehicle_mock.return_value = updated

    response = client.patch(
        "/api/admin/vehicles/1",
        json={
            "registration_number": "KA02XY9999",
            "capacity_kg": "150.00",
        },
    )

    assert response.status_code == 200

    body = response.json()

    assert body["registration_number"] == (
        "KA02XY9999"
    )
    assert Decimal(body["capacity_kg"]) == Decimal(
        "150.00"
    )

    update_vehicle_mock.assert_called_once()

    args = update_vehicle_mock.call_args.args

    assert args[0] is not None
    assert args[1] == 1

    data = args[2]

    assert data.registration_number == "KA02XY9999"
    assert data.capacity_kg == Decimal("150.00")


# ---------------------------------------------------------
# Authorization
# ---------------------------------------------------------

def test_vehicle_admin_endpoints_reject_driver():
    test_app.dependency_overrides[
        get_current_user
    ] = override_driver_user

    response = client.get(
        "/api/admin/vehicles/"
    )

    assert response.status_code == 403

    assert response.json()["detail"] == (
        "Insufficient permissions"
    )

    test_app.dependency_overrides[
        get_current_user
    ] = override_admin_user