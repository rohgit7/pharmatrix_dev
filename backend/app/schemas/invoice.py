from datetime import datetime
from decimal import Decimal
from uuid import UUID
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
    public_id: UUID
    invoice_number: str
    customer_id: int
    customer_public_id: UUID
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


class InvoiceLineItemCreate(BaseModel):
    item_type: str = "SERVICE"
    description: str
    quantity: Decimal = Field(default=Decimal("1.00"), gt=0)
    unit_price: Decimal = Field(ge=0)
    metadata_json: dict = Field(default_factory=dict)


class InvoiceCreate(BaseModel):
    customer_id: int
    pickup_id: int | None = None
    pricing_plan_id: int | None = None
    pricing_plan_version_id: int | None = None
    currency: str = "INR"
    due_date: datetime | None = None
    notes: str | None = None
    line_items: list[InvoiceLineItemCreate] = Field(default_factory=list)


class InvoiceUpdate(BaseModel):
    status: str | None = None
    due_date: datetime | None = None
    notes: str | None = None

