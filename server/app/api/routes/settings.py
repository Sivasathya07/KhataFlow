"""Business profile and user-facing preference settings."""

import json
from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from app.api.dependencies import require_roles
from app.api.routes.inventory import get_business_id
from app.config import get_settings as get_app_settings
from app.database.mongo import get_database
from app.models.base import utc_now

router = APIRouter(prefix="/settings", tags=["settings"])


class BusinessSettings(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=120)
    logo_url: str | None = Field(default=None, alias="logoUrl", max_length=500)
    gst_number: str | None = Field(default=None, alias="gstNumber", max_length=30)
    currency: str | None = Field(default=None, min_length=3, max_length=3)
    language: str | None = Field(default=None, max_length=10)
    theme: str | None = Field(default=None, pattern="^(light|dark|system)$")
    backup_enabled: bool | None = Field(default=None, alias="backupEnabled")
    upi_id: str | None = Field(default=None, alias="upiId", max_length=100)
    business_upi_name: str | None = Field(default=None, alias="businessUpiName", max_length=120)
    business_whatsapp: str | None = Field(default=None, alias="businessWhatsapp", max_length=30)
    openai_api_key: str | None = Field(default=None, alias="openaiApiKey", max_length=200)
    openai_api_base: str | None = Field(default=None, alias="openaiApiBase", max_length=300)
    openai_model: str | None = Field(default=None, alias="openaiModel", max_length=100)


def _mask_secret(value: str | None) -> str:
    if not value:
        return ""
    if len(value) <= 8:
        return "••••••••"
    return f"{value[:4]}••••{value[-4:]}"


def _settings_view(item: dict) -> dict:
    app = get_app_settings()
    return {
        "name": item.get("name", ""),
        "logoUrl": item.get("logoUrl"),
        "gstNumber": item.get("gstNumber"),
        "currency": item.get("currency", "INR"),
        "language": item.get("language", "en"),
        "theme": item.get("theme", "system"),
        "backupEnabled": item.get("backupEnabled", False),
        "upiId": item.get("upiId") or app.upi_id or "",
        "businessUpiName": item.get("businessUpiName") or app.business_upi_name or "",
        "businessWhatsapp": item.get("businessWhatsapp") or app.business_whatsapp or "",
        "openaiApiKey": _mask_secret(item.get("openaiApiKey")),
        "openaiApiKeyConfigured": bool(item.get("openaiApiKey") or app.effective_llm_key),
        "openaiApiBase": item.get("openaiApiBase") or (app.llm_base_url if app.groq_api_key else ""),
        "openaiModel": item.get("openaiModel") or app.effective_llm_model,
        "llmProvider": "groq" if app.groq_api_key else ("tenant" if item.get("openaiApiKey") else "none"),
    }


@router.get("")
def get_settings(business_id: UUID = Depends(get_business_id)) -> dict:
    item = get_database()["businesses"].find_one({"publicId": business_id}, {"_id": 0}) or {"publicId": business_id}
    return {"data": _settings_view(item)}


@router.patch("")
def update_settings(
    payload: BusinessSettings,
    business_id: UUID = Depends(get_business_id),
    _: dict = Depends(require_roles("owner", "manager")),
) -> dict:
    changes = payload.model_dump(by_alias=True, exclude_none=True)
    # Ignore masked placeholder updates so secrets are not overwritten with bullets.
    if changes.get("openaiApiKey") and "•" in str(changes["openaiApiKey"]):
        changes.pop("openaiApiKey")
    changes["updatedAt"] = utc_now()
    get_database()["businesses"].update_one({"publicId": business_id}, {"$set": changes}, upsert=True)
    return get_settings(business_id)
