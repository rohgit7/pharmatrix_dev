from datetime import datetime, timedelta, timezone
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.core.database import Base
from app.models.enums import PickupStatus, UserRole
from app.models.pickup import Pickup
from app.models.user import User
from app.models.device_token import DeviceToken
from app.models.user_consent import UserConsent, MarketingPreference
from app.schemas.compliance import (
    ConsentRecordRequest,
    MarketingPreferencesUpdate,
    DataDeletionRequest,
)
from app.services.compliance_service import (
    record_user_consent,
    get_user_consents,
    get_or_create_marketing_preferences,
    update_marketing_preferences,
)
from app.services.retention_service import (
    cleanup_expired_device_tokens,
    cleanup_expired_otp_metadata,
)

from app.api.compliance import get_privacy_policy, get_terms_and_conditions

def test_public_privacy_policy_endpoint():
    data = get_privacy_policy()
    assert data["version"] == "1.0.0"
    assert "Pharmatrix Privacy Policy" in data["document_name"]
    assert "content_markdown" in data
    assert len(data["content_markdown"]) > 100


def test_public_terms_endpoint():
    data = get_terms_and_conditions()
    assert data["version"] == "1.0.0"
    assert "Pharmatrix Terms and Conditions" in data["document_name"]
    assert "content_markdown" in data
    assert len(data["content_markdown"]) > 100


def test_compliance_schemas_validation():
    req = ConsentRecordRequest(
        consent_type="TERMS_AND_CONDITIONS",
        policy_version="1.0.0",
        status="CONSENTED",
    )
    assert req.consent_type == "TERMS_AND_CONDITIONS"

    with pytest.raises(Exception):
        ConsentRecordRequest(
            consent_type="INVALID",
            status="INVALID_STATUS",
        )

    m_pref = MarketingPreferencesUpdate(
        email_promotions=True,
        whatsapp_promotions=False,
    )
    assert m_pref.email_promotions is True
    assert m_pref.whatsapp_promotions is False


def test_compliance_services_in_memory_sqlite():
    engine = create_engine("sqlite:///:memory:")
    User.__table__.create(engine)
    UserConsent.__table__.create(engine)
    MarketingPreference.__table__.create(engine)
    DeviceToken.__table__.create(engine)
    Session = sessionmaker(bind=engine)
    session = Session()

    try:
        # Create user
        import uuid
        user = User(
            auth_user_id=uuid.uuid4(),
            name="Compliance Test User",
            email="compliance@test.com",
            role=UserRole.CUSTOMER,
            is_active=True,
        )
        session.add(user)
        session.commit()
        session.refresh(user)

        # 1. Test record consent
        consent = record_user_consent(
            db=session,
            user=user,
            data=ConsentRecordRequest(
                consent_type="PRIVACY_POLICY",
                policy_version="1.0.0",
                status="CONSENTED",
            ),
            ip_address="127.0.0.1",
            user_agent="PyTestClient/1.0",
        )
        assert consent.id is not None
        assert consent.status == "CONSENTED"
        assert consent.consent_type == "PRIVACY_POLICY"

        # 2. Test get consents
        consents = get_user_consents(session, user)
        assert len(consents) == 1
        assert consents[0].policy_version == "1.0.0"

        # 3. Test marketing preferences
        pref = get_or_create_marketing_preferences(session, user)
        assert pref.email_promotions is False

        updated_pref = update_marketing_preferences(
            session,
            user,
            MarketingPreferencesUpdate(email_promotions=True, push_promotions=True),
        )
        assert updated_pref.email_promotions is True
        assert updated_pref.push_promotions is True

        # 4. Test retention cleanup of device tokens
        now = datetime.now(timezone.utc)
        old_time = now - timedelta(days=200)

        # Active fresh token
        t1 = DeviceToken(
            user_id=user.id,
            expo_push_token="ExponentPushToken[fresh12345]",
            is_active=True,
            updated_at=now,
        )
        # Inactive old token
        t2 = DeviceToken(
            user_id=user.id,
            expo_push_token="ExponentPushToken[old1234567]",
            is_active=False,
            updated_at=old_time,
        )
        session.add(t1)
        session.add(t2)
        session.commit()

        purged_count = cleanup_expired_device_tokens(session, max_inactive_days=180)
        assert purged_count == 1

        remaining_tokens = session.query(DeviceToken).all()
        assert len(remaining_tokens) == 1
        assert remaining_tokens[0].expo_push_token == "ExponentPushToken[fresh12345]"

    finally:
        session.close()
