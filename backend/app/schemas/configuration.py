from datetime import datetime
from typing import Any

from pydantic import BaseModel


class ConfigurationVersionResponse(BaseModel):
    id: int
    configuration_id: int
    version: int
    value: Any
    status: str
    effective_from: datetime | None
    effective_until: datetime | None
    created_by: int
    approved_by: int | None
    reason: str | None
    change_reference: str | None
    previous_version_id: int | None
    rollback_of_version_id: int | None
    created_at: datetime
    approved_at: datetime | None

    model_config = {
        "from_attributes": True,
    }


class ConfigurationResponse(BaseModel):
    id: int
    key: str
    description: str | None
    data_type: str
    scope: str
    scope_id: int | None
    current_version_id: int | None
    is_active: bool
    created_at: datetime
    updated_at: datetime

    model_config = {
        "from_attributes": True,
    }


class ConfigurationDetailResponse(ConfigurationResponse):
    current_version: ConfigurationVersionResponse | None = None


class ConfigurationHistoryResponse(BaseModel):
    configuration: ConfigurationResponse
    versions: list[ConfigurationVersionResponse]