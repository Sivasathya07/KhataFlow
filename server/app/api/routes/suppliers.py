"""Supplier directory and purchase receiving helpers."""

from decimal import Decimal
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, EmailStr, Field
from pymongo import ReturnDocument

from app.api.dependencies import require_roles
from app.api.routes.inventory import get_business_id
from app.database.mongo import get_database
from app.models.base import utc_now
from app.repositories.product_repository import MongoProductRepository
from app.schemas.inventory import InventoryMovementCreate
from app.services.inventory_service import InventoryService

router = APIRouter(prefix="/suppliers", tags=["suppliers"])


class SupplierPayload(BaseModel):
    name: str = Field(min_length=1, max_length=160)
    contact_name: str | None = Field(default=None, alias="contactName", max_length=120)
    phone: str | None = Field(default=None, max_length=30)
    email: EmailStr | None = None
    address: str | None = Field(default=None, max_length=300)
    tax_identifier: str | None = Field(default=None, alias="taxIdentifier", max_length=80)
    payment_terms_days: int | None = Field(default=None, alias="paymentTermsDays", ge=0, le=365)
    notes: str | None = Field(default=None, max_length=2000)


class ReceiveLine(BaseModel):
    product_id: UUID = Field(alias="productId")
    quantity: Decimal = Field(gt=0)
    unit_cost: Decimal | None = Field(default=None, ge=0, alias="unitCost")


class ReceivePayload(BaseModel):
    lines: list[ReceiveLine] = Field(min_length=1)
    notes: str | None = Field(default=None, max_length=1000)
    reference: str | None = Field(default=None, max_length=120)


def _view(item: dict) -> dict:
    return {
        "id": str(item["publicId"]),
        "name": item["name"],
        "contactName": item.get("contactName"),
        "phone": item.get("phone"),
        "email": item.get("email"),
        "address": item.get("address"),
        "taxIdentifier": item.get("taxIdentifier"),
        "paymentTermsDays": item.get("paymentTermsDays"),
        "notes": item.get("notes"),
        "createdAt": item["createdAt"].isoformat(),
        "updatedAt": item["updatedAt"].isoformat(),
    }


@router.post("", status_code=status.HTTP_201_CREATED)
def create_supplier(
    payload: SupplierPayload,
    business_id: UUID = Depends(get_business_id),
    _: dict = Depends(require_roles("owner", "manager")),
) -> dict:
    supplier = {
        "publicId": uuid4(),
        "businessId": business_id,
        **payload.model_dump(by_alias=True),
        "createdAt": utc_now(),
        "updatedAt": utc_now(),
    }
    get_database()["suppliers"].insert_one(supplier)
    return {"data": _view(supplier)}


@router.get("")
def list_suppliers(
    query: str | None = Query(default=None, max_length=120),
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=50, ge=1, le=100),
    business_id: UUID = Depends(get_business_id),
) -> dict:
    filters: dict = {"businessId": business_id}
    if query:
        filters["$or"] = [
            {"name": {"$regex": query, "$options": "i"}},
            {"phone": {"$regex": query, "$options": "i"}},
            {"contactName": {"$regex": query, "$options": "i"}},
        ]
    collection = get_database()["suppliers"]
    total = collection.count_documents(filters)
    rows = [_view(item) for item in collection.find(filters).sort("name", 1).skip((page - 1) * limit).limit(limit)]
    return {"data": rows, "pagination": {"page": page, "limit": limit, "total": total}}


@router.patch("/{supplier_id}")
def update_supplier(
    supplier_id: UUID,
    payload: SupplierPayload,
    business_id: UUID = Depends(get_business_id),
    _: dict = Depends(require_roles("owner", "manager")),
) -> dict:
    changes = payload.model_dump(by_alias=True, exclude_none=True)
    changes["updatedAt"] = utc_now()
    item = get_database()["suppliers"].find_one_and_update(
        {"businessId": business_id, "publicId": supplier_id},
        {"$set": changes},
        return_document=ReturnDocument.AFTER,
    )
    if not item:
        raise HTTPException(status_code=404, detail="Supplier not found.")
    return {"data": _view(item)}


@router.delete("/{supplier_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_supplier(
    supplier_id: UUID,
    business_id: UUID = Depends(get_business_id),
    _: dict = Depends(require_roles("owner", "manager")),
) -> None:
    result = get_database()["suppliers"].delete_one({"businessId": business_id, "publicId": supplier_id})
    if not result.deleted_count:
        raise HTTPException(status_code=404, detail="Supplier not found.")


@router.post("/{supplier_id}/receive", status_code=status.HTTP_201_CREATED)
def receive_stock(
    supplier_id: UUID,
    payload: ReceivePayload,
    business_id: UUID = Depends(get_business_id),
    _: dict = Depends(require_roles("owner", "manager", "cashier")),
) -> dict:
    supplier = get_database()["suppliers"].find_one({"businessId": business_id, "publicId": supplier_id})
    if not supplier:
        raise HTTPException(status_code=404, detail="Supplier not found.")
    db = get_database()
    service = InventoryService(MongoProductRepository(db["products"]), db["inventory_logs"])
    movements = []
    for line in payload.lines:
        note = f"Received from {supplier['name']}"
        if payload.reference:
            note = f"{note} ({payload.reference})"
        if payload.notes:
            note = f"{note}: {payload.notes}"
        result = service.move(
            business_id,
            InventoryMovementCreate.model_validate(
                {
                    "productId": str(line.product_id),
                    "movementType": "stock_in",
                    "quantity": line.quantity,
                    "notes": note,
                }
            ),
        )
        if line.unit_cost is not None:
            db["products"].update_one(
                {"businessId": business_id, "publicId": line.product_id},
                {"$set": {"pricing.costPrice": float(line.unit_cost), "updatedAt": utc_now()}},
            )
        movements.append(result.model_dump(by_alias=True))
    get_database()["notifications"].insert_one(
        {
            "publicId": uuid4(),
            "businessId": business_id,
            "channel": "in_app",
            "status": "pending",
            "title": f"Stock received from {supplier['name']}",
            "body": f"{len(payload.lines)} line(s) received into inventory.",
            "payload": {"supplierId": str(supplier_id), "reference": payload.reference},
            "createdAt": utc_now(),
            "readAt": None,
        }
    )
    return {"data": {"supplierId": str(supplier_id), "movements": movements}}
