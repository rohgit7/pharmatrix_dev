from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.warehouse import Warehouse


def create_warehouse(
    db: Session,
    code: str,
    name: str,
    address: str,
    city: str,
    state: str,
    postal_code: str,
    latitude: float,
    longitude: float,
) -> Warehouse:

    existing = (
        db.query(Warehouse)
        .filter(Warehouse.code == code)
        .first()
    )

    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Warehouse code already exists",
        )

    if not -90 <= latitude <= 90:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid latitude",
        )

    if not -180 <= longitude <= 180:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid longitude",
        )

    warehouse = Warehouse(
        code=code,
        name=name,
        address=address,
        city=city,
        state=state,
        postal_code=postal_code,
        latitude=latitude,
        longitude=longitude,
        active=True,
    )

    db.add(warehouse)
    db.commit()
    db.refresh(warehouse)

    return warehouse


def get_warehouse(
    db: Session,
    warehouse_id: int,
) -> Warehouse:

    warehouse = (
        db.query(Warehouse)
        .filter(Warehouse.id == warehouse_id)
        .first()
    )

    if not warehouse:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Warehouse not found",
        )

    return warehouse


def list_warehouses(
    db: Session,
    include_inactive: bool = False,
):
    query = db.query(Warehouse)

    if not include_inactive:
        query = query.filter(Warehouse.active.is_(True))

    return (
        query
        .order_by(Warehouse.name.asc())
        .all()
    )


def update_warehouse(
    db: Session,
    warehouse_id: int,
    data,
) -> Warehouse:

    warehouse = get_warehouse(
        db=db,
        warehouse_id=warehouse_id,
    )

    if data.code is not None and data.code != warehouse.code:
        existing = (
            db.query(Warehouse)
            .filter(
                Warehouse.code == data.code,
                Warehouse.id != warehouse.id,
            )
            .first()
        )

        if existing:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Warehouse code already exists",
            )

    if data.latitude is not None and not -90 <= data.latitude <= 90:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid latitude",
        )

    if data.longitude is not None and not -180 <= data.longitude <= 180:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid longitude",
        )

    update_data = data.model_dump(exclude_unset=True)

    for field, value in update_data.items():
        setattr(warehouse, field, value)

    db.commit()
    db.refresh(warehouse)

    return warehouse