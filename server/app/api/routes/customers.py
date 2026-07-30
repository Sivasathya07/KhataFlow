"""Customer ledger endpoints scoped to a business."""

import base64
from decimal import Decimal
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from pymongo import ReturnDocument

from app.api.routes.inventory import get_business_id
from app.config import get_settings
from app.database.mongo import get_database
from app.models.base import utc_now

router = APIRouter(prefix="/customers", tags=["customers"])


class CustomerPayload(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    phone: str | None = Field(default=None, max_length=30)
    email: str | None = None
    address: str | None = Field(default=None, max_length=300)
    credit_limit: Decimal | None = Field(default=None, ge=0, alias="creditLimit")


class CustomerPaymentPayload(BaseModel):
    amount: Decimal = Field(gt=0)
    payment_mode: str = Field(default="cash", alias="paymentMode", pattern="^(cash|upi|card)$")
    notes: str | None = Field(default=None, max_length=500)
    reference: str | None = Field(default=None, max_length=120)


def _view(item: dict) -> dict:
    return {
        "id": str(item["publicId"]),
        "name": item["name"],
        "phone": item.get("phone"),
        "email": item.get("email"),
        "address": item.get("address"),
        "creditLimit": float(str(item.get("creditLimit", 0))),
        "outstandingBalance": float(str(item.get("outstandingBalance", 0))),
        "createdAt": item["createdAt"].isoformat(),
    }


def _payment_view(item: dict) -> dict:
    return {
        "id": str(item["publicId"]),
        "customerId": str(item["customerId"]),
        "amount": str(float(str(item["amount"]))),
        "paymentMode": item.get("paymentMode", "cash"),
        "notes": item.get("notes"),
        "reference": item.get("reference"),
        "previousBalance": str(float(str(item.get("previousBalance", 0)))),
        "newBalance": str(float(str(item.get("newBalance", 0)))),
        "createdAt": item["createdAt"].isoformat(),
    }


@router.post("", status_code=status.HTTP_201_CREATED)
def create_customer(payload: CustomerPayload, business_id: UUID = Depends(get_business_id)) -> dict:
    collection = get_database()["customers"]
    if payload.phone and collection.find_one({"businessId": business_id, "phone": payload.phone}):
        raise HTTPException(status_code=409, detail="A customer with this phone number already exists.")
    customer = {
        "publicId": uuid4(),
        "businessId": business_id,
        "name": payload.name,
        "phone": payload.phone,
        "email": payload.email,
        "address": payload.address,
        "creditLimit": float(payload.credit_limit) if payload.credit_limit is not None else 0.0,
        "outstandingBalance": 0.0,
        "createdAt": utc_now(),
        "updatedAt": utc_now(),
    }
    collection.insert_one(customer)
    return {"data": _view(customer)}


@router.get("")
def list_customers(
    query: str | None = Query(default=None, max_length=120),
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=25, ge=1, le=100),
    business_id: UUID = Depends(get_business_id),
) -> dict:
    filters: dict = {"businessId": business_id}
    if query:
        filters["$or"] = [{"name": {"$regex": query, "$options": "i"}}, {"phone": {"$regex": query, "$options": "i"}}]
    collection = get_database()["customers"]
    total = collection.count_documents(filters)
    rows = [_view(item) for item in collection.find(filters).sort("name", 1).skip((page - 1) * limit).limit(limit)]
    return {"data": rows, "pagination": {"page": page, "limit": limit, "total": total}}


@router.patch("/{customer_id}")
def update_customer(customer_id: UUID, payload: CustomerPayload, business_id: UUID = Depends(get_business_id)) -> dict:
    changes = payload.model_dump(by_alias=True, exclude_none=True)
    changes["updatedAt"] = utc_now()
    item = get_database()["customers"].find_one_and_update(
        {"businessId": business_id, "publicId": customer_id},
        {"$set": changes},
        return_document=ReturnDocument.AFTER,
    )
    if not item:
        raise HTTPException(status_code=404, detail="Customer not found.")
    return {"data": _view(item)}


@router.post("/{customer_id}/payments", status_code=status.HTTP_201_CREATED)
def record_payment(customer_id: UUID, payload: CustomerPaymentPayload, business_id: UUID = Depends(get_business_id)) -> dict:
    db = get_database()
    customer = db["customers"].find_one({"businessId": business_id, "publicId": customer_id})
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found.")
    previous = Decimal(str(customer.get("outstandingBalance", 0)))
    if previous <= 0:
        raise HTTPException(status_code=409, detail="This customer has no outstanding balance.")
    amount = payload.amount
    if amount > previous:
        raise HTTPException(status_code=422, detail=f"Payment ₹{amount} exceeds outstanding ₹{previous}.")
    new_balance = previous - amount
    db["customers"].update_one(
        {"publicId": customer_id, "businessId": business_id},
        {"$set": {"outstandingBalance": float(new_balance), "updatedAt": utc_now()}},
    )
    payment = {
        "publicId": uuid4(),
        "businessId": business_id,
        "customerId": customer_id,
        "amount": float(amount),
        "paymentMode": payload.payment_mode,
        "notes": payload.notes,
        "reference": payload.reference,
        "previousBalance": float(previous),
        "newBalance": float(new_balance),
        "createdAt": utc_now(),
    }
    db["customer_payments"].insert_one(payment)
    db["notifications"].insert_one(
        {
            "publicId": uuid4(),
            "businessId": business_id,
            "customerId": customer_id,
            "channel": "in_app",
            "status": "pending",
            "title": f"Payment received from {customer['name']}",
            "body": f"₹{amount} via {payload.payment_mode}. New outstanding: ₹{new_balance}.",
            "payload": {"paymentId": str(payment["publicId"]), "amount": str(amount)},
            "createdAt": utc_now(),
            "readAt": None,
        }
    )
    return {"data": _payment_view(payment)}


@router.get("/{customer_id}/payments")
def list_payments(
    customer_id: UUID,
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=25, ge=1, le=100),
    business_id: UUID = Depends(get_business_id),
) -> dict:
    filters = {"businessId": business_id, "customerId": customer_id}
    collection = get_database()["customer_payments"]
    total = collection.count_documents(filters)
    rows = [_payment_view(item) for item in collection.find(filters).sort("createdAt", -1).skip((page - 1) * limit).limit(limit)]
    return {"data": rows, "pagination": {"page": page, "limit": limit, "total": total}}


@router.post("/{customer_id}/payment-reminder")
def create_payment_reminder(customer_id: UUID, business_id: UUID = Depends(get_business_id)) -> dict:
    """Create a WhatsApp-ready debt reminder with UPI QR. Sends automatically via Twilio if configured."""
    customer = get_database()["customers"].find_one({"businessId": business_id, "publicId": customer_id})
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found.")
    outstanding = Decimal(str(customer.get("outstandingBalance", 0)))
    if outstanding <= 0:
        raise HTTPException(status_code=409, detail="This customer has no outstanding balance.")
    biz = get_database()["businesses"].find_one({"publicId": business_id}) or {}
    upi_id = biz.get("upiId") or get_settings().upi_id
    business_upi_name = biz.get("businessUpiName") or get_settings().business_upi_name
    business_name = biz.get("name") or business_upi_name or "KhataFlow Shop"
    if not upi_id:
        raise HTTPException(status_code=503, detail="UPI ID must be configured in Settings before creating payment reminders.")
    from io import BytesIO
    from urllib.parse import quote

    import qrcode

    payment_link = f"upi://pay?pa={quote(upi_id)}&pn={quote(business_upi_name)}&am={outstanding}&cu=INR&tn={quote('KhataFlow payment reminder')}"
    image = qrcode.make(payment_link)
    output = BytesIO()
    image.save(output, format="PNG")
    message = f"Hello {customer['name']}, your outstanding balance is ₹{outstanding}. Please pay using UPI: {payment_link}"
    phone = "".join(char for char in (customer.get("phone") or "") if char.isdigit())
    whatsapp_link = f"https://wa.me/{phone}?text={quote(message)}" if phone else None

    # ── Automatic WhatsApp send via Twilio ─────────────────────────
    from app.services.whatsapp_service import get_whatsapp_service
    wa_service = get_whatsapp_service()
    auto_sent = False
    auto_error: str | None = None
    if wa_service and phone:
        result = wa_service.send_payment_reminder(
            to_phone=phone,
            customer_name=customer["name"],
            outstanding=str(outstanding),
            business_name=business_name,
            payment_link=payment_link,
        )
        auto_sent = result.sent
        auto_error = result.error
    elif not phone:
        auto_error = "No phone number on file for this customer."
    else:
        auto_error = "Twilio not configured — use the WhatsApp link below."

    record = {
        "publicId": uuid4(),
        "businessId": business_id,
        "customerId": customer_id,
        "channel": "whatsapp",
        "status": "sent" if auto_sent else "pending",
        "title": "Payment reminder",
        "body": message,
        "payload": {"paymentLink": payment_link, "whatsappLink": whatsapp_link, "autoSent": auto_sent},
        "createdAt": utc_now(),
        "readAt": None,
    }
    get_database()["notifications"].insert_one(record)
    return {
        "data": {
            "customer": customer["name"],
            "outstandingBalance": str(outstanding),
            "paymentLink": payment_link,
            "qrCodeDataUrl": "data:image/png;base64," + base64.b64encode(output.getvalue()).decode(),
            "whatsappLink": whatsapp_link,
            "autoSent": auto_sent,
            "autoSentError": auto_error,
            "notificationId": str(record["publicId"]),
        }
    }


@router.post("/bulk-payment-reminders")
def bulk_payment_reminders(business_id: UUID = Depends(get_business_id)) -> dict:
    """Prepare WhatsApp deep-links for every customer with outstanding credit."""
    from urllib.parse import quote

    db = get_database()
    biz = db["businesses"].find_one({"publicId": business_id}) or {}
    upi_id = biz.get("upiId") or get_settings().upi_id
    business_upi_name = biz.get("businessUpiName") or get_settings().business_upi_name
    if not upi_id:
        raise HTTPException(status_code=503, detail="UPI ID must be configured in Settings before creating payment reminders.")

    debtors = list(
        db["customers"].find(
            {"businessId": business_id, "outstandingBalance": {"$gt": 0}},
            {"_id": 0},
        ).sort("outstandingBalance", -1)
    )
    links = []
    for customer in debtors:
        outstanding = Decimal(str(customer.get("outstandingBalance", 0)))
        payment_link = f"upi://pay?pa={quote(upi_id)}&pn={quote(business_upi_name)}&am={outstanding}&cu=INR&tn={quote('KhataFlow payment reminder')}"
        message = f"Hello {customer['name']}, your outstanding balance is ₹{outstanding}. Please pay using this UPI link: {payment_link}"
        phone = "".join(char for char in (customer.get("phone") or "") if char.isdigit())
        whatsapp_link = f"https://wa.me/{phone}?text={quote(message)}" if phone else None
        links.append(
            {
                "customerId": str(customer["publicId"]),
                "name": customer["name"],
                "phone": customer.get("phone"),
                "outstandingBalance": str(outstanding),
                "whatsappLink": whatsapp_link,
            }
        )
        db["notifications"].insert_one(
            {
                "publicId": uuid4(),
                "businessId": business_id,
                "customerId": customer["publicId"],
                "channel": "whatsapp",
                "status": "pending",
                "title": f"Bulk reminder: {customer['name']}",
                "body": message,
                "payload": {"paymentLink": payment_link, "whatsappLink": whatsapp_link},
                "createdAt": utc_now(),
                "readAt": None,
            }
        )
    return {
        "data": {
            "count": len(links),
            "withPhone": sum(1 for item in links if item["whatsappLink"]),
            "reminders": links,
        }
    }
