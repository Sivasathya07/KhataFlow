"""JWT authentication endpoints with bcrypt password hashing."""

from datetime import datetime, timedelta, timezone
from uuid import UUID, uuid4

import bcrypt
import jwt
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr, Field

from app.api.dependencies import current_claims
from app.config import get_settings
from app.database.mongo import get_database
from app.models.base import utc_now

router = APIRouter(prefix="/auth", tags=["authentication"])


class RegisterRequest(BaseModel):
    business_name: str = Field(min_length=2, max_length=120, alias="businessName")
    display_name: str = Field(min_length=2, max_length=120, alias="displayName")
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=128)


class RefreshRequest(BaseModel):
    refresh_token: str = Field(min_length=20, alias="refreshToken")


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    token: str = Field(min_length=20)
    password: str = Field(min_length=8, max_length=128)


class VerifyEmailRequest(BaseModel):
    token: str = Field(min_length=20)


class LogoutRequest(BaseModel):
    refresh_token: str | None = Field(default=None, alias="refreshToken")


def _user_view(user: dict) -> dict:
    return {
        "id": str(user["publicId"]),
        "email": user["email"],
        "displayName": user.get("profile", {}).get("displayName", ""),
        "roles": user.get("roles", []),
        "businessId": str(user["businessId"]),
        "isEmailVerified": bool(user.get("isEmailVerified", False)),
    }


def _tokens(user: dict) -> dict[str, str]:
    settings = get_settings()
    now = datetime.now(timezone.utc)
    refresh_jti = str(uuid4())
    claims = {"sub": str(user["publicId"]), "businessId": str(user["businessId"]), "roles": user["roles"]}
    access = jwt.encode(
        {**claims, "type": "access", "iat": now, "exp": now + timedelta(minutes=settings.access_token_minutes), "jti": str(uuid4())},
        settings.jwt_secret,
        algorithm=settings.jwt_algorithm,
    )
    refresh = jwt.encode(
        {**claims, "type": "refresh", "iat": now, "exp": now + timedelta(days=settings.refresh_token_days), "jti": refresh_jti},
        settings.jwt_secret,
        algorithm=settings.jwt_algorithm,
    )
    get_database()["refresh_tokens"].insert_one(
        {
            "jti": refresh_jti,
            "userId": user["publicId"],
            "businessId": user["businessId"],
            "createdAt": utc_now(),
            "expiresAt": now + timedelta(days=settings.refresh_token_days),
            "revokedAt": None,
        }
    )
    return {"accessToken": access, "refreshToken": refresh, "tokenType": "bearer"}


def _dev_token_payload(token: str, template: str) -> dict:
    settings = get_settings()
    if settings.is_development and not settings.smtp_host:
        return {"devToken": token, "template": template, "hint": "SMTP is not configured. Use this token in development."}
    return {}


@router.post("/register", status_code=status.HTTP_201_CREATED)
def register(payload: RegisterRequest) -> dict:
    db = get_database()
    email = str(payload.email).casefold()
    if db["users"].find_one({"email": email}):
        raise HTTPException(status_code=409, detail="An account with this email already exists.")
    business_id, user_id = uuid4(), uuid4()
    db["businesses"].insert_one(
        {
            "publicId": business_id,
            "name": payload.business_name,
            "currency": "INR",
            "language": "en",
            "theme": "system",
            "createdAt": utc_now(),
            "updatedAt": utc_now(),
        }
    )
    user = {
        "publicId": user_id,
        "businessId": business_id,
        "email": email,
        "passwordHash": bcrypt.hashpw(payload.password.encode(), bcrypt.gensalt()).decode(),
        "profile": {"displayName": payload.display_name},
        "roles": ["owner"],
        "isActive": True,
        "isEmailVerified": False,
        "createdAt": utc_now(),
        "updatedAt": utc_now(),
    }
    db["users"].insert_one(user)
    now = datetime.now(timezone.utc)
    token = jwt.encode(
        {
            "sub": str(user_id),
            "type": "email_verification",
            "iat": now,
            "exp": now + timedelta(days=get_settings().verification_token_days),
            "jti": str(uuid4()),
        },
        get_settings().jwt_secret,
        algorithm=get_settings().jwt_algorithm,
    )
    db["email_outbox"].insert_one(
        {"publicId": uuid4(), "to": email, "template": "verify_email", "token": token, "createdAt": utc_now(), "consumedAt": None}
    )
    return {"data": {"user": _user_view(user), **_tokens(user), **_dev_token_payload(token, "verify_email")}}


@router.post("/login")
def login(payload: LoginRequest) -> dict:
    user = get_database()["users"].find_one({"email": str(payload.email).casefold()})
    if not user or not user.get("isActive") or not bcrypt.checkpw(payload.password.encode(), user.get("passwordHash", "").encode()):
        raise HTTPException(status_code=401, detail="Invalid email or password.")
    return {"data": {"user": _user_view(user), **_tokens(user)}}


@router.post("/refresh")
def refresh(payload: RefreshRequest) -> dict:
    settings = get_settings()
    try:
        claims = jwt.decode(payload.refresh_token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
    except jwt.PyJWTError as exc:
        raise HTTPException(status_code=401, detail="Invalid or expired refresh token.") from exc
    if claims.get("type") != "refresh":
        raise HTTPException(status_code=401, detail="Invalid refresh token.")
    jti = claims.get("jti")
    db = get_database()
    if jti:
        stored = db["refresh_tokens"].find_one({"jti": jti, "revokedAt": None})
        if not stored:
            raise HTTPException(status_code=401, detail="Refresh token has been revoked.")
        db["refresh_tokens"].update_one({"jti": jti}, {"$set": {"revokedAt": utc_now()}})
    user = db["users"].find_one({"publicId": UUID(claims["sub"]), "isActive": True})
    if not user:
        raise HTTPException(status_code=401, detail="Account is unavailable.")
    return {"data": _tokens(user)}


@router.get("/me")
def me(claims: dict = Depends(current_claims)) -> dict:
    user = get_database()["users"].find_one({"publicId": UUID(claims["sub"]), "isActive": True})
    if not user:
        raise HTTPException(status_code=401, detail="Account is unavailable.")
    business = get_database()["businesses"].find_one({"publicId": user["businessId"]}, {"_id": 0, "name": 1}) or {}
    return {"data": {**_user_view(user), "businessName": business.get("name", "")}}


@router.post("/logout")
def logout(payload: LogoutRequest | None = None) -> dict:
    """Revoke presented refresh token sessions when a body is provided."""
    db = get_database()
    settings = get_settings()
    token = payload.refresh_token if payload else None
    if token:
        try:
            refresh_claims = jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
            jti = refresh_claims.get("jti")
            if jti:
                db["refresh_tokens"].update_one({"jti": jti}, {"$set": {"revokedAt": utc_now()}})
            if refresh_claims.get("sub"):
                db["refresh_tokens"].update_many(
                    {"userId": UUID(refresh_claims["sub"]), "revokedAt": None},
                    {"$set": {"revokedAt": utc_now()}},
                )
        except (jwt.PyJWTError, ValueError, KeyError):
            pass
    return {"data": {"message": "Signed out."}}


@router.post("/forgot-password")
def forgot_password(payload: ForgotPasswordRequest) -> dict:
    """Create a single-use reset token. Delivery is recorded in the email outbox."""
    db = get_database()
    user = db["users"].find_one({"email": str(payload.email).casefold(), "isActive": True})
    response: dict = {"message": "If this email is registered, reset instructions have been sent."}
    if user:
        settings = get_settings()
        now = datetime.now(timezone.utc)
        token = jwt.encode(
            {
                "sub": str(user["publicId"]),
                "type": "password_reset",
                "iat": now,
                "exp": now + timedelta(minutes=settings.password_reset_minutes),
                "jti": str(uuid4()),
            },
            settings.jwt_secret,
            algorithm=settings.jwt_algorithm,
        )
        db["email_outbox"].insert_one(
            {"publicId": uuid4(), "to": user["email"], "template": "password_reset", "token": token, "createdAt": utc_now(), "consumedAt": None}
        )
        response.update(_dev_token_payload(token, "password_reset"))
    return {"data": response}


@router.post("/reset-password")
def reset_password(payload: ResetPasswordRequest) -> dict:
    settings = get_settings()
    try:
        claims = jwt.decode(payload.token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
        if claims.get("type") != "password_reset":
            raise jwt.InvalidTokenError("Unexpected token type")
        token_id = claims["jti"]
        user_id = UUID(claims["sub"])
    except (jwt.PyJWTError, KeyError, ValueError) as exc:
        raise HTTPException(status_code=401, detail="Invalid or expired reset token.") from exc
    db = get_database()
    outbox = db["email_outbox"].find_one({"token": payload.token, "consumedAt": None})
    if not outbox:
        raise HTTPException(status_code=401, detail="This reset token has already been used.")
    result = db["users"].update_one(
        {"publicId": user_id, "isActive": True},
        {"$set": {"passwordHash": bcrypt.hashpw(payload.password.encode(), bcrypt.gensalt()).decode(), "updatedAt": utc_now()}},
    )
    if not result.matched_count:
        raise HTTPException(status_code=401, detail="Account is unavailable.")
    db["email_outbox"].update_one({"_id": outbox["_id"]}, {"$set": {"consumedAt": utc_now(), "tokenId": token_id}})
    db["refresh_tokens"].update_many({"userId": user_id, "revokedAt": None}, {"$set": {"revokedAt": utc_now()}})
    return {"data": {"message": "Password reset successfully."}}


@router.post("/verify-email")
def verify_email(payload: VerifyEmailRequest) -> dict:
    settings = get_settings()
    try:
        claims = jwt.decode(payload.token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
        if claims.get("type") != "email_verification":
            raise jwt.InvalidTokenError("Unexpected token type")
        user_id = UUID(claims["sub"])
    except (jwt.PyJWTError, KeyError, ValueError) as exc:
        raise HTTPException(status_code=401, detail="Invalid or expired verification token.") from exc
    db = get_database()
    outbox = db["email_outbox"].find_one({"token": payload.token, "consumedAt": None, "template": "verify_email"})
    if not outbox:
        raise HTTPException(status_code=401, detail="This verification token has already been used.")
    db["users"].update_one({"publicId": user_id}, {"$set": {"isEmailVerified": True, "updatedAt": utc_now()}})
    db["email_outbox"].update_one({"_id": outbox["_id"]}, {"$set": {"consumedAt": utc_now()}})
    return {"data": {"message": "Email verified successfully."}}
