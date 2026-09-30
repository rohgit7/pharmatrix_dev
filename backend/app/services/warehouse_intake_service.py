from datetime import datetime, timezone
from uuid import uuid4

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models.driver import Driver
from app.models.enums import (
    RouteStatus,
    RouteStopStatus,
    RouteStopType,
    WarehouseIntakeStatus,
)
from app.models.route import Route
from app.models.route_stop import RouteStop
from app.models.user import User
from app.models.warehouse_intake import WarehouseIntake
from app.models.enums import (
    WarehouseIntakeStatus,
)
from app.models.warehouse_intake_item import WarehouseIntakeItem

def classify_warehouse_intake(
    db: Session,
    intake_id: int,
    items,
):
    intake = (
        db.query(WarehouseIntake)
        .filter(
            WarehouseIntake.id == intake_id
        )
        .with_for_update()
        .first()
    )

    if not intake:
        raise HTTPException(
            status_code=404,
            detail="Warehouse intake not found",
        )

    if intake.status != WarehouseIntakeStatus.PENDING:
        raise HTTPException(
            status_code=400,
            detail=(
                f"Intake cannot be classified from "
                f"status {intake.status.value}"
            ),
        )

    existing_items = (
        db.query(WarehouseIntakeItem)
        .filter(
            WarehouseIntakeItem.intake_id == intake.id
        )
        .all()
    )

    if existing_items:
        raise HTTPException(
            status_code=409,
            detail="Warehouse intake has already been classified",
        )

    expected_total = 0.0
    received_total = 0.0

    seen = set()

    for item in items:
        key = (
            item.bin_color.value,
            item.waste_type.value,
        )

        if key in seen:
            raise HTTPException(
                status_code=400,
                detail=(
                    f"Duplicate classification: "
                    f"{item.bin_color.value} / "
                    f"{item.waste_type.value}"
                ),
            )

        seen.add(key)

        if (
            item.received_weight_kg
            <= 0
        ):
            raise HTTPException(
                status_code=400,
                detail="Received weight must be greater than zero",
            )

        expected_total += (
            item.expected_weight_kg
        )

        received_total += (
            item.received_weight_kg
        )

        intake_item = WarehouseIntakeItem(
            intake_id=intake.id,
            bin_color=item.bin_color,
            waste_type=item.waste_type,
            expected_weight_kg=item.expected_weight_kg,
            received_weight_kg=item.received_weight_kg,
            notes=item.notes,
        )

        db.add(intake_item)

    # Compare category totals against route collection total.
    route_expected = float(
        intake.expected_weight_kg
    )

    discrepancy = abs(
        received_total - route_expected
    )

    intake.received_weight_kg = received_total
    intake.received_at = datetime.now(
        timezone.utc
    )

    if discrepancy > 0.01:
        intake.status = (
            WarehouseIntakeStatus.DISCREPANCY
        )

        intake.discrepancy_reason = (
            f"Route expected "
            f"{route_expected:.2f} kg, "
            f"warehouse received "
            f"{received_total:.2f} kg."
        )
    else:
        intake.status = (
            WarehouseIntakeStatus.RECEIVED
        )

        intake.discrepancy_reason = None

    db.commit()
    db.refresh(intake)

    return intake

def generate_intake_code() -> str:
    return f"INT-{uuid4().hex[:10].upper()}"


def calculate_route_collected_weight(
    db: Session,
    route_id: int,
) -> float:
    stops = (
        db.query(RouteStop)
        .filter(
            RouteStop.route_id == route_id,
            RouteStop.stop_type == RouteStopType.PICKUP,
        )
        .all()
    )

    return round(
        sum(
            float(stop.collected_weight_kg or 0)
            for stop in stops
        ),
        2,
    )


def create_warehouse_intake(
    db: Session,
    route: Route,
) -> WarehouseIntake:

    existing = (
        db.query(WarehouseIntake)
        .filter(
            WarehouseIntake.route_id == route.id
        )
        .first()
    )

    if existing:
        return existing

    if not route.driver_id:
        raise HTTPException(
            status_code=400,
            detail="Route has no driver assigned",
        )

    if not route.vehicle_id:
        raise HTTPException(
            status_code=400,
            detail="Route has no vehicle assigned",
        )

    expected_weight = calculate_route_collected_weight(
        db=db,
        route_id=route.id,
    )

    if expected_weight <= 0:
        raise HTTPException(
            status_code=400,
            detail="No collected weight exists for this route",
        )

    intake = WarehouseIntake(
        intake_code=generate_intake_code(),
        route_id=route.id,
        warehouse_id=route.warehouse_id,
        driver_id=route.driver_id,
        vehicle_id=route.vehicle_id,
        status=WarehouseIntakeStatus.PENDING,
        expected_weight_kg=expected_weight,
    )

    db.add(intake)
    db.flush()

    return intake


def receive_warehouse_intake(
    db: Session,
    intake_id: int,
    received_weight_kg: float,
    discrepancy_reason: str | None,
    notes: str | None,
):
    intake = (
        db.query(WarehouseIntake)
        .filter(
            WarehouseIntake.id == intake_id
        )
        .with_for_update()
        .first()
    )

    if not intake:
        raise HTTPException(
            status_code=404,
            detail="Warehouse intake not found",
        )

    if intake.status != WarehouseIntakeStatus.PENDING:
        raise HTTPException(
            status_code=400,
            detail=(
                f"Intake cannot be received from "
                f"status {intake.status.value}"
            ),
        )

    intake.received_weight_kg = received_weight_kg
    intake.received_at = datetime.now(timezone.utc)

    intake.notes = notes
    intake.discrepancy_reason = discrepancy_reason

    if abs(
        received_weight_kg
        - float(intake.expected_weight_kg)
    ) > 0.01:
        intake.status = (
            WarehouseIntakeStatus.DISCREPANCY
        )
    else:
        intake.status = (
            WarehouseIntakeStatus.RECEIVED
        )

    db.commit()
    db.refresh(intake)

    return intake