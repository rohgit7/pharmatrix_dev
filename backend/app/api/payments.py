
from decimal import Decimal
from fastapi import APIRouter, Depends, Header, HTTPException, Path, status
from sqlalchemy.orm import Session
from uuid import UUID
from app.core.auth import require_role
from app.core.database import get_db
from app.models.user import UserRole
from app.schemas.payment import PaymentCreate, PaymentResponse
from app.services.payment_service import (
    PaymentError,
    get_invoice_payments,
    record_payment,
)
from app.models.invoice import Invoice


router = APIRouter(
    prefix="/api/admin/payments",
    tags=["Admin - Payments"],
    dependencies=[Depends(require_role(UserRole.ADMIN))],
)


@router.post(
    "/",
    response_model=PaymentResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_payment_endpoint(
    data: PaymentCreate,
    db: Session = Depends(get_db),
    idempotency_key: str | None = Header(
        default=None,
        alias="Idempotency-Key",
        max_length=100,
    ),
):
    invoice = db.query(Invoice).filter(
        Invoice.public_id == data.invoice_id
    ).first()

    if invoice is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Invoice not found",
        )

    try:
        payment = record_payment(
            db=db,
            invoice_id=invoice.id,
            amount=data.amount,
            payment_method=data.payment_method,
            payment_reference=data.payment_reference,
            notes=data.notes,
            idempotency_key=idempotency_key,
        )

        db.commit()
        db.refresh(payment)

        return {
            "id": payment.id,
            "invoice_id": invoice.public_id,
            "amount": payment.amount,
            "payment_method": payment.payment_method,
            "status": payment.status,
            "payment_reference": payment.payment_reference,
            "idempotency_key": payment.idempotency_key,
            "notes": payment.notes,
            "paid_at": payment.paid_at,
            "created_at": payment.created_at,
        }

    except PaymentError as exc:
        db.rollback()
        message = str(exc)

        if "Idempotency key was already used" in message:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=message,
            ) from exc

        if (
            "not found" in message.lower()
            or "does not exist" in message.lower()
        ):
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=message,
            ) from exc

        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=message,
        ) from exc



@router.get(
    "/invoice/{invoice_id}",
    response_model=list[PaymentResponse],
)
def get_invoice_payments_endpoint(
    invoice_id: UUID,
    db: Session = Depends(get_db),
):
    invoice = db.query(Invoice).filter(
        Invoice.public_id == invoice_id
    ).first()

    if invoice is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Invoice not found",
        )

    try:
        payments = get_invoice_payments(
            db=db,
            invoice_id=invoice.id,
        )

        return [
            {
                "id": payment.id,
                "invoice_id": invoice.public_id,
                "amount": payment.amount,
                "payment_method": payment.payment_method,
                "status": payment.status,
                "payment_reference": payment.payment_reference,
                "idempotency_key": payment.idempotency_key,
                "notes": payment.notes,
                "paid_at": payment.paid_at,
                "created_at": payment.created_at,
            }
            for payment in payments
        ]

    except PaymentError as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        ) from exc


@router.delete(
    "/{payment_id}",
    status_code=status.HTTP_200_OK,
)
def delete_payment_endpoint(
    payment_id: int,
    db: Session = Depends(get_db),
):
    from app.models.payment import Payment
    payment = db.query(Payment).filter(Payment.id == payment_id).first()
    if not payment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Payment not found",
        )

    # Revert invoice amount_paid
    invoice = db.query(Invoice).filter(Invoice.id == payment.invoice_id).first()
    if invoice:
        invoice.amount_paid = max(Decimal("0.00"), invoice.amount_paid - payment.amount)
        if invoice.amount_paid < invoice.total_amount:
            invoice.status = "ISSUED"

    db.delete(payment)
    db.commit()
    return {"message": "Payment removed successfully"}

