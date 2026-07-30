"""Sales, purchases, and returns coordinated with stock and customer balances."""

from datetime import datetime, timezone
from decimal import Decimal
from typing import Any
from uuid import UUID, uuid4

from bson.decimal128 import Decimal128

from app.models.base import utc_now
from app.repositories.product_repository import ProductRepository
from app.schemas.transaction import TransactionCreate
from app.services.product_service import InventoryError


class TransactionService:
    def __init__(self, products: ProductRepository, database: Any) -> None:
        self._products = products
        self._database = database

    def create(self, business_id: UUID, payload: TransactionCreate) -> dict:
        products = [self._products.get(business_id, item.product_id) for item in payload.line_items]
        if any(product is None for product in products):
            raise InventoryError("PRODUCT_NOT_FOUND", "One or more products were not found.", 404)
        subtotal = sum((item.quantity * item.unit_price for item in payload.line_items), Decimal("0"))
        discount_total = sum((item.discount for item in payload.line_items), Decimal("0"))
        taxable = subtotal - discount_total
        tax_total = sum(((item.quantity * item.unit_price - item.discount) * item.gst_rate / Decimal("100") for item in payload.line_items), Decimal("0"))
        grand_total = taxable + tax_total
        if payload.amount_paid > grand_total:
            raise InventoryError("INVALID_PAYMENT", "Amount paid cannot exceed the transaction total.", 422)
        change = Decimal("1") if payload.transaction_type in {"purchase", "return"} else Decimal("-1")
        stock_logs: list[dict] = []
        for item, product in zip(payload.line_items, products):
            assert product is not None
            if product.inventory.track_inventory:
                result = self._products.adjust_inventory(business_id, item.product_id, change * item.quantity)
                if not result:
                    raise InventoryError("INSUFFICIENT_STOCK", f"Insufficient stock for {product.name}.", 409)
                stock_logs.append({"publicId": uuid4(), "businessId": business_id, "productId": item.product_id, "transactionId": None, "movementType": payload.transaction_type, "change": Decimal128(change * item.quantity), "quantityAfter": Decimal128(result.inventory.quantity_on_hand)})
        now = utc_now()
        public_id = uuid4()
        invoice_number = f"INV-{now:%Y%m%d}-{str(public_id).split('-')[0].upper()}"
        balance = grand_total - payload.amount_paid
        customer = None
        if payload.customer_id:
            customer = self._database["customers"].find_one({"businessId": business_id, "publicId": payload.customer_id})
            if customer is None:
                raise InventoryError("CUSTOMER_NOT_FOUND", "The selected customer was not found.", 404)
            previous_balance = Decimal(str(customer.get("outstandingBalance", 0)))
            credit_limit = Decimal(str(customer.get("creditLimit", 0)))
            if payload.transaction_type == "sale" and balance and credit_limit and previous_balance + balance > credit_limit:
                raise InventoryError("CREDIT_LIMIT_EXCEEDED", f"{customer['name']} already owes ₹{previous_balance}. This sale would exceed their ₹{credit_limit} credit limit.", 409)
        transaction = {"publicId": public_id, "businessId": business_id, "invoiceNumber": invoice_number, "transactionType": payload.transaction_type, "customerId": payload.customer_id, "paymentMode": payload.payment_mode, "paymentStatus": "paid" if balance == 0 else "partial" if payload.amount_paid else "pending", "amountPaid": Decimal128(payload.amount_paid), "subtotal": Decimal128(subtotal), "discountTotal": Decimal128(discount_total), "taxTotal": Decimal128(tax_total), "grandTotal": Decimal128(grand_total), "notes": payload.notes, "lineItems": [{"productId": item.product_id, "productName": product.name, "quantity": Decimal128(item.quantity), "unitPrice": Decimal128(item.unit_price), "costPrice": Decimal128(product.pricing.cost_price or Decimal("0")), "discount": Decimal128(item.discount), "gstRate": Decimal128(item.gst_rate)} for item, product in zip(payload.line_items, products)], "createdAt": now}
        self._database["transactions"].insert_one(transaction)
        if payload.customer_id and payload.transaction_type == "sale" and balance:
            self._database["customers"].update_one({"businessId": business_id, "publicId": payload.customer_id}, {"$inc": {"outstandingBalance": Decimal128(balance)}, "$set": {"updatedAt": now}})
        if stock_logs:
            self._database["inventory_logs"].insert_many([{**log, "transactionId": public_id, "createdAt": now} for log in stock_logs])
        return {"id": str(public_id), "invoiceNumber": invoice_number, "grandTotal": str(grand_total), "paymentStatus": transaction["paymentStatus"], "previousOutstandingBalance": str(customer.get("outstandingBalance", 0)) if customer else "0", "newOutstandingBalance": str(Decimal(str(customer.get("outstandingBalance", 0))) + balance) if customer and payload.transaction_type == "sale" else "0"}
