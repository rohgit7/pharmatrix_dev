
from datetime import datetime, timezone
from decimal import Decimal

from app.services.invoice_service import create_pickup_invoice, InvoiceError

import pytest
import uuid
from datetime import timedelta

from app.models.customer_location import CustomerLocation
from app.models.customer import Customer
from app.models.enums import PickupPriority, PickupStatus
from app.models.pricing import (
    CustomerPricingAssignment,
    PricingPlan,
    PricingPlanVersion,
)
from app.models.user import User
from app.models.enums import CustomerType, UserRole
from app.models.invoice import Invoice, InvoiceLineItem
from app.models.pickup import Pickup
from app.services.invoice_service import (
    InvoiceError,
    create_pickup_invoice,
)
def create_invoice_setup(db):
    from tests.test_pricing_service import create_pricing_setup

    setup = create_pricing_setup(db)
    customer = setup["customer"]

    location = CustomerLocation(
        customer_id=customer.id,
        location_code=f"INV-{uuid.uuid4().hex[:8]}",
        name="Invoice Test Location",
        address_line_1="123 Test Road",
        city="Bengaluru",
        state="Karnataka",
        postal_code="560001",
        latitude=12.9716,
        longitude=77.5946,
        service_time_seconds=300,
        pickup_enabled=True,
        is_active=True,
    )
    db.add(location)
    db.flush()

    pickup = Pickup(
        pickup_code=f"PK-{uuid.uuid4().hex[:10]}",
        customer_id=customer.id,
        location_id=location.id,
        status=PickupStatus.COLLECTED,
        priority=PickupPriority.NORMAL,
        requested_date=datetime.now(timezone.utc),
        estimated_weight_kg=Decimal("5.000"),
        verification_token=uuid.uuid4().hex,
    )
    db.add(pickup)
    db.flush()

    return {**setup, "location": location, "pickup": pickup}


def test_create_pickup_invoice_rejects_missing_pickup(db):
    with pytest.raises(InvoiceError, match="Pickup not found"):
        create_pickup_invoice(
            db=db,
            pickup_id=999999,
            actual_weight_kg=Decimal("5.000"),
        )


def test_create_pickup_invoice_rejects_negative_weight(db):
    with pytest.raises(InvoiceError, match="negative"):
        create_pickup_invoice(
            db=db,
            pickup_id=1,
            actual_weight_kg=Decimal("-1.000"),
        )


def test_create_pickup_invoice_rejects_negative_tax(db):
    with pytest.raises(InvoiceError, match="Tax amount"):
        create_pickup_invoice(
            db=db,
            pickup_id=1,
            actual_weight_kg=Decimal("5.000"),
            tax_amount=Decimal("-10.00"),
        )



def test_create_pickup_invoice_creates_invoice_and_line_items(db):
    setup = create_invoice_setup(db)

    invoice = create_pickup_invoice(
        db=db,
        pickup_id=setup["pickup"].id,
        actual_weight_kg=Decimal("5.000"),
    )

    db.flush()
    db.refresh(invoice)

    assert invoice.id is not None
    assert invoice.customer_id == setup["customer"].id
    assert invoice.pickup_id == setup["pickup"].id
    assert invoice.status == "ISSUED"
    assert invoice.subtotal == Decimal("110.00")
    assert invoice.tax_amount == Decimal("0.00")
    assert invoice.total_amount == Decimal("110.00")
    assert invoice.amount_paid == Decimal("0.00")

    non_tax_total = sum(
        (item.amount for item in invoice.line_items if item.item_type != "TAX"),
        Decimal("0.00"),
    )
    assert non_tax_total == invoice.subtotal



def test_create_pickup_invoice_rejects_duplicate_invoice(db):
    setup = create_invoice_setup(db)

    create_pickup_invoice(
        db=db,
        pickup_id=setup["pickup"].id,
        actual_weight_kg=Decimal("5.000"),
    )
    db.flush()

    with pytest.raises(InvoiceError, match="invoice already exists"):
        create_pickup_invoice(
            db=db,
            pickup_id=setup["pickup"].id,
            actual_weight_kg=Decimal("5.000"),
        )

def test_create_pickup_invoice_includes_tax_in_total(db):
    setup = create_invoice_setup(db)

    invoice = create_pickup_invoice(
        db=db,
        pickup_id=setup["pickup"].id,
        actual_weight_kg=Decimal("5.000"),
        tax_amount=Decimal("19.80"),
    )

    db.flush()
    db.refresh(invoice)

    assert invoice.subtotal == Decimal("110.00")
    assert invoice.tax_amount == Decimal("19.80")
    assert invoice.total_amount == Decimal("129.80")

def test_invoice_line_items_match_subtotal(db):
    setup = create_invoice_setup(db)

    invoice = create_pickup_invoice(
        db=db,
        pickup_id=setup["pickup"].id,
        actual_weight_kg=Decimal("5.000"),
        tax_amount=Decimal("19.80"),
    )

    db.flush()
    db.refresh(invoice)

    non_tax_total = sum(
        (
            item.amount
            for item in invoice.line_items
            if item.item_type != "TAX"
        ),
        Decimal("0.00"),
    )

    tax_total = sum(
        (
            item.amount
            for item in invoice.line_items
            if item.item_type == "TAX"
        ),
        Decimal("0.00"),
    )

    assert non_tax_total == invoice.subtotal
    assert tax_total == invoice.tax_amount
    assert invoice.total_amount == invoice.subtotal + invoice.tax_amount


def test_invoice_contains_pickup_fee_and_weight_charges(db):
    setup = create_invoice_setup(db)

    invoice = create_pickup_invoice(
        db=db,
        pickup_id=setup["pickup"].id,
        actual_weight_kg=Decimal("5.000"),
    )

    db.flush()
    db.refresh(invoice)

    item_types = {item.item_type for item in invoice.line_items}

    assert "PICKUP_FEE" in item_types
    assert "WEIGHT_CHARGE" in item_types


def test_invoice_tax_line_item_matches_tax_amount(db):
    setup = create_invoice_setup(db)

    invoice = create_pickup_invoice(
        db=db,
        pickup_id=setup["pickup"].id,
        actual_weight_kg=Decimal("5.000"),
        tax_amount=Decimal("19.80"),
    )

    db.flush()
    db.refresh(invoice)

    tax_items = [
        item for item in invoice.line_items
        if item.item_type == "TAX"
    ]

    assert len(tax_items) == 1
    assert tax_items[0].amount == Decimal("19.80")