from datetime import datetime, timezone
from decimal import Decimal
from types import SimpleNamespace
from unittest.mock import patch
from uuid import UUID, uuid4

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.api.facility_disposal_shipments import router
from app.core.auth import get_current_user
from app.core.database import get_db
from app.models.enums import (
    DisposalShipmentStatus,
    UserRole,
)

SHIPMENT_PUBLIC_ID = UUID("c8d415b3-8b77-4be8-b56a-475455220bc9")
OTHER_SHIPMENT_PUBLIC_ID = UUID("a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d")
NONEXISTENT_SHIPMENT_ID = UUID("99999999-9999-9999-9999-999999999999")

FACILITY_USER_ID = 40
FACILITY_ID = 20
OTHER_FACILITY_ID = 99


# ---------------------------------------------------------
# Test Application Setup
# ---------------------------------------------------------

test_app = FastAPI()
test_app.include_router(router)

facility_user = SimpleNamespace(
    id=FACILITY_USER_ID,
    role=UserRole.FACILITY,
)

driver_user = SimpleNamespace(
    id=201,
    role=UserRole.DRIVER,
)

customer_user = SimpleNamespace(
    id=202,
    role=UserRole.CUSTOMER,
)


def override_facility_user():
    return facility_user


def override_driver_user():
    return driver_user


def override_customer_user():
    return customer_user


test_app.dependency_overrides[get_current_user] = override_facility_user


# ---------------------------------------------------------
# Mock Database & Models
# ---------------------------------------------------------

def make_facility(*, facility_id=FACILITY_ID, user_id=FACILITY_USER_ID):
    return SimpleNamespace(
        id=facility_id,
        user_id=user_id,
        facility_code="FAC-TEST-001",
        legal_name="Test Treatment Facility",
        phone="9876543210",
        email="facility@test.com",
        active=True,
    )


def make_shipment(
    *,
    id=1,
    public_id=SHIPMENT_PUBLIC_ID,
    facility_id=FACILITY_ID,
    status=DisposalShipmentStatus.IN_TRANSIT,
):
    item1 = SimpleNamespace(
        id=10,
        warehouse_intake_item_id=101,
        expected_weight_kg=Decimal("15.50"),
        received_weight_kg=None,
        notes=None,
    )
    return SimpleNamespace(
        id=id,
        public_id=public_id,
        shipment_code="DS-FAC001",
        intake_id=5,
        facility_id=facility_id,
        status=status,
        expected_weight_kg=Decimal("15.50"),
        received_weight_kg=None,
        dispatched_at=datetime.now(timezone.utc),
        received_at=None,
        discrepancy_reason=None,
        notes="Consignment in transit",
        items=[item1],
    )


class MockQuery:
    def __init__(self, data):
        self._data = data

    def filter(self, *args, **kwargs):
        return self

    def options(self, *args, **kwargs):
        return self

    def order_by(self, *args, **kwargs):
        return self

    def all(self):
        return self._data if isinstance(self._data, list) else [self._data]

    def first(self):
        return self._data[0] if isinstance(self._data, list) and self._data else self._data


class MockDB:
    def __init__(self):
        self.facility = make_facility()
        self.shipments = {
            SHIPMENT_PUBLIC_ID: make_shipment(id=1, facility_id=FACILITY_ID),
            OTHER_SHIPMENT_PUBLIC_ID: make_shipment(id=2, public_id=OTHER_SHIPMENT_PUBLIC_ID, facility_id=OTHER_FACILITY_ID),
        }
        self.commit_called = False
        self.refreshed = False

    def scalar(self, statement):
        # Inspect statement to return appropriate mock model
        stmt_str = str(statement)
        if "FROM facilities" in stmt_str or "facilities.user_id" in stmt_str:
            return self.facility

        if "FROM disposal_shipments" in stmt_str:
            # Check which public_id is being queried
            for pid, sh in self.shipments.items():
                if str(pid) in stmt_str or pid in getattr(statement, "_where_criteria", []):
                    return sh
            # Fallback by checking parameters
            compile_params = statement.compile().params
            for val in compile_params.values():
                if val in self.shipments:
                    return self.shipments[val]
                if isinstance(val, UUID) and val in self.shipments:
                    return self.shipments[val]
            return None

        return None

    def scalars(self, statement):
        facility_shipments = [
            s for s in self.shipments.values()
            if s.facility_id == self.facility.id
        ]
        return SimpleNamespace(
            unique=lambda: SimpleNamespace(all=lambda: facility_shipments)
        )

    def commit(self):
        self.commit_called = True

    def refresh(self, instance):
        self.refreshed = True


mock_db = MockDB()


def override_db():
    return mock_db


test_app.dependency_overrides[get_db] = override_db

client = TestClient(test_app)


# ---------------------------------------------------------
# Test Cases
# ---------------------------------------------------------

@patch("app.api.facility_disposal_shipments.receive_disposal_shipment")
def test_receive_shipment_success(mock_receive_service):
    """
    Test successful receipt of an in-transit shipment belonging to the facility.
    Verifies that the endpoint returns 200 and passes integer shipment.id to service.
    """
    mock_db.facility = make_facility(facility_id=FACILITY_ID)
    test_shipment = make_shipment(id=1, public_id=SHIPMENT_PUBLIC_ID, facility_id=FACILITY_ID)
    mock_db.shipments[SHIPMENT_PUBLIC_ID] = test_shipment

    received_shipment = make_shipment(
        id=1,
        public_id=SHIPMENT_PUBLIC_ID,
        facility_id=FACILITY_ID,
        status=DisposalShipmentStatus.RECEIVED,
    )
    received_shipment.received_weight_kg = Decimal("15.50")
    received_shipment.received_at = datetime.now(timezone.utc)
    received_shipment.items[0].received_weight_kg = Decimal("15.50")
    mock_receive_service.return_value = received_shipment

    payload = {
        "items": [
            {
                "shipment_item_id": 10,
                "received_weight_kg": "15.50",
            }
        ],
        "notes": "Verified on treatment scale",
    }

    response = client.post(
        f"/api/facility/disposal-shipments/{SHIPMENT_PUBLIC_ID}/receive",
        json=payload,
    )

    assert response.status_code == 200
    body = response.json()

    assert body["id"] == 1
    assert body["public_id"] == str(SHIPMENT_PUBLIC_ID)
    assert body["facility_id"] == FACILITY_ID
    assert body["status"] == "RECEIVED"
    assert body["received_weight_kg"] == "15.50"

    mock_receive_service.assert_called_once()
    call_kwargs = mock_receive_service.call_args.kwargs
    assert call_kwargs["shipment_id"] == 1
    assert call_kwargs["notes"] == "Verified on treatment scale"
    assert len(call_kwargs["received_items"]) == 1
    assert call_kwargs["received_items"][0]["shipment_item_id"] == 10
    assert call_kwargs["received_items"][0]["received_weight_kg"] == Decimal("15.50")

    assert mock_db.commit_called is True


def test_receive_shipment_nonexistent_returns_404():
    """
    Test receiving a shipment with a UUID that does not exist in the database.
    Must return 404 Not Found with 'Disposal shipment not found'.
    """
    mock_db.facility = make_facility(facility_id=FACILITY_ID)

    payload = {
        "items": [
            {
                "shipment_item_id": 10,
                "received_weight_kg": "10.00",
            }
        ],
    }

    response = client.post(
        f"/api/facility/disposal-shipments/{NONEXISTENT_SHIPMENT_ID}/receive",
        json=payload,
    )

    assert response.status_code == 404
    assert response.json()["detail"] == "Disposal shipment not found"


def test_receive_shipment_cross_facility_access_returns_403():
    """
    Test receiving a shipment that belongs to a different treatment facility.
    Must return 403 Forbidden with cross-facility access error.
    """
    mock_db.facility = make_facility(facility_id=FACILITY_ID)
    # OTHER_SHIPMENT_PUBLIC_ID is assigned to OTHER_FACILITY_ID (99)
    other_shipment = make_shipment(
        id=2,
        public_id=OTHER_SHIPMENT_PUBLIC_ID,
        facility_id=OTHER_FACILITY_ID,
    )
    mock_db.shipments[OTHER_SHIPMENT_PUBLIC_ID] = other_shipment

    payload = {
        "items": [
            {
                "shipment_item_id": 10,
                "received_weight_kg": "15.50",
            }
        ],
    }

    response = client.post(
        f"/api/facility/disposal-shipments/{OTHER_SHIPMENT_PUBLIC_ID}/receive",
        json=payload,
    )

    assert response.status_code == 403
    assert "Shipment belongs to another facility" in response.json()["detail"]


def test_receive_shipment_missing_facility_profile_returns_404():
    """
    Test when authenticated user has FACILITY role but has no Facility profile.
    Must return 404 Not Found with 'Facility profile not found'.
    """
    mock_db.facility = None

    payload = {
        "items": [
            {
                "shipment_item_id": 10,
                "received_weight_kg": "15.50",
            }
        ],
    }

    response = client.post(
        f"/api/facility/disposal-shipments/{SHIPMENT_PUBLIC_ID}/receive",
        json=payload,
    )

    assert response.status_code == 404
    assert response.json()["detail"] == "Facility profile not found"

    # Restore facility
    mock_db.facility = make_facility(facility_id=FACILITY_ID)


def test_receive_shipment_rejects_non_facility_roles():
    """
    Test that users without FACILITY role (e.g. DRIVER, CUSTOMER) are rejected with 403.
    """
    test_app.dependency_overrides[get_current_user] = override_driver_user

    response = client.post(
        f"/api/facility/disposal-shipments/{SHIPMENT_PUBLIC_ID}/receive",
        json={"items": [{"shipment_item_id": 10, "received_weight_kg": "15.50"}]},
    )

    assert response.status_code == 403
    assert response.json()["detail"] == "Insufficient permissions"

    test_app.dependency_overrides[get_current_user] = override_customer_user

    response = client.post(
        f"/api/facility/disposal-shipments/{SHIPMENT_PUBLIC_ID}/receive",
        json={"items": [{"shipment_item_id": 10, "received_weight_kg": "15.50"}]},
    )

    assert response.status_code == 403
    assert response.json()["detail"] == "Insufficient permissions"

    # Reset to facility user
    test_app.dependency_overrides[get_current_user] = override_facility_user


def test_list_incoming_shipments_success():
    """
    Test GET /api/facility/disposal-shipments/ returns shipments for the facility.
    """
    mock_db.facility = make_facility(facility_id=FACILITY_ID)

    response = client.get("/api/facility/disposal-shipments/")
    assert response.status_code == 200
    shipments = response.json()
    assert isinstance(shipments, list)
    for s in shipments:
        assert s["facility_id"] == FACILITY_ID


def test_receive_shipment_created_status_returns_409():
    """
    Test receiving a shipment that is still in CREATED state (not dispatched yet).
    Must return 409 Conflict with informative error message.
    """
    mock_db.facility = make_facility(facility_id=FACILITY_ID)
    created_shipment = make_shipment(
        id=1,
        public_id=SHIPMENT_PUBLIC_ID,
        facility_id=FACILITY_ID,
        status=DisposalShipmentStatus.CREATED,
    )
    mock_db.shipments[SHIPMENT_PUBLIC_ID] = created_shipment

    payload = {
        "items": [
            {
                "shipment_item_id": 10,
                "received_weight_kg": "15.50",
            }
        ],
    }

    response = client.post(
        f"/api/facility/disposal-shipments/{SHIPMENT_PUBLIC_ID}/receive",
        json=payload,
    )

    assert response.status_code == 409
    data = response.json()
    assert "is not in transit" in data["detail"]
    assert "CREATED" in data["detail"]
    assert "must be dispatched" in data["detail"]


def test_receive_shipment_duplicate_receipt_returns_409():
    """
    Test receiving a shipment that has already been received (RECEIVED status).
    Must return 409 Conflict with duplicate receipt error.
    """
    mock_db.facility = make_facility(facility_id=FACILITY_ID)
    received_shipment = make_shipment(
        id=1,
        public_id=SHIPMENT_PUBLIC_ID,
        facility_id=FACILITY_ID,
        status=DisposalShipmentStatus.RECEIVED,
    )
    mock_db.shipments[SHIPMENT_PUBLIC_ID] = received_shipment

    payload = {
        "items": [
            {
                "shipment_item_id": 10,
                "received_weight_kg": "15.50",
            }
        ],
    }

    response = client.post(
        f"/api/facility/disposal-shipments/{SHIPMENT_PUBLIC_ID}/receive",
        json=payload,
    )

    assert response.status_code == 409
    data = response.json()
    assert "Duplicate receipt" in data["detail"]
    assert "already been received" in data["detail"]


def test_receive_shipment_duplicate_receipt_discrepancy_returns_409():
    """
    Test receiving a shipment that is in DISCREPANCY status (already received with discrepancy).
    Must return 409 Conflict with duplicate receipt error.
    """
    mock_db.facility = make_facility(facility_id=FACILITY_ID)
    discrepancy_shipment = make_shipment(
        id=1,
        public_id=SHIPMENT_PUBLIC_ID,
        facility_id=FACILITY_ID,
        status=DisposalShipmentStatus.DISCREPANCY,
    )
    mock_db.shipments[SHIPMENT_PUBLIC_ID] = discrepancy_shipment

    payload = {
        "items": [
            {
                "shipment_item_id": 10,
                "received_weight_kg": "12.00",
            }
        ],
    }

    response = client.post(
        f"/api/facility/disposal-shipments/{SHIPMENT_PUBLIC_ID}/receive",
        json=payload,
    )

    assert response.status_code == 409
    data = response.json()
    assert "Duplicate receipt" in data["detail"]
    assert "already been received" in data["detail"]

