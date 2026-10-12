
from decimal import Decimal, ROUND_HALF_UP

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.pricing import (
    CustomerPricingAssignment,
    PricingPlan,
    PricingPlanVersion,
)


class PricingError(Exception):
    """Raised when pricing cannot be calculated safely."""


def money(value: Decimal) -> Decimal:
    """Round monetary values to two decimal places."""
    return value.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def calculate_pickup_charges(
    db: Session,
    customer_id: int,
    actual_weight_kg: Decimal,
    at_time,
) -> dict:
    """
    Calculate pickup charges from the customer's active pricing assignment.

    Does not create an invoice or record a payment.
    """
    if actual_weight_kg < Decimal("0"):
        raise PricingError("Actual weight cannot be negative.")

    assignment = db.scalar(
        select(CustomerPricingAssignment)
        .where(
            CustomerPricingAssignment.customer_id == customer_id,
            CustomerPricingAssignment.effective_from <= at_time,
            (
                CustomerPricingAssignment.effective_until.is_(None)
                | (CustomerPricingAssignment.effective_until > at_time)
            ),
        )
        .order_by(CustomerPricingAssignment.effective_from.desc())
        .limit(2)
    )

    # Fetch all currently effective assignments so ambiguous pricing
    # cannot silently result in a charge.
    assignments = db.scalars(
        select(CustomerPricingAssignment).where(
            CustomerPricingAssignment.customer_id == customer_id,
            CustomerPricingAssignment.effective_from <= at_time,
            (
                CustomerPricingAssignment.effective_until.is_(None)
                | (CustomerPricingAssignment.effective_until > at_time)
            ),
        )
    ).all()

    if len(assignments) != 1:
        raise PricingError(
            "Customer must have exactly one active pricing assignment."
        )

    assignment = assignments[0]

    plan = db.get(PricingPlan, assignment.pricing_plan_id)
    if plan is None or not plan.is_active:
        raise PricingError("Assigned pricing plan is inactive or unavailable.")

    versions = db.scalars(
        select(PricingPlanVersion).where(
            PricingPlanVersion.pricing_plan_id == plan.id,
            PricingPlanVersion.status == "ACTIVE",
            (
                PricingPlanVersion.effective_from.is_(None)
                | (PricingPlanVersion.effective_from <= at_time)
            ),
            (
                PricingPlanVersion.effective_until.is_(None)
                | (PricingPlanVersion.effective_until > at_time)
            ),
        )
    ).all()

    if len(versions) != 1:
        raise PricingError(
            "Pricing plan must have exactly one active version at this time."
        )

    version = versions[0]

    weight = Decimal(str(actual_weight_kg))
    included_weight = Decimal(str(version.included_weight_kg))
    billable_weight = max(Decimal("0"), weight - included_weight)

    per_kg_rate = Decimal(str(version.per_kg_rate))
    pickup_fee = Decimal(str(version.pickup_fee))
    subscription_fee = Decimal(str(version.subscription_fee))
    minimum_charge = Decimal(str(version.minimum_pickup_charge))

    weight_charge = money(billable_weight * per_kg_rate)
    subtotal = money(weight_charge + pickup_fee)
    pickup_charge = max(subtotal, minimum_charge)

    return {
        "customer_id": customer_id,
        "pricing_plan_id": plan.id,
        "pricing_plan_version_id": version.id,
        "currency": version.currency,
        "actual_weight_kg": weight,
        "included_weight_kg": included_weight,
        "billable_weight_kg": billable_weight,
        "weight_charge": weight_charge,
        "per_kg_rate": per_kg_rate,
        "pickup_fee": money(pickup_fee),
        "subscription_fee": money(subscription_fee),
        "minimum_pickup_charge": money(minimum_charge),
        "pickup_charge": money(pickup_charge),
        "total_charge": money(pickup_charge + subscription_fee),
        "fee_rules": version.fee_rules,
    }
