"""Live, tenant-scoped business dashboard aggregates."""

from datetime import datetime, timedelta, timezone
from decimal import Decimal
from uuid import UUID

from fastapi import APIRouter, Depends

from app.api.routes.inventory import get_business_id
from app.database.mongo import get_database

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


def _decimal(value: object) -> Decimal:
    return Decimal(str(value or 0))


def _start_of_day(now: datetime) -> datetime:
    return now.replace(hour=0, minute=0, second=0, microsecond=0)


def _sum(rows: list[dict], field: str) -> Decimal:
    return sum((_decimal(row.get(field)) for row in rows), Decimal("0"))


@router.get("")
def overview(business_id: UUID = Depends(get_business_id)) -> dict:
    db = get_database()
    now = datetime.now(timezone.utc)
    today = _start_of_day(now)
    week = today - timedelta(days=today.weekday())
    month = today.replace(day=1)
    year = today.replace(month=1, day=1)
    sales = list(db["transactions"].find({"businessId": business_id, "transactionType": "sale"}, {"_id": 0}))
    products = list(db["products"].find({"businessId": business_id, "isActive": {"$ne": False}}, {"_id": 0}))
    customers = list(db["customers"].find({"businessId": business_id}, {"_id": 0}))

    def sales_after(start: datetime) -> Decimal:
        return _sum([row for row in sales if row.get("createdAt", now) >= start], "grandTotal")

    inventory_value = sum((_decimal(p.get("pricing", {}).get("costPrice")) * _decimal(p.get("inventory", {}).get("quantityOnHand")) for p in products), Decimal("0"))
    low_stock = [p for p in products if p.get("inventory", {}).get("trackInventory", True) and _decimal(p.get("inventory", {}).get("quantityOnHand")) <= _decimal(p.get("inventory", {}).get("reorderLevel"))]
    pending = [row for row in sales if row.get("paymentStatus") != "paid"]
    revenue = _sum(sales, "grandTotal")
    cost = sum((_decimal(line.get("quantity")) * _decimal(line.get("costPrice")) for sale in sales for line in sale.get("lineItems", [])), Decimal("0"))
    top_products: dict[str, dict] = {}
    for sale in sales:
        for line in sale.get("lineItems", []):
            name = line.get("productName", "Unknown")
            item = top_products.setdefault(name, {"name": name, "quantity": Decimal("0"), "revenue": Decimal("0")})
            item["quantity"] += _decimal(line.get("quantity"))
            item["revenue"] += _decimal(line.get("quantity")) * _decimal(line.get("unitPrice"))
    recent = sorted(sales, key=lambda x: x.get("createdAt", now), reverse=True)[:8]
    return {"data": {
        "metrics": {"todaySales": str(sales_after(today)), "weeklySales": str(sales_after(week)), "monthlySales": str(sales_after(month)), "yearlySales": str(sales_after(year)), "revenue": str(revenue), "profit": str(revenue - cost), "inventoryValue": str(inventory_value), "lowStockCount": len(low_stock), "pendingPayments": str(_sum(pending, "grandTotal") - _sum(pending, "amountPaid")), "outstandingCredit": str(sum((_decimal(c.get("outstandingBalance")) for c in customers), Decimal("0")))},
        "topProducts": [{"name": x["name"], "quantity": str(x["quantity"]), "revenue": str(x["revenue"])} for x in sorted(top_products.values(), key=lambda x: x["revenue"], reverse=True)[:5]],
        "topCustomers": [{"id": str(c["publicId"]), "name": c["name"], "outstandingBalance": str(c.get("outstandingBalance", 0))} for c in sorted(customers, key=lambda x: _decimal(x.get("outstandingBalance")), reverse=True)[:5]],
        "recentTransactions": [{"id": str(row["publicId"]), "invoiceNumber": row.get("invoiceNumber", f"VOICE-{str(row['publicId'])[:8].upper()}"), "grandTotal": str(row["grandTotal"]), "paymentStatus": row.get("paymentStatus", "pending"), "createdAt": row["createdAt"].isoformat()} for row in recent],
        "lowStock": [{"id": str(p["publicId"]), "name": p["name"], "quantityOnHand": str(p.get("inventory", {}).get("quantityOnHand", 0))} for p in low_stock[:5]],
    }}


@router.get("/trends")
def trends(days: int = 30, business_id: UUID = Depends(get_business_id)) -> dict:
    days = min(max(days, 7), 365)
    now = datetime.now(timezone.utc)
    start = _start_of_day(now) - timedelta(days=days - 1)
    rows = list(get_database()["transactions"].find({"businessId": business_id, "transactionType": "sale", "createdAt": {"$gte": start}}, {"_id": 0}))
    buckets = {str((start + timedelta(days=i)).date()): Decimal("0") for i in range(days)}
    for row in rows:
        buckets[str(row["createdAt"].date())] += _decimal(row.get("grandTotal"))
    return {"data": {"salesTrend": [{"date": date, "sales": str(value), "revenue": str(value)} for date, value in buckets.items()]}}


@router.get("/insights")
def insights(business_id: UUID = Depends(get_business_id)) -> dict:
    """Rule-based live insights derived from current MongoDB business state."""
    db = get_database()
    now = datetime.now(timezone.utc)
    today = _start_of_day(now)
    products = list(db["products"].find({"businessId": business_id, "isActive": {"$ne": False}}, {"_id": 0}))
    customers = list(db["customers"].find({"businessId": business_id}, {"_id": 0}))
    sales_today = list(db["transactions"].find({"businessId": business_id, "transactionType": "sale", "createdAt": {"$gte": today}}, {"_id": 0}))
    low_stock = [
        p
        for p in products
        if p.get("inventory", {}).get("trackInventory", True)
        and _decimal(p.get("inventory", {}).get("quantityOnHand")) <= _decimal(p.get("inventory", {}).get("reorderLevel"))
    ]
    debtors = sorted(customers, key=lambda c: _decimal(c.get("outstandingBalance")), reverse=True)
    top_debtor = next((c for c in debtors if _decimal(c.get("outstandingBalance")) > 0), None)
    today_total = _sum(sales_today, "grandTotal")
    items: list[dict] = []
    if low_stock:
        names = ", ".join(p["name"] for p in low_stock[:3])
        items.append(
            {
                "title": f"{len(low_stock)} products need restocking",
                "description": f"Low stock on {names}. Reorder before you miss sales.",
                "action": "Open inventory",
                "route": "inventory",
                "confidence": 92,
                "tone": "amber",
            }
        )
    if top_debtor:
        items.append(
            {
                "title": f"Collect ₹{_decimal(top_debtor.get('outstandingBalance'))} from {top_debtor['name']}",
                "description": "Highest outstanding credit on your ledger. Send a UPI WhatsApp reminder.",
                "action": "Open customers",
                "route": "customers",
                "confidence": 88,
                "tone": "sky",
            }
        )
    items.append(
        {
            "title": f"Today's sales are ₹{today_total}",
            "description": f"{len(sales_today)} sale(s) recorded since midnight. Run daily close when the counter winds down.",
            "action": "Daily close",
            "route": "daily-close",
            "confidence": 95,
            "tone": "teal",
        }
    )
    if not sales_today:
        items.append(
            {
                "title": "No sales yet today",
                "description": "Use Quick Sale or Voice to record the first bill of the day.",
                "action": "Open POS",
                "route": "pos",
                "confidence": 80,
                "tone": "teal",
            }
        )
    return {"data": {"insights": items[:4], "generatedAt": now.isoformat()}}
