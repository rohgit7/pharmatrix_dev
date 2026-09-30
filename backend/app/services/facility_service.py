from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models.facility import Facility
from app.models.user import User, UserRole


def create_facility(
    db: Session,
    data,
) -> Facility:

    user = (
        db.query(User)
        .filter(User.id == data.user_id)
        .first()
    )

    if not user:
        raise HTTPException(
            status_code=404,
            detail="User not found",
        )

    if user.role != UserRole.FACILITY:
        raise HTTPException(
            status_code=400,
            detail="User must have FACILITY role",
        )

    existing_user = (
        db.query(Facility)
        .filter(Facility.user_id == data.user_id)
        .first()
    )

    if existing_user:
        raise HTTPException(
            status_code=409,
            detail="Facility already exists for this user",
        )

    existing_code = (
        db.query(Facility)
        .filter(
            Facility.facility_code
            == data.facility_code
        )
        .first()
    )

    if existing_code:
        raise HTTPException(
            status_code=409,
            detail="Facility code already exists",
        )

    existing_license = (
        db.query(Facility)
        .filter(
            Facility.license_number
            == data.license_number
        )
        .first()
    )

    if existing_license:
        raise HTTPException(
            status_code=409,
            detail="Facility license already exists",
        )

    if not -90 <= data.latitude <= 90:
        raise HTTPException(
            status_code=400,
            detail="Invalid latitude",
        )

    if not -180 <= data.longitude <= 180:
        raise HTTPException(
            status_code=400,
            detail="Invalid longitude",
        )

    facility = Facility(
        user_id=data.user_id,
        facility_code=data.facility_code,
        legal_name=data.legal_name,
        phone=data.phone,
        email=data.email,
        license_number=data.license_number,
        license_expiry=data.license_expiry,
        address=data.address,
        city=data.city,
        state=data.state,
        postal_code=data.postal_code,
        latitude=data.latitude,
        longitude=data.longitude,
        active=True,
    )

    db.add(facility)
    db.commit()
    db.refresh(facility)

    return facility


def get_facility(
    db: Session,
    facility_id: int,
) -> Facility:

    facility = (
        db.query(Facility)
        .filter(Facility.id == facility_id)
        .first()
    )

    if not facility:
        raise HTTPException(
            status_code=404,
            detail="Facility not found",
        )

    return facility


def list_facilities(
    db: Session,
    include_inactive: bool = False,
):
    query = db.query(Facility)

    if not include_inactive:
        query = query.filter(
            Facility.active.is_(True)
        )

    return (
        query
        .order_by(Facility.legal_name.asc())
        .all()
    )


def update_facility(
    db: Session,
    facility_id: int,
    data,
) -> Facility:

    facility = get_facility(
        db,
        facility_id,
    )

    updates = data.model_dump(
        exclude_unset=True
    )

    if (
        "facility_code" in updates
        and updates["facility_code"]
        != facility.facility_code
    ):
        exists = (
            db.query(Facility)
            .filter(
                Facility.facility_code
                == updates["facility_code"],
                Facility.id != facility.id,
            )
            .first()
        )

        if exists:
            raise HTTPException(
                status_code=409,
                detail="Facility code already exists",
            )

    if (
        "license_number" in updates
        and updates["license_number"]
        != facility.license_number
    ):
        exists = (
            db.query(Facility)
            .filter(
                Facility.license_number
                == updates["license_number"],
                Facility.id != facility.id,
            )
            .first()
        )

        if exists:
            raise HTTPException(
                status_code=409,
                detail="Facility license already exists",
            )

    if "latitude" in updates:
        if not -90 <= updates["latitude"] <= 90:
            raise HTTPException(
                status_code=400,
                detail="Invalid latitude",
            )

    if "longitude" in updates:
        if not -180 <= updates["longitude"] <= 180:
            raise HTTPException(
                status_code=400,
                detail="Invalid longitude",
            )

    for field, value in updates.items():
        setattr(
            facility,
            field,
            value,
        )

    db.commit()
    db.refresh(facility)

    return facility