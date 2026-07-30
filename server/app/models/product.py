"""Product collection model."""

from decimal import Decimal
from typing import Any
from uuid import UUID

from pydantic import Field

from app.models.base import MongoDocument, MongoId, SchemaModel


class ProductPricing(SchemaModel):
    selling_price: Decimal = Field(gt=0, alias="sellingPrice")
    cost_price: Decimal | None = Field(default=None, ge=0, alias="costPrice")
    currency: str = Field(default="INR", min_length=3, max_length=3)
    tax_rate: Decimal = Field(default=Decimal("0"), ge=0, le=100, alias="taxRate")


class Inventory(SchemaModel):
    quantity_on_hand: Decimal = Field(default=Decimal("0"), ge=0, alias="quantityOnHand")
    reorder_level: Decimal = Field(default=Decimal("0"), ge=0, alias="reorderLevel")
    unit: str = Field(default="unit", min_length=1, max_length=24)
    track_inventory: bool = Field(default=True, alias="trackInventory")


class Product(MongoDocument):
    business_id: UUID = Field(alias="businessId")
    name: str = Field(min_length=1, max_length=200)
    sku: str | None = Field(default=None, max_length=80)
    barcode: str | None = Field(default=None, max_length=80)
    category: str | None = Field(default=None, max_length=100)
    pricing: ProductPricing
    inventory: Inventory = Field(default_factory=Inventory)
    supplier_ids: list[MongoId] = Field(default_factory=list, alias="supplierIds")
    attributes: dict[str, Any] = Field(default_factory=dict)
    is_active: bool = Field(default=True, alias="isActive")
    version: int = Field(default=1, ge=1)
