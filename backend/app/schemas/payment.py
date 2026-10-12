
from datetime import datetime
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


PaymentMethod = Literal[
    "CASH",
    "UPI",
    "BANK_TRANSFER",
    "CARD",
    "OTHER",
]


class PaymentCreate(BaseModel):
    invoice_id: int = Field(gt=0)
    amount: Decimal = Field(
        gt=0,
        max_digits=12,
        decimal_places=2,
    )
    payment_method: PaymentMethod
    payment_reference: str | None = Field(
        default=None,
        max_length=100,
    )
    notes: str | None = Field(
        default=None,
        max_length=2000,
    )


class PaymentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    invoice_id: int
    amount: Decimal
    payment_method: str
    status: str
    payment_reference: str | None
    idempotency_key: str | None = None
    notes: str | None
    paid_at: datetime
    created_at: datetime
