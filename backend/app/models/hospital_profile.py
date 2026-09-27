from sqlalchemy import (
    Boolean,
    ForeignKey,
    Integer,
    String,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class HospitalProfile(Base):
    __tablename__ = "hospital_profiles"

    __table_args__ = (
        UniqueConstraint(
            "customer_id",
            name="uq_hospital_profiles_customer_id",
        ),
    )

    id: Mapped[int] = mapped_column(
        primary_key=True,
    )

    customer_id: Mapped[int] = mapped_column(
        ForeignKey(
            "customers.id",
            ondelete="CASCADE",
        ),
        nullable=False,
        index=True,
    )

    registration_number: Mapped[str | None] = mapped_column(
        String(100),
        nullable=True,
    )

    hospital_type: Mapped[str | None] = mapped_column(
        String(100),
        nullable=True,
    )


    department_count: Mapped[int | None] = mapped_column(
        Integer,
        nullable=True,
    )

    registration_verified: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        nullable=False,
    )

    customer = relationship(
        "Customer",
        back_populates="hospital_profile",
    )