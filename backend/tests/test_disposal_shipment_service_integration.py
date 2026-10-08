from datetime import datetime, timezone

from decimal import Decimal

import uuid

import pytest

from fastapi import HTTPException

from sqlalchemy import select

from app.models.customer import Customer

from app.models.configuration import Configuration, ConfigurationVersion

from app.models.customer_location import CustomerLocation

from app.models.driver import Driver

from app.models.enums import (

    CustomerType,

    DisposalShipmentStatus,

    DriverStatus,

    OperationalExceptionStatus,

    OperationalExceptionType,

    PickupPriority,

    PickupStatus,

    RouteStatus,

    RouteStopStatus,

    RouteStopType,

    UserRole,

    VehicleStatus,

    VehicleType,

    WarehouseIntakeStatus,

    WasteBinColor,

    WasteType,

)

from app.models.facility import Facility

from app.models.operational_exception import OperationalException

from app.models.pickup import Pickup

from app.models.route import Route

from app.models.route_stop import RouteStop

from app.models.user import User

from app.models.vehicle import Vehicle

from app.models.warehouse import Warehouse

from app.models.warehouse_intake import WarehouseIntake

from app.models.warehouse_intake_item import WarehouseIntakeItem

from app.services.disposal_shipment_service import (

    create_disposal_shipment,

    dispatch_disposal_shipment,

    receive_disposal_shipment,

)

# ============================================================

# Helpers

# ============================================================

def make_user(db, role=UserRole.FACILITY):

    suffix = uuid.uuid4().hex

    user = User(

        auth_user_id=uuid.uuid4(),

        name=f"Disposal Test User {suffix}",

        email=f"disposal-{suffix}@test.local",

        role=role,

        is_active=True,

)

    db.add(user)

    db.flush()

    return user

def make_facility(db, active=True):

    user = make_user(db, role=UserRole.FACILITY)

    suffix = uuid.uuid4().hex[:10].upper()

    facility = Facility(

        user_id=user.id,

        facility_code=f"FAC-{suffix}",

        legal_name=f"Test Disposal Facility {suffix}",

        phone="9876543210",

        email=f"facility-{suffix}@test.local",

        license_number=f"LIC-{suffix}",

        license_expiry=datetime(2030, 12, 31, tzinfo=timezone.utc),

        address="Facility Road",

        city="Bengaluru",

        state="Karnataka",

        postal_code="560020",

        latitude=12.9716,

        longitude=77.5946,

        active=active,

)

    db.add(facility)

    db.flush()

    return facility, user

def make_warehouse(db):

    suffix = uuid.uuid4().hex[:10].upper()

    warehouse = Warehouse(

        code=f"WH-{suffix}",

        name=f"Test Warehouse {suffix}",

        address="Warehouse Road",

        city="Bengaluru",

        state="Karnataka",

        postal_code="560001",

        latitude=12.9716,

        longitude=77.5946,

        active=True,

)

    db.add(warehouse)

    db.flush()

    return warehouse

def make_driver(db):

    user = make_user(db, role=UserRole.DRIVER)

    suffix = uuid.uuid4().hex[:10].upper()

    driver = Driver(

        user_id=user.id,

        employee_id=f"EMP-{suffix}",

        phone="9876543210",

        license_number=f"DL-{suffix}",

        license_expiry=datetime(2030, 12, 31, tzinfo=timezone.utc).date(),

        status=DriverStatus.ACTIVE,

        is_available=True,

)

    db.add(driver)

    db.flush()

    return driver, user

def make_vehicle(db):

    suffix = uuid.uuid4().hex[:10].upper()

    vehicle = Vehicle(

        registration_number=f"KA01{suffix[:6]}",

        vehicle_type=VehicleType.VAN,

        capacity_kg=Decimal("1000.00"),

        status=VehicleStatus.AVAILABLE,

)

    db.add(vehicle)

    db.flush()

    return vehicle

def make_customer(db):

    user = make_user(db, role=UserRole.CUSTOMER)

    suffix = uuid.uuid4().hex[:8]

    customer = Customer(

        user_id=user.id,

        customer_type=CustomerType.PHARMACY,

        legal_name=f"Customer {suffix}",

        display_name=f"Customer {suffix}",

        phone="9900000000",

        email=f"customer-{suffix}@test.local",

        is_active=True,

)

    db.add(customer)

    db.flush()

    location = CustomerLocation(

        customer_id=customer.id,

        location_code=f"LOC-{suffix}",

        name=f"Customer Location {suffix}",

        address_line_1="Sample Street",

        city="Bengaluru",

        state="Karnataka",

        postal_code="560001",

        latitude=12.9716,

        longitude=77.5946,

        contact_name="Customer Contact",

        contact_phone="9900000000",

        service_time_seconds=300,

        pickup_enabled=True,

        is_active=True,

)

    db.add(location)

    db.flush()

    pickup = Pickup(

        pickup_code=f"PU-{suffix}",

        customer_id=customer.id,

        location_id=location.id,

        status=PickupStatus.COLLECTED,

        priority=PickupPriority.NORMAL,

        estimated_weight_kg=Decimal("30.00"),

        verification_token=f"verify-{suffix}",

)

    db.add(pickup)

    db.flush()

    return customer, location, pickup

def make_route(db, warehouse, driver, vehicle):

    suffix = uuid.uuid4().hex[:10].upper()

    route = Route(

        route_code=f"RT-{suffix}",

        route_date=datetime.now(timezone.utc),

        warehouse_id=warehouse.id,

        driver_id=driver.id,

        vehicle_id=vehicle.id,

        status=RouteStatus.COMPLETED,

)

    db.add(route)

    db.flush()

    return route

def make_intake_setup(db):

    facility, facility_user = make_facility(db)

    warehouse = make_warehouse(db)

    driver, driver_user = make_driver(db)

    vehicle = make_vehicle(db)

    customer, _, pickup = make_customer(db)

    facility_tolerance_config = Configuration(
        key="weight.facility_tolerance",
        description="Allowed facility receiving weight tolerance",
        data_type="DECIMAL",
        scope="GLOBAL",
        is_active=True,
)
    db.add(facility_tolerance_config)
    db.flush()

    facility_tolerance_version = ConfigurationVersion(
        configuration_id=facility_tolerance_config.id,
        version=1,
        value=5,
        status="ACTIVE",
        effective_from=datetime.now(timezone.utc),
        created_by=facility_user.id,
        reason="Disposal shipment integration test",
)
    db.add(facility_tolerance_version)
    db.flush()

    facility_tolerance_config.current_version_id = facility_tolerance_version.id
    db.flush()

    route = make_route(db=db, warehouse=warehouse, driver=driver, vehicle=vehicle)

    pickup_stop = RouteStop(

        route_id=route.id,

        sequence_number=1,

        stop_type=RouteStopType.PICKUP,

        pickup_id=pickup.id,

        execution_status=RouteStopStatus.COMPLETED,

        collected_weight_kg=Decimal("30.00"),

)

    warehouse_stop = RouteStop(

        route_id=route.id,

        sequence_number=2,

        stop_type=RouteStopType.WAREHOUSE,

        warehouse_id=warehouse.id,

        execution_status=RouteStopStatus.COMPLETED,

)

    db.add_all([pickup_stop, warehouse_stop])

    db.flush()

    intake = WarehouseIntake(

        intake_code=f"INT-{uuid.uuid4().hex[:10].upper()}",

        route_id=route.id,

        warehouse_id=warehouse.id,

        driver_id=driver.id,

        vehicle_id=vehicle.id,

        status=WarehouseIntakeStatus.PENDING,

        expected_weight_kg=Decimal("30.00"),

        received_weight_kg=Decimal("30.00"),

        received_at=datetime.now(timezone.utc),

)

    db.add(intake)

    db.flush()

    item_1 = WarehouseIntakeItem(

        intake_id=intake.id,

        bin_color=WasteBinColor.YELLOW,

        waste_type=WasteType.HUMAN_ANATOMICAL,

        expected_weight_kg=Decimal("10.00"),

        received_weight_kg=Decimal("10.00"),

)

    item_2 = WarehouseIntakeItem(

        intake_id=intake.id,

        bin_color=WasteBinColor.RED,

        waste_type=WasteType.SOILED,

        expected_weight_kg=Decimal("20.00"),

        received_weight_kg=Decimal("20.00"),

)

    db.add_all([item_1, item_2])

    db.flush()

    return {

        "facility": facility,

        "facility_user": facility_user,

        "warehouse": warehouse,

        "driver": driver,

        "driver_user": driver_user,

        "vehicle": vehicle,

        "customer": customer,

        "pickup": pickup,

        "route": route,

        "intake": intake,

        "items": [item_1, item_2],

    }

def create_shipment(db, setup):

    shipment = create_disposal_shipment(

        db=db,

        intake_id=setup["intake"].id,

        facility_id=setup["facility"].id,

        items=[

            {"warehouse_intake_item_id": setup["items"][0].id, "expected_weight_kg": Decimal("5.00")},

            {"warehouse_intake_item_id": setup["items"][1].id, "expected_weight_kg": Decimal("10.00")},

        ],

        notes="Test disposal shipment",

)

    db.flush()

    return shipment

def received_items(shipment, first=Decimal("5.00"), second=Decimal("10.00")):

    return [

        {"shipment_item_id": shipment.items[0].id, "received_weight_kg": first},

        {"shipment_item_id": shipment.items[1].id, "received_weight_kg": second},

]

# ============================================================

# CREATE SHIPMENT

# ============================================================

def test_create_disposal_shipment_persists_shipment_and_items(db):

    setup = make_intake_setup(db)

    shipment = create_shipment(db, setup)

    assert shipment.id is not None

    assert shipment.shipment_code is not None

    assert shipment.intake_id == setup["intake"].id

    assert shipment.facility_id == setup["facility"].id

    assert shipment.status == DisposalShipmentStatus.CREATED

    db.refresh(shipment)

    assert len(shipment.items) == 2

    assert shipment.expected_weight_kg == Decimal("15.00")

def test_create_disposal_shipment_rejects_missing_intake(db):

    setup = make_intake_setup(db)

    with pytest.raises(HTTPException) as exc:

        create_disposal_shipment(

            db=db,

            intake_id=999999999,

            facility_id=setup["facility"].id,

            items=[

                {"warehouse_intake_item_id": setup["items"][0].id, "expected_weight_kg": Decimal("5.00")},

            ],

        )

    assert exc.value.status_code == 404

def test_create_disposal_shipment_rejects_inactive_facility(db):

    setup = make_intake_setup(db)

    setup["facility"].active = False

    db.flush()

    with pytest.raises(HTTPException) as exc:

        create_disposal_shipment(

            db=db,

            intake_id=setup["intake"].id,

            facility_id=setup["facility"].id,

            items=[

                {"warehouse_intake_item_id": setup["items"][0].id, "expected_weight_kg": Decimal("5.00")},

            ],

        )

    assert exc.value.status_code == 404

def test_create_disposal_shipment_rejects_no_classified_items(db):

    setup = make_intake_setup(db)

    db.query(WarehouseIntakeItem).filter(

        WarehouseIntakeItem.intake_id == setup["intake"].id

    ).delete()

    db.flush()

    with pytest.raises(HTTPException) as exc:

        create_disposal_shipment(

            db=db,

            intake_id=setup["intake"].id,

            facility_id=setup["facility"].id,

            items=[

                {"warehouse_intake_item_id": 999999999, "expected_weight_kg": Decimal("5.00")},

            ],

        )

    assert exc.value.status_code == 409

def test_create_disposal_shipment_rejects_duplicate_items(db):

    setup = make_intake_setup(db)

    with pytest.raises(HTTPException) as exc:

        create_disposal_shipment(

            db=db,

            intake_id=setup["intake"].id,

            facility_id=setup["facility"].id,

            items=[

                {"warehouse_intake_item_id": setup["items"][0].id, "expected_weight_kg": Decimal("2.00")},

                {"warehouse_intake_item_id": setup["items"][0].id, "expected_weight_kg": Decimal("2.00")},

            ],

        )

    assert exc.value.status_code == 400

def test_create_disposal_shipment_rejects_item_from_another_intake(db):

    setup_a = make_intake_setup(db)

    setup_b = make_intake_setup(db)

    with pytest.raises(HTTPException) as exc:

        create_disposal_shipment(

            db=db,

            intake_id=setup_a["intake"].id,

            facility_id=setup_a["facility"].id,

            items=[

                {"warehouse_intake_item_id": setup_b["items"][0].id, "expected_weight_kg": Decimal("5.00")},

            ],

        )

    assert exc.value.status_code == 400

def test_create_disposal_shipment_rejects_weight_above_received(db):

    setup = make_intake_setup(db)

    with pytest.raises(HTTPException) as exc:

        create_disposal_shipment(

            db=db,

            intake_id=setup["intake"].id,

            facility_id=setup["facility"].id,

            items=[

                {"warehouse_intake_item_id": setup["items"][0].id, "expected_weight_kg": Decimal("100.00")},

            ],

        )

    assert exc.value.status_code == 400

def test_create_disposal_shipment_rejects_zero_total(db):

    setup = make_intake_setup(db)

    with pytest.raises(HTTPException) as exc:

        create_disposal_shipment(

            db=db,

            intake_id=setup["intake"].id,

            facility_id=setup["facility"].id,

            items=[

                {"warehouse_intake_item_id": setup["items"][0].id, "expected_weight_kg": Decimal("0")},

            ],

        )

    assert exc.value.status_code in (400, 422)

def test_create_disposal_shipment_rejects_duplicate_active_shipment(db):

    setup = make_intake_setup(db)

    create_shipment(db, setup)

    with pytest.raises(HTTPException) as exc:

        create_disposal_shipment(

            db=db,

            intake_id=setup["intake"].id,

            facility_id=setup["facility"].id,

            items=[

                {"warehouse_intake_item_id": setup["items"][0].id, "expected_weight_kg": Decimal("2.00")},

            ],

        )

    assert exc.value.status_code == 409

# ============================================================

# DISPATCH

# ============================================================

def test_dispatch_disposal_shipment_changes_status_to_in_transit(db):

    setup = make_intake_setup(db)

    shipment = create_shipment(db, setup)

    result = dispatch_disposal_shipment(db=db, shipment_id=shipment.id)

    assert result.id == shipment.id

    assert result.status == DisposalShipmentStatus.IN_TRANSIT

    assert result.dispatched_at is not None

def test_dispatch_disposal_shipment_rejects_missing_shipment(db):

    with pytest.raises(HTTPException) as exc:

        dispatch_disposal_shipment(db=db, shipment_id=999999999)

    assert exc.value.status_code == 404

def test_dispatch_disposal_shipment_rejects_already_dispatched(db):

    setup = make_intake_setup(db)

    shipment = create_shipment(db, setup)

    dispatch_disposal_shipment(db=db, shipment_id=shipment.id)

    with pytest.raises(HTTPException) as exc:

        dispatch_disposal_shipment(db=db, shipment_id=shipment.id)

    assert exc.value.status_code == 409

# ============================================================

# RECEIVE

# ============================================================

def test_receive_disposal_shipment_changes_status_to_received(db):

    setup = make_intake_setup(db)

    shipment = create_shipment(db, setup)

    dispatch_disposal_shipment(db=db, shipment_id=shipment.id)

    result = receive_disposal_shipment(

        db=db,

        shipment_id=shipment.id,

        received_items=received_items(shipment),

)

    assert result.id == shipment.id

    assert result.status == DisposalShipmentStatus.RECEIVED

    assert result.received_weight_kg == Decimal("15.00")

    db.refresh(result)

    assert result.items[0].received_weight_kg == Decimal("5.00")

    assert result.items[1].received_weight_kg == Decimal("10.00")

def test_receive_disposal_shipment_rejects_missing_shipment(db):

    with pytest.raises(HTTPException) as exc:

        receive_disposal_shipment(db=db, shipment_id=999999999, received_items=[])

    assert exc.value.status_code == 404

def test_receive_disposal_shipment_rejects_created_shipment(db):

    setup = make_intake_setup(db)

    shipment = create_shipment(db, setup)

    with pytest.raises(HTTPException) as exc:

        receive_disposal_shipment(

            db=db,

            shipment_id=shipment.id,

            received_items=received_items(shipment),

        )

    assert exc.value.status_code == 409

def test_receive_disposal_shipment_rejects_missing_item(db):

    setup = make_intake_setup(db)

    shipment = create_shipment(db, setup)

    dispatch_disposal_shipment(db=db, shipment_id=shipment.id)

    with pytest.raises(HTTPException) as exc:

        receive_disposal_shipment(

            db=db,

            shipment_id=shipment.id,

            received_items=[

                {"shipment_item_id": shipment.items[0].id, "received_weight_kg": Decimal("5.00")},

            ],

        )

    assert exc.value.status_code == 400

def test_receive_disposal_shipment_rejects_unknown_item(db):

    setup = make_intake_setup(db)

    shipment = create_shipment(db, setup)

    dispatch_disposal_shipment(db=db, shipment_id=shipment.id)

    items = received_items(shipment)

    items.append({"shipment_item_id": 999999999, "received_weight_kg": Decimal("1.00")})

    with pytest.raises(HTTPException) as exc:

        receive_disposal_shipment(db=db, shipment_id=shipment.id, received_items=items)

    assert exc.value.status_code == 400

def test_receive_disposal_shipment_rejects_duplicate_received_item(db):

    setup = make_intake_setup(db)

    shipment = create_shipment(db, setup)

    dispatch_disposal_shipment(db=db, shipment_id=shipment.id)

    with pytest.raises(HTTPException) as exc:

        receive_disposal_shipment(

            db=db,

            shipment_id=shipment.id,

            received_items=[

                {"shipment_item_id": shipment.items[0].id, "received_weight_kg": Decimal("5.00")},

                {"shipment_item_id": shipment.items[0].id, "received_weight_kg": Decimal("5.00")},

            ],

        )

    assert exc.value.status_code == 400

def test_receive_disposal_shipment_rejects_item_from_another_shipment(db):

    setup_a = make_intake_setup(db)

    setup_b = make_intake_setup(db)

    shipment_a = create_shipment(db, setup_a)

    shipment_b = create_shipment(db, setup_b)

    dispatch_disposal_shipment(db=db, shipment_id=shipment_a.id)

    dispatch_disposal_shipment(db=db, shipment_id=shipment_b.id)

    with pytest.raises(HTTPException) as exc:

        receive_disposal_shipment(

            db=db,

            shipment_id=shipment_a.id,

            received_items=[

                {"shipment_item_id": shipment_b.items[0].id, "received_weight_kg": Decimal("5.00")},

                {"shipment_item_id": shipment_a.items[1].id, "received_weight_kg": Decimal("10.00")},

            ],

        )

    assert exc.value.status_code == 400

# ============================================================

# DISCREPANCY

# ============================================================

def test_receive_disposal_shipment_creates_discrepancy_when_outside_tolerance(db, monkeypatch):

    setup = make_intake_setup(db)

    shipment = create_shipment(db, setup)

    dispatch_disposal_shipment(db=db, shipment_id=shipment.id)

    monkeypatch.setattr(

        "app.services.disposal_shipment_service.get_configuration_float",

        lambda db, key: 0.50,

)

    result = receive_disposal_shipment(

        db=db,

        shipment_id=shipment.id,

        received_items=received_items(

            shipment,

            first=Decimal("1.00"),

            second=Decimal("2.00"),

        ),

)

    assert result.status == DisposalShipmentStatus.DISCREPANCY

    assert result.received_weight_kg == Decimal("3.00")

    exception = db.scalar(

        select(OperationalException).where(

            OperationalException.source_id == shipment.id,

            OperationalException.source_type == "DISPOSAL_SHIPMENT",

            OperationalException.exception_type == OperationalExceptionType.DISPOSAL_SHIPMENT_DISCREPANCY,

        )

)

    assert exception is not None

    assert exception.status == OperationalExceptionStatus.OPEN
