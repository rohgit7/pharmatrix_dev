from datetime import datetime, timezone
from sqlalchemy import (
    DateTime,
    ForeignKey,
    Integer,
    JSON,
    String,
    Text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
    )

    entity_type: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        index=True,
    )

    entity_id: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
        index=True,
    )

    action: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
        index=True,
    )

    actor_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    actor_email: Mapped[str | None] = mapped_column(
        String(255),
        nullable=True,
    )

    old_values: Mapped[dict | None] = mapped_column(
        JSON,
        nullable=True,
    )

    new_values: Mapped[dict | None] = mapped_column(
        JSON,
        nullable=True,
    )

    notes: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
        index=True,
    )

    actor = relationship("User")

    @property
    def details(self) -> dict:
        return self.new_values or {}

    @details.setter
    def details(self, val: dict | None):
        self.new_values = val

    @property
    def actor_name(self) -> str | None:
        if self.actor:
            return getattr(self.actor, "name", None) or getattr(self.actor, "full_name", None)
        if self.new_values and "actor_name" in self.new_values:
            return self.new_values["actor_name"]
        return self.actor_email or "System"

    @property
    def entity_code(self) -> str | None:
        if self.new_values and "entity_code" in self.new_values:
            return self.new_values["entity_code"]
        if self.notes and "code:" in self.notes.lower():
            return self.notes.split(":")[-1].strip()
        return None
