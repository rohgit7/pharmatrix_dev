from datetime import datetime
from typing import Any
from pydantic import BaseModel, Field


class ConsentRecordRequest(BaseModel):
    consent_type: str = Field(
        ...,
        description="Type of consent: TERMS_AND_CONDITIONS, PRIVACY_POLICY, MARKETING_PROMOTIONAL, GPS_LOCATION_TRACKING, DATA_PROCESSING",
    )
    policy_version: str = Field(default="1.0.0", max_length=20)
    status: str = Field(default="CONSENTED", pattern="^(CONSENTED|WITHDRAWN)$")


class ConsentRecordResponse(BaseModel):
    id: int
    user_id: int
    consent_type: str
    policy_version: str
    status: str
    consented_at: datetime
    withdrawn_at: datetime | None = None

    model_config = {"from_attributes": True}


class MarketingPreferencesUpdate(BaseModel):
    email_promotions: bool | None = None
    sms_promotions: bool | None = None
    whatsapp_promotions: bool | None = None
    push_promotions: bool | None = None


class MarketingPreferencesResponse(BaseModel):
    user_id: int
    email_promotions: bool
    sms_promotions: bool
    whatsapp_promotions: bool
    push_promotions: bool
    updated_at: datetime

    model_config = {"from_attributes": True}


class DataExportResponse(BaseModel):
    export_timestamp: datetime
    data_principal: dict[str, Any]
    business_profile: dict[str, Any] | None
    registered_locations: list[dict[str, Any]]
    pickup_history: list[dict[str, Any]]
    billing_history: list[dict[str, Any]]
    consents_and_preferences: list[dict[str, Any]]


class DataDeletionRequest(BaseModel):
    confirm_legal_acknowledgement: bool = Field(
        ...,
        description="Acknowledges that statutory tax, hazardous waste, and environmental records will be anonymized and preserved in accordance with Indian law.",
    )
    reason: str | None = Field(default=None, max_length=500)


class DataDeletionResponse(BaseModel):
    status: str
    message: str
    user_id: int
    records_anonymized: dict[str, int]
    statutory_retention_notice: str

