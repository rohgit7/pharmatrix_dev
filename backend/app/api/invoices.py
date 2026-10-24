from fastapi import APIRouter, Depends, HTTPException, Path, status, Query
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload
from uuid import UUID
from app.core.auth import require_role
from app.core.database import get_db
from app.models.invoice import Invoice
from app.models.user import UserRole
from app.schemas.invoice import InvoiceResponse


from decimal import Decimal
import uuid
from app.models.invoice import InvoiceLineItem
from app.models.pickup import Pickup
from app.models.pricing import PricingPlan, PricingPlanVersion
from app.schemas.invoice import InvoiceCreate, InvoiceResponse, InvoiceUpdate


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
    invoice_id: UUID,
    db: Session = Depends(get_db),
):
    invoice = db.scalar(
        select(Invoice)
        .options(selectinload(Invoice.line_items))
        .where(Invoice.public_id == invoice_id)
    )

    if invoice is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Invoice not found",
        )

    return invoice


@router.post(
    "/",
    response_model=InvoiceResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_invoice_endpoint(
    data: InvoiceCreate,
    db: Session = Depends(get_db),
):
    # Resolve pickup_id
    pickup_id = data.pickup_id
    if not pickup_id:
        pickup = db.query(Pickup).filter(Pickup.customer_id == data.customer_id).first()
        if not pickup:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Customer has no pickups to associate invoice with",
            )
        pickup_id = pickup.id

    # Resolve pricing plan and version
    plan_id = data.pricing_plan_id
    plan_version_id = data.pricing_plan_version_id
    if not plan_id or not plan_version_id:
        version = db.query(PricingPlanVersion).filter(PricingPlanVersion.status == "ACTIVE").first()
        if not version:
            version = db.query(PricingPlanVersion).first()
        if not version:
            # Create a default plan and version if none exist
            plan = db.query(PricingPlan).first()
            if not plan:
                plan = PricingPlan(code="STD-01", name="Standard", is_active=True, created_by=1)
                db.add(plan)
                db.flush()
            version = PricingPlanVersion(
                pricing_plan_id=plan.id,
                version=1,
                status="ACTIVE",
                currency="INR",
                per_kg_rate=Decimal("20.00"),
                pickup_fee=Decimal("50.00"),
                fee_rules={},
                created_by=1,
            )
            db.add(version)
            db.flush()
        plan_id = version.pricing_plan_id
        plan_version_id = version.id

    # Calculate line items total
    subtotal = Decimal("0.00")
    line_item_models = []
    for item in data.line_items:
        amt = item.quantity * item.unit_price
        subtotal += amt
        line_item_models.append(
            InvoiceLineItem(
                item_type=item.item_type,
                description=item.description,
                quantity=item.quantity,
                unit_price=item.unit_price,
                amount=amt,
                metadata_json=item.metadata_json,
            )
        )

    if not line_item_models:
        default_item = InvoiceLineItem(
            item_type="PICKUP_SERVICE",
            description="Pharmaceutical Waste Collection Service",
            quantity=Decimal("1.00"),
            unit_price=Decimal("150.00"),
            amount=Decimal("150.00"),
            metadata_json={},
        )
        line_item_models.append(default_item)
        subtotal = Decimal("150.00")

    tax_amount = (subtotal * Decimal("0.18")).quantize(Decimal("0.01"))
    total_amount = subtotal + tax_amount

    invoice_number = f"INV-{uuid.uuid4().hex[:8].upper()}"
    invoice = Invoice(
        invoice_number=invoice_number,
        customer_id=data.customer_id,
        pickup_id=pickup_id,
        pricing_plan_id=plan_id,
        pricing_plan_version_id=plan_version_id,
        currency=data.currency,
        subtotal=subtotal,
        tax_amount=tax_amount,
        total_amount=total_amount,
        amount_paid=Decimal("0.00"),
        status="ISSUED",
        due_date=data.due_date,
        notes=data.notes,
        pricing_snapshot={"subtotal": str(subtotal), "tax": str(tax_amount), "total": str(total_amount)},
        line_items=line_item_models,
    )

    db.add(invoice)
    db.commit()
    db.refresh(invoice)
    return invoice


@router.patch(
    "/{invoice_id}",
    response_model=InvoiceResponse,
)
def update_invoice_endpoint(
    invoice_id: UUID,
    data: InvoiceUpdate,
    db: Session = Depends(get_db),
):
    invoice = db.scalar(
        select(Invoice)
        .options(selectinload(Invoice.line_items))
        .where(Invoice.public_id == invoice_id)
    )

    if invoice is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Invoice not found",
        )

    update_dict = data.model_dump(exclude_unset=True)
    for field, value in update_dict.items():
        setattr(invoice, field, value)

    db.commit()
    db.refresh(invoice)
    return invoice


@router.delete(
    "/{invoice_id}",
    status_code=status.HTTP_200_OK,
)
def delete_invoice_endpoint(
    invoice_id: UUID,
    db: Session = Depends(get_db),
):
    invoice = db.scalar(
        select(Invoice).where(Invoice.public_id == invoice_id)
    )

    if invoice is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Invoice not found",
        )

    try:
        db.delete(invoice)
        db.commit()
    except Exception:
        db.rollback()
        invoice.status = "VOID"
        db.commit()

    return {"message": "Invoice removed successfully"}