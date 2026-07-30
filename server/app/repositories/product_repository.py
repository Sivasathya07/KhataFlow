"""Product repository contract and MongoDB implementation."""

import re
from decimal import Decimal
from typing import Any, Protocol
from uuid import UUID

from bson.decimal128 import Decimal128
from pymongo import ASCENDING, DESCENDING, ReturnDocument
from pymongo.collection import Collection
from pymongo.errors import DuplicateKeyError

from app.models.base import utc_now
from app.models.product import Product


def _encode_for_mongo(value: Any) -> Any:
    if isinstance(value, Decimal):
        return Decimal128(value)
    if isinstance(value, dict):
        return {key: _encode_for_mongo(item) for key, item in value.items()}
    if isinstance(value, list):
        return [_encode_for_mongo(item) for item in value]
    return value


def _decode_from_mongo(value: Any) -> Any:
    if isinstance(value, Decimal128):
        return value.to_decimal()
    if isinstance(value, dict):
        return {key: _decode_from_mongo(item) for key, item in value.items()}
    if isinstance(value, list):
        return [_decode_from_mongo(item) for item in value]
    return value


class ProductRepository(Protocol):
    def create(self, product: Product) -> Product: ...
    def get(self, business_id: UUID, product_id: UUID) -> Product | None: ...
    def list(self, business_id: UUID, query: str | None, category: str | None, include_inactive: bool, skip: int = 0, limit: int = 100) -> list[Product]: ...
    def count(self, business_id: UUID, query: str | None, category: str | None, include_inactive: bool) -> int: ...
    def find_duplicate(self, business_id: UUID, sku: str | None, barcode: str | None, exclude_id: UUID | None = None) -> Product | None: ...
    def update(self, business_id: UUID, product_id: UUID, version: int, changes: dict[str, Any]) -> Product | None: ...
    def decrement_inventory(self, business_id: UUID, product_id: UUID, quantity: Decimal) -> Product | None: ...
    def adjust_inventory(self, business_id: UUID, product_id: UUID, change: Decimal, prevent_negative: bool = True) -> Product | None: ...
    def delete(self, business_id: UUID, product_id: UUID) -> bool: ...


class DuplicateProductIdentifierError(Exception):
    """Raised when a MongoDB uniqueness constraint rejects SKU or barcode."""


class MongoProductRepository:
    """MongoDB implementation; all operations are tenant-scoped by design."""

    def __init__(self, collection: Collection) -> None:
        self._collection = collection
        self._ensure_indexes()

    def _ensure_indexes(self) -> None:
        self._collection.create_index([("businessId", ASCENDING), ("publicId", ASCENDING)], unique=True)
        self._collection.create_index([("businessId", ASCENDING), ("sku", ASCENDING)], unique=True, partialFilterExpression={"sku": {"$type": "string"}})
        self._collection.create_index([("businessId", ASCENDING), ("barcode", ASCENDING)], unique=True, partialFilterExpression={"barcode": {"$type": "string"}})
        self._collection.create_index([("businessId", ASCENDING), ("name", ASCENDING)])
        self._collection.create_index([("businessId", ASCENDING), ("createdAt", DESCENDING)])

    def create(self, product: Product) -> Product:
        document = _encode_for_mongo(product.model_dump(by_alias=True))
        try:
            self._collection.insert_one(document)
        except DuplicateKeyError as error:
            raise DuplicateProductIdentifierError from error
        return product

    def get(self, business_id: UUID, product_id: UUID) -> Product | None:
        document = self._collection.find_one({"businessId": business_id, "publicId": product_id})
        return Product.model_validate(_decode_from_mongo(document)) if document else None

    def _filters(self, business_id: UUID, query: str | None, category: str | None, include_inactive: bool) -> dict[str, Any]:
        filters: dict[str, Any] = {"businessId": business_id}
        if not include_inactive:
            filters["isActive"] = True
        if category:
            filters["category"] = category
        if query:
            escaped = re.escape(query)
            filters["$or"] = [{"name": {"$regex": escaped, "$options": "i"}}, {"sku": {"$regex": escaped, "$options": "i"}}, {"barcode": {"$regex": escaped, "$options": "i"}}]
        return filters

    def list(self, business_id: UUID, query: str | None, category: str | None, include_inactive: bool, skip: int = 0, limit: int = 100) -> list[Product]:
        return [Product.model_validate(_decode_from_mongo(item)) for item in self._collection.find(self._filters(business_id, query, category, include_inactive)).sort("name", ASCENDING).skip(skip).limit(limit)]

    def count(self, business_id: UUID, query: str | None, category: str | None, include_inactive: bool) -> int:
        return self._collection.count_documents(self._filters(business_id, query, category, include_inactive))

    def find_duplicate(self, business_id: UUID, sku: str | None, barcode: str | None, exclude_id: UUID | None = None) -> Product | None:
        alternatives: list[dict[str, Any]] = []
        if sku:
            alternatives.append({"sku": sku})
        if barcode:
            alternatives.append({"barcode": barcode})
        if not alternatives:
            return None
        filters: dict[str, Any] = {"businessId": business_id, "$or": alternatives}
        if exclude_id:
            filters["publicId"] = {"$ne": exclude_id}
        document = self._collection.find_one(filters)
        return Product.model_validate(_decode_from_mongo(document)) if document else None

    def update(self, business_id: UUID, product_id: UUID, version: int, changes: dict[str, Any]) -> Product | None:
        try:
            document = self._collection.find_one_and_update(
                {"businessId": business_id, "publicId": product_id, "version": version},
                {"$set": _encode_for_mongo({**changes, "updatedAt": utc_now()}), "$inc": {"version": 1}},
                return_document=ReturnDocument.AFTER,
            )
        except DuplicateKeyError as error:
            raise DuplicateProductIdentifierError from error
        return Product.model_validate(_decode_from_mongo(document)) if document else None

    def delete(self, business_id: UUID, product_id: UUID) -> bool:
        return self._collection.delete_one({"businessId": business_id, "publicId": product_id}).deleted_count == 1

    def decrement_inventory(self, business_id: UUID, product_id: UUID, quantity: Decimal) -> Product | None:
        document = self._collection.find_one_and_update(
            {"businessId": business_id, "publicId": product_id, "inventory.quantityOnHand": {"$gte": Decimal128(quantity)}},
            {"$inc": {"inventory.quantityOnHand": Decimal128(-quantity), "version": 1}, "$set": {"updatedAt": utc_now()}},
            return_document=ReturnDocument.AFTER,
        )
        return Product.model_validate(_decode_from_mongo(document)) if document else None

    def adjust_inventory(self, business_id: UUID, product_id: UUID, change: Decimal, prevent_negative: bool = True) -> Product | None:
        filters: dict[str, Any] = {"businessId": business_id, "publicId": product_id}
        if prevent_negative and change < 0:
            filters["inventory.quantityOnHand"] = {"$gte": Decimal128(-change)}
        document = self._collection.find_one_and_update(
            filters,
            {"$inc": {"inventory.quantityOnHand": Decimal128(change), "version": 1}, "$set": {"updatedAt": utc_now()}},
            return_document=ReturnDocument.AFTER,
        )
        return Product.model_validate(_decode_from_mongo(document)) if document else None
