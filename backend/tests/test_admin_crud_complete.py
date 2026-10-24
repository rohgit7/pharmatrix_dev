import uuid
from datetime import datetime, timezone
from decimal import Decimal
from fastapi.testclient import TestClient

from app.main import app
from app.core.auth import get_current_user, require_role
from app.models.user import User, UserRole
from app.models.enums import CustomerType, PickupPriority, PickupStatus, WasteBinColor, WasteType

client = TestClient(app)


def test_admin_crud_flow(db):
    admin = User(
        auth_user_id=uuid.uuid4(),
        name="Super Admin",
        email=f"admin-{uuid.uuid4().hex[:6]}@pharmatrix.local",
        role=UserRole.ADMIN,
        is_active=True,
    )
    db.add(admin)
    db.commit()
    db.refresh(admin)

    app.dependency_overrides[get_current_user] = lambda: admin
    app.dependency_overrides[require_role(UserRole.ADMIN)] = lambda: admin

    try:
        # 1. Customer CRUD
        cust_payload = {
            "customer_type": "PHARMACY",
            "legal_name": "Apex Medicare Chemist",
            "display_name": "Apex Medicare",
            "phone": "+919876543210",
            "email": f"apex-{uuid.uuid4().hex[:6]}@example.com",
            "gst_number": "27AAAAA0000A1Z5",
            "is_active": True,
            "location": {
                "name": "Apex Main Branch",
                "address_line_1": "101 High Street",
                "city": "Mumbai",
                "state": "Maharashtra",
                "postal_code": "400001",
                "latitude": 18.922,
                "longitude": 72.834,
                "contact_name": "Dr. Rajesh",
                "contact_phone": "+919876543210",
            },
        }
        res = client.post("/api/admin/customers/", json=cust_payload)
        assert res.status_code == 201, res.text
        customer = res.json()
        cust_id = customer["id"]
        assert customer["legal_name"] == "Apex Medicare Chemist"

        # List customers
        res = client.get("/api/admin/customers/")
        assert res.status_code == 200
        assert any(c["id"] == cust_id for c in res.json())

        # Update customer
        res = client.patch(f"/api/admin/customers/{cust_id}", json={"display_name": "Apex Health Hub"})
        assert res.status_code == 200
        assert res.json()["display_name"] == "Apex Health Hub"

        # Add location to customer
        loc_res = client.post(
            f"/api/admin/customers/{cust_id}/locations",
            json={
                "name": "Apex Secondary Store",
                "address_line_1": "202 Mall Road",
                "city": "Mumbai",
                "state": "Maharashtra",
                "postal_code": "400002",
                "latitude": 18.930,
                "longitude": 72.840,
            },
        )
        assert loc_res.status_code == 201
        loc_id = loc_res.json()["id"]

        # Update location
        res = client.patch(f"/api/admin/customers/locations/{loc_id}", json={"name": "Apex Mega Store"})
        assert res.status_code == 200
        assert res.json()["name"] == "Apex Mega Store"

        # 2. User CRUD
        user_res = client.post(
            "/api/admin/users/",
            json={
                "name": "Test Driver User",
                "email": f"driver-{uuid.uuid4().hex[:6]}@pharmatrix.local",
                "password": "Password@123",
                "role": "DRIVER",
                "is_active": True,
            },
        )
        assert user_res.status_code == 201
        new_user = user_res.json()
        new_user_id = new_user["id"]

        res = client.get("/api/admin/users/")
        assert res.status_code == 200

        res = client.patch(f"/api/admin/users/{new_user_id}", json={"name": "Updated Driver Name"})
        assert res.status_code == 200
        assert res.json()["name"] == "Updated Driver Name"

        # 3. Pricing Plan CRUD
        plan_code = f"PLAN-{uuid.uuid4().hex[:6].upper()}"
        plan_res = client.post(
            "/api/admin/pricing/plans",
            json={
                "code": plan_code,
                "name": "Standard Commercial Plan",
                "description": "Commercial pharmaceutical waste collection",
                "is_active": True,
            },
        )
        assert plan_res.status_code == 201
        plan = plan_res.json()
        plan_id = plan["id"]

        # Create version
        ver_res = client.post(
            f"/api/admin/pricing/plans/{plan_id}/versions",
            json={
                "version": 1,
                "status": "ACTIVE",
                "currency": "INR",
                "per_kg_rate": 25.0,
                "pickup_fee": 100.0,
                "subscription_fee": 500.0,
                "minimum_pickup_charge": 150.0,
                "included_weight_kg": 5.0,
                "fee_rules": {},
            },
        )
        assert ver_res.status_code == 201

        # Customer Assignment
        assign_res = client.post(
            "/api/admin/pricing/assignments",
            json={
                "customer_id": cust_id,
                "pricing_plan_id": plan_id,
                "effective_from": datetime.now(timezone.utc).isoformat(),
                "reason": "Initial corporate contract",
            },
        )
        assert assign_res.status_code == 201
        assign_id = assign_res.json()["id"]

        # 4. Pickup CRUD
        pick_res = client.post(
            "/api/admin/pickups/",
            json={
                "customer_id": cust_id,
                "location_id": loc_id,
                "priority": "HIGH",
                "notes": "Urgent collection needed",
                "scheduled_date": datetime.now(timezone.utc).isoformat(),
            },
        )
        assert pick_res.status_code == 201
        pickup = pick_res.json()
        pickup_public_id = pickup["public_id"]
        assert pickup["priority"] == "HIGH"

        # Update Pickup
        patch_res = client.patch(
            f"/api/admin/pickups/{pickup_public_id}",
            json={"priority": "URGENT", "notes": "Top priority pickup"},
        )
        assert patch_res.status_code == 200
        assert patch_res.json()["priority"] == "URGENT"

        # 5. Invoices CRUD
        inv_res = client.post(
            "/api/admin/invoices/",
            json={
                "customer_id": cust_id,
                "pickup_id": pickup["id"],
                "currency": "INR",
                "notes": "Monthly billing invoice",
                "line_items": [
                    {
                        "item_type": "COLLECTION_FEE",
                        "description": "Pharmaceutical waste pickup fee",
                        "quantity": 1.0,
                        "unit_price": 500.0,
                    }
                ],
            },
        )
        assert inv_res.status_code == 201
        inv = inv_res.json()
        inv_public_id = inv["public_id"]

        # Update invoice
        res = client.patch(f"/api/admin/invoices/{inv_public_id}", json={"notes": "Updated billing notes"})
        assert res.status_code == 200

        # Record payment
        pay_res = client.post(
            "/api/admin/payments/",
            json={
                "invoice_id": inv_public_id,
                "amount": float(inv["total_amount"]),
                "payment_method": "UPI",
                "payment_reference": f"UPI-{uuid.uuid4().hex[:8]}",
            },
        )
        assert pay_res.status_code == 201, pay_res.text
        payment = pay_res.json()

        # Delete payment
        res = client.delete(f"/api/admin/payments/{payment['id']}")
        assert res.status_code == 200

        # 6. Operational Exceptions CRUD
        exc_res = client.post(
            "/api/admin/exceptions/",
            json={
                "exception_type": "PICKUP_FAILED",
                "source_type": "PICKUP",
                "source_id": pickup["id"],
                "reason": "Premises were locked at scheduled time",
            },
        )
        assert exc_res.status_code == 201
        exc_id = exc_res.json()["id"]

        # Escalate exception
        res = client.post(f"/api/admin/exceptions/{exc_id}/escalate")
        assert res.status_code == 200
        assert res.json()["status"] == "ESCALATED"

        # Delete exception
        res = client.delete(f"/api/admin/exceptions/{exc_id}")
        assert res.status_code == 200

        # Delete customer location & customer
        res = client.delete(f"/api/admin/customers/locations/{loc_id}")
        assert res.status_code == 200

        # Delete user
        res = client.delete(f"/api/admin/users/{new_user_id}")
        assert res.status_code == 200

        # Delete pricing assignment
        res = client.delete(f"/api/admin/pricing/assignments/{assign_id}")
        assert res.status_code == 200

    finally:
        app.dependency_overrides.pop(get_current_user, None)
        app.dependency_overrides.pop(require_role(UserRole.ADMIN), None)
