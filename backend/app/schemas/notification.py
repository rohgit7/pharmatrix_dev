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