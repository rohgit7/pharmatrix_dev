from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any
from sqlalchemy.orm import Session

from app.models.event import PickupEvent
from app.models.audit_log import AuditLog
from app.models.pickup import Pickup
from app.services.audit_service import log_operational_audit

logger = logging.getLogger(__name__)


def record_pickup_event(
    db: Session,
    pickup_id: int,
    event_type: str,
    title: str,
    description: str | None = None,
    actor_type: str = "SYSTEM",
    actor_id: int | None = None,
    actor_name: str | None = None,
    metadata_json: dict[str, Any] | None = None,
    created_at: datetime | None = None,
) -> PickupEvent | None:
    """
    Appends an immutable pickup event to pickup_events table and
    logs to the operational audit log.
    """
    try:
        pickup = db.query(Pickup).filter(Pickup.id == pickup_id).first()
        pickup_code = pickup.pickup_code if pickup else None

        now = created_at or datetime.now(timezone.utc)
        event = PickupEvent(
            pickup_id=pickup_id,
            event_type=event_type.upper(),
            title=title,
            description=description,
            actor_type=actor_type.upper(),
            actor_id=actor_id,
            actor_name=actor_name or (actor_type.title() if actor_type else "System"),
            metadata_json=metadata_json or {},
            created_at=now,
        )
        db.add(event)
        db.flush()

        # Notify active SSE subscribers immediately via live bus
        try:
            from app.core.live_bus import pickup_live_bus
            pickup_live_bus.notify_pickup(pickup_id)
        except Exception:
            pass

        # Mirror to operational audit log
        log_operational_audit(
            db=db,
            action=event_type.upper(),
            entity_type="PICKUP",
            entity_id=pickup_id,
            entity_code=pickup_code,
            actor_id=actor_id,
            actor_name=actor_name,
            details=metadata_json,
            notes=description or title,
        )

        return event
    except Exception as exc:
        logger.error(f"Failed to record pickup event: {exc}", exc_info=True)
        return None


def get_chronological_pickup_events(
    db: Session,
    pickup: Pickup,
) -> list[dict[str, Any]]:
    """
    Aggregates events from:
    1. pickup_events table
    2. audit_logs table (matching entity_id = pickup.id or entity_code = pickup.pickup_code)
    3. actual backend milestones (qr_verified_at, otp_verified_at, stop.arrived_at, etc.)
       if an event was not recorded explicitly.
    Guarantees no duplicate events and chronological ascending order.
    """
    events: list[dict[str, Any]] = []
    seen_keys: set[str] = set()

    # 1. Fetch from pickup_events table
    db_events = (
        db.query(PickupEvent)
        .filter(PickupEvent.pickup_id == pickup.id)
        .order_by(PickupEvent.created_at.asc())
        .all()
    )
    for ev in db_events:
        key = f"{ev.event_type}:{ev.created_at.isoformat()}"
        if key not in seen_keys:
            seen_keys.add(key)
            events.append({
                "id": f"event-{ev.id}",
                "event_type": ev.event_type,
                "title": ev.title,
                "description": ev.description,
                "actor_type": ev.actor_type,
                "actor_id": ev.actor_id,
                "actor_name": ev.actor_name or "System",
                "metadata": ev.metadata_json or {},
                "created_at": ev.created_at.isoformat(),
                "source": "pickup_events",
            })

    # 2. Fetch from audit_logs table
    audit_logs = (
        db.query(AuditLog)
        .filter(
            AuditLog.entity_type == "PICKUP",
            (AuditLog.entity_id == str(pickup.id)) | (AuditLog.notes.contains(pickup.pickup_code)),
        )
        .order_by(AuditLog.created_at.asc())
        .all()
    )
    for al in audit_logs:
        # Check if already in seen_keys
        key = f"{al.action}:{al.created_at.isoformat()}"
        type_key = f"{al.action}:{al.created_at.strftime('%Y-%m-%d %H:%M')}"
        if key not in seen_keys and type_key not in seen_keys:
            seen_keys.add(key)
            seen_keys.add(type_key)
            events.append({
                "id": f"audit-{al.id}",
                "event_type": al.action,
                "title": al.action.replace("_", " ").title(),
                "description": al.notes or (al.new_values.get("note") if al.new_values else None),
                "actor_type": "USER" if al.actor_id else "SYSTEM",
                "actor_id": al.actor_id,
                "actor_name": al.actor_name or al.actor_email or "System",
                "metadata": al.details or {},
                "created_at": al.created_at.isoformat(),
                "source": "audit_logs",
            })

    # 3. Reconcile verified historical milestones if missing from event logs
    # e.g. Pickup requested
    created_key = f"PICKUP_REQUESTED:{pickup.created_at.strftime('%Y-%m-%d %H:%M')}"
    if "PICKUP_REQUESTED" not in [e["event_type"] for e in events]:
        seen_keys.add(created_key)
        events.append({
            "id": f"milestone-requested-{pickup.id}",
            "event_type": "PICKUP_REQUESTED",
            "title": "Pickup Requested",
            "description": f"Pickup request registered for {pickup.customer.display_name if pickup.customer else 'customer'}",
            "actor_type": "CUSTOMER",
            "actor_id": pickup.customer.user_id if pickup.customer else None,
            "actor_name": pickup.customer.display_name if pickup.customer else "Customer",
            "metadata": {
                "pickup_code": pickup.pickup_code,
                "estimated_weight_kg": float(pickup.estimated_weight_kg) if pickup.estimated_weight_kg else None,
                "priority": pickup.priority.value,
            },
            "created_at": pickup.created_at.isoformat(),
            "source": "milestone",
        })

    # Scheduled date milestone
    if pickup.scheduled_date and "PICKUP_SCHEDULED" not in [e["event_type"] for e in events]:
        events.append({
            "id": f"milestone-scheduled-{pickup.id}",
            "event_type": "PICKUP_SCHEDULED",
            "title": "Pickup Scheduled",
            "description": f"Scheduled for operational dispatch on {pickup.scheduled_date.strftime('%Y-%m-%d %H:%M UTC')}",
            "actor_type": "SYSTEM",
            "actor_id": None,
            "actor_name": "Operations Engine",
            "metadata": {
                "scheduled_date": pickup.scheduled_date.isoformat(),
            },
            "created_at": (pickup.updated_at if pickup.updated_at > pickup.created_at else pickup.created_at).isoformat(),
            "source": "milestone",
        })

    # Active route stop milestones
    active_stop = None
    if pickup.route_stops:
        for stop in pickup.route_stops:
            if stop.route and stop.route.status.value != "CANCELLED":
                active_stop = stop
                break

    if active_stop and active_stop.route:
        route = active_stop.route
        driver = route.driver
        driver_user = driver.user if driver else None
        driver_name = driver_user.name if driver_user else (driver.employee_id if driver else "Assigned Driver")

        # Driver assigned
        if driver and "DRIVER_ASSIGNED" not in [e["event_type"] for e in events]:
            assigned_dt = route.created_at or pickup.created_at
            events.append({
                "id": f"milestone-driver-assigned-{pickup.id}",
                "event_type": "DRIVER_ASSIGNED",
                "title": "Driver Assigned",
                "description": f"Assigned to driver {driver_name} (Route: {route.route_code})",
                "actor_type": "ADMIN",
                "actor_id": None,
                "actor_name": "Dispatch Controller",
                "metadata": {
                    "route_code": route.route_code,
                    "driver_id": driver.id,
                    "driver_name": driver_name,
                },
                "created_at": assigned_dt.isoformat(),
                "source": "milestone",
            })

        # Route started / en route
        if route.status.value in ["IN_PROGRESS", "COMPLETED"] and "DRIVER_STARTED_ROUTE" not in [e["event_type"] for e in events]:
            route_started_dt = active_stop.arrived_at or route.updated_at or route.created_at
            events.append({
                "id": f"milestone-route-started-{pickup.id}",
                "event_type": "DRIVER_STARTED_ROUTE",
                "title": "Driver En Route",
                "description": f"Driver {driver_name} commenced route dispatch {route.route_code}",
                "actor_type": "DRIVER",
                "actor_id": driver_user.id if driver_user else None,
                "actor_name": driver_name,
                "metadata": {
                    "route_id": route.id,
                    "route_code": route.route_code,
                },
                "created_at": route_started_dt.isoformat(),
                "source": "milestone",
            })

        # Driver arrived
        if active_stop.arrived_at and "DRIVER_ARRIVED" not in [e["event_type"] for e in events]:
            events.append({
                "id": f"milestone-driver-arrived-{pickup.id}",
                "event_type": "DRIVER_ARRIVED",
                "title": "Driver Arrived",
                "description": f"Driver {driver_name} arrived at customer facility {pickup.location.name if pickup.location else ''}",
                "actor_type": "DRIVER",
                "actor_id": driver_user.id if driver_user else None,
                "actor_name": driver_name,
                "metadata": {
                    "stop_id": active_stop.id,
                    "arrived_at": active_stop.arrived_at.isoformat(),
                },
                "created_at": active_stop.arrived_at.isoformat(),
                "source": "milestone",
            })

        # QR Verified / Collection Started
        if pickup.qr_verified_at and "COLLECTION_STARTED" not in [e["event_type"] for e in events] and "QR_VERIFIED" not in [e["event_type"] for e in events]:
            events.append({
                "id": f"milestone-qr-verified-{pickup.id}",
                "event_type": "COLLECTION_STARTED",
                "title": "Collection Started & QR Verified",
                "description": "Driver scanned and verified customer facility QR code",
                "actor_type": "DRIVER",
                "actor_id": driver_user.id if driver_user else None,
                "actor_name": driver_name,
                "metadata": {
                    "qr_verified_at": pickup.qr_verified_at.isoformat(),
                },
                "created_at": pickup.qr_verified_at.isoformat(),
                "source": "milestone",
            })

        # Weight recorded
        if active_stop.collected_weight_kg is not None and "WEIGHT_RECORDED" not in [e["event_type"] for e in events]:
            weight_dt = active_stop.completed_at or active_stop.arrived_at or pickup.updated_at
            events.append({
                "id": f"milestone-weight-recorded-{pickup.id}",
                "event_type": "WEIGHT_RECORDED",
                "title": "Weight Recorded",
                "description": f"Waste collected and weighed: {float(active_stop.collected_weight_kg):.2f} kg",
                "actor_type": "DRIVER",
                "actor_id": driver_user.id if driver_user else None,
                "actor_name": driver_name,
                "metadata": {
                    "collected_weight_kg": float(active_stop.collected_weight_kg),
                    "estimated_weight_kg": float(pickup.estimated_weight_kg) if pickup.estimated_weight_kg else None,
                },
                "created_at": weight_dt.isoformat(),
                "source": "milestone",
            })

        # OTP Verified
        if pickup.otp_verified_at and "OTP_VERIFIED" not in [e["event_type"] for e in events]:
            events.append({
                "id": f"milestone-otp-verified-{pickup.id}",
                "event_type": "OTP_VERIFIED",
                "title": "OTP Verified",
                "description": "Customer authorized collection via one-time secure passcode",
                "actor_type": "CUSTOMER",
                "actor_id": pickup.customer.user_id if pickup.customer else None,
                "actor_name": pickup.customer.display_name if pickup.customer else "Customer",
                "metadata": {
                    "otp_verified_at": pickup.otp_verified_at.isoformat(),
                    "attempts": pickup.otp_attempts,
                },
                "created_at": pickup.otp_verified_at.isoformat(),
                "source": "milestone",
            })

        # Collection Proof Uploaded
        if active_stop.proof_storage_path and "PROOF_UPLOADED" not in [e["event_type"] for e in events]:
            proof_dt = active_stop.proof_uploaded_at or active_stop.completed_at or pickup.updated_at
            events.append({
                "id": f"milestone-proof-uploaded-{pickup.id}",
                "event_type": "PROOF_UPLOADED",
                "title": "Collection Evidence Uploaded",
                "description": "Driver photographed and submitted sealed bag/bin evidence",
                "actor_type": "DRIVER",
                "actor_id": driver_user.id if driver_user else None,
                "actor_name": driver_name,
                "metadata": {
                    "proof_uploaded_at": proof_dt.isoformat(),
                },
                "created_at": proof_dt.isoformat(),
                "source": "milestone",
            })

        # Pickup completed
        if pickup.status.value == "COLLECTED" and "PICKUP_COMPLETED" not in [e["event_type"] for e in events]:
            comp_dt = pickup.collected_at or active_stop.completed_at or pickup.updated_at
            events.append({
                "id": f"milestone-completed-{pickup.id}",
                "event_type": "PICKUP_COMPLETED",
                "title": "Pickup Completed",
                "description": "Waste successfully collected, weighed, verified and signed off",
                "actor_type": "SYSTEM",
                "actor_id": None,
                "actor_name": "Pharmatrix Ops",
                "metadata": {
                    "collected_at": comp_dt.isoformat(),
                    "final_weight_kg": float(active_stop.collected_weight_kg) if active_stop.collected_weight_kg is not None else None,
                },
                "created_at": comp_dt.isoformat(),
                "source": "milestone",
            })

    # Failed or Cancelled states
    if pickup.status.value == "FAILED" and "PICKUP_FAILED" not in [e["event_type"] for e in events]:
        events.append({
            "id": f"milestone-failed-{pickup.id}",
            "event_type": "PICKUP_FAILED",
            "title": "Pickup Failed",
            "description": f"Pickup execution failed: {pickup.failure_reason or 'Reason unspecified'}",
            "actor_type": "DRIVER",
            "actor_id": None,
            "actor_name": "Field Operations",
            "metadata": {
                "failure_reason": pickup.failure_reason,
            },
            "created_at": pickup.updated_at.isoformat(),
            "source": "milestone",
        })
    elif pickup.status.value == "CANCELLED" and "PICKUP_CANCELLED" not in [e["event_type"] for e in events]:
        events.append({
            "id": f"milestone-cancelled-{pickup.id}",
            "event_type": "PICKUP_CANCELLED",
            "title": "Pickup Cancelled",
            "description": f"Pickup was cancelled: {pickup.failure_reason or 'Cancelled by user or administrator'}",
            "actor_type": "ADMIN",
            "actor_id": None,
            "actor_name": "Operations Admin",
            "metadata": {
                "cancel_reason": pickup.failure_reason,
            },
            "created_at": pickup.updated_at.isoformat(),
            "source": "milestone",
        })

    # Sort all events chronologically ascending
    events.sort(key=lambda x: x["created_at"])
    return events

