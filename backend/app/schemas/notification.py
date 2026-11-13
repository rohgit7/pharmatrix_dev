from datetime import datetime

from pydantic import BaseModel

from app.models.enums import (
    NotificationChannel,
    NotificationStatus,
    NotificationType,
)


class NotificationResponse(BaseModel):
    id: int
    notification_type: NotificationType
    channel: NotificationChannel
    status: NotificationStatus
    title: str
    body: str
    metadata: dict | None = None
    read_at: datetime | None = None
    sent_at: datetime | None = None
    created_at: datetime
    provider_status: str | None = None
    provider_status_at: datetime | None = None
    
    model_config = {
        "from_attributes": True
    }


class DeviceTokenRegisterRequest(BaseModel):
    expo_push_token: str
    device_platform: str = "android"
    device_name: str | None = None


class DeviceTokenDeactivateRequest(BaseModel):
    expo_push_token: str


class DeviceTokenResponse(BaseModel):
    id: int
    user_id: int
    expo_push_token: str
    device_platform: str
    device_name: str | None = None
    is_active: bool
    created_at: datetime
    updated_at: datetime

    model_config = {
        "from_attributes": True
    }


class TestPushRequest(BaseModel):
    title: str = "Test Notification"
    body: str = "This is a test notification from Pharmatrix."
