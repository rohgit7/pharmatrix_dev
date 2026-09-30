from uuid import uuid4
import secrets
from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.customer import Customer
from app.models.customer_location import CustomerLocation
from app.models.enums import PickupStatus
from app.models.pickup import Pickup
from app.models.user import User
from sqlalchemy.orm import joinedload

def generate_pickup_code() -> str:
    return f"PK-{uuid4().hex[:10].upper()}"


def get_customer_for_user(
    db: Session,
    user_id: int,
) -> Customer:
    customer = (
        db.query(Customer)
        .filter(Customer.user_id == user_id)
        .first()
    )

    if not customer:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Customer profile not found",
        )

    if not customer.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Customer account is inactive",
        )

    return customer


def create_pickup(
    db: Session,
    current_user: User,
    location_id: int,
    requested_date,
    priority,
    estimated_weight_kg,
    notes,
) -> Pickup:

    customer = get_customer_for_user(
        db,
        current_user.id,
    )

    location = (
        db.query(CustomerLocation)
        .filter(
            CustomerLocation.id == location_id,
            CustomerLocation.customer_id == customer.id,
        )
        .first()
    )

    if not location:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Customer location not found",
        )

    if not location.active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Customer location is inactive",
        )

    if not location.pickup_enabled:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Pickup is disabled for this location",
        )

    pickup = Pickup(
        pickup_code=generate_pickup_code(),
        verification_token=secrets.token_urlsafe(32),
        customer_id=customer.id,
        location_id=location.id,
        status=PickupStatus.REQUESTED,
        priority=priority,
        requested_date=requested_date,
        estimated_weight_kg=estimated_weight_kg,
        notes=notes,
    )

    db.add(pickup)
    db.commit()
    db.refresh(pickup)

    return pickup


def list_customer_pickups(
    db: Session,
    current_user: User,
):
    customer = get_customer_for_user(
        db,
        current_user.id,
    )

    return (
        db.query(Pickup)
        .filter(Pickup.customer_id == customer.id)
        .order_by(Pickup.created_at.desc())
        .all()
    )


def get_customer_pickup(
    db: Session,
    current_user: User,
    pickup_id: int,
) -> Pickup:

    customer = get_customer_for_user(
        db,
        current_user.id,
    )

    pickup = (
        db.query(Pickup)
        .filter(
            Pickup.id == pickup_id,
            Pickup.customer_id == customer.id,
        )
        .first()
    )

    if not pickup:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Pickup not found",
        )

    return pickup

def list_all_pickups(
    db: Session,
    status_filter: PickupStatus | None = None,
):
    query = (
        db.query(Pickup)
        .options(
            joinedload(Pickup.customer),
            joinedload(Pickup.location),
        )
    )

    if status_filter:
        query = query.filter(Pickup.status == status_filter)

    return (
        query
        .order_by(Pickup.created_at.desc())
        .all()
    )


def get_pickup_by_id(
    db: Session,
    pickup_id: int,
) -> Pickup:

    pickup = (
        db.query(Pickup)
        .options(
            joinedload(Pickup.customer),
            joinedload(Pickup.location),
        )
        .filter(Pickup.id == pickup_id)
        .first()
    )

    if not pickup:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Pickup not found",
        )

    return pickup


def schedule_pickup(
    db: Session,
    pickup_id: int,
    scheduled_date,
) -> Pickup:

    pickup = (
        db.query(Pickup)
        .filter(Pickup.id == pickup_id)
        .with_for_update()
        .first()
    )

    if not pickup:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Pickup not found",
        )

    if pickup.status != PickupStatus.REQUESTED:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Pickup cannot be scheduled from status {pickup.status.value}",
        )

    pickup.scheduled_date = scheduled_date
    pickup.status = PickupStatus.SCHEDULED

    db.commit()
    db.refresh(pickup)

    return pickup


def cancel_pickup(
    db: Session,
    pickup_id: int,
    reason: str,
) -> Pickup:

    pickup = (
        db.query(Pickup)
        .filter(Pickup.id == pickup_id)
        .with_for_update()
        .first()
    )

    if not pickup:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Pickup not found",
        )

    allowed_statuses = {
        PickupStatus.REQUESTED,
        PickupStatus.SCHEDULED,
    }

    if pickup.status not in allowed_statuses:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Pickup cannot be cancelled from status {pickup.status.value}",
        )

    pickup.status = PickupStatus.CANCELLED
    pickup.failure_reason = reason

    db.commit()
    db.refresh(pickup)

    return pickup