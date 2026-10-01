from decimal import Decimal, InvalidOperation
from typing import Any


SUPPORTED_TYPES = {
    "STRING",
    "INTEGER",
    "DECIMAL",
    "BOOLEAN",
    "JSON",
}


def validate_configuration_value(
    data_type: str,
    value: Any,
) -> Any:

    if data_type not in SUPPORTED_TYPES:
        raise ValueError(
            f"Unsupported configuration data type: {data_type}"
        )

    if data_type == "STRING":
        if not isinstance(value, str):
            raise ValueError(
                "Configuration value must be a string"
            )

        return value

    if data_type == "INTEGER":
        # bool is a subclass of int in Python,
        # so explicitly reject it.
        if isinstance(value, bool):
            raise ValueError(
                "Configuration value must be an integer"
            )

        if isinstance(value, int):
            return value

        if isinstance(value, str):
            try:
                return int(value)
            except ValueError:
                pass

        raise ValueError(
            "Configuration value must be an integer"
        )

    if data_type == "DECIMAL":
        if isinstance(value, bool):
            raise ValueError(
                "Configuration value must be a decimal number"
            )

        try:
            decimal_value = Decimal(str(value))
        except (InvalidOperation, ValueError):
            raise ValueError(
                "Configuration value must be a decimal number"
            )

        return float(decimal_value)

    if data_type == "BOOLEAN":
        if isinstance(value, bool):
            return value

        if isinstance(value, str):
            normalized = value.strip().lower()

            if normalized in {"true", "1", "yes"}:
                return True

            if normalized in {"false", "0", "no"}:
                return False

        raise ValueError(
            "Configuration value must be boolean"
        )

    if data_type == "JSON":
        if not isinstance(
            value,
            (dict, list, str, int, float, bool, type(None)),
        ):
            raise ValueError(
                "Configuration value is not JSON serializable"
            )

        return value

    raise ValueError(
        f"Unsupported configuration data type: {data_type}"
    )

def validate_configuration_constraints(
    key: str,
    value,
) -> None:

    non_negative_keys = {
        "weight.collection_tolerance",
        "weight.facility_tolerance",
        "logistics.default_vehicle_capacity_kg",
        "logistics.max_route_distance_km",
        "logistics.max_route_duration_minutes",
        "logistics.optimizer_time_limit_seconds",
        "operations.max_pickup_weight_kg",
        "operations.exception_auto_escalation_minutes",
        "notifications.pickup_reminder_hours",
    }

    if key in non_negative_keys:

        if isinstance(value, bool):
            raise ValueError(
                f"{key} must be numeric"
            )

        if float(value) < 0:
            raise ValueError(
                f"{key} cannot be negative"
            )

    strictly_positive_keys = {
        "logistics.default_vehicle_capacity_kg",
        "logistics.max_route_distance_km",
        "logistics.optimizer_time_limit_seconds",
        "logistics.max_route_duration_minutes",
        "operations.max_pickup_weight_kg",
    }

    if key in strictly_positive_keys:
        if float(value) <= 0:
            raise ValueError(
                f"{key} must be greater than zero"
            )