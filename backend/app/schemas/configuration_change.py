from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field


class ConfigurationChangeCreate(BaseModel):
    configuration_id: int
    proposed_value: Any = None

    risk_level: str = Field(
        default="HIGH",
        max_length=20,
    )

    reason: str = Field(
        min_length=1,
        max_length=2000,
    )

    change_reference: str | None = Field(
        default=None,
        max_length=150,
    )

    effective_from: datetime | None = None


class ConfigurationChangeReview(BaseModel):
    comment: str | None = Field(
        default=None,
        max_length=2000,
    )

class ConfigurationRollbackCreate(BaseModel):
    rollback_to_version_id: int

    reason: str = Field(
        min_length=1,
        max_length=2000,
    )

    change_reference: str | None = Field(
        default=None,
        max_length=150,
    )

    effective_from: datetime | None = None

class ConfigurationChangeResponse(BaseModel):
    id: int
    configuration_id: int
    base_version_id: int | None
    proposed_value: Any
    status: str
    risk_level: str
    reason: str
    change_reference: str | None
    effective_from: datetime | None
    created_by: int
    approved_by: int | None
    rejected_by: int | None
    review_comment: str | None
    created_at: datetime
    reviewed_at: datetime | None
    rollback_of_version_id: int | None

    model_config = {
        "from_attributes": True,
    }