
from datetime import datetime, timezone
from decimal import Decimal, ROUND_HALF_UP

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.invoice import Invoice
from app.models.payment import Payment


class PaymentError(Exception):
    """Raised when a payment operation is invalid."""


CENT = Decimal("0.01")

ALLOWED_PAYMENT_METHODS = {
    "CASH",
    "UPI",
    "BANK_TRANSFER",
    "CARD",
    "OTHER",
}


def money(value: Decimal) -> Decimal:
    return Decimal(str(value)).quantize(
        CENT,
        rounding=ROUND_HALF_UP,
    )


def record_payment(
    db: Session,
    invoice_id: int,
    amount: Decimal,
    payment_method: str,
    payment_reference: str | None = None,
    notes: str | None = None,
    idempotency_key: str | None = None,
) -> Payment:
    """
    Record a completed payment.

    The caller is responsible for committing the transaction.
    A repeated idempotency key with the same payload returns
    the existing payment without applying the payment twice.
    """
    try:
        amount = money(amount)
    except Exception as exc:
        raise PaymentError("Invalid payment amount.") from exc

    if amount <= Decimal("0.00"):
        raise PaymentError("Payment amount must be greater than zero.")

    if not isinstance(payment_method, str):
        raise PaymentError("Unsupported payment method.")

    payment_method = payment_method.strip().upper()

    if payment_method not in ALLOWED_PAYMENT_METHODS:
        raise PaymentError("Unsupported payment method.")

    if payment_reference is not None:
        payment_reference = payment_reference.strip() or None

    if idempotency_key is not None:
        idempotency_key = idempotency_key.strip() or None

    if idempotency_key and len(idempotency_key) > 100:
        raise PaymentError(
            "Idempotency key must be at most 100 characters."
        )

    # Lock the invoice first. Requests for the same invoice are
    # serialized, including requests carrying the same idempotency key.
    invoice = db.scalar(
        select(Invoice)
        .where(Invoice.id == invoice_id)
        .with_for_update()
    )

    if invoice is None:
        raise PaymentError("Invoice not found.")

    # Check retries before checking the invoice's outstanding balance.
    # A successful previous request may already have fully paid it.
    if idempotency_key:
        existing = db.scalar(
            select(Payment).where(
                Payment.invoice_id == invoice_id,
                Payment.idempotency_key == idempotency_key,
            )
        )

        if existing is not None:
            same_request = (
                existing.amount == amount
                and existing.payment_method == payment_method
                and existing.payment_reference == payment_reference
                and existing.notes == notes
            )

            if same_request:
                return existing

            raise PaymentError(
                "Idempotency key was already used with a different "
                "payment payload."
            )

    outstanding = money(invoice.total_amount - invoice.amount_paid)

    if outstanding <= Decimal("0.00"):
        raise PaymentError("Invoice is already fully paid.")

    if amount > outstanding:
        raise PaymentError(
            "Payment exceeds the outstanding invoice amount."
        )

    payment = Payment(
        invoice_id=invoice.id,
        amount=amount,
        payment_method=payment_method,
        status="COMPLETED",
        payment_reference=payment_reference,
        idempotency_key=idempotency_key,
        notes=notes,
    )

    invoice.amount_paid = money(invoice.amount_paid + amount)

    if invoice.amount_paid == invoice.total_amount:
        invoice.status = "PAID"
        payment.paid_at = datetime.now(timezone.utc)
        invoice.paid_at = payment.paid_at
    else:
        invoice.status = "PARTIALLY_PAID"
        invoice.paid_at = None

    db.add(payment)

    try:
        db.flush()
    except IntegrityError as exc:
        # This rolls back the current transaction. The API caller
        # must treat the operation as failed and start a new transaction
        # before performing further database work.
        db.rollback()
        raise PaymentError(
            "Payment could not be recorded because of a duplicate "
            "payment reference or idempotency key."
        ) from exc

    return payment


def get_invoice_payments(
    db: Session,
    invoice_id: int,
) -> list[Payment]:
    """Return payment history for an existing invoice, newest first."""
    invoice = db.scalar(
        select(Invoice).where(Invoice.id == invoice_id)
    )

    if invoice is None:
        raise PaymentError("Invoice not found.")

    return list(
        db.scalars(
            select(Payment)
            .where(Payment.invoice_id == invoice_id)
            .order_by(
                Payment.created_at.desc(),
                Payment.id.desc(),
            )
        ).all()
    )
