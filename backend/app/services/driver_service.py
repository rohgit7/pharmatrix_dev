from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.driver import Driver
from app.models.driver_vehicle_assignment import DriverVehicleAssignment
from app.models.enums import DriverStatus
from app.models.user import User, UserRole
from app.schemas.driver import DriverCreate, DriverUpdate

from sqlalchemy.orm import Session

from app.models.driver import Driver
from app.models.user import User


def get_driver_by_user_id(db: Session, user_id: int):
    return (
        db.query(Driver)
        .filter(Driver.user_id == user_id)
        .first()
    )


def create_driver(
    db: Session,
    data: DriverCreate,
) -> Driver:

    user = db.get(User, data.user_id)

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    if user.role != UserRole.DRIVER:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User must have DRIVER role",
        )

    existing_user_driver = (
        db.execute(
            select(Driver).where(
                Driver.user_id == data.user_id
            )
        )
        .scalar_one_or_none()
    )

    if existing_user_driver:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="User already has a driver profile",
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

    driver = Driver(
        user_id=data.user_id,
        employee_id=data.employee_id,
        phone=data.phone,
        license_number=data.license_number,
        license_expiry=data.license_expiry,
        status=DriverStatus.ACTIVE,
        is_available=True,
    )

    db.add(driver)
    db.commit()
    db.refresh(driver)

    return driver


def get_driver(
    db: Session,
    driver_id: int,
) -> Driver:

    driver = db.get(Driver, driver_id)

    if not driver:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Driver not found",
        )

    return driver


def list_drivers(
    db: Session,
    skip: int = 0,
    limit: int = 50,
) -> list[Driver]:

    return list(
        db.execute(
            select(Driver)
            .order_by(Driver.created_at.desc())
            .offset(skip)
            .limit(limit)
        )
        .scalars()
        .all()
    )


def update_driver(
    db: Session,
    driver_id: int,
    data: DriverUpdate,
) -> Driver:

    driver = get_driver(db, driver_id)

    active_assignment = (
        db.execute(
            select(DriverVehicleAssignment).where(
                DriverVehicleAssignment.driver_id == driver_id,
                DriverVehicleAssignment.unassigned_at.is_(None),
            )
        )
        .scalar_one_or_none()
    )

    updates = data.model_dump(exclude_unset=True)

    if "employee_id" in updates:
        existing = (
            db.execute(
                select(Driver).where(
                    Driver.employee_id == updates["employee_id"],
                    Driver.id != driver_id,
                )
            )
            .scalar_one_or_none()
        )

        if existing:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Employee ID already exists",
            )

    if "license_number" in updates:
        existing = (
            db.execute(
                select(Driver).where(
                    Driver.license_number == updates["license_number"],
                    Driver.id != driver_id,
                )
            )
            .scalar_one_or_none()
        )

        if existing:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="License number already exists",
            )

    requested_status = updates.get("status")

    if requested_status in {
        DriverStatus.INACTIVE,
        DriverStatus.SUSPENDED,
    } and active_assignment:

        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Unassign the driver's vehicle before deactivating or suspending the driver",
        )

    for field, value in updates.items():
        setattr(driver, field, value)

    db.commit()
    db.refresh(driver)

    return driver