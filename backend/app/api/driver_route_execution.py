from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from fastapi import File, UploadFile
from app.core.auth import get_current_user, require_role
from app.core.database import get_db
from app.models.user import User, UserRole
from app.schemas.route_execution import (
    CompletePickupRequest,
    FailStopRequest,
)
from app.services.route_execution_service import (
    arrive_at_stop,
    complete_stop,
    fail_stop,
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
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    stop = arrive_at_stop(
        db=db,
        user=current_user,
        route_id=route_id,
        stop_id=stop_id,
    )

    return {
        "message": "Driver arrived at stop",
        "stop_id": stop.id,
        "status": stop.execution_status,
        "arrived_at": stop.arrived_at,
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
    stop = verify_qr(
        db=db,
        user=current_user,
        route_id=route_id,
        stop_id=stop_id,
        qr_token=data.qr_token,
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
def verify_pickup_otp(
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