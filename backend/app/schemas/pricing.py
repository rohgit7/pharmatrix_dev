from datetime import datetime
from decimal import Decimal
from pydantic import BaseModel, Field


class PricingPlanVersionResponse(BaseModel):
    id: int
    pricing_plan_id: int
    version: int
    status: str
    currency: str
    per_kg_rate: Decimal
    pickup_fee: Decimal
    subscription_fee: Decimal
    minimum_pickup_charge: Decimal
    included_weight_kg: Decimal
    fee_rules: dict
    effective_from: datetime | None
    effective_until: datetime | None
    created_by: int
    approved_by: int | None
    reason: str | None
    created_at: datetime
    approved_at: datetime | None

    model_config = {
        "from_attributes": True
    }


class PricingPlanResponse(BaseModel):
    id: int
    code: str
    name: str
    description: str | None = None
    is_active: bool
    created_by: int
    created_at: datetime
    updated_at: datetime
    versions: list[PricingPlanVersionResponse] = []

    model_config = {
        "from_attributes": True
    }


class PricingPlanCreate(BaseModel):
    code: str = Field(min_length=1, max_length=50)
    name: str = Field(min_length=1, max_length=150)
    description: str | None = None
    is_active: bool = True


class PricingPlanUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    is_active: bool | None = None


class PricingPlanVersionCreate(BaseModel):
    version: int = Field(ge=1)
    status: str = "ACTIVE"
    currency: str = "INR"
    per_kg_rate: Decimal = Field(ge=0)
    pickup_fee: Decimal = Field(default=Decimal("0.00"), ge=0)
    subscription_fee: Decimal = Field(default=Decimal("0.00"), ge=0)
    minimum_pickup_charge: Decimal = Field(default=Decimal("0.00"), ge=0)
    included_weight_kg: Decimal = Field(default=Decimal("0.000"), ge=0)
    fee_rules: dict = Field(default_factory=dict)
    effective_from: datetime | None = None
    effective_until: datetime | None = None
    reason: str | None = None


class CustomerPricingAssignmentResponse(BaseModel):
    id: int
    customer_id: int
    pricing_plan_id: int
    effective_from: datetime
    effective_until: datetime | None = None
    assigned_by: int
    reason: str | None = None
    created_at: datetime

    model_config = {
        "from_attributes": True
    }


class CustomerPricingAssignmentCreate(BaseModel):
    customer_id: int
    pricing_plan_id: int
    effective_from: datetime
    effective_until: datetime | None = None
    reason: str | None = None
