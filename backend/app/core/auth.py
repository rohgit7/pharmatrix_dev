import logging
from typing import Optional
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session
import jwt
from jwt import PyJWKClient, PyJWTError

from app.core.config import settings
from app.core.database import get_db
from app.core.supabase import supabase
from app.models.user import User, UserRole
from app.models.facility import Facility

logger = logging.getLogger("pharmatrix.auth")
bearer_scheme = HTTPBearer()

# Cached JWKS client for instant local cryptographic token verification (< 1ms)
jwks_url = f"{settings.SUPABASE_URL.rstrip('/')}/auth/v1/.well-known/jwks.json"
jwks_client = PyJWKClient(jwks_url, cache_keys=True, max_cached_keys=10)


def extract_auth_user_id(token: str) -> str:
    """
    Cryptographically verify the Supabase JWT using cached JWKS public keys.
    Falls back to Supabase API if local JWKS check fails (e.g. key rotation).
    """
    # 1. Fast local JWKS signature and expiration verification
    try:
        signing_key = jwks_client.get_signing_key_from_jwt(token)
        payload = jwt.decode(
            token,
            signing_key.key,
            algorithms=["ES256", "HS256"],
            audience="authenticated",
        )
        auth_user_id = payload.get("sub")
        if auth_user_id:
            return str(auth_user_id)
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has expired",
        )
    except Exception as jwks_err:
        logger.debug("Local JWKS validation failed: %s. Falling back to Supabase API.", jwks_err)

    # 2. Fallback to Supabase GoTrue API
    try:
        response = supabase.auth.get_user(token)
        if response and response.user:
            return str(response.user.id)
    except Exception as api_err:
        logger.warning("Supabase get_user API failed: %s", api_err)

    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid or expired token",
    )


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> User:
    token = credentials.credentials
    auth_user_id = extract_auth_user_id(token)

    user = (
        db.query(User)
        .filter(User.auth_user_id == auth_user_id)
        .first()
    )

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Pharmatrix user profile not found",
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is inactive",
        )

    return user


def require_role(*roles: UserRole):
    def role_dependency(
        current_user: User = Depends(get_current_user),
    ) -> User:
        if current_user.role not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Insufficient permissions",
            )
        return current_user

    return role_dependency
