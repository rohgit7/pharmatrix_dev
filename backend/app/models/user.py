from enum import Enum
from uuid import UUID

from sqlalchemy import Boolean, Enum as SAEnum, String
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class UserRole(str, Enum):
    ADMIN = "ADMIN"
    DRIVER = "DRIVER"
    CUSTOMER = "CUSTOMER"
    FACILITY = "FACILITY"

class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(
        primary_key=True
    )

    auth_user_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        unique=True,
        nullable=False,
        index=True,
    )

    name: Mapped[str] = mapped_column(
        String(120),
        nullable=False,
    )

    email: Mapped[str | None] = mapped_column(
        String(255),
        unique=True,
        nullable=True,
        index=True,
    )

    role: Mapped[UserRole] = mapped_column(
        SAEnum(
            UserRole,
            name="userrole",
            native_enum=True,
        ),
        nullable=False,
        default=UserRole.CUSTOMER,
    )

    is_active: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
        nullable=False,
    )

    customer = relationship(
        "Customer",
        back_populates="user",
        uselist=False,
    )

    driver = relationship(
        "Driver",
        back_populates="user",
        uselist=False,
    )