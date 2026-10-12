
from fastapi import APIRouter, Depends, Header, HTTPException, Path, status
from sqlalchemy.orm import Session

from app.core.auth import require_role
from app.core.database import get_db
from app.models.user import UserRole
from app.schemas.payment import PaymentCreate, PaymentResponse
from app.services.payment_service import (
    PaymentError,
    get_invoice_payments,
    record_payment,
)


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
    try:
        payment = record_payment(
            db=db,
            invoice_id=data.invoice_id,
            amount=data.amount,
            payment_method=data.payment_method,
            payment_reference=data.payment_reference,
            notes=data.notes,
            idempotency_key=idempotency_key,
        )

        db.commit()
        db.refresh(payment)
        return payment

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
    invoice_id: int = Path(gt=0),
    db: Session = Depends(get_db),
):
    try:
        return get_invoice_payments(
            db=db,
            invoice_id=invoice_id,
        )
    except PaymentError as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        ) from exc
