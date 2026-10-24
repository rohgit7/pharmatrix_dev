from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session, joinedload

from app.core.auth import get_current_user, require_role
from app.core.database import get_db
from app.models.pricing import (
    CustomerPricingAssignment,
    PricingPlan,
    PricingPlanVersion,
)
from app.models.user import User, UserRole
from app.schemas.pricing import (
    CustomerPricingAssignmentCreate,
    CustomerPricingAssignmentResponse,
    PricingPlanCreate,
    PricingPlanResponse,
    PricingPlanUpdate,
    PricingPlanVersionCreate,
    PricingPlanVersionResponse,
)

router = APIRouter(
    prefix="/api/admin/pricing",
    tags=["Admin - Pricing"],
    dependencies=[Depends(require_role(UserRole.ADMIN))],
)


# ----------------------------------------------------
# Pricing Plans
# ----------------------------------------------------
@router.get("/plans", response_model=list[PricingPlanResponse])
def admin_list_pricing_plans(
    is_active: bool | None = Query(default=None),
    db: Session = Depends(get_db),
):
    query = db.query(PricingPlan).options(joinedload(PricingPlan.versions))
    if is_active is not None:
        query = query.filter(PricingPlan.is_active == is_active)
    return query.order_by(PricingPlan.id.desc()).all()


@router.get("/plans/{plan_id}", response_model=PricingPlanResponse)
def admin_get_pricing_plan(
    plan_id: int,
    db: Session = Depends(get_db),
):
    plan = (
        db.query(PricingPlan)
        .options(joinedload(PricingPlan.versions))
        .filter(PricingPlan.id == plan_id)
        .first()
    )
    if not plan:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Pricing plan not found",
        )
    return plan


@router.post("/plans", response_model=PricingPlanResponse, status_code=status.HTTP_201_CREATED)
def admin_create_pricing_plan(
    data: PricingPlanCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    existing = db.query(PricingPlan).filter(PricingPlan.code == data.code).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A pricing plan with this code already exists",
        )

    plan = PricingPlan(
        code=data.code,
        name=data.name,
        description=data.description,
        is_active=data.is_active,
        created_by=current_user.id,
    )
    db.add(plan)
    db.commit()
    db.refresh(plan)
    return plan


@router.patch("/plans/{plan_id}", response_model=PricingPlanResponse)
def admin_update_pricing_plan(
    plan_id: int,
    data: PricingPlanUpdate,
    db: Session = Depends(get_db),
):
    plan = db.query(PricingPlan).filter(PricingPlan.id == plan_id).first()
    if not plan:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Pricing plan not found",
        )

    update_dict = data.model_dump(exclude_unset=True)
    for field, value in update_dict.items():
        setattr(plan, field, value)

    db.commit()
    db.refresh(plan)
    return plan


@router.delete("/plans/{plan_id}", status_code=status.HTTP_200_OK)
def admin_delete_pricing_plan(
    plan_id: int,
    db: Session = Depends(get_db),
):
    plan = db.query(PricingPlan).filter(PricingPlan.id == plan_id).first()
    if not plan:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Pricing plan not found",
        )

    try:
        db.delete(plan)
        db.commit()
    except Exception:
        db.rollback()
        plan.is_active = False
        db.commit()

    return {"message": "Pricing plan removed successfully"}


# ----------------------------------------------------
# Plan Versions
# ----------------------------------------------------
@router.post("/plans/{plan_id}/versions", response_model=PricingPlanVersionResponse, status_code=status.HTTP_201_CREATED)
def admin_create_plan_version(
    plan_id: int,
    data: PricingPlanVersionCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    plan = db.query(PricingPlan).filter(PricingPlan.id == plan_id).first()
    if not plan:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Pricing plan not found",
        )

    existing_version = (
        db.query(PricingPlanVersion)
        .filter(
            PricingPlanVersion.pricing_plan_id == plan_id,
            PricingPlanVersion.version == data.version,
        )
        .first()
    )
    if existing_version:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Version {data.version} already exists for this pricing plan",
        )

    now = datetime.now(timezone.utc)
    version = PricingPlanVersion(
        pricing_plan_id=plan_id,
        version=data.version,
        status=data.status,
        currency=data.currency,
        per_kg_rate=data.per_kg_rate,
        pickup_fee=data.pickup_fee,
        subscription_fee=data.subscription_fee,
        minimum_pickup_charge=data.minimum_pickup_charge,
        included_weight_kg=data.included_weight_kg,
        fee_rules=data.fee_rules,
        effective_from=data.effective_from or now,
        effective_until=data.effective_until,
        reason=data.reason,
        created_by=current_user.id,
        approved_by=current_user.id if data.status == "ACTIVE" else None,
        approved_at=now if data.status == "ACTIVE" else None,
    )
    db.add(version)
    db.commit()
    db.refresh(version)
    return version


@router.patch("/versions/{version_id}/status", response_model=PricingPlanVersionResponse)
def admin_update_version_status(
    version_id: int,
    status_value: str = Query(..., alias="status"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    version = db.query(PricingPlanVersion).filter(PricingPlanVersion.id == version_id).first()
    if not version:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Pricing plan version not found",
        )

    version.status = status_value.strip().upper()
    if version.status == "ACTIVE":
        version.approved_by = current_user.id
        version.approved_at = datetime.now(timezone.utc)

    db.commit()
    db.refresh(version)
    return version


# ----------------------------------------------------
# Customer Pricing Assignments
# ----------------------------------------------------
@router.get("/assignments", response_model=list[CustomerPricingAssignmentResponse])
def admin_list_pricing_assignments(
    customer_id: int | None = Query(default=None),
    db: Session = Depends(get_db),
):
    query = db.query(CustomerPricingAssignment)
    if customer_id is not None:
        query = query.filter(CustomerPricingAssignment.customer_id == customer_id)
    return query.order_by(CustomerPricingAssignment.id.desc()).all()


@router.post("/assignments", response_model=CustomerPricingAssignmentResponse, status_code=status.HTTP_201_CREATED)
def admin_create_pricing_assignment(
    data: CustomerPricingAssignmentCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    assignment = CustomerPricingAssignment(
        customer_id=data.customer_id,
        pricing_plan_id=data.pricing_plan_id,
        effective_from=data.effective_from,
        effective_until=data.effective_until,
        reason=data.reason,
        assigned_by=current_user.id,
    )
    db.add(assignment)
    db.commit()
    db.refresh(assignment)
    return assignment


@router.delete("/assignments/{assignment_id}", status_code=status.HTTP_200_OK)
def admin_delete_pricing_assignment(
    assignment_id: int,
    db: Session = Depends(get_db),
):
    assignment = db.query(CustomerPricingAssignment).filter(CustomerPricingAssignment.id == assignment_id).first()
    if not assignment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Pricing assignment not found",
        )
    db.delete(assignment)
    db.commit()
    return {"message": "Pricing assignment removed successfully"}
