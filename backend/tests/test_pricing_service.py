
import uuid
from datetime import datetime, timedelta, timezone
from decimal import Decimal

import pytest

from app.models.customer import Customer
from app.models.enums import CustomerType
from app.models.pricing import (
    CustomerPricingAssignment,
    PricingPlan,
    PricingPlanVersion,
)
from app.models.user import User, UserRole
from app.services.pricing_service import (
    PricingError,
    calculate_pickup_charges,
)


def create_pricing_setup(
    db,
    *,
    per_kg_rate=Decimal("20.00"),
    pickup_fee=Decimal("50.00"),
    subscription_fee=Decimal("100.00"),
    minimum_pickup_charge=Decimal("75.00"),
    included_weight_kg=Decimal("2.000"),
    plan_active=True,
    version_status="ACTIVE",
    create_version=True,
    create_assignment=True,
):
    now = datetime.now(timezone.utc)

    user = User(
        auth_user_id=uuid.uuid4(),
        name="Pricing Test Admin",
        email=f"pricing-{uuid.uuid4().hex}@test.local",
        role=UserRole.ADMIN,
        is_active=True,
    )
    db.add(user)
    db.flush()

    customer_user = User(
        auth_user_id=uuid.uuid4(),
        name="Pricing Test Customer",
        email=f"customer-{uuid.uuid4().hex}@test.local",
        role=UserRole.CUSTOMER,
        is_active=True,
    )
    db.add(customer_user)
    db.flush()

    customer = Customer(
        user_id=customer_user.id,
        customer_type=CustomerType.PHARMACY,
        legal_name="Pricing Test Pharmacy",
        display_name="Pricing Test Pharmacy",
        phone="9876543210",
        is_active=True,
    )
    db.add(customer)
    db.flush()

    plan = PricingPlan(
        code=f"TEST-{uuid.uuid4().hex[:12]}",
        name="Test Pricing Plan",
        is_active=plan_active,
        created_by=user.id,
    )
    db.add(plan)
    db.flush()

    version = None

    if create_version:
        version = PricingPlanVersion(
            pricing_plan_id=plan.id,
            version=1,
            status=version_status,
            currency="INR",
            per_kg_rate=per_kg_rate,
            pickup_fee=pickup_fee,
            subscription_fee=subscription_fee,
            minimum_pickup_charge=minimum_pickup_charge,
            included_weight_kg=included_weight_kg,
            fee_rules={},
            effective_from=now - timedelta(days=1),
            effective_until=None,
            created_by=user.id,
            approved_by=user.id if version_status == "ACTIVE" else None,
            approved_at=now if version_status == "ACTIVE" else None,
        )
        db.add(version)
        db.flush()

    assignment = None

    if create_assignment:
        assignment = CustomerPricingAssignment(
            customer_id=customer.id,
            pricing_plan_id=plan.id,
            effective_from=now - timedelta(days=1),
            effective_until=None,
            assigned_by=user.id,
            reason="Integration test",
        )
        db.add(assignment)
        db.flush()

    return {
        "user": user,
        "customer": customer,
        "plan": plan,
        "version": version,
        "assignment": assignment,
        "now": now,
    }


def test_calculates_weight_based_pickup_charges(db):
    setup = create_pricing_setup(db)

    result = calculate_pickup_charges(
        db,
        setup["customer"].id,
        Decimal("5.000"),
        setup["now"],
    )

    # 5 kg actual - 2 kg included = 3 kg billable.
    # 3 * ₹20 + ₹50 pickup fee = ₹110.
    assert result["billable_weight_kg"] == Decimal("3.000")
    assert result["weight_charge"] == Decimal("60.00")
    assert result["pickup_fee"] == Decimal("50.00")
    assert result["pickup_charge"] == Decimal("110.00")
    assert result["subscription_fee"] == Decimal("100.00")
    assert result["total_charge"] == Decimal("210.00")
    assert result["currency"] == "INR"
    assert result["pricing_plan_version_id"] == setup["version"].id


def test_included_weight_produces_no_weight_charge(db):
    setup = create_pricing_setup(db)

    result = calculate_pickup_charges(
        db,
        setup["customer"].id,
        Decimal("1.500"),
        setup["now"],
    )

    assert result["billable_weight_kg"] == Decimal("0")
    assert result["weight_charge"] == Decimal("0.00")
    assert result["pickup_charge"] == Decimal("75.00")
    assert result["total_charge"] == Decimal("175.00")


def test_minimum_pickup_charge_is_applied(db):
    setup = create_pricing_setup(
        db,
        per_kg_rate=Decimal("1.00"),
        pickup_fee=Decimal("10.00"),
        subscription_fee=Decimal("0.00"),
        minimum_pickup_charge=Decimal("75.00"),
        included_weight_kg=Decimal("0.000"),
    )

    result = calculate_pickup_charges(
        db,
        setup["customer"].id,
        Decimal("5.000"),
        setup["now"],
    )

    assert result["weight_charge"] == Decimal("5.00")
    assert result["pickup_charge"] == Decimal("75.00")
    assert result["total_charge"] == Decimal("75.00")


def test_negative_weight_is_rejected(db):
    setup = create_pricing_setup(db)

    with pytest.raises(PricingError, match="weight cannot be negative"):
        calculate_pickup_charges(
            db,
            setup["customer"].id,
            Decimal("-1.000"),
            setup["now"],
        )


def test_inactive_pricing_plan_is_rejected(db):
    setup = create_pricing_setup(db, plan_active=False)

    with pytest.raises(PricingError, match="inactive or unavailable"):
        calculate_pickup_charges(
            db,
            setup["customer"].id,
            Decimal("5.000"),
            setup["now"],
        )


def test_missing_assignment_is_rejected(db):
    setup = create_pricing_setup(db, create_assignment=False)

    with pytest.raises(PricingError, match="exactly one active pricing assignment"):
        calculate_pickup_charges(
            db,
            setup["customer"].id,
            Decimal("5.000"),
            setup["now"],
        )


def test_missing_active_version_is_rejected(db):
    setup = create_pricing_setup(db, create_version=False)

    with pytest.raises(PricingError, match="exactly one active version"):
        calculate_pickup_charges(
            db,
            setup["customer"].id,
            Decimal("5.000"),
            setup["now"],
        )


def test_draft_version_is_not_used_for_calculation(db):
    setup = create_pricing_setup(db, version_status="DRAFT")

    with pytest.raises(PricingError, match="exactly one active version"):
        calculate_pickup_charges(
            db,
            setup["customer"].id,
            Decimal("5.000"),
            setup["now"],
        )


def test_overlapping_assignments_are_rejected(db):
    setup = create_pricing_setup(db)

    another_plan = PricingPlan(
        code=f"TEST-{uuid.uuid4().hex[:12]}",
        name="Another Test Plan",
        is_active=True,
        created_by=setup["user"].id,
    )
    db.add(another_plan)
    db.flush()

    db.add(
        CustomerPricingAssignment(
            customer_id=setup["customer"].id,
            pricing_plan_id=another_plan.id,
            effective_from=setup["now"] - timedelta(days=1),
            effective_until=None,
            assigned_by=setup["user"].id,
            reason="Overlapping assignment test",
        )
    )
    db.flush()

    with pytest.raises(PricingError, match="exactly one active pricing assignment"):
        calculate_pickup_charges(
            db,
            setup["customer"].id,
            Decimal("5.000"),
            setup["now"],
        )
