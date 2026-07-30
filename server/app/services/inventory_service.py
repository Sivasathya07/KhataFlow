"""Inventory movements and audit records built on the existing product repository."""

from decimal import Decimal
from typing import Any
from uuid import UUID, uuid4

from bson.decimal128 import Decimal128

from app.models.base import utc_now
from app.models.product import Product
from app.repositories.product_repository import ProductRepository
from app.schemas.inventory import InventoryMovementCreate, InventoryMovementResult
from app.services.product_service import InventoryError


class InventoryService:
    def __init__(self, products: ProductRepository, logs: Any) -> None:
        self._products = products
        self._logs = logs

    def move(self, business_id: UUID, payload: InventoryMovementCreate) -> InventoryMovementResult:
        product = self._products.get(business_id, payload.product_id)
        if not product:
            raise InventoryError("PRODUCT_NOT_FOUND", "Product was not found.", 404)
        if not product.inventory.track_inventory:
            raise InventoryError("INVENTORY_NOT_TRACKED", f"Inventory tracking is disabled for {product.name}.", 409)
        change = payload.quantity if payload.movement_type == "stock_in" else -payload.quantity
        if payload.movement_type == "adjustment":
            if payload.direction is None:
                raise InventoryError("ADJUSTMENT_DIRECTION_REQUIRED", "Adjustments require an increase or decrease direction.", 422)
            change = payload.quantity if payload.direction == "increase" else -payload.quantity
        updated = self._products.adjust_inventory(business_id, payload.product_id, change)
        if not updated:
            raise InventoryError("INSUFFICIENT_STOCK", f"Insufficient stock for {product.name}.", 409)
        self._logs.insert_one({"publicId": uuid4(), "businessId": business_id, "productId": payload.product_id, "movementType": payload.movement_type, "change": Decimal128(change), "quantityAfter": Decimal128(updated.inventory.quantity_on_hand), "notes": payload.notes, "createdAt": utc_now()})
        return InventoryMovementResult(productId=payload.product_id, quantityOnHand=updated.inventory.quantity_on_hand, lowStock=updated.inventory.quantity_on_hand <= updated.inventory.reorder_level)
