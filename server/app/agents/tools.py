"""Read-only tool boundary used by the assistant before confirmation workflows."""

from datetime import datetime, timezone
from decimal import Decimal
from typing import Any
from uuid import UUID


class BusinessTools:
    def __init__(self, database: Any) -> None:
        self.db = database

    def low_stock(self, business_id: UUID) -> list[dict[str, str]]:
        rows = self.db["products"].find({"businessId": business_id, "isActive": {"$ne": False}}, {"_id": 0, "name": 1, "inventory": 1})
        return [
            {"name": row["name"], "quantity": str(row.get("inventory", {}).get("quantityOnHand", 0))}
            for row in rows
            if Decimal(str(row.get("inventory", {}).get("quantityOnHand", 0)))
            <= Decimal(str(row.get("inventory", {}).get("reorderLevel", 0)))
        ]

    def find_customers(self, business_id: UUID, query: str) -> list[dict[str, str]]:
        filters: dict = {"businessId": business_id}
        if query.strip():
            filters["name"] = {"$regex": query.strip(), "$options": "i"}
        rows = self.db["customers"].find(filters, {"_id": 0}).limit(5)
        return [{"name": row["name"], "outstandingBalance": str(row.get("outstandingBalance", 0))} for row in rows]

    def top_debtors(self, business_id: UUID, limit: int = 5) -> list[dict[str, str]]:
        rows = list(self.db["customers"].find({"businessId": business_id}, {"_id": 0}))
        ranked = sorted(rows, key=lambda row: Decimal(str(row.get("outstandingBalance", 0))), reverse=True)
        return [
            {"name": row["name"], "outstandingBalance": str(row.get("outstandingBalance", 0))}
            for row in ranked
            if Decimal(str(row.get("outstandingBalance", 0))) > 0
        ][:limit]

    def sales_total(self, business_id: UUID) -> str:
        rows = self.db["transactions"].find({"businessId": business_id, "transactionType": "sale"}, {"_id": 0, "grandTotal": 1})
        return str(sum((Decimal(str(row.get("grandTotal", 0))) for row in rows), Decimal("0")))

    def sales_today(self, business_id: UUID) -> str:
        start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
        rows = self.db["transactions"].find(
            {"businessId": business_id, "transactionType": "sale", "createdAt": {"$gte": start}},
            {"_id": 0, "grandTotal": 1},
        )
        return str(sum((Decimal(str(row.get("grandTotal", 0))) for row in rows), Decimal("0")))
