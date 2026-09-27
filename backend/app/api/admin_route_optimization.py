from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.auth import require_role
from app.core.database import get_db
from app.models.user import UserRole
from app.schemas.route_optimization import (
    OptimizeRoutesRequest,
    OptimizeRoutesResponse,
)
from app.services.route_optimization_service import optimize_and_dispatch


router = APIRouter(
    prefix="/api/admin/routes",
    tags=["Admin - Route Optimization"],
    dependencies=[Depends(require_role(UserRole.ADMIN))],
)


@router.post(
    "/optimize",
    response_model=OptimizeRoutesResponse,
    status_code=201,
)
def optimize_routes_endpoint(
    data: OptimizeRoutesRequest,
    db: Session = Depends(get_db),
):
    return optimize_and_dispatch(
        db=db,
        warehouse_id=data.warehouse_id,
        route_date=data.route_date,
    )
