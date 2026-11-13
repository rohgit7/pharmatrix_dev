from datetime import date, datetime, time as dt_time
import logging
import secrets
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from fastapi.responses import StreamingResponse
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
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
    DriverLiveLocationResponse,
    PickupAdminCreate,
    PickupAdminResponse,
    PickupAdminUpdate,
    PickupCancelRequest,
    PickupEventItem,
    PickupHistoryItem,
    PickupHistoryResponse,
    PickupMonitoringDetailResponse,
    PickupMonitoringListResponse,
    PickupReassignDriverRequest,
    PickupScheduleRequest,
)
from app.services.audit_service import log_operational_audit
from app.services.pickup_event_service import get_chronological_pickup_events
from app.services.pickup_monitoring_service import (
    build_pickup_monitoring_detail,
    get_driver_live_location_for_pickup,
    list_pickup_monitoring,
    reassign_pickup_driver,
)
from app.services.pickup_service import (
    cancel_pickup,
    generate_pickup_code,
    get_pickup_by_id,
    schedule_pickup,
)


logger = logging.getLogger(__name__)

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


def _resolve_pickup(db: Session, pickup_id: str | UUID | int) -> Pickup:
    if isinstance(pickup_id, UUID):
        p = db.query(Pickup).filter(Pickup.public_id == pickup_id).first()
        if p:
            return p
    if isinstance(pickup_id, int):
        p = db.query(Pickup).filter(Pickup.id == pickup_id).first()
        if p:
            return p

    str_id = str(pickup_id).strip()
    try:
        u_val = UUID(str_id)
        p = db.query(Pickup).filter(Pickup.public_id == u_val).first()
        if p:
            return p
    except (ValueError, AttributeError):
        pass

    if str_id.isdigit():
        p = db.query(Pickup).filter(Pickup.id == int(str_id)).first()
        if p:
            return p

    p = db.query(Pickup).filter(Pickup.pickup_code.ilike(str_id)).first()
    if p:
        return p

    raise HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail=f"Pickup '{pickup_id}' not found",
    )


@router.get(
    "/monitoring",
    response_model=PickupMonitoringListResponse,
    summary="List all pickups with live monitoring filters and lifecycle counters",
)
def admin_pickup_monitoring_list(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    search: str | None = Query(default=None),
    status: str | None = Query(default=None),
    customer_type: str | None = Query(default=None),
    driver_id: int | None = Query(default=None),
    start_date: datetime | None = Query(default=None),
    end_date: datetime | None = Query(default=None),
    delayed_only: bool = Query(default=False),
    db: Session = Depends(get_db),
):
    return list_pickup_monitoring(
        db=db,
        page=page,
        page_size=page_size,
        search=search,
        status_filter=status,
        customer_type=customer_type,
        driver_id=driver_id,
        start_date=start_date,
        end_date=end_date,
        delayed_only=delayed_only,
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


@router.get(
    "/{pickup_id}/monitoring-detail",
    response_model=PickupMonitoringDetailResponse,
    summary="Get complete live monitoring details, progress timeline, and financials",
)
def admin_get_pickup_monitoring_detail(
    pickup_id: str,
    db: Session = Depends(get_db),
):
    pickup = _resolve_pickup(db, pickup_id)
    return build_pickup_monitoring_detail(db=db, pickup=pickup)


@router.get(
    "/{pickup_id}/events",
    response_model=list[PickupEventItem],
    summary="Get complete chronological activity and audit log for a pickup",
)
def admin_get_pickup_events(
    pickup_id: str,
    db: Session = Depends(get_db),
):
    pickup = _resolve_pickup(db, pickup_id)
    raw_events = get_chronological_pickup_events(db, pickup)
    return [
        PickupEventItem(
            id=ev["id"],
            event_type=ev["event_type"],
            title=ev["title"],
            description=ev.get("description"),
            actor_type=ev["actor_type"],
            actor_id=ev.get("actor_id"),
            actor_name=ev["actor_name"],
            metadata=ev.get("metadata", {}),
            created_at=datetime.fromisoformat(ev["created_at"]),
            source=ev["source"],
        )
        for ev in raw_events
    ]


@router.get(
    "/{pickup_id}/driver-location",
    response_model=DriverLiveLocationResponse,
    summary="Get live GPS telemetry for assigned driver",
)
def admin_get_pickup_driver_location(
    pickup_id: str,
    db: Session = Depends(get_db),
):
    pickup = _resolve_pickup(db, pickup_id)
    return get_driver_live_location_for_pickup(db=db, pickup=pickup)


@router.post(
    "/{pickup_id}/reassign-driver",
    response_model=PickupMonitoringDetailResponse,
    summary="Reassign driver/vehicle for a pickup with recorded audit event",
)
def admin_reassign_driver_for_pickup(
    pickup_id: str,
    data: PickupReassignDriverRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    pickup = _resolve_pickup(db, pickup_id)
    reassign_pickup_driver(
        db=db,
        pickup=pickup,
        driver_id=data.driver_id,
        vehicle_id=data.vehicle_id,
        reason=data.reason,
        admin_user=current_user,
    )
    return build_pickup_monitoring_detail(db=db, pickup=pickup)


stream_router = APIRouter(
    prefix="/api/admin/pickups",
    tags=["Admin - Pickups Live Stream"],
)


def _get_admin_for_stream(
    credentials: HTTPAuthorizationCredentials | None = Depends(HTTPBearer(auto_error=False)),
    token: str | None = Query(default=None),
    db: Session = Depends(get_db),
) -> User:
    raw_token = credentials.credentials if credentials else token
    if not raw_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing authentication token",
        )
    from app.core.auth import extract_auth_user_info
    auth_user_id, token_email = extract_auth_user_info(raw_token)
    user = db.query(User).filter(User.auth_user_id == auth_user_id).first()
    if not user and token_email:
        user = db.query(User).filter(User.email.ilike(token_email.strip().lower())).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User profile not found",
        )
    if user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Insufficient permissions",
        )
    return user


@stream_router.get(
    "/{pickup_id}/live-stream",
    summary="Event-driven Server-Sent Events (SSE) telemetry stream for a selected pickup",
)
async def admin_pickup_live_stream(
    pickup_id: str,
    request: Request,
    db: Session = Depends(get_db),
    admin_user: User = Depends(_get_admin_for_stream),
):
    pickup = _resolve_pickup(db, pickup_id)
    pickup_pk = pickup.id

    async def sse_generator():
        import asyncio
        from app.core.database import SessionLocal
        from app.core.live_bus import pickup_live_bus

        # 1. Immediate initial snapshot
        s_db = SessionLocal()
        is_terminal = False
        last_hash = ""
        try:
            p = s_db.query(Pickup).filter(Pickup.id == pickup_pk).first()
            if not p:
                return

            is_terminal = p.status in [PickupStatus.COMPLETED, PickupStatus.CANCELLED, PickupStatus.FAILED]
            detail = build_pickup_monitoring_detail(s_db, p)
            last_hash = f"{p.status.value}:{p.updated_at.isoformat() if p.updated_at else ''}"
            payload = detail.model_dump_json()
            yield f"event: pickup_update\ndata: {payload}\n\n"

            # If already terminal, close stream gracefully - no active monitoring needed
            if is_terminal:
                yield "event: stream_end\ndata: {\"reason\": \"terminal_status\", \"status\": \"" + p.status.value + "\"}\n\n"
                return
        except Exception as init_err:
            logger.warning("Error generating initial SSE snapshot: %s", init_err)
            return
        finally:
            s_db.close()

        # 2. Event-driven reactivity: wait for actual domain events (driver GPS, status changes)
        # Replaces continuous 4-second DB polling with reactive asyncio events.
        event = asyncio.Event()
        pickup_live_bus.subscribe(pickup_pk, event)

        try:
            start_time = asyncio.get_event_loop().time()
            max_stream_duration = 900.0  # 15 minutes max per stream session

            while True:
                if await request.is_disconnected():
                    break

                elapsed = asyncio.get_event_loop().time() - start_time
                if elapsed >= max_stream_duration:
                    yield ": keepalive_session_renew\n\n"
                    break

                # Sleep-wait until a real domain event occurs or 20s keepalive tick fires
                has_event = False
                try:
                    await asyncio.wait_for(event.wait(), timeout=20.0)
                    event.clear()
                    has_event = True
                except asyncio.TimeoutError:
                    has_event = False

                if await request.is_disconnected():
                    break

                if not has_event:
                    # Idle tick: emit a 12-byte SSE comment to keep connection alive WITHOUT hitting the database!
                    yield ": keepalive\n\n"
                    continue

                # A real event occurred (e.g. driver GPS ping, status transition, OTP confirmation).
                # Query DB only on actual changes.
                s_db = SessionLocal()
                try:
                    p = s_db.query(Pickup).filter(Pickup.id == pickup_pk).first()
                    if not p:
                        break

                    quick_hash = f"{p.status.value}:{p.updated_at.isoformat() if p.updated_at else ''}"
                    
                    # Include assigned driver live coordinate telemetry in diff hash
                    drv_telemetry = ""
                    if p.route_stops and p.route_stops[0].route and p.route_stops[0].route.driver:
                        d = p.route_stops[0].route.driver
                        drv_telemetry = f":{d.current_latitude}:{d.current_longitude}:{d.last_location_update}"

                    combined_hash = quick_hash + drv_telemetry
                    if combined_hash != last_hash:
                        last_hash = combined_hash
                        detail = build_pickup_monitoring_detail(s_db, p)
                        yield f"event: pickup_update\ndata: {detail.model_dump_json()}\n\n"

                        if p.status in [PickupStatus.COMPLETED, PickupStatus.CANCELLED, PickupStatus.FAILED]:
                            yield "event: stream_end\ndata: {\"reason\": \"terminal_status\", \"status\": \"" + p.status.value + "\"}\n\n"
                            break
                    else:
                        yield ": keepalive\n\n"
                except Exception as stream_err:
                    logger.warning("SSE live stream error: %s", stream_err)
                    break
                finally:
                    s_db.close()
        finally:
            pickup_live_bus.unsubscribe(pickup_pk, event)

    return StreamingResponse(
        sse_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


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
        actor_name=current_user.name,
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