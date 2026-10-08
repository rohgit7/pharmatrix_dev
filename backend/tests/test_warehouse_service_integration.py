import uuid

import pytest
from fastapi import HTTPException

from app.models.warehouse import Warehouse
from app.schemas.warehouse import WarehouseUpdate
from app.services.warehouse_services import (
    create_warehouse,
    get_warehouse,
    list_warehouses,
    update_warehouse,
)


# ---------------------------------------------------------
# Helpers
# ---------------------------------------------------------

def make_warehouse_data():
    suffix = uuid.uuid4().hex[:8]

    return {
        "code": f"WH-{suffix}",
        "name": f"Test Warehouse {suffix}",
        "address": "Warehouse Road",
        "city": "Bengaluru",
        "state": "Karnataka",
        "postal_code": "560010",
        "latitude": 12.9716,
        "longitude": 77.5946,
    }


def cleanup_warehouse(db, warehouse):
    if warehouse is not None:
        db.delete(warehouse)
        db.commit()


# ---------------------------------------------------------
# Create
# ---------------------------------------------------------

def test_create_warehouse_persists_data(db):
    data = make_warehouse_data()
    warehouse = None

    try:
        warehouse = create_warehouse(
            db=db,
            **data,
        )

        assert warehouse.id is not None
        assert warehouse.code == data["code"]
        assert warehouse.name == data["name"]
        assert warehouse.address == data["address"]
        assert warehouse.city == data["city"]
        assert warehouse.state == data["state"]
        assert warehouse.postal_code == data["postal_code"]
        assert float(warehouse.latitude) == pytest.approx(
            data["latitude"]
        )
        assert float(warehouse.longitude) == pytest.approx(
            data["longitude"]
        )
        assert warehouse.active is True

        saved = db.get(Warehouse, warehouse.id)

        assert saved is not None
        assert saved.code == data["code"]

    finally:
        cleanup_warehouse(db, warehouse)


def test_create_warehouse_rejects_duplicate_code(db):
    data = make_warehouse_data()
    warehouse = None

    try:
        warehouse = create_warehouse(
            db=db,
            **data,
        )

        with pytest.raises(HTTPException) as exc_info:
            create_warehouse(
                db=db,
                **data,
            )

        assert exc_info.value.status_code == 409
        assert exc_info.value.detail == (
            "Warehouse code already exists"
        )

    finally:
        cleanup_warehouse(db, warehouse)


def test_create_warehouse_rejects_invalid_latitude(db):
    data = make_warehouse_data()
    data["latitude"] = 91

    with pytest.raises(HTTPException) as exc_info:
        create_warehouse(
            db=db,
            **data,
        )

    assert exc_info.value.status_code == 400
    assert exc_info.value.detail == (
        "Invalid latitude"
    )


def test_create_warehouse_rejects_invalid_longitude(db):
    data = make_warehouse_data()
    data["longitude"] = 181

    with pytest.raises(HTTPException) as exc_info:
        create_warehouse(
            db=db,
            **data,
        )

    assert exc_info.value.status_code == 400
    assert exc_info.value.detail == (
        "Invalid longitude"
    )


def test_create_warehouse_accepts_coordinate_boundaries(
    db,
):
    data = make_warehouse_data()
    data["latitude"] = 90
    data["longitude"] = 180

    warehouse = None

    try:
        warehouse = create_warehouse(
            db=db,
            **data,
        )

        assert warehouse.latitude == 90
        assert warehouse.longitude == 180

    finally:
        cleanup_warehouse(db, warehouse)


# ---------------------------------------------------------
# Get
# ---------------------------------------------------------

def test_get_warehouse_returns_persisted_warehouse(
    db,
):
    data = make_warehouse_data()
    warehouse = None

    try:
        warehouse = create_warehouse(
            db=db,
            **data,
        )

        result = get_warehouse(
            db=db,
            warehouse_id=warehouse.id,
        )

        assert result.id == warehouse.id
        assert result.code == data["code"]

    finally:
        cleanup_warehouse(db, warehouse)


def test_get_warehouse_rejects_missing_warehouse(db):
    with pytest.raises(HTTPException) as exc_info:
        get_warehouse(
            db=db,
            warehouse_id=999999999,
        )

    assert exc_info.value.status_code == 404
    assert exc_info.value.detail == (
        "Warehouse not found"
    )


# ---------------------------------------------------------
# List
# ---------------------------------------------------------

def test_list_warehouses_excludes_inactive_by_default(
    db,
):
    active_data = make_warehouse_data()
    inactive_data = make_warehouse_data()

    active = None
    inactive = None

    try:
        active = create_warehouse(
            db=db,
            **active_data,
        )

        inactive = create_warehouse(
            db=db,
            **inactive_data,
        )

        inactive.active = False
        db.commit()

        warehouses = list_warehouses(
            db=db,
            include_inactive=False,
        )

        ids = [warehouse.id for warehouse in warehouses]

        assert active.id in ids
        assert inactive.id not in ids

    finally:
        cleanup_warehouse(db, active)
        cleanup_warehouse(db, inactive)


def test_list_warehouses_can_include_inactive(db):
    active_data = make_warehouse_data()
    inactive_data = make_warehouse_data()

    active = None
    inactive = None

    try:
        active = create_warehouse(
            db=db,
            **active_data,
        )

        inactive = create_warehouse(
            db=db,
            **inactive_data,
        )

        inactive.active = False
        db.commit()

        warehouses = list_warehouses(
            db=db,
            include_inactive=True,
        )

        ids = [warehouse.id for warehouse in warehouses]

        assert active.id in ids
        assert inactive.id in ids

    finally:
        cleanup_warehouse(db, active)
        cleanup_warehouse(db, inactive)


def test_list_warehouses_orders_by_name(db):
    data_a = make_warehouse_data()
    data_b = make_warehouse_data()

    data_a["name"] = "AAA Test Warehouse"
    data_b["name"] = "ZZZ Test Warehouse"

    warehouse_a = None
    warehouse_b = None

    try:
        warehouse_a = create_warehouse(
            db=db,
            **data_a,
        )

        warehouse_b = create_warehouse(
            db=db,
            **data_b,
        )

        warehouses = list_warehouses(
            db=db,
            include_inactive=True,
        )

        ids = [warehouse.id for warehouse in warehouses]

        assert ids.index(warehouse_a.id) < ids.index(
            warehouse_b.id
        )

    finally:
        cleanup_warehouse(db, warehouse_a)
        cleanup_warehouse(db, warehouse_b)


# ---------------------------------------------------------
# Update
# ---------------------------------------------------------

def test_update_warehouse_persists_changes(db):
    data = make_warehouse_data()
    warehouse = None

    try:
        warehouse = create_warehouse(
            db=db,
            **data,
        )

        updated = update_warehouse(
            db=db,
            warehouse_id=warehouse.id,
            data=WarehouseUpdate(
                name="Updated Warehouse",
                city="Mysuru",
                latitude=13.3409,
                active=False,
            ),
        )

        assert updated.name == "Updated Warehouse"
        assert updated.city == "Mysuru"
        assert float(updated.latitude) == pytest.approx(
            13.3409
        )
        assert updated.active is False

        db.refresh(warehouse)

        assert warehouse.name == "Updated Warehouse"
        assert warehouse.city == "Mysuru"
        assert warehouse.active is False

    finally:
        cleanup_warehouse(db, warehouse)


def test_update_warehouse_rejects_duplicate_code(db):
    data_a = make_warehouse_data()
    data_b = make_warehouse_data()

    warehouse_a = None
    warehouse_b = None

    try:
        warehouse_a = create_warehouse(
            db=db,
            **data_a,
        )

        warehouse_b = create_warehouse(
            db=db,
            **data_b,
        )

        with pytest.raises(HTTPException) as exc_info:
            update_warehouse(
                db=db,
                warehouse_id=warehouse_b.id,
                data=WarehouseUpdate(
                    code=warehouse_a.code,
                ),
            )

        assert exc_info.value.status_code == 409
        assert exc_info.value.detail == (
            "Warehouse code already exists"
        )

    finally:
        cleanup_warehouse(db, warehouse_a)
        cleanup_warehouse(db, warehouse_b)


def test_update_warehouse_rejects_invalid_latitude(
    db,
):
    data = make_warehouse_data()
    warehouse = None

    try:
        warehouse = create_warehouse(
            db=db,
            **data,
        )

        with pytest.raises(HTTPException) as exc_info:
            update_warehouse(
                db=db,
                warehouse_id=warehouse.id,
                data=WarehouseUpdate(
                    latitude=91,
                ),
            )

        assert exc_info.value.status_code == 400
        assert exc_info.value.detail == (
            "Invalid latitude"
        )

    finally:
        cleanup_warehouse(db, warehouse)


def test_update_warehouse_rejects_invalid_longitude(
    db,
):
    data = make_warehouse_data()
    warehouse = None

    try:
        warehouse = create_warehouse(
            db=db,
            **data,
        )

        with pytest.raises(HTTPException) as exc_info:
            update_warehouse(
                db=db,
                warehouse_id=warehouse.id,
                data=WarehouseUpdate(
                    longitude=181,
                ),
            )

        assert exc_info.value.status_code == 400
        assert exc_info.value.detail == (
            "Invalid longitude"
        )

    finally:
        cleanup_warehouse(db, warehouse)


def test_update_warehouse_allows_same_code(db):
    data = make_warehouse_data()
    warehouse = None

    try:
        warehouse = create_warehouse(
            db=db,
            **data,
        )

        updated = update_warehouse(
            db=db,
            warehouse_id=warehouse.id,
            data=WarehouseUpdate(
                code=warehouse.code,
                name="Same Code Warehouse",
            ),
        )

        assert updated.code == data["code"]
        assert updated.name == (
            "Same Code Warehouse"
        )

    finally:
        cleanup_warehouse(db, warehouse)