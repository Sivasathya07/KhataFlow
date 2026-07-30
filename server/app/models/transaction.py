"""Transaction collection model with immutable line-item snapshots."""

from datetime import datetime
from decimal import Decimal
from typing import Any
from uuid import UUID

from pydantic import Field, model_validator

from app.models.base import MongoDocument, MongoId, SchemaModel
from app.models.enums import PaymentMethod, TransactionInputType, TransactionType


class TransactionLineItem(SchemaModel):
    product_id: MongoId = Field(alias="productId")
    product_name: str = Field(min_length=1, max_length=200, alias="productName")
    sku: str | None = Field(default=None, max_length=80)
    quantity: Decimal = Field(gt=0)
    unit_price: Decimal = Field(gt=0, alias="unitPrice")
    discount_amount: Decimal = Field(default=Decimal("0"), ge=0, alias="discountAmount")
    tax_rate: Decimal = Field(default=Decimal("0"), ge=0, le=100, alias="taxRate")
    line_total: Decimal = Field(gt=0, alias="lineTotal")
    metadata: dict[str, Any] = Field(default_factory=dict)


class Payment(SchemaModel):
    method: PaymentMethod
    amount: Decimal = Field(gt=0)
    reference: str | None = Field(default=None, max_length=120)
    metadata: dict[str, Any] = Field(default_factory=dict)


class InputCapture(SchemaModel):
    input_type: TransactionInputType = Field(alias="inputType")
    raw_text: str | None = Field(default=None, max_length=20_000, alias="rawText")
    file_url: str | None = Field(default=None, max_length=2048, alias="fileUrl")
    extraction_confidence: float | None = Field(default=None, ge=0, le=1, alias="extractionConfidence")
    agent_metadata: dict[str, Any] = Field(default_factory=dict, alias="agentMetadata")


class Transaction(MongoDocument):
    business_id: UUID = Field(alias="businessId")
    transaction_type: TransactionType = Field(alias="transactionType")
    occurred_at: datetime = Field(alias="occurredAt")
    input: InputCapture
    line_items: list[TransactionLineItem] = Field(min_length=1, alias="lineItems")
    payments: list[Payment] = Field(default_factory=list)
    customer_id: MongoId | None = Field(default=None, alias="customerId")
    supplier_id: MongoId | None = Field(default=None, alias="supplierId")
    subtotal: Decimal = Field(ge=0)
    discount_total: Decimal = Field(default=Decimal("0"), ge=0, alias="discountTotal")
    tax_total: Decimal = Field(default=Decimal("0"), ge=0, alias="taxTotal")
    grand_total: Decimal = Field(gt=0, alias="grandTotal")
    notes: str | None = Field(default=None, max_length=2000)

    @model_validator(mode="after")
    def require_party_for_purchase_or_sale(self) -> "Transaction":
        if self.transaction_type == TransactionType.SALE and self.supplier_id is not None:
            raise ValueError("Sales cannot reference a supplier")
        if self.transaction_type == TransactionType.PURCHASE and self.customer_id is not None:
            raise ValueError("Purchases cannot reference a customer")
        return self
