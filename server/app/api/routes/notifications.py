"""In-app notification center for payment reminders, stock, and credit alerts."""

from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pymongo import ReturnDocument

from app.api.routes.inventory import get_business_id
from app.database.mongo import get_database
from app.models.base import utc_now

router = APIRouter(prefix="/notifications", tags=["notifications"])


def _view(item: dict) -> dict:
    return {
        "id": str(item["publicId"]),
        "channel": item.get("channel", "in_app"),
        "status": item.get("status", "pending"),
        "title": item.get("title", ""),
        "body": item.get("body", ""),
        "payload": item.get("payload") or {},
        "readAt": item["readAt"].isoformat() if item.get("readAt") else None,
        "createdAt": item["createdAt"].isoformat(),
    }


@router.get("")
def list_notifications(
    unread_only: bool = Query(default=False, alias="unreadOnly"),
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=30, ge=1, le=100),
    business_id: UUID = Depends(get_business_id),
) -> dict:
    filters: dict = {"businessId": business_id}
    if unread_only:
        filters["readAt"] = None
    collection = get_database()["notifications"]
    total = collection.count_documents(filters)
    unread = collection.count_documents({"businessId": business_id, "readAt": None})
    rows = list(collection.find(filters).sort("createdAt", -1).skip((page - 1) * limit).limit(limit))
    return {
        "data": [_view(row) for row in rows],
        "pagination": {"page": page, "limit": limit, "total": total},
        "unreadCount": unread,
    }


@router.post("/{notification_id}/read", status_code=status.HTTP_200_OK)
def mark_read(notification_id: UUID, business_id: UUID = Depends(get_business_id)) -> dict:
    item = get_database()["notifications"].find_one_and_update(
        {"businessId": business_id, "publicId": notification_id},
        {"$set": {"readAt": utc_now(), "status": "read"}},
        return_document=ReturnDocument.AFTER,
    )
    if not item:
        raise HTTPException(status_code=404, detail="Notification not found.")
    return {"data": _view(item)}


@router.post("/read-all")
def mark_all_read(business_id: UUID = Depends(get_business_id)) -> dict:
    result = get_database()["notifications"].update_many(
        {"businessId": business_id, "readAt": None},
        {"$set": {"readAt": utc_now(), "status": "read"}},
    )
    return {"data": {"updated": result.modified_count}}


def create_notification(
    business_id: UUID,
    *,
    title: str,
    body: str,
    channel: str = "in_app",
    payload: dict | None = None,
    customer_id: UUID | None = None,
) -> dict:
    record = {
        "publicId": uuid4(),
        "businessId": business_id,
        "customerId": customer_id,
        "channel": channel,
        "status": "pending",
        "title": title,
        "body": body,
        "payload": payload or {},
        "createdAt": utc_now(),
        "readAt": None,
    }
    get_database()["notifications"].insert_one(record)
    return record
