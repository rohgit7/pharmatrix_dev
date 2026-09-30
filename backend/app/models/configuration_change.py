from datetime import datetime, timezone

from sqlalchemy import (
    DateTime,
    ForeignKey,
    Integer,
    JSON,
    String,
    Text,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class ConfigurationChange(Base):
    __tablename__ = "configuration_changes"

    id: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
    )

    configuration_id: Mapped[int] = mapped_column(
        ForeignKey(
            "configurations.id",
            ondelete="CASCADE",
        ),
        nullable=False,
        index=True,
    )

    base_version_id: Mapped[int | None] = mapped_column(
        ForeignKey(
            "configuration_versions.id",
            ondelete="SET NULL",
        ),
        nullable=True,
    )

    rollback_of_version_id: Mapped[int | None] = mapped_column(
        ForeignKey(
            "configuration_versions.id",
            ondelete="SET NULL",
        ),
        nullable=True,
    )

    proposed_value: Mapped[
        dict | list | str | int | float | bool | None
    ] = mapped_column(
        JSON,
        nullable=True,
    )

    status: Mapped[str] = mapped_column(
        String(30),
        nullable=False,
        default="PENDING_APPROVAL",
        index=True,
    )

    risk_level: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default="HIGH",
    )

    reason: Mapped[str] = mapped_column(
        Text,
        nullable=False,
    )

    change_reference: Mapped[str | None] = mapped_column(
        String(150),
        nullable=True,
    )

    effective_from: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    created_by: Mapped[int] = mapped_column(
        ForeignKey(
            "users.id",
            ondelete="RESTRICT",
        ),
        nullable=False,
    )

    approved_by: Mapped[int | None] = mapped_column(
        ForeignKey(
            "users.id",
            ondelete="RESTRICT",
        ),
        nullable=True,
    )

    rejected_by: Mapped[int | None] = mapped_column(
        ForeignKey(
            "users.id",
            ondelete="RESTRICT",
        ),
        nullable=True,
    )

    review_comment: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )

    reviewed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )