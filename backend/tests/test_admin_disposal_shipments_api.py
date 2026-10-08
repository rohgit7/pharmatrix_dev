from datetime import datetime, timezone
from decimal import Decimal
from types import SimpleNamespace
from unittest.mock import patch

from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.api.admin_disposal_shipments import router
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


# ---------------------------------------------------------
# Dummy DB
# ---------------------------------------------------------

class DummyDB:
    def __init__(self):
        self.commit_called = False

    def commit(self):
        self.commit_called = True

    def refresh(self, instance):
        pass


dummy_db = DummyDB()


def override_db():
    return dummy_db


test_app.dependency_overrides[
    get_db
] = override_db


client = TestClient(test_app)


# ---------------------------------------------------------
# Fixture
# ---------------------------------------------------------

def make_shipment(
    *,
    shipment_id=1,
    status=DisposalShipmentStatus.CREATED,
):
    return SimpleNamespace(
        id=shipment_id,
        shipment_code="DS-ABCD1234",
        intake_id=10,
        facility_id=20,
        status=status,
        expected_weight_kg=Decimal("10.00"),
        received_weight_kg=None,
        dispatched_at=None,
        received_at=None,
        discrepancy_reason=None,
        notes="Test shipment",
        items=[],
    )


# ---------------------------------------------------------
# Create shipment
# ---------------------------------------------------------

@patch(
    "app.api.admin_disposal_shipments.create_disposal_shipment"
)
def test_create_disposal_shipment_endpoint(
    create_shipment_mock,
):
    create_shipment_mock.return_value = (
        make_shipment()
    )

    response = client.post(
        "/api/admin/disposal-shipments/",
        json={
            "intake_id": 10,
            "facility_id": 20,
            "items": [
                {
                    "warehouse_intake_item_id": 101,
                    "expected_weight_kg": "6.00",
                },
                {
                    "warehouse_intake_item_id": 102,
                    "expected_weight_kg": "4.00",
                },
            ],
            "notes": "Send for disposal",
        },
    )

    assert response.status_code == 200

    body = response.json()

    assert body["id"] == 1
    assert body["shipment_code"] == "DS-ABCD1234"
    assert body["intake_id"] == 10
    assert body["facility_id"] == 20
    assert body["status"] == "CREATED"
    assert body["expected_weight_kg"] == "10.00"
    assert body["notes"] == "Test shipment"

    create_shipment_mock.assert_called_once()

    kwargs = create_shipment_mock.call_args.kwargs

    assert kwargs["db"] is dummy_db
    assert kwargs["intake_id"] == 10
    assert kwargs["facility_id"] == 20
    assert kwargs["notes"] == "Send for disposal"

    assert kwargs["items"] == [
        {
            "warehouse_intake_item_id": 101,
            "expected_weight_kg": Decimal("6.00"),
        },
        {
            "warehouse_intake_item_id": 102,
            "expected_weight_kg": Decimal("4.00"),
        },
    ]

    assert dummy_db.commit_called is True


# ---------------------------------------------------------
# Dispatch
# ---------------------------------------------------------

@patch(
    "app.api.admin_disposal_shipments.dispatch_disposal_shipment"
)
def test_dispatch_disposal_shipment_endpoint(
    dispatch_shipment_mock,
):
    shipment = make_shipment(
        status=DisposalShipmentStatus.IN_TRANSIT
    )

    shipment.dispatched_at = datetime.now(
        timezone.utc
    )

    dispatch_shipment_mock.return_value = shipment

    response = client.post(
        "/api/admin/disposal-shipments/1/dispatch"
    )

    assert response.status_code == 200

    body = response.json()

    assert body["id"] == 1
    assert body["shipment_code"] == "DS-ABCD1234"
    assert body["status"] == "IN_TRANSIT"
    assert body["dispatched_at"] is not None

    dispatch_shipment_mock.assert_called_once()

    kwargs = dispatch_shipment_mock.call_args.kwargs

    assert kwargs["db"] is dummy_db
    assert kwargs["shipment_id"] == 1


# ---------------------------------------------------------
# Request validation
# ---------------------------------------------------------

def test_create_disposal_shipment_validates_required_fields():
    response = client.post(
        "/api/admin/disposal-shipments/",
        json={
            "facility_id": 20,
            "items": [
                {
                    "warehouse_intake_item_id": 101,
                    "expected_weight_kg": "5.00",
                }
            ],
        },
    )

    assert response.status_code == 422


def test_create_disposal_shipment_accepts_empty_items_at_schema_level():
    with patch(
        "app.api.admin_disposal_shipments.create_disposal_shipment"
    ) as create_shipment_mock:

        create_shipment_mock.return_value = (
            make_shipment()
        )

        response = client.post(
            "/api/admin/disposal-shipments/",
            json={
                "intake_id": 10,
                "facility_id": 20,
                "items": [],
            },
        )

        assert response.status_code == 200

        create_shipment_mock.assert_called_once()

        kwargs = (
            create_shipment_mock.call_args.kwargs
        )

        assert kwargs["items"] == []


# ---------------------------------------------------------
# Authorization
# ---------------------------------------------------------

def test_disposal_shipment_admin_endpoints_reject_customer():
    test_app.dependency_overrides[
        get_current_user
    ] = override_customer_user

    response = client.post(
        "/api/admin/disposal-shipments/1/dispatch"
    )

    assert response.status_code == 403

    assert response.json()["detail"] == (
        "Insufficient permissions"
    )

    test_app.dependency_overrides[
        get_current_user
    ] = override_admin_user