from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.models.enums import (
    OperationalExceptionStatus,
    OperationalExceptionType,
)


class OperationalExceptionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    exception_type: OperationalExceptionType
    status: OperationalExceptionStatus

    source_type: str
    source_id: int
    reason: str

    opened_at: datetime
    escalated_at: datetime | None
    resolved_at: datetime | None

    resolved_by_user_id: int | None
    resolution_notes: str | None


class OperationalExceptionResolveRequest(BaseModel):
    resolution_notes: str = Field(
        min_length=1,
        max_length=2000,
    )