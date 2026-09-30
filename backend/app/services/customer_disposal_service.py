from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.disposal_certificate import DisposalCertificate
from app.models.disposal_shipment import DisposalShipment
from app.models.pickup import Pickup
from app.models.route import Route
from app.models.route_stop import RouteStop
from app.models.warehouse_intake import WarehouseIntake


def get_customer_disposal_records(
    db: Session,
    customer_id: int,
):
    pickups = db.scalars(
        select(Pickup)
        .where(
            Pickup.customer_id == customer_id
        )
        .order_by(Pickup.created_at.desc())
    ).all()

    records = []

    for pickup in pickups:

        route = db.scalar(
            select(Route)
            .join(
                RouteStop,
                RouteStop.route_id == Route.id,
            )
            .where(
                RouteStop.pickup_id == pickup.id
            )
        )

        if not route:
            records.append(
                {
                    "pickup_id": pickup.id,
                    "pickup_code": pickup.pickup_code,
                    "shipment_id": None,
                    "shipment_code": None,
                    "facility_name": None,
                    "expected_weight_kg": None,
                    "received_weight_kg": None,
                    "shipment_status": None,
                    "dispatched_at": None,
                    "received_at": None,
                    "certificate_available": False,
                }
            )
            continue

        intake = db.scalar(
            select(WarehouseIntake)
            .where(
                WarehouseIntake.route_id == route.id
            )
        )

        if not intake:
            records.append(
                {
                    "pickup_id": pickup.id,
                    "pickup_code": pickup.pickup_code,
                    "shipment_id": None,
                    "shipment_code": None,
                    "facility_name": None,
                    "expected_weight_kg": None,
                    "received_weight_kg": None,
                    "shipment_status": None,
                    "dispatched_at": None,
                    "received_at": None,
                    "certificate_available": False,
                }
            )
            continue

        shipment = db.scalar(
            select(DisposalShipment)
            .where(
                DisposalShipment.intake_id == intake.id
            )
        )

        if not shipment:
            records.append(
                {
                    "pickup_id": pickup.id,
                    "pickup_code": pickup.pickup_code,
                    "shipment_id": None,
                    "shipment_code": None,
                    "facility_name": None,
                    "expected_weight_kg": None,
                    "received_weight_kg": None,
                    "shipment_status": None,
                    "dispatched_at": None,
                    "received_at": None,
                    "certificate_available": False,
                }
            )
            continue

        certificate = db.scalar(
            select(DisposalCertificate)
            .where(
                DisposalCertificate.shipment_id == shipment.id
            )
        )

        records.append(
            {
                "pickup_id": pickup.id,
                "pickup_code": pickup.pickup_code,
                "shipment_id": shipment.id,
                "shipment_code": shipment.shipment_code,
                "facility_name": (
                    shipment.facility.legal_name
                    if shipment.facility
                    else None
                ),
                "expected_weight_kg": shipment.expected_weight_kg,
                "received_weight_kg": shipment.received_weight_kg,
                "shipment_status": shipment.status,
                "dispatched_at": shipment.dispatched_at,
                "received_at": shipment.received_at,
                "certificate_available": certificate is not None,
            }
        )

    return records