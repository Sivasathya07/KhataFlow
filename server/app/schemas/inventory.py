"""Inventory movement request and response contracts."""

from decimal import Decimal
from uuid import UUID

from pydantic import Field

from app.models.base import SchemaModel


class InventoryMovementCreate(SchemaModel):
    product_id: UUID = Field(alias="productId")
    quantity: Decimal = Field(gt=0)
    movement_type: str = Field(alias="movementType", pattern="^(stock_in|stock_out|adjustment)$")
    direction: str | None = Field(default=None, pattern="^(increase|decrease)$")
    notes: str | None = Field(default=None, max_length=500)


class InventoryMovementResult(SchemaModel):
    product_id: UUID = Field(alias="productId")
    quantity_on_hand: Decimal = Field(alias="quantityOnHand")
    low_stock: bool = Field(alias="lowStock")
