from datetime import datetime, timezone
from types import SimpleNamespace
from unittest.mock import patch

from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.api.admin_warehouses import router
from app.core.auth import get_current_user
from app.models.user import UserRole


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

customer_user = SimpleNamespace(
    id=200,
    role=UserRole.CUSTOMER,
)


def override_admin_user():
    return admin_user


def override_customer_user():
    return customer_user


test_app.dependency_overrides[
    get_current_user
] = override_admin_user

client = TestClient(test_app)


# ---------------------------------------------------------
# Fixture
# ---------------------------------------------------------

def make_warehouse(
    *,
    warehouse_id=1,
    active=True,
):
    now = datetime.now(timezone.utc)

    return SimpleNamespace(
        id=warehouse_id,
        code="WH001",
        name="Test Warehouse",
        address="Warehouse Road",
        city="Bengaluru",
        state="Karnataka",
        postal_code="560010",
        latitude=12.9716,
        longitude=77.5946,
        active=active,
        created_at=now,
        updated_at=now,
    )


# ---------------------------------------------------------
# Create
# ---------------------------------------------------------

@patch(
    "app.api.admin_warehouses.create_warehouse"
)
def test_create_warehouse_endpoint(
    create_warehouse_mock,
):
    create_warehouse_mock.return_value = (
        make_warehouse()
    )

    response = client.post(
        "/api/admin/warehouses/",
        json={
            "code": "WH001",
            "name": "Test Warehouse",
            "address": "Warehouse Road",
            "city": "Bengaluru",
            "state": "Karnataka",
            "postal_code": "560010",
            "latitude": 12.9716,
            "longitude": 77.5946,
        },
    )

    assert response.status_code == 201

    body = response.json()

    assert body["id"] == 1
    assert body["code"] == "WH001"
    assert body["name"] == "Test Warehouse"
    assert body["city"] == "Bengaluru"
    assert body["active"] is True

    create_warehouse_mock.assert_called_once()

    kwargs = create_warehouse_mock.call_args.kwargs

    assert kwargs["db"] is not None
    assert kwargs["code"] == "WH001"
    assert kwargs["name"] == "Test Warehouse"
    assert kwargs["address"] == "Warehouse Road"
    assert kwargs["city"] == "Bengaluru"
    assert kwargs["state"] == "Karnataka"
    assert kwargs["postal_code"] == "560010"
    assert kwargs["latitude"] == 12.9716
    assert kwargs["longitude"] == 77.5946


def test_create_warehouse_validates_required_fields():
    response = client.post(
        "/api/admin/warehouses/",
        json={
            "code": "WH001",
            "name": "Test Warehouse",
        },
    )

    assert response.status_code == 422


# ---------------------------------------------------------
# List
# ---------------------------------------------------------

@patch(
    "app.api.admin_warehouses.list_warehouses"
)
def test_list_warehouses_defaults_to_active_only(
    list_warehouses_mock,
):
    list_warehouses_mock.return_value = [
        make_warehouse(warehouse_id=1),
    ]

    response = client.get(
        "/api/admin/warehouses/"
    )

    assert response.status_code == 200

    body = response.json()

    assert len(body) == 1
    assert body[0]["id"] == 1

    list_warehouses_mock.assert_called_once()

    kwargs = list_warehouses_mock.call_args.kwargs

    assert kwargs["db"] is not None
    assert kwargs["include_inactive"] is False


@patch(
    "app.api.admin_warehouses.list_warehouses"
)
def test_list_warehouses_can_include_inactive(
    list_warehouses_mock,
):
    list_warehouses_mock.return_value = [
        make_warehouse(
            warehouse_id=1,
            active=True,
        ),
        make_warehouse(
            warehouse_id=2,
            active=False,
        ),
    ]

    response = client.get(
        "/api/admin/warehouses/?include_inactive=true"
    )

    assert response.status_code == 200

    body = response.json()

    assert len(body) == 2
    assert body[1]["active"] is False

    list_warehouses_mock.assert_called_once()

    kwargs = list_warehouses_mock.call_args.kwargs

    assert kwargs["include_inactive"] is True


# ---------------------------------------------------------
# Get
# ---------------------------------------------------------

@patch(
    "app.api.admin_warehouses.get_warehouse"
)
def test_get_warehouse_endpoint(
    get_warehouse_mock,
):
    get_warehouse_mock.return_value = make_warehouse()

    response = client.get(
        "/api/admin/warehouses/1"
    )

    assert response.status_code == 200

    body = response.json()

    assert body["id"] == 1
    assert body["code"] == "WH001"
    assert body["name"] == "Test Warehouse"

    get_warehouse_mock.assert_called_once()

    kwargs = get_warehouse_mock.call_args.kwargs

    assert kwargs["db"] is not None
    assert kwargs["warehouse_id"] == 1


# ---------------------------------------------------------
# Update
# ---------------------------------------------------------

@patch(
    "app.api.admin_warehouses.update_warehouse"
)
def test_update_warehouse_endpoint(
    update_warehouse_mock,
):
    updated = make_warehouse()

    updated.name = "Updated Warehouse"
    updated.latitude = 13.0000

    update_warehouse_mock.return_value = updated

    response = client.patch(
        "/api/admin/warehouses/1",
        json={
            "name": "Updated Warehouse",
            "latitude": 13.0000,
        },
    )

    assert response.status_code == 200

    body = response.json()

    assert body["name"] == "Updated Warehouse"
    assert body["latitude"] == 13.0

    update_warehouse_mock.assert_called_once()

    kwargs = update_warehouse_mock.call_args.kwargs

    assert kwargs["db"] is not None
    assert kwargs["warehouse_id"] == 1

    data = kwargs["data"]

    assert data.name == "Updated Warehouse"
    assert data.latitude == 13.0


# ---------------------------------------------------------
# Authorization
# ---------------------------------------------------------

def test_warehouse_admin_endpoints_reject_customer():
    test_app.dependency_overrides[
        get_current_user
    ] = override_customer_user

    response = client.get(
        "/api/admin/warehouses/"
    )

    assert response.status_code == 403

    assert response.json()["detail"] == (
        "Insufficient permissions"
    )

    test_app.dependency_overrides[
        get_current_user
    ] = override_admin_user