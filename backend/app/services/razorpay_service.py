from datetime import datetime, timedelta, timezone
from decimal import Decimal
from uuid import uuid4
import hashlib
import hmac
import json

import razorpay
from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.invoice import Invoice
from app.models.payment import Payment
from app.models.razorpay_order import RazorpayOrder
from app.models.razorpay_webhook_event import RazorpayWebhookEvent
from app.services.payment_service import record_payment


def get_razorpay_client() -> razorpay.Client:
    key_id = settings.RAZORPAY_KEY_ID
    key_secret = settings.RAZORPAY_KEY_SECRET

    if not key_id or not key_secret:
        raise HTTPException(
            status_code=503,
            detail="Online payments are not configured.",
        )

    return razorpay.Client(auth=(key_id, key_secret))


def create_razorpay_order(
    db: Session,
    invoice_id: int,
    idempotency_key: str,
) -> dict:
    if not idempotency_key or len(idempotency_key) > 100:
        raise HTTPException(
            status_code=400,
            detail="A valid Idempotency-Key is required.",
        )

    currency = settings.RAZORPAY_CURRENCY.upper()
    if currency != "INR":
        raise HTTPException(
            status_code=400,
            detail="Only INR payments are currently supported.",
        )

    invoice = db.scalar(
        select(Invoice)
        .where(Invoice.id == invoice_id)
        .with_for_update()
    )
    if invoice is None:
        raise HTTPException(status_code=404, detail="Invoice not found.")

    existing_order = db.scalar(
        select(RazorpayOrder).where(
            RazorpayOrder.invoice_id == invoice_id,
            RazorpayOrder.idempotency_key == idempotency_key,
        )
    )
    if existing_order is not None:
        return {
            "key_id": settings.RAZORPAY_KEY_ID,
            "order_id": existing_order.razorpay_order_id,
            "amount": existing_order.amount_paise,
            "currency": existing_order.currency,
            "status": existing_order.status,
        }

    outstanding = Decimal(str(invoice.outstanding_amount))
    if outstanding <= 0:
        raise HTTPException(
            status_code=400,
            detail="This invoice has no outstanding balance.",
        )
    if invoice.currency.upper() != currency:
        raise HTTPException(
            status_code=400,
            detail="Invoice currency does not match payment currency.",
        )

    outstanding = outstanding.quantize(Decimal("0.01"))
    amount_paise = int(outstanding * 100)
    if amount_paise <= 0:
        raise HTTPException(
            status_code=400,
            detail="Invoice outstanding amount is invalid.",
        )

    client = get_razorpay_client()
    try:
        provider_order = client.order.create(
            data={
                "amount": amount_paise,
                "currency": currency,
                "receipt": f"inv-{invoice.id}-{uuid4().hex[:12]}",
                "notes": {
                    "invoice_id": str(invoice.id),
                    "invoice_public_id": str(invoice.public_id),
                    "invoice_number": str(invoice.invoice_number),
                },
            }
        )

        order = RazorpayOrder(
            invoice_id=invoice.id,
            razorpay_order_id=provider_order["id"],
            amount_paise=amount_paise,
            currency=currency,
            status="CREATED",
            idempotency_key=idempotency_key,
        )
        db.add(order)
        db.commit()
        db.refresh(order)

        return {
            "key_id": settings.RAZORPAY_KEY_ID,
            "order_id": order.razorpay_order_id,
            "amount": order.amount_paise,
            "currency": order.currency,
            "status": order.status,
        }
    except HTTPException:
        db.rollback()
        raise
    except Exception as exc:
        db.rollback()
        raise HTTPException(
            status_code=502,
            detail="Unable to create online payment order.",
        ) from exc


def verify_razorpay_payment(
    db: Session,
    razorpay_order_id: str,
    razorpay_payment_id: str,
    razorpay_signature: str,
) -> dict:
    order = db.scalar(
        select(RazorpayOrder)
        .where(RazorpayOrder.razorpay_order_id == razorpay_order_id)
        .with_for_update()
    )
    if order is None:
        raise HTTPException(status_code=404, detail="Razorpay order not found.")

    if order.status == "PAID":
        if order.razorpay_payment_id != razorpay_payment_id:
            raise HTTPException(
                status_code=409,
                detail="This order is already associated with another payment.",
            )
        payment = db.scalar(
            select(Payment).where(
                Payment.payment_reference == razorpay_payment_id
            )
        )
        return {
            "status": "PAID",
            "message": "Payment has already been recorded.",
            "payment_id": payment.id if payment else None,
        }

    if order.status != "CREATED":
        raise HTTPException(
            status_code=409,
            detail=f"Order cannot be verified in status {order.status}.",
        )

    client = get_razorpay_client()
    try:
        client.utility.verify_payment_signature(
            {
                "razorpay_order_id": razorpay_order_id,
                "razorpay_payment_id": razorpay_payment_id,
                "razorpay_signature": razorpay_signature,
            }
        )
    except razorpay.errors.SignatureVerificationError as exc:
        raise HTTPException(
            status_code=400,
            detail="Invalid Razorpay payment signature.",
        ) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=502,
            detail="Unable to verify the Razorpay signature.",
        ) from exc

    try:
        provider_payment = client.payment.fetch(razorpay_payment_id)
    except Exception as exc:
        raise HTTPException(
            status_code=502,
            detail="Unable to retrieve payment status from Razorpay.",
        ) from exc

    if provider_payment.get("order_id") != razorpay_order_id:
        raise HTTPException(
            status_code=400,
            detail="Payment does not belong to this order.",
        )
    if (
        provider_payment.get("amount") != order.amount_paise
        or provider_payment.get("currency") != order.currency
    ):
        raise HTTPException(
            status_code=400,
            detail="Payment amount or currency does not match the order.",
        )
    if provider_payment.get("status") != "captured":
        raise HTTPException(
            status_code=409,
            detail="Payment has not been captured yet.",
        )

    invoice = db.scalar(
        select(Invoice)
        .where(Invoice.id == order.invoice_id)
        .with_for_update()
    )
    if invoice is None:
        raise HTTPException(status_code=404, detail="Invoice not found.")

    # Prevent a stale online order from silently overpaying an invoice.
    if Decimal(str(invoice.outstanding_amount)) < (
        Decimal(order.amount_paise) / Decimal(100)
    ):
        raise HTTPException(
            status_code=409,
            detail=(
                "The invoice outstanding balance has changed. "
                "The captured payment requires reconciliation."
            ),
        )

    amount_rupees = Decimal(order.amount_paise) / Decimal(100)
    try:
        payment = record_payment(
            db=db,
            invoice_id=invoice.id,
            amount=amount_rupees,
            payment_method="OTHER",
            payment_reference=razorpay_payment_id,
            notes=f"Verified Razorpay payment for order {razorpay_order_id}",
            idempotency_key=f"razorpay:{razorpay_payment_id}",
        )
        order.status = "PAID"
        order.razorpay_payment_id = razorpay_payment_id
        order.paid_at = datetime.now(timezone.utc)
        db.commit()
        db.refresh(order)
        db.refresh(payment)
        return {
            "status": "PAID",
            "message": "Payment verified and recorded successfully.",
            "payment_id": payment.id,
        }
    except HTTPException:
        db.rollback()
        raise
    except Exception as exc:
        db.rollback()
        raise HTTPException(
            status_code=409,
            detail="Payment could not be recorded. Check the invoice and payment ledger.",
        ) from exc


def _event_is_recently_received(
    event_record: RazorpayWebhookEvent,
    now: datetime,
    window: timedelta = timedelta(minutes=5),
) -> bool:
    # Production rows have received_at. Treat a missing timestamp (for legacy
    # rows or lightweight test doubles) as stale so processing can recover.
    received_at = getattr(event_record, "received_at", None)
    if received_at is None:
        return False
    if received_at.tzinfo is None:
        received_at = received_at.replace(tzinfo=timezone.utc)
    return now - received_at < window


def process_razorpay_webhook(
    db: Session,
    raw_body: bytes,
    signature: str,
    event_id: str,
) -> dict:
    webhook_secret = settings.RAZORPAY_WEBHOOK_SECRET
    if not webhook_secret:
        raise HTTPException(
            status_code=503,
            detail="Razorpay webhook is not configured.",
        )
    if not event_id or len(event_id) > 150:
        raise HTTPException(
            status_code=400,
            detail="Missing or invalid Razorpay event ID.",
        )

    expected_signature = hmac.new(
        webhook_secret.encode("utf-8"),
        raw_body,
        hashlib.sha256,
    ).hexdigest()
    if not hmac.compare_digest(expected_signature, signature or ""):
        raise HTTPException(
            status_code=400,
            detail="Invalid Razorpay webhook signature.",
        )

    try:
        payload = json.loads(raw_body)
        event_type = payload["event"]
        if not isinstance(event_type, str) or not event_type:
            raise ValueError("Missing event type")
    except (ValueError, KeyError, TypeError) as exc:
        raise HTTPException(
            status_code=400,
            detail="Invalid Razorpay webhook payload.",
        ) from exc

    payload_hash = hashlib.sha256(raw_body).hexdigest()
    now = datetime.now(timezone.utc)

    # Lock an existing event row to serialize retries of the same event.
    event_record = db.scalar(
        select(RazorpayWebhookEvent)
        .where(RazorpayWebhookEvent.event_id == event_id)
        .with_for_update()
    )

    if event_record is not None:
        if event_record.payload_sha256 != payload_hash:
            raise HTTPException(
                status_code=409,
                detail="Event ID was reused with a different payload.",
            )
        if event_record.status in ("PROCESSED", "IGNORED"):
            return {"status": event_record.status, "duplicate": True}
        if (
            event_record.status == "RECEIVED"
            and _event_is_recently_received(event_record, now)
        ):
            db.rollback()
            raise HTTPException(
                status_code=503,
                detail="Webhook event is already being processed. Retry later.",
            )

        # FAILED or stale RECEIVED event: allow another delivery to retry.
        event_record.status = "RECEIVED"
        event_record.received_at = now
        event_record.error_message = None
        db.commit()
    else:
        event_record = RazorpayWebhookEvent(
            event_id=event_id,
            event_type=event_type,
            payload_sha256=payload_hash,
            status="RECEIVED",
        )
        db.add(event_record)
        try:
            db.commit()
            db.refresh(event_record)
        except IntegrityError:
            db.rollback()
            existing = db.scalar(
                select(RazorpayWebhookEvent)
                .where(RazorpayWebhookEvent.event_id == event_id)
                .with_for_update()
            )
            if existing is None:
                raise HTTPException(
                    status_code=503,
                    detail="Unable to claim webhook event. Retry later.",
                )
            if existing.payload_sha256 != payload_hash:
                raise HTTPException(
                    status_code=409,
                    detail="Event ID was reused with a different payload.",
                )
            if existing.status in ("PROCESSED", "IGNORED"):
                return {"status": existing.status, "duplicate": True}
            raise HTTPException(
                status_code=503,
                detail="Webhook event is already being processed. Retry later.",
            )

    try:
        # Only captured payments change the payment ledger.
        if event_type != "payment.captured":
            event_record.status = "IGNORED"
            event_record.processed_at = datetime.now(timezone.utc)
            event_record.error_message = None
            db.commit()
            return {"status": "IGNORED", "duplicate": False}

        payment_entity = (
            payload.get("payload", {})
            .get("payment", {})
            .get("entity", {})
        )
        payment_id = payment_entity.get("id")
        provider_order_id = payment_entity.get("order_id")
        if not payment_id or not provider_order_id:
            raise HTTPException(
                status_code=400,
                detail="Webhook payment is missing its order or payment ID.",
            )

        order = db.scalar(
            select(RazorpayOrder)
            .where(RazorpayOrder.razorpay_order_id == provider_order_id)
            .with_for_update()
        )
        if order is None:
            raise HTTPException(status_code=404, detail="Payment order not found.")

        if order.status == "PAID":
            if order.razorpay_payment_id != payment_id:
                raise HTTPException(
                    status_code=409,
                    detail="Order is already associated with another payment.",
                )
            event_record.status = "PROCESSED"
            event_record.processed_at = datetime.now(timezone.utc)
            event_record.error_message = None
            db.commit()
            return {"status": "PROCESSED", "duplicate": True}

        if order.status != "CREATED":
            raise HTTPException(
                status_code=409,
                detail="Order is not awaiting payment.",
            )

        client = get_razorpay_client()
        try:
            provider_payment = client.payment.fetch(payment_id)
        except Exception as exc:
            raise HTTPException(
                status_code=502,
                detail="Unable to retrieve payment status from Razorpay.",
            ) from exc

        if (
            provider_payment.get("id") != payment_id
            or provider_payment.get("order_id") != order.razorpay_order_id
            or provider_payment.get("amount") != order.amount_paise
            or provider_payment.get("currency") != order.currency
            or provider_payment.get("status") != "captured"
        ):
            raise HTTPException(
                status_code=400,
                detail="Captured payment does not match the stored order.",
            )

        invoice = db.scalar(
            select(Invoice)
            .where(Invoice.id == order.invoice_id)
            .with_for_update()
        )
        if invoice is None:
            raise HTTPException(status_code=404, detail="Invoice not found.")

        amount_rupees = Decimal(order.amount_paise) / Decimal(100)
        if Decimal(str(invoice.outstanding_amount)) < amount_rupees:
            raise HTTPException(
                status_code=409,
                detail=(
                    "The invoice outstanding balance has changed. "
                    "The captured payment requires reconciliation."
                ),
            )

        payment = record_payment(
            db=db,
            invoice_id=invoice.id,
            amount=amount_rupees,
            payment_method="OTHER",
            payment_reference=payment_id,
            notes=f"Razorpay webhook payment for order {order.razorpay_order_id}",
            idempotency_key=f"razorpay:{payment_id}",
        )
        order.status = "PAID"
        order.razorpay_payment_id = payment_id
        order.paid_at = datetime.now(timezone.utc)
        event_record.status = "PROCESSED"
        event_record.processed_at = datetime.now(timezone.utc)
        event_record.error_message = None
        db.commit()
        return {"status": "PROCESSED", "duplicate": False}

    except Exception as exc:
        db.rollback()
        failed_event = db.scalar(
            select(RazorpayWebhookEvent)
            .where(RazorpayWebhookEvent.event_id == event_id)
            .with_for_update()
        )
        if failed_event is not None and failed_event.status != "PROCESSED":
            failed_event.status = "FAILED"
            failed_event.error_message = str(exc)[:2000]
            db.commit()

        if isinstance(exc, HTTPException):
            raise
        raise HTTPException(
            status_code=502,
            detail="Webhook payment processing failed. Razorpay may retry.",
        ) from exc
