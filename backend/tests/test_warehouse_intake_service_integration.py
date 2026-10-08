import uuid
from datetime import datetime, timedelta, timezone

import pytest
from fastapi import HTTPException

from app.models.configuration import (
    Configuration,
    ConfigurationVersion,
)
from app.models.driver import Driver
from app.models.enums import (
    DriverStatus,
    OperationalExceptionStatus,
    OperationalExceptionType,
    RouteStatus,
    RouteStopType,
    UserRole,
    VehicleStatus,
    VehicleType,
    WasteBinColor,
    WasteType,
    WarehouseIntakeStatus,
)
from app.models.operational_exception import OperationalException
from app.models.route import Route
from app.models.user import User
from app.models.vehicle import Vehicle
from app.models.warehouse import Warehouse
from app.models.warehouse_intake import WarehouseIntake
from app.models.warehouse_intake_item import (
    WarehouseIntakeItem,
)

from app.services.warehouse_intake_service import (
    classify_warehouse_intake,
    create_warehouse_intake,
    receive_warehouse_intake,
)


# ---------------------------------------------------------
# Setup
# ---------------------------------------------------------

def make_intake_setup(db):
    suffix = uuid.uuid4().hex

    user = User(
        auth_user_id=uuid.uuid4(),
        name=f"Intake Test Driver {suffix}",
        email=f"intake-driver-{suffix}@test.local",
        role=UserRole.DRIVER,
        is_active=True,
    )
    db.add(user)
    db.flush()

    driver = Driver(
        user_id=user.id,
        employee_id=f"EMP-{suffix[:10]}",
        phone="9876543210",
        license_number=f"LIC-{suffix[:10]}",
        status=DriverStatus.ACTIVE,
        is_available=False,
    )
    db.add(driver)
    db.flush()

    vehicle = Vehicle(
        registration_number=f"KA-{suffix[:10]}",
        vehicle_type=VehicleType.VAN,
        capacity_kg=200,
        status=VehicleStatus.ASSIGNED,
    )
    db.add(vehicle)
    db.flush()

    warehouse = Warehouse(
        code=f"WH-{suffix[:10]}",
        name="Intake Test Warehouse",
        address="Warehouse Road",
        city="Bengaluru",
        state="Karnataka",
        postal_code="560010",
        latitude=12.9716,
        longitude=77.5946,
        active=True,
    )
    db.add(warehouse)
    db.flush()

    route = Route(
        route_code=f"ROUTE-{suffix[:10]}",
        route_date=datetime.now(timezone.utc),
        warehouse_id=warehouse.id,
        driver_id=driver.id,
        vehicle_id=vehicle.id,
        status=RouteStatus.COMPLETED,
        planned_distance_km=20,
        planned_duration_seconds=1800,
    )
    db.add(route)
    db.flush()

    config = (
        db.query(Configuration)
        .filter(
            Configuration.key
            == "weight.facility_tolerance"
        )
        .first()
    )

    created_config = None
    created_version = None

    if config is None:
        config = Configuration(
            key="weight.facility_tolerance",
            description="Warehouse receiving tolerance",
            data_type="DECIMAL",
            scope="GLOBAL",
            is_active=True,
        )
        db.add(config)
        db.flush()

        version = ConfigurationVersion(
            configuration_id=config.id,
            version=1,
            value=0.5,
            status="ACTIVE",
            effective_from=(
                datetime.now(timezone.utc)
                - timedelta(minutes=1)
            ),
            created_by=user.id,
            reason="Warehouse intake integration test",
        )
        db.add(version)
        db.flush()

        config.current_version_id = version.id

        created_config = config
        created_version = version

    db.commit()

    return {
        "user": user,
        "driver": driver,
        "vehicle": vehicle,
        "warehouse": warehouse,
        "route": route,
        "config": created_config,
        "version": created_version,
    }


def create_intake(
    db,
    setup,
    *,
    expected_weight=10.0,
):
    intake = WarehouseIntake(
        intake_code=(
            f"INT-{uuid.uuid4().hex[:10].upper()}"
        ),
        route_id=setup["route"].id,
        warehouse_id=setup["warehouse"].id,
        driver_id=setup["driver"].id,
        vehicle_id=setup["vehicle"].id,
        status=WarehouseIntakeStatus.PENDING,
        expected_weight_kg=expected_weight,
    )

    db.add(intake)
    db.commit()
    db.refresh(intake)

    return intake


def cleanup_setup(db, setup, intake=None):
    if intake is not None:
        db.query(WarehouseIntakeItem).filter(
            WarehouseIntakeItem.intake_id == intake.id
        ).delete(
            synchronize_session=False
        )

        db.query(OperationalException).filter(
            OperationalException.source_type
            == "WAREHOUSE_INTAKE",
            OperationalException.source_id
            == intake.id,
        ).delete(
            synchronize_session=False
        )

        db.delete(intake)
        db.flush()

    if setup["config"] is not None:
        config_id = setup["config"].id
        version_id = (
            setup["version"].id
            if setup["version"] is not None
            else None
        )

        db.query(Configuration).filter(
            Configuration.id == config_id
        ).update(
            {"current_version_id": None},
            synchronize_session=False,
        )

        db.flush()

        if version_id is not None:
            db.query(ConfigurationVersion).filter(
                ConfigurationVersion.id == version_id
            ).delete(
                synchronize_session=False
            )

        db.query(Configuration).filter(
            Configuration.id == config_id
        ).delete(
            synchronize_session=False
        )

        db.flush()

    db.delete(setup["route"])
    db.delete(setup["vehicle"])
    db.delete(setup["driver"])
    db.delete(setup["warehouse"])
    db.delete(setup["user"])

    db.commit()


# ---------------------------------------------------------
# Create warehouse intake
# ---------------------------------------------------------

def test_create_warehouse_intake_requires_collected_weight(
    db,
):
    setup = make_intake_setup(db)

    try:
        with pytest.raises(HTTPException) as exc_info:
            create_warehouse_intake(
                db=db,
                route=setup["route"],
            )

        assert exc_info.value.status_code == 400
        assert exc_info.value.detail == (
            "No collected weight exists for this route"
        )

    finally:
        cleanup_setup(
            db,
            setup,
        )


# ---------------------------------------------------------
# Receive
# ---------------------------------------------------------

def test_receive_intake_within_tolerance(
    db,
):
    setup = make_intake_setup(db)
    intake = create_intake(
        db,
        setup,
        expected_weight=10.0,
    )

    try:
        updated = receive_warehouse_intake(
            db=db,
            intake_id=intake.id,
            received_weight_kg=10.3,
            discrepancy_reason=None,
            notes="Received normally",
        )

        assert updated.status == (
            WarehouseIntakeStatus.RECEIVED
        )
        assert float(
            updated.received_weight_kg
        ) == pytest.approx(10.3)
        assert updated.received_at is not None
        assert updated.notes == "Received normally"
        assert updated.discrepancy_reason is None

        exceptions = (
            db.query(OperationalException)
            .filter(
                OperationalException.source_type
                == "WAREHOUSE_INTAKE",
                OperationalException.source_id
                == intake.id,
            )
            .all()
        )

        assert exceptions == []

    finally:
        cleanup_setup(
            db,
            setup,
            intake,
        )


def test_receive_intake_outside_tolerance_creates_discrepancy(
    db,
):
    setup = make_intake_setup(db)
    intake = create_intake(
        db,
        setup,
        expected_weight=10.0,
    )

    try:
        updated = receive_warehouse_intake(
            db=db,
            intake_id=intake.id,
            received_weight_kg=12.0,
            discrepancy_reason="Weight mismatch",
            notes="Received less than expected",
        )

        assert updated.status == (
            WarehouseIntakeStatus.DISCREPANCY
        )
        assert float(
            updated.received_weight_kg
        ) == pytest.approx(12.0)
        assert updated.discrepancy_reason == (
            "Weight mismatch"
        )

        exception = (
            db.query(OperationalException)
            .filter(
                OperationalException.source_type
                == "WAREHOUSE_INTAKE",
                OperationalException.source_id
                == intake.id,
            )
            .first()
        )

        assert exception is not None
        assert exception.exception_type == (
            OperationalExceptionType
            .WAREHOUSE_INTAKE_DISCREPANCY
        )
        assert exception.status == (
            OperationalExceptionStatus.OPEN
        )
        assert exception.source_id == intake.id
        assert "Expected weight" in exception.reason
        assert "received weight" in exception.reason

    finally:
        cleanup_setup(
            db,
            setup,
            intake,
        )


def test_receive_intake_rejects_missing_intake(
    db,
):
    setup = make_intake_setup(db)

    try:
        with pytest.raises(HTTPException) as exc_info:
            receive_warehouse_intake(
                db=db,
                intake_id=999999999,
                received_weight_kg=10.0,
                discrepancy_reason=None,
                notes=None,
            )

        assert exc_info.value.status_code == 404
        assert exc_info.value.detail == (
            "Warehouse intake not found"
        )

    finally:
        cleanup_setup(
            db,
            setup,
        )


def test_receive_intake_rejects_already_received(
    db,
):
    setup = make_intake_setup(db)
    intake = create_intake(
        db,
        setup,
        expected_weight=10.0,
    )

    try:
        intake.status = WarehouseIntakeStatus.RECEIVED
        db.commit()

        with pytest.raises(HTTPException) as exc_info:
            receive_warehouse_intake(
                db=db,
                intake_id=intake.id,
                received_weight_kg=10.0,
                discrepancy_reason=None,
                notes=None,
            )

        assert exc_info.value.status_code == 400
        assert exc_info.value.detail == (
            "Intake cannot be received from "
            "status RECEIVED"
        )

    finally:
        cleanup_setup(
            db,
            setup,
            intake,
        )


# ---------------------------------------------------------
# Classification
# ---------------------------------------------------------

def test_classify_intake_persists_items_and_received_status(
    db,
):
    setup = make_intake_setup(db)
    intake = create_intake(
        db,
        setup,
        expected_weight=10.0,
    )

    try:
        updated = classify_warehouse_intake(
            db=db,
            intake_id=intake.id,
            items=[
                type(
                    "ClassificationItem",
                    (),
                    {
                        "bin_color": (
                            WasteBinColor.YELLOW
                        ),
                        "waste_type": (
                            WasteType
                            .EXPIRED_DISCARDED_MEDICINE
                        ),
                        "expected_weight_kg": 6.0,
                        "received_weight_kg": 6.0,
                        "notes": "Expired stock",
                    },
                )(),
                type(
                    "ClassificationItem",
                    (),
                    {
                        "bin_color": (
                            WasteBinColor.RED
                        ),
                        "waste_type": (
                            WasteType.SHARPS
                        ),
                        "expected_weight_kg": 4.0,
                        "received_weight_kg": 4.0,
                        "notes": "Sharps",
                    },
                )(),
            ],
        )

        assert updated.status == (
            WarehouseIntakeStatus.RECEIVED
        )
        assert float(
            updated.received_weight_kg
        ) == pytest.approx(10.0)
        assert updated.received_at is not None

        items = (
            db.query(WarehouseIntakeItem)
            .filter(
                WarehouseIntakeItem.intake_id
                == intake.id
            )
            .all()
        )

        assert len(items) == 2

        weights = sorted(
            float(item.received_weight_kg)
            for item in items
        )

        assert weights == [4.0, 6.0]

    finally:
        cleanup_setup(
            db,
            setup,
            intake,
        )


def test_classify_intake_marks_discrepancy_when_total_differs(
    db,
):
    setup = make_intake_setup(db)
    intake = create_intake(
        db,
        setup,
        expected_weight=10.0,
    )

    try:
        updated = classify_warehouse_intake(
            db=db,
            intake_id=intake.id,
            items=[
                type(
                    "ClassificationItem",
                    (),
                    {
                        "bin_color": (
                            WasteBinColor.YELLOW
                        ),
                        "waste_type": (
                            WasteType
                            .EXPIRED_DISCARDED_MEDICINE
                        ),
                        "expected_weight_kg": 5.0,
                        "received_weight_kg": 5.0,
                        "notes": None,
                    },
                )(),
            ],
        )

        assert updated.status == (
            WarehouseIntakeStatus.DISCREPANCY
        )
        assert float(
            updated.received_weight_kg
        ) == pytest.approx(5.0)
        assert updated.discrepancy_reason is not None
        assert "10.00 kg" in (
            updated.discrepancy_reason
        )

    finally:
        cleanup_setup(
            db,
            setup,
            intake,
        )


def test_classify_intake_rejects_duplicate_category(
    db,
):
    setup = make_intake_setup(db)
    intake = create_intake(
        db,
        setup,
        expected_weight=10.0,
    )

    try:
        item = type(
            "ClassificationItem",
            (),
            {
                "bin_color": WasteBinColor.YELLOW,
                "waste_type": (
                    WasteType
                    .EXPIRED_DISCARDED_MEDICINE
                ),
                "expected_weight_kg": 5.0,
                "received_weight_kg": 5.0,
                "notes": None,
            },
        )()

        with pytest.raises(HTTPException) as exc_info:
            classify_warehouse_intake(
                db=db,
                intake_id=intake.id,
                items=[item, item],
            )

        assert exc_info.value.status_code == 400
        assert exc_info.value.detail == (
            "Duplicate classification: "
            "YELLOW / EXPIRED_DISCARDED_MEDICINE"
        )

        db.refresh(intake)

        assert intake.status == (
            WarehouseIntakeStatus.PENDING
        )

    finally:
        cleanup_setup(
            db,
            setup,
            intake,
        )


def test_classify_intake_rejects_zero_received_weight(
    db,
):
    setup = make_intake_setup(db)
    intake = create_intake(
        db,
        setup,
        expected_weight=10.0,
    )

    try:
        item = type(
            "ClassificationItem",
            (),
            {
                "bin_color": WasteBinColor.YELLOW,
                "waste_type": (
                    WasteType
                    .EXPIRED_DISCARDED_MEDICINE
                ),
                "expected_weight_kg": 5.0,
                "received_weight_kg": 0.0,
                "notes": None,
            },
        )()

        with pytest.raises(HTTPException) as exc_info:
            classify_warehouse_intake(
                db=db,
                intake_id=intake.id,
                items=[item],
            )

        assert exc_info.value.status_code == 400
        assert exc_info.value.detail == (
            "Received weight must be greater than zero"
        )

    finally:
        cleanup_setup(
            db,
            setup,
            intake,
        )


def test_classify_intake_rejects_already_classified(
    db,
):
    setup = make_intake_setup(db)
    intake = create_intake(
        db,
        setup,
        expected_weight=10.0,
    )

    try:
        existing_item = WarehouseIntakeItem(
            intake_id=intake.id,
            bin_color=WasteBinColor.YELLOW,
            waste_type=(
                WasteType.EXPIRED_DISCARDED_MEDICINE
            ),
            expected_weight_kg=10.0,
            received_weight_kg=10.0,
            notes=None,
        )

        db.add(existing_item)
        db.commit()

        item = type(
            "ClassificationItem",
            (),
            {
                "bin_color": WasteBinColor.RED,
                "waste_type": WasteType.SHARPS,
                "expected_weight_kg": 2.0,
                "received_weight_kg": 2.0,
                "notes": None,
            },
        )()

        with pytest.raises(HTTPException) as exc_info:
            classify_warehouse_intake(
                db=db,
                intake_id=intake.id,
                items=[item],
            )

        assert exc_info.value.status_code == 409
        assert exc_info.value.detail == (
            "Warehouse intake has already been classified"
        )

    finally:
        cleanup_setup(
            db,
            setup,
            intake,
        )