from datetime import date
from fastapi import APIRouter, Depends, Query, HTTPException, status
from sqlalchemy.orm import Session

from app.core.auth import get_current_user, require_role
from app.core.database import get_db
from app.core.planning import normalize_to_business_date
from app.models.enums import RouteStatus
from app.models.user import User, UserRole
from app.models.route import Route
from app.schemas.route import (
    RouteApproveRequest,
    RouteAssignRequest,
    RouteBulkApproveRequest,
    RouteBulkApproveResponse,
    RouteBulkDispatchRequest,
    RouteBulkDispatchResponse,
    RouteCreate,
    RouteReassignRequest,
    RouteReleasePickupRequest,
    RouteResponse,
    RouteUpdate,
)
from app.schemas.route_optimization import PlanningReadinessResponse, RouteRejectRequest
from app.services.planning_readiness_service import get_planning_readiness
from app.services.route_service import (
    approve_route,
    assign_route_fleet,
    bulk_approve_routes,
    bulk_dispatch_routes,
    create_route,
    dispatch_route,
    get_route,
    list_historical_routes,
    list_routes,
    reassign_route_fleet,
    reject_route,
    release_pickup_from_draft,
    unassign_route_fleet,
)


router = APIRouter(
    prefix="/api/admin/routes",
    tags=["Admin - Routes"],
    dependencies=[Depends(require_role(UserRole.ADMIN))],
)


@router.get(
    "/readiness",
    response_model=PlanningReadinessResponse,
    summary="Get next-day operational planning readiness indicators",
)
def get_readiness_endpoint(
    db: Session = Depends(get_db),
):
    return get_planning_readiness(db)


@router.get(
    "/history",
    summary="List completed and historical routes separate from active operations",
)
def list_route_history_endpoint(
    start_date: date | None = Query(default=None),
    end_date: date | None = Query(default=None),
    status: str | None = Query(default=None),
    db: Session = Depends(get_db),
):
    routes = list_historical_routes(
        db=db,
        start_date=start_date,
        end_date=end_date,
        status_filter=status,
    )
    return routes


@router.post(
    "/bulk-approve",
    response_model=RouteBulkApproveResponse,
    summary="Bulk approve draft routes for tomorrow's operations",
)
def bulk_approve_routes_endpoint(
    data: RouteBulkApproveRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return bulk_approve_routes(
        db=db,
        route_ids=data.route_ids,
        actor=current_user,
    )


@router.post(
    "/bulk-dispatch",
    response_model=RouteBulkDispatchResponse,
    summary="Bulk dispatch assigned routes for tomorrow's operations",
)
def bulk_dispatch_endpoint(
    data: RouteBulkDispatchRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return bulk_dispatch_routes(
        db=db,
        route_ids=data.route_ids,
        actor=current_user,
    )


@router.post(
    "/",
    response_model=RouteResponse,
    status_code=201,
)
def create_route_endpoint(
    data: RouteCreate,
    db: Session = Depends(get_db),
):
    return create_route(
        db=db,
        warehouse_id=data.warehouse_id,
        route_date=data.route_date,
        pickup_ids=data.pickup_ids,
    )


@router.get(
    "/",
    response_model=list[RouteResponse],
    summary="List operational routes with filtering for active operations vs history",
)
def list_routes_endpoint(
    status: RouteStatus | None = Query(default=None),
    active_only: bool = Query(default=False),
    history_only: bool = Query(default=False),
    planning_date: date | None = Query(default=None),
    db: Session = Depends(get_db),
):
    return list_routes(
        db=db,
        status_filter=status,
        active_only=active_only,
        history_only=history_only,
        planning_date=planning_date,
    )


@router.get(
    "/{route_id}",
    response_model=RouteResponse,
)
def get_route_endpoint(
    route_id: int,
    db: Session = Depends(get_db),
):
    return get_route(
        db=db,
        route_id=route_id,
    )


@router.patch(
    "/{route_id}",
    response_model=RouteResponse,
)
def update_route_endpoint(
    route_id: int,
    data: RouteUpdate,
    db: Session = Depends(get_db),
):
    route = db.query(Route).filter(Route.id == route_id).first()
    if not route:
        raise HTTPException(status_code=404, detail="Route not found")

    update_dict = data.model_dump(exclude_unset=True)
    for field, value in update_dict.items():
        setattr(route, field, value)

    db.commit()
    db.refresh(route)
    return route


@router.post(
    "/{route_id}/approve",
    response_model=RouteResponse,
    summary="Review and approve a draft route before driver/vehicle assignment",
)
def approve_route_endpoint(
    route_id: int,
    data: RouteApproveRequest | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return approve_route(
        db=db,
        route_id=route_id,
        actor=current_user,
    )


@router.post(
    "/{route_id}/reject",
    summary="Reject an unsatisfactory route, cancelling it and releasing pickups back to planning",
)
def reject_route_endpoint(
    route_id: int,
    data: RouteRejectRequest | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return reject_route(
        db=db,
        route_id=route_id,
        reason=data.reason if data else None,
        actor=current_user,
    )


@router.post(
    "/{route_id}/assign",
    response_model=RouteResponse,
    summary="Assign driver and vehicle to an approved route",
)
def assign_route_endpoint(
    route_id: int,
    data: RouteAssignRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return assign_route_fleet(
        db=db,
        route_id=route_id,
        driver_id=data.driver_id,
        vehicle_id=data.vehicle_id,
        notes=data.notes,
        actor=current_user,
    )


@router.post(
    "/{route_id}/reassign",
    response_model=RouteResponse,
    summary="Reassign driver and vehicle before dispatch or during recovery",
)
def reassign_route_endpoint(
    route_id: int,
    data: RouteReassignRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return reassign_route_fleet(
        db=db,
        route_id=route_id,
        driver_id=data.driver_id,
        vehicle_id=data.vehicle_id,
        actor=current_user,
        reason=data.reason,
    )


@router.post(
    "/{route_id}/unassign",
    response_model=RouteResponse,
    summary="Unassign driver/vehicle when unavailable, reverting route safely to approved draft",
)
def unassign_route_endpoint(
    route_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return unassign_route_fleet(
        db=db,
        route_id=route_id,
        actor=current_user,
    )


@router.post(
    "/{route_id}/release/{pickup_id}",
    summary="Release a pickup from an unapproved draft route back to the planning queue",
)
def release_pickup_endpoint(
    route_id: int,
    pickup_id: int,
    data: RouteReleasePickupRequest | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return release_pickup_from_draft(
        db=db,
        route_id=route_id,
        pickup_id=pickup_id,
        actor=current_user,
        reason=data.reason if data else None,
    )


@router.post(
    "/{route_id}/dispatch",
    response_model=RouteResponse,
    summary="Dispatch an assigned route to driver",
)
def dispatch_route_endpoint(
    route_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return dispatch_route(
        db=db,
        route_id=route_id,
        actor=current_user,
    )


@router.delete(
    "/{route_id}",
    status_code=200,
)
def delete_route_endpoint(
    route_id: int,
    db: Session = Depends(get_db),
):
    route = db.query(Route).filter(Route.id == route_id).first()
    if not route:
        raise HTTPException(status_code=404, detail="Route not found")

    try:
        db.delete(route)
        db.commit()
    except Exception:
        db.rollback()
        route.status = RouteStatus.CANCELLED
        db.commit()

    return {"message": "Route removed successfully"}