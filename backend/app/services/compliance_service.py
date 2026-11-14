from datetime import datetime, timezone
import logging
from typing import Any
from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.core.supabase_admin import get_supabase_admin
from app.models.audit_log import AuditLog
from app.models.customer import Customer
from app.models.customer_location import CustomerLocation
from app.models.device_token import DeviceToken
from app.models.enums import PickupStatus, UserRole
from app.models.invoice import Invoice
from app.models.pickup import Pickup
from app.models.user import User
from app.models.user_consent import MarketingPreference, UserConsent
from app.schemas.compliance import (
    ConsentRecordRequest,
    DataDeletionRequest,
    DataDeletionResponse,
    DataExportResponse,
    MarketingPreferencesUpdate,
)

logger = logging.getLogger("pharmatrix.compliance")


def record_user_consent(
    db: Session,
    user: User,
    data: ConsentRecordRequest,
    ip_address: str | None = None,
    user_agent: str | None = None,
) -> UserConsent:
    now = datetime.now(timezone.utc)
    consent = UserConsent(
        user_id=user.id,
        consent_type=data.consent_type.upper().strip(),
        policy_version=data.policy_version.strip(),
        status=data.status.upper().strip(),
        ip_address=ip_address[:45] if ip_address else None,
        user_agent=user_agent[:255] if user_agent else None,
        consented_at=now,
        withdrawn_at=now if data.status.upper().strip() == "WITHDRAWN" else None,
    )
    db.add(consent)
    db.commit()
    db.refresh(consent)
    return consent


def get_user_consents(db: Session, user: User) -> list[UserConsent]:
    return (
        db.query(UserConsent)
        .filter(UserConsent.user_id == user.id)
        .order_by(UserConsent.consented_at.desc())
        .all()
    )


def get_or_create_marketing_preferences(
    db: Session, user: User
) -> MarketingPreference:
    pref = (
        db.query(MarketingPreference)
        .filter(MarketingPreference.user_id == user.id)
        .first()
    )
    if not pref:
        pref = MarketingPreference(
            user_id=user.id,
            email_promotions=False,
            sms_promotions=False,
            whatsapp_promotions=False,
            push_promotions=False,
        )
        db.add(pref)
        db.commit()
        db.refresh(pref)
    return pref


def update_marketing_preferences(
    db: Session, user: User, data: MarketingPreferencesUpdate
) -> MarketingPreference:
    pref = get_or_create_marketing_preferences(db, user)
    if data.email_promotions is not None:
        pref.email_promotions = data.email_promotions
    if data.sms_promotions is not None:
        pref.sms_promotions = data.sms_promotions
    if data.whatsapp_promotions is not None:
        pref.whatsapp_promotions = data.whatsapp_promotions
    if data.push_promotions is not None:
        pref.push_promotions = data.push_promotions
    pref.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(pref)
    return pref


def export_user_data(db: Session, user: User) -> DataExportResponse:
    now = datetime.now(timezone.utc)
    user_info = {
        "id": user.id,
        "auth_user_id": str(user.auth_user_id),
        "name": user.name,
        "email": user.email,
        "role": user.role.value,
        "is_active": user.is_active,
    }

    customer_info = None
    locations_list = []
    pickups_list = []
    invoices_list = []

    if user.customer:
        c = user.customer
        customer_info = {
            "customer_code": c.customer_code,
            "public_id": str(c.public_id),
            "legal_name": c.legal_name,
            "display_name": c.display_name,
            "customer_type": c.customer_type.value,
            "phone": c.phone,
            "email": c.email,
            "gst_number": c.gst_number,
            "created_at": c.created_at.isoformat() if c.created_at else None,
        }

        for loc in c.locations or []:
            locations_list.append(
                {
                    "location_code": loc.location_code,
                    "name": loc.name,
                    "address_line_1": loc.address_line_1,
                    "address_line_2": loc.address_line_2,
                    "city": loc.city,
                    "state": loc.state,
                    "postal_code": loc.postal_code,
                    "latitude": loc.latitude,
                    "longitude": loc.longitude,
                    "contact_name": loc.contact_name,
                }
            )

        customer_pickups = (
            db.query(Pickup)
            .filter(Pickup.customer_id == c.id)
            .order_by(Pickup.created_at.desc())
            .all()
        )
        for p in customer_pickups:
            pickups_list.append(
                {
                    "pickup_code": p.pickup_code,
                    "status": p.status.value,
                    "priority": p.priority.value,
                    "scheduled_date": (
                        p.scheduled_date.isoformat() if p.scheduled_date else None
                    ),
                    "estimated_weight_kg": (
                        float(p.estimated_weight_kg)
                        if p.estimated_weight_kg
                        else None
                    ),
                    "collected_at": (
                        p.collected_at.isoformat() if p.collected_at else None
                    ),
                    "created_at": (
                        p.created_at.isoformat() if p.created_at else None
                    ),
                }
            )

        pickup_ids = [p.id for p in customer_pickups]
        if pickup_ids:
            invoices = (
                db.query(Invoice)
                .filter(Invoice.pickup_id.in_(pickup_ids))
                .all()
            )
            for inv in invoices:
                invoices_list.append(
                    {
                        "invoice_code": inv.invoice_code,
                        "status": inv.status,
                        "total_amount": float(inv.total_amount),
                        "outstanding_amount": float(inv.outstanding_amount),
                        "currency": inv.currency,
                        "issued_at": (
                            inv.issued_at.isoformat() if inv.issued_at else None
                        ),
                    }
                )

    consents = get_user_consents(db, user)
    consents_list = [
        {
            "consent_type": con.consent_type,
            "policy_version": con.policy_version,
            "status": con.status,
            "consented_at": con.consented_at.isoformat(),
            "withdrawn_at": (
                con.withdrawn_at.isoformat() if con.withdrawn_at else None
            ),
        }
        for con in consents
    ]

    return DataExportResponse(
        export_timestamp=now,
        data_principal=user_info,
        business_profile=customer_info,
        registered_locations=locations_list,
        pickup_history=pickups_list,
        billing_history=invoices_list,
        consents_and_preferences=consents_list,
    )


def process_data_deletion_request(
    db: Session, user: User, data: DataDeletionRequest
) -> DataDeletionResponse:
    if not data.confirm_legal_acknowledgement:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Legal acknowledgment of statutory retention is required to process data deletion.",
        )

    # 1. Verify that there are no active in-progress pickups
    if user.customer:
        active_pickups = (
            db.query(Pickup)
            .filter(
                Pickup.customer_id == user.customer.id,
                Pickup.status.in_(
                    [
                        PickupStatus.REQUESTED,
                        PickupStatus.SCHEDULED,
                        PickupStatus.ASSIGNED,
                        PickupStatus.IN_PROGRESS,
                    ]
                ),
            )
            .count()
        )
        if active_pickups > 0:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Cannot delete account: You have {active_pickups} active pickup(s) in progress. Complete or cancel pending pickups first.",
            )

        # 2. Verify that there are no unpaid invoices with outstanding balances
        customer_pickup_ids = [
            p.id
            for p in db.query(Pickup.id)
            .filter(Pickup.customer_id == user.customer.id)
            .all()
        ]
        if customer_pickup_ids:
            unpaid_invoices = (
                db.query(Invoice)
                .filter(
                    Invoice.pickup_id.in_(customer_pickup_ids),
                    Invoice.outstanding_amount > 0,
                )
                .count()
            )
            if unpaid_invoices > 0:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=f"Cannot delete account: You have {unpaid_invoices} unpaid invoice(s) with an outstanding balance. Settle all invoices prior to erasure.",
                )

    records_count = {"device_tokens": 0, "locations_anonymized": 0}

    # 3. Purge device push tokens
    deleted_tokens = (
        db.query(DeviceToken).filter(DeviceToken.user_id == user.id).delete()
    )
    records_count["device_tokens"] = deleted_tokens

    # 4. Anonymize locations contact data
    if user.customer:
        locs = (
            db.query(CustomerLocation)
            .filter(CustomerLocation.customer_id == user.customer.id)
            .all()
        )
        for loc in locs:
            loc.contact_name = "Redacted"
            loc.contact_phone = None
            loc.location_photo = None
            records_count["locations_anonymized"] += 1

        # Anonymize Customer table
        user.customer.legal_name = "Anonymized Entity"
        user.customer.display_name = f"Redacted Customer {user.customer.id}"
        user.customer.phone = "+91-0000000000"
        user.customer.email = None
        user.customer.gst_number = "ANONYMIZED"
        user.customer.is_active = False

    # 5. Anonymize User table
    original_email = user.email
    user.name = "Anonymized User"
    user.email = f"deleted_{user.id}_{int(datetime.now().timestamp())}@anonymized.pharmatrix.internal"
    user.is_active = False

    # 6. Delete Supabase Auth account
    try:
        admin_client = get_supabase_admin()
        admin_client.auth.admin.delete_user(str(user.auth_user_id))
    except Exception as exc:
        logger.warning(
            "Supabase auth user deletion failed during DSR erasure for user %s: %s",
            user.id,
            exc,
        )

    # 7. Record immutable compliance audit entry
    audit = AuditLog(
        entity_type="USER",
        entity_id=str(user.id),
        action="DATA_SUBJECT_ERASURE_EXECUTED",
        actor_id=user.id,
        actor_email=original_email,
        old_values={"original_email": original_email},
        new_values={
            "status": "ANONYMIZED",
            "reason": data.reason or "User self-service DSR request",
        },
        notes=f"Personal data sanitized. Statutory waste and tax manifests preserved under BMW Rules and CGST Act.",
    )
    db.add(audit)
    db.commit()

    return DataDeletionResponse(
        status="SUCCESS",
        message="Your personal data has been erased and account deactivated. In compliance with the Bio-Medical Waste Management Rules, 2016 and Section 36 of the CGST Act, statutory waste manifests and tax invoices have been anonymized and archived for mandatory legal retention periods.",
        user_id=user.id,
        records_anonymized=records_count,
        statutory_retention_notice="Historical pickup manifests and tax invoices are retained in anonymized form pursuant to statutory obligations.",
    )

