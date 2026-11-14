from datetime import datetime, timezone
from sqlalchemy import (
    Boolean,
    DateTime,
    ForeignKey,
    Integer,
    String,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class UserConsent(Base):
    __tablename__ = "user_consents"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)

    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    consent_type: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        index=True,
    )

    policy_version: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default="1.0.0",
    )

    status: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default="CONSENTED",
        index=True,
    )

    ip_address: Mapped[str | None] = mapped_column(
        String(45),
        nullable=True,
    )

    user_agent: Mapped[str | None] = mapped_column(
        String(255),
        nullable=True,
    )

    consented_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=utc_now,
        nullable=False,
    )

    withdrawn_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    user = relationship("User")


class MarketingPreference(Base):
    __tablename__ = "marketing_preferences"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)

    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
        index=True,
    )

    email_promotions: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        nullable=False,
    )

    sms_promotions: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        nullable=False,
    )

    whatsapp_promotions: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        nullable=False,
    )

    push_promotions: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        nullable=False,
    )

    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=utc_now,
        onupdate=utc_now,
        nullable=False,
    )

    user = relationship("User")

