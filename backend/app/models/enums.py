from enum import Enum

class UserRole(str, Enum):
    ADMIN = "ADMIN"
    DRIVER = "DRIVER"
    CUSTOMER = "CUSTOMER"
    FACILITY = "FACILITY"

class CustomerType(str, Enum):
    PHARMACY = "PHARMACY"
    DISTRIBUTOR = "DISTRIBUTOR"
    HOSPITAL = "HOSPITAL"
    CLINIC = "CLINIC"


class DriverStatus(str, Enum):
    ACTIVE = "ACTIVE"
    INACTIVE = "INACTIVE"
    SUSPENDED = "SUSPENDED"


class VehicleStatus(str, Enum):
    AVAILABLE = "AVAILABLE"
    ASSIGNED = "ASSIGNED"
    MAINTENANCE = "MAINTENANCE"
    INACTIVE = "INACTIVE"


class VehicleType(str, Enum):
    BIKE = "BIKE"
    THREE_WHEELER = "THREE_WHEELER"
    VAN = "VAN"
    TRUCK = "TRUCK"

class PickupStatus(str, Enum):
    REQUESTED = "REQUESTED"
    SCHEDULED = "SCHEDULED"
    ASSIGNED = "ASSIGNED"
    IN_PROGRESS = "IN_PROGRESS"
    COLLECTED = "COLLECTED"
    FAILED = "FAILED"
    CANCELLED = "CANCELLED"


class PickupPriority(str, Enum):
    NORMAL = "NORMAL"
    HIGH = "HIGH"
    URGENT = "URGENT"

class RouteStatus(str, Enum):
    DRAFT = "DRAFT"
    OPTIMIZING = "OPTIMIZING"
    READY = "READY"
    ASSIGNED = "ASSIGNED"
    IN_PROGRESS = "IN_PROGRESS"
    COMPLETED = "COMPLETED"
    CANCELLED = "CANCELLED"


class RouteStopType(str, Enum):
    PICKUP = "PICKUP"
    WAREHOUSE = "WAREHOUSE" 