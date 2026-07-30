"""Supplier collection model."""

from typing import Any
from uuid import UUID

from pydantic import EmailStr, Field

from app.models.base import MongoDocument, SchemaModel
from app.models.user import Address


class SupplierContact(SchemaModel):
    name: str = Field(min_length=1, max_length=120)
    phone: str | None = Field(default=None, max_length=30)
    email: EmailStr | None = None
    address: Address | None = None


class Supplier(MongoDocument):
    business_id: UUID = Field(alias="businessId")
    name: str = Field(min_length=1, max_length=160)
    contact: SupplierContact
    tax_identifier: str | None = Field(default=None, max_length=80, alias="taxIdentifier")
    payment_terms_days: int | None = Field(default=None, ge=0, le=365, alias="paymentTermsDays")
    notes: str | None = Field(default=None, max_length=2000)
    metadata: dict[str, Any] = Field(default_factory=dict)
