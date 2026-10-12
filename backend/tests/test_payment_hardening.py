from decimal import Decimal
from types import SimpleNamespace

import pytest

from app.models.invoice import Invoice
from app.services.payment_service import (
    PaymentError,
    record_payment,
)


class FakeDB:
    def __init__(self, invoice=None):
        self.invoice = invoice
        self.added = []
        self.flush_count = 0

    def scalar(self, statement):
        return self.invoice

    def add(self, obj):
        self.added.append(obj)

    def flush(self):
        self.flush_count += 1


def make_invoice(
    total=Decimal("1000.00"),
    paid=Decimal("0.00"),
    status="ISSUED",
):
    return SimpleNamespace(
        id=1,
        total_amount=total,
        amount_paid=paid,
        status=status,
        paid_at=None,
    )


def make_payment(db, amount, method="UPI", reference=None):
    return record_payment(
        db=db,
        invoice_id=1,
        amount=Decimal(amount),
        payment_method=method,
        payment_reference=reference,
    )


def test_partial_payment_updates_balance_and_status():
    invoice = make_invoice()
    db = FakeDB(invoice)

    payment = make_payment(db, "300.00")

    assert payment.amount == Decimal("300.00")
    assert payment.status == "COMPLETED"
    assert invoice.amount_paid == Decimal("300.00")
    assert invoice.total_amount - invoice.amount_paid == Decimal("700.00")
    assert invoice.status == "PARTIALLY_PAID"
    assert invoice.paid_at is None
    assert payment in db.added
    assert db.flush_count == 1


def test_full_payment_marks_invoice_paid():
    invoice = make_invoice()
    db = FakeDB(invoice)

    payment = make_payment(db, "1000.00")

    assert invoice.amount_paid == invoice.total_amount
    assert invoice.status == "PAID"
    assert invoice.paid_at is not None
    assert payment.paid_at == invoice.paid_at


def test_multiple_partial_payments_accumulate_correctly():
    invoice = make_invoice()
    db = FakeDB(invoice)

    make_payment(db, "200.00")
    make_payment(db, "350.00")

    assert invoice.amount_paid == Decimal("550.00")
    assert invoice.total_amount - invoice.amount_paid == Decimal("450.00")
    assert invoice.status == "PARTIALLY_PAID"
    assert len(db.added) == 2


def test_overpayment_is_rejected():
    invoice = make_invoice(
        total=Decimal("1000.00"),
        paid=Decimal("800.00"),
        status="PARTIALLY_PAID",
    )
    db = FakeDB(invoice)

    with pytest.raises(PaymentError, match="exceeds the outstanding"):
        make_payment(db, "200.01")

    assert invoice.amount_paid == Decimal("800.00")
    assert invoice.status == "PARTIALLY_PAID"
    assert db.added == []
    assert db.flush_count == 0


def test_payment_on_fully_paid_invoice_is_rejected():
    invoice = make_invoice(
        total=Decimal("1000.00"),
        paid=Decimal("1000.00"),
        status="PAID",
    )
    db = FakeDB(invoice)

    with pytest.raises(PaymentError, match="already fully paid"):
        make_payment(db, "1.00")

    assert invoice.amount_paid == Decimal("1000.00")
    assert db.added == []


@pytest.mark.parametrize("amount", [
    "0",
    "-1",
    "-0.01",
])
def test_non_positive_payment_amount_is_rejected(amount):
    invoice = make_invoice()
    db = FakeDB(invoice)

    with pytest.raises(PaymentError, match="greater than zero"):
        make_payment(db, amount)

    assert invoice.amount_paid == Decimal("0.00")
    assert db.added == []


def test_unsupported_payment_method_is_rejected():
    invoice = make_invoice()
    db = FakeDB(invoice)

    with pytest.raises(PaymentError, match="Unsupported payment method"):
        make_payment(db, "100.00", method="CRYPTO")

    assert invoice.amount_paid == Decimal("0.00")
    assert db.added == []


def test_missing_invoice_is_rejected():
    db = FakeDB(invoice=None)

    with pytest.raises(PaymentError, match="Invoice not found"):
        make_payment(db, "100.00")

    assert db.added == []
    assert db.flush_count == 0


def test_payment_method_is_normalized():
    invoice = make_invoice()
    db = FakeDB(invoice)

    payment = make_payment(db, "100.00", method="  upi  ")

    assert payment.payment_method == "UPI"


def test_payment_reference_is_trimmed():
    invoice = make_invoice()
    db = FakeDB(invoice)

    payment = make_payment(
        db,
        "100.00",
        reference="  TXN-123  ",
    )

    assert payment.payment_reference == "TXN-123"


def test_rounding_to_two_decimal_places():
    invoice = make_invoice()
    db = FakeDB(invoice)

    payment = make_payment(db, "100.125")

    assert payment.amount == Decimal("100.13")
    assert invoice.amount_paid == Decimal("100.13")
