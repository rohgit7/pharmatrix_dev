from datetime import datetime, timezone

from sqlalchemy import (
    Boolean,
    DateTime,
    Enum as SAEnum,
    Integer,
    JSON,
    String,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from app.models.enums import NotificationType


class WhatsAppTemplate(Base):
    __tablename__ = "whatsapp_templates"

    __table_args__ = (
        UniqueConstraint(
            "notification_type",
            "language_code",
            name="uq_whatsapp_template_type_language",
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True)

    notification_type: Mapped[NotificationType] = mapped_column(
        SAEnum(
            NotificationType,
            name="notification_type",
            native_enum=True,
        ),
        nullable=False,
        index=True,
    )

    template_key: Mapped[str] = mapped_column(
        String(100),
        unique=True,
        nullable=False,
        index=True,
    )

    meta_template_name: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
    )

    language_code: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default="en_US",
    )

    parameter_keys: Mapped[list] = mapped_column(
        JSON,
        nullable=False,
        default=list,
    )

    is_active: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=True,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )

    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )