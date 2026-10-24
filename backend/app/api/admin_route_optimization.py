from datetime import date
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.auth import get_current_user, require_role
from app.core.database import get_db
from app.models.user import User, UserRole
from app.schemas.route_optimization import (
    OptimizationBatchCreate,
    OptimizationBatchDetailResponse,
    OptimizationBatchResponse,
    OptimizationRunSummary,
    OptimizeRoutesRequest,
    OptimizeRoutesResponse,
)
from app.services.route_optimization_service import (
    get_active_optimization_batch,
    get_latest_optimization_run,
    get_optimization_batch,
    list_optimization_runs,
    optimize_and_dispatch,
    submit_optimization_batch,
)


router = APIRouter(
    prefix="/api/admin/routes",
    tags=["Admin - Route Optimization"],
    dependencies=[Depends(require_role(UserRole.ADMIN))],
)


@router.post(
    "/batches",
    response_model=OptimizationBatchResponse,
    status_code=201,
    summary="Submit selected pickups for route optimization batch",
)
def create_optimization_batch_endpoint(
    data: OptimizationBatchCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return submit_optimization_batch(
        db=db,
        warehouse_id=data.warehouse_id,
        pickup_ids=data.pickup_ids,
        planning_date=data.planning_date,
        actor=current_user,
    )


@router.get(
    "/batches/active",
    summary="Get active optimization batch for planning date",
)
def get_active_batch_endpoint(
    warehouse_id: int | None = Query(default=None),
    planning_date: date | None = Query(default=None),
    db: Session = Depends(get_db),
):
    batch = get_active_optimization_batch(
        db=db,
        warehouse_id=warehouse_id,
        planning_date=planning_date,
    )
    if not batch:
        return None
    return batch


@router.get(
    "/batches/{batch_id}",
    response_model=OptimizationBatchDetailResponse,
    summary="Get optimization batch details and pickups",
)
def get_batch_endpoint(
    batch_id: int,
    db: Session = Depends(get_db),
):
    return get_optimization_batch(db=db, batch_id=batch_id)


@router.post(
    "/optimize",
    response_model=OptimizeRoutesResponse,
    status_code=201,
    summary="Optimize next-day routes strictly for tomorrow's operational cycle",
)
def optimize_routes_endpoint(
    data: OptimizeRoutesRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return optimize_and_dispatch(
        db=db,
        warehouse_id=data.warehouse_id,
        route_date=data.route_date,
        batch_id=data.batch_id,
        num_vehicles=data.num_vehicles,
        vehicle_capacity_kg=data.vehicle_capacity_kg,
        max_distance_km=data.max_distance_km,
        max_duration_minutes=data.max_duration_minutes,
        service_time_minutes=data.service_time_minutes,
        local_backward_allowance_km=data.local_backward_allowance_km,
        selected_pickup_ids=data.selected_pickup_ids,
        auto_dispatch=data.auto_dispatch,
        enforce_next_day=True,
        rerun=data.rerun,
        actor=current_user,
    )


@router.get(
    "/runs/latest",
    summary="Get latest optimization run details",
)
def get_latest_run_endpoint(
    warehouse_id: int | None = Query(default=None),
    planning_date: date | None = Query(default=None),
    db: Session = Depends(get_db),
):
    run = get_latest_optimization_run(
        db=db,
        warehouse_id=warehouse_id,
        planning_date=planning_date,
    )
    if not run:
        return None
    return {
        "id": run.id,
        "run_code": run.run_code,
        "planning_date": run.planning_date.isoformat(),
        "warehouse_id": run.warehouse_id,
        "status": run.status,
        "routes_created": run.routes_created,
        "pickups_assigned": run.pickups_assigned,
        "summary_metrics": run.summary_metrics,
        "parameters": run.parameters,
        "created_at": run.created_at.isoformat(),
    }


@router.get(
    "/runs",
    response_model=list[OptimizationRunSummary],
    summary="List optimization run history",
)
def list_runs_endpoint(
    warehouse_id: int | None = Query(default=None),
    limit: int = Query(default=20, ge=1, le=100),
    db: Session = Depends(get_db),
):
    runs = list_optimization_runs(
        db=db,
        warehouse_id=warehouse_id,
        limit=limit,
    )
    return runs
