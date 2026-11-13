from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, or_
from sqlalchemy.orm import Session, joinedload
from sqlalchemy.sql.functions import coalesce

from app.core.auth import get_current_user, require_role
from app.core.database import get_db
from app.core.storage import create_signed_storage_url
from app.models.customer import Customer
from app.models.customer_location import CustomerLocation
from app.models.driver import Driver
from app.models.enums import (
    PickupStatus,
    RouteStatus,
    RouteStopStatus,
    RouteStopType,
    UserRole,
)
from app.models.operational_exception import OperationalException
from app.models.pickup import Pickup
from app.models.route import Route
from app.models.route_stop import RouteStop
from app.models.user import User
from app.schemas.driver_history import (
    DriverPerformanceSummary,
    DriverPickupDetailResponse,
    DriverPickupHistoryItem,
    DriverPickupHistoryListResponse,
    DriverWorkSummaryResponse,
    OperationalExceptionItem,
    TimelineEvent,
)

router = APIRouter(
    prefix="/api/driver/history",
    tags=["Driver - Work History"],
    dependencies=[Depends(require_role(UserRole.DRIVER))],
)


def _ensure_utc_datetime(dt: datetime | date | None) -> datetime:
    if dt is None:
        return datetime.now(timezone.utc)
    if isinstance(dt, datetime):
        return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)
    return datetime(dt.year, dt.month, dt.day, tzinfo=timezone.utc)


def _get_driver_or_404(db: Session, user: User) -> Driver:
    driver = db.query(Driver).filter(Driver.user_id == user.id).first()
    if not driver:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Driver profile not found",
        )
    return driver


@router.get("/summary", response_model=DriverWorkSummaryResponse)
def get_driver_work_summary(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Get a comprehensive metrics overview and performance summary of the authenticated driver's work history.
    Dynamically calculated from real database records.
    """
    driver = _get_driver_or_404(db, current_user)

    # All pickup stops assigned to this driver's routes
    records = (
        db.query(RouteStop, Route, Pickup)
        .join(Route, Route.id == RouteStop.route_id)
        .join(Pickup, Pickup.id == RouteStop.pickup_id)
        .filter(
            Route.driver_id == driver.id,
            RouteStop.stop_type == RouteStopType.PICKUP,
        )
        .all()
    )

    total_pickups = len(records)
    completed_pickups = 0
    cancelled_pickups = 0
    failed_pickups = 0
    in_progress_pickups = 0
    total_collected_weight = 0.0

    now = datetime.now(timezone.utc)
    start_of_week = (now - timedelta(days=now.weekday())).replace(
        hour=0, minute=0, second=0, microsecond=0
    )
    start_of_month = now.replace(
        day=1, hour=0, minute=0, second=0, microsecond=0
    )

    completed_this_week = 0
    completed_this_month = 0
    weight_this_month = 0.0
    durations_minutes: list[float] = []

    for stop, route, pickup in records:
        is_completed = (
            stop.execution_status == RouteStopStatus.COMPLETED
            or pickup.status == PickupStatus.COLLECTED
        )
        is_cancelled = (
            pickup.status == PickupStatus.CANCELLED
            or route.status == RouteStatus.CANCELLED
        )
        is_failed = (
            stop.execution_status == RouteStopStatus.FAILED
            or pickup.status == PickupStatus.FAILED
        )

        if is_completed:
            completed_pickups += 1
            if stop.collected_weight_kg is not None:
                total_collected_weight += float(stop.collected_weight_kg)

            # Check completion timestamp
            comp_time = stop.completed_at or pickup.collected_at or route.route_date
            if comp_time:
                # Ensure timezone awareness for comparison
                comp_dt = comp_time if comp_time.tzinfo else comp_time.replace(tzinfo=timezone.utc)
                if comp_dt >= start_of_week:
                    completed_this_week += 1
                if comp_dt >= start_of_month:
                    completed_this_month += 1
                    if stop.collected_weight_kg is not None:
                        weight_this_month += float(stop.collected_weight_kg)

            # Collection duration if arrived_at and completed_at are recorded
            if stop.arrived_at and stop.completed_at and stop.completed_at >= stop.arrived_at:
                dur = (stop.completed_at - stop.arrived_at).total_seconds() / 60.0
                if 0 <= dur <= 300:  # Cap at reasonable 5 hours
                    durations_minutes.append(dur)

        elif is_cancelled:
            cancelled_pickups += 1
        elif is_failed:
            failed_pickups += 1
        elif stop.execution_status in (RouteStopStatus.IN_PROGRESS, RouteStopStatus.ARRIVED) or pickup.status == PickupStatus.IN_PROGRESS:
            in_progress_pickups += 1

    # Distinct working days (dates on which driver had assigned routes)
    working_days_query = (
        db.query(func.date(Route.route_date))
        .filter(Route.driver_id == driver.id)
        .distinct()
        .all()
    )
    total_working_days = len(working_days_query)

    avg_pickups_per_day = (
        round(completed_pickups / total_working_days, 1)
        if total_working_days > 0
        else 0.0
    )

    completion_rate = (
        round((completed_pickups / total_pickups) * 100.0, 1)
        if total_pickups > 0
        else 0.0
    )

    avg_duration = (
        round(sum(durations_minutes) / len(durations_minutes), 1)
        if durations_minutes
        else None
    )

    # Total distance of completed routes
    completed_routes = (
        db.query(Route)
        .filter(
            Route.driver_id == driver.id,
            Route.status.in_([RouteStatus.COMPLETED, RouteStatus.IN_PROGRESS]),
        )
        .all()
    )
    total_distance_km = round(
        sum(
            float(r.planned_distance_km)
            for r in completed_routes
            if r.planned_distance_km is not None
        ),
        1,
    )

    performance = DriverPerformanceSummary(
        completed_this_week=completed_this_week,
        completed_this_month=completed_this_month,
        collected_weight_this_month_kg=round(weight_this_month, 2),
        completion_rate_percentage=completion_rate,
        avg_collection_duration_minutes=avg_duration,
        total_distance_km=total_distance_km,
    )

    return DriverWorkSummaryResponse(
        total_pickups=total_pickups,
        completed_pickups=completed_pickups,
        cancelled_pickups=cancelled_pickups,
        failed_pickups=failed_pickups,
        in_progress_pickups=in_progress_pickups,
        total_collected_weight_kg=round(total_collected_weight, 2),
        total_working_days=total_working_days,
        avg_pickups_per_day=avg_pickups_per_day,
        performance=performance,
    )


@router.get("/pickups", response_model=DriverPickupHistoryListResponse)
def list_driver_pickup_history(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=15, ge=1, le=100),
    status: str | None = Query(default=None),
    start_date: datetime | None = Query(default=None),
    end_date: datetime | None = Query(default=None),
    search: str | None = Query(default=None),
    sort_by: str = Query(default="recent"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    List historical pickup assignments for the authenticated driver with status filtering, date range filtering,
    search, sorting, and pagination.
    """
    driver = _get_driver_or_404(db, current_user)

    # Normalize parameters if invoked directly or via dependency
    status_str = status if isinstance(status, str) else None
    search_str = search if isinstance(search, str) else None
    sort_by_str = sort_by if isinstance(sort_by, str) else "recent"
    start_dt = start_date if isinstance(start_date, (datetime, date)) else None
    end_dt = end_date if isinstance(end_date, (datetime, date)) else None

    query = (
        db.query(RouteStop, Route, Pickup, Customer, CustomerLocation)
        .join(Route, Route.id == RouteStop.route_id)
        .join(Pickup, Pickup.id == RouteStop.pickup_id)
        .join(Customer, Customer.id == Pickup.customer_id)
        .join(CustomerLocation, CustomerLocation.id == Pickup.location_id)
        .filter(
            Route.driver_id == driver.id,
            RouteStop.stop_type == RouteStopType.PICKUP,
        )
    )

    # Status filter
    if status_str and status_str.lower() != "all":
        st = status_str.lower()
        if st == "completed":
            query = query.filter(
                or_(
                    RouteStop.execution_status == RouteStopStatus.COMPLETED,
                    Pickup.status == PickupStatus.COLLECTED,
                )
            )
        elif st == "cancelled":
            query = query.filter(
                or_(
                    Pickup.status == PickupStatus.CANCELLED,
                    Route.status == RouteStatus.CANCELLED,
                )
            )
        elif st == "failed":
            query = query.filter(
                or_(
                    RouteStop.execution_status == RouteStopStatus.FAILED,
                    Pickup.status == PickupStatus.FAILED,
                )
            )
        elif st in ("in_progress", "in-progress"):
            query = query.filter(
                or_(
                    RouteStop.execution_status.in_(
                        [RouteStopStatus.IN_PROGRESS, RouteStopStatus.ARRIVED]
                    ),
                    Pickup.status == PickupStatus.IN_PROGRESS,
                )
            )
        elif st in ("assigned", "pending", "scheduled"):
            query = query.filter(
                RouteStop.execution_status == RouteStopStatus.PENDING,
                Pickup.status != PickupStatus.CANCELLED,
                Route.status != RouteStatus.CANCELLED,
            )

    # Date range filter (checks completion time, scheduled date, or route date)
    effective_date = coalesce(
        RouteStop.completed_at,
        Pickup.collected_at,
        Pickup.scheduled_date,
        Route.route_date,
        Pickup.created_at,
    )
    if start_dt:
        query = query.filter(effective_date >= start_dt)
    if end_dt:
        query = query.filter(effective_date <= end_dt)

    # Search filter
    if search_str and search_str.strip():
        term = f"%{search_str.strip()}%"
        query = query.filter(
            or_(
                Pickup.pickup_code.ilike(term),
                Customer.display_name.ilike(term),
                Customer.legal_name.ilike(term),
                CustomerLocation.name.ilike(term),
                CustomerLocation.address_line_1.ilike(term),
                CustomerLocation.city.ilike(term),
            )
        )

    total = query.count()
    total_pages = max(1, (total + page_size - 1) // page_size)

    # Sorting
    if sort_by_str == "oldest":
        query = query.order_by(effective_date.asc(), RouteStop.id.asc())
    else:  # recent
        query = query.order_by(effective_date.desc(), RouteStop.id.desc())

    offset = (page - 1) * page_size
    results = query.offset(offset).limit(page_size).all()

    items: list[DriverPickupHistoryItem] = []
    for stop, route, pickup, customer, location in results:
        # Determine normalized display status
        if stop.execution_status == RouteStopStatus.COMPLETED or pickup.status == PickupStatus.COLLECTED:
            display_status = "COMPLETED"
        elif pickup.status == PickupStatus.CANCELLED or route.status == RouteStatus.CANCELLED:
            display_status = "CANCELLED"
        elif stop.execution_status == RouteStopStatus.FAILED or pickup.status == PickupStatus.FAILED:
            display_status = "FAILED"
        elif stop.execution_status in (RouteStopStatus.ARRIVED, RouteStopStatus.IN_PROGRESS) or pickup.status == PickupStatus.IN_PROGRESS:
            display_status = "IN_PROGRESS"
        else:
            display_status = pickup.status.value if hasattr(pickup.status, "value") else str(pickup.status)

        items.append(
            DriverPickupHistoryItem(
                id=pickup.id,
                public_id=pickup.public_id,
                pickup_code=pickup.pickup_code,
                status=display_status,
                priority=pickup.priority.value if hasattr(pickup.priority, "value") else str(pickup.priority),
                customer_id=customer.id,
                customer_name=customer.display_name or customer.legal_name,
                customer_type=customer.customer_type.value if hasattr(customer.customer_type, "value") else str(customer.customer_type),
                location_id=location.id,
                location_name=location.name,
                address=location.address_line_1,
                city=location.city,
                postal_code=location.postal_code,
                route_id=route.id,
                route_code=route.route_code,
                route_date=route.route_date,
                requested_date=pickup.requested_date,
                scheduled_date=pickup.scheduled_date,
                completed_at=stop.completed_at or pickup.collected_at,
                estimated_weight_kg=float(pickup.estimated_weight_kg) if pickup.estimated_weight_kg is not None else None,
                collected_weight_kg=float(stop.collected_weight_kg) if stop.collected_weight_kg is not None else None,
                has_proof=bool(stop.proof_storage_path),
                qr_verified=bool(pickup.qr_verified_at),
                otp_verified=bool(pickup.otp_verified_at),
                failure_reason=stop.failure_reason or pickup.failure_reason,
                created_at=pickup.created_at,
            )
        )

    return DriverPickupHistoryListResponse(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
    )


@router.get("/pickups/{pickup_identifier}", response_model=DriverPickupDetailResponse)
def get_driver_pickup_detail(
    pickup_identifier: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Get complete details of a historical pickup for the authenticated driver.
    Includes customer profile, address, contact details, weight verification,
    collection proof signed URL, and chronological lifecycle timeline.
    Enforces authorization: Drivers cannot access other drivers' records.
    """
    driver = _get_driver_or_404(db, current_user)

    # Match identifier by UUID, integer id, or pickup_code
    filter_criteria = []
    try:
        val_uuid = UUID(pickup_identifier)
        filter_criteria.append(Pickup.public_id == val_uuid)
    except (ValueError, AttributeError):
        pass

    if pickup_identifier.isdigit():
        filter_criteria.append(Pickup.id == int(pickup_identifier))

    filter_criteria.append(Pickup.pickup_code.ilike(pickup_identifier))

    # Query pickup with its route stop
    pickup_record = (
        db.query(Pickup)
        .options(
            joinedload(Pickup.customer),
            joinedload(Pickup.location),
            joinedload(Pickup.route_stops).joinedload(RouteStop.route).joinedload(Route.vehicle),
            joinedload(Pickup.route_stops).joinedload(RouteStop.route).joinedload(Route.warehouse),
        )
        .filter(or_(*filter_criteria))
        .first()
    )

    if not pickup_record:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Pickup not found",
        )

    # Find the route stop for this driver
    matching_stop: RouteStop | None = None
    matching_route: Route | None = None

    for stop in pickup_record.route_stops:
        if stop.route and stop.route.driver_id == driver.id:
            matching_stop = stop
            matching_route = stop.route
            break

    # If the pickup exists but belongs to a different driver -> 403 Forbidden
    if not matching_stop or not matching_route:
        # Check if pickup is assigned to someone else
        assigned_to_other = any(
            s.route and s.route.driver_id is not None and s.route.driver_id != driver.id
            for s in pickup_record.route_stops
        )
        if assigned_to_other:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access forbidden: This pickup was assigned to another driver",
            )
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Pickup not assigned to this driver",
        )

    customer = pickup_record.customer
    location = pickup_record.location

    # Determine normalized status
    if matching_stop.execution_status == RouteStopStatus.COMPLETED or pickup_record.status == PickupStatus.COLLECTED:
        display_status = "COMPLETED"
    elif pickup_record.status == PickupStatus.CANCELLED or matching_route.status == RouteStatus.CANCELLED:
        display_status = "CANCELLED"
    elif matching_stop.execution_status == RouteStopStatus.FAILED or pickup_record.status == PickupStatus.FAILED:
        display_status = "FAILED"
    elif matching_stop.execution_status in (RouteStopStatus.ARRIVED, RouteStopStatus.IN_PROGRESS) or pickup_record.status == PickupStatus.IN_PROGRESS:
        display_status = "IN_PROGRESS"
    else:
        display_status = pickup_record.status.value if hasattr(pickup_record.status, "value") else str(pickup_record.status)

    # Weights and discrepancy
    est_wt = float(pickup_record.estimated_weight_kg) if pickup_record.estimated_weight_kg is not None else None
    col_wt = float(matching_stop.collected_weight_kg) if matching_stop.collected_weight_kg is not None else None
    weight_diff = round(col_wt - est_wt, 2) if (col_wt is not None and est_wt is not None) else None

    # Signed URL for proof if exists
    signed_proof_url: str | None = None
    if matching_stop.proof_storage_path:
        try:
            signed_proof_url = create_signed_storage_url(
                storage_path=matching_stop.proof_storage_path,
                expires_in=3600,
            )
        except Exception:
            signed_proof_url = None

    # Fetch operational exceptions if any
    exceptions = (
        db.query(OperationalException)
        .filter(
            or_(
                OperationalException.source_id == matching_stop.id,
                OperationalException.source_id == pickup_record.id,
            )
        )
        .order_by(OperationalException.id.desc())
        .all()
    )
    exception_items = [
        OperationalExceptionItem(
            id=exc.id,
            exception_type=exc.exception_type.value if hasattr(exc.exception_type, "value") else str(exc.exception_type),
            status=exc.status.value if hasattr(exc.status, "value") else str(exc.status),
            created_at=exc.created_at if hasattr(exc, "created_at") else datetime.now(timezone.utc),
        )
        for exc in exceptions
    ]

    # Build Chronological Timeline from actual backend timestamps
    timeline_events: list[TimelineEvent] = []

    # 1. Request / Creation
    created_time = pickup_record.requested_date or pickup_record.created_at
    if created_time:
        timeline_events.append(
            TimelineEvent(
                stage="requested",
                label="Pickup Created & Requested",
                description=f"Initial request recorded for {customer.display_name or customer.legal_name}",
                timestamp=_ensure_utc_datetime(created_time),
                status="completed",
            )
        )

    # 2. Scheduling
    if pickup_record.scheduled_date:
        timeline_events.append(
            TimelineEvent(
                stage="scheduled",
                label="Pickup Scheduled",
                description="Scheduled collection date assigned",
                timestamp=_ensure_utc_datetime(pickup_record.scheduled_date),
                status="completed",
            )
        )

    # 3. Route Assignment
    assignment_time = matching_route.created_at or matching_route.route_date
    if assignment_time:
        timeline_events.append(
            TimelineEvent(
                stage="assigned",
                label="Assigned to Route",
                description=f"Assigned to Route {matching_route.route_code} (Stop #{matching_stop.sequence_number})",
                timestamp=_ensure_utc_datetime(assignment_time),
                status="completed",
            )
        )

    # 4. Route Start / Approval
    if matching_route.approved_at:
        timeline_events.append(
            TimelineEvent(
                stage="route_started",
                label="Route Dispatched & Started",
                description=f"Driver active on Route {matching_route.route_code}",
                timestamp=_ensure_utc_datetime(matching_route.approved_at),
                status="completed",
            )
        )

    # 5. Arrived at location
    if matching_stop.arrived_at:
        timeline_events.append(
            TimelineEvent(
                stage="arrived",
                label="Driver Arrived at Facility",
                description=f"Check-in verified at {location.name}",
                timestamp=_ensure_utc_datetime(matching_stop.arrived_at),
                status="completed",
            )
        )

    # 6. Consignment Weighed
    if col_wt is not None and matching_stop.arrived_at:
        timeline_events.append(
            TimelineEvent(
                stage="weighed",
                label="Consignment Weighed",
                description=f"Actual scale weight recorded: {col_wt:.2f} kg",
                timestamp=_ensure_utc_datetime(matching_stop.arrived_at),
                status="completed",
            )
        )

    # 7. QR Code Scanned & Verified
    if pickup_record.qr_verified_at:
        timeline_events.append(
            TimelineEvent(
                stage="qr_verified",
                label="Consignment QR Verified",
                description="Secure QR code scanned & tamper-evident seal validated",
                timestamp=_ensure_utc_datetime(pickup_record.qr_verified_at),
                status="completed",
            )
        )

    # 8. Customer OTP Authenticated
    if pickup_record.otp_verified_at:
        timeline_events.append(
            TimelineEvent(
                stage="otp_verified",
                label="Customer OTP Authenticated",
                description="Facility representative authorized custody transfer via 6-digit OTP",
                timestamp=_ensure_utc_datetime(pickup_record.otp_verified_at),
                status="completed",
            )
        )

    # 9. Collection Proof Uploaded
    if matching_stop.proof_uploaded_at:
        timeline_events.append(
            TimelineEvent(
                stage="proof_uploaded",
                label="Collection Proof Captured",
                description="Photographic custody proof uploaded to secure storage",
                timestamp=_ensure_utc_datetime(matching_stop.proof_uploaded_at),
                status="completed",
            )
        )

    # 10. Completed or Failed / Cancelled
    if display_status == "COMPLETED":
        complete_time = matching_stop.completed_at or pickup_record.collected_at or pickup_record.updated_at
        timeline_events.append(
            TimelineEvent(
                stage="completed",
                label="Pickup Completed & Custody Handed Over",
                description=f"Finalized and recorded with gross weight {col_wt or est_wt or 0:.2f} kg",
                timestamp=_ensure_utc_datetime(complete_time),
                status="completed",
            )
        )
    elif display_status == "FAILED":
        fail_time = matching_stop.completed_at or pickup_record.updated_at
        timeline_events.append(
            TimelineEvent(
                stage="failed",
                label="Pickup Unsuccessful / Failed",
                description=matching_stop.failure_reason or pickup_record.failure_reason or "Collection could not be completed",
                timestamp=_ensure_utc_datetime(fail_time),
                status="failed",
            )
        )
    elif display_status == "CANCELLED":
        cancel_time = pickup_record.updated_at
        timeline_events.append(
            TimelineEvent(
                stage="cancelled",
                label="Pickup Cancelled",
                description=pickup_record.failure_reason or "Order cancelled before completion",
                timestamp=_ensure_utc_datetime(cancel_time),
                status="failed",
            )
        )

    # Sort timeline chronologically by timestamp
    timeline_events.sort(key=lambda ev: ev.timestamp)

    return DriverPickupDetailResponse(
        id=pickup_record.id,
        public_id=pickup_record.public_id,
        pickup_code=pickup_record.pickup_code,
        status=display_status,
        priority=pickup_record.priority.value if hasattr(pickup_record.priority, "value") else str(pickup_record.priority),
        customer_id=customer.id,
        customer_name=customer.display_name or customer.legal_name,
        customer_type=customer.customer_type.value if hasattr(customer.customer_type, "value") else str(customer.customer_type),
        location_id=location.id,
        location_name=location.name,
        address=location.address_line_1,
        address_line_1=location.address_line_1,
        address_line_2=getattr(location, "address_line_2", None),
        city=location.city,
        state=getattr(location, "state", None),
        postal_code=location.postal_code,
        contact_name=getattr(location, "contact_name", None),
        contact_phone=getattr(location, "contact_phone", None),
        latitude=float(location.latitude) if location.latitude is not None else None,
        longitude=float(location.longitude) if location.longitude is not None else None,
        route_id=matching_route.id,
        route_code=matching_route.route_code,
        route_date=matching_route.route_date,
        route_status=matching_route.status.value if hasattr(matching_route.status, "value") else str(matching_route.status),
        vehicle_registration_number=matching_route.vehicle.registration_number if matching_route.vehicle else None,
        warehouse_name=matching_route.warehouse.name if matching_route.warehouse else None,
        requested_date=pickup_record.requested_date,
        scheduled_date=pickup_record.scheduled_date,
        arrived_at=matching_stop.arrived_at,
        completed_at=matching_stop.completed_at or pickup_record.collected_at,
        estimated_weight_kg=est_wt,
        collected_weight_kg=col_wt,
        weight_discrepancy_kg=weight_diff,
        notes=pickup_record.notes or matching_stop.notes if hasattr(matching_stop, "notes") else pickup_record.notes,
        failure_reason=matching_stop.failure_reason or pickup_record.failure_reason,
        qr_verified=bool(pickup_record.qr_verified_at),
        qr_verified_at=pickup_record.qr_verified_at,
        otp_verified=bool(pickup_record.otp_verified_at),
        otp_verified_at=pickup_record.otp_verified_at,
        has_proof=bool(matching_stop.proof_storage_path),
        proof_uploaded_at=matching_stop.proof_uploaded_at,
        proof_storage_path=matching_stop.proof_storage_path,
        proof_signed_url=signed_proof_url,
        exceptions=exception_items,
        timeline=timeline_events,
        created_at=pickup_record.created_at,
        updated_at=pickup_record.updated_at,
    )

