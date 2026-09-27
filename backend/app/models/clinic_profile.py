from sqlalchemy import Boolean, ForeignKey, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class ClinicProfile(Base):
    __tablename__ = "clinic_profiles"

    __table_args__ = (
        UniqueConstraint(
            "customer_id",
            name="uq_clinic_profiles_customer_id",
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

    clinic_type: Mapped[str | None] = mapped_column(
        String(100),
        nullable=True,
    )

    doctor_name: Mapped[str | None] = mapped_column(
        String(150),
        nullable=True,
    )

    speciality: Mapped[str | None] = mapped_column(
        String(150),
        nullable=True,
    )

    registration_verified: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        nullable=False,
    )

    customer = relationship(
        "Customer",
        back_populates="clinic_profile",
    )