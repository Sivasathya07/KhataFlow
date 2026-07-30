"""Shared request authentication dependencies."""

from uuid import UUID
import jwt
from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.config import Settings, get_settings

bearer = HTTPBearer(auto_error=False)


def current_claims(credentials: HTTPAuthorizationCredentials | None = Depends(bearer), settings: Settings = Depends(get_settings)) -> dict:
    if credentials is None:
        raise HTTPException(status_code=401, detail="Authentication required.")
    try:
        claims = jwt.decode(credentials.credentials, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
    except jwt.PyJWTError as exc:
        raise HTTPException(status_code=401, detail="Invalid or expired access token.") from exc
    if claims.get("type") != "access":
        raise HTTPException(status_code=401, detail="Access token required.")
    return claims


def authenticated_business_id(claims: dict = Depends(current_claims)) -> UUID:
    return UUID(claims["businessId"])


def require_roles(*allowed: str):
    """Use on write/admin endpoints to enforce account roles from the JWT."""
    def check(claims: dict = Depends(current_claims)) -> dict:
        if not set(claims.get("roles", [])).intersection(allowed):
            raise HTTPException(status_code=403, detail="Your role is not permitted to perform this action.")
        return claims
    return check
