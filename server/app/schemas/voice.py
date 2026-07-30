"""Contracts for the voice transaction extraction and confirmation workflow."""

from decimal import Decimal
from typing import Any
from uuid import UUID

from pydantic import Field

from app.models.base import SchemaModel


class ExtractedVoiceLineItem(SchemaModel):
    product_id: UUID | None = Field(default=None, alias="productId")
    product_name: str = Field(min_length=1, max_length=200, alias="productName")
    quantity: Decimal = Field(gt=0)
    unit_price: Decimal = Field(gt=0, alias="unitPrice")
    confidence: float = Field(ge=0, le=1)


class VoiceTransactionExtraction(SchemaModel):
    transcript: str = Field(min_length=1, max_length=5000)
    customer_name: str | None = Field(default=None, alias="customerName")
    line_items: list[ExtractedVoiceLineItem] = Field(min_length=1, alias="lineItems")
    total: Decimal = Field(gt=0)
    overall_confidence: float = Field(ge=0, le=1, alias="overallConfidence")
    metadata: dict[str, Any] = Field(default_factory=dict)


class VoiceTransactionLineItem(SchemaModel):
    product_id: UUID = Field(alias="productId")
    product_name: str = Field(min_length=1, max_length=200, alias="productName")
    quantity: Decimal = Field(gt=0)
    unit_price: Decimal = Field(gt=0, alias="unitPrice")


class VoiceTransactionConfirmation(SchemaModel):
    customer_name: str | None = Field(default=None, alias="customerName")
    line_items: list[VoiceTransactionLineItem] = Field(min_length=1, alias="lineItems")


class VoiceTransactionConfirmationResult(SchemaModel):
    transaction_id: UUID = Field(alias="transactionId")
    status: str
    inventory_updated: bool = Field(alias="inventoryUpdated")
    total: Decimal
