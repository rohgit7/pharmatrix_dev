from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field


class InvoiceLineItemResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    invoice_id: int
    item_type: str
    description: str
    quantity: Decimal
    unit_price: Decimal
    amount: Decimal
    metadata_json: dict
    created_at: datetime


class InvoiceResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    invoice_number: str
    customer_id: int
    pickup_id: int
    pricing_plan_id: int
    pricing_plan_version_id: int
    currency: str
    subtotal: Decimal
    tax_amount: Decimal
    total_amount: Decimal
    amount_paid: Decimal
    outstanding_amount: Decimal
    status: str
    issued_at: datetime
    due_date: datetime | None
    paid_at: datetime | None
    pricing_snapshot: dict
    notes: str | None
    created_at: datetime
    updated_at: datetime
    line_items: list[InvoiceLineItemResponse] = Field(default_factory=list)
