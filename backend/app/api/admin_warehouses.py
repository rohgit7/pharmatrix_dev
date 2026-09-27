from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.auth import require_role
from app.core.database import get_db
from app.models.user import UserRole
from app.schemas.warehouse import (
    WarehouseCreate,
    WarehouseResponse,
    WarehouseUpdate,
)
from app.services.warehouse_services import (
    create_warehouse,
    get_warehouse,
    list_warehouses,
    update_warehouse,
)


router = APIRouter(
    prefix="/api/admin/warehouses",
    tags=["Admin - Warehouses"],
    dependencies=[Depends(require_role(UserRole.ADMIN))],
)


@router.post(
    "/",
    response_model=WarehouseResponse,
    status_code=201,
)
def create_warehouse_endpoint(
    data: WarehouseCreate,
    db: Session = Depends(get_db),
):
    return create_warehouse(
        db=db,
        code=data.code,
        name=data.name,
        address=data.address,
        city=data.city,
        state=data.state,
        postal_code=data.postal_code,
        latitude=data.latitude,
        longitude=data.longitude,
    )


@router.get(
    "/",
    response_model=list[WarehouseResponse],
)
def list_warehouses_endpoint(
    include_inactive: bool = Query(default=False),
    db: Session = Depends(get_db),
):
    return list_warehouses(
        db=db,
        include_inactive=include_inactive,
    )


@router.get(
    "/{warehouse_id}",
    response_model=WarehouseResponse,
)
def get_warehouse_endpoint(
    warehouse_id: int,
    db: Session = Depends(get_db),
):
    return get_warehouse(
        db=db,
        warehouse_id=warehouse_id,
    )


@router.patch(
    "/{warehouse_id}",
    response_model=WarehouseResponse,
)
def update_warehouse_endpoint(
    warehouse_id: int,
    data: WarehouseUpdate,
    db: Session = Depends(get_db),
):
    return update_warehouse(
        db=db,
        warehouse_id=warehouse_id,
        data=data,
    )