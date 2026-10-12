from datetime import datetime, timezone
from decimal import Decimal
from types import SimpleNamespace
from unittest.mock import patch

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.api.payments import router
from app.core.auth import get_current_user
from app.core.database import get_db
from app.models.user import UserRole
from app.services.payment_service import PaymentError


app = FastAPI()
app.include_router(router)


class DummyDB:
    def __init__(self):
        self.committed = False
        self.rolled_back = False
        self.refreshed = None

    def commit(self):
        self.committed = True

    def rollback(self):
        self.rolled_back = True

    def refresh(self, obj):
        self.refreshed = obj


admin_user = SimpleNamespace(id=100, role=UserRole.ADMIN)
customer_user = SimpleNamespace(id=200, role=UserRole.CUSTOMER)


def override_db():
    return DummyDB()


def make_payment(payment_id=1, invoice_id=10, amount="110.00"):
    now = datetime.now(timezone.utc)
    return SimpleNamespace(
        id=payment_id,
        invoice_id=invoice_id,
        amount=Decimal(amount),
        payment_method="UPI",
        status="COMPLETED",
        payment_reference=f"PAY-{payment_id:03d}",
        notes="Test payment",
        paid_at=now,
        created_at=now,
    )


def valid_payload():
    return {
        "invoice_id": 10,
        "amount": "110.00",
        "payment_method": "UPI",
        "payment_reference": "PAY-001",
        "notes": "Test payment",
    }


@pytest.fixture(autouse=True)
def reset_dependencies():
    app.dependency_overrides[get_current_user] = lambda: admin_user
    app.dependency_overrides[get_db] = override_db
    yield
    app.dependency_overrides.clear()


@pytest.fixture
def client():
    with TestClient(app) as test_client:
        yield test_client


@patch("app.api.payments.record_payment")
def test_create_payment_success(record_payment_mock, client):
    payment = make_payment()
    record_payment_mock.return_value = payment
    db = DummyDB()
    app.dependency_overrides[get_db] = lambda: db

    response = client.post("/api/admin/payments/", json=valid_payload())

    assert response.status_code == 201
    body = response.json()
    assert body["id"] == 1
    assert body["invoice_id"] == 10
    assert body["amount"] == "110.00"
    assert body["payment_method"] == "UPI"
    assert body["status"] == "COMPLETED"
    assert body["payment_reference"] == "PAY-001"

    record_payment_mock.assert_called_once()
    assert record_payment_mock.call_args.kwargs["amount"] == Decimal("110.00")
    assert db.committed
    assert db.refreshed is payment


@patch("app.api.payments.record_payment")
def test_create_payment_missing_invoice_returns_404(
    record_payment_mock, client
):
    record_payment_mock.side_effect = PaymentError("Invoice not found")
    db = DummyDB()
    app.dependency_overrides[get_db] = lambda: db

    response = client.post("/api/admin/payments/", json=valid_payload())

    assert response.status_code == 404
    assert response.json()["detail"] == "Invoice not found"
    assert db.rolled_back
    assert not db.committed


@pytest.mark.parametrize(
    "message",
    [
        "Invoice is already fully paid.",
        "Payment exceeds the outstanding invoice amount.",
        "Payment amount must be greater than zero.",
        "Unsupported payment method.",
    ],
)
@patch("app.api.payments.record_payment")
def test_payment_service_errors_return_400(
    record_payment_mock, message, client
):
    record_payment_mock.side_effect = PaymentError(message)
    db = DummyDB()
    app.dependency_overrides[get_db] = lambda: db

    response = client.post("/api/admin/payments/", json=valid_payload())

    assert response.status_code == 400
    assert response.json()["detail"] == message
    assert db.rolled_back
    assert not db.committed


@pytest.mark.parametrize(
    "payload",
    [
        {"amount": "110.00", "payment_method": "UPI"},
        {"invoice_id": 10, "amount": "0", "payment_method": "UPI"},
        {"invoice_id": 10, "amount": "-5.00", "payment_method": "UPI"},
        {"invoice_id": 10, "amount": "110.00", "payment_method": "INVALID"},
        {"invoice_id": 0, "amount": "110.00", "payment_method": "UPI"},
        {"invoice_id": -1, "amount": "110.00", "payment_method": "UPI"},
        {"invoice_id": 10, "amount": "110.00"},
    ],
)
@patch("app.api.payments.record_payment")
def test_create_payment_rejects_invalid_payloads(
    record_payment_mock, payload, client
):
    response = client.post("/api/admin/payments/", json=payload)

    assert response.status_code == 422
    record_payment_mock.assert_not_called()


def test_non_admin_cannot_create_payment(client):
    app.dependency_overrides[get_current_user] = lambda: customer_user

    response = client.post("/api/admin/payments/", json=valid_payload())

    assert response.status_code == 403
    assert response.json()["detail"] == "Insufficient permissions"


def test_non_admin_cannot_view_payment_history(client):
    app.dependency_overrides[get_current_user] = lambda: customer_user

    response = client.get("/api/admin/payments/invoice/10")

    assert response.status_code == 403
    assert response.json()["detail"] == "Insufficient permissions"


def test_unauthenticated_user_cannot_create_payment(client):
    app.dependency_overrides.pop(get_current_user, None)

    response = client.post("/api/admin/payments/", json=valid_payload())

    assert response.status_code in (401, 403)


def test_unauthenticated_user_cannot_view_payment_history(client):
    app.dependency_overrides.pop(get_current_user, None)

    response = client.get("/api/admin/payments/invoice/10")

    assert response.status_code in (401, 403)


@patch("app.api.payments.get_invoice_payments")
def test_payment_history_returns_payments(history_mock, client):
    history_mock.return_value = [
        make_payment(2, 10, "50.00"),
        make_payment(1, 10, "60.00"),
    ]

    response = client.get("/api/admin/payments/invoice/10")

    assert response.status_code == 200
    body = response.json()
    assert len(body) == 2
    assert body[0]["id"] == 2
    assert body[1]["id"] == 1
    history_mock.assert_called_once()


@patch("app.api.payments.get_invoice_payments")
def test_payment_history_missing_invoice_returns_404(
    history_mock, client
):
    history_mock.side_effect = PaymentError("Invoice not found")
    db = DummyDB()
    app.dependency_overrides[get_db] = lambda: db

    response = client.get("/api/admin/payments/invoice/999")

    assert response.status_code == 404
    assert response.json()["detail"] == "Invoice not found"
    assert db.rolled_back


def test_payment_history_rejects_invalid_invoice_id(client):
    response = client.get("/api/admin/payments/invoice/0")

    assert response.status_code == 422




def test_create_payment_forwards_idempotency_key(client, monkeypatch):
    from unittest.mock import Mock

    mock_record_payment = Mock(return_value=make_payment())
    monkeypatch.setattr(
        "app.api.payments.record_payment",
        mock_record_payment,
    )

    response = client.post(
        "/api/admin/payments",
        json=valid_payload(),
        headers={"Idempotency-Key": "api-retry-key-001"},
    )

    assert response.status_code == 201
    assert mock_record_payment.call_args.kwargs["idempotency_key"] == (
        "api-retry-key-001"
    )


def test_create_payment_returns_409_for_idempotency_conflict(
    client, monkeypatch
):
    from unittest.mock import Mock
    from app.services.payment_service import PaymentError

    mock_record_payment = Mock(
        side_effect=PaymentError(
            "Idempotency key was already used with a different payment payload."
        )
    )
    monkeypatch.setattr(
        "app.api.payments.record_payment",
        mock_record_payment,
    )

    response = client.post(
        "/api/admin/payments",
        json=valid_payload(),
        headers={"Idempotency-Key": "api-retry-key-002"},
    )

    assert response.status_code == 409


def test_create_payment_rejects_oversized_idempotency_key(client):
    response = client.post(
        "/api/admin/payments",
        json=valid_payload(),
        headers={"Idempotency-Key": "k" * 101},
    )

    assert response.status_code == 422
