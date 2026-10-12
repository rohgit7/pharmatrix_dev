
from datetime import datetime, timezone
from decimal import Decimal, ROUND_HALF_UP

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.invoice import Invoice, InvoiceLineItem
from app.models.pickup import Pickup
from app.services.pricing_service import (
    PricingError,
    calculate_pickup_charges,
)


class InvoiceError(Exception):
    pass


def money(value: Decimal) -> Decimal:
    return Decimal(str(value)).quantize(
        Decimal("0.01"),
        rounding=ROUND_HALF_UP,
    )


def create_pickup_invoice(
    db: Session,
    pickup_id: int,
    actual_weight_kg: Decimal,
    due_date: datetime | None = None,
    tax_amount: Decimal = Decimal("0.00"),
    notes: str | None = None,
) -> Invoice:
    """
    Create one invoice for a pickup using the pricing rules
    effective at the time of invoicing.

    The caller must commit the transaction.
    """

    if actual_weight_kg < Decimal("0"):
        raise InvoiceError("Actual weight cannot be negative.")

    tax_amount = money(tax_amount)

    if tax_amount < Decimal("0"):
        raise InvoiceError("Tax amount cannot be negative.")

    pickup = db.scalar(
        select(Pickup)
        .where(Pickup.id == pickup_id)
        .with_for_update()
    )

    if pickup is None:
        raise InvoiceError("Pickup not found.")

    existing_invoice = db.scalar(
        select(Invoice).where(Invoice.pickup_id == pickup_id)
    )

    if existing_invoice is not None:
        raise InvoiceError(
            f"An invoice already exists for pickup {pickup_id}."
        )

    if pickup.customer_id is None:
        raise InvoiceError("Pickup has no customer.")

    try:
        charges = calculate_pickup_charges(
            db=db,
            customer_id=pickup.customer_id,
            actual_weight_kg=actual_weight_kg,
            at_time=datetime.now(timezone.utc),
        )
    except PricingError as exc:
        raise InvoiceError(str(exc)) from exc

# Pickup invoices must not include recurring subscription fees.
    subtotal = money(Decimal(str(charges["pickup_charge"])))
    total_amount = money(subtotal + tax_amount)

    invoice_number = (
        f"INV-{datetime.now(timezone.utc):%Y%m%d}-"
        f"{pickup.id:06d}"
    )

    invoice = Invoice(
        invoice_number=invoice_number,
        customer_id=pickup.customer_id,
        pickup_id=pickup.id,
        pricing_plan_id=charges["pricing_plan_id"],
        pricing_plan_version_id=charges["pricing_plan_version_id"],
        currency=charges["currency"],
        subtotal=subtotal,
        tax_amount=tax_amount,
        total_amount=total_amount,
        amount_paid=Decimal("0.00"),
        status="ISSUED",
        issued_at=datetime.now(timezone.utc),
        due_date=due_date,
        pricing_snapshot={
            **{
                key: str(value) if isinstance(value, Decimal) else value
                for key, value in charges.items()
            },
            "invoice_subtotal": str(subtotal),
            "tax_amount": str(tax_amount),
            "subscription_fee_billed": "0.00",
        },
        notes=notes,
    )

    line_items = [
        (
            "WEIGHT_CHARGE",
            "Billable weight charge",
            Decimal(str(charges["billable_weight_kg"])),
            Decimal(str(charges["per_kg_rate"]))
            if "per_kg_rate" in charges
            else Decimal("0.00"),
            Decimal(str(charges["weight_charge"])),
        ),
        (
            "PICKUP_FEE",
            "Pickup fee",
            Decimal("1.000"),
            Decimal("1.00"),
            Decimal(str(charges["pickup_fee"])),
        ),
    ]

    for item_type, description, quantity, unit_price, amount in line_items:
        if amount > 0:
            invoice.line_items.append(
                InvoiceLineItem(
                    item_type=item_type,
                    description=description,
                    quantity=quantity,
                    unit_price=money(unit_price),
                    amount=money(amount),
                )
            )

    # The calculator's minimum-charge adjustment and subscription
    # component need explicit line items; add them only when applicable.
    pickup_components = money(
        Decimal(str(charges["pickup_charge"]))
        - Decimal(str(charges["weight_charge"]))
        - Decimal(str(charges["pickup_fee"]))
    )

    if pickup_components > 0:
        invoice.line_items.append(
            InvoiceLineItem(
                item_type="MINIMUM_CHARGE_ADJUSTMENT",
                description="Minimum pickup charge adjustment",
                quantity=Decimal("1.000"),
                unit_price=pickup_components,
                amount=pickup_components,
            )
        )

    # Add tax line item
    if tax_amount > 0:
        invoice.line_items.append(
            InvoiceLineItem(
                item_type="TAX",
                description="Tax",
                quantity=Decimal("1.000"),
                unit_price=tax_amount,
                amount=tax_amount,
            )
        )

    # Save invoice and line items
    db.add(invoice)


    # Save the invoice and line items inside a savepoint.
    try:
        with db.begin_nested():
            db.add(invoice)
            db.flush()
    except IntegrityError as exc:
        raise InvoiceError(
            "Invoice creation conflicted with another transaction."
        ) from exc

    return invoice
