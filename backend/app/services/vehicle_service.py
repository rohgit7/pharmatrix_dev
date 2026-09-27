from sqlalchemy import select
from sqlalchemy.orm import Session

from fastapi import HTTPException, status

from app.models.driver_vehicle_assignment import DriverVehicleAssignment
from app.models.enums import VehicleStatus
from app.models.vehicle import Vehicle
from app.schemas.vehicle import VehicleCreate, VehicleUpdate


def create_vehicle(
    db: Session,
    data: VehicleCreate,
) -> Vehicle:

    existing = (
        db.execute(
            select(Vehicle).where(
                Vehicle.registration_number == data.registration_number
            )
        )
        .scalar_one_or_none()
    )

    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Vehicle registration number already exists",
        )

    vehicle = Vehicle(
        registration_number=data.registration_number,
        vehicle_type=data.vehicle_type,
        capacity_kg=data.capacity_kg,
        status=VehicleStatus.AVAILABLE,
    )

    db.add(vehicle)
    db.commit()
    db.refresh(vehicle)

    return vehicle


def get_vehicle(
    db: Session,
    vehicle_id: int,
) -> Vehicle:

    vehicle = db.get(Vehicle, vehicle_id)

    if not vehicle:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Vehicle not found",
        )

    return vehicle


def list_vehicles(
    db: Session,
    skip: int = 0,
    limit: int = 50,
) -> list[Vehicle]:

    return list(
        db.execute(
            select(Vehicle)
            .order_by(Vehicle.created_at.desc())
            .offset(skip)
            .limit(limit)
        )
        .scalars()
        .all()
    )


def update_vehicle(
    db: Session,
    vehicle_id: int,
    data: VehicleUpdate,
) -> Vehicle:

    vehicle = get_vehicle(db, vehicle_id)

    active_assignment = (
        db.execute(
            select(DriverVehicleAssignment).where(
                DriverVehicleAssignment.vehicle_id == vehicle_id,
                DriverVehicleAssignment.unassigned_at.is_(None),
            )
        )
        .scalar_one_or_none()
    )

    updates = data.model_dump(exclude_unset=True)

    if "registration_number" in updates:
        existing = (
            db.execute(
                select(Vehicle).where(
                    Vehicle.registration_number == updates["registration_number"],
                    Vehicle.id != vehicle_id,
                )
            )
            .scalar_one_or_none()
        )

        if existing:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Vehicle registration number already exists",
            )

    requested_status = updates.get("status")

    if requested_status is not None:

        if active_assignment:
            if requested_status != VehicleStatus.ASSIGNED:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="Unassign the vehicle before changing its status",
                )

        elif requested_status == VehicleStatus.ASSIGNED:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Vehicle must be assigned through the assignment endpoint",
            )

    for field, value in updates.items():
        setattr(vehicle, field, value)

    db.commit()
    db.refresh(vehicle)

    return vehicle