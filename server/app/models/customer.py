"""Customer collection model."""

from decimal import Decimal
from typing import Any
from uuid import UUID

from pydantic import EmailStr, Field

from app.models.base import MongoDocument, SchemaModel
from app.models.user import Address


class CustomerContact(SchemaModel):
    """Contact details stored inline; identity fields are not used as references."""

    name: str = Field(min_length=1, max_length=120)
    phone: str | None = Field(default=None, max_length=30)
    email: EmailStr | None = None
    address: Address | None = None


class Customer(MongoDocument):
    """A business customer with optional credit and AI enrichment fields."""

    business_id: UUID = Field(alias="businessId")
    contact: CustomerContact
    tags: set[str] = Field(default_factory=set)
    credit_limit: Decimal | None = Field(default=None, ge=0, alias="creditLimit")
    outstanding_balance: Decimal = Field(default=Decimal("0"), ge=0, alias="outstandingBalance")
    preferences: dict[str, Any] = Field(default_factory=dict)
