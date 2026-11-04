from datetime import datetime, timezone
from decimal import Decimal
from app.optimizer.problem import haversine_m

from app.services.invoice_service import (
    InvoiceError,
    create_pickup_invoice,
    money,
)
from fastapi import HTTPException
from sqlalchemy.orm import Session, selectinload
from app.services.configuration_runtime_service import get_active_version
from app.models.driver import Driver
from app.models.enums import (
    PickupStatus,
    RouteStatus,
    RouteStopStatus,
    RouteStopType,
)
from app.models.enums import (
    OperationalExceptionType,
)
from app.services.operational_exception_service import (
    create_operational_exception,
)
from app.models.invoice import Invoice, InvoiceLineItem
from app.models.pickup import Pickup
from app.models.route import Route
from app.models.route_stop import RouteStop
from app.models.user import User
from app.models.vehicle import Vehicle
from app.models.customer import Customer
from app.services.warehouse_intake_service import (
    create_warehouse_intake,
)
from app.services.notification_events import (
    notify_pickup_completed,
)


def get_driver_route(
    db: Session,
    user: User,
    route_id: int,
) -> tuple[Driver, Route]:

    driver = (
        db.query(Driver)
        .filter(Driver.user_id == user.id)
        .first()
    )

    if not driver:
        raise HTTPException(
            status_code=404,
            detail="Driver profile not found",
        )

    route = (
        db.query(Route)
        .options(
            selectinload(Route.stops)
            .selectinload(RouteStop.pickup)
            .selectinload(Pickup.location),

            selectinload(Route.stops)
            .selectinload(RouteStop.warehouse),

            selectinload(Route.vehicle),
            selectinload(Route.warehouse),
        )
        .filter(
            Route.id == route_id,
            Route.driver_id == driver.id,
        )
        .first()
    )

    if not route:
        raise HTTPException(
            status_code=404,
            detail="Route not found",
        )

    return driver, route


def start_route(
    db: Session,
    user: User,
    route_id: int,
):
    driver, route = get_driver_route(
        db,
        user,
        route_id,
    )

    if route.status != RouteStatus.ASSIGNED:
        raise HTTPException(
            status_code=400,
            detail=(
                f"Route cannot be started from "
                f"status {route.status.value}"
            ),
        )

    route.status = RouteStatus.IN_PROGRESS

    # Driver is busy with a route.
    driver.is_available = False

    db.commit()
    db.refresh(route)

    return route


def arrive_at_stop(
    db: Session,
    user: User,
    route_id: int,
    stop_id: int,
    latitude: float | None = None,
    longitude: float | None = None,
    accuracy_meters: float | None = None,
    geofence_radius_meters: float = 200.0,
):
    driver, route = get_driver_route(
        db,
        user,
        route_id,
    )

    if route.status != RouteStatus.IN_PROGRESS:
        raise HTTPException(
            status_code=400,
            detail="Route is not in progress",
        )

    stop = (
        db.query(RouteStop)
        .filter(
            RouteStop.id == stop_id,
            RouteStop.route_id == route.id,
        )
        .with_for_update()
        .first()
    )

    if not stop:
        raise HTTPException(
            status_code=404,
            detail="Route stop not found",
        )

    if stop.execution_status == RouteStopStatus.ARRIVED:
        return stop

    if stop.execution_status != RouteStopStatus.PENDING:
        raise HTTPException(
            status_code=400,
            detail="Stop has already been started or completed",
        )

    # Every previous stop must be completed.
    previous_stop = (
        db.query(RouteStop)
        .filter(
            RouteStop.route_id == route.id,
            RouteStop.sequence_number
            < stop.sequence_number,
        )
        .order_by(
            RouteStop.sequence_number.desc()
        )
        .first()
    )

    if previous_stop and (
        previous_stop.execution_status
        != RouteStopStatus.COMPLETED
    ):
        raise HTTPException(
            status_code=409,
            detail=(
                "Previous route stop must be "
                "completed first"
            ),
        )

    # Geospatial location / geofence verification
    if stop.lat is not None and stop.lng is not None:
        if latitude is None or longitude is None:
            raise HTTPException(
                status_code=400,
                detail="Driver GPS coordinates are required to arrive at this stop.",
            )
        distance = haversine_m((latitude, longitude), (stop.lat, stop.lng))
        if distance > geofence_radius_meters:
            raise HTTPException(
                status_code=400,
                detail=(
                    f"Location verification failed: Driver is {int(distance)}m away from "
                    f"{stop.location_name or 'assigned stop'}, which exceeds the {int(geofence_radius_meters)}m geofence."
                ),
            )

    stop.execution_status = RouteStopStatus.ARRIVED
    stop.arrived_at = datetime.now(timezone.utc)

    db.commit()
    db.refresh(stop)

    return stop


def record_stop_weight(
    db: Session,
    user: User,
    route_id: int,
    stop_id: int,
    collected_weight_kg: float,
):
    driver, route = get_driver_route(
        db,
        user,
        route_id,
    )

    if route.status != RouteStatus.IN_PROGRESS:
        raise HTTPException(
            status_code=400,
            detail="Route is not in progress",
        )

    stop = (
        db.query(RouteStop)
        .filter(
            RouteStop.id == stop_id,
            RouteStop.route_id == route.id,
        )
        .with_for_update()
        .first()
    )

    if not stop:
        raise HTTPException(
            status_code=404,
            detail="Route stop not found",
        )

    if stop.stop_type != RouteStopType.PICKUP or stop.pickup is None:
        raise HTTPException(
            status_code=400,
            detail="Weight recording is only supported for pickup stops",
        )

    if collected_weight_kg <= 0:
        raise HTTPException(
            status_code=400,
            detail="Collected weight must be greater than zero",
        )

    now = datetime.now(timezone.utc)
    if stop.execution_status == RouteStopStatus.PENDING:
        stop.execution_status = RouteStopStatus.ARRIVED
        stop.arrived_at = stop.arrived_at or now

    stop.collected_weight_kg = collected_weight_kg

    existing_invoice = (
        db.query(Invoice)
        .filter(Invoice.pickup_id == stop.pickup.id)
        .first()
    )

    if existing_invoice is None:
        try:
            create_pickup_invoice(
                db=db,
                pickup_id=stop.pickup.id,
                actual_weight_kg=Decimal(str(collected_weight_kg)),
            )
        except InvoiceError:
            pass
    elif existing_invoice.status == "ISSUED" and existing_invoice.amount_paid == Decimal("0.00"):
        from app.services.pricing_service import (
            PricingError,
            calculate_pickup_charges,
        )
        try:
            charges = calculate_pickup_charges(
                db=db,
                customer_id=stop.pickup.customer_id,
                actual_weight_kg=Decimal(str(collected_weight_kg)),
                at_time=now,
            )
            subtotal = money(Decimal(str(charges["pickup_charge"])))
            tax_amt = money(existing_invoice.tax_amount or Decimal("0.00"))
            total_amt = money(subtotal + tax_amt)

            snapshot = dict(existing_invoice.pricing_snapshot or {})
            for k, v in charges.items():
                snapshot[k] = str(v) if isinstance(v, Decimal) else v
            snapshot["invoice_subtotal"] = str(subtotal)
            snapshot["tax_amount"] = str(tax_amt)
            existing_invoice.pricing_snapshot = snapshot
            existing_invoice.subtotal = subtotal
            existing_invoice.total_amount = total_amt

            for item in existing_invoice.line_items:
                if item.item_type == "WEIGHT_CHARGE":
                    item.quantity = Decimal(str(charges["billable_weight_kg"]))
                    item.unit_price = money(Decimal(str(charges["per_kg_rate"])))
                    item.amount = money(Decimal(str(charges["weight_charge"])))
        except PricingError:
            pass

    db.commit()
    db.refresh(stop)

    return stop


def complete_stop(
    db: Session,
    user: User,
    route_id: int,
    stop_id: int,
    collected_weight_kg: float | None = None,
):
    driver, route = get_driver_route(
        db,
        user,
        route_id,
    )

    if route.status != RouteStatus.IN_PROGRESS:
        raise HTTPException(
            status_code=400,
            detail="Route is not in progress",
        )

    stop = (
        db.query(RouteStop)
        .filter(
            RouteStop.id == stop_id,
            RouteStop.route_id == route.id,
        )
        .with_for_update()
        .first()
    )

    if not stop:
        raise HTTPException(
            status_code=404,
            detail="Route stop not found",
        )

    now = datetime.now(timezone.utc)

    if stop.execution_status not in {
        RouteStopStatus.ARRIVED,
        RouteStopStatus.IN_PROGRESS,
    }:
        if stop.stop_type == RouteStopType.WAREHOUSE:
            stop.execution_status = RouteStopStatus.ARRIVED
            stop.arrived_at = now
        else:
            raise HTTPException(
                status_code=400,
                detail="Stop must be arrived at before completion",
            )

    # ---------------------------------------------------------
    # PICKUP
    # ---------------------------------------------------------
    if stop.stop_type == RouteStopType.PICKUP:

        if stop.pickup is None:
            raise HTTPException(
                status_code=500,
                detail="Pickup stop has no pickup",
            )

        collection_tolerance_config = get_active_version(
            db,
            "weight.collection_tolerance"
        )

        if collection_tolerance_config is None:
            raise HTTPException(
                status_code=500,
                detail="Collection weight tolerance configuration is not available",
            )

        collection_tolerance = float(collection_tolerance_config.value)

        if collected_weight_kg is None:
            raise HTTPException(
                status_code=400,
                detail=(
                    "Collected weight is required "
                    "for pickup completion"
                ),
            )

        if stop.pickup.qr_verified_at is None:
            raise HTTPException(
                status_code=409,
                detail="Pickup QR has not been verified",
            )

        if stop.pickup.otp_verified_at is None:
            raise HTTPException(
                status_code=409,
                detail="Customer OTP has not been verified",
            )
        if stop.proof_storage_path is None:
            raise HTTPException(
                status_code=409,
                detail="Collection proof has not been uploaded",
            )

        stop.collected_weight_kg = (
            collected_weight_kg
        )

        stop.pickup.status = PickupStatus.COLLECTED
        stop.pickup.collected_at = now

        # Create the invoice within the pickup transaction if not already created.
        try:
            create_pickup_invoice(
                db=db,
                pickup_id=stop.pickup.id,
                actual_weight_kg=Decimal(
                    str(collected_weight_kg)
                ),
            )
        except InvoiceError as exc:
            if "already exists" not in str(exc).lower():
                db.rollback()
                raise HTTPException(
                    status_code=409,
                    detail=f"Pickup completed but invoicing failed: {exc}",
                ) from exc

        stop.execution_status = (
            RouteStopStatus.COMPLETED
        )

        stop.completed_at = now

        customer = db.get(
            Customer,
            stop.pickup.customer_id,
        )

        if customer:
            notify_pickup_completed(
                db,
                customer_user_id=customer.user_id,
                pickup_id=stop.pickup.id,
                pickup_code=stop.pickup.pickup_code,
            )

        db.commit()
        db.refresh(stop)

        return stop

    # ---------------------------------------------------------
    # WAREHOUSE
    # ---------------------------------------------------------
    if stop.stop_type == RouteStopType.WAREHOUSE:

        last_sequence = (
            db.query(RouteStop.sequence_number)
            .filter(
                RouteStop.route_id == route.id
            )
            .order_by(
                RouteStop.sequence_number.desc()
            )
            .first()
        )

        if (
            not last_sequence
            or stop.sequence_number
            != last_sequence[0]
        ):
            raise HTTPException(
                status_code=400,
                detail=(
                    "Warehouse must be the final "
                    "route stop"
                ),
            )

        # All pickup stops must be completed
        pickup_stops = (
            db.query(RouteStop)
            .filter(
                RouteStop.route_id == route.id,
                RouteStop.stop_type == RouteStopType.PICKUP,
            )
            .all()
        )

        incomplete = [
            pickup_stop.id
            for pickup_stop in pickup_stops
            if pickup_stop.execution_status
            not in {RouteStopStatus.COMPLETED, RouteStopStatus.FAILED}
        ]

        if incomplete:
            raise HTTPException(
                status_code=409,
                detail=(
                    "All pickup stops must be completed "
                    f"before warehouse handover. "
                    f"Incomplete stops: {incomplete}"
                ),
            )

        # Create warehouse intake.
        intake = create_warehouse_intake(
            db=db,
            route=route,
        )

        stop.execution_status = (
            RouteStopStatus.COMPLETED
        )

        stop.completed_at = now

        route.status = RouteStatus.COMPLETED

        # Driver becomes available after delivering
        # the collected waste to the warehouse.
        driver.is_available = True

        db.commit()
        db.refresh(stop)

        return stop

    raise HTTPException(
        status_code=400,
        detail="Unsupported stop type",
    )


def fail_stop(
    db: Session,
    user: User,
    route_id: int,
    stop_id: int,
    reason: str,
):
    driver, route = get_driver_route(
        db,
        user,
        route_id,
    )

    if route.status != RouteStatus.IN_PROGRESS:
        raise HTTPException(
            status_code=400,
            detail="Route is not in progress",
        )

    stop = (
        db.query(RouteStop)
        .filter(
            RouteStop.id == stop_id,
            RouteStop.route_id == route.id,
        )
        .with_for_update()
        .first()
    )

    if not stop:
        raise HTTPException(
            status_code=404,
            detail="Route stop not found",
        )

    if stop.stop_type != RouteStopType.PICKUP:
        raise HTTPException(
            status_code=400,
            detail="Warehouse stop cannot be failed",
        )

    if stop.execution_status not in {
        RouteStopStatus.ARRIVED,
        RouteStopStatus.IN_PROGRESS,
    }:
        raise HTTPException(
            status_code=400,
            detail="Stop cannot be failed in its current state",
        )

    stop.execution_status = RouteStopStatus.FAILED
    stop.failure_reason = reason
    stop.completed_at = datetime.now(timezone.utc)

    if stop.pickup:
        stop.pickup.status = PickupStatus.FAILED
        stop.pickup.failure_reason = reason

        create_operational_exception(
            db,
            exception_type=OperationalExceptionType.PICKUP_FAILED,
            source_type="PICKUP",
            source_id=stop.pickup.id,
            reason=reason,
        )

    db.commit()
    db.refresh(stop)

    return stop
