from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from fastapi import File, UploadFile
from app.core.auth import get_current_user, require_role
from app.core.rate_limiter import limiter
from app.core.database import get_db
from app.models.user import User, UserRole
from app.schemas.route_execution import (
    ArriveAtStopRequest,
    CompletePickupRequest,
    DriverLocationPingRequest,
    FailStopRequest,
    UploadProofBase64Request,
    WeighPickupRequest,
)
from app.services.route_execution_service import (
    arrive_at_stop,
    complete_stop,
    fail_stop,
    record_stop_weight,
    start_route,
)
from app.schemas.pickup_verification import (
    VerifyOTPRequest,
    VerifyQRRequest,
)

from app.services.pickup_verification_driver_service import (
    verify_otp,
    verify_qr,
)

from app.services.collection_proof_service import (
    upload_collection_proof,
    upload_collection_proof_base64,
)

from app.services.collection_proof_service import (
    get_collection_proof_url,
)

router = APIRouter(
    prefix="/api/driver/routes",
    tags=["Driver - Route Execution"],
    dependencies=[
        Depends(require_role(UserRole.DRIVER))
    ],
)


@router.get(
    "/{route_id}/stops/{stop_id}/proof-url",
)
def get_collection_proof_url_endpoint(
    route_id: int,
    stop_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return get_collection_proof_url(
        db=db,
        user=current_user,
        route_id=route_id,
        stop_id=stop_id,
    )


@router.post("/{route_id}/start")
def start_route_endpoint(
    route_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    route = start_route(
        db=db,
        user=current_user,
        route_id=route_id,
    )

    return {
        "message": "Route started",
        "route_id": route.id,
        "status": route.status,
    }


@router.post("/{route_id}/stops/{stop_id}/arrive")
def arrive_at_stop_endpoint(
    route_id: int,
    stop_id: int,
    data: ArriveAtStopRequest | None = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    latitude = data.latitude if data else None
    longitude = data.longitude if data else None
    accuracy_meters = data.accuracy_meters if data else None

    stop = arrive_at_stop(
        db=db,
        user=current_user,
        route_id=route_id,
        stop_id=stop_id,
        latitude=latitude,
        longitude=longitude,
        accuracy_meters=accuracy_meters,
    )

    return {
        "message": "Driver arrived at stop",
        "stop_id": stop.id,
        "status": stop.execution_status,
        "arrived_at": stop.arrived_at,
    }


@router.post("/{route_id}/stops/{stop_id}/weigh")
def weigh_stop_endpoint(
    route_id: int,
    stop_id: int,
    data: WeighPickupRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    stop = record_stop_weight(
        db=db,
        user=current_user,
        route_id=route_id,
        stop_id=stop_id,
        collected_weight_kg=data.collected_weight_kg,
    )

    return {
        "message": "Collected weight recorded",
        "stop_id": stop.id,
        "status": stop.execution_status,
        "collected_weight_kg": stop.collected_weight_kg,
    }


@router.post("/{route_id}/stops/{stop_id}/complete")
def complete_stop_endpoint(
    route_id: int,
    stop_id: int,
    data: CompletePickupRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    stop = complete_stop(
        db=db,
        user=current_user,
        route_id=route_id,
        stop_id=stop_id,
        collected_weight_kg=data.collected_weight_kg,
    )

    return {
        "message": "Stop completed",
        "stop_id": stop.id,
        "status": stop.execution_status,
        "completed_at": stop.completed_at,
    }


@router.post("/{route_id}/stops/{stop_id}/fail")
def fail_stop_endpoint(
    route_id: int,
    stop_id: int,
    data: FailStopRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    stop = fail_stop(
        db=db,
        user=current_user,
        route_id=route_id,
        stop_id=stop_id,
        reason=data.reason,
    )

    return {
        "message": "Stop marked as failed",
        "stop_id": stop.id,
        "status": stop.execution_status,
        "reason": stop.failure_reason,
    }


@router.post(
    "/{route_id}/stops/{stop_id}/scan-qr"
)
def scan_pickup_qr(
    route_id: int,
    stop_id: int,
    data: VerifyQRRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    result = verify_qr(
        db=db,
        user=current_user,
        route_id=route_id,
        stop_id=stop_id,
        qr_token=data.qr_token,
    )
    stop = result[0] if isinstance(result, tuple) else result

    if data.collected_weight_kg is not None and data.collected_weight_kg > 0:
        stop = record_stop_weight(
            db=db,
            user=current_user,
            route_id=route_id,
            stop_id=stop_id,
            collected_weight_kg=data.collected_weight_kg,
        )

    return {
        "message": "Pickup QR verified",
        "stop_id": stop.id,
        "status": stop.execution_status,
        "arrived_at": stop.arrived_at,
        "otp_required": True,
    }


@router.post(
    "/{route_id}/stops/{stop_id}/verify-otp"
)
@limiter.limit("5/5minutes")
def verify_pickup_otp(
    request: Request,
    route_id: int,
    stop_id: int,
    data: VerifyOTPRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    stop = verify_otp(
        db=db,
        user=current_user,
        route_id=route_id,
        stop_id=stop_id,
        otp=data.otp,
    )

    return {
        "message": "Customer OTP verified",
        "stop_id": stop.id,
        "status": stop.execution_status,
        "otp_verified": True,
    }


@router.post(
    "/{route_id}/stops/{stop_id}/proof",
)
async def upload_collection_proof_endpoint(
    route_id: int,
    stop_id: int,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    stop = await upload_collection_proof(
        db=db,
        user=current_user,
        route_id=route_id,
        stop_id=stop_id,
        file=file,
    )

    return {
        "message": "Collection proof uploaded successfully",
        "stop_id": stop.id,
        "proof_uploaded": True,
        "proof_uploaded_at": stop.proof_uploaded_at,
    }


@router.post(
    "/{route_id}/stops/{stop_id}/proof-base64",
)
def upload_collection_proof_base64_endpoint(
    route_id: int,
    stop_id: int,
    data: UploadProofBase64Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    stop = upload_collection_proof_base64(
        db=db,
        user=current_user,
        route_id=route_id,
        stop_id=stop_id,
        image_base64=data.image_base64,
    )

    return {
        "message": "Collection proof uploaded successfully",
        "stop_id": stop.id,
        "proof_uploaded": True,
        "proof_uploaded_at": stop.proof_uploaded_at,
    }


@router.post("/location", summary="Driver live GPS telemetry ping")
def update_driver_location_endpoint(
    data: DriverLocationPingRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    from datetime import datetime, timezone
    from app.models.driver import Driver
    driver = db.query(Driver).filter(Driver.user_id == current_user.id).first()
    if not driver:
        raise HTTPException(status_code=404, detail="Driver profile not found")
    driver.current_latitude = data.latitude
    driver.current_longitude = data.longitude
    driver.last_location_update = datetime.now(timezone.utc)
    db.commit()

    # Notify live monitoring subscribers of active stops on this driver's route
    try:
        from app.core.live_bus import pickup_live_bus
        from app.models.route import Route
        from app.models.route_stop import RouteStop
        from app.models.enums import RouteStatus
        active_stops = (
            db.query(RouteStop.pickup_id)
            .join(Route, RouteStop.route_id == Route.id)
            .filter(
                Route.driver_id == driver.id,
                Route.status == RouteStatus.IN_PROGRESS,
                RouteStop.pickup_id.isnot(None),
            )
            .all()
        )
        pids = [s[0] for s in active_stops if s[0]]
        if pids:
            pickup_live_bus.notify_pickups(pids)
    except Exception:
        pass
    return {
        "status": "success",
        "driver_id": driver.id,
        "latitude": driver.current_latitude,
        "longitude": driver.current_longitude,
        "updated_at": driver.last_location_update.isoformat(),
    }
