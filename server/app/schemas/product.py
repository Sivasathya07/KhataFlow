"""Inventory API contracts; persistence-only fields stay out of client payloads."""

from decimal import Decimal
from uuid import UUID

from pydantic import Field, model_validator

from app.models.base import SchemaModel
from app.models.product import Inventory, ProductPricing


class ProductInventoryCreate(SchemaModel):
    opening_quantity: Decimal = Field(default=Decimal("0"), ge=0, alias="openingQuantity")
    reorder_level: Decimal = Field(default=Decimal("0"), ge=0, alias="reorderLevel")
    unit: str = Field(default="unit", min_length=1, max_length=24)
    track_inventory: bool = Field(default=True, alias="trackInventory")

    def to_inventory(self) -> Inventory:
        return Inventory(
            quantityOnHand=self.opening_quantity,
            reorderLevel=self.reorder_level,
            unit=self.unit,
            trackInventory=self.track_inventory,
        )


class ProductCreate(SchemaModel):
    name: str = Field(min_length=1, max_length=200)
    sku: str | None = Field(default=None, min_length=1, max_length=80)
    barcode: str | None = Field(default=None, min_length=1, max_length=80)
    category: str | None = Field(default=None, min_length=1, max_length=100)
    pricing: ProductPricing
    inventory: ProductInventoryCreate = Field(default_factory=ProductInventoryCreate)
    supplier_ids: list[str] = Field(default_factory=list, alias="supplierIds")


class ProductInventoryUpdate(SchemaModel):
    reorder_level: Decimal | None = Field(default=None, ge=0, alias="reorderLevel")
    unit: str | None = Field(default=None, min_length=1, max_length=24)
    track_inventory: bool | None = Field(default=None, alias="trackInventory")


class ProductUpdate(SchemaModel):
    name: str | None = Field(default=None, min_length=1, max_length=200)
    sku: str | None = Field(default=None, min_length=1, max_length=80)
    barcode: str | None = Field(default=None, min_length=1, max_length=80)
    category: str | None = Field(default=None, min_length=1, max_length=100)
    pricing: ProductPricing | None = None
    inventory: ProductInventoryUpdate | None = None
    supplier_ids: list[str] | None = Field(default=None, alias="supplierIds")
    is_active: bool | None = Field(default=None, alias="isActive")
    version: int = Field(ge=1)

    @model_validator(mode="after")
    def include_a_change(self) -> "ProductUpdate":
        if not any(value is not None for key, value in self.__dict__.items() if key != "version"):
            raise ValueError("At least one product field must be supplied")
        return self


class ProductSummary(SchemaModel):
    id: UUID
    name: str
    sku: str | None = None
    barcode: str | None = None
    category: str | None = None
    selling_price: Decimal = Field(alias="sellingPrice")
    currency: str
    quantity_on_hand: Decimal = Field(alias="quantityOnHand")
    reorder_level: Decimal = Field(alias="reorderLevel")
    unit: str
    is_active: bool = Field(alias="isActive")
    version: int


class ProductDetail(ProductSummary):
    cost_price: Decimal | None = Field(alias="costPrice")
    tax_rate: Decimal = Field(alias="taxRate")
    track_inventory: bool = Field(alias="trackInventory")
    supplier_ids: list[str] = Field(alias="supplierIds")
    created_at: str = Field(alias="createdAt")
    updated_at: str = Field(alias="updatedAt")
