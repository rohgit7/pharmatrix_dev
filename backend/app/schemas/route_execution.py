from pydantic import BaseModel, Field


class CompletePickupRequest(BaseModel):
    collected_weight_kg: float = Field(
        ge=0,
        le=10000,
    )
    notes: str | None = Field(
        default=None,
        max_length=1000,
    )


class FailStopRequest(BaseModel):
    reason: str = Field(
        min_length=1,
        max_length=1000,
    )