from app.core.database import SessionLocal
from app.services.configuration_runtime_service import (
    get_configuration_float,
    get_configuration_int,
    get_configuration_bool,
)


def main():
    db = SessionLocal()

    try:
        print(
            "collection tolerance:",
            get_configuration_float(
                db,
                "weight.collection_tolerance",
            ),
        )

        print(
            "facility tolerance:",
            get_configuration_float(
                db,
                "weight.facility_tolerance",
            ),
        )

        print(
            "vehicle capacity:",
            get_configuration_float(
                db,
                "logistics.default_vehicle_capacity_kg",
            ),
        )

        print(
            "max route distance:",
            get_configuration_float(
                db,
                "logistics.max_route_distance_km",
            ),
        )

        print(
            "max route duration:",
            get_configuration_int(
                db,
                "logistics.max_route_duration_minutes",
            ),
        )

        print(
            "email enabled:",
            get_configuration_bool(
                db,
                "notifications.email_enabled",
            ),
        )

        print(
            "whatsapp enabled:",
            get_configuration_bool(
                db,
                "notifications.whatsapp_enabled",
            ),
        )

    finally:
        db.close()


if __name__ == "__main__":
    main()