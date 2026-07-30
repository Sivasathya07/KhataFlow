"""Stock movements, alerts, and inventory reporting endpoints."""

from decimal import Decimal
from uuid import UUID

from fastapi import APIRouter, Depends, Query, status

from app.api.dependencies import require_roles
from app.api.routes.inventory import get_business_id
from app.database.mongo import get_database
from app.repositories.product_repository import MongoProductRepository
from app.schemas.inventory import InventoryMovementCreate, InventoryMovementResult
from app.services.inventory_service import InventoryService

router = APIRouter(prefix="/inventory", tags=["inventory management"])


def get_inventory_service() -> InventoryService:
    db = get_database()
    return InventoryService(MongoProductRepository(db["products"]), db["inventory_logs"])


@router.post("/movements", status_code=status.HTTP_201_CREATED)
def create_movement(
    payload: InventoryMovementCreate,
    business_id: UUID = Depends(get_business_id),
    service: InventoryService = Depends(get_inventory_service),
) -> dict:
    """Record stock received, stock issued, or a positive stock adjustment."""
    result = service.move(business_id, payload)
    return {"data": result.model_dump(by_alias=True)}


@router.get("/low-stock")
def low_stock(page: int = Query(default=1, ge=1), limit: int = Query(default=25, ge=1, le=100), business_id: UUID = Depends(get_business_id)) -> dict:
    filters = {"businessId": business_id, "isActive": True, "inventory.trackInventory": True, "$expr": {"$lte": ["$inventory.quantityOnHand", "$inventory.reorderLevel"]}}
    rows = list(get_database()["products"].find(filters, {"_id": 0, "publicId": 1, "name": 1, "inventory": 1}).sort("name", 1).skip((page - 1) * limit).limit(limit))
    return {"data": [{"id": str(row["publicId"]), "name": row["name"], "quantityOnHand": str(row["inventory"]["quantityOnHand"]), "reorderLevel": str(row["inventory"]["reorderLevel"]), "unit": row["inventory"]["unit"]} for row in rows], "pagination": {"page": page, "limit": limit, "total": get_database()["products"].count_documents(filters)}}


@router.get("/history")
def inventory_history(product_id: UUID | None = Query(default=None, alias="productId"), page: int = Query(default=1, ge=1), limit: int = Query(default=50, ge=1, le=100), business_id: UUID = Depends(get_business_id)) -> dict:
    filters: dict = {"businessId": business_id}
    if product_id:
        filters["productId"] = product_id
    rows = list(get_database()["inventory_logs"].find(filters, {"_id": 0}).sort("createdAt", -1).skip((page - 1) * limit).limit(limit))
    return {"data": [{"id": str(row["publicId"]), "productId": str(row["productId"]), "movementType": row["movementType"], "change": str(row["change"]), "quantityAfter": str(row["quantityAfter"]), "notes": row.get("notes"), "createdAt": row["createdAt"].isoformat()} for row in rows], "pagination": {"page": page, "limit": limit, "total": get_database()["inventory_logs"].count_documents(filters)}}


@router.get("/summary")
def inventory_summary(business_id: UUID = Depends(get_business_id)) -> dict:
    pipeline = [{"$match": {"businessId": business_id, "isActive": True}}, {"$group": {"_id": None, "productCount": {"$sum": 1}, "inventoryValue": {"$sum": {"$multiply": ["$inventory.quantityOnHand", {"$ifNull": ["$pricing.costPrice", 0]}]}}, "lowStockCount": {"$sum": {"$cond": [{"$and": ["$inventory.trackInventory", {"$lte": ["$inventory.quantityOnHand", "$inventory.reorderLevel"]}]}, 1, 0]}}}}]
    result = next(iter(get_database()["products"].aggregate(pipeline)), None)
    return {"data": {"productCount": result["productCount"] if result else 0, "lowStockCount": result["lowStockCount"] if result else 0, "inventoryValue": str(result["inventoryValue"]) if result else "0"}}
