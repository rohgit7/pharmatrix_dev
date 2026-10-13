from datetime import datetime, timedelta, timezone
from decimal import Decimal
from types import SimpleNamespace
from uuid import UUID

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.api.invoices import router
from app.core.auth import get_current_user
from app.core.database import get_db
from app.models.user import UserRole


class DummyDB:
    def __init__(self, invoices=None):
        self.invoices = invoices or []

    def scalar(self, statement):
        invoice_public_id = statement.whereclause.right.value
        return next(
            (
                invoice
                for invoice in self.invoices
                if invoice.public_id == invoice_public_id
            ),
            None,
        )

    def scalars(self, statement):
        # Apply the filters requested by the API endpoint.
        invoices = list(self.invoices)

        for criterion in getattr(statement, "_where_criteria", ()):
            expression = str(criterion)

            if "customer_id" in expression:
                value = criterion.right.value
                invoices = [
                    invoice for invoice in invoices
                    if invoice.customer_id == value
                ]

            elif "status" in expression:
                value = criterion.right.value
                invoices = [
                    invoice for invoice in invoices
                    if invoice.status == value
                ]

        # Match the API's newest-first ordering.
        invoices.sort(
            key=lambda invoice: (invoice.created_at, invoice.id),
            reverse=True,
        )

        # Apply limit and offset.
        offset = statement._offset
        limit = statement._limit

        if offset is not None:
            invoices = invoices[offset:]

        if limit is not None:
            invoices = invoices[:limit]

        return SimpleNamespace(all=lambda: invoices)


def make_invoice(
    invoice_id=1,
    customer_id=10,
    invoice_status="ISSUED",
    line_items=None,
):
    now = datetime.now(timezone.utc) + timedelta(seconds=invoice_id)

    return SimpleNamespace(
        id=invoice_id,
        public_id=UUID(int=invoice_id),
        invoice_number=f"INV-{invoice_id:05d}",
        customer_id=customer_id,
        customer_public_id=UUID(int=1000 + customer_id),
        pickup_id=invoice_id,
        pricing_plan_id=1,
        pricing_plan_version_id=1,
        currency="INR",
        subtotal=Decimal("100.00"),
        tax_amount=Decimal("0.00"),
        total_amount=Decimal("100.00"),
        amount_paid=Decimal("0.00"),
        outstanding_amount=Decimal("100.00"),
        status=invoice_status,
        issued_at=now,
        due_date=None,
        paid_at=None,
        pricing_snapshot={},
        notes=None,
        created_at=now,
        updated_at=now,
        line_items=line_items or [],
    )


@pytest.fixture
def setup_client():
    admin = SimpleNamespace(id=1, role=UserRole.ADMIN)

    db = DummyDB([
        make_invoice(1, 10, "ISSUED"),
        make_invoice(2, 20, "PAID"),
        make_invoice(3, 10, "ISSUED"),
    ])

    test_app = FastAPI()
    test_app.include_router(router)

    test_app.dependency_overrides[get_current_user] = lambda: admin
    test_app.dependency_overrides[get_db] = lambda: db

    with TestClient(test_app) as client:
        yield client, db, test_app


def test_list_invoices_returns_successfully(setup_client):
    client, _, _ = setup_client

    response = client.get("/api/admin/invoices/")

    assert response.status_code == 200
    assert len(response.json()) == 3


def test_list_invoices_filters_by_customer(setup_client):
    client, _, _ = setup_client

    response = client.get("/api/admin/invoices/?customer_id=10")

    assert response.status_code == 200
    invoices = response.json()
    assert len(invoices) == 2
    assert all(invoice["customer_id"] == 10 for invoice in invoices)


def test_list_invoices_filters_by_status(setup_client):
    client, _, _ = setup_client

    response = client.get("/api/admin/invoices/?status=PAID")

    assert response.status_code == 200
    invoices = response.json()
    assert len(invoices) == 1
    assert all(invoice["status"] == "PAID" for invoice in invoices)


def test_list_invoices_supports_pagination(setup_client):
    client, _, _ = setup_client

    response = client.get("/api/admin/invoices/?limit=1&offset=1")

    assert response.status_code == 200
    invoices = response.json()
    assert len(invoices) == 1
    assert invoices[0]["id"] == 2


def test_list_invoices_returns_newest_first(setup_client):
    client, _, _ = setup_client

    response = client.get("/api/admin/invoices/")

    assert response.status_code == 200
    ids = [invoice["id"] for invoice in response.json()]
    assert ids == [3, 2, 1]


def test_get_invoice_returns_details(setup_client):
    client, _, _ = setup_client

    response = client.get(f"/api/admin/invoices/{UUID(int=1)}")

    assert response.status_code == 200
    invoice = response.json()
    assert invoice["id"] == 1
    assert invoice["invoice_number"] == "INV-00001"
    assert invoice["line_items"] == []


def test_get_invoice_returns_404_for_missing_invoice(setup_client):
    client, _, _ = setup_client

    response = client.get(f"/api/admin/invoices/{UUID(int=999)}")

    assert response.status_code == 404
    assert response.json()["detail"] == "Invoice not found"


def test_non_admin_cannot_list_invoices(setup_client):
    client, _, test_app = setup_client

    test_app.dependency_overrides[get_current_user] = lambda: SimpleNamespace(
        id=2,
        role=UserRole.CUSTOMER,
    )

    response = client.get("/api/admin/invoices/")

    assert response.status_code == 403
    assert response.json()["detail"] == "Insufficient permissions"


def test_non_admin_cannot_get_invoice(setup_client):
    client, _, test_app = setup_client

    test_app.dependency_overrides[get_current_user] = lambda: SimpleNamespace(
        id=2,
        role=UserRole.CUSTOMER,
    )

    response = client.get(f"/api/admin/invoices/{UUID(int=1)}")

    assert response.status_code == 403
    assert response.json()["detail"] == "Insufficient permissions"
