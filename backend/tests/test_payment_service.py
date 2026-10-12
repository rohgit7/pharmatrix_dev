from decimal import Decimal

import pytest

from app.models.payment import Payment
from app.services.invoice_service import create_pickup_invoice
from app.services.payment_service import PaymentError, record_payment
from tests.test_invoice_service import create_invoice_setup
from concurrent.futures import ThreadPoolExecutor
from threading import Barrier

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import sessionmaker

from app.models.invoice import Invoice

def make_invoice(db):
    setup = create_invoice_setup(db)
    invoice = create_pickup_invoice(
        db=db,
        pickup_id=setup["pickup"].id,
        actual_weight_kg=Decimal("5.000"),
    )
    db.flush()
    return invoice


def test_record_full_payment_marks_invoice_paid(db):
    invoice = make_invoice(db)

    payment = record_payment(
        db=db,
        invoice_id=invoice.id,
        amount=Decimal("110.00"),
        payment_method="UPI",
        payment_reference="PAY-FULL-001",
    )

    db.flush()
    db.refresh(invoice)

    assert payment.amount == Decimal("110.00")
    assert invoice.amount_paid == Decimal("110.00")
    assert invoice.outstanding_amount == Decimal("0.00")
    assert invoice.status == "PAID"
    assert invoice.paid_at is not None


def test_record_partial_payment_updates_balance(db):
    invoice = make_invoice(db)

    record_payment(
        db=db,
        invoice_id=invoice.id,
        amount=Decimal("40.00"),
        payment_method="CASH",
    )

    db.flush()
    db.refresh(invoice)

    assert invoice.amount_paid == Decimal("40.00")
    assert invoice.outstanding_amount == Decimal("70.00")
    assert invoice.status == "PARTIALLY_PAID"
    assert invoice.paid_at is None


@pytest.mark.parametrize(
    "amount",
    [
        Decimal("0.00"),
        Decimal("-1.00"),
    ],
)
def test_record_payment_rejects_nonpositive_amount(db, amount):
    invoice = make_invoice(db)

    with pytest.raises(PaymentError):
        record_payment(
            db=db,
            invoice_id=invoice.id,
            amount=amount,
            payment_method="UPI",
        )


def test_record_payment_rejects_overpayment(db):
    invoice = make_invoice(db)

    with pytest.raises(PaymentError, match="exceeds"):
        record_payment(
            db=db,
            invoice_id=invoice.id,
            amount=Decimal("110.01"),
            payment_method="UPI",
        )


def test_record_payment_rejects_invalid_method(db):
    invoice = make_invoice(db)

    with pytest.raises(PaymentError, match="payment method"):
        record_payment(
            db=db,
            invoice_id=invoice.id,
            amount=Decimal("10.00"),
            payment_method="CRYPTO",
        )


def test_record_payment_rejects_missing_invoice(db):
    with pytest.raises(PaymentError, match="Invoice not found"):
        record_payment(
            db=db,
            invoice_id=-1,
            amount=Decimal("10.00"),
            payment_method="UPI",
        )


def test_record_payment_rejects_duplicate_reference(db):
    invoice = make_invoice(db)

    record_payment(
        db=db,
        invoice_id=invoice.id,
        amount=Decimal("20.00"),
        payment_method="UPI",
        payment_reference="DUPLICATE-001",
    )
    db.flush()

    second_invoice = make_invoice(db)

    with pytest.raises(PaymentError, match="duplicate payment reference"):
        record_payment(
            db=db,
            invoice_id=second_invoice.id,
            amount=Decimal("20.00"),
            payment_method="UPI",
            payment_reference="DUPLICATE-001",
        )


def test_record_payment_creates_persisted_payment_record(db):
    invoice = make_invoice(db)

    payment = record_payment(
        db=db,
        invoice_id=invoice.id,
        amount=Decimal("25.50"),
        payment_method="BANK_TRANSFER",
        payment_reference="BANK-001",
    )

    db.flush()

    stored = db.get(Payment, payment.id)

    assert stored is not None
    assert stored.invoice_id == invoice.id
    assert stored.amount == Decimal("25.50")
    assert stored.status == "COMPLETED"


def test_failed_duplicate_payment_does_not_change_invoice_balance(db):
    invoice = make_invoice(db)
    invoice_id = invoice.id

    record_payment(
        db=db,
        invoice_id=invoice_id,
        amount=Decimal("20.00"),
        payment_method="UPI",
        payment_reference="ROLLBACK-001",
    )
    db.commit()

    db.refresh(invoice)
    assert invoice.amount_paid == Decimal("20.00")

    with pytest.raises(PaymentError, match="duplicate payment reference"):
        record_payment(
            db=db,
            invoice_id=invoice_id,
            amount=Decimal("10.00"),
            payment_method="UPI",
            payment_reference="ROLLBACK-001",
        )

    # Reload the invoice after the failed transaction.
    stored_invoice = db.get(Invoice, invoice_id)
    assert stored_invoice is not None
    assert stored_invoice.amount_paid == Decimal("20.00")


def test_database_rejects_payment_for_nonexistent_invoice(db):
    payment = Payment(
        invoice_id=999999999,
        amount=Decimal("10.00"),
        payment_method="UPI",
        status="COMPLETED",
    )
    db.add(payment)

    with pytest.raises(IntegrityError):
        db.flush()

    db.rollback()


def test_concurrent_payments_cannot_overpay_invoice(db):
    invoice = make_invoice(db)
    invoice_id = invoice.id
    db.commit()

    engine = db.get_bind()
    SessionLocal = sessionmaker(
        bind=engine,
        autoflush=False,
        autocommit=False,
    )
    barrier = Barrier(2)

    def attempt_payment(reference):
        with SessionLocal() as session:
            barrier.wait(timeout=10)

            try:
                record_payment(
                    db=session,
                    invoice_id=invoice_id,
                    amount=Decimal("70.00"),
                    payment_method="UPI",
                    payment_reference=reference,
                )
                session.commit()
                return "success"
            except PaymentError:
                session.rollback()
                return "rejected"
            finally:
                session.close()

    with ThreadPoolExecutor(max_workers=2) as executor:
        results = list(
            executor.map(
                attempt_payment,
                ["CONCURRENT-001", "CONCURRENT-002"],
            )
        )

    assert results.count("success") == 1
    assert results.count("rejected") == 1

    db.expire_all()
    stored_invoice = db.get(Invoice, invoice_id)
    payments = list(
        db.scalars(
            select(Payment).where(Payment.invoice_id == invoice_id)
        ).all()
    )

    assert stored_invoice.amount_paid == Decimal("70.00")
    assert stored_invoice.amount_paid <= stored_invoice.total_amount
    assert len(payments) == 1



def test_invoice_balance_matches_sum_of_payments(db):
    invoice = make_invoice(db)

    record_payment(
        db=db,
        invoice_id=invoice.id,
        amount=Decimal("30.00"),
        payment_method="UPI",
        payment_reference="BALANCE-001",
    )
    record_payment(
        db=db,
        invoice_id=invoice.id,
        amount=Decimal("20.00"),
        payment_method="CASH",
        payment_reference="BALANCE-002",
    )

    db.flush()
    db.refresh(invoice)

    payments = list(
        db.scalars(
            select(Payment).where(Payment.invoice_id == invoice.id)
        ).all()
    )

    total_paid = sum(
        (payment.amount for payment in payments),
        Decimal("0.00"),
    )

    assert invoice.amount_paid == total_paid
    assert invoice.outstanding_amount == (
        invoice.total_amount - total_paid
    )


def test_payment_history_is_newest_first(db):
    from app.services.payment_service import get_invoice_payments

    invoice = make_invoice(db)

    first = record_payment(
        db=db,
        invoice_id=invoice.id,
        amount=Decimal("10.00"),
        payment_method="UPI",
        payment_reference="HISTORY-001",
    )
    db.flush()

    second = record_payment(
        db=db,
        invoice_id=invoice.id,
        amount=Decimal("10.00"),
        payment_method="CASH",
        payment_reference="HISTORY-002",
    )
    db.flush()

    history = get_invoice_payments(db, invoice.id)

    assert len(history) == 2
    assert history[0].id == second.id
    assert history[1].id == first.id



def test_idempotent_retry_returns_original_payment(db):
    invoice = make_invoice(db)

    kwargs = {
        "db": db,
        "invoice_id": invoice.id,
        "amount": Decimal("25.00"),
        "payment_method": "UPI",
        "payment_reference": "IDEMPOTENT-001",
        "notes": "Test retry",
        "idempotency_key": "retry-key-001",
    }

    first = record_payment(**kwargs)
    db.flush()

    second = record_payment(**kwargs)
    db.flush()

    assert second.id == first.id
    assert invoice.amount_paid == Decimal("25.00")

    payments = list(
        db.scalars(
            select(Payment).where(
                Payment.invoice_id == invoice.id,
                Payment.idempotency_key == "retry-key-001",
            )
        ).all()
    )
    assert len(payments) == 1


@pytest.mark.parametrize(
    "changed_fields",
    [
        {"amount": Decimal("30.00")},
        {"payment_method": "CASH"},
        {"payment_reference": "IDEMPOTENT-DIFFERENT"},
        {"notes": "Different payload"},
    ],
)
def test_idempotency_key_reuse_with_different_payload_is_rejected(
    db, changed_fields
):
    invoice = make_invoice(db)

    original = {
        "db": db,
        "invoice_id": invoice.id,
        "amount": Decimal("25.00"),
        "payment_method": "UPI",
        "payment_reference": "IDEMPOTENT-002",
        "notes": "Original payload",
        "idempotency_key": "retry-key-002",
    }

    record_payment(**original)
    db.flush()

    retry = {**original, **changed_fields}

    with pytest.raises(
        PaymentError,
        match="Idempotency key was already used",
    ):
        record_payment(**retry)

    db.refresh(invoice)
    assert invoice.amount_paid == Decimal("25.00")


def test_idempotency_keys_are_scoped_to_invoice(db):
    first_invoice = make_invoice(db)
    second_invoice = make_invoice(db)

    first = record_payment(
        db=db,
        invoice_id=first_invoice.id,
        amount=Decimal("10.00"),
        payment_method="UPI",
        idempotency_key="shared-key",
    )
    second = record_payment(
        db=db,
        invoice_id=second_invoice.id,
        amount=Decimal("10.00"),
        payment_method="UPI",
        idempotency_key="shared-key",
    )

    db.flush()

    assert first.id != second.id
    assert first.invoice_id != second.invoice_id
