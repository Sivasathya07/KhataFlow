"""Sales, purchase, and return endpoints."""

from uuid import UUID

from fastapi import APIRouter, Depends, Query, status

from app.api.routes.inventory import get_business_id
from app.database.mongo import get_database
from app.repositories.product_repository import MongoProductRepository
from app.schemas.transaction import TransactionCreate
from app.services.transaction_service import TransactionService

router = APIRouter(prefix="/transactions", tags=["transactions"])


def get_transaction_service() -> TransactionService:
    db = get_database()
    return TransactionService(MongoProductRepository(db["products"]), db)


@router.post("", status_code=status.HTTP_201_CREATED)
def create_transaction(payload: TransactionCreate, business_id: UUID = Depends(get_business_id), service: TransactionService = Depends(get_transaction_service)) -> dict:
    return {"data": service.create(business_id, payload)}


@router.get("")
def list_transactions(page: int = Query(default=1, ge=1), limit: int = Query(default=50, ge=1, le=100), business_id: UUID = Depends(get_business_id)) -> dict:
    collection = get_database()["transactions"]
    filters = {"businessId": business_id}
    rows = list(collection.find(filters, {"_id": 0}).sort("createdAt", -1).skip((page - 1) * limit).limit(limit))
    return {"data": [{"id": str(row["publicId"]), "invoiceNumber": row.get("invoiceNumber", f"VOICE-{str(row['publicId'])[:8].upper()}"), "transactionType": row["transactionType"], "paymentStatus": row.get("paymentStatus", "pending"), "grandTotal": str(row["grandTotal"]), "createdAt": row["createdAt"].isoformat()} for row in rows], "pagination": {"page": page, "limit": limit, "total": collection.count_documents(filters)}}
