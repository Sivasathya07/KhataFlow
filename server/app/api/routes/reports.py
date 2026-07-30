"""Validated business report generation and CSV/Excel/PDF export."""

import csv
import io
from datetime import date, datetime, time, timezone
from decimal import Decimal
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse

from app.api.routes.inventory import get_business_id
from app.database.mongo import get_database

router = APIRouter(prefix="/reports", tags=["reports"])
VALID_REPORTS = {"daily", "weekly", "monthly", "sales", "inventory", "customers", "gst", "profit"}


def _amount(value: object) -> Decimal:
    return Decimal(str(value or 0))


def _range(start: date | None, end: date | None) -> tuple[datetime, datetime]:
    now = datetime.now(timezone.utc)
    first = datetime.combine(start or now.date(), time.min, tzinfo=timezone.utc)
    last = datetime.combine(end or now.date(), time.max, tzinfo=timezone.utc)
    if last < first:
        raise HTTPException(422, "endDate must be on or after startDate.")
    return first, last


def _rows(kind: str, business_id: UUID, start: date | None, end: date | None) -> list[dict[str, object]]:
    if kind not in VALID_REPORTS:
        raise HTTPException(422, "Unsupported report type.")
    db = get_database()
    first, last = _range(start, end)
    if kind == "inventory":
        return [
            {
                "product": p["name"],
                "sku": p.get("sku", ""),
                "quantity": str(p.get("inventory", {}).get("quantityOnHand", 0)),
                "value": str(_amount(p.get("inventory", {}).get("quantityOnHand")) * _amount(p.get("pricing", {}).get("costPrice"))),
            }
            for p in db["products"].find({"businessId": business_id}, {"_id": 0})
        ]
    if kind == "customers":
        return [
            {
                "customer": c["name"],
                "phone": c.get("phone", ""),
                "outstandingCredit": str(c.get("outstandingBalance", 0)),
                "creditLimit": str(c.get("creditLimit", 0)),
            }
            for c in db["customers"].find({"businessId": business_id}, {"_id": 0})
        ]

    transactions = list(
        db["transactions"].find({"businessId": business_id, "createdAt": {"$gte": first, "$lte": last}}, {"_id": 0})
    )

    if kind == "gst":
        rows = []
        for t in transactions:
            taxable = _amount(t.get("subtotal")) - _amount(t.get("discountTotal"))
            gst = _amount(t.get("taxTotal"))
            rows.append(
                {
                    "date": t["createdAt"].date().isoformat(),
                    "invoiceNumber": t.get("invoiceNumber", ""),
                    "type": t.get("transactionType", ""),
                    "taxableValue": str(taxable),
                    "cgst": str(gst / 2),
                    "sgst": str(gst / 2),
                    "igst": "0",
                    "gstTotal": str(gst),
                    "invoiceTotal": str(t.get("grandTotal", 0)),
                }
            )
        return rows

    if kind == "profit":
        rows = []
        for t in transactions:
            if t.get("transactionType") != "sale":
                continue
            revenue = _amount(t.get("grandTotal"))
            cost = sum((_amount(line.get("quantity")) * _amount(line.get("costPrice")) for line in t.get("lineItems", [])), Decimal("0"))
            rows.append(
                {
                    "date": t["createdAt"].date().isoformat(),
                    "invoiceNumber": t.get("invoiceNumber", ""),
                    "revenue": str(revenue),
                    "cogs": str(cost),
                    "grossProfit": str(revenue - cost),
                    "marginPercent": str(((revenue - cost) / revenue * 100) if revenue else Decimal("0")),
                }
            )
        return rows

    return [
        {
            "date": t["createdAt"].date().isoformat(),
            "invoiceNumber": t["invoiceNumber"],
            "type": t["transactionType"],
            "subtotal": str(t.get("subtotal", 0)),
            "gst": str(t.get("taxTotal", 0)),
            "discount": str(t.get("discountTotal", 0)),
            "total": str(t.get("grandTotal", 0)),
            "paid": str(t.get("amountPaid", 0)),
            "paymentStatus": t.get("paymentStatus", "pending"),
        }
        for t in transactions
    ]


def _summary(kind: str, rows: list[dict[str, object]]) -> dict[str, object]:
    if kind == "gst":
        gst_total = sum((_amount(row.get("gstTotal")) for row in rows), Decimal("0"))
        taxable = sum((_amount(row.get("taxableValue")) for row in rows), Decimal("0"))
        return {"records": len(rows), "taxableValue": str(taxable), "gstTotal": str(gst_total), "total": str(gst_total)}
    if kind == "profit":
        revenue = sum((_amount(row.get("revenue")) for row in rows), Decimal("0"))
        profit = sum((_amount(row.get("grossProfit")) for row in rows), Decimal("0"))
        return {"records": len(rows), "revenue": str(revenue), "grossProfit": str(profit), "total": str(profit)}
    total = sum((_amount(row.get("total") or row.get("value") or row.get("outstandingCredit")) for row in rows), Decimal("0"))
    return {"records": len(rows), "total": str(total)}


@router.get("/{kind}")
def report(
    kind: str,
    start_date: date | None = Query(default=None, alias="startDate"),
    end_date: date | None = Query(default=None, alias="endDate"),
    business_id: UUID = Depends(get_business_id),
) -> dict:
    rows = _rows(kind, business_id, start_date, end_date)
    return {"data": {"type": kind, "rows": rows, "summary": _summary(kind, rows)}}


@router.get("/{kind}/export")
def export_report(
    kind: str,
    format: str = Query(default="csv", pattern="^(csv|excel|pdf)$"),
    start_date: date | None = Query(default=None, alias="startDate"),
    end_date: date | None = Query(default=None, alias="endDate"),
    business_id: UUID = Depends(get_business_id),
) -> StreamingResponse:
    rows = _rows(kind, business_id, start_date, end_date)
    if format == "excel":
        from openpyxl import Workbook

        output = io.BytesIO()
        workbook = Workbook()
        sheet = workbook.active
        sheet.title = kind.title()
        headers = list(rows[0]) if rows else ["no_data"]
        sheet.append(headers)
        for row in rows:
            sheet.append([str(row.get(header, "")) for header in headers])
        for cell in sheet[1]:
            cell.font = cell.font.copy(bold=True)
        workbook.save(output)
        return StreamingResponse(
            iter([output.getvalue()]),
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": f'attachment; filename="khataflow-{kind}.xlsx"'},
        )
    if format == "pdf":
        from reportlab.lib import colors
        from reportlab.lib.pagesizes import A4
        from reportlab.platypus import SimpleDocTemplate, Table, TableStyle

        output = io.BytesIO()
        headers = list(rows[0]) if rows else ["no_data"]
        table = Table([headers] + [[str(row.get(header, "")) for header in headers] for row in rows])
        table.setStyle(
            TableStyle(
                [
                    ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#0f172a")),
                    ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                    ("GRID", (0, 0), (-1, -1), 0.25, colors.grey),
                    ("FONTSIZE", (0, 0), (-1, -1), 8),
                ]
            )
        )
        SimpleDocTemplate(output, pagesize=A4).build([table])
        return StreamingResponse(
            iter([output.getvalue()]),
            media_type="application/pdf",
            headers={"Content-Disposition": f'attachment; filename="khataflow-{kind}.pdf"'},
        )
    output = io.StringIO()
    writer = csv.DictWriter(output, fieldnames=list(rows[0]) if rows else ["no_data"])
    writer.writeheader()
    writer.writerows(rows)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="khataflow-{kind}.csv"'},
    )
