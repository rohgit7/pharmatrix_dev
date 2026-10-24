from datetime import date, datetime, time as dt_time
import secrets
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import or_

from app.core.auth import get_current_user, require_role
from app.core.database import get_db
from app.core.planning import (
    BUSINESS_TIMEZONE,
    get_operational_planning_date,
    get_planning_date_bounds,
    normalize_to_business_date,
)
from app.models.customer import Customer
from app.models.customer_location import CustomerLocation
from app.models.driver import Driver
from app.models.enums import PickupPriority, PickupStatus, RouteStatus
from app.models.optimization_run import OptimizationRunPickup
from app.models.pickup import Pickup
from app.models.route import Route
from app.models.route_stop import RouteStop
from app.models.user import User, UserRole
from app.schemas.pickup import (
    PickupAdminCreate,
    PickupAdminResponse,
    PickupAdminUpdate,
    PickupCancelRequest,
    PickupHistoryItem,
    PickupHistoryResponse,
    PickupScheduleRequest,
)
from app.services.audit_service import log_operational_audit
from app.services.pickup_service import (
    cancel_pickup,
    generate_pickup_code,
    get_pickup_by_id,
    schedule_pickup,
)


router = APIRouter(
    prefix="/api/admin/pickups",
    tags=["Admin - Pickups"],
    dependencies=[Depends(require_role(UserRole.ADMIN))],
)


def _enrich_pickup_response(p: Pickup, tomorrow: date) -> PickupAdminResponse:
    # Find active route stop (not in cancelled route)
    active_stop = None
    if p.route_stops:
        for stop in p.route_stops:
            if stop.route and stop.route.status != RouteStatus.CANCELLED:
                active_stop = stop
                break

    route = active_stop.route if active_stop else None
    p_date = normalize_to_business_date(p.scheduled_date or p.requested_date)

    operational_state = "awaiting_selection"
    is_eligible = True
    ineligibility_reason = None

    if route:
        if route.status == RouteStatus.DRAFT:
            if route.approved_at is None:
                operational_state = "optimized"
            else:
                operational_state = "awaiting_assignment"
        elif route.status == RouteStatus.READY:
            operational_state = "awaiting_dispatch"
        elif route.status == RouteStatus.ASSIGNED:
            operational_state = "dispatched"
        elif route.status == RouteStatus.IN_PROGRESS:
            operational_state = "in_progress"
        elif route.status == RouteStatus.COMPLETED:
            operational_state = "completed"
        is_eligible = False
        ineligibility_reason = f"Allocated to route {route.route_code} ({route.status.value})"
    else:
        active_batch = None
        if p.optimization_run_pickups:
            for orp in p.optimization_run_pickups:
                if orp.optimization_run and orp.optimization_run.status in ["SUBMITTED", "DRAFT", "OPTIMIZED"]:
                    active_batch = orp.optimization_run
                    break

        if active_batch:
            operational_state = "in_optimization_batch" if active_batch.status == "SUBMITTED" else "optimized"
            is_eligible = False
            ineligibility_reason = f"Submitted to optimization batch {active_batch.run_code}"
        elif p.status == PickupStatus.COLLECTED:
            operational_state = "completed"
            is_eligible = False
            ineligibility_reason = "Pickup already collected"
        elif p.status == PickupStatus.CANCELLED:
            operational_state = "cancelled"
            is_eligible = False
            ineligibility_reason = "Pickup is cancelled"
        elif p.status == PickupStatus.FAILED:
            operational_state = "failed"
            is_eligible = False
            ineligibility_reason = p.failure_reason or "Pickup previously failed"
        elif p.status == PickupStatus.REQUESTED:
            operational_state = "requested"
            is_eligible = False
            ineligibility_reason = "Pickup is in REQUESTED status; must be scheduled before optimization"
        elif p.status == PickupStatus.SCHEDULED:
            if p_date != tomorrow:
                operational_state = "scheduled_other_date"
                is_eligible = False
                ineligibility_reason = f"Scheduled for {p_date}, but operational planning date is strictly tomorrow ({tomorrow})"
            else:
                operational_state = "awaiting_selection"
                is_eligible = True
                ineligibility_reason = None
        else:
            operational_state = p.status.value.lower()
            is_eligible = False
            ineligibility_reason = f"Pickup in {p.status.value} status"

    return PickupAdminResponse(
        id=p.id,
        public_id=p.public_id,
        pickup_code=p.pickup_code,
        customer_id=p.customer_id,
        customer_name=p.customer.display_name if p.customer else None,
        location_id=p.location_id,
        location_name=p.location.name if p.location else None,
        location_address=f"{p.location.address_line_1}, {p.location.city}" if p.location else None,
        status=p.status,
        priority=p.priority,
        requested_date=p.requested_date,
        scheduled_date=p.scheduled_date,
        notes=p.notes,
        failure_reason=p.failure_reason,
        collected_at=p.collected_at,
        created_at=p.created_at,
        updated_at=p.updated_at,
        estimated_weight_kg=float(p.estimated_weight_kg) if p.estimated_weight_kg is not None else None,
        operational_state=operational_state,
        route_id=route.id if route else None,
        route_code=route.route_code if route else None,
        route_status=route.status.value if route else None,
        is_eligible_for_tomorrow=is_eligible,
        ineligibility_reason=ineligibility_reason,
    )


@router.get(
    "/history",
    response_model=PickupHistoryResponse,
)
def admin_pickup_history(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    start_date: datetime | None = Query(default=None),
    end_date: datetime | None = Query(default=None),
    status: PickupStatus | None = Query(default=None),
    customer_id: int | None = Query(default=None),
    location_id: int | None = Query(default=None),
    search: str | None = Query(default=None),
    db: Session = Depends(get_db),
):
    query = (
        db.query(Pickup)
        .options(
            joinedload(Pickup.customer),
            joinedload(Pickup.location),
            joinedload(Pickup.route_stops).joinedload(RouteStop.route).joinedload(Route.driver).joinedload(Driver.user),
        )
    )

    if status:
        query = query.filter(Pickup.status == status)

    if customer_id:
        query = query.filter(Pickup.customer_id == customer_id)
    if location_id:
        query = query.filter(Pickup.location_id == location_id)
    if start_date:
        query = query.filter(Pickup.created_at >= start_date)
    if end_date:
        query = query.filter(Pickup.created_at <= end_date)
    if search and search.strip():
        search_filter = f"%{search.strip()}%"
        query = query.outerjoin(Customer, Customer.id == Pickup.customer_id).filter(
            or_(
                Pickup.pickup_code.ilike(search_filter),
                Customer.display_name.ilike(search_filter),
                Customer.legal_name.ilike(search_filter),
            )
        )

    total = query.count()
    total_pages = max(1, (total + page_size - 1) // page_size)
    offset = (page - 1) * page_size
    pickups = query.order_by(Pickup.created_at.desc()).offset(offset).limit(page_size).all()

    items = []
    for p in pickups:
        route_stop = p.route_stops[0] if p.route_stops else None
        route = route_stop.route if route_stop else None
        driver = route.driver if route else None
        driver_user = driver.user if driver else None
        collected_weight = float(route_stop.collected_weight_kg) if route_stop and route_stop.collected_weight_kg is not None else None

        items.append(
            PickupHistoryItem(
                id=p.id,
                public_id=p.public_id,
                pickup_code=p.pickup_code,
                customer_id=p.customer_id,
                customer_name=p.customer.display_name if p.customer else None,
                location_id=p.location_id,
                location_name=p.location.name if p.location else None,
                location_address=f"{p.location.address_line_1}, {p.location.city}" if p.location else None,
                status=p.status,
                priority=p.priority,
                requested_date=p.requested_date,
                scheduled_date=p.scheduled_date,
                collected_at=p.collected_at,
                estimated_weight_kg=float(p.estimated_weight_kg) if p.estimated_weight_kg is not None else None,
                collected_weight_kg=collected_weight,
                failure_reason=p.failure_reason,
                route_id=route.id if route else None,
                route_code=route.route_code if route else None,
                driver_id=driver.id if driver else None,
                driver_name=driver_user.name if driver_user else (driver.employee_id if driver else None),
                created_at=p.created_at,
                updated_at=p.updated_at,
            )
        )

    return PickupHistoryResponse(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
    )


@router.get(
    "/",
    response_model=list[PickupAdminResponse],
    summary="List pickups with work queue filtering for next-day planning",
)
def admin_list_pickups(
    status: PickupStatus | None = Query(default=None),
    work_queue: bool = Query(default=False, description="Filter strictly to pickups awaiting planning for tomorrow"),
    planning_date: date | None = Query(default=None),
    operational_state: str | None = Query(default=None),
    db: Session = Depends(get_db),
):
    tomorrow = get_operational_planning_date()
    target_date = planning_date or tomorrow
    p_start, p_end = get_planning_date_bounds(target_date)

    query = (
        db.query(Pickup)
        .options(
            joinedload(Pickup.customer),
            joinedload(Pickup.location),
            joinedload(Pickup.route_stops).joinedload(RouteStop.route),
            joinedload(Pickup.optimization_run_pickups).joinedload(OptimizationRunPickup.optimization_run),
        )
    )

    if status:
        query = query.filter(Pickup.status == status)

    if work_queue:
        # Strictly next-day work queue:
        # 1. Scheduled for tomorrow
        # 2. Status is SCHEDULED
        query = query.filter(
            Pickup.status == PickupStatus.SCHEDULED,
            Pickup.scheduled_date >= p_start,
            Pickup.scheduled_date < p_end,
        )

    pickups = query.order_by(Pickup.priority.desc(), Pickup.scheduled_date.asc(), Pickup.created_at.asc()).all()

    enriched = [_enrich_pickup_response(p, tomorrow) for p in pickups]

    if work_queue:
        # Exclude pickups that already belong to any active route (DRAFT, READY, ASSIGNED, IN_PROGRESS)
        enriched = [p for p in enriched if p.operational_state == "awaiting_selection"]

    if operational_state:
        enriched = [p for p in enriched if p.operational_state == operational_state]

    return enriched


@router.get(
    "/{pickup_id}",
    response_model=PickupAdminResponse,
)
def admin_get_pickup(
    pickup_id: UUID,
    db: Session = Depends(get_db),
):
    tomorrow = get_operational_planning_date()
    pickup = get_pickup_by_id(
        db=db,
        pickup_id=pickup_id,
    )
    return _enrich_pickup_response(pickup, tomorrow)


@router.post(
    "/",
    response_model=PickupAdminResponse,
    status_code=status.HTTP_201_CREATED,
)
def admin_create_pickup(
    data: PickupAdminCreate,
    db: Session = Depends(get_db),
):
    customer = db.query(Customer).filter(Customer.id == data.customer_id).first()
    if not customer:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Customer not found",
        )

    location = (
        db.query(CustomerLocation)
        .filter(
            CustomerLocation.id == data.location_id,
            CustomerLocation.customer_id == data.customer_id,
        )
        .first()
    )
    if not location:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Customer location not found",
        )

    initial_status = PickupStatus.SCHEDULED if data.scheduled_date else PickupStatus.REQUESTED
    pickup = Pickup(
        customer_id=data.customer_id,
        location_id=data.location_id,
        pickup_code=generate_pickup_code(),
        verification_token=secrets.token_urlsafe(32),
        status=initial_status,
        priority=data.priority,
        requested_date=data.requested_date,
        scheduled_date=data.scheduled_date,
        estimated_weight_kg=data.estimated_weight_kg,
        notes=data.notes,
    )
    db.add(pickup)
    db.commit()
    db.refresh(pickup)
    tomorrow = get_operational_planning_date()
    return _enrich_pickup_response(pickup, tomorrow)


@router.patch(
    "/{pickup_id}",
    response_model=PickupAdminResponse,
)
def admin_update_pickup(
    pickup_id: UUID,
    data: PickupAdminUpdate,
    db: Session = Depends(get_db),
):
    pickup = db.query(Pickup).filter(Pickup.public_id == pickup_id).first()
    if not pickup:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Pickup not found",
        )

    update_dict = data.model_dump(exclude_unset=True)
    for field, value in update_dict.items():
        setattr(pickup, field, value)

    db.commit()
    db.refresh(pickup)
    tomorrow = get_operational_planning_date()
    return _enrich_pickup_response(pickup, tomorrow)


@router.post(
    "/{pickup_id}/schedule",
    response_model=PickupAdminResponse,
)
def admin_schedule_pickup(
    pickup_id: UUID,
    data: PickupScheduleRequest,
    db: Session = Depends(get_db),
):
    pickup = schedule_pickup(
        db=db,
        pickup_id=pickup_id,
        scheduled_date=data.scheduled_date,
    )
    tomorrow = get_operational_planning_date()
    return _enrich_pickup_response(pickup, tomorrow)


@router.post(
    "/{pickup_id}/cancel",
    response_model=PickupAdminResponse,
)
def admin_cancel_pickup(
    pickup_id: UUID,
    data: PickupCancelRequest,
    db: Session = Depends(get_db),
):
    pickup = cancel_pickup(
        db=db,
        pickup_id=pickup_id,
        reason=data.reason,
    )
    tomorrow = get_operational_planning_date()
    return _enrich_pickup_response(pickup, tomorrow)


@router.post(
    "/{pickup_id}/reschedule-next-day",
    response_model=PickupAdminResponse,
    summary="Safe recovery: Reschedule failed or past pickup strictly for tomorrow's operational cycle",
)
def admin_reschedule_next_day(
    pickup_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    pickup = db.query(Pickup).filter(Pickup.public_id == pickup_id).with_for_update().first()
    if not pickup:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Pickup not found")

    tomorrow = get_operational_planning_date()
    # Schedule for 09:00 AM tomorrow in business timezone
    scheduled_dt = datetime.combine(tomorrow, dt_time(hour=9, minute=0), tzinfo=BUSINESS_TIMEZONE)

    old_status = pickup.status.value
    pickup.scheduled_date = scheduled_dt
    pickup.status = PickupStatus.SCHEDULED
    pickup.failure_reason = None

    log_operational_audit(
        db=db,
        action="PICKUP_RESCHEDULE",
        entity_type="PICKUP",
        entity_id=pickup.id,
        entity_code=pickup.pickup_code,
        actor_id=current_user.id,
        actor_name=current_user.full_name,
        details={
            "old_status": old_status,
            "new_scheduled_date": scheduled_dt.isoformat(),
            "operational_planning_date": tomorrow.isoformat(),
        },
    )

    db.commit()
    db.refresh(pickup)
    return _enrich_pickup_response(pickup, tomorrow)


@router.delete(
    "/{pickup_id}",
    status_code=status.HTTP_200_OK,
)
def admin_delete_pickup(
    pickup_id: UUID,
    db: Session = Depends(get_db),
):
    pickup = db.query(Pickup).filter(Pickup.public_id == pickup_id).first()
    if not pickup:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Pickup not found",
        )

    try:
        db.delete(pickup)
        db.commit()
    except Exception:
        db.rollback()
        pickup.status = PickupStatus.CANCELLED
        pickup.failure_reason = "Cancelled by admin"
        db.commit()

    return {"message": "Pickup removed successfully"}