from datetime import datetime, timezone

from sqlalchemy import (
    DateTime,
    Enum as SAEnum,
    ForeignKey,
    Integer,
    String,
    Text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.enums import (
    OperationalExceptionStatus,
    OperationalExceptionType,
)


class OperationalException(Base):
    __tablename__ = "operational_exceptions"

    id: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
    )

    exception_type: Mapped[OperationalExceptionType] = mapped_column(
        SAEnum(
            OperationalExceptionType,
            name="operationalexceptiontype",
            native_enum=True,
        ),
        nullable=False,
        index=True,
    )

    status: Mapped[OperationalExceptionStatus] = mapped_column(
        SAEnum(
            OperationalExceptionStatus,
            name="operationalexceptionstatus",
            native_enum=True,
        ),
        nullable=False,
        default=OperationalExceptionStatus.OPEN,
        index=True,
    )

    source_type: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        index=True,
    )

    source_id: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        index=True,
    )

    reason: Mapped[str] = mapped_column(
        Text,
        nullable=False,
    )

    opened_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )

    escalated_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    resolved_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    resolved_by_user_id: Mapped[int | None] = mapped_column(
        ForeignKey(
            "users.id",
            ondelete="SET NULL",
        ),
        nullable=True,
    )

    resolution_notes: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    resolved_by = relationship(
        "User",
        foreign_keys=[resolved_by_user_id],
    )