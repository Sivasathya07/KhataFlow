"""Inventory use cases. HTTP and MongoDB details stay outside this layer."""

from dataclasses import dataclass
from decimal import Decimal
from typing import Any
from uuid import UUID

from app.models.product import Product
from app.repositories.product_repository import DuplicateProductIdentifierError, ProductRepository
from app.schemas.product import ProductCreate, ProductUpdate


@dataclass
class InventoryError(Exception):
    code: str
    message: str
    status_code: int


class ProductService:
    def __init__(self, repository: ProductRepository) -> None:
        self._repository = repository

    def create_product(self, business_id: UUID, payload: ProductCreate) -> Product:
        if self._repository.find_duplicate(business_id, payload.sku, payload.barcode):
            raise InventoryError("DUPLICATE_PRODUCT_IDENTIFIER", "A product with this SKU or barcode already exists.", 409)
        product = Product(
            businessId=business_id,
            name=payload.name,
            sku=payload.sku,
            barcode=payload.barcode,
            category=payload.category,
            pricing=payload.pricing,
            inventory=payload.inventory.to_inventory(),
            supplierIds=payload.supplier_ids,
        )
        try:
            return self._repository.create(product)
        except DuplicateProductIdentifierError as error:
            raise InventoryError("DUPLICATE_PRODUCT_IDENTIFIER", "A product with this SKU or barcode already exists.", 409) from error

    def get_product(self, business_id: UUID, product_id: UUID) -> Product:
        product = self._repository.get(business_id, product_id)
        if not product:
            raise InventoryError("PRODUCT_NOT_FOUND", "Product was not found.", 404)
        return product

    def list_products(self, business_id: UUID, query: str | None, category: str | None, include_inactive: bool, page: int = 1, limit: int = 100) -> tuple[list[Product], int]:
        return self._repository.list(business_id, query, category, include_inactive, skip=(page - 1) * limit, limit=limit), self._repository.count(business_id, query, category, include_inactive)

    def update_product(self, business_id: UUID, product_id: UUID, payload: ProductUpdate) -> Product:
        current = self.get_product(business_id, product_id)
        sku = payload.sku if "sku" in payload.model_fields_set else current.sku
        barcode = payload.barcode if "barcode" in payload.model_fields_set else current.barcode
        duplicate = self._repository.find_duplicate(business_id, sku, barcode, exclude_id=product_id)
        if duplicate:
            raise InventoryError("DUPLICATE_PRODUCT_IDENTIFIER", "A product with this SKU or barcode already exists.", 409)
        try:
            updated = self._repository.update(business_id, product_id, payload.version, self._changes(payload))
        except DuplicateProductIdentifierError as error:
            raise InventoryError("DUPLICATE_PRODUCT_IDENTIFIER", "A product with this SKU or barcode already exists.", 409) from error
        if not updated:
            raise InventoryError("STALE_VERSION", "This product changed before your update. Refresh and try again.", 409)
        return updated

    def delete_product(self, business_id: UUID, product_id: UUID) -> None:
        if not self._repository.delete(business_id, product_id):
            raise InventoryError("PRODUCT_NOT_FOUND", "Product was not found.", 404)

    def apply_inventory_deductions(self, business_id: UUID, deductions: list[tuple[UUID, Decimal]]) -> list[Product]:
        """Apply reviewed sale quantities through the existing inventory service boundary."""
        updated_products: list[Product] = []
        for product_id, quantity in deductions:
            product = self.get_product(business_id, product_id)
            if not product.inventory.track_inventory:
                updated_products.append(product)
                continue
            updated = self._repository.decrement_inventory(business_id, product_id, quantity)
            if not updated:
                raise InventoryError("INSUFFICIENT_STOCK", f"Insufficient stock for {product.name}.", 409)
            updated_products.append(updated)
        return updated_products

    @staticmethod
    def _changes(payload: ProductUpdate) -> dict[str, Any]:
        changes: dict[str, Any] = {}
        for field, storage_field in (("name", "name"), ("sku", "sku"), ("barcode", "barcode"), ("category", "category"), ("supplier_ids", "supplierIds"), ("is_active", "isActive")):
            if field in payload.model_fields_set:
                changes[storage_field] = getattr(payload, field)
        if payload.pricing is not None:
            for key, value in payload.pricing.model_dump(by_alias=True).items():
                changes[f"pricing.{key}"] = value
        if payload.inventory is not None:
            for key, value in payload.inventory.model_dump(by_alias=True, exclude_none=True).items():
                changes[f"inventory.{key}"] = value
        return changes
