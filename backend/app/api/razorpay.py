
from typing import Annotated
from uuid import UUID
from fastapi import APIRouter, Depends, Header
from sqlalchemy.orm import Session

from app.core.auth import require_role
from app.core.database import get_db
from app.models.user import UserRole
from app.schemas.razorpay import (
    RazorpayOrderCreateRequest,
    RazorpayOrderResponse,
    RazorpayPaymentVerificationRequest,
    RazorpayPaymentVerificationResponse,
)
from app.services.razorpay_service import (
    create_razorpay_order,
    verify_razorpay_payment,
)


router = APIRouter(
    prefix="/api/admin/razorpay",
    tags=["Admin - Razorpay Payments"],
    dependencies=[Depends(require_role(UserRole.ADMIN))],
)

@router.post(
    "/orders",
    response_model=RazorpayOrderResponse,
)
def create_order(
    payload: RazorpayOrderCreateRequest,
    idempotency_key: Annotated[
        str,
        Header(
            alias="Idempotency-Key",
            min_length=1,
            max_length=100,
        ),
    ],
    db: Session = Depends(get_db),
):
    from sqlalchemy import select
    from fastapi import HTTPException
    from app.models.invoice import Invoice

    invoice = db.scalar(
        select(Invoice).where(
            Invoice.public_id == payload.invoice_id
        )
    )

    if invoice is None:
        raise HTTPException(
            status_code=404,
            detail="Invoice not found",
        )

    return create_razorpay_order(
        db=db,
        invoice_id=invoice.id,
        idempotency_key=idempotency_key,
    )


@router.post(
    "/payments/verify",
    response_model=RazorpayPaymentVerificationResponse,
)
def verify_payment(
    payload: RazorpayPaymentVerificationRequest,
    db: Session = Depends(get_db),
):
    try:
        return verify_razorpay_payment(
            db=db,
            razorpay_order_id=payload.razorpay_order_id,
            razorpay_payment_id=payload.razorpay_payment_id,
            razorpay_signature=payload.razorpay_signature,
        )
    except HTTPException:
        db.rollback()
        raise
