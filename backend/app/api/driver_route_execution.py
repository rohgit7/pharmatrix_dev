from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

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


router = APIRouter(
    prefix="/api/driver/routes",
    tags=["Driver - Route Execution"],
    dependencies=[
        Depends(require_role(UserRole.DRIVER))
    ],
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