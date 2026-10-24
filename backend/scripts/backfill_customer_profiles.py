"""
Diagnostic and controlled backfill script for customer type-specific profiles.

Usage:
    # Diagnostic mode (default, no changes applied):
    python scripts/backfill_customer_profiles.py

    # Apply backfill to create missing type-specific profiles:
    python scripts/backfill_customer_profiles.py --apply
"""

import argparse
import sys
from pathlib import Path

# Add project root to sys.path so the script can be run standalone
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from sqlalchemy.orm import Session
from app.core.database import SessionLocal
from app.models.customer import Customer
from app.models.enums import CustomerType
from app.models.pharmacy_profile import PharmacyProfile
from app.models.distributor_profile import DistributorProfile
from app.models.hospital_profile import HospitalProfile
from app.models.clinic_profile import ClinicProfile


def diagnose_customers(db: Session):
    customers = db.query(Customer).all()
    total_customers = len(customers)

    missing_pharmacy = []
    missing_distributor = []
    missing_hospital = []
    missing_clinic = []

    for c in customers:
        if c.customer_type == CustomerType.PHARMACY:
            p = db.query(PharmacyProfile).filter(PharmacyProfile.customer_id == c.id).first()
            if not p:
                missing_pharmacy.append(c)
        elif c.customer_type == CustomerType.DISTRIBUTOR:
            p = db.query(DistributorProfile).filter(DistributorProfile.customer_id == c.id).first()
            if not p:
                missing_distributor.append(c)
        elif c.customer_type == CustomerType.HOSPITAL:
            p = db.query(HospitalProfile).filter(HospitalProfile.customer_id == c.id).first()
            if not p:
                missing_hospital.append(c)
        elif c.customer_type == CustomerType.CLINIC:
            p = db.query(ClinicProfile).filter(ClinicProfile.customer_id == c.id).first()
            if not p:
                missing_clinic.append(c)

    print("=== Customer Profile Diagnostic Report ===")
    print(f"Total customers in database: {total_customers}")
    print(f"  - Pharmacy customers missing PharmacyProfile: {len(missing_pharmacy)}")
    print(f"  - Distributor customers missing DistributorProfile: {len(missing_distributor)}")
    print(f"  - Hospital customers missing HospitalProfile: {len(missing_hospital)}")
    print(f"  - Clinic customers missing ClinicProfile: {len(missing_clinic)}")

    total_missing = (
        len(missing_pharmacy)
        + len(missing_distributor)
        + len(missing_hospital)
        + len(missing_clinic)
    )
    print(f"Total customers missing profiles: {total_missing}")

    return {
        "missing_pharmacy": missing_pharmacy,
        "missing_distributor": missing_distributor,
        "missing_hospital": missing_hospital,
        "missing_clinic": missing_clinic,
    }


def backfill_profiles(db: Session, apply: bool = False):
    report = diagnose_customers(db)

    total_missing = (
        len(report["missing_pharmacy"])
        + len(report["missing_distributor"])
        + len(report["missing_hospital"])
        + len(report["missing_clinic"])
    )

    if not apply:
        print("\nDry-run complete. Run with --apply to create missing profiles.")
        return

    if total_missing == 0:
        print("\nNo missing profiles to backfill.")
        return

    print("\nApplying profile backfill...")
    count_created = 0

    try:
        for c in report["missing_pharmacy"]:
            db.add(PharmacyProfile(customer_id=c.id, license_verified=False))
            count_created += 1

        for c in report["missing_distributor"]:
            db.add(DistributorProfile(customer_id=c.id, warehouse_count=1, license_verified=False))
            count_created += 1

        for c in report["missing_hospital"]:
            db.add(HospitalProfile(customer_id=c.id, registration_verified=False))
            count_created += 1

        for c in report["missing_clinic"]:
            db.add(ClinicProfile(customer_id=c.id, registration_verified=False))
            count_created += 1

        db.commit()
        print(f"Successfully created {count_created} missing customer profiles.")
    except Exception as e:
        db.rollback()
        print(f"Error during backfill: {e}", file=sys.stderr)
        raise


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Diagnose or backfill missing customer profiles.")
    parser.add_argument(
        "--apply",
        action="store_true",
        help="Apply the profile creation. Without this flag, only diagnostic checks run.",
    )
    args = parser.parse_args()

    db = SessionLocal()
    try:
        backfill_profiles(db, apply=args.apply)
    finally:
        db.close()
