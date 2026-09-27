from enum import Enum


class CustomerType(str, Enum):
    PHARMACY = "PHARMACY"
    DISTRIBUTOR = "DISTRIBUTOR"
    HOSPITAL = "HOSPITAL"
    CLINIC = "CLINIC"