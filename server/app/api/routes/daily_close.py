"""Daily close summary and export for end-of-day reconciliation."""

import csv
import io
from datetime import datetime, time, timezone
from decimal import Decimal
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse

from app.api.routes.inventory import get_business_id
from app.database.mongo import get_database

router = APIRouter(prefix="/daily-close", tags=["daily close"])


def _amount(value: object) -> Decimal:
    return Decimal(str(value or 0))


def _day_bounds(day: datetime | None = None) -> tuple[datetime, datetime]:
    now = day or datetime.now(timezone.utc)
    start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    end = datetime.combine(start.date(), time.max, tzinfo=timezone.utc)
    return start, end


def build_daily_close(business_id: UUID) -> dict:
    db = get_database()
    start, end = _day_bounds()
    sales = list(
        db["transactions"].find(
            {"businessId": business_id, "transactionType": "sale", "createdAt": {"$gte": start, "$lte": end}},
            {"_id": 0},
        )
    )
    payments = list(
        db["customer_payments"].find(
            {"businessId": business_id, "createdAt": {"$gte": start, "$lte": end}},
            {"_id": 0},
        )
    )
    by_mode: dict[str, Decimal] = {"cash": Decimal("0"), "upi": Decimal("0"), "card": Decimal("0"), "credit": Decimal("0")}
    for sale in sales:
        mode = sale.get("paymentMode", "cash")
        by_mode[mode] = by_mode.get(mode, Decimal("0")) + _amount(sale.get("amountPaid") if mode != "credit" else sale.get("grandTotal"))
    for payment in payments:
        mode = payment.get("paymentMode", "cash")
        by_mode[mode] = by_mode.get(mode, Decimal("0")) + _amount(payment.get("amount"))

    revenue = sum((_amount(s.get("grandTotal")) for s in sales), Decimal("0"))
    tax = sum((_amount(s.get("taxTotal")) for s in sales), Decimal("0"))
    collected = sum((_amount(s.get("amountPaid")) for s in sales), Decimal("0")) + sum((_amount(p.get("amount")) for p in payments), Decimal("0"))
    pending = sum((_amount(s.get("grandTotal")) - _amount(s.get("amountPaid")) for s in sales if s.get("paymentStatus") != "paid"), Decimal("0"))
    low_stock = db["products"].count_documents(
        {
            "businessId": business_id,
            "isActive": True,
            "inventory.trackInventory": True,
            "$expr": {"$lte": ["$inventory.quantityOnHand", "$inventory.reorderLevel"]},
        }
    )
    outstanding = sum(
        (_amount(c.get("outstandingBalance")) for c in db["customers"].find({"businessId": business_id}, {"outstandingBalance": 1})),
        Decimal("0"),
    )
    return {
        "date": start.date().isoformat(),
        "salesCount": len(sales),
        "revenue": str(revenue),
        "taxCollected": str(tax),
        "amountCollected": str(collected),
        "pendingDues": str(pending),
        "customerPaymentsCount": len(payments),
        "paymentSplit": {key: str(value) for key, value in by_mode.items()},
        "lowStockCount": low_stock,
        "outstandingCredit": str(outstanding),
        "invoices": [
            {
                "invoiceNumber": s.get("invoiceNumber", ""),
                "total": str(s.get("grandTotal", 0)),
                "paid": str(s.get("amountPaid", 0)),
                "paymentMode": s.get("paymentMode", "cash"),
                "paymentStatus": s.get("paymentStatus", "pending"),
            }
            for s in sales
        ],
    }


@router.get("")
def daily_close(business_id: UUID = Depends(get_business_id)) -> dict:
    return {"data": build_daily_close(business_id)}


@router.get("/export")
def export_daily_close(
    format: str = Query(default="csv", pattern="^(csv|pdf)$"),
    business_id: UUID = Depends(get_business_id),
) -> StreamingResponse:
    data = build_daily_close(business_id)
    if format == "pdf":
        from reportlab.lib.pagesizes import A4
        from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle
        from reportlab.lib import colors
        from reportlab.lib.styles import getSampleStyleSheet

        output = io.BytesIO()
        styles = getSampleStyleSheet()
        doc = SimpleDocTemplate(output, pagesize=A4)
        rows = [["Metric", "Value"]]
        for key in ("date", "salesCount", "revenue", "taxCollected", "amountCollected", "pendingDues", "lowStockCount", "outstandingCredit"):
            rows.append([key, str(data[key])])
        for mode, amount in data["paymentSplit"].items():
            rows.append([f"split:{mode}", amount])
        table = Table(rows)
        table.setStyle(
            TableStyle(
                [
                    ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#0f172a")),
                    ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                    ("GRID", (0, 0), (-1, -1), 0.25, colors.grey),
                ]
            )
        )
        doc.build([Paragraph("KhataFlow Daily Close", styles["Title"]), Spacer(1, 12), table])
        return StreamingResponse(
            iter([output.getvalue()]),
            media_type="application/pdf",
            headers={"Content-Disposition": 'attachment; filename="khataflow-daily-close.pdf"'},
        )

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["metric", "value"])
    for key in ("date", "salesCount", "revenue", "taxCollected", "amountCollected", "pendingDues", "lowStockCount", "outstandingCredit"):
        writer.writerow([key, data[key]])
    for mode, amount in data["paymentSplit"].items():
        writer.writerow([f"split_{mode}", amount])
    writer.writerow([])
    writer.writerow(["invoiceNumber", "total", "paid", "paymentMode", "paymentStatus"])
    for invoice in data["invoices"]:
        writer.writerow([invoice["invoiceNumber"], invoice["total"], invoice["paid"], invoice["paymentMode"], invoice["paymentStatus"]])
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": 'attachment; filename="khataflow-daily-close.csv"'},
    )
