from __future__ import annotations

import logging
import math
from datetime import datetime, timezone
from decimal import Decimal
from typing import Any
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import or_, and_, desc
from sqlalchemy.orm import Session, joinedload, selectinload

from app.core.storage import create_signed_storage_url
from app.models.customer import Customer
from app.models.customer_location import CustomerLocation
from app.models.driver import Driver
from app.models.enums import PickupStatus, RouteStatus, RouteStopStatus, RouteStopType
from app.models.invoice import Invoice
from app.models.operational_exception import OperationalException
from app.models.payment import Payment
from app.models.pickup import Pickup
from app.models.razorpay_order import RazorpayOrder
from app.models.route import Route
from app.models.route_stop import RouteStop
from app.models.user import User
from app.models.vehicle import Vehicle
from app.schemas.pickup import (
    DriverLiveLocationResponse,
    PickupCollectionInfo,
    PickupCompletionInfo,
    PickupCustomerInfo,
    PickupDriverInfo,
    PickupEventItem,
    PickupMonitoringDetailResponse,
    PickupMonitoringItem,
    PickupMonitoringListResponse,
    PickupOtpVerificationInfo,
    PickupPaymentInfo,
    PickupTimelineStage,
    PickupVehicleInfo,
)
from app.services.audit_service import log_operational_audit
from app.services.pickup_event_service import (
    get_chronological_pickup_events,
    record_pickup_event,
)

logger = logging.getLogger(__name__)

_signed_url_cache: dict[str, tuple[str, float]] = {}


def get_cached_signed_proof_url(storage_path: str, expires_in: int = 3600) -> str | None:
    import time
    if not storage_path:
        return None
    if storage_path.startswith("http://") or storage_path.startswith("https://"):
        return storage_path
    now_ts = time.time()
    cached = _signed_url_cache.get(storage_path)
    if cached and cached[1] > now_ts:
        return cached[0]
    try:
        url = create_signed_storage_url(storage_path, expires_in=expires_in)
        _signed_url_cache[storage_path] = (url, now_ts + max(60, expires_in - 300))
        return url
    except Exception as e:
        logger.warning("Failed to sign proof URL for %s: %s", storage_path, e)
        return None


def _ensure_utc(dt: datetime | None) -> datetime | None:
    if dt is None:
        return None
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt


def haversine_distance_m(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculates great-circle distance between two GPS coordinates in meters."""
    R = 6371000.0  # Earth radius in meters
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)

    a = (
        math.sin(delta_phi / 2.0) ** 2
        + math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda / 2.0) ** 2
    )
    c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))
    return R * c


def get_active_route_stop_for_pickup(pickup: Pickup) -> tuple[RouteStop | None, Route | None]:
    """Finds the active (non-cancelled) route stop and route for a pickup."""
    if not pickup.route_stops:
        return None, None
    for stop in pickup.route_stops:
        if stop.route and stop.route.status != RouteStatus.CANCELLED:
            return stop, stop.route
    return pickup.route_stops[0], pickup.route_stops[0].route if pickup.route_stops[0] else None


def compute_pickup_exceptions_and_delays(
    pickup: Pickup,
    route_stop: RouteStop | None,
    route: Route | None,
    invoice: Invoice | None,
    now: datetime,
) -> tuple[bool, list[str], list[dict[str, Any]]]:
    """
    Evaluates pickup state against business SLA rules to identify
    operational delays, bottlenecks, and exceptions.
    """
    delay_reasons: list[str] = []
    exceptions_list: list[dict[str, Any]] = []
    is_delayed = False
    sched_dt = _ensure_utc(pickup.scheduled_date)

    # 1. Driver not assigned
    if pickup.status in [PickupStatus.REQUESTED, PickupStatus.SCHEDULED]:
        if not route or not route.driver_id:
            if sched_dt and sched_dt <= now:
                is_delayed = True
                diff_hours = int((now - sched_dt).total_seconds() // 3600)
                delay_reasons.append(
                    f"Scheduled time elapsed ({diff_hours}h ago), but no driver has been assigned."
                )
            elif sched_dt and (sched_dt - now).total_seconds() < 4 * 3600:
                delay_reasons.append(
                    "Pickup scheduled within 4 hours, but driver allocation is pending."
                )

    # 2. Overdue pickup
    if pickup.status not in [PickupStatus.COLLECTED, PickupStatus.CANCELLED, PickupStatus.FAILED]:
        if sched_dt and sched_dt < now:
            mins_overdue = int((now - sched_dt).total_seconds() // 60)
            if mins_overdue > 30:
                is_delayed = True
                delay_reasons.append(f"Pickup is overdue by {mins_overdue} minutes.")

    # 3. Route in progress but stop not reached
    if route and route.status == RouteStatus.IN_PROGRESS and route_stop:
        if route_stop.execution_status == RouteStopStatus.PENDING:
            if sched_dt and sched_dt < now:
                mins = int((now - sched_dt).total_seconds() // 60)
                if mins > 20:
                    delay_reasons.append(f"Driver en route is delayed {mins}m past scheduled window.")

    # 4. Driver arrived, but weight confirmation pending
    if route_stop and route_stop.execution_status == RouteStopStatus.ARRIVED:
        arrived_dt = _ensure_utc(route_stop.arrived_at)
        if route_stop.collected_weight_kg is None and arrived_dt:
            mins_waiting = int((now - arrived_dt).total_seconds() // 60)
            if mins_waiting > 15:
                is_delayed = True
                delay_reasons.append(
                    f"Driver arrived {mins_waiting}m ago; collection & weighing is still pending."
                )

    # 5. Weight discrepancy
    if route_stop and route_stop.collected_weight_kg is not None and pickup.estimated_weight_kg:
        est = float(pickup.estimated_weight_kg)
        act = float(route_stop.collected_weight_kg)
        diff = act - est
        diff_pct = (abs(diff) / est * 100.0) if est > 0 else 0.0
        if (abs(diff) > 5.0 and diff_pct > 25.0) or diff_pct > 50.0:
            delay_reasons.append(
                f"Unusual weight discrepancy: actual {act:.1f} kg vs estimated {est:.1f} kg ({diff_pct:.0f}% variance)."
            )

    # 6. Payment pending after weighing
    if route_stop and route_stop.collected_weight_kg is not None:
        if invoice and invoice.status == "ISSUED" and invoice.amount_paid < invoice.total_amount:
            delay_reasons.append(
                f"Customer payment of ₹{float(invoice.total_amount):.2f} is pending."
            )

    # 7. OTP verification pending
    if route_stop and route_stop.collected_weight_kg is not None:
        if pickup.qr_verified_at and not pickup.otp_verified_at:
            delay_reasons.append("Customer handover OTP verification is pending.")

    # 8. Missing proof
    if pickup.status == PickupStatus.COLLECTED:
        if not route_stop or not route_stop.proof_storage_path:
            delay_reasons.append("Completed pickup is missing collection photographic evidence.")

    # 9. Failed or Cancelled
    if pickup.status == PickupStatus.FAILED:
        is_delayed = True
        delay_reasons.append(f"Pickup execution failed: {pickup.failure_reason or 'Reason unspecified'}")
    elif pickup.status == PickupStatus.CANCELLED:
        delay_reasons.append(f"Pickup cancelled: {pickup.failure_reason or 'Cancelled'}")

    return is_delayed, delay_reasons, exceptions_list


def compute_lifecycle_timeline(
    pickup: Pickup,
    route_stop: RouteStop | None,
    route: Route | None,
    invoice: Invoice | None,
    payment: Payment | None,
) -> tuple[list[PickupTimelineStage], int, str]:
    """
    Constructs the 11-stage progress timeline based strictly on backend state.
    Returns (stages, progress_percent, current_stage_name).
    """
    is_cancelled = pickup.status == PickupStatus.CANCELLED
    is_failed = pickup.status == PickupStatus.FAILED

    driver = route.driver if route else None
    driver_user = driver.user if driver else None
    driver_name = driver_user.name if driver_user else (driver.employee_id if driver else "Driver")

    stages: list[PickupTimelineStage] = []

    # 1. Pickup Requested
    stages.append(
        PickupTimelineStage(
            stage_id="REQUESTED",
            name="Pickup Requested",
            state="COMPLETED",
            timestamp=pickup.created_at,
            description="Pickup request registered by customer",
            actor=pickup.customer.display_name if pickup.customer else "Customer",
            metadata={"pickup_code": pickup.pickup_code},
        )
    )

    # 2. Pickup Scheduled
    s2_completed = pickup.scheduled_date is not None or pickup.status not in [PickupStatus.REQUESTED]
    s2_current = pickup.status == PickupStatus.REQUESTED and not is_cancelled and not is_failed
    stages.append(
        PickupTimelineStage(
            stage_id="SCHEDULED",
            name="Pickup Scheduled",
            state="COMPLETED" if s2_completed else ("CURRENT" if s2_current else "UPCOMING"),
            timestamp=pickup.scheduled_date or (pickup.updated_at if s2_completed else None),
            description="Operational schedule confirmed and queued for routing",
            actor="System",
            metadata={"scheduled_date": pickup.scheduled_date.isoformat() if pickup.scheduled_date else None},
        )
    )

    # 3. Driver Assigned
    has_driver = bool(route and route.driver_id)
    s3_completed = has_driver or pickup.status in [PickupStatus.ASSIGNED, PickupStatus.IN_PROGRESS, PickupStatus.COLLECTED]
    s3_current = s2_completed and not s3_completed and not is_cancelled and not is_failed
    stages.append(
        PickupTimelineStage(
            stage_id="DRIVER_ASSIGNED",
            name="Driver Assigned",
            state="COMPLETED" if s3_completed else ("CURRENT" if s3_current else "UPCOMING"),
            timestamp=route.created_at if (has_driver and route) else None,
            description=f"Assigned to {driver_name} ({route.route_code if route else 'Route Pending'})" if has_driver else "Awaiting fleet dispatch allocation",
            actor="Admin Dispatcher" if has_driver else None,
            metadata={"driver_id": driver.id if driver else None, "route_code": route.route_code if route else None},
        )
    )

    # 4. Driver Started Route
    route_started = bool(route and route.status in [RouteStatus.IN_PROGRESS, RouteStatus.COMPLETED])
    s4_completed = route_started or (route_stop and route_stop.execution_status in [RouteStopStatus.ARRIVED, RouteStopStatus.IN_PROGRESS, RouteStopStatus.COMPLETED]) or pickup.status in [PickupStatus.IN_PROGRESS, PickupStatus.COLLECTED]
    s4_current = s3_completed and not s4_completed and not is_cancelled and not is_failed
    s4_ts = None
    if s4_completed:
        s4_ts = (route_stop.arrived_at if route_stop else None) or (route.updated_at if route_started and route else None) or pickup.updated_at
    stages.append(
        PickupTimelineStage(
            stage_id="DRIVER_EN_ROUTE",
            name="Driver Started Route",
            state="COMPLETED" if s4_completed else ("CURRENT" if s4_current else "UPCOMING"),
            timestamp=s4_ts,
            description=f"Driver {driver_name} is in transit towards pickup facility" if s4_completed else "Route dispatch pending",
            actor=driver_name if s4_completed else None,
            metadata={"route_status": route.status.value if route else None},
        )
    )

    # 5. Driver Arrived
    stop_arrived = bool(route_stop and (route_stop.arrived_at is not None or route_stop.execution_status in [RouteStopStatus.ARRIVED, RouteStopStatus.IN_PROGRESS, RouteStopStatus.COMPLETED]))
    s5_completed = stop_arrived or pickup.status == PickupStatus.COLLECTED
    s5_current = s4_completed and not s5_completed and not is_cancelled and not is_failed
    stages.append(
        PickupTimelineStage(
            stage_id="DRIVER_ARRIVED",
            name="Driver Arrived",
            state="COMPLETED" if s5_completed else ("CURRENT" if s5_current else "UPCOMING"),
            timestamp=route_stop.arrived_at if route_stop else None,
            description=f"Driver arrived at customer location: {pickup.location.name if pickup.location else 'Facility'}" if s5_completed else "Driver arrival pending",
            actor=driver_name if s5_completed else None,
            metadata={"arrived_at": route_stop.arrived_at.isoformat() if route_stop and route_stop.arrived_at else None},
        )
    )

    # 6. Collection Started (QR Verified)
    qr_done = bool(pickup.qr_verified_at is not None)
    s6_completed = qr_done or pickup.status == PickupStatus.COLLECTED
    s6_current = s5_completed and not s6_completed and not is_cancelled and not is_failed
    stages.append(
        PickupTimelineStage(
            stage_id="COLLECTION_STARTED",
            name="Collection Started",
            state="COMPLETED" if s6_completed else ("CURRENT" if s6_current else "UPCOMING"),
            timestamp=pickup.qr_verified_at,
            description="Facility QR code scanned and authenticated on-site" if s6_completed else "On-site QR verification pending",
            actor=driver_name if s6_completed else None,
            metadata={"qr_verified_at": pickup.qr_verified_at.isoformat() if pickup.qr_verified_at else None},
        )
    )

    # 7. Weight Recorded
    weight_done = bool(route_stop and route_stop.collected_weight_kg is not None)
    s7_completed = weight_done or pickup.status == PickupStatus.COLLECTED
    s7_current = s6_completed and not s7_completed and not is_cancelled and not is_failed
    stages.append(
        PickupTimelineStage(
            stage_id="WEIGHT_RECORDED",
            name="Weight Recorded",
            state="COMPLETED" if s7_completed else ("CURRENT" if s7_current else "UPCOMING"),
            timestamp=(route_stop.completed_at or route_stop.arrived_at or pickup.updated_at) if (weight_done and route_stop) else None,
            description=f"Net collected biomedical waste: {float(route_stop.collected_weight_kg):.2f} kg" if (weight_done and route_stop and route_stop.collected_weight_kg is not None) else "Weighing pending",
            actor=driver_name if s7_completed else None,
            metadata={"collected_weight_kg": float(route_stop.collected_weight_kg) if (weight_done and route_stop and route_stop.collected_weight_kg is not None) else None},
        )
    )

    # 8. Customer Handover Confirmed (Photo Evidence & QR)
    has_proof = bool(route_stop and route_stop.proof_storage_path is not None)
    s8_completed = (qr_done and (has_proof or weight_done)) or pickup.status == PickupStatus.COLLECTED
    s8_current = s7_completed and not s8_completed and not is_cancelled and not is_failed
    stages.append(
        PickupTimelineStage(
            stage_id="CUSTOMER_HANDOVER",
            name="Customer Handover Confirmed",
            state="COMPLETED" if s8_completed else ("CURRENT" if s8_current else "UPCOMING"),
            timestamp=route_stop.proof_uploaded_at if (has_proof and route_stop) else (pickup.qr_verified_at if s8_completed else None),
            description="Waste packaging verified and handover confirmed" if s8_completed else "Handover confirmation pending",
            actor="Customer & Driver" if s8_completed else None,
            metadata={"has_proof": has_proof},
        )
    )

    # 9. Payment Completed
    is_paid = bool(invoice and invoice.status == "PAID")
    s9_completed = is_paid or pickup.status == PickupStatus.COLLECTED
    s9_current = s8_completed and not s9_completed and not is_cancelled and not is_failed
    stages.append(
        PickupTimelineStage(
            stage_id="PAYMENT_COMPLETED",
            name="Payment Completed",
            state="COMPLETED" if s9_completed else ("CURRENT" if s9_current else "UPCOMING"),
            timestamp=(payment.paid_at if payment else (invoice.updated_at if is_paid and invoice else None)) if s9_completed else None,
            description=f"Invoice #{invoice.invoice_number} paid (₹{float(invoice.total_amount):.2f})" if (is_paid and invoice) else "Payment settlement pending",
            actor="Billing Gateway" if s9_completed else None,
            metadata={"invoice_status": invoice.status if invoice else None},
        )
    )

    # 10. OTP Verified
    otp_done = bool(pickup.otp_verified_at is not None)
    s10_completed = otp_done or pickup.status == PickupStatus.COLLECTED
    s10_current = s9_completed and not s10_completed and not is_cancelled and not is_failed
    stages.append(
        PickupTimelineStage(
            stage_id="OTP_VERIFIED",
            name="OTP Verified",
            state="COMPLETED" if s10_completed else ("CURRENT" if s10_current else "UPCOMING"),
            timestamp=pickup.otp_verified_at,
            description="Customer digital OTP verified and signature recorded" if s10_completed else "Customer OTP authorization pending",
            actor="Customer" if s10_completed else None,
            metadata={"otp_verified_at": pickup.otp_verified_at.isoformat() if pickup.otp_verified_at else None},
        )
    )

    # 11. Pickup Completed
    s11_completed = pickup.status == PickupStatus.COLLECTED
    s11_current = s10_completed and not s11_completed and not is_cancelled and not is_failed
    stages.append(
        PickupTimelineStage(
            stage_id="PICKUP_COMPLETED",
            name="Pickup Completed",
            state="COMPLETED" if s11_completed else ("CURRENT" if s11_current else "UPCOMING"),
            timestamp=pickup.collected_at or (route_stop.completed_at if route_stop else None),
            description="Biomedical waste sealed, invoiced, and in transit to warehouse" if s11_completed else "Final completion pending",
            actor="Pharmatrix System" if s11_completed else None,
            metadata={"collected_at": pickup.collected_at.isoformat() if pickup.collected_at else None},
        )
    )

    # Handle exception state: Cancelled or Failed
    if is_cancelled:
        # Override remaining or mark cancellation
        stages.append(
            PickupTimelineStage(
                stage_id="CANCELLED",
                name="Pickup Cancelled",
                state="CANCELLED",
                timestamp=pickup.updated_at,
                description=f"Cancelled: {pickup.failure_reason or 'Cancelled by user or administrator'}",
                actor="Admin / Customer",
                metadata={"reason": pickup.failure_reason},
            )
        )
        return stages, 0, "Cancelled"

    if is_failed:
        stages.append(
            PickupTimelineStage(
                stage_id="FAILED",
                name="Pickup Failed",
                state="FAILED",
                timestamp=pickup.updated_at,
                description=f"Failed: {pickup.failure_reason or 'Collection failed'}",
                actor="Driver / Field Ops",
                metadata={"reason": pickup.failure_reason},
            )
        )
        return stages, 0, "Failed"

    # Calculate completed stages and percentage
    completed_count = sum(1 for s in stages if s.state == "COMPLETED")
    total_stages = len(stages)
    progress_percent = int(round((completed_count / float(total_stages)) * 100.0))

    # Determine current stage name
    current_stage = next((s for s in stages if s.state == "CURRENT"), None)
    if not current_stage:
        if s11_completed:
            current_stage_name = "Completed"
        else:
            current_stage_name = stages[0].name
    else:
        current_stage_name = current_stage.name

    return stages, progress_percent, current_stage_name


def build_pickup_monitoring_detail(
    db: Session,
    pickup: Pickup,
) -> PickupMonitoringDetailResponse:
    """
    Assembles complete, authoritative pickup monitoring details
    from existing backend models and verification tables.
    """
    now = datetime.now(timezone.utc)
    route_stop, route = get_active_route_stop_for_pickup(pickup)

    # Invoices & Payments
    invoice = db.query(Invoice).filter(Invoice.pickup_id == pickup.id).first()
    payment = (
        db.query(Payment)
        .filter(Payment.invoice_id == invoice.id)
        .order_by(Payment.created_at.desc())
        .first()
        if invoice
        else None
    )
    razorpay_order = (
        db.query(RazorpayOrder)
        .filter(RazorpayOrder.invoice_id == invoice.id)
        .first()
        if invoice
        else None
    )

    # Compute delays and exceptions
    is_delayed, delay_reasons, exceptions_list = compute_pickup_exceptions_and_delays(
        pickup, route_stop, route, invoice, now
    )

    # Compute timeline
    timeline, progress_pct, current_stage_name = compute_lifecycle_timeline(
        pickup, route_stop, route, invoice, payment
    )

    # Customer info
    cust = pickup.customer
    loc = pickup.location
    customer_info = PickupCustomerInfo(
        id=cust.id if cust else 0,
        display_name=cust.display_name if cust else "Unknown Customer",
        legal_name=cust.legal_name if cust else None,
        customer_type=cust.customer_type.value if (cust and cust.customer_type) else "PHARMACY",
        contact_name=getattr(loc, "contact_name", None) or (cust.display_name if cust else None),
        phone=getattr(loc, "contact_phone", None) or (cust.phone if cust else None),
        email=getattr(cust, "email", None) or (cust.user.email if (cust and cust.user) else None),
        location_id=loc.id if loc else 0,
        location_name=loc.name if loc else None,
        address=f"{loc.address_line_1}{', ' + loc.address_line_2 if loc and loc.address_line_2 else ''}" if loc else None,
        city=loc.city if loc else None,
        state=loc.state if loc else None,
        postal_code=loc.postal_code if loc else None,
        latitude=float(loc.latitude) if (loc and loc.latitude is not None) else None,
        longitude=float(loc.longitude) if (loc and loc.longitude is not None) else None,
    )

    # Driver & Vehicle Info
    driver_info = None
    if route and route.driver:
        drv = route.driver
        drv_user = drv.user
        veh = route.vehicle

        veh_info = None
        if veh:
            veh_info = PickupVehicleInfo(
                id=veh.id,
                registration_number=veh.registration_number,
                model=getattr(veh, "model", None),
                vehicle_type=veh.vehicle_type.value if getattr(veh, "vehicle_type", None) else None,
                capacity_kg=float(veh.capacity_kg) if getattr(veh, "capacity_kg", None) else None,
            )

        # GPS Live Location Evaluation
        drv_lat = getattr(drv, "current_latitude", None)
        drv_lng = getattr(drv, "current_longitude", None)
        last_loc_upd = _ensure_utc(getattr(drv, "last_location_update", None))

        is_live = False
        dist_m = None
        unavail_reason = None

        if drv_lat is not None and drv_lng is not None:
            # Check staleness: within last 15 minutes is considered live
            if last_loc_upd and (now - last_loc_upd).total_seconds() < 900:
                is_live = True
            if loc and loc.latitude is not None and loc.longitude is not None:
                dist_m = haversine_distance_m(drv_lat, drv_lng, float(loc.latitude), float(loc.longitude))
        else:
            if route.status == RouteStatus.IN_PROGRESS:
                unavail_reason = "Driver device GPS coordinates not yet transmitted during this active route."
            else:
                unavail_reason = "Route is not yet in progress; driver GPS tracking will activate upon route dispatch."

        driver_info = PickupDriverInfo(
            id=drv.id,
            employee_id=drv.employee_id,
            name=drv_user.name if drv_user else drv.employee_id,
            phone=drv.phone or getattr(drv_user, "phone", None),
            status=drv.status.value,
            assigned_at=route.created_at,
            arrived_at=route_stop.arrived_at if route_stop else None,
            vehicle=veh_info,
            current_latitude=float(drv_lat) if drv_lat is not None else None,
            current_longitude=float(drv_lng) if drv_lng is not None else None,
            last_location_update=last_loc_upd,
            distance_to_pickup_meters=round(dist_m, 1) if dist_m is not None else None,
            location_live=is_live,
            location_unavailable_reason=unavail_reason,
        )

    # Collection Info
    proof_url = None
    if route_stop and route_stop.proof_storage_path:
        proof_url = get_cached_signed_proof_url(route_stop.proof_storage_path, expires_in=3600)

    est_wt = float(pickup.estimated_weight_kg) if pickup.estimated_weight_kg is not None else None
    act_wt = (
        float(route_stop.collected_weight_kg)
        if route_stop and route_stop.collected_weight_kg is not None
        else None
    )

    diff_kg = None
    diff_pct = None
    if act_wt is not None and est_wt is not None:
        diff_kg = round(act_wt - est_wt, 2)
        diff_pct = round((diff_kg / est_wt * 100.0) if est_wt > 0 else 0.0, 1)

    collection_info = PickupCollectionInfo(
        stop_id=route_stop.id if route_stop else None,
        execution_status=route_stop.execution_status.value if route_stop else None,
        collection_start_time=pickup.qr_verified_at or (route_stop.arrived_at if route_stop else None),
        collection_completion_time=route_stop.completed_at if route_stop else pickup.collected_at,
        estimated_weight_kg=est_wt,
        actual_collected_weight_kg=act_wt,
        weight_discrepancy_kg=diff_kg,
        weight_discrepancy_percent=diff_pct,
        waste_condition_remarks=pickup.notes,
        has_collection_proof=bool(route_stop and route_stop.proof_storage_path),
        proof_url=proof_url,
        proof_uploaded_at=route_stop.proof_uploaded_at if route_stop else None,
        qr_verified=bool(pickup.qr_verified_at is not None),
        qr_verified_at=pickup.qr_verified_at,
    )

    # Payment Info
    payment_status = "NOT_REQUIRED"
    if invoice:
        if invoice.status == "PAID":
            payment_status = "PAID"
        elif invoice.status == "ISSUED":
            payment_status = "PENDING"
        elif invoice.status in ["VOID", "CANCELLED"]:
            payment_status = "FAILED"
        else:
            payment_status = invoice.status
    elif act_wt or pickup.status == PickupStatus.COLLECTED:
        payment_status = "PENDING"

    line_items_data = []
    if invoice and invoice.line_items:
        for li in invoice.line_items:
            line_items_data.append({
                "item_type": li.item_type,
                "description": li.description,
                "quantity": float(li.quantity),
                "unit_price": float(li.unit_price),
                "amount": float(li.amount),
            })

    payment_info = PickupPaymentInfo(
        invoice_id=invoice.id if invoice else None,
        invoice_number=invoice.invoice_number if invoice else None,
        invoice_status=invoice.status if invoice else None,
        subtotal=float(invoice.subtotal) if invoice and invoice.subtotal is not None else None,
        tax_amount=float(invoice.tax_amount) if invoice and invoice.tax_amount is not None else None,
        total_amount=float(invoice.total_amount) if invoice and invoice.total_amount is not None else None,
        amount_paid=float(invoice.amount_paid) if invoice and invoice.amount_paid is not None else None,
        payment_status=payment_status,
        razorpay_order_id=razorpay_order.razorpay_order_id if razorpay_order else None,
        razorpay_payment_id=razorpay_order.razorpay_payment_id if razorpay_order else None,
        payment_method=payment.payment_method if payment else ("RAZORPAY" if razorpay_order else None),
        payment_initiated_at=razorpay_order.created_at if razorpay_order else (invoice.created_at if invoice else None),
        payment_completed_at=payment.paid_at if payment else (invoice.updated_at if invoice and invoice.status == "PAID" else None),
        failure_details=None,
        pricing_snapshot=invoice.pricing_snapshot if invoice else None,
        line_items=line_items_data,
    )

    # OTP Info (Crucially: NEVER expose otp_hash or actual OTP code)
    otp_exp = _ensure_utc(pickup.otp_expires_at)
    otp_ver = _ensure_utc(pickup.otp_verified_at)
    otp_info = PickupOtpVerificationInfo(
        otp_generated=bool(pickup.otp_hash is not None or pickup.otp_verified_at is not None),
        otp_expires_at=otp_exp,
        verification_status=(
            "VERIFIED"
            if otp_ver
            else (
                "EXPIRED"
                if otp_exp and now > otp_exp
                else ("PENDING" if pickup.otp_hash else "NOT_GENERATED")
            )
        ),
        verification_timestamp=otp_ver,
        attempts_count=pickup.otp_attempts,
    )

    # Completion Info
    duration_mins = None
    if pickup.collected_at and pickup.created_at:
        c_at = _ensure_utc(pickup.collected_at)
        cr_at = _ensure_utc(pickup.created_at)
        if c_at and cr_at:
            duration_mins = int((c_at - cr_at).total_seconds() // 60)

    completion_info = PickupCompletionInfo(
        final_status=pickup.status.value,
        completion_timestamp=pickup.collected_at or (route_stop.completed_at if route_stop else None),
        total_duration_minutes=duration_mins,
        final_collected_weight_kg=act_wt,
        final_payment_status=payment_status,
        invoice_number=invoice.invoice_number if invoice else None,
        facility_handover_status="RECEIVED_IN_TRANSIT" if pickup.status == PickupStatus.COLLECTED else "PENDING",
    )

    # Complete chronological event log
    raw_events = get_chronological_pickup_events(db, pickup)
    event_items = [
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

    return PickupMonitoringDetailResponse(
        pickup_id=pickup.id,
        public_id=pickup.public_id,
        pickup_code=pickup.pickup_code,
        status=pickup.status.value,
        priority=pickup.priority.value,
        requested_date=pickup.requested_date,
        scheduled_date=pickup.scheduled_date,
        notes=pickup.notes,
        failure_reason=pickup.failure_reason,
        created_at=pickup.created_at,
        updated_at=pickup.updated_at,
        customer=customer_info,
        driver=driver_info,
        route_id=route.id if route else None,
        route_code=route.route_code if route else None,
        route_status=route.status.value if route else None,
        collection=collection_info,
        payment=payment_info,
        otp=otp_info,
        completion=completion_info,
        timeline=timeline,
        progress_percent=progress_pct,
        current_stage_name=current_stage_name,
        is_delayed=is_delayed,
        delay_reasons=delay_reasons,
        exceptions=exceptions_list,
        events=event_items,
        server_time=now,
    )


def list_pickup_monitoring(
    db: Session,
    page: int = 1,
    page_size: int = 20,
    search: str | None = None,
    status_filter: str | None = None,
    customer_type: str | None = None,
    driver_id: int | None = None,
    start_date: datetime | None = None,
    end_date: datetime | None = None,
    delayed_only: bool = False,
) -> PickupMonitoringListResponse:
    """
    Searchable, filterable list of all pickups with summary counters and pagination.
    """
    now = datetime.now(timezone.utc)
    query = (
        db.query(Pickup)
        .options(
            joinedload(Pickup.customer).joinedload(Customer.user),
            joinedload(Pickup.location),
            joinedload(Pickup.route_stops).joinedload(RouteStop.route).joinedload(Route.driver).joinedload(Driver.user),
        )
    )

    if status_filter and status_filter != "ALL":
        try:
            ps = PickupStatus[status_filter.upper()]
            query = query.filter(Pickup.status == ps)
        except KeyError:
            pass

    if customer_type and customer_type != "ALL":
        query = query.join(Customer, Customer.id == Pickup.customer_id).filter(
            Customer.customer_type == customer_type.upper()
        )

    if driver_id:
        query = (
            query.join(RouteStop, RouteStop.pickup_id == Pickup.id)
            .join(Route, Route.id == RouteStop.route_id)
            .filter(Route.driver_id == driver_id)
        )

    if start_date:
        query = query.filter(Pickup.created_at >= start_date)
    if end_date:
        query = query.filter(Pickup.created_at <= end_date)

    if search and search.strip():
        term = f"%{search.strip()}%"
        query = (
            query.outerjoin(Customer, Customer.id == Pickup.customer_id)
            .outerjoin(RouteStop, RouteStop.pickup_id == Pickup.id)
            .outerjoin(Route, Route.id == RouteStop.route_id)
            .outerjoin(Driver, Driver.id == Route.driver_id)
            .outerjoin(User, User.id == Driver.user_id)
            .filter(
                or_(
                    Pickup.pickup_code.ilike(term),
                    Customer.display_name.ilike(term),
                    Customer.legal_name.ilike(term),
                    User.name.ilike(term),
                    Driver.employee_id.ilike(term),
                )
            )
        )

    # Compute summary counters across entire system
    total_all = db.query(Pickup).count()
    req_count = db.query(Pickup).filter(Pickup.status == PickupStatus.REQUESTED).count()
    sched_count = db.query(Pickup).filter(Pickup.status == PickupStatus.SCHEDULED).count()
    prog_count = db.query(Pickup).filter(Pickup.status == PickupStatus.IN_PROGRESS).count()
    col_count = db.query(Pickup).filter(Pickup.status == PickupStatus.COLLECTED).count()
    canc_count = db.query(Pickup).filter(Pickup.status == PickupStatus.CANCELLED).count()
    fail_count = db.query(Pickup).filter(Pickup.status == PickupStatus.FAILED).count()

    total_matching = query.count()
    total_pages = max(1, (total_matching + page_size - 1) // page_size)
    offset = (page - 1) * page_size
    pickups = (
        query.order_by(Pickup.created_at.desc())
        .offset(offset)
        .limit(page_size)
        .all()
    )

    items: list[PickupMonitoringItem] = []
    delayed_count = 0

    for p in pickups:
        route_stop, route = get_active_route_stop_for_pickup(p)
        driver = route.driver if route else None
        driver_user = driver.user if driver else None
        driver_name = driver_user.name if driver_user else (driver.employee_id if driver else None)
        driver_phone = driver.phone if driver else (driver_user.phone if driver_user else None)

        invoice = db.query(Invoice).filter(Invoice.pickup_id == p.id).first()
        is_delayed, delay_reasons, _ = compute_pickup_exceptions_and_delays(
            p, route_stop, route, invoice, now
        )
        if is_delayed:
            delayed_count += 1

        if delayed_only and not is_delayed:
            continue

        _, progress_pct, current_stage_name = compute_lifecycle_timeline(
            p, route_stop, route, invoice, None
        )

        payment_status = "NOT_REQUIRED"
        if invoice:
            payment_status = invoice.status
        elif p.status == PickupStatus.COLLECTED:
            payment_status = "PENDING"

        collected_weight = (
            float(route_stop.collected_weight_kg)
            if route_stop and route_stop.collected_weight_kg is not None
            else None
        )

        items.append(
            PickupMonitoringItem(
                id=p.id,
                public_id=p.public_id,
                pickup_code=p.pickup_code,
                customer_id=p.customer_id,
                customer_name=p.customer.display_name if p.customer else None,
                customer_type=p.customer.customer_type.value if (p.customer and p.customer.customer_type) else None,
                location_id=p.location_id,
                location_name=p.location.name if p.location else None,
                location_address=f"{p.location.address_line_1}, {p.location.city}" if p.location else None,
                latitude=float(p.location.latitude) if (p.location and p.location.latitude is not None) else None,
                longitude=float(p.location.longitude) if (p.location and p.location.longitude is not None) else None,
                status=p.status.value,
                priority=p.priority.value,
                requested_date=p.requested_date,
                scheduled_date=p.scheduled_date,
                collected_at=p.collected_at,
                estimated_weight_kg=float(p.estimated_weight_kg) if p.estimated_weight_kg is not None else None,
                collected_weight_kg=collected_weight,
                driver_id=driver.id if driver else None,
                driver_name=driver_name,
                driver_phone=driver_phone,
                route_id=route.id if route else None,
                route_code=route.route_code if route else None,
                route_status=route.status.value if route else None,
                payment_status=payment_status,
                invoice_total=float(invoice.total_amount) if invoice and invoice.total_amount is not None else None,
                has_exceptions=bool(delay_reasons),
                is_delayed=is_delayed,
                delay_reasons=delay_reasons,
                current_stage=current_stage_name,
                progress_percent=progress_pct,
                created_at=p.created_at,
                updated_at=p.updated_at,
            )
        )

    summary = {
        "total": total_all,
        "requested": req_count,
        "scheduled": sched_count,
        "in_progress": prog_count,
        "completed": col_count,
        "cancelled": canc_count,
        "failed": fail_count,
        "delayed": delayed_count,
    }

    return PickupMonitoringListResponse(
        items=items,
        total=total_matching,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
        summary_counts=summary,
    )


def get_driver_live_location_for_pickup(
    db: Session,
    pickup: Pickup,
) -> DriverLiveLocationResponse:
    """
    Returns latest GPS coordinates for driver assigned to this pickup.
    Never fabricates coordinates; transparently explains if unavailable.
    """
    now = datetime.now(timezone.utc)
    route_stop, route = get_active_route_stop_for_pickup(pickup)

    if not route or not route.driver:
        return DriverLiveLocationResponse(
            unavailable_reason="No driver or route currently assigned to this pickup."
        )

    drv = route.driver
    drv_user = drv.user
    veh = route.vehicle

    drv_lat = getattr(drv, "current_latitude", None)
    drv_lng = getattr(drv, "current_longitude", None)
    last_upd = _ensure_utc(getattr(drv, "last_location_update", None))

    loc = pickup.location
    pickup_lat = float(loc.latitude) if (loc and loc.latitude is not None) else None
    pickup_lng = float(loc.longitude) if (loc and loc.longitude is not None) else None

    is_live = False
    dist_m = None
    unavail = None

    if drv_lat is not None and drv_lng is not None:
        if last_upd and (now - last_upd).total_seconds() < 900:
            is_live = True
        if pickup_lat is not None and pickup_lng is not None:
            dist_m = haversine_distance_m(drv_lat, drv_lng, pickup_lat, pickup_lng)
    else:
        if route.status == RouteStatus.IN_PROGRESS:
            unavail = "Driver mobile app has not yet transmitted live GPS telemetry."
        else:
            unavail = "Route not yet dispatched; driver telemetry activates upon route start."

    return DriverLiveLocationResponse(
        driver_id=drv.id,
        driver_name=drv_user.name if drv_user else drv.employee_id,
        phone=drv.phone or getattr(drv_user, "phone", None),
        current_latitude=float(drv_lat) if drv_lat is not None else None,
        current_longitude=float(drv_lng) if drv_lng is not None else None,
        last_location_update=last_upd,
        is_live=is_live,
        pickup_latitude=pickup_lat,
        pickup_longitude=pickup_lng,
        distance_meters=round(dist_m, 1) if dist_m is not None else None,
        vehicle_registration=veh.registration_number if veh else None,
        vehicle_model=getattr(veh, "model", None) if veh else None,
        unavailable_reason=unavail,
    )


def reassign_pickup_driver(
    db: Session,
    pickup: Pickup,
    driver_id: int,
    vehicle_id: int | None,
    reason: str,
    admin_user: User,
) -> Pickup:
    """
    Safely reassigns driver and vehicle for a pickup's active route,
    recording an immutable audit event and timeline log.
    """
    target_driver = db.query(Driver).filter(Driver.id == driver_id).first()
    if not target_driver:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Target driver not found",
        )

    route_stop, route = get_active_route_stop_for_pickup(pickup)
    if not route:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Pickup is not currently attached to any route. Schedule or optimize into a route first.",
        )

    if route.status in [RouteStatus.COMPLETED, RouteStatus.CANCELLED]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot reassign driver on a {route.status.value} route.",
        )

    old_driver_name = route.driver.employee_id if route.driver else "Unassigned"
    route.driver_id = target_driver.id
    if vehicle_id:
        target_veh = db.query(Vehicle).filter(Vehicle.id == vehicle_id).first()
        if target_veh:
            route.vehicle_id = target_veh.id

    new_driver_name = target_driver.user.name if target_driver.user else target_driver.employee_id

    # Record pickup event
    record_pickup_event(
        db=db,
        pickup_id=pickup.id,
        event_type="DRIVER_ASSIGNMENT_CHANGED",
        title="Driver Assignment Changed",
        description=f"Driver reassigned from {old_driver_name} to {new_driver_name}. Reason: {reason}",
        actor_type="ADMIN",
        actor_id=admin_user.id,
        actor_name=admin_user.full_name or admin_user.name,
        metadata_json={
            "old_driver": old_driver_name,
            "new_driver_id": target_driver.id,
            "new_driver_name": new_driver_name,
            "reason": reason,
            "route_code": route.route_code,
        },
    )

    db.commit()
    db.refresh(pickup)
    return pickup
