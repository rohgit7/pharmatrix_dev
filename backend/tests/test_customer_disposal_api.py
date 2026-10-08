from datetime import datetime, timezone
from decimal import Decimal
from types import SimpleNamespace
from unittest.mock import patch

from fastapi import FastAPI, HTTPException
from fastapi.testclient import TestClient

from app.api.customer_disposal import router
from app.core.auth import get_current_user
from app.core.database import get_db
from app.models.enums import (
    DisposalShipmentStatus,
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
# Dummy DB
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


def override_db_with_customer():
    return DummyDB(
        customer=SimpleNamespace(
            id=10,
            user_id=100,
        )
    )


def override_db_without_customer():
    return DummyDB()


# ---------------------------------------------------------
# Fixtures
# ---------------------------------------------------------

def make_disposal_record():
    return {
        "pickup_id": 101,
        "pickup_code": "PU-001",
        "shipment_id": 501,
        "shipment_code": "SHIP-001",
        "facility_name": "Green Disposal Facility",
        "expected_weight_kg": Decimal("12.50"),
        "received_weight_kg": Decimal("12.20"),
        "shipment_status": DisposalShipmentStatus.RECEIVED,
        "dispatched_at": datetime(
            2026,
            10,
            1,
            10,
            0,
            tzinfo=timezone.utc,
        ),
        "received_at": datetime(
            2026,
            10,
            1,
            14,
            0,
            tzinfo=timezone.utc,
        ),
        "certificate_available": True,
    }


# ---------------------------------------------------------
# Disposal records
# ---------------------------------------------------------

@patch(
    "app.api.customer_disposal.get_customer_disposal_records"
)
def test_get_my_disposal_records_returns_records(
    get_records_mock,
):
    db = override_db_with_customer()

    def override_test_db():
        return db

    test_app.dependency_overrides[get_db] = (
        override_test_db
    )

    get_records_mock.return_value = [
        make_disposal_record()
    ]

    response = client.get(
        "/api/customer/disposal/"
    )

    assert response.status_code == 200

    body = response.json()

    assert len(body) == 1

    record = body[0]

    assert record["pickup_id"] == 101
    assert record["pickup_code"] == "PU-001"
    assert record["shipment_id"] == 501
    assert record["shipment_code"] == "SHIP-001"
    assert record["facility_name"] == (
        "Green Disposal Facility"
    )
    assert record["expected_weight_kg"] == "12.50"
    assert record["received_weight_kg"] == "12.20"
    assert record["shipment_status"] == "RECEIVED"
    assert record["certificate_available"] is True

    get_records_mock.assert_called_once_with(
        db=db,
        customer_id=10,
    )

    test_app.dependency_overrides.pop(
        get_db,
        None,
    )


# ---------------------------------------------------------
# Empty records
# ---------------------------------------------------------

@patch(
    "app.api.customer_disposal.get_customer_disposal_records"
)
def test_get_my_disposal_records_returns_empty_list(
    get_records_mock,
):
    db = override_db_with_customer()

    def override_test_db():
        return db

    test_app.dependency_overrides[get_db] = (
        override_test_db
    )

    get_records_mock.return_value = []

    response = client.get(
        "/api/customer/disposal/"
    )

    assert response.status_code == 200
    assert response.json() == []

    get_records_mock.assert_called_once_with(
        db=db,
        customer_id=10,
    )

    test_app.dependency_overrides.pop(
        get_db,
        None,
    )


# ---------------------------------------------------------
# Customer profile missing
# ---------------------------------------------------------

def test_get_my_disposal_records_returns_404_without_profile():
    db = override_db_without_customer()

    def override_test_db():
        return db

    test_app.dependency_overrides[get_db] = (
        override_test_db
    )

    response = client.get(
        "/api/customer/disposal/"
    )

    assert response.status_code == 404

    assert response.json()["detail"] == (
        "Customer profile not found"
    )

    test_app.dependency_overrides.pop(
        get_db,
        None,
    )


# ---------------------------------------------------------
# Authorization
# ---------------------------------------------------------

def test_get_my_disposal_records_rejects_non_customer():
    test_app.dependency_overrides[
        get_current_user
    ] = override_admin_user

    response = client.get(
        "/api/customer/disposal/"
    )

    assert response.status_code == 403

    assert response.json()["detail"] == (
        "Insufficient permissions"
    )

    test_app.dependency_overrides[
        get_current_user
    ] = override_customer_user