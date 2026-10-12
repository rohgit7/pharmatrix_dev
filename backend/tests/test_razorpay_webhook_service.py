
import hashlib
import hmac
import json
from types import SimpleNamespace
from unittest.mock import MagicMock

import pytest
from fastapi import HTTPException

from app.core.config import settings
from app.services import razorpay_service as service


WEBHOOK_SECRET = "test-webhook-secret"


def make_payload(
    *,
    event="payment.captured",
    payment_id="pay_test123",
    order_id="order_test123",
    amount=15000,
    currency="INR",
    status="captured",
):
    return json.dumps(
        {
            "event": event,
            "payload": {
                "payment": {
                    "entity": {
                        "id": payment_id,
                        "order_id": order_id,
                        "amount": amount,
                        "currency": currency,
                        "status": status,
                    }
                }
            },
        },
        separators=(",", ":"),
    ).encode()


def signed_request(raw_body, event_id="evt_test123"):
    signature = hmac.new(
        WEBHOOK_SECRET.encode(),
        raw_body,
        hashlib.sha256,
    ).hexdigest()

    return {
        "raw_body": raw_body,
        "signature": signature,
        "event_id": event_id,
    }


def make_event(raw_body, event_id="evt_test123", status="RECEIVED"):
    return SimpleNamespace(
        event_id=event_id,
        event_type="payment.captured",
        payload_sha256=hashlib.sha256(raw_body).hexdigest(),
        status=status,
        error_message=None,
        processed_at=None,
    )


def make_order():
    return SimpleNamespace(
        id=1,
        invoice_id=10,
        razorpay_order_id="order_test123",
        amount_paise=15000,
        currency="INR",
        status="CREATED",
        razorpay_payment_id=None,
        paid_at=None,
    )


@pytest.fixture(autouse=True)
def webhook_secret(monkeypatch):
    monkeypatch.setattr(
        settings,
        "RAZORPAY_WEBHOOK_SECRET",
        WEBHOOK_SECRET,
    )


def test_rejects_invalid_signature():
    db = MagicMock()
    raw_body = make_payload()

    with pytest.raises(HTTPException) as exc:
        service.process_razorpay_webhook(
            db=db,
            raw_body=raw_body,
            signature="invalid-signature",
            event_id="evt_invalid",
        )

    assert exc.value.status_code == 400
    db.scalar.assert_not_called()
    db.commit.assert_not_called()


def test_rejects_invalid_json_with_valid_signature():
    db = MagicMock()
    raw_body = b"not-json"
    request = signed_request(raw_body)

    with pytest.raises(HTTPException) as exc:
        service.process_razorpay_webhook(
            db=db,
            **request,
        )

    assert exc.value.status_code == 400
    db.scalar.assert_not_called()


def test_ignores_duplicate_processed_event():
    db = MagicMock()
    raw_body = make_payload()
    request = signed_request(raw_body)
    event = make_event(raw_body, status="PROCESSED")
    db.scalar.return_value = event

    result = service.process_razorpay_webhook(
        db=db,
        **request,
    )

    assert result == {
        "status": "PROCESSED",
        "duplicate": True,
    }
    db.commit.assert_not_called()


def test_rejects_payment_amount_mismatch(monkeypatch):
    db = MagicMock()
    raw_body = make_payload(amount=14000)
    request = signed_request(raw_body)
    event = make_event(raw_body)
    order = make_order()

    # Initial event lookup, order lookup, failed-event lookup.
    db.scalar.side_effect = [event, order, event]

    client = MagicMock()
    client.payment.fetch.return_value = {
        "id": "pay_test123",
        "order_id": "order_test123",
        "amount": 14000,
        "currency": "INR",
        "status": "captured",
    }
    monkeypatch.setattr(service, "get_razorpay_client", lambda: client)

    with pytest.raises(HTTPException) as exc:
        service.process_razorpay_webhook(
            db=db,
            **request,
        )

    assert exc.value.status_code == 400
    assert event.status == "FAILED"


def test_records_captured_payment_once(monkeypatch):
    db = MagicMock()
    raw_body = make_payload()
    request = signed_request(raw_body)
    event = make_event(raw_body)
    order = make_order()
    invoice = SimpleNamespace(
        id=10,
        outstanding_amount=150.00,
    )

    db.scalar.side_effect = [event, order, invoice]

    client = MagicMock()
    client.payment.fetch.return_value = {
        "id": "pay_test123",
        "order_id": "order_test123",
        "amount": 15000,
        "currency": "INR",
        "status": "captured",
    }
    monkeypatch.setattr(service, "get_razorpay_client", lambda: client)

    record_payment = MagicMock(return_value=SimpleNamespace(id=7))
    monkeypatch.setattr(service, "record_payment", record_payment)

    result = service.process_razorpay_webhook(
        db=db,
        **request,
    )

    assert result == {
        "status": "PROCESSED",
        "duplicate": False,
    }
    assert order.status == "PAID"
    assert order.razorpay_payment_id == "pay_test123"
    assert event.status == "PROCESSED"
    assert record_payment.call_count == 1
    assert record_payment.call_args.kwargs["amount"] == 150
    assert db.commit.call_count == 2


def test_rejects_reused_event_id_with_different_payload():
    db = MagicMock()
    raw_body = make_payload()
    request = signed_request(raw_body)
    event = make_event(
        b'{"different":"payload"}',
        event_id="evt_test123",
        status="PROCESSED",
    )
    db.scalar.return_value = event

    with pytest.raises(HTTPException) as exc:
        service.process_razorpay_webhook(
            db=db,
            **request,
        )

    assert exc.value.status_code == 409
    db.commit.assert_not_called()
