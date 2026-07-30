"""User collection model."""

from typing import Any
from uuid import UUID

from pydantic import EmailStr, Field

from app.models.base import MongoDocument, SchemaModel
from app.models.enums import UserRole


class Address(SchemaModel):
    line1: str = Field(min_length=1, max_length=160)
    line2: str | None = Field(default=None, max_length=160)
    city: str = Field(min_length=1, max_length=80)
    state: str | None = Field(default=None, max_length=80)
    postal_code: str | None = Field(default=None, max_length=20, alias="postalCode")
    country_code: str = Field(default="IN", min_length=2, max_length=2, alias="countryCode")


class UserProfile(SchemaModel):
    display_name: str = Field(min_length=1, max_length=120, alias="displayName")
    phone: str | None = Field(default=None, max_length=30)
    avatar_url: str | None = Field(default=None, max_length=2048, alias="avatarUrl")
    address: Address | None = None


class User(MongoDocument):
    """Authenticated staff member belonging to one retail business."""

    business_id: UUID = Field(alias="businessId")
    email: EmailStr
    profile: UserProfile
    roles: set[UserRole] = Field(default_factory=lambda: {UserRole.OWNER})
    is_active: bool = Field(default=True, alias="isActive")
    agent_preferences: dict[str, Any] = Field(default_factory=dict, alias="agentPreferences")
