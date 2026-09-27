from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.auth import require_role
from app.core.database import get_db
from app.models.enums import RouteStatus
from app.models.user import UserRole
from app.schemas.route import RouteCreate, RouteResponse
from app.services.route_service import (
    create_route,
    get_route,
    list_routes,
)


router = APIRouter(
    prefix="/api/admin/routes",
    tags=["Admin - Routes"],
    dependencies=[Depends(require_role(UserRole.ADMIN))],
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
)
def list_routes_endpoint(
    status: RouteStatus | None = Query(default=None),
    db: Session = Depends(get_db),
):
    return list_routes(
        db=db,
        status_filter=status,
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