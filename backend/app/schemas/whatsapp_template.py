from datetime import datetime

from pydantic import BaseModel, Field

from app.models.enums import NotificationType


class WhatsAppTemplateCreate(BaseModel):
    notification_type: NotificationType
    template_key: str = Field(
        min_length=1,
        max_length=100,
    )
    meta_template_name: str = Field(
        min_length=1,
        max_length=100,
    )
    language_code: str = Field(
        default="en_US",
        min_length=2,
        max_length=20,
    )
    parameter_keys: list[str] = Field(
        default_factory=list,
    )
    is_active: bool = True


class WhatsAppTemplateUpdate(BaseModel):
    template_key: str | None = Field(
        default=None,
        min_length=1,
        max_length=100,
    )
    meta_template_name: str | None = Field(
        default=None,
        min_length=1,
        max_length=100,
    )
    language_code: str | None = Field(
        default=None,
        min_length=2,
        max_length=20,
    )
    parameter_keys: list[str] | None = None
    is_active: bool | None = None


class WhatsAppTemplateResponse(BaseModel):
    id: int
    notification_type: NotificationType
    template_key: str
    meta_template_name: str
    language_code: str
    parameter_keys: list
    is_active: bool
    created_at: datetime
    updated_at: datetime

    model_config = {
        "from_attributes": True,
    }