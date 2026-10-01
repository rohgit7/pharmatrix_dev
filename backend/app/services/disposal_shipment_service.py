from datetime import datetime, timezone
from decimal import Decimal
import secrets
from app.services.operational_exception_service import (
    create_operational_exception,
)
from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.models.disposal_shipment import (
    DisposalShipment,
    DisposalShipmentItem,
)
from app.models.enums import (
    DisposalShipmentStatus,
    RouteStopType,
)
from app.models.facility import Facility
from app.models.warehouse_intake import (
    WarehouseIntake,
)
from app.services.configuration_runtime_service import (
    get_configuration_float,
)
from app.models.warehouse_intake_item import WarehouseIntakeItem
from app.models.customer import Customer
from app.models.route import Route
from app.models.route_stop import RouteStop
from app.models.pickup import Pickup
from app.services.notification_events import (
    notify_shipment_dispatched,
    notify_shipment_received,
)


def generate_shipment_code() -> str:
    return f"DS-{secrets.token_hex(4).upper()}"

def dispatch_disposal_shipment(
    db: Session,
    shipment_id: int,
) -> DisposalShipment:

    shipment = db.scalar(
        select(DisposalShipment)
        .where(DisposalShipment.id == shipment_id)
        .with_for_update()
    )

    if not shipment:
        raise HTTPException(
            status_code=404,
            detail="Disposal shipment not found",
        )

    if shipment.status != DisposalShipmentStatus.CREATED:
        raise HTTPException(
            status_code=409,
            detail="Only CREATED shipments can be dispatched",
        )

    shipment.status = DisposalShipmentStatus.IN_TRANSIT
    shipment.dispatched_at = datetime.now(timezone.utc)

    facility = db.get(
        Facility,
        shipment.facility_id,
    )

    notify_shipment_dispatched(
        db,
        facility_user_id=facility.user_id,
        shipment_id=shipment.id,
        shipment_code=shipment.shipment_code,
    )

    db.flush()

    return shipment

def receive_disposal_shipment(
    db: Session,
    shipment_id: int,
    received_items: list[dict],
    notes: str | None = None,
) -> DisposalShipment:

    shipment = db.scalar(
        select(DisposalShipment)
        .options(joinedload(DisposalShipment.items))
        .where(DisposalShipment.id == shipment_id)
        .with_for_update()
    )

    if not shipment:
        raise HTTPException(
            status_code=404,
            detail="Disposal shipment not found",
        )

    if shipment.status != DisposalShipmentStatus.IN_TRANSIT:
        raise HTTPException(
            status_code=409,
            detail="Shipment is not in transit",
        )

    item_map = {
        item.id: item
        for item in shipment.items
    }

    supplied_ids = set()

    for received in received_items:
        item_id = received["shipment_item_id"]

        if item_id in supplied_ids:
            raise HTTPException(
                status_code=400,
                detail=f"Duplicate shipment item {item_id}",
            )

        supplied_ids.add(item_id)

        shipment_item = item_map.get(item_id)

        if not shipment_item:
            raise HTTPException(
                status_code=400,
                detail=f"Shipment item {item_id} does not belong to shipment",
            )

        weight = Decimal(
            str(received["received_weight_kg"])
        )

        shipment_item.received_weight_kg = weight

    expected_ids = set(item_map.keys())

    if supplied_ids != expected_ids:
        raise HTTPException(
            status_code=400,
            detail="All shipment items must have received weights",
        )

    total_received = sum(
        (
            Decimal(str(item.received_weight_kg))
            for item in shipment.items
        ),
        Decimal("0"),
    )

    shipment.received_weight_kg = total_received
    shipment.received_at = datetime.now(timezone.utc)
    shipment.notes = notes

    weight_difference = abs(
        total_received
        - Decimal(str(shipment.expected_weight_kg))
    )
    facility_tolerance = get_configuration_float(
        db,
        "weight.facility_tolerance",
    )

    if weight_difference > Decimal(str(facility_tolerance)):
        shipment.status = DisposalShipmentStatus.DISCREPANCY

        create_operational_exception(
            db,
            exception_type=(
                OperationalExceptionType
                .DISPOSAL_SHIPMENT_DISCREPANCY
            ),
            source_type="DISPOSAL_SHIPMENT",
            source_id=shipment.id,
            reason=(
                f"Expected weight: "
                f"{Decimal(str(shipment.expected_weight_kg)):.2f} kg; "
                f"received weight: "
                f"{total_received:.2f} kg; "
                f"difference: "
                f"{weight_difference:.2f} kg"
            ),
        )

    else:
        shipment.status = DisposalShipmentStatus.RECEIVED



    db.flush()
    intake = db.get(WarehouseIntake, shipment.intake_id)

    if intake:
        route = db.get(Route, intake.route_id)

        if route:
            pickup_stops = db.scalars(
                select(RouteStop).where(
                    RouteStop.route_id == route.id,
                    RouteStop.stop_type == RouteStopType.PICKUP,
                )
            ).all()
            notified_users = set()

            for stop in pickup_stops:
                pickup = db.get(Pickup, stop.pickup_id)

                if not pickup:
                    continue

                customer = db.get(Customer, pickup.customer_id)

                if not customer:
                    continue

                if customer.user_id in notified_users:
                    continue

                notify_shipment_received(
                    db,
                    customer_user_id=customer.user_id,
                    shipment_id=shipment.id,
                    shipment_code=shipment.shipment_code,
                )
                notified_users.add(customer.user_id)

    return shipment


def create_disposal_shipment(
    db: Session,
    intake_id: int,
    facility_id: int,
    items: list[dict],
    notes: str | None = None,
) -> DisposalShipment:

    intake = db.scalar(
        select(WarehouseIntake)
        .where(WarehouseIntake.id == intake_id)
        .with_for_update()
    )

    if not intake:
        raise HTTPException(
            status_code=404,
            detail="Warehouse intake not found",
        )

    facility = db.get(Facility, facility_id)

    if not facility or not facility.active:
        raise HTTPException(
            status_code=404,
            detail="Active disposal facility not found",
        )

    if not intake.items:
        raise HTTPException(
            status_code=409,
            detail="Warehouse intake has no classified waste items",
        )

    existing_shipment = db.scalar(
        select(DisposalShipment)
        .where(
            DisposalShipment.intake_id == intake_id,
            DisposalShipment.status != DisposalShipmentStatus.CANCELLED,
        )
    )

    if existing_shipment:
        raise HTTPException(
            status_code=409,
            detail="A disposal shipment already exists for this intake",
        )

    requested_item_ids = {
        item["warehouse_intake_item_id"]
        for item in items
    }

    intake_items = {
        item.id: item
        for item in intake.items
    }

    if len(requested_item_ids) != len(items):
        raise HTTPException(
            status_code=400,
            detail="Duplicate warehouse intake items supplied",
        )

    for item_id in requested_item_ids:
        if item_id not in intake_items:
            raise HTTPException(
                status_code=400,
                detail=f"Warehouse intake item {item_id} does not belong to intake",
            )

    expected_total = Decimal("0")

    shipment = DisposalShipment(
        shipment_code=generate_shipment_code(),
        intake_id=intake.id,
        facility_id=facility.id,
        status=DisposalShipmentStatus.CREATED,
        notes=notes,
    )

    for request_item in items:
        intake_item = intake_items[
            request_item["warehouse_intake_item_id"]
        ]

        requested_weight = Decimal(
            str(request_item["expected_weight_kg"])
        )

        available_weight = Decimal(
            str(intake_item.received_weight_kg)
        )

        if requested_weight > available_weight:
            raise HTTPException(
                status_code=400,
                detail=(
                    f"Shipment weight for intake item {intake_item.id} "
                    f"cannot exceed received weight {available_weight}"
                ),
            )

        shipment_item = DisposalShipmentItem(
            warehouse_intake_item_id=intake_item.id,
            expected_weight_kg=requested_weight,
        )

        shipment.items.append(shipment_item)

        expected_total += requested_weight

    if expected_total <= 0:
        raise HTTPException(
            status_code=400,
            detail="Shipment expected weight must be greater than zero",
        )

    shipment.expected_weight_kg = expected_total

    db.add(shipment)
    db.flush()

    return shipment