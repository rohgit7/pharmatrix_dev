from types import SimpleNamespace
from unittest.mock import patch

from fastapi import FastAPI, HTTPException
from fastapi.testclient import TestClient

from app.api.customers import router
from app.core.auth import get_current_user
from app.core.database import get_db
from app.models.enums import CustomerType
from app.models.user import UserRole


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


# ---------------------------------------------------------
# Test client
# ---------------------------------------------------------

test_app.dependency_overrides[
    get_current_user
] = override_customer_user

client = TestClient(test_app)


# ---------------------------------------------------------
# Fixtures
# ---------------------------------------------------------

def make_customer():
    return SimpleNamespace(
        id=1,
        user_id=100,
        customer_type=CustomerType.PHARMACY,
        legal_name="ABC Pharmacy Pvt Ltd",
        display_name="ABC Pharmacy",
        phone="9876543210",
        email="abc@test.local",
        gst_number="29ABCDE1234F1Z5",
        is_active=True,
    )


def make_onboard_payload():
    return {
        "customer_type": "PHARMACY",
        "legal_name": "ABC Pharmacy Pvt Ltd",
        "display_name": "ABC Pharmacy",
        "phone": "9876543210",
        "email": "abc@test.local",
        "gst_number": "29ABCDE1234F1Z5",
        "profile": {
            "pharmacy_license_number": "KA-PH-12345",
            "pharmacist_name": "Rohan Kumar",
        },
        "location": {
            "location_code": "ABC-001",
            "name": "ABC Pharmacy Main Branch",
            "address_line_1": "123 Main Road",
            "address_line_2": "Near Hospital",
            "city": "Bengaluru",
            "state": "Karnataka",
            "postal_code": "560001",
            "latitude": 12.9716,
            "longitude": 77.5946,
            "contact_name": "Rohan Kumar",
            "contact_phone": "9876543210",
            "service_time_seconds": 300,
        },
    }


# ---------------------------------------------------------
# Onboarding
# ---------------------------------------------------------

@patch(
    "app.api.customers.create_customer"
)
def test_onboard_customer_endpoint(
    create_customer_mock,
):
    customer = make_customer()

    create_customer_mock.return_value = customer

    response = client.post(
        "/api/customers/onboard",
        json=make_onboard_payload(),
    )

    assert response.status_code == 201

    body = response.json()

    assert body["id"] == 1
    assert body["user_id"] == 100
    assert body["customer_type"] == "PHARMACY"
    assert body["legal_name"] == "ABC Pharmacy Pvt Ltd"
    assert body["display_name"] == "ABC Pharmacy"
    assert body["phone"] == "9876543210"
    assert body["email"] == "abc@test.local"
    assert body["gst_number"] == "29ABCDE1234F1Z5"
    assert body["is_active"] is True

    create_customer_mock.assert_called_once()

    call_kwargs = create_customer_mock.call_args.kwargs

    assert call_kwargs["user"] is customer_user
    assert call_kwargs["db"] is not None

    data = call_kwargs["data"]

    assert data.customer_type == CustomerType.PHARMACY
    assert data.legal_name == "ABC Pharmacy Pvt Ltd"
    assert data.display_name == "ABC Pharmacy"
    assert data.profile["pharmacy_license_number"] == "KA-PH-12345"
    assert data.location.location_code == "ABC-001"


@patch(
    "app.api.customers.create_customer"
)
def test_onboard_customer_supports_distributor(
    create_customer_mock,
):
    customer = make_customer()
    customer.customer_type = CustomerType.DISTRIBUTOR

    create_customer_mock.return_value = customer

    payload = make_onboard_payload()

    payload["customer_type"] = "DISTRIBUTOR"
    payload["profile"] = {
        "distribution_license_number": "DIST-12345",
        "warehouse_count": 3,
        "coverage_area": "Bengaluru Urban",
    }

    response = client.post(
        "/api/customers/onboard",
        json=payload,
    )

    assert response.status_code == 201
    assert response.json()["customer_type"] == "DISTRIBUTOR"


@patch(
    "app.api.customers.create_customer"
)
def test_onboard_returns_service_conflict(
    create_customer_mock,
):
    create_customer_mock.side_effect = HTTPException(
        status_code=409,
        detail="Customer profile already exists",
    )

    response = client.post(
        "/api/customers/onboard",
        json=make_onboard_payload(),
    )

    assert response.status_code == 409

    assert response.json()["detail"] == (
        "Customer profile already exists"
    )


def test_onboard_validates_required_fields():
    response = client.post(
        "/api/customers/onboard",
        json={
            "customer_type": "PHARMACY",
            "legal_name": "ABC Pharmacy",
        },
    )

    assert response.status_code == 422


def test_onboard_rejects_invalid_customer_type():
    response = client.post(
        "/api/customers/onboard",
        json={
            **make_onboard_payload(),
            "customer_type": "INVALID",
        },
    )

    assert response.status_code == 422


# ---------------------------------------------------------
# Authorization
# ---------------------------------------------------------

def test_onboard_rejects_non_customer():
    test_app.dependency_overrides[
        get_current_user
    ] = override_admin_user

    response = client.post(
        "/api/customers/onboard",
        json=make_onboard_payload(),
    )

    assert response.status_code == 403

    assert response.json()["detail"] == (
        "Insufficient permissions"
    )

    test_app.dependency_overrides[
        get_current_user
    ] = override_customer_user


# ---------------------------------------------------------
# Dummy DB for /me
# ---------------------------------------------------------

class DummyQuery:
    def __init__(self, customer=None):
        self.customer = customer

    def filter(self, *args, **kwargs):
        return self

    def first(self):
        return self.customer


class DummyDB:
    def __init__(self, customer=None):
        self.customer = customer

    def query(self, model):
        return DummyQuery(self.customer)


# ---------------------------------------------------------
# GET /me
# ---------------------------------------------------------

def test_get_my_customer_returns_onboarded_customer():
    customer = make_customer()

    db = DummyDB(customer)

    def override_test_db():
        return db

    test_app.dependency_overrides[
        get_db
    ] = override_test_db

    response = client.get(
        "/api/customers/me"
    )

    assert response.status_code == 200

    body = response.json()

    assert body["onboarded"] is True
    assert body["customer_id"] == 1
    assert body["customer_type"] == "PHARMACY"
    assert body["legal_name"] == "ABC Pharmacy Pvt Ltd"
    assert body["display_name"] == "ABC Pharmacy"

    test_app.dependency_overrides.pop(
        get_db,
        None,
    )


def test_get_my_customer_returns_not_onboarded():
    db = DummyDB(None)

    def override_test_db():
        return db

    test_app.dependency_overrides[
        get_db
    ] = override_test_db

    response = client.get(
        "/api/customers/me"
    )

    assert response.status_code == 200

    assert response.json() == {
        "onboarded": False
    }

    test_app.dependency_overrides.pop(
        get_db,
        None,
    )


def test_get_my_customer_rejects_non_customer():
    test_app.dependency_overrides[
        get_current_user
    ] = override_admin_user

    response = client.get(
        "/api/customers/me"
    )

    assert response.status_code == 403

    assert response.json()["detail"] == (
        "Insufficient permissions"
    )

    test_app.dependency_overrides[
        get_current_user
    ] = override_customer_user