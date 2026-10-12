
from types import SimpleNamespace
from unittest.mock import MagicMock

import pytest
from fastapi import HTTPException

from app.services import razorpay_service as service


def make_order(status="CREATED"):
    return SimpleNamespace(
        id=1,
        invoice_id=10,
        razorpay_order_id="order_test123",
        amount_paise=15000,
        currency="INR",
        status=status,
        razorpay_payment_id=None,
        paid_at=None,
    )


def make_client(
    *,
    order_id="order_test123",
    amount=15000,
    currency="INR",
    status="captured",
):
    client = MagicMock()
    client.payment.fetch.return_value = {
        "id": "pay_test123",
        "order_id": order_id,
        "amount": amount,
        "currency": currency,
        "status": status,
    }
    return client


def test_rejects_unknown_order(monkeypatch):
    db = MagicMock()
    db.scalar.return_value = None

    with pytest.raises(HTTPException) as exc:
        service.verify_razorpay_payment(
            db,
            "order_unknown",
            "pay_test123",
            "signature",
        )

    assert exc.value.status_code == 404


def test_rejects_payment_for_different_order(monkeypatch):
    db = MagicMock()
    db.scalar.return_value = make_order()

    client = make_client(order_id="order_another")
    monkeypatch.setattr(service, "get_razorpay_client", lambda: client)

    with pytest.raises(HTTPException) as exc:
        service.verify_razorpay_payment(
            db,
            "order_test123",
            "pay_test123",
            "signature",
        )

    assert exc.value.status_code == 400
    db.commit.assert_not_called()


def test_rejects_uncaptured_payment(monkeypatch):
    db = MagicMock()
    db.scalar.return_value = make_order()

    client = make_client(status="authorized")
    monkeypatch.setattr(service, "get_razorpay_client", lambda: client)

    with pytest.raises(HTTPException) as exc:
        service.verify_razorpay_payment(
            db,
            "order_test123",
            "pay_test123",
            "signature",
        )

    assert exc.value.status_code == 409
    db.commit.assert_not_called()


def test_records_verified_payment(monkeypatch):
    db = MagicMock()
    order = make_order()
    invoice = SimpleNamespace(
        id=10,
        outstanding_amount=150.00,
    )

    db.scalar.side_effect = [order, invoice]

    client = make_client()
    monkeypatch.setattr(service, "get_razorpay_client", lambda: client)

    monkeypatch.setattr(
        service,
        "record_payment",
        MagicMock(return_value=SimpleNamespace(id=7)),
    )

    result = service.verify_razorpay_payment(
        db,
        "order_test123",
        "pay_test123",
        "valid-test-signature",
    )

    assert result["status"] == "PAID"
    assert result["payment_id"] == 7
    assert order.status == "PAID"
    assert order.razorpay_payment_id == "pay_test123"
    client.utility.verify_payment_signature.assert_called_once()
    db.commit.assert_called_once()


def test_repeated_verification_does_not_record_again(monkeypatch):
    db = MagicMock()
    order = make_order(status="PAID")
    order.razorpay_payment_id = "pay_test123"

    existing_payment = SimpleNamespace(id=7)
    db.scalar.side_effect = [order, existing_payment]

    record_payment = MagicMock()
    monkeypatch.setattr(service, "record_payment", record_payment)

    result = service.verify_razorpay_payment(
        db,
        "order_test123",
        "pay_test123",
        "signature",
    )

    assert result["status"] == "PAID"
    assert result["payment_id"] == 7
    record_payment.assert_not_called()
    db.commit.assert_not_called()
