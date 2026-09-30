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


class ConfigurationAudit(Base):
    __tablename__ = "configuration_audits"

    id: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
    )

    configuration_id: Mapped[int] = mapped_column(
        ForeignKey(
            "configurations.id",
            ondelete="RESTRICT",
        ),
        nullable=False,
        index=True,
    )

    configuration_version_id: Mapped[int | None] = mapped_column(
        ForeignKey(
            "configuration_versions.id",
            ondelete="SET NULL",
        ),
        nullable=True,
        index=True,
    )

    change_request_id: Mapped[int | None] = mapped_column(
        ForeignKey(
            "configuration_changes.id",
            ondelete="SET NULL",
        ),
        nullable=True,
        index=True,
    )

    actor_id: Mapped[int] = mapped_column(
        ForeignKey(
            "users.id",
            ondelete="RESTRICT",
        ),
        nullable=False,
        index=True,
    )

    action: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        index=True,
    )

    old_value: Mapped[dict | list | str | int | float | bool | None] = mapped_column(
        JSON,
        nullable=True,
    )

    new_value: Mapped[dict | list | str | int | float | bool | None] = mapped_column(
        JSON,
        nullable=True,
    )

    reason: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    change_reference: Mapped[str | None] = mapped_column(
        String(150),
        nullable=True,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
        index=True,
    )