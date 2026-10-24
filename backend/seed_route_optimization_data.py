"""
Seed realistic fleet and scheduled pickups for Warehouse 1 (Bengaluru)
across 4 directional sectors around the depot (12.9716, 77.5946).

This ensures the route optimizer forms 4 balanced, multi-colored routes
matching the user's reference design, with each route assigned to one
active driver-vehicle pair and dispatched to them.
"""

from datetime import datetime, timezone, timedelta
from decimal import Decimal
from app.core.database import SessionLocal
from app.models.enums import DriverStatus, VehicleStatus, VehicleType, PickupStatus, PickupPriority, RouteStatus
from app.models.warehouse import Warehouse
from app.models.driver import Driver
from app.models.vehicle import Vehicle
from app.models.driver_vehicle_assignment import DriverVehicleAssignment
from app.models.customer import Customer
from app.models.customer_location import CustomerLocation
from app.models.pickup import Pickup
from app.models.route import Route
from app.models.route_stop import RouteStop


def seed_route_data():
    db = SessionLocal()
    try:
        # 1. Warehouse
        warehouse = db.query(Warehouse).filter(Warehouse.id == 1).first()
        if not warehouse:
            print("Warehouse 1 not found!")
            return
        print(f"Using Warehouse: {warehouse.name} at ({warehouse.latitude}, {warehouse.longitude})")

        # 2. Ensure 4 Vehicles exist and are AVAILABLE
        vehicles_data = [
            ("KA01AB1234", VehicleType.VAN, Decimal("500.00")),
            ("KA03TEST7727", VehicleType.VAN, Decimal("500.00")),
            ("KA04CD5678", VehicleType.VAN, Decimal("500.00")),
            ("KA05EF9012", VehicleType.VAN, Decimal("500.00")),
        ]
        vehicles = []
        for reg, vtype, cap in vehicles_data:
            v = db.query(Vehicle).filter(Vehicle.registration_number == reg).first()
            if not v:
                v = Vehicle(
                    registration_number=reg,
                    vehicle_type=vtype,
                    capacity_kg=cap,
                    status=VehicleStatus.AVAILABLE,
                )
                db.add(v)
                db.flush()
                print(f"Created Vehicle: {v.registration_number} (ID {v.id})")
            else:
                v.status = VehicleStatus.AVAILABLE
                v.capacity_kg = cap
                db.flush()
                print(f"Updated Vehicle: {v.registration_number} (ID {v.id}) -> AVAILABLE")
            vehicles.append(v)

        # 3. Ensure 4 Drivers exist and are AVAILABLE
        drivers = db.query(Driver).order_by(Driver.id.asc()).all()
        if len(drivers) < 4:
            print(f"Expected at least 4 drivers, found {len(drivers)}")
            return
        
        selected_drivers = drivers[:4]
        for d in selected_drivers:
            d.status = DriverStatus.ACTIVE
            d.is_available = True
            db.flush()
            print(f"Driver {d.id} ({d.user.name if d.user else 'Driver'}): ACTIVE & AVAILABLE")

        # 4. Ensure 4 Active Assignments (one driver per vehicle)
        # First close any old assignments for these drivers or vehicles
        db.query(DriverVehicleAssignment).filter(
            (DriverVehicleAssignment.driver_id.in_([d.id for d in selected_drivers])) |
            (DriverVehicleAssignment.vehicle_id.in_([v.id for v in vehicles]))
        ).update({"unassigned_at": datetime.now(timezone.utc)}, synchronize_session=False)
        db.flush()

        active_assignments = []
        for d, v in zip(selected_drivers, vehicles):
            assign = DriverVehicleAssignment(
                driver_id=d.id,
                vehicle_id=v.id,
                assigned_at=datetime.now(timezone.utc),
                unassigned_at=None,
            )
            db.add(assign)
            active_assignments.append(assign)
        db.flush()
        print(f"Created {len(active_assignments)} active driver-vehicle assignments.")

        # 5. Clean up old test routes that might lock pickups
        # Mark non-completed routes for today or tomorrow as CANCELLED so fresh optimization can run
        now = datetime.now(timezone.utc)
        today = now.replace(hour=0, minute=0, second=0, microsecond=0)
        tomorrow = today + timedelta(days=1)
        day_after = today + timedelta(days=2)

        # 6. Ensure Customer & CustomerLocations across 4 sectors around Warehouse 1
        # Customer 1 or first customer
        customer = db.query(Customer).first()
        if not customer:
            print("No customer found!")
            return

        # 4 sectors: North-East, South-East, South-West, West/North-West
        # Each sector has 7 stops with realistic pharmaceutical facilities in Bengaluru
        sector_stops = [
            # Sector 1: North-East (Indiranagar, Ulsoor, Kammanahalli, Kalyan Nagar, Kasturi Nagar)
            [
                ("Apollo Pharmacy Indiranagar", "100ft Rd, Indiranagar, Bengaluru", 12.9784, 77.6408, 18.5),
                ("MedPlus CMH Road", "CMH Road, Indiranagar, Bengaluru", 12.9850, 77.6520, 14.0),
                ("Manipal Clinic Kammanahalli", "Kammanahalli Main Rd, Bengaluru", 13.0012, 77.6385, 22.0),
                ("Cloudnine HRBR Layout", "HRBR Layout 2nd Block, Bengaluru", 13.0120, 77.6510, 16.5),
                ("Aster Clinic Kalyan Nagar", "Kalyan Nagar Ring Rd, Bengaluru", 13.0230, 77.6400, 19.0),
                ("Fortis Medical Centre Ulsoor", "Old Madras Rd, Ulsoor, Bengaluru", 12.9920, 77.6250, 25.0),
                ("Apollo Spectra Kasturi Nagar", "B Channasandra, Kasturi Nagar, Bengaluru", 13.0080, 77.6650, 12.5),
            ],
            # Sector 2: South-East (Koramangala, HSR Layout, Bellandur, Sarjapur)
            [
                ("Apollo Pharmacy Koramangala", "5th Block, Koramangala, Bengaluru", 12.9352, 77.6245, 20.0),
                ("MedPlus Koramangala 1st Block", "1st Block, Koramangala, Bengaluru", 12.9279, 77.6271, 15.0),
                ("Narayana Multispeciality HSR", "HSR Layout Sector 3, Bengaluru", 12.9121, 77.6446, 24.5),
                ("Apollo Cradle HSR Sector 2", "14th Main, HSR Layout, Bengaluru", 12.9080, 77.6560, 17.0),
                ("Sakra World Hospital Bellandur", "Devarabeesanahalli, Bellandur, Bengaluru", 12.9250, 77.6780, 28.0),
                ("Cloudnine Hospital Bellandur", "Outer Ring Rd, Bellandur, Bengaluru", 12.9150, 77.6850, 14.5),
                ("St. John Medical Centre Koramangala", "Sarjapur Main Rd, Bengaluru", 12.9380, 77.6150, 21.0),
            ],
            # Sector 3: South-West (Jayanagar, JP Nagar, Banashankari, Basavanagudi)
            [
                ("Apollo Pharmacy Jayanagar 4th Block", "11th Main, Jayanagar, Bengaluru", 12.9250, 77.5838, 16.0),
                ("MedPlus Jayanagar 9th Block", "9th Block, Jayanagar, Bengaluru", 12.9165, 77.5735, 13.5),
                ("Aster RV Hospital JP Nagar", "Outer Ring Rd, JP Nagar 1st Phase, Bengaluru", 12.9082, 77.5855, 26.0),
                ("Fortis Hospital Bannerghatta", "Bannerghatta Main Rd, Bengaluru", 12.8980, 77.5750, 30.0),
                ("Apollo Specialty Sarakki", "Sarakki Main Rd, Bengaluru", 12.9050, 77.5600, 15.5),
                ("Sagar Hospital Banashankari", "Banashankari 2nd Stage, Bengaluru", 12.9200, 77.5550, 22.5),
                ("Bangalore Hospital Basavanagudi", "Vanivilas Rd, Basavanagudi, Bengaluru", 12.9350, 77.5680, 18.0),
            ],
            # Sector 4: West / North-West (Malleshwaram, Rajajinagar, Yeshwanthpur, Vijayanagar)
            [
                ("Apollo Pharmacy Malleshwaram", "8th Cross, Malleshwaram, Bengaluru", 12.9980, 77.5700, 19.5),
                ("Manipal Hospital Malleshwaram", "18th Cross, Malleshwaram, Bengaluru", 13.0085, 77.5680, 27.0),
                ("MedPlus Rajajinagar 1st Block", "Dr Rajkumar Rd, Rajajinagar, Bengaluru", 12.9920, 77.5520, 14.0),
                ("Fortis Medical Centre Rajajinagar", "10th Main, Rajajinagar, Bengaluru", 12.9780, 77.5450, 21.5),
                ("Apollo Clinic Vijayanagar", "Chord Rd, Vijayanagar, Bengaluru", 12.9650, 77.5350, 17.5),
                ("Columbia Clinic Basaveshwaranagar", "1st Stage, Basaveshwaranagar, Bengaluru", 12.9850, 77.5380, 15.0),
                ("Sparsh Hospital Yeshwanthpur", "Tumkur Rd, Yeshwanthpur, Bengaluru", 13.0180, 77.5550, 25.0),
            ],
        ]

        # Seed pickups for today, tomorrow, and day after tomorrow
        dates_to_seed = [today, tomorrow, day_after]

        total_pickups_created = 0
        for target_date in dates_to_seed:
            date_str = target_date.strftime("%Y%m%d")
            # Check if pickups already exist for this date
            existing_for_date = db.query(Pickup).filter(
                Pickup.scheduled_date >= target_date,
                Pickup.scheduled_date < target_date + timedelta(days=1),
                Pickup.status == PickupStatus.SCHEDULED,
            ).count()

            if existing_for_date >= 28:
                print(f"Date {target_date.date()} already has {existing_for_date} scheduled pickups.")
                continue

            # Create or find locations and schedule pickups
            for sector_idx, sector in enumerate(sector_stops):
                for stop_idx, (loc_name, addr, lat, lng, weight) in enumerate(sector):
                    # Find or create location
                    loc = db.query(CustomerLocation).filter(
                        CustomerLocation.name == loc_name
                    ).first()
                    if not loc:
                        loc = CustomerLocation(
                            customer_id=customer.id,
                            location_code=f"LOC-{sector_idx+1}-{stop_idx+1:02d}",
                            name=loc_name,
                            address_line_1=addr,
                            city="Bengaluru",
                            state="Karnataka",
                            postal_code="560001",
                            latitude=float(lat),
                            longitude=float(lng),
                        )
                        db.add(loc)
                        db.flush()
                    else:
                        loc.latitude = float(lat)
                        loc.longitude = float(lng)
                        db.flush()

                    pickup_code = f"PK-{date_str}-S{sector_idx+1}-{stop_idx+1:02d}"
                    existing_p = db.query(Pickup).filter(Pickup.pickup_code == pickup_code).first()
                    if not existing_p:
                        scheduled_time = target_date + timedelta(hours=8 + (stop_idx % 8))
                        import secrets
                        p = Pickup(
                            customer_id=customer.id,
                            location_id=loc.id,
                            pickup_code=pickup_code,
                            status=PickupStatus.SCHEDULED,
                            priority=PickupPriority.NORMAL,
                            scheduled_date=scheduled_time,
                            estimated_weight_kg=Decimal(str(weight)),
                            verification_token=secrets.token_urlsafe(32),
                        )
                        db.add(p)
                        total_pickups_created += 1

        db.commit()
        print(f"Successfully seeded {total_pickups_created} scheduled pickups across 4 sectors around Warehouse 1.")

    except Exception as e:
        db.rollback()
        print(f"Error seeding route data: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    seed_route_data()
