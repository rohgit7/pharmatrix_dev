from fastapi import APIRouter, Depends, HTTPException, Path, status
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.core.auth import require_role
from app.core.database import get_db
from app.models.invoice import Invoice
from app.models.user import UserRole
from app.schemas.invoice import InvoiceResponse


router = APIRouter(
    prefix="/api/admin/invoices",
    tags=["Admin - Invoices"],
    dependencies=[Depends(require_role(UserRole.ADMIN))],
)


@router.get("/", response_model=list[InvoiceResponse])
def list_invoices(
    customer_id: int | None = Query(default=None, gt=0),
    invoice_status: str | None = Query(default=None, alias="status", min_length=1, max_length=20),
    limit: int = Query(default=50, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
):
    statement = select(Invoice).options(
        selectinload(Invoice.line_items)
    )

    if customer_id is not None:
        statement = statement.where(Invoice.customer_id == customer_id)

    if invoice_status is not None:
        statement = statement.where(
            Invoice.status == invoice_status.strip().upper()
        )

    statement = statement.order_by(
        Invoice.created_at.desc(),
        Invoice.id.desc(),
    ).limit(limit).offset(offset)

    return list(db.scalars(statement).all())


@router.get(
    "/{invoice_id}",
    response_model=InvoiceResponse,
)
def get_invoice(
    invoice_id: int = Path(gt=0),
    db: Session = Depends(get_db),
):
    invoice = db.scalar(
        select(Invoice)
        .options(selectinload(Invoice.line_items))
        .where(Invoice.id == invoice_id)
    )

    if invoice is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Invoice not found",
        )

    return invoice
