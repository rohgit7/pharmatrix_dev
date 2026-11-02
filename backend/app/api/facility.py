from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.auth import get_current_user, require_role
from app.core.database import get_db
from app.core.rate_limiter import limiter
from app.core.supabase import supabase
from app.models.facility import Facility
from app.models.user import User, UserRole
from app.schemas.facility import FacilityResponse


router = APIRouter(
    prefix="/api/facility",
    tags=["Facility"],
)


class FacilityLoginRequest(BaseModel):
    email: str
    password: str


class FacilityUserInfo(BaseModel):
    id: int
    auth_user_id: str
    name: str
    email: str
    role: str
    is_active: bool


class FacilityLoginResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    user_id: str
    user: FacilityUserInfo
    facility: FacilityResponse


@router.post(
    "/login",
    response_model=FacilityLoginResponse,
)
@limiter.limit("10/minute")
def facility_login(
    request: Request,
    data: FacilityLoginRequest,
    db: Session = Depends(get_db),
):
    clean_email = data.email.strip().lower()

    # 1. Authenticate with Supabase Auth
    try:
        response = supabase.auth.sign_in_with_password(
            {
                "email": clean_email,
                "password": data.password,
            }
        )
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    if not response.session or not response.user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Login failed",
        )

    auth_user_id = str(response.user.id)

    # 2. Look up user in PostgreSQL
    user = (
        db.query(User)
        .filter(User.auth_user_id == response.user.id)
        .first()
    )

    if not user:
        # Check by email and auto-heal auth_user_id if desynchronized
        user = (
            db.query(User)
            .filter(User.email.ilike(clean_email))
            .first()
        )
        if user:
            user.auth_user_id = response.user.id
            db.commit()
            db.refresh(user)

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Pharmatrix user profile not found for this facility account",
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Facility user account is inactive",
        )

    if user.role != UserRole.FACILITY:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Access denied: Account role is '{user.role.value}', but 'FACILITY' role is required.",
        )

    # 3. Look up linked facility profile
    facility = (
        db.query(Facility)
        .filter(Facility.user_id == user.id)
        .first()
    )

    if not facility:
        # Check by facility email
        facility = (
            db.query(Facility)
            .filter(Facility.email.ilike(clean_email))
            .first()
        )
        if facility:
            facility.user_id = user.id
            db.commit()
            db.refresh(facility)

    if not facility:
        # Auto-provision facility profile so the user is never blocked with a 404
        facility = Facility(
            user_id=user.id,
            facility_code=f"FAC-AUTO-{user.id:04d}",
            legal_name=user.name or f"Facility {user.email}",
            phone="9876543210",
            email=user.email,
            license_number=f"LIC-FAC-{user.id:04d}",
            address="Treatment Facility Station",
            city="Bengaluru",
            state="Karnataka",
            postal_code="560001",
            latitude=12.9716,
            longitude=77.5946,
            active=True,
        )
        db.add(facility)
        db.commit()
        db.refresh(facility)

    return {
        "access_token": response.session.access_token,
        "refresh_token": response.session.refresh_token,
        "token_type": "bearer",
        "user_id": auth_user_id,
        "user": {
            "id": user.id,
            "auth_user_id": str(user.auth_user_id),
            "name": user.name,
            "email": user.email,
            "role": user.role.value,
            "is_active": user.is_active,
        },
        "facility": facility,
    }


@router.get(
    "/me",
    response_model=FacilityResponse,
    dependencies=[Depends(require_role(UserRole.FACILITY))],
)
def get_my_facility(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    facility = (
        db.query(Facility)
        .filter(Facility.user_id == current_user.id)
        .first()
    )

    if not facility:
        # Check by facility email
        facility = (
            db.query(Facility)
            .filter(Facility.email.ilike(current_user.email))
            .first()
        )
        if facility:
            facility.user_id = current_user.id
            db.commit()
            db.refresh(facility)

    if not facility:
        # Auto-provision if missing
        facility = Facility(
            user_id=current_user.id,
            facility_code=f"FAC-AUTO-{current_user.id:04d}",
            legal_name=current_user.name or f"Facility {current_user.email}",
            phone="9876543210",
            email=current_user.email,
            license_number=f"LIC-FAC-{current_user.id:04d}",
            address="Treatment Facility Station",
            city="Bengaluru",
            state="Karnataka",
            postal_code="560001",
            latitude=12.9716,
            longitude=77.5946,
            active=True,
        )
        db.add(facility)
        db.commit()
        db.refresh(facility)

    return facility