from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.supabase_admin import get_supabase_admin
from app.models.driver import Driver
from app.models.enums import DriverStatus
from app.models.user import User, UserRole
from app.schemas.driver_onboarding import DriverOnboardRequest


def onboard_driver(
    db: Session,
    data: DriverOnboardRequest,
) -> tuple[User, Driver]:

    # ---------------------------------------------------------
    # 1. Check application-level duplicates
    # ---------------------------------------------------------

    existing_user = (
        db.execute(
            select(User).where(User.email == data.email)
        )
        .scalar_one_or_none()
    )

    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A user with this email already exists",
        )

    existing_employee = (
        db.execute(
            select(Driver).where(
                Driver.employee_id == data.employee_id
            )
        )
        .scalar_one_or_none()
    )

    if existing_employee:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Employee ID already exists",
        )

    existing_license = (
        db.execute(
            select(Driver).where(
                Driver.license_number == data.license_number
            )
        )
        .scalar_one_or_none()
    )

    if existing_license:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="License number already exists",
        )

    # ---------------------------------------------------------
    # 2. Create Supabase Auth user
    # ---------------------------------------------------------

    supabase_admin = get_supabase_admin()

    try:
        auth_response = (
            supabase_admin.auth.admin.invite_user_by_email(
                data.email,
                options={
                    "data": {
                        "name": data.name,
                        "role": UserRole.DRIVER.value,
                    }
                },
            )
        )

        auth_user = auth_response.user

    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unable to create driver authentication account: {exc}",
        )

    if not auth_user:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Supabase did not return the created user",
        )

    # ---------------------------------------------------------
    # 3. Create application user + driver
    # ---------------------------------------------------------

    try:

        user = User(
            auth_user_id=auth_user.id,
            email=data.email,
            name=data.name,
            role=UserRole.DRIVER,
            is_active=True,
        )

        db.add(user)
        db.flush()

        driver = Driver(
            user_id=user.id,
            employee_id=data.employee_id,
            phone=data.phone,
            license_number=data.license_number,
            license_expiry=data.license_expiry,
            status=DriverStatus.ACTIVE,
            is_available=True,
        )

        db.add(driver)

        db.commit()

        db.refresh(user)
        db.refresh(driver)

        return user, driver

    except Exception as exc:

        db.rollback()

        # Compensating action:
        # remove the Auth account because DB creation failed.
        try:
            supabase_admin.auth.admin.delete_user(
                auth_user.id
            )
        except Exception:
            pass

        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Unable to create driver profile: {exc}",
        )