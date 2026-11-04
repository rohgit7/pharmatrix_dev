from datetime import datetime, timedelta, timezone
from decimal import Decimal
import hashlib
from types import SimpleNamespace
from unittest.mock import MagicMock, patch
import uuid

from fastapi import HTTPException
import pytest

from app.api.customers import get_my_customer
from app.api.driver_route_execution import scan_pickup_qr, weigh_stop_endpoint
from app.api.pickups import (
    confirm_pickup_handover,
    create_my_pickup_payment_order,
    create_pickup_endpoint,
    get_customer_dashboard,
    get_customer_pickup_history,
    get_my_pickup_details,
    get_my_pickup_invoice,
    get_pickup_waste_categories,
    verify_my_pickup_payment,
)
from app.models.enums import (
    CustomerType,
    PickupPriority,
    PickupStatus,
    RouteStatus,
    RouteStopStatus,
    RouteStopType,
    UserRole,
)
from app.schemas.pickup import PickupCreate, PickupHandoverConfirmRequest
from app.schemas.pickup_verification import VerifyQRRequest
from app.schemas.razorpay import RazorpayPaymentVerificationRequest
from app.schemas.route_execution import WeighPickupRequest
from app.services.pickup_verification_driver_service import verify_otp, verify_qr
from app.services.pickup_verification_service import (
    get_verification_details,
    request_otp,
)
from app.services.route_execution_service import complete_stop


def test_waste_categories_metadata():
    mock_db = MagicMock()
    with patch(
        "app.api.pickups.get_active_version",
        return_value=SimpleNamespace(value="350"),
    ):
        res = get_pickup_waste_categories(db=mock_db)

    assert res["max_pickup_weight_kg"] == 350.0
    codes = [c["code"] for c in res["waste_categories"]]
    assert "EXPIRED_DISCARDED_MEDICINE" in codes
    assert "CHEMICAL" in codes
    assert "GLASSWARE" in codes
    assert "SHARPS" in codes
    assert len(res["time_slots"]) == 3


def test_create_pickup_encodes_categories_and_time_slot():
    user = SimpleNamespace(id=32, role=UserRole.CUSTOMER)
    mock_db = MagicMock()
    pub_id = uuid.uuid4()
    now = datetime.now(timezone.utc)

    created_pickup = SimpleNamespace(
        id=55,
        public_id=pub_id,
        pickup_code="PK-TEST55",
        customer_id=1,
        location_id=1,
        status=PickupStatus.REQUESTED,
        priority=PickupPriority.HIGH,
        requested_date=now,
        scheduled_date=None,
        estimated_weight_kg=24.5,
        notes="[CATEGORIES: EXPIRED_MEDICINES, SHARPS]\n[TIME_SLOT: 09:00 AM - 12:00 PM]\nFragile vials",
        failure_reason=None,
        collected_at=None,
        created_at=now,
        updated_at=now,
    )

    payload = PickupCreate(
        location_id=1,
        requested_date=now,
        priority=PickupPriority.HIGH,
        estimated_weight_kg=24.5,
        waste_categories=["EXPIRED_MEDICINES", "SHARPS"],
        time_slot="09:00 AM - 12:00 PM",
        notes="Fragile vials",
    )

    with patch("app.api.pickups.create_pickup", return_value=created_pickup) as mock_create:
        res = create_pickup_endpoint(data=payload, current_user=user, db=mock_db)

    assert res.pickup_code == "PK-TEST55"
    called_notes = mock_create.call_args.kwargs["notes"]
    assert "[CATEGORIES: EXPIRED_MEDICINES, SHARPS]" in called_notes
    assert "[TIME_SLOT: 09:00 AM - 12:00 PM]" in called_notes
    assert "Fragile vials" in called_notes


def test_driver_strictly_blocked_from_customer_otp_endpoints():
    driver_user = SimpleNamespace(id=99, role=UserRole.DRIVER)
    mock_db = MagicMock()
    pickup_uuid = uuid.uuid4()

    with pytest.raises(HTTPException) as exc1:
        get_verification_details(db=mock_db, user=driver_user, pickup_id=pickup_uuid)
    assert exc1.value.status_code == 403
    assert "Drivers are not authorized" in exc1.value.detail

    with pytest.raises(HTTPException) as exc2:
        request_otp(db=mock_db, user=driver_user, pickup_id=pickup_uuid)
    assert exc2.value.status_code == 403
    assert "Drivers are not authorized" in exc2.value.detail


def test_other_customer_blocked_from_accessing_pickup():
    customer_user_b = SimpleNamespace(id=202, role=UserRole.CUSTOMER)
    pickup_owned_by_a = SimpleNamespace(
        id=10,
        public_id=uuid.uuid4(),
        customer=SimpleNamespace(id=1, user_id=101),
    )
    mock_db = MagicMock()
    mock_db.query.return_value.filter.return_value.first.return_value = pickup_owned_by_a

    with pytest.raises(HTTPException) as exc:
        get_verification_details(
            db=mock_db,
            user=customer_user_b,
            pickup_id=pickup_owned_by_a.public_id,
        )
    assert exc.value.status_code == 404
    assert exc.value.detail == "Pickup not found"


def test_driver_qr_scan_never_returns_or_overwrites_customer_otp():
    driver_user = SimpleNamespace(id=10, role=UserRole.DRIVER)
    driver = SimpleNamespace(id=1, user_id=10)
    now = datetime.now(timezone.utc)

    # Customer already generated OTP "654321"
    existing_otp_hash = hashlib.sha256(b"654321").hexdigest()
    pickup = SimpleNamespace(
        id=101,
        public_id=uuid.uuid4(),
        pickup_code="PK-CUST01",
        verification_token="tok_secret_12345",
        qr_verified_at=None,
        otp_hash=existing_otp_hash,
        otp_expires_at=now + timedelta(minutes=10),
        otp_attempts=0,
    )
    stop = SimpleNamespace(
        id=501,
        route_id=10,
        sequence_number=1,
        stop_type=RouteStopType.PICKUP,
        execution_status=RouteStopStatus.ARRIVED,
        arrived_at=now,
        pickup=pickup,
    )
    route = SimpleNamespace(id=10, status=RouteStatus.IN_PROGRESS, stops=[stop])

    mock_db = MagicMock()
    mock_db.query.return_value.filter.return_value.with_for_update.return_value.first.return_value = stop
    mock_db.query.return_value.filter.return_value.order_by.return_value.first.return_value = None

    with patch(
        "app.services.pickup_verification_driver_service.get_driver_route",
        return_value=(driver, route),
    ):
        response = scan_pickup_qr(
            route_id=10,
            stop_id=501,
            data=VerifyQRRequest(qr_token="PK-CUST01"),
            current_user=driver_user,
            db=mock_db,
        )

    assert "otp" not in response
    assert response["otp_required"] is True
    # Customer's OTP hash must remain intact!
    assert pickup.otp_hash == existing_otp_hash


def test_full_customer_handover_payment_otp_and_completion_lifecycle():
    customer_user = SimpleNamespace(id=32, role=UserRole.CUSTOMER, name="ABC Admin", email="admin@abc.com")
    driver_user = SimpleNamespace(id=10, role=UserRole.DRIVER, name="Ramesh Driver")
    driver = SimpleNamespace(
        id=1,
        user_id=10,
        phone="+919900112233",
        license_number="DL-KA01-9988",
        user=driver_user,
        is_available=False,
    )
    vehicle = SimpleNamespace(
        id=1,
        registration_number="KA-01-AB-1234",
        vehicle_type="TRUCK",
    )
    now = datetime.now(timezone.utc)
    pub_id = uuid.uuid4()

    location = SimpleNamespace(
        id=1,
        public_id=uuid.uuid4(),
        location_code="LOC-001",
        name="ABC Central Warehouse",
        address_line_1="100 Industrial Road",
        address_line_2=None,
        city="Bengaluru",
        state="Karnataka",
        postal_code="560001",
        latitude=12.9716,
        longitude=77.5946,
        contact_name="ABC Manager",
        contact_phone="+919876543210",
    )

    customer = SimpleNamespace(
        id=1,
        user_id=32,
        display_name="ABC Distributor",
        email="admin@abc.com",
        phone="+919876543210",
    )

    pickup = SimpleNamespace(
        id=77,
        public_id=pub_id,
        pickup_code="PK-LIFE77",
        verification_token="verif_tok_77777",
        customer_id=1,
        customer=customer,
        location_id=1,
        location=location,
        status=PickupStatus.IN_PROGRESS,
        priority=PickupPriority.NORMAL,
        requested_date=now,
        scheduled_date=now,
        collected_at=None,
        created_at=now,
        updated_at=now,
        failure_reason=None,
        estimated_weight_kg=15.0,
        notes="[CATEGORIES: EXPIRED_MEDICINES, CYTOTOXIC_DRUGS]\n[TIME_SLOT: 09:00 AM - 12:00 PM]\nDock 2",
        qr_verified_at=now,
        otp_hash=None,
        otp_expires_at=None,
        otp_verified_at=None,
        otp_last_requested_at=None,
        otp_request_window_started_at=None,
        otp_request_count=0,
        otp_attempts=0,
    )

    route = SimpleNamespace(
        id=10,
        route_code="RT-2026-10",
        status=RouteStatus.IN_PROGRESS,
        driver=driver,
        vehicle=vehicle,
    )

    stop = SimpleNamespace(
        id=501,
        route_id=10,
        route=route,
        sequence_number=1,
        stop_type=RouteStopType.PICKUP,
        pickup_id=77,
        pickup=pickup,
        execution_status=RouteStopStatus.ARRIVED,
        arrived_at=now,
        completed_at=None,
        collected_weight_kg=18.0,  # Driver weighed 18.0 kg (Est was 15.0 kg -> +3.0 kg discrepancy)
        proof_storage_path="pickup-proofs/stop_501/proof.jpg",
    )

    invoice = SimpleNamespace(
        id=301,
        public_id=uuid.uuid4(),
        invoice_number="INV-20261104-000077",
        customer_id=1,
        pickup_id=77,
        currency="INR",
        subtotal=Decimal("550.00"),
        tax_amount=Decimal("0.00"),
        total_amount=Decimal("550.00"),
        amount_paid=Decimal("0.00"),
        outstanding_amount=Decimal("550.00"),
        status="ISSUED",
        issued_at=now,
        due_date=None,
        paid_at=None,
        pricing_snapshot={"actual_weight_kg": "18.0"},
        line_items=[
            SimpleNamespace(
                id=1,
                item_type="WEIGHT_CHARGE",
                description="Billable weight charge",
                quantity=Decimal("18.000"),
                unit_price=Decimal("25.00"),
                amount=Decimal("450.00"),
            ),
            SimpleNamespace(
                id=2,
                item_type="PICKUP_FEE",
                description="Pickup fee",
                quantity=Decimal("1.000"),
                unit_price=Decimal("100.00"),
                amount=Decimal("100.00"),
            ),
        ],
        payments=[],
    )

    mock_db = MagicMock()

    # 1. Customer confirms handover
    with patch("app.api.pickups.get_customer_pickup", return_value=pickup), patch(
        "app.api.pickups._ensure_invoice_for_pickup", return_value=invoice
    ), patch("app.api.pickups.flag_modified"):
        mock_db.query.return_value.filter.return_value.order_by.return_value.first.return_value = stop
        handover_res = confirm_pickup_handover(
            pickup_id=pub_id,
            data=PickupHandoverConfirmRequest(confirmed=True, notes="Verified 18kg on scale"),
            current_user=customer_user,
            db=mock_db,
        )

    assert handover_res["handover_confirmed"] is True
    assert handover_res["actual_weight_kg"] == 18.0
    assert handover_res["estimated_weight_kg"] == 15.0
    assert invoice.pricing_snapshot["handover_confirmed"] is True

    # 2. Customer creates Razorpay Order & verifies payment
    mock_order = SimpleNamespace(
        id=901,
        invoice_id=301,
        razorpay_order_id="order_test_77",
        amount_paise=55000,
        currency="INR",
        status="CREATED",
        idempotency_key="cust-pkp-77",
    )
    mock_db.scalar.return_value = mock_order

    with patch("app.api.pickups.get_customer_pickup", return_value=pickup), patch(
        "app.api.pickups._ensure_invoice_for_pickup", return_value=invoice
    ), patch(
        "app.api.pickups.create_razorpay_order",
        return_value={
            "key_id": "rzp_test_123",
            "order_id": "order_test_77",
            "amount": 55000,
            "currency": "INR",
            "status": "CREATED",
        },
    ):
        order_res = create_my_pickup_payment_order(
            pickup_id=pub_id,
            idempotency_key="idem-77",
            current_user=customer_user,
            db=mock_db,
        )
    assert order_res["order_id"] == "order_test_77"
    assert order_res["amount"] == 55000

    # Verify payment
    mock_db.query.return_value.filter.return_value.first.return_value = invoice
    with patch("app.api.pickups.get_customer_pickup", return_value=pickup), patch(
        "app.api.pickups.verify_razorpay_payment",
        return_value={
            "status": "PAID",
            "message": "Payment verified and recorded successfully.",
            "payment_id": 401,
        },
    ):
        invoice.status = "PAID"
        invoice.amount_paid = Decimal("550.00")
        invoice.outstanding_amount = Decimal("0.00")
        invoice.paid_at = now
        verify_res = verify_my_pickup_payment(
            pickup_id=pub_id,
            data=RazorpayPaymentVerificationRequest(
                razorpay_order_id="order_test_77",
                razorpay_payment_id="pay_test_77",
                razorpay_signature="sig_valid_77",
            ),
            current_user=customer_user,
            db=mock_db,
        )
    assert verify_res["status"] == "PAID"
    assert verify_res["invoice"]["status"] == "PAID"

    # 3. Customer generates OTP
    mock_db.query.return_value.filter.return_value.first.return_value = pickup
    _, generated_otp = request_otp(
        db=mock_db,
        user=customer_user,
        pickup_id=pub_id,
    )
    assert len(generated_otp) == 6
    assert generated_otp.isdigit()
    assert pickup.otp_hash is not None

    # 4. Driver verifies the customer-generated OTP
    mock_db.query.return_value.filter.return_value.with_for_update.return_value.first.return_value = stop
    with patch(
        "app.services.pickup_verification_driver_service.get_driver_route",
        return_value=(driver, route),
    ):
        verified_stop = verify_otp(
            db=mock_db,
            user=driver_user,
            route_id=10,
            stop_id=501,
            otp=generated_otp,
        )
    assert verified_stop.pickup.otp_verified_at is not None
    # Single-use OTP hash is cleared after successful verification
    assert verified_stop.pickup.otp_hash is None

    # 5. Driver completes stop (even though invoice already exists from step 1/2!)
    from app.services.invoice_service import InvoiceError

    with patch(
        "app.services.route_execution_service.get_driver_route",
        return_value=(driver, route),
    ), patch(
        "app.services.route_execution_service.get_active_version",
        return_value=SimpleNamespace(value="0.2"),
    ), patch(
        "app.services.route_execution_service.create_pickup_invoice",
        side_effect=InvoiceError("An invoice already exists for pickup 77."),
    ), patch(
        "app.services.route_execution_service.notify_pickup_completed",
        return_value=None,
    ):
        completed_stop = complete_stop(
            db=mock_db,
            user=driver_user,
            route_id=10,
            stop_id=501,
            collected_weight_kg=18.0,
        )

    assert completed_stop.execution_status == RouteStopStatus.COMPLETED
    assert pickup.status == PickupStatus.COLLECTED
    assert pickup.collected_at is not None
