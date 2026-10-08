from types import SimpleNamespace
from unittest.mock import Mock, patch

from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.api.customer_documents import router
from app.core.auth import get_current_user
from app.core.database import get_db
from app.models.customer_document import CustomerDocumentType
from app.models.user import UserRole


# ---------------------------------------------------------
# Test application
# ---------------------------------------------------------

test_app = FastAPI()
test_app.include_router(router)


# ---------------------------------------------------------
# Fake users
# ---------------------------------------------------------

customer_user = SimpleNamespace(
    id=100,
    role=UserRole.CUSTOMER,
)

admin_user = SimpleNamespace(
    id=200,
    role=UserRole.ADMIN,
)


def override_customer_user():
    return customer_user


def override_admin_user():
    return admin_user


test_app.dependency_overrides[
    get_current_user
] = override_customer_user


client = TestClient(test_app)


# ---------------------------------------------------------
# Dummy DB
# ---------------------------------------------------------

class DummyQuery:
    def __init__(self, customer):
        self.customer = customer

    def filter(self, *args, **kwargs):
        return self

    def first(self):
        return self.customer


class DummyDB:
    def __init__(self, customer=None):
        self.customer = customer
        self.document = None
        self.committed = False

    def query(self, model):
        return DummyQuery(self.customer)

    def add(self, document):
        self.document = document

    def commit(self):
        self.committed = True

    def refresh(self, document):
        if document.id is None:
            document.id = 1


def override_db_with_customer():
    return DummyDB(
        customer=SimpleNamespace(
            id=10,
            user_id=100,
        )
    )


def override_db_without_customer():
    return DummyDB(
        customer=None,
    )


# ---------------------------------------------------------
# Mock Supabase storage
# ---------------------------------------------------------

def make_storage_mock():
    upload_mock = Mock()

    bucket_mock = Mock()
    bucket_mock.upload = upload_mock

    storage_mock = Mock()
    storage_mock.from_.return_value = bucket_mock

    return storage_mock, upload_mock


# ---------------------------------------------------------
# Valid upload
# ---------------------------------------------------------

def test_upload_customer_document_success():
    db = override_db_with_customer()

    def override_test_db():
        return db

    test_app.dependency_overrides[get_db] = override_test_db

    with patch(
        "app.api.customer_documents.supabase_storage"
    ) as storage_client_mock:

        upload_mock = (
            storage_client_mock
            .storage
            .from_()
            .upload
        )

        response = client.post(
            "/api/customers/documents/",
            data={
                "document_type": "DRUG_LICENSE",
                "document_number": "DL-12345",
            },
            files={
                "file": (
                    "license.pdf",
                    b"%PDF-1.7\nvalid test content",
                    "application/pdf",
                )
            },
        )

        assert response.status_code == 200

        body = response.json()

        assert body["id"] == 1
        assert body["document_type"] == "DRUG_LICENSE"
        assert body["document_number"] == "DL-12345"
        assert body["storage_path"].startswith(
            "customers/10/documents/"
        )
        assert body["storage_path"].endswith(".pdf")
        assert body["is_verified"] is False

        upload_mock.assert_called_once()

        upload_kwargs = upload_mock.call_args.kwargs

        assert upload_kwargs["file"] == (
            b"%PDF-1.7\nvalid test content"
        )
        assert upload_kwargs["file_options"]["content-type"] == (
            "application/pdf"
        )
        assert upload_kwargs["file_options"]["upsert"] == "false"

        assert db.document is not None
        assert db.document.customer_id == 10
        assert (
            db.document.document_type
            == CustomerDocumentType.DRUG_LICENSE
        )
        assert db.document.document_number == "DL-12345"
        assert db.document.is_verified is False
        assert db.committed is True

    test_app.dependency_overrides.pop(
        get_db,
        None,
    )


# ---------------------------------------------------------
# Unsupported MIME type
# ---------------------------------------------------------

def test_upload_rejects_unsupported_file_type():
    db = override_db_with_customer()

    def override_test_db():
        return db

    test_app.dependency_overrides[get_db] = override_test_db

    response = client.post(
        "/api/customers/documents/",
        data={
            "document_type": "OTHER",
        },
        files={
            "file": (
                "document.txt",
                b"plain text",
                "text/plain",
            )
        },
    )

    assert response.status_code == 400

    assert response.json()["detail"] == (
        "Unsupported file type. Use PDF, JPG or PNG."
    )

    test_app.dependency_overrides.pop(
        get_db,
        None,
    )


# ---------------------------------------------------------
# Invalid file signature
# ---------------------------------------------------------

def test_upload_rejects_invalid_file_signature():
    db = override_db_with_customer()

    def override_test_db():
        return db

    test_app.dependency_overrides[get_db] = override_test_db

    response = client.post(
        "/api/customers/documents/",
        data={
            "document_type": "AADHAAR",
        },
        files={
            "file": (
                "fake.pdf",
                b"this is not a pdf",
                "application/pdf",
            )
        },
    )

    assert response.status_code == 400

    assert response.json()["detail"] == (
        "File content does not match "
        "the declared file type"
    )

    test_app.dependency_overrides.pop(
        get_db,
        None,
    )


# ---------------------------------------------------------
# Oversized file
# ---------------------------------------------------------

def test_upload_rejects_file_larger_than_10_mb():
    db = override_db_with_customer()

    def override_test_db():
        return db

    test_app.dependency_overrides[get_db] = override_test_db

    oversized_pdf = (
        b"%PDF-1.7\n"
        + b"x" * (10 * 1024 * 1024)
    )

    response = client.post(
        "/api/customers/documents/",
        data={
            "document_type": "GST_CERTIFICATE",
        },
        files={
            "file": (
                "large.pdf",
                oversized_pdf,
                "application/pdf",
            )
        },
    )

    assert response.status_code == 400

    assert response.json()["detail"] == (
        "File must be smaller than 10 MB"
    )

    test_app.dependency_overrides.pop(
        get_db,
        None,
    )


# ---------------------------------------------------------
# Customer profile missing
# ---------------------------------------------------------

def test_upload_rejects_customer_without_profile():
    db = override_db_without_customer()

    def override_test_db():
        return db

    test_app.dependency_overrides[get_db] = override_test_db

    response = client.post(
        "/api/customers/documents/",
        data={
            "document_type": "OTHER",
        },
        files={
            "file": (
                "document.pdf",
                b"%PDF-1.7\nvalid test content",
                "application/pdf",
            )
        },
    )

    assert response.status_code == 404

    assert response.json()["detail"] == (
        "Customer profile not found"
    )

    test_app.dependency_overrides.pop(
        get_db,
        None,
    )


# ---------------------------------------------------------
# Storage failure
# ---------------------------------------------------------

def test_upload_returns_500_when_storage_fails():
    db = override_db_with_customer()

    def override_test_db():
        return db

    test_app.dependency_overrides[get_db] = override_test_db

    with patch(
        "app.api.customer_documents.supabase_storage"
    ) as storage_client_mock:

        upload_mock = (
            storage_client_mock
            .storage
            .from_()
            .upload
        )

        upload_mock.side_effect = Exception(
            "Storage unavailable"
        )

        response = client.post(
            "/api/customers/documents/",
            data={
                "document_type": "BUSINESS_REGISTRATION",
            },
            files={
                "file": (
                    "registration.pdf",
                    b"%PDF-1.7\nvalid test content",
                    "application/pdf",
                )
            },
        )

        assert response.status_code == 500

        assert response.json()["detail"] == (
            "Document upload failed: Storage unavailable"
        )

        assert db.document is None
        assert db.committed is False

    test_app.dependency_overrides.pop(
        get_db,
        None,
    )


# ---------------------------------------------------------
# Authorization
# ---------------------------------------------------------

def test_upload_rejects_non_customer():
    test_app.dependency_overrides[
        get_current_user
    ] = override_admin_user

    response = client.post(
        "/api/customers/documents/",
        data={
            "document_type": "OTHER",
        },
        files={
            "file": (
                "document.pdf",
                b"%PDF-1.7\nvalid test content",
                "application/pdf",
            )
        },
    )

    assert response.status_code == 403

    assert response.json()["detail"] == (
        "Insufficient permissions"
    )

    test_app.dependency_overrides[
        get_current_user
    ] = override_customer_user