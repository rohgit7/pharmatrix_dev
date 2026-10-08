from datetime import datetime, timezone
from types import SimpleNamespace
from unittest.mock import patch

from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.api.admin_warehouse_intakes import router
from app.core.auth import get_current_user
from app.models.enums import (
    UserRole,
    WasteBinColor,
    WasteType,
    WarehouseIntakeStatus,
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

client = TestClient(test_app)


# ---------------------------------------------------------
# Fixtures
# ---------------------------------------------------------

def make_intake(
    *,
    intake_id=1,
):
    now = datetime.now(timezone.utc)

    return SimpleNamespace(
        id=intake_id,
        intake_code="INT-001",
        route_id=10,
        warehouse_id=20,
        driver_id=30,
        vehicle_id=40,
        status=WarehouseIntakeStatus.PENDING,
        expected_weight_kg=10.0,
        received_weight_kg=None,
        received_at=None,
        discrepancy_reason=None,
        notes=None,
        created_at=now,
        updated_at=now,
        items=[],
    )


def make_classified_intake():
    intake = make_intake()

    intake.status = WarehouseIntakeStatus.RECEIVED
    intake.received_weight_kg = 10.0
    intake.received_at = datetime.now(timezone.utc)

    intake.items = [
        SimpleNamespace(
            id=1,
            intake_id=1,
            bin_color=WasteBinColor.YELLOW,
            waste_type=(
                WasteType.EXPIRED_DISCARDED_MEDICINE
            ),
            expected_weight_kg=6.0,
            received_weight_kg=6.0,
            notes="Expired medicines",
            created_at=datetime.now(timezone.utc),
        )
    ]

    return intake


# ---------------------------------------------------------
# Get intake
# ---------------------------------------------------------

def test_get_warehouse_intake_endpoint():
    intake = make_intake()

    class DummyQuery:
        def options(self, *args, **kwargs):
            return self

        def filter(self, *args, **kwargs):
            return self

        def first(self):
            return intake

    class DummyDB:
        def query(self, model):
            return DummyQuery()

    def override_db():
        return DummyDB()

    from app.core.database import get_db

    test_app.dependency_overrides[get_db] = override_db

    try:
        response = client.get(
            "/api/admin/warehouse-intakes/1"
        )

        assert response.status_code == 200

        body = response.json()

        assert body["id"] == 1
        assert body["intake_code"] == "INT-001"
        assert body["route_id"] == 10
        assert body["warehouse_id"] == 20
        assert body["status"] == "PENDING"
        assert body["expected_weight_kg"] == 10.0
        assert body["items"] == []

    finally:
        test_app.dependency_overrides.pop(
            get_db,
            None,
        )


def test_get_warehouse_intake_returns_404():
    class DummyQuery:
        def options(self, *args, **kwargs):
            return self

        def filter(self, *args, **kwargs):
            return self

        def first(self):
            return None

    class DummyDB:
        def query(self, model):
            return DummyQuery()

    def override_db():
        return DummyDB()

    from app.core.database import get_db

    test_app.dependency_overrides[get_db] = override_db

    try:
        response = client.get(
            "/api/admin/warehouse-intakes/999"
        )

        assert response.status_code == 404
        assert response.json()["detail"] == (
            "Warehouse intake not found"
        )

    finally:
        test_app.dependency_overrides.pop(
            get_db,
            None,
        )


# ---------------------------------------------------------
# Receive
# ---------------------------------------------------------

@patch(
    "app.api.admin_warehouse_intakes.receive_warehouse_intake"
)
def test_receive_warehouse_intake_endpoint(
    receive_mock,
):
    intake = make_intake()
    intake.status = WarehouseIntakeStatus.RECEIVED
    intake.received_weight_kg = 9.8
    intake.received_at = datetime.now(timezone.utc)
    intake.notes = "Received normally"

    receive_mock.return_value = intake

    response = client.post(
        "/api/admin/warehouse-intakes/1/receive",
        json={
            "received_weight_kg": 9.8,
            "discrepancy_reason": None,
            "notes": "Received normally",
        },
    )

    assert response.status_code == 200

    body = response.json()

    assert body["id"] == 1
    assert body["status"] == "RECEIVED"
    assert body["received_weight_kg"] == 9.8
    assert body["notes"] == "Received normally"

    receive_mock.assert_called_once()

    kwargs = receive_mock.call_args.kwargs

    assert kwargs["db"] is not None
    assert kwargs["intake_id"] == 1
    assert kwargs["received_weight_kg"] == 9.8
    assert kwargs["discrepancy_reason"] is None
    assert kwargs["notes"] == "Received normally"


def test_receive_warehouse_intake_validates_weight():
    response = client.post(
        "/api/admin/warehouse-intakes/1/receive",
        json={
            "received_weight_kg": 0,
        },
    )

    assert response.status_code == 422


# ---------------------------------------------------------
# Classification
# ---------------------------------------------------------

@patch(
    "app.api.admin_warehouse_intakes.classify_warehouse_intake"
)
def test_classify_warehouse_intake_endpoint(
    classify_mock,
):
    intake = make_classified_intake()

    classify_mock.return_value = intake

    response = client.post(
        "/api/admin/warehouse-intakes/1/classify",
        json={
            "items": [
                {
                    "bin_color": "YELLOW",
                    "waste_type": (
                        "EXPIRED_DISCARDED_MEDICINE"
                    ),
                    "expected_weight_kg": 6.0,
                    "received_weight_kg": 6.0,
                    "notes": "Expired medicines",
                },
                {
                    "bin_color": "RED",
                    "waste_type": "SHARPS",
                    "expected_weight_kg": 4.0,
                    "received_weight_kg": 4.0,
                    "notes": "Sharps",
                },
            ]
        },
    )

    assert response.status_code == 200

    body = response.json()

    assert body["id"] == 1
    assert body["status"] == "RECEIVED"
    assert body["received_weight_kg"] == 10.0

    assert len(body["items"]) == 1

    classify_mock.assert_called_once()

    kwargs = classify_mock.call_args.kwargs

    assert kwargs["db"] is not None
    assert kwargs["intake_id"] == 1
    assert len(kwargs["items"]) == 2

    assert (
        kwargs["items"][0].bin_color
        == WasteBinColor.YELLOW
    )

    assert (
        kwargs["items"][0].waste_type
        == WasteType.EXPIRED_DISCARDED_MEDICINE
    )


def test_classify_warehouse_intake_requires_items():
    response = client.post(
        "/api/admin/warehouse-intakes/1/classify",
        json={
            "items": []
        },
    )

    assert response.status_code == 422


# ---------------------------------------------------------
# Authorization
# ---------------------------------------------------------

def test_warehouse_intake_endpoints_reject_customer():
    test_app.dependency_overrides[
        get_current_user
    ] = override_customer_user

    response = client.get(
        "/api/admin/warehouse-intakes/1"
    )

    assert response.status_code == 403

    assert response.json()["detail"] == (
        "Insufficient permissions"
    )

    test_app.dependency_overrides[
        get_current_user
    ] = override_admin_user