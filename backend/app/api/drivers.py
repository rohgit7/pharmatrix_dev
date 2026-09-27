from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.core.auth import require_role
from app.core.database import get_db
from app.models.user import UserRole
from app.schemas.driver import (
    DriverCreate,
    DriverResponse,
    DriverUpdate,
)
from app.services.driver_service import (
    create_driver,
    get_driver,
    list_drivers,
    update_driver,
)

from app.schemas.driver_onboarding import (
    DriverOnboardRequest,
    DriverOnboardResponse,
)

from app.services.driver_onboarding_service import onboard_driver

from app.core.auth import get_current_user, require_role
from app.models.user import User, UserRole
from app.services.driver_service import get_driver_by_user_id
from app.schemas.driver import DriverCreate, DriverUpdate,DriverResponse, DriverMeResponse

router = APIRouter(
    prefix="/api/admin/drivers",
    tags=["Admin - Drivers"],
)


@router.post(
    "/",
    response_model=DriverResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_driver_endpoint(
    data: DriverCreate,
    db: Session = Depends(get_db),
    current_user=Depends(require_role(UserRole.ADMIN)),
):
    return create_driver(db, data)


@router.get(
    "/",
    response_model=list[DriverResponse],
)
def list_driver_endpoint(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user=Depends(require_role(UserRole.ADMIN)),
):
    return list_drivers(db, skip, limit)


@router.get(
    "/{driver_id}",
    response_model=DriverResponse,
)
def get_driver_endpoint(
    driver_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(require_role(UserRole.ADMIN)),
):
    return get_driver(db, driver_id)


@router.patch(
    "/{driver_id}",
    response_model=DriverResponse,
)
def update_driver_endpoint(
    driver_id: int,
    data: DriverUpdate,
    db: Session = Depends(get_db),
    current_user=Depends(require_role(UserRole.ADMIN)),
):
    return update_driver(db, driver_id, data)

@router.post(
    "/onboard",
    response_model=DriverOnboardResponse,
    status_code=status.HTTP_201_CREATED,
)
def onboard_driver_endpoint(
    data: DriverOnboardRequest,
    db: Session = Depends(get_db),
    current_user=Depends(require_role(UserRole.ADMIN)),
):
    user, driver = onboard_driver(
        db=db,
        data=data,
    )

    return DriverOnboardResponse(
        driver_id=driver.id,
        user_id=user.id,
        auth_user_id=str(user.auth_user_id),
        message="Driver onboarded successfully. An invitation has been sent to the driver's email.",
    )

@router.get("/me", response_model=DriverMeResponse)
def get_my_driver_profile(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if current_user.role != UserRole.DRIVER:
        raise HTTPException(
            status_code=403,
            detail="Driver access required",
        )

    driver = get_driver_by_user_id(db, current_user.id)

    if not driver:
        raise HTTPException(
            status_code=404,
            detail="Driver profile not found",
        )

    return DriverMeResponse(
        id=driver.id,
        user_id=current_user.id,
        employee_id=driver.employee_id,
        name=current_user.name,
        email=current_user.email,
        phone=driver.phone,
        license_number=driver.license_number,
        license_expiry=driver.license_expiry,
        status=driver.status.value,
        is_available=driver.is_available,
        created_at=driver.created_at,
    )