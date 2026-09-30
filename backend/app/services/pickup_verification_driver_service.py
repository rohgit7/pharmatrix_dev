from datetime import datetime, timezone
import secrets
import hashlib
from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models.enums import (
    RouteStatus,
    RouteStopStatus,
    RouteStopType,
)
from app.models.route_stop import RouteStop
from app.services.route_execution_service import (
    get_driver_route,
)


def verify_qr(
    db: Session,
    user,
    route_id: int,
    stop_id: int,
    qr_token: str,
):
    driver, route = get_driver_route(
        db,
        user,
        route_id,
    )

    if route.status != RouteStatus.IN_PROGRESS:
        raise HTTPException(
            status_code=400,
            detail="Route is not in progress",
        )

    stop = (
        db.query(RouteStop)
        .filter(
            RouteStop.id == stop_id,
            RouteStop.route_id == route.id,
        )
        .with_for_update()
        .first()
    )

    if not stop:
        raise HTTPException(
            status_code=404,
            detail="Route stop not found",
        )

    if stop.stop_type != RouteStopType.PICKUP:
        raise HTTPException(
            status_code=400,
            detail="QR verification is only for pickup stops",
        )

    if stop.execution_status != RouteStopStatus.PENDING:
        raise HTTPException(
            status_code=400,
            detail="Pickup stop is no longer pending",
        )

    previous_stop = (
        db.query(RouteStop)
        .filter(
            RouteStop.route_id == route.id,
            RouteStop.sequence_number
            < stop.sequence_number,
        )
        .order_by(
            RouteStop.sequence_number.desc()
        )
        .first()
    )

    if previous_stop and (
        previous_stop.execution_status
        != RouteStopStatus.COMPLETED
    ):
        raise HTTPException(
            status_code=409,
            detail="Complete the previous stop first",
        )

    pickup = stop.pickup

    if not pickup:
        raise HTTPException(
            status_code=500,
            detail="Pickup stop has no pickup",
        )

    if not secrets.compare_digest(
        pickup.verification_token,
        qr_token,
    ):
        raise HTTPException(
            status_code=403,
            detail="Invalid pickup QR code",
        )

    now = datetime.now(timezone.utc)

    pickup.qr_verified_at = now

    stop.execution_status = RouteStopStatus.ARRIVED
    stop.arrived_at = now

    db.commit()
    db.refresh(stop)

    return stop

def verify_otp(
    db: Session,
    user,
    route_id: int,
    stop_id: int,
    otp: str,
):
    driver, route = get_driver_route(
        db,
        user,
        route_id,
    )

    if route.status != RouteStatus.IN_PROGRESS:
        raise HTTPException(
            status_code=400,
            detail="Route is not in progress",
        )

    stop = (
        db.query(RouteStop)
        .filter(
            RouteStop.id == stop_id,
            RouteStop.route_id == route.id,
        )
        .with_for_update()
        .first()
    )

    if not stop:
        raise HTTPException(
            status_code=404,
            detail="Route stop not found",
        )

    if stop.stop_type != RouteStopType.PICKUP:
        raise HTTPException(
            status_code=400,
            detail="OTP is only required for pickup stops",
        )

    pickup = stop.pickup

    if not pickup:
        raise HTTPException(
            status_code=500,
            detail="Pickup not found",
        )

    if pickup.qr_verified_at is None:
        raise HTTPException(
            status_code=409,
            detail="Pickup QR must be verified first",
        )

    if pickup.otp_verified_at is not None:
        return stop

    if not pickup.otp_hash:
        raise HTTPException(
            status_code=400,
            detail="No OTP has been generated",
        )

    if not pickup.otp_expires_at:
        raise HTTPException(
            status_code=400,
            detail="OTP has no expiry",
        )

    now = datetime.now(timezone.utc)

    if now > pickup.otp_expires_at:
        raise HTTPException(
            status_code=400,
            detail="OTP has expired",
        )

    if pickup.otp_attempts >= 5:
        raise HTTPException(
            status_code=429,
            detail="Maximum OTP attempts exceeded",
        )

    pickup.otp_attempts += 1

    submitted_hash = hashlib.sha256(
        otp.encode("utf-8")
    ).hexdigest()

    if not secrets.compare_digest(
        submitted_hash,
        pickup.otp_hash,
    ):
        db.commit()

        raise HTTPException(
            status_code=400,
            detail="Invalid OTP",
        )

    pickup.otp_verified_at = now

    stop.execution_status = (
        RouteStopStatus.IN_PROGRESS
    )

    db.commit()
    db.refresh(stop)

    return stop