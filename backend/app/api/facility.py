from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.auth import get_current_user, require_role
from app.core.database import get_db
from app.models.facility import Facility
from app.models.user import User, UserRole
from app.schemas.facility import FacilityResponse


router = APIRouter(
    prefix="/api/facility",
    tags=["Facility"],
    dependencies=[
        Depends(require_role(UserRole.FACILITY))
    ],
)


@router.get(
    "/me",
    response_model=FacilityResponse,
)
def get_my_facility(
    current_user: User = Depends(
        get_current_user
    ),
    db: Session = Depends(get_db),
):
    facility = (
        db.query(Facility)
        .filter(
            Facility.user_id
            == current_user.id
        )
        .first()
    )

    if not facility:
        from fastapi import HTTPException

        raise HTTPException(
            status_code=404,
            detail="Facility profile not found",
        )

    return facility