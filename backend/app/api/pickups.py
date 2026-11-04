from datetime import datetime, timezone
from decimal import Decimal
import math
from typing import Any
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, Header, HTTPException, Query, Request
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload
from sqlalchemy.orm.attributes import flag_modified

from app.core.auth import get_current_user, require_role
from app.core.database import get_db
from app.core.rate_limiter import limiter
from app.models.customer import Customer
from app.models.driver import Driver
from app.models.enums import (
    PickupPriority,
    PickupStatus,
    RouteStopStatus,
    UserRole,
    WasteBinColor,
    WasteType,
)
from app.models.invoice import Invoice
from app.models.payment import Payment
from app.models.pickup import Pickup
from app.models.razorpay_order import RazorpayOrder
from app.models.route import Route
from app.models.route_stop import RouteStop
from app.models.user import User
from app.schemas.pickup import (
    PickupCancelRequest,
    PickupCreate,
    PickupHandoverConfirmRequest,
    PickupResponse,
)
from app.schemas.pickup_verification import (
    PickupVerificationResponse,
    RequestOTPResponse,
)
from app.schemas.razorpay import RazorpayPaymentVerificationRequest
from app.services.configuration_runtime_service import get_active_version
from app.services.customer_service import ensure_customer_pricing_assignment
from app.services.invoice_service import InvoiceError, create_pickup_invoice
from app.services.pickup_service import (
    cancel_pickup,
    create_pickup,
    get_customer_pickup,
    list_customer_pickups,
)
from app.services.pickup_verification_service import (
    OTP_REQUEST_COOLDOWN_SECONDS,
    get_verification_details,
    request_otp,
)
from app.services.razorpay_service import (
    create_razorpay_order,
    verify_razorpay_payment,
)

router = APIRouter(
    prefix="/api/pickups",
    tags=["Pickups"],
)

WASTE_CATEGORIES_CATALOG = [
    {
        "code": WasteType.EXPIRED_DISCARDED_MEDICINE.value,
        "name": "Expired & Discarded Medicines",
        "bin_color": WasteBinColor.YELLOW.value,
        "description": "Outdated, contaminated, or discarded pharmaceutical products, tablets, capsules, and syrups.",
    },
    {
        "code": WasteType.CHEMICAL.value,
        "name": "Chemical & Cytotoxic Pharmaceutical Waste",
        "bin_color": WasteBinColor.YELLOW.value,
        "description": "Chemical, cytotoxic, antineoplastic, and hazardous pharmaceutical waste.",
    },
    {
        "code": WasteType.CHEMICAL_LIQUID.value,
        "name": "Liquid Chemical & Disinfectant Waste",
        "bin_color": WasteBinColor.YELLOW.value,
        "description": "Liquid pharmaceutical residues, laboratory reagents, and discarded disinfectants.",
    },
    {
        "code": WasteType.GLASSWARE.value,
        "name": "Contaminated Glassware & Vials",
        "bin_color": WasteBinColor.BLUE.value,
        "description": "Broken or intact glass ampoules, medicine vials, bottles, and slides.",
    },
    {
        "code": WasteType.CONTAMINATED_RECYCLABLE.value,
        "name": "Contaminated Recyclable Packaging",
        "bin_color": WasteBinColor.RED.value,
        "description": "Contaminated plastic tubing, IV sets, bottles, syringes without needles, and packaging.",
    },
    {
        "code": WasteType.SHARPS.value,
        "name": "Pharmaceutical & Clinical Sharps",
        "bin_color": WasteBinColor.WHITE.value,
        "description": "Needles, syringes with fixed needles, scalpels, blades, and contaminated metal sharps.",
    },
    {
        "code": WasteType.HAZARDOUS_OTHER.value,
        "name": "Other Hazardous Biomedical Waste",
        "bin_color": WasteBinColor.BROWN.value,
        "description": "Other regulated hazardous biomedical and pharmaceutical waste items.",
    },
]

SUPPORTED_TIME_SLOTS = [
    {
        "id": "MORNING",
        "label": "09:00 AM - 12:00 PM",
        "window": "Morning Window",
    },
    {
        "id": "AFTERNOON",
        "label": "12:00 PM - 03:00 PM",
        "window": "Afternoon Window",
    },
    {
        "id": "EVENING",
        "label": "03:00 PM - 06:00 PM",
        "window": "Evening Window",
    },
]


def _parse_pickup_metadata(notes: str | None) -> dict[str, Any]:
    """
    Extracts structured waste categories and time slot if encoded in notes,
    returning clean remarks and parsed lists.
    """
    if not notes:
        return {
            "waste_categories": [WasteType.EXPIRED_DISCARDED_MEDICINE.value],
            "time_slot": "09:00 AM - 12:00 PM",
            "remarks": "",
        }

    categories: list[str] = []
    time_slot = "09:00 AM - 12:00 PM"
    clean_lines: list[str] = []

    for line in notes.splitlines():
        stripped = line.strip()
        if stripped.startswith("[CATEGORIES:"):
            inner = stripped[len("[CATEGORIES:") : -1] if stripped.endswith("]") else stripped[len("[CATEGORIES:") :]
            categories = [c.strip() for c in inner.split(",") if c.strip()]
        elif stripped.startswith("[TIME_SLOT:"):
            inner = stripped[len("[TIME_SLOT:") : -1] if stripped.endswith("]") else stripped[len("[TIME_SLOT:") :]
            if inner.strip():
                time_slot = inner.strip()
        else:
            clean_lines.append(line)

    if not categories:
        # Infer from keywords if legacy notes
        upper = notes.upper()
        for item in WASTE_CATEGORIES_CATALOG:
            if item["code"] in upper or item["name"].upper() in upper:
                categories.append(item["code"])
        if not categories:
            categories = [WasteType.EXPIRED_DISCARDED_MEDICINE.value]

    return {
        "waste_categories": categories,
        "time_slot": time_slot,
        "remarks": "\n".join(clean_lines).strip(),
    }


def _ensure_invoice_for_pickup(db: Session, pickup: Pickup, stop: RouteStop | None) -> Invoice | None:
    invoice = (
        db.query(Invoice)
        .options(selectinload(Invoice.line_items))
        .filter(Invoice.pickup_id == pickup.id)
        .first()
    )
    if invoice is not None:
        return invoice

    actual_weight = getattr(stop, "collected_weight_kg", None) if stop else None
    if actual_weight is not None and float(actual_weight) > 0:
        ensure_customer_pricing_assignment(db, pickup.customer_id)
        db.flush()
        try:
            invoice = create_pickup_invoice(
                db=db,
                pickup_id=pickup.id,
                actual_weight_kg=Decimal(str(actual_weight)),
            )
            db.commit()
            db.refresh(invoice)
            return invoice
        except InvoiceError:
            db.rollback()
            return (
                db.query(Invoice)
                .options(selectinload(Invoice.line_items))
                .filter(Invoice.pickup_id == pickup.id)
                .first()
            )
    return None


def _serialize_invoice(db: Session, invoice: Invoice | None) -> dict[str, Any] | None:
    if invoice is None:
        return None

    line_items = [
        {
            "id": item.id,
            "item_type": item.item_type,
            "description": item.description,
            "quantity": float(item.quantity),
            "unit_price": float(item.unit_price),
            "amount": float(item.amount),
        }
        for item in (invoice.line_items or [])
    ]

    payment_rows = (
        db.query(Payment)
        .filter(Payment.invoice_id == invoice.id)
        .order_by(Payment.id.desc())
        .all()
    )

    payments = [
        {
            "id": p.id,
            "public_id": str(p.id),
            "amount": float(p.amount),
            "currency": invoice.currency,
            "payment_method": p.payment_method,
            "payment_reference": p.payment_reference,
            "status": p.status,
            "paid_at": p.paid_at,
        }
        for p in payment_rows
    ]

    return {
        "id": invoice.id,
        "public_id": str(invoice.public_id),
        "invoice_number": invoice.invoice_number,
        "currency": invoice.currency,
        "subtotal": float(invoice.subtotal),
        "tax_amount": float(invoice.tax_amount),
        "total_amount": float(invoice.total_amount),
        "amount_paid": float(invoice.amount_paid),
        "amount_due": float(invoice.outstanding_amount),
        "status": invoice.status,
        "issued_at": invoice.issued_at,
        "due_date": invoice.due_date,
        "paid_at": invoice.paid_at,
        "pricing_snapshot": invoice.pricing_snapshot or {},
        "line_items": line_items,
        "payments": payments,
    }


def _build_pickup_summary(
    db: Session,
    pickup: Pickup,
    stop: RouteStop | None = None,
    invoice: Invoice | None = None,
) -> dict[str, Any]:
    parsed = _parse_pickup_metadata(pickup.notes)
    loc = pickup.location
    actual_weight = (
        float(stop.collected_weight_kg)
        if stop and stop.collected_weight_kg is not None
        else (
            float(invoice.pricing_snapshot.get("actual_weight_kg"))
            if invoice and invoice.pricing_snapshot and invoice.pricing_snapshot.get("actual_weight_kg") is not None
            else None
        )
    )
    est_weight = float(pickup.estimated_weight_kg) if pickup.estimated_weight_kg is not None else None

    if invoice is not None:
        if invoice.status == "PAID" or float(invoice.outstanding_amount) <= 0:
            payment_status = "PAID"
        elif float(invoice.amount_paid) > 0:
            payment_status = "PARTIALLY_PAID"
        else:
            payment_status = "PENDING"
    elif actual_weight is not None and actual_weight > 0:
        payment_status = "PENDING"
    else:
        payment_status = "AWAITING_WEIGHING"

    snapshot = (invoice.pricing_snapshot or {}) if invoice else {}
    handover_confirmed = bool(
        snapshot.get("handover_confirmed")
        or pickup.otp_verified_at is not None
        or pickup.status == PickupStatus.COLLECTED
    )

    driver_name = None
    if stop and stop.route and stop.route.driver and stop.route.driver.user:
        driver_name = stop.route.driver.user.name

    return {
        "id": pickup.id,
        "public_id": str(pickup.public_id),
        "pickup_code": pickup.pickup_code,
        "customer_id": pickup.customer_id,
        "location_id": pickup.location_id,
        "location_name": loc.name if loc else "Registered Facility",
        "location_address": (
            f"{loc.address_line_1}, {loc.city}, {loc.state} {loc.postal_code}"
            if loc
            else ""
        ),
        "status": pickup.status.value if hasattr(pickup.status, "value") else str(pickup.status),
        "priority": pickup.priority.value if hasattr(pickup.priority, "value") else str(pickup.priority),
        "requested_date": pickup.requested_date,
        "scheduled_date": pickup.scheduled_date,
        "collected_at": pickup.collected_at,
        "created_at": pickup.created_at,
        "updated_at": pickup.updated_at,
        "estimated_weight_kg": est_weight,
        "actual_weight_kg": actual_weight,
        "waste_categories": parsed["waste_categories"],
        "time_slot": parsed["time_slot"],
        "remarks": parsed["remarks"],
        "notes": pickup.notes,
        "payment_status": payment_status,
        "total_amount": float(invoice.total_amount) if invoice else None,
        "amount_due": float(invoice.outstanding_amount) if invoice else None,
        "currency": invoice.currency if invoice else "INR",
        "handover_confirmed": handover_confirmed,
        "qr_verified": pickup.qr_verified_at is not None,
        "otp_verified": pickup.otp_verified_at is not None,
        "driver_name": driver_name,
    }


@router.get(
    "/waste-categories",
    dependencies=[Depends(require_role(UserRole.CUSTOMER))],
)
def get_pickup_waste_categories(
    db: Session = Depends(get_db),
):
    max_weight = 500.0
    try:
        cfg = get_active_version(db, "operations.max_pickup_weight_kg")
        if cfg and cfg.value is not None:
            max_weight = float(cfg.value)
    except Exception:
        pass

    return {
        "waste_categories": WASTE_CATEGORIES_CATALOG,
        "time_slots": SUPPORTED_TIME_SLOTS,
        "priorities": [
            {"code": PickupPriority.NORMAL.value, "label": "Standard Scheduled Pickup"},
            {"code": PickupPriority.HIGH.value, "label": "Priority Pickup"},
            {"code": PickupPriority.URGENT.value, "label": "Urgent Compliance Pickup"},
        ],
        "max_pickup_weight_kg": max_weight,
    }


@router.get(
    "/dashboard",
    dependencies=[Depends(require_role(UserRole.CUSTOMER))],
)
def get_customer_dashboard(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    customer = (
        db.query(Customer)
        .filter(Customer.user_id == current_user.id)
        .first()
    )
    if not customer:
        return {
            "total_pickups": 0,
            "active_pickups": 0,
            "upcoming_pickups": 0,
            "completed_pickups": 0,
            "pending_payments": 0,
            "pending_payment_amount": 0.0,
            "recent_pickups": [],
        }

    pickups = (
        db.query(Pickup)
        .options(selectinload(Pickup.location))
        .filter(Pickup.customer_id == customer.id)
        .order_by(Pickup.created_at.desc())
        .all()
    )

    pickup_ids = [p.id for p in pickups]
    stops_by_pickup: dict[int, RouteStop] = {}
    invoices_by_pickup: dict[int, Invoice] = {}

    if pickup_ids:
        stops = (
            db.query(RouteStop)
            .options(
                selectinload(RouteStop.route)
                .selectinload(Route.driver)
                .selectinload(Driver.user)
            )
            .filter(RouteStop.pickup_id.in_(pickup_ids))
            .order_by(RouteStop.id.desc())
            .all()
        )
        for s in stops:
            if s.pickup_id not in stops_by_pickup:
                stops_by_pickup[s.pickup_id] = s

        invoices = (
            db.query(Invoice)
            .options(selectinload(Invoice.line_items))
            .filter(Invoice.pickup_id.in_(pickup_ids))
            .all()
        )
        for inv in invoices:
            if inv.pickup_id is not None:
                invoices_by_pickup[inv.pickup_id] = inv

    # Ensure invoices exist for any stops where weight has been recorded
    for p in pickups:
        stop = stops_by_pickup.get(p.id)
        if p.id not in invoices_by_pickup and stop and stop.collected_weight_kg is not None and float(stop.collected_weight_kg) > 0:
            created_inv = _ensure_invoice_for_pickup(db, p, stop)
            if created_inv is not None:
                invoices_by_pickup[p.id] = created_inv

    total_pickups = len(pickups)
    active_statuses = {
        PickupStatus.REQUESTED,
        PickupStatus.SCHEDULED,
        PickupStatus.ASSIGNED,
        PickupStatus.IN_PROGRESS,
    }
    upcoming_statuses = {
        PickupStatus.REQUESTED,
        PickupStatus.SCHEDULED,
        PickupStatus.ASSIGNED,
    }

    active_pickups = sum(1 for p in pickups if p.status in active_statuses)
    upcoming_pickups = sum(1 for p in pickups if p.status in upcoming_statuses)
    completed_pickups = sum(1 for p in pickups if p.status == PickupStatus.COLLECTED)

    pending_payments = 0
    pending_payment_amount = 0.0
    for p in pickups:
        inv = invoices_by_pickup.get(p.id)
        if inv is not None and inv.status in {"ISSUED", "PARTIALLY_PAID", "OVERDUE"} and float(inv.outstanding_amount) > 0:
            pending_payments += 1
            pending_payment_amount += float(inv.outstanding_amount)

    recent_items = [
        _build_pickup_summary(
            db,
            p,
            stops_by_pickup.get(p.id),
            invoices_by_pickup.get(p.id),
        )
        for p in pickups[:15]
    ]

    return {
        "total_pickups": total_pickups,
        "active_pickups": active_pickups,
        "upcoming_pickups": upcoming_pickups,
        "completed_pickups": completed_pickups,
        "pending_payments": pending_payments,
        "pending_payment_amount": round(pending_payment_amount, 2),
        "recent_pickups": recent_items,
    }


@router.get(
    "/history",
    dependencies=[Depends(require_role(UserRole.CUSTOMER))],
)
def get_customer_pickup_history(
    status: str | None = Query(default=None),
    search: str | None = Query(default=None),
    date_from: str | None = Query(default=None),
    date_to: str | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    customer = (
        db.query(Customer)
        .filter(Customer.user_id == current_user.id)
        .first()
    )
    if not customer:
        return {
            "items": [],
            "total": 0,
            "page": page,
            "page_size": page_size,
            "total_pages": 0,
        }

    query = (
        db.query(Pickup)
        .options(selectinload(Pickup.location))
        .filter(Pickup.customer_id == customer.id)
    )

    if status and status.upper() != "ALL":
        statuses = [s.strip().upper() for s in status.split(",") if s.strip()]
        valid_statuses = [
            PickupStatus(s)
            for s in statuses
            if s in PickupStatus.__members__
        ]
        if valid_statuses:
            query = query.filter(Pickup.status.in_(valid_statuses))

    if date_from:
        try:
            dt_from = datetime.fromisoformat(date_from.replace("Z", "+00:00"))
            query = query.filter(Pickup.created_at >= dt_from)
        except ValueError:
            pass

    if date_to:
        try:
            dt_to = datetime.fromisoformat(date_to.replace("Z", "+00:00"))
            query = query.filter(Pickup.created_at <= dt_to)
        except ValueError:
            pass

    all_matching = query.order_by(Pickup.created_at.desc()).all()

    if search and search.strip():
        q = search.strip().lower()
        all_matching = [
            p
            for p in all_matching
            if q in (p.pickup_code or "").lower()
            or q in str(p.public_id).lower()
            or (p.location and q in (p.location.name or "").lower())
            or (p.location and q in (p.location.city or "").lower())
            or (p.notes and q in p.notes.lower())
        ]

    total = len(all_matching)
    total_pages = math.ceil(total / page_size) if total > 0 else 0
    start_idx = (page - 1) * page_size
    page_pickups = all_matching[start_idx : start_idx + page_size]

    pickup_ids = [p.id for p in page_pickups]
    stops_by_pickup: dict[int, RouteStop] = {}
    invoices_by_pickup: dict[int, Invoice] = {}

    if pickup_ids:
        stops = (
            db.query(RouteStop)
            .options(
                selectinload(RouteStop.route)
                .selectinload(Route.driver)
                .selectinload(Driver.user)
            )
            .filter(RouteStop.pickup_id.in_(pickup_ids))
            .order_by(RouteStop.id.desc())
            .all()
        )
        for s in stops:
            if s.pickup_id not in stops_by_pickup:
                stops_by_pickup[s.pickup_id] = s

        invoices = (
            db.query(Invoice)
            .options(selectinload(Invoice.line_items))
            .filter(Invoice.pickup_id.in_(pickup_ids))
            .all()
        )
        for inv in invoices:
            if inv.pickup_id is not None:
                invoices_by_pickup[inv.pickup_id] = inv

    items = [
        _build_pickup_summary(
            db,
            p,
            stops_by_pickup.get(p.id),
            invoices_by_pickup.get(p.id),
        )
        for p in page_pickups
    ]

    return {
        "items": items,
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": total_pages,
    }


@router.post(
    "/",
    response_model=PickupResponse,
    status_code=201,
    dependencies=[Depends(require_role(UserRole.CUSTOMER))],
)
def create_pickup_endpoint(
    data: PickupCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    final_notes = data.notes
    if data.waste_categories or data.time_slot:
        meta_parts: list[str] = []
        if data.waste_categories:
            meta_parts.append(f"[CATEGORIES: {', '.join(data.waste_categories)}]")
        if data.time_slot:
            meta_parts.append(f"[TIME_SLOT: {data.time_slot}]")
        if data.notes:
            meta_parts.append(data.notes.strip())
        final_notes = "\n".join(meta_parts)

    pickup = create_pickup(
        db=db,
        current_user=current_user,
        location_id=data.location_id,
        requested_date=data.requested_date,
        priority=data.priority,
        estimated_weight_kg=data.estimated_weight_kg,
        notes=final_notes,
    )

    if isinstance(pickup, Pickup):
        pickup.scheduled_date = data.requested_date
        pickup.status = PickupStatus.SCHEDULED
        db.commit()
        db.refresh(pickup)

    return pickup


@router.get(
    "/",
    response_model=list[PickupResponse],
    dependencies=[Depends(require_role(UserRole.CUSTOMER))],
)
def list_my_pickups(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return list_customer_pickups(
        db=db,
        current_user=current_user,
    )


@router.get(
    "/{pickup_id}",
    response_model=PickupResponse,
    dependencies=[Depends(require_role(UserRole.CUSTOMER))],
)
def get_my_pickup(
    pickup_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return get_customer_pickup(
        db=db,
        current_user=current_user,
        pickup_id=pickup_id,
    )


@router.get(
    "/{pickup_id}/details",
    dependencies=[Depends(require_role(UserRole.CUSTOMER))],
)
def get_my_pickup_details(
    pickup_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    pickup = get_customer_pickup(
        db=db,
        current_user=current_user,
        pickup_id=pickup_id,
    )

    stop = (
        db.query(RouteStop)
        .options(
            selectinload(RouteStop.route)
            .selectinload(Route.driver)
            .selectinload(Driver.user),
            selectinload(RouteStop.route)
            .selectinload(Route.vehicle),
        )
        .filter(RouteStop.pickup_id == pickup.id)
        .order_by(RouteStop.id.desc())
        .first()
    )

    invoice = _ensure_invoice_for_pickup(db, pickup, stop)

    loc = pickup.location
    location_data = (
        {
            "id": loc.id,
            "public_id": str(getattr(loc, "public_id", loc.id)),
            "location_code": loc.location_code,
            "name": loc.name,
            "address_line_1": loc.address_line_1,
            "address_line_2": loc.address_line_2,
            "city": loc.city,
            "state": loc.state,
            "postal_code": loc.postal_code,
            "latitude": loc.latitude,
            "longitude": loc.longitude,
            "contact_name": loc.contact_name,
            "contact_phone": loc.contact_phone,
        }
        if loc
        else None
    )

    driver_data = None
    if stop and stop.route:
        route = stop.route
        drv = route.driver
        veh = route.vehicle
        driver_data = {
            "driver_id": drv.id if drv else None,
            "name": drv.user.name if drv and drv.user else "Assigned Driver",
            "phone": drv.phone if drv else None,
            "license_number": drv.license_number if drv else None,
            "vehicle_number": veh.registration_number if veh else None,
            "vehicle_type": (
                veh.vehicle_type.value
                if veh and hasattr(veh.vehicle_type, "value")
                else (str(veh.vehicle_type) if veh else None)
            ),
            "route_id": route.id,
            "route_code": route.route_code,
            "route_status": (
                route.status.value
                if hasattr(route.status, "value")
                else str(route.status)
            ),
            "stop_id": stop.id,
            "stop_status": (
                stop.execution_status.value
                if hasattr(stop.execution_status, "value")
                else str(stop.execution_status)
            ),
            "arrived_at": stop.arrived_at,
            "completed_at": stop.completed_at,
        }

    parsed = _parse_pickup_metadata(pickup.notes)
    est_weight = float(pickup.estimated_weight_kg) if pickup.estimated_weight_kg is not None else None
    actual_weight = (
        float(stop.collected_weight_kg)
        if stop and stop.collected_weight_kg is not None
        else (
            float(invoice.pricing_snapshot.get("actual_weight_kg"))
            if invoice and invoice.pricing_snapshot and invoice.pricing_snapshot.get("actual_weight_kg") is not None
            else None
        )
    )

    discrepancy_kg = None
    discrepancy_pct = None
    if est_weight is not None and actual_weight is not None:
        discrepancy_kg = round(actual_weight - est_weight, 2)
        if est_weight > 0:
            discrepancy_pct = round((discrepancy_kg / est_weight) * 100.0, 1)

    # Breakdown by selected categories (proportional distribution when multiple categories selected)
    selected_codes = parsed["waste_categories"]
    cat_map = {c["code"]: c for c in WASTE_CATEGORIES_CATALOG}
    count_cats = max(1, len(selected_codes))
    waste_breakdown = []
    for idx, code in enumerate(selected_codes):
        meta = cat_map.get(
            code,
            {
                "code": code,
                "name": code.replace("_", " ").title(),
                "bin_color": "YELLOW",
                "description": "Regulated pharmaceutical waste",
            },
        )
        est_share = round(est_weight / count_cats, 2) if est_weight is not None else None
        act_share = round(actual_weight / count_cats, 2) if actual_weight is not None else None
        if idx == count_cats - 1:
            if est_weight is not None and est_share is not None:
                est_share = round(est_weight - est_share * (count_cats - 1), 2)
            if actual_weight is not None and act_share is not None:
                act_share = round(actual_weight - act_share * (count_cats - 1), 2)
        waste_breakdown.append(
            {
                "code": meta["code"],
                "name": meta["name"],
                "bin_color": meta["bin_color"],
                "description": meta["description"],
                "estimated_weight_kg": est_share,
                "actual_weight_kg": act_share,
            }
        )

    snapshot = (invoice.pricing_snapshot or {}) if invoice else {}
    handover_confirmed = bool(
        snapshot.get("handover_confirmed")
        or pickup.otp_verified_at is not None
        or pickup.status == PickupStatus.COLLECTED
    )
    handover_confirmed_at = snapshot.get("handover_confirmed_at") or (
        pickup.otp_verified_at.isoformat() if pickup.otp_verified_at else None
    )
    handover_notes = snapshot.get("handover_notes")

    if invoice is not None:
        if invoice.status == "PAID" or float(invoice.outstanding_amount) <= 0:
            payment_status = "PAID"
        elif float(invoice.amount_paid) > 0:
            payment_status = "PARTIALLY_PAID"
        else:
            payment_status = "PENDING"
    elif actual_weight is not None and actual_weight > 0:
        payment_status = "PENDING"
    else:
        payment_status = "AWAITING_WEIGHING"

    now = datetime.now(timezone.utc)
    cooldown_remaining = 0
    if pickup.otp_last_requested_at is not None:
        last_req = pickup.otp_last_requested_at
        if last_req.tzinfo is None:
            last_req = last_req.replace(tzinfo=timezone.utc)
        elapsed = (now - last_req).total_seconds()
        if elapsed < OTP_REQUEST_COOLDOWN_SECONDS:
            cooldown_remaining = int(OTP_REQUEST_COOLDOWN_SECONDS - elapsed)

    otp_expires_at = pickup.otp_expires_at
    if otp_expires_at and otp_expires_at.tzinfo is None:
        otp_expires_at = otp_expires_at.replace(tzinfo=timezone.utc)

    otp_active = bool(
        pickup.otp_hash is not None
        and otp_expires_at is not None
        and otp_expires_at > now
        and pickup.otp_verified_at is None
    )

    otp_status = {
        "qr_verified": pickup.qr_verified_at is not None,
        "qr_verified_at": pickup.qr_verified_at,
        "otp_generated": otp_active or pickup.otp_verified_at is not None,
        "otp_active": otp_active,
        "otp_verified": pickup.otp_verified_at is not None,
        "otp_verified_at": pickup.otp_verified_at,
        "otp_expires_at": pickup.otp_expires_at,
        "otp_attempts": pickup.otp_attempts,
        "max_attempts": 5,
        "cooldown_remaining_seconds": cooldown_remaining,
    }

    # Build visual timeline from real backend status transitions
    p_status = pickup.status
    is_scheduled = p_status in {
        PickupStatus.SCHEDULED,
        PickupStatus.ASSIGNED,
        PickupStatus.IN_PROGRESS,
        PickupStatus.COLLECTED,
    } or pickup.scheduled_date is not None
    is_assigned = (
        p_status in {PickupStatus.ASSIGNED, PickupStatus.IN_PROGRESS, PickupStatus.COLLECTED}
        or stop is not None
    )
    is_arrived_or_weighed = (
        (stop is not None and stop.execution_status in {RouteStopStatus.ARRIVED, RouteStopStatus.IN_PROGRESS, RouteStopStatus.COMPLETED})
        or actual_weight is not None
        or pickup.qr_verified_at is not None
        or p_status == PickupStatus.COLLECTED
    )
    is_paid = payment_status == "PAID" or p_status == PickupStatus.COLLECTED
    is_otp_verified = pickup.otp_verified_at is not None or p_status == PickupStatus.COLLECTED
    is_collected = p_status == PickupStatus.COLLECTED

    timeline = [
        {
            "key": "REQUESTED",
            "title": "Pickup Requested",
            "description": f"Request {pickup.pickup_code} submitted",
            "completed": True,
            "timestamp": pickup.created_at,
        },
        {
            "key": "SCHEDULED",
            "title": "Scheduled & Route Assigned",
            "description": (
                f"Assigned to {driver_data['name']}"
                if driver_data
                else "Scheduled for collection"
            ),
            "completed": is_scheduled and is_assigned,
            "timestamp": pickup.scheduled_date,
        },
        {
            "key": "WEIGHED",
            "title": "Driver Arrived & Waste Weighed",
            "description": (
                f"Recorded weight: {actual_weight:.2f} kg"
                if actual_weight is not None
                else "Awaiting driver arrival and weight recording"
            ),
            "completed": is_arrived_or_weighed and actual_weight is not None,
            "timestamp": stop.arrived_at if stop else pickup.qr_verified_at,
        },
        {
            "key": "HANDOVER_CONFIRMED",
            "title": "Waste Handover Confirmed",
            "description": (
                "Customer confirmed actual weight"
                if handover_confirmed
                else "Customer review of recorded weight"
            ),
            "completed": handover_confirmed,
            "timestamp": handover_confirmed_at,
        },
        {
            "key": "PAYMENT_COMPLETED",
            "title": "Bill Paid via Razorpay",
            "description": (
                f"Invoice {invoice.invoice_number} paid"
                if invoice and payment_status == "PAID"
                else "Complete payment after weight recording"
            ),
            "completed": is_paid,
            "timestamp": invoice.paid_at if invoice else None,
        },
        {
            "key": "OTP_VERIFIED",
            "title": "Collection OTP Verified",
            "description": (
                "Driver verified customer OTP"
                if is_otp_verified
                else "Generate OTP and share with driver"
            ),
            "completed": is_otp_verified,
            "timestamp": pickup.otp_verified_at,
        },
        {
            "key": "COLLECTED",
            "title": "Pickup Completed",
            "description": (
                "Waste collected and custody transferred"
                if is_collected
                else "Finalizing collection"
            ),
            "completed": is_collected,
            "timestamp": pickup.collected_at,
        },
    ]

    return {
        "id": pickup.id,
        "public_id": str(pickup.public_id),
        "pickup_code": pickup.pickup_code,
        "verification_token": pickup.verification_token,
        "status": pickup.status.value if hasattr(pickup.status, "value") else str(pickup.status),
        "priority": pickup.priority.value if hasattr(pickup.priority, "value") else str(pickup.priority),
        "requested_date": pickup.requested_date,
        "scheduled_date": pickup.scheduled_date,
        "collected_at": pickup.collected_at,
        "created_at": pickup.created_at,
        "updated_at": pickup.updated_at,
        "failure_reason": pickup.failure_reason,
        "notes": pickup.notes,
        "remarks": parsed["remarks"],
        "time_slot": parsed["time_slot"],
        "waste_categories": parsed["waste_categories"],
        "waste_breakdown": waste_breakdown,
        "estimated_weight_kg": est_weight,
        "actual_weight_kg": actual_weight,
        "weight_discrepancy_kg": discrepancy_kg,
        "weight_discrepancy_pct": discrepancy_pct,
        "handover_confirmed": handover_confirmed,
        "handover_confirmed_at": handover_confirmed_at,
        "handover_notes": handover_notes,
        "location": location_data,
        "driver": driver_data,
        "payment_status": payment_status,
        "invoice": _serialize_invoice(db, invoice),
        "otp_status": otp_status,
        "timeline": timeline,
    }


@router.post(
    "/{pickup_id}/handover/confirm",
    dependencies=[Depends(require_role(UserRole.CUSTOMER))],
)
def confirm_pickup_handover(
    pickup_id: UUID,
    data: PickupHandoverConfirmRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    pickup = get_customer_pickup(
        db=db,
        current_user=current_user,
        pickup_id=pickup_id,
    )

    if pickup.status in {PickupStatus.CANCELLED, PickupStatus.FAILED}:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot confirm handover for pickup in status {pickup.status.value}",
        )

    stop = (
        db.query(RouteStop)
        .filter(RouteStop.pickup_id == pickup.id)
        .order_by(RouteStop.id.desc())
        .first()
    )

    invoice = _ensure_invoice_for_pickup(db, pickup, stop)

    actual_weight = (
        float(stop.collected_weight_kg)
        if stop and stop.collected_weight_kg is not None
        else (
            float(invoice.pricing_snapshot.get("actual_weight_kg"))
            if invoice and invoice.pricing_snapshot and invoice.pricing_snapshot.get("actual_weight_kg") is not None
            else None
        )
    )

    if actual_weight is None or actual_weight <= 0:
        raise HTTPException(
            status_code=400,
            detail="Actual collected weight has not been recorded by the driver yet.",
        )

    if invoice is None:
        ensure_customer_pricing_assignment(db, pickup.customer_id)
        db.flush()
        try:
            invoice = create_pickup_invoice(
                db=db,
                pickup_id=pickup.id,
                actual_weight_kg=Decimal(str(actual_weight)),
            )
        except InvoiceError as exc:
            raise HTTPException(
                status_code=400,
                detail=f"Unable to generate invoice for handover: {exc}",
            ) from exc

    now_iso = datetime.now(timezone.utc).isoformat()
    snapshot = dict(invoice.pricing_snapshot or {})
    snapshot["handover_confirmed"] = True
    snapshot["handover_confirmed_at"] = now_iso
    snapshot["handover_confirmed_by_user_id"] = current_user.id
    if data.notes:
        snapshot["handover_notes"] = data.notes.strip()

    invoice.pricing_snapshot = snapshot
    flag_modified(invoice, "pricing_snapshot")
    db.commit()
    db.refresh(invoice)

    return {
        "message": "Waste handover confirmed successfully",
        "pickup_id": str(pickup.public_id),
        "pickup_code": pickup.pickup_code,
        "estimated_weight_kg": float(pickup.estimated_weight_kg) if pickup.estimated_weight_kg is not None else None,
        "actual_weight_kg": actual_weight,
        "handover_confirmed": True,
        "handover_confirmed_at": now_iso,
        "handover_notes": snapshot.get("handover_notes"),
        "invoice": _serialize_invoice(db, invoice),
    }


@router.get(
    "/{pickup_id}/invoice",
    dependencies=[Depends(require_role(UserRole.CUSTOMER))],
)
def get_my_pickup_invoice(
    pickup_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    pickup = get_customer_pickup(
        db=db,
        current_user=current_user,
        pickup_id=pickup_id,
    )

    stop = (
        db.query(RouteStop)
        .filter(RouteStop.pickup_id == pickup.id)
        .order_by(RouteStop.id.desc())
        .first()
    )

    invoice = _ensure_invoice_for_pickup(db, pickup, stop)
    if invoice is None:
        raise HTTPException(
            status_code=404,
            detail="Bill is not yet available. The driver must record the actual collected weight first.",
        )

    return _serialize_invoice(db, invoice)


@router.post(
    "/{pickup_id}/payment/order",
    dependencies=[Depends(require_role(UserRole.CUSTOMER))],
)
def create_my_pickup_payment_order(
    pickup_id: UUID,
    idempotency_key: str | None = Header(default=None, alias="Idempotency-Key"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    pickup = get_customer_pickup(
        db=db,
        current_user=current_user,
        pickup_id=pickup_id,
    )

    stop = (
        db.query(RouteStop)
        .filter(RouteStop.pickup_id == pickup.id)
        .order_by(RouteStop.id.desc())
        .first()
    )

    invoice = _ensure_invoice_for_pickup(db, pickup, stop)
    if invoice is None:
        raise HTTPException(
            status_code=400,
            detail="Cannot create payment order before actual weight is recorded and billed.",
        )

    if invoice.status == "PAID" or Decimal(str(invoice.outstanding_amount)) <= Decimal("0"):
        raise HTTPException(
            status_code=409,
            detail="This pickup invoice has already been paid.",
        )

    # Reuse an existing CREATED RazorpayOrder if no custom idempotency key was supplied
    if not idempotency_key:
        existing_created = db.scalar(
            select(RazorpayOrder)
            .where(
                RazorpayOrder.invoice_id == invoice.id,
                RazorpayOrder.status == "CREATED",
            )
            .order_by(RazorpayOrder.id.desc())
        )
        if existing_created is not None and existing_created.amount_paise == int(Decimal(str(invoice.outstanding_amount)).quantize(Decimal("0.01")) * 100):
            idempotency_key = existing_created.idempotency_key
        else:
            idempotency_key = f"cust-pkp-{pickup.id}-{uuid4().hex[:16]}"

    order_data = create_razorpay_order(
        db=db,
        invoice_id=invoice.id,
        idempotency_key=idempotency_key,
    )

    return {
        **order_data,
        "invoice_id": invoice.id,
        "invoice_number": invoice.invoice_number,
        "pickup_id": str(pickup.public_id),
        "pickup_code": pickup.pickup_code,
        "customer_name": pickup.customer.display_name if pickup.customer else current_user.name,
        "customer_email": (pickup.customer.email if pickup.customer and pickup.customer.email else current_user.email),
        "customer_phone": pickup.customer.phone if pickup.customer else "",
    }


@router.post(
    "/{pickup_id}/payment/verify",
    dependencies=[Depends(require_role(UserRole.CUSTOMER))],
)
def verify_my_pickup_payment(
    pickup_id: UUID,
    data: RazorpayPaymentVerificationRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    pickup = get_customer_pickup(
        db=db,
        current_user=current_user,
        pickup_id=pickup_id,
    )

    invoice = (
        db.query(Invoice)
        .filter(Invoice.pickup_id == pickup.id)
        .first()
    )
    if invoice is None:
        raise HTTPException(
            status_code=404,
            detail="Invoice not found for this pickup.",
        )

    order = db.scalar(
        select(RazorpayOrder).where(
            RazorpayOrder.razorpay_order_id == data.razorpay_order_id
        )
    )
    if order is None or order.invoice_id != invoice.id:
        raise HTTPException(
            status_code=404,
            detail="Payment order not found for this pickup.",
        )

    result = verify_razorpay_payment(
        db=db,
        razorpay_order_id=data.razorpay_order_id,
        razorpay_payment_id=data.razorpay_payment_id,
        razorpay_signature=data.razorpay_signature,
    )

    db.refresh(invoice)
    return {
        **result,
        "pickup_id": str(pickup.public_id),
        "pickup_code": pickup.pickup_code,
        "invoice": _serialize_invoice(db, invoice),
    }


@router.post(
    "/{pickup_id}/cancel",
    response_model=PickupResponse,
    dependencies=[Depends(require_role(UserRole.CUSTOMER))],
)
def cancel_my_pickup(
    pickup_id: UUID,
    data: PickupCancelRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    pickup = get_customer_pickup(
        db=db,
        current_user=current_user,
        pickup_id=pickup_id,
    )
    return cancel_pickup(
        db=db,
        pickup_id=pickup.public_id,
        reason=data.reason,
    )


@router.get(
    "/{pickup_id}/verification",
    response_model=PickupVerificationResponse,
)
def get_pickup_verification(
    pickup_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    pickup = get_verification_details(
        db=db,
        user=current_user,
        pickup_id=pickup_id,
    )

    return PickupVerificationResponse(
        pickup_id=pickup.public_id,
        pickup_code=pickup.pickup_code,
        verification_token=pickup.verification_token,
        qr_verified=pickup.qr_verified_at is not None,
        qr_verified_at=pickup.qr_verified_at,
        otp_verified=pickup.otp_verified_at is not None,
        otp_verified_at=pickup.otp_verified_at,
        otp_expires_at=pickup.otp_expires_at,
    )


@router.post(
    "/{pickup_id}/verification/request-otp",
    response_model=RequestOTPResponse,
)
@limiter.limit("20/5minutes")
def request_pickup_otp(
    request: Request,
    pickup_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    pickup, otp = request_otp(
        db=db,
        user=current_user,
        pickup_id=pickup_id,
    )

    return RequestOTPResponse(
        pickup_id=pickup.public_id,
        otp=otp,
        expires_at=pickup.otp_expires_at,
        message=(
            "OTP generated for development. "
            "Production delivery will use the customer "
            "notification channel."
        ),
    )
