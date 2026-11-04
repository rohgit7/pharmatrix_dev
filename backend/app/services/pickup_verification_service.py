import hashlib
import secrets
from datetime import datetime, timedelta, timezone
from uuid import UUID
from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models.enums import PickupStatus, UserRole
from app.models.pickup import Pickup
from app.models.user import User


def get_customer_pickup(
    db: Session,
    user: User,
    pickup_id: UUID | int,
) -> Pickup:
    if user.role == UserRole.DRIVER:
        raise HTTPException(
            status_code=403,
            detail="Drivers are not authorized to access customer pickup verification or OTP",
        )

    if user.role not in {UserRole.CUSTOMER, UserRole.ADMIN}:
        raise HTTPException(
            status_code=403,
            detail="Not authorized to access this pickup",
        )

    if isinstance(pickup_id, int):
        pickup = (
            db.query(Pickup)
            .filter(Pickup.id == pickup_id)
            .first()
        )
    else:
        pickup = (
            db.query(Pickup)
            .filter(Pickup.public_id == pickup_id)
            .first()
        )

    if not pickup:
        raise HTTPException(
            status_code=404,
            detail="Pickup not found",
        )

    if user.role == UserRole.CUSTOMER:
        if not pickup.customer or pickup.customer.user_id != user.id:
            raise HTTPException(
                status_code=404,
                detail="Pickup not found",
            )

    return pickup


def get_verification_details(
    db: Session,
    user: User,
    pickup_id: UUID | int,
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


OTP_REQUEST_COOLDOWN_SECONDS = 60
OTP_REQUEST_WINDOW_MINUTES = 60
OTP_REQUESTS_PER_WINDOW = 5


def request_otp(
    db: Session,
    user: User,
    pickup_id: UUID | int,
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

    now = datetime.now(timezone.utc)

    if (
        pickup.otp_last_requested_at is not None
        and (
            now - pickup.otp_last_requested_at
        ).total_seconds()
        < OTP_REQUEST_COOLDOWN_SECONDS
        and user.role != UserRole.ADMIN
    ):
        raise HTTPException(
            status_code=429,
            detail=(
                "Please wait before requesting "
                "another OTP"
            ),
        )

    if (
        pickup.otp_request_window_started_at is None
        or (
            now - pickup.otp_request_window_started_at
        ).total_seconds()
        >= OTP_REQUEST_WINDOW_MINUTES * 60
    ):
        pickup.otp_request_window_started_at = now
        pickup.otp_request_count = 0

    if (
        pickup.otp_request_count
        >= OTP_REQUESTS_PER_WINDOW
    ):
        raise HTTPException(
            status_code=429,
            detail=(
                "Maximum OTP requests exceeded. "
                "Please try again later."
            ),
        )

    otp = generate_otp()

    expires_at = (
        now
        + timedelta(minutes=10)
    )

    pickup.otp_last_requested_at = now
    pickup.otp_request_count += 1

    pickup.otp_hash = hash_otp(otp)
    pickup.otp_expires_at = expires_at
    pickup.otp_attempts = 0
    pickup.otp_verified_at = None

    db.commit()
    db.refresh(pickup)

    return pickup, otp
