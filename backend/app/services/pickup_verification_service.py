import hashlib
import secrets
from datetime import datetime, timedelta, timezone

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models.enums import PickupStatus
from app.models.pickup import Pickup
from app.models.user import User


def get_customer_pickup(
    db: Session,
    user: User,
    pickup_id: int,
) -> Pickup:

    pickup = (
        db.query(Pickup)
        .filter(
            Pickup.id == pickup_id,
            Pickup.customer.has(
                user_id=user.id
            ),
        )
        .first()
    )

    if not pickup:
        raise HTTPException(
            status_code=404,
            detail="Pickup not found",
        )

    return pickup


def get_verification_details(
    db: Session,
    user: User,
    pickup_id: int,
):
    pickup = get_customer_pickup(
        db,
        user,
        pickup_id,
    )

    return pickup


def generate_otp() -> str:
    return f"{secrets.randbelow(1_000_000):06d}"


def hash_otp(otp: str) -> str:
    return hashlib.sha256(
        otp.encode("utf-8")
    ).hexdigest()


def request_otp(
    db: Session,
    user: User,
    pickup_id: int,
):
    pickup = get_customer_pickup(
        db,
        user,
        pickup_id,
    )

    if pickup.status in {
        PickupStatus.CANCELLED,
        PickupStatus.COLLECTED,
    }:
        raise HTTPException(
            status_code=400,
            detail="OTP cannot be generated for this pickup",
        )

    otp = generate_otp()

    expires_at = (
        datetime.now(timezone.utc)
        + timedelta(minutes=10)
    )

    pickup.otp_hash = hash_otp(otp)
    pickup.otp_expires_at = expires_at
    pickup.otp_attempts = 0
    pickup.otp_verified_at = None

    db.commit()
    db.refresh(pickup)

    # DEVELOPMENT ONLY:
    # Later this will send the OTP via WhatsApp/SMS.
    return pickup, otp