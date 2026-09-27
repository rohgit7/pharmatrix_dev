from datetime import datetime, timezone

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.driver import Driver
from app.models.vehicle import Vehicle
from app.models.driver_vehicle_assignment import DriverVehicleAssignment
from app.models.enums import DriverStatus, VehicleStatus


def assign_vehicle_to_driver(
    db: Session,
    driver_id: int,
    vehicle_id: int,
    notes: str | None = None,
) -> DriverVehicleAssignment:

    # Lock both rows so two admins cannot assign them simultaneously.
    driver = (
        db.execute(
            select(Driver)
            .where(Driver.id == driver_id)
            .with_for_update()
        )
        .scalar_one_or_none()
    )

    if not driver:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Driver not found",
        )

    vehicle = (
        db.execute(
            select(Vehicle)
            .where(Vehicle.id == vehicle_id)
            .with_for_update()
        )
        .scalar_one_or_none()
    )

    if not vehicle:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Vehicle not found",
        )

    # Driver validation
    if driver.status != DriverStatus.ACTIVE:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Driver is not active",
        )

    if not driver.is_available:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Driver is not available",
        )

    # Vehicle validation
    if vehicle.status in {
        VehicleStatus.MAINTENANCE,
        VehicleStatus.INACTIVE,
    }:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Vehicle is {vehicle.status.value.lower()}",
        )

    # Check whether driver already has an active vehicle
    active_driver_assignment = (
        db.execute(
            select(DriverVehicleAssignment)
            .where(
                DriverVehicleAssignment.driver_id == driver_id,
                DriverVehicleAssignment.unassigned_at.is_(None),
            )
        )
        .scalar_one_or_none()
    )

    if active_driver_assignment:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Driver already has an active vehicle assignment",
        )

    # Check whether vehicle is already assigned
    active_vehicle_assignment = (
        db.execute(
            select(DriverVehicleAssignment)
            .where(
                DriverVehicleAssignment.vehicle_id == vehicle_id,
                DriverVehicleAssignment.unassigned_at.is_(None),
            )
        )
        .scalar_one_or_none()
    )

    if active_vehicle_assignment:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Vehicle is already assigned to another driver",
        )

    now = datetime.now(timezone.utc)

    assignment = DriverVehicleAssignment(
        driver_id=driver_id,
        vehicle_id=vehicle_id,
        assigned_at=now,
        notes=notes,
    )

    db.add(assignment)

    # Mark vehicle as assigned
    vehicle.status = VehicleStatus.ASSIGNED

    db.commit()
    db.refresh(assignment)

    return assignment


def unassign_vehicle_from_driver(
    db: Session,
    driver_id: int,
) -> DriverVehicleAssignment:

    assignment = (
        db.execute(
            select(DriverVehicleAssignment)
            .where(
                DriverVehicleAssignment.driver_id == driver_id,
                DriverVehicleAssignment.unassigned_at.is_(None),
            )
            .with_for_update()
        )
        .scalar_one_or_none()
    )

    if not assignment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Driver has no active vehicle assignment",
        )

    vehicle = (
        db.execute(
            select(Vehicle)
            .where(Vehicle.id == assignment.vehicle_id)
            .with_for_update()
        )
        .scalar_one_or_none()
    )

    now = datetime.now(timezone.utc)

    assignment.unassigned_at = now

    if vehicle:
        vehicle.status = VehicleStatus.AVAILABLE

    db.commit()
    db.refresh(assignment)

    return assignment


def get_driver_active_vehicle(
    db: Session,
    driver_id: int,
) -> DriverVehicleAssignment | None:

    return (
        db.execute(
            select(DriverVehicleAssignment)
            .where(
                DriverVehicleAssignment.driver_id == driver_id,
                DriverVehicleAssignment.unassigned_at.is_(None),
            )
        )
        .scalar_one_or_none()
    )


def get_vehicle_active_driver(
    db: Session,
    vehicle_id: int,
) -> DriverVehicleAssignment | None:

    return (
        db.execute(
            select(DriverVehicleAssignment)
            .where(
                DriverVehicleAssignment.vehicle_id == vehicle_id,
                DriverVehicleAssignment.unassigned_at.is_(None),
            )
        )
        .scalar_one_or_none()
    )


def get_driver_assignment_history(
    db: Session,
    driver_id: int,
) -> list[DriverVehicleAssignment]:

    return list(
        db.execute(
            select(DriverVehicleAssignment)
            .where(DriverVehicleAssignment.driver_id == driver_id)
            .order_by(DriverVehicleAssignment.assigned_at.desc())
        ).scalars().all()
    )