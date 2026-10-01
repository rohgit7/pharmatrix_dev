from app.core.database import SessionLocal
from app.models.configuration import Configuration
from app.models.user import User
from app.services.configuration_service import create_configuration


DEFAULT_CONFIGURATIONS = [
    {
        "key": "weight.collection_tolerance",
        "description": "Allowed collection weight variance before exception handling",
        "data_type": "DECIMAL",
        "scope": "GLOBAL",
        "value": 5.0,
    },
    {
        "key": "weight.facility_tolerance",
        "description": "Allowed facility receipt weight variance before exception handling",
        "data_type": "DECIMAL",
        "scope": "GLOBAL",
        "value": 5.0,
    },
    {
        "key": "notifications.whatsapp_enabled",
        "description": "Enable WhatsApp notification delivery",
        "data_type": "BOOLEAN",
        "scope": "GLOBAL",
        "value": False,
    },
    {
        "key": "notifications.email_enabled",
        "description": "Enable email notification delivery",
        "data_type": "BOOLEAN",
        "scope": "GLOBAL",
        "value": True,
    },
    {
        "key": "notifications.pickup_reminder_hours",
        "description": "Hours before scheduled pickup to send reminder",
        "data_type": "INTEGER",
        "scope": "GLOBAL",
        "value": 24,
    },
    {
        "key": "notifications.worker_enabled",
        "description": "Enable worker notification delivery",
        "data_type": "BOOLEAN",
        "scope": "GLOBAL",
        "value": False,
    },
    {
        "key": "logistics.default_vehicle_capacity_kg",
        "description": "Default operational vehicle capacity in kilograms",
        "data_type": "DECIMAL",
        "scope": "GLOBAL",
        "value": 1000.0,
    },
    {
        "key": "logistics.max_route_distance_km",
        "description": "Maximum configured route distance",
        "data_type": "DECIMAL",
        "scope": "GLOBAL",
        "value": 200.0,
    },
    {
        "key": "logistics.max_route_duration_minutes",
        "description": "Maximum configured route duration",
        "data_type": "INTEGER",
        "scope": "GLOBAL",
        "value": 480,
    },
        {
        "key": "logistics.optimizer_time_limit_seconds",
        "description": "Maximum time allowed for route optimizer search",
        "data_type": "INTEGER",
        "scope": "GLOBAL",
        "value": 30,
    },
    {
        "key": "operations.max_pickup_weight_kg",
        "description": "Maximum weight accepted in a single pickup",
        "data_type": "DECIMAL",
        "scope": "GLOBAL",
        "value": 1000.0,
    },
    {
        "key": "operations.exception_auto_escalation_minutes",
        "description": "Time before an unresolved operational exception is escalated",
        "data_type": "INTEGER",
        "scope": "GLOBAL",
        "value": 30,
    },
]


def main():
    db = SessionLocal()

    try:
        admin_user = db.query(User).filter(
            User.role == "ADMIN"
        ).first()

        if not admin_user:
            raise RuntimeError(
                "No ADMIN user exists. Create an admin user before seeding configuration."
            )

        created = 0
        skipped = 0

        for item in DEFAULT_CONFIGURATIONS:

            existing = db.query(Configuration).filter(
                Configuration.key == item["key"]
            ).first()

            if existing:
                print(
                    f"SKIP  {item['key']} "
                    "(already exists)"
                )
                skipped += 1
                continue

            create_configuration(
                db,
                key=item["key"],
                value=item["value"],
                data_type=item["data_type"],
                created_by=admin_user.id,
                description=item["description"],
                scope=item["scope"],
                reason="Initial Pharmatrix configuration",
                change_reference="SYSTEM-BOOTSTRAP",
            )

            print(
                f"CREATE {item['key']} = {item['value']}"
            )

            created += 1

        db.commit()

        print()
        print("Configuration seed completed.")
        print(f"Created: {created}")
        print(f"Skipped: {skipped}")

    except Exception:
        db.rollback()
        raise

    finally:
        db.close()


if __name__ == "__main__":
    main()