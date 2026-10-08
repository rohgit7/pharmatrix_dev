from datetime import date, datetime, timezone
from types import SimpleNamespace
from unittest.mock import patch
from uuid import uuid4

from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.api.drivers import router
from app.core.auth import get_current_user
from app.models.enums import DriverStatus, UserRole


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
    name="Test Driver",
    email="driver@test.local",
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

def make_driver(
    *,
    driver_id=1,
    user_id=200,
):
    now = datetime.now(timezone.utc)

    return SimpleNamespace(
        id=driver_id,
        user_id=user_id,
        employee_id="EMP001",
        phone="9876543210",
        license_number="LIC001",
        license_expiry=date(2030, 12, 31),
        status=DriverStatus.ACTIVE,
        is_available=True,
        created_at=now,
        updated_at=now,
    )


# ---------------------------------------------------------
# Create
# ---------------------------------------------------------

@patch(
    "app.api.drivers.create_driver"
)
def test_create_driver_endpoint(
    create_driver_mock,
):
    create_driver_mock.return_value = make_driver()

    response = client.post(
        "/api/admin/drivers/",
        json={
            "user_id": 200,
            "employee_id": "EMP001",
            "phone": "9876543210",
            "license_number": "LIC001",
            "license_expiry": "2030-12-31",
        },
    )

    assert response.status_code == 201

    body = response.json()

    assert body["id"] == 1
    assert body["user_id"] == 200
    assert body["employee_id"] == "EMP001"
    assert body["phone"] == "9876543210"
    assert body["license_number"] == "LIC001"
    assert body["status"] == "ACTIVE"
    assert body["is_available"] is True

    create_driver_mock.assert_called_once()

    args = create_driver_mock.call_args.args

    assert args[0] is not None

    data = args[1]

    assert data.user_id == 200
    assert data.employee_id == "EMP001"
    assert data.phone == "9876543210"
    assert data.license_number == "LIC001"
    assert data.license_expiry == date(2030, 12, 31)


def test_create_driver_validates_required_fields():
    response = client.post(
        "/api/admin/drivers/",
        json={
            "user_id": 200,
            "phone": "9876543210",
            "license_number": "LIC001",
        },
    )

    assert response.status_code == 422


# ---------------------------------------------------------
# List
# ---------------------------------------------------------

@patch(
    "app.api.drivers.list_drivers"
)
def test_list_drivers_endpoint(
    list_drivers_mock,
):
    list_drivers_mock.return_value = [
        make_driver(driver_id=1),
        make_driver(driver_id=2),
    ]

    response = client.get(
        "/api/admin/drivers/?skip=10&limit=20"
    )

    assert response.status_code == 200

    body = response.json()

    assert len(body) == 2
    assert body[0]["id"] == 1
    assert body[1]["id"] == 2

    list_drivers_mock.assert_called_once()

    args = list_drivers_mock.call_args.args

    assert args[0] is not None
    assert args[1] == 10
    assert args[2] == 20


def test_list_drivers_rejects_invalid_pagination():
    response = client.get(
        "/api/admin/drivers/?skip=-1"
    )

    assert response.status_code == 422

    response = client.get(
        "/api/admin/drivers/?limit=101"
    )

    assert response.status_code == 422


# ---------------------------------------------------------
# Get
# ---------------------------------------------------------

@patch(
    "app.api.drivers.get_driver"
)
def test_get_driver_endpoint(
    get_driver_mock,
):
    get_driver_mock.return_value = make_driver()

    response = client.get(
        "/api/admin/drivers/1"
    )

    assert response.status_code == 200

    body = response.json()

    assert body["id"] == 1
    assert body["employee_id"] == "EMP001"
    assert body["status"] == "ACTIVE"

    get_driver_mock.assert_called_once()

    args = get_driver_mock.call_args.args

    assert args[0] is not None
    assert args[1] == 1


# ---------------------------------------------------------
# Update
# ---------------------------------------------------------

@patch(
    "app.api.drivers.update_driver"
)
def test_update_driver_endpoint(
    update_driver_mock,
):
    updated = make_driver()

    updated.phone = "9999999999"
    updated.is_available = False

    update_driver_mock.return_value = updated

    response = client.patch(
        "/api/admin/drivers/1",
        json={
            "phone": "9999999999",
            "is_available": False,
        },
    )

    assert response.status_code == 200

    body = response.json()

    assert body["phone"] == "9999999999"
    assert body["is_available"] is False

    update_driver_mock.assert_called_once()

    args = update_driver_mock.call_args.args

    assert args[0] is not None
    assert args[1] == 1

    data = args[2]

    assert data.phone == "9999999999"
    assert data.is_available is False


# ---------------------------------------------------------
# Driver onboarding
# ---------------------------------------------------------

@patch(
    "app.api.drivers.onboard_driver"
)
def test_onboard_driver_endpoint(
    onboard_driver_mock,
):
    fake_user = SimpleNamespace(
        id=300,
        auth_user_id=uuid4(),
    )

    fake_driver = make_driver(
        driver_id=55,
        user_id=300,
    )

    onboard_driver_mock.return_value = (
        fake_user,
        fake_driver,
    )

    response = client.post(
        "/api/admin/drivers/onboard",
        json={
            "email": "newdriver@example.com",
            "name": "New Driver",
            "employee_id": "EMP55",
            "phone": "9888888888",
            "license_number": "LIC55",
            "license_expiry": "2031-01-01",
        },
    )

    assert response.status_code == 201

    body = response.json()

    assert body["driver_id"] == 55
    assert body["user_id"] == 300
    assert body["auth_user_id"] == str(
        fake_user.auth_user_id
    )

    assert body["message"] == (
        "Driver onboarded successfully. "
        "An invitation has been sent to the driver's email."
    )

    onboard_driver_mock.assert_called_once()

    kwargs = onboard_driver_mock.call_args.kwargs

    assert kwargs["db"] is not None

    data = kwargs["data"]

    assert data.email == "newdriver@example.com"
    assert data.name == "New Driver"
    assert data.employee_id == "EMP55"
    assert data.phone == "9888888888"
    assert data.license_number == "LIC55"
    assert data.license_expiry == date(2031, 1, 1)


def test_onboard_driver_validates_email():
    response = client.post(
        "/api/admin/drivers/onboard",
        json={
            "email": "not-an-email",
            "name": "New Driver",
            "employee_id": "EMP55",
            "phone": "9888888888",
            "license_number": "LIC55",
        },
    )

    assert response.status_code == 422


# ---------------------------------------------------------
# Driver self-profile
# ---------------------------------------------------------

@patch(
    "app.api.drivers.get_driver_by_user_id"
)
def test_get_my_driver_profile_endpoint(
    get_driver_mock,
):
    get_driver_mock.return_value = make_driver(
        driver_id=77,
        user_id=200,
    )

    test_app.dependency_overrides[
        get_current_user
    ] = override_driver_user

    response = client.get(
        "/api/admin/drivers/me"
    )

    test_app.dependency_overrides[
        get_current_user
    ] = override_admin_user

    assert response.status_code == 200

    body = response.json()

    assert body["id"] == 77
    assert body["user_id"] == 200
    assert body["employee_id"] == "EMP001"
    assert body["name"] == "Test Driver"
    assert body["email"] == "driver@test.local"
    assert body["phone"] == "9876543210"
    assert body["license_number"] == "LIC001"
    assert body["status"] == "ACTIVE"
    assert body["is_available"] is True

    get_driver_mock.assert_called_once()

    args = get_driver_mock.call_args.args

    assert args[0] is not None
    assert args[1] == 200


@patch(
    "app.api.drivers.get_driver_by_user_id"
)
def test_get_my_driver_profile_returns_404(
    get_driver_mock,
):
    get_driver_mock.return_value = None

    test_app.dependency_overrides[
        get_current_user
    ] = override_driver_user

    response = client.get(
        "/api/admin/drivers/me"
    )

    test_app.dependency_overrides[
        get_current_user
    ] = override_admin_user

    assert response.status_code == 404

    assert response.json()["detail"] == (
        "Driver profile not found"
    )


def test_get_my_driver_profile_rejects_admin():
    test_app.dependency_overrides[
        get_current_user
    ] = override_admin_user

    response = client.get(
        "/api/admin/drivers/me"
    )

    assert response.status_code in {
        403,
        422,
    }


# ---------------------------------------------------------
# Admin authorization
# ---------------------------------------------------------

def test_driver_admin_endpoints_reject_driver():
    test_app.dependency_overrides[
        get_current_user
    ] = override_driver_user

    response = client.get(
        "/api/admin/drivers/"
    )

    assert response.status_code == 403

    assert response.json()["detail"] == (
        "Insufficient permissions"
    )

    test_app.dependency_overrides[
        get_current_user
    ] = override_admin_user