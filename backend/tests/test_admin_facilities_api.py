from datetime import datetime, timezone
from types import SimpleNamespace
from unittest.mock import patch

from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.api.admin_facilities import router
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

def make_facility(
    *,
    facility_id=1,
    active=True,
):
    now = datetime.now(timezone.utc)

    return SimpleNamespace(
        id=facility_id,
        user_id=300,
        facility_code="FAC001",
        legal_name="Test Disposal Facility",
        phone="9876543210",
        email="facility@test.local",
        license_number="LIC-FAC001",
        license_expiry=datetime(
            2030,
            12,
            31,
            tzinfo=timezone.utc,
        ),
        address="Facility Road",
        city="Bengaluru",
        state="Karnataka",
        postal_code="560020",
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
    "app.api.admin_facilities.create_facility"
)
def test_create_facility_endpoint(
    create_facility_mock,
):
    create_facility_mock.return_value = (
        make_facility()
    )

    response = client.post(
        "/api/admin/facilities/",
        json={
            "user_id": 300,
            "facility_code": "FAC001",
            "legal_name": "Test Disposal Facility",
            "phone": "9876543210",
            "email": "facility@test.local",
            "license_number": "LIC-FAC001",
            "license_expiry": "2030-12-31T00:00:00Z",
            "address": "Facility Road",
            "city": "Bengaluru",
            "state": "Karnataka",
            "postal_code": "560020",
            "latitude": 12.9716,
            "longitude": 77.5946,
        },
    )

    assert response.status_code == 201

    body = response.json()

    assert body["id"] == 1
    assert body["user_id"] == 300
    assert body["facility_code"] == "FAC001"
    assert body["legal_name"] == (
        "Test Disposal Facility"
    )
    assert body["city"] == "Bengaluru"
    assert body["active"] is True

    create_facility_mock.assert_called_once()

    kwargs = create_facility_mock.call_args.kwargs

    assert kwargs["db"] is not None

    data = kwargs["data"]

    assert data.user_id == 300
    assert data.facility_code == "FAC001"
    assert data.legal_name == (
        "Test Disposal Facility"
    )
    assert data.license_number == "LIC-FAC001"
    assert data.latitude == 12.9716
    assert data.longitude == 77.5946


def test_create_facility_validates_required_fields():
    response = client.post(
        "/api/admin/facilities/",
        json={
            "user_id": 300,
            "facility_code": "FAC001",
            "legal_name": "Test Facility",
        },
    )

    assert response.status_code == 422


# ---------------------------------------------------------
# List
# ---------------------------------------------------------

@patch(
    "app.api.admin_facilities.list_facilities"
)
def test_list_facilities_defaults_to_active_only(
    list_facilities_mock,
):
    list_facilities_mock.return_value = [
        make_facility(),
    ]

    response = client.get(
        "/api/admin/facilities/"
    )

    assert response.status_code == 200

    body = response.json()

    assert len(body) == 1
    assert body[0]["id"] == 1
    assert body[0]["active"] is True

    list_facilities_mock.assert_called_once()

    kwargs = list_facilities_mock.call_args.kwargs

    assert kwargs["db"] is not None
    assert kwargs["include_inactive"] is False


@patch(
    "app.api.admin_facilities.list_facilities"
)
def test_list_facilities_can_include_inactive(
    list_facilities_mock,
):
    list_facilities_mock.return_value = [
        make_facility(
            facility_id=1,
            active=True,
        ),
        make_facility(
            facility_id=2,
            active=False,
        ),
    ]

    response = client.get(
        "/api/admin/facilities/?include_inactive=true"
    )

    assert response.status_code == 200

    body = response.json()

    assert len(body) == 2
    assert body[1]["active"] is False

    list_facilities_mock.assert_called_once()

    kwargs = list_facilities_mock.call_args.kwargs

    assert kwargs["include_inactive"] is True


# ---------------------------------------------------------
# Get
# ---------------------------------------------------------

@patch(
    "app.api.admin_facilities.get_facility"
)
def test_get_facility_endpoint(
    get_facility_mock,
):
    get_facility_mock.return_value = make_facility()

    response = client.get(
        "/api/admin/facilities/1"
    )

    assert response.status_code == 200

    body = response.json()

    assert body["id"] == 1
    assert body["facility_code"] == "FAC001"
    assert body["legal_name"] == (
        "Test Disposal Facility"
    )

    get_facility_mock.assert_called_once()

    kwargs = get_facility_mock.call_args.kwargs

    assert kwargs["db"] is not None
    assert kwargs["facility_id"] == 1


# ---------------------------------------------------------
# Update
# ---------------------------------------------------------

@patch(
    "app.api.admin_facilities.update_facility"
)
def test_update_facility_endpoint(
    update_facility_mock,
):
    updated = make_facility()

    updated.legal_name = "Updated Facility"
    updated.city = "Mysuru"
    updated.active = False

    update_facility_mock.return_value = updated

    response = client.patch(
        "/api/admin/facilities/1",
        json={
            "legal_name": "Updated Facility",
            "city": "Mysuru",
            "active": False,
        },
    )

    assert response.status_code == 200

    body = response.json()

    assert body["legal_name"] == (
        "Updated Facility"
    )
    assert body["city"] == "Mysuru"
    assert body["active"] is False

    update_facility_mock.assert_called_once()

    kwargs = update_facility_mock.call_args.kwargs

    assert kwargs["db"] is not None
    assert kwargs["facility_id"] == 1

    data = kwargs["data"]

    assert data.legal_name == "Updated Facility"
    assert data.city == "Mysuru"
    assert data.active is False


# ---------------------------------------------------------
# Authorization
# ---------------------------------------------------------

def test_facility_admin_endpoints_reject_customer():
    test_app.dependency_overrides[
        get_current_user
    ] = override_customer_user

    response = client.get(
        "/api/admin/facilities/"
    )

    assert response.status_code == 403

    assert response.json()["detail"] == (
        "Insufficient permissions"
    )

    test_app.dependency_overrides[
        get_current_user
    ] = override_admin_user