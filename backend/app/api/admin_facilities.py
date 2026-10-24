from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.auth import require_role
from app.core.database import get_db
from app.models.user import UserRole
from app.schemas.facility import (
    FacilityCreate,
    FacilityResponse,
    FacilityUpdate,
)
from app.services.facility_service import (
    create_facility,
    get_facility,
    list_facilities,
    update_facility,
)


router = APIRouter(
    prefix="/api/admin/facilities",
    tags=["Admin - Facilities"],
    dependencies=[
        Depends(require_role(UserRole.ADMIN))
    ],
)


@router.post(
    "/",
    response_model=FacilityResponse,
    status_code=201,
)
def create_facility_endpoint(
    data: FacilityCreate,
    db: Session = Depends(get_db),
):
    return create_facility(
        db=db,
        data=data,
    )


@router.get(
    "/",
    response_model=list[FacilityResponse],
)
def list_facilities_endpoint(
    include_inactive: bool = Query(
        default=False
    ),
    db: Session = Depends(get_db),
):
    return list_facilities(
        db=db,
        include_inactive=include_inactive,
    )


@router.get(
    "/{facility_id}",
    response_model=FacilityResponse,
)
def get_facility_endpoint(
    facility_id: int,
    db: Session = Depends(get_db),
):
    return get_facility(
        db=db,
        facility_id=facility_id,
    )


@router.patch(
    "/{facility_id}",
    response_model=FacilityResponse,
)
def update_facility_endpoint(
    facility_id: int,
    data: FacilityUpdate,
    db: Session = Depends(get_db),
):
    return update_facility(
        db=db,
        facility_id=facility_id,
        data=data,
    )


@router.delete(
    "/{facility_id}",
    status_code=200,
)
def delete_facility_endpoint(
    facility_id: int,
    db: Session = Depends(get_db),
):
    from app.models.facility import Facility
    from fastapi import HTTPException
    facility = db.query(Facility).filter(Facility.id == facility_id).first()
    if not facility:
        raise HTTPException(status_code=404, detail="Facility not found")

    try:
        db.delete(facility)
        db.commit()
    except Exception:
        db.rollback()
        facility.active = False
        db.commit()

    return {"message": "Facility removed successfully"}