"""Public transaction contracts using product public identifiers."""

from decimal import Decimal
from uuid import UUID

from pydantic import Field, model_validator

from app.models.base import SchemaModel


class TransactionItemCreate(SchemaModel):
    product_id: UUID = Field(alias="productId")
    quantity: Decimal = Field(gt=0)
    unit_price: Decimal = Field(gt=0, alias="unitPrice")
    discount: Decimal = Field(default=Decimal("0"), ge=0)
    gst_rate: Decimal = Field(default=Decimal("0"), ge=0, le=100, alias="gstRate")


class TransactionCreate(SchemaModel):
    transaction_type: str = Field(alias="transactionType", pattern="^(sale|purchase|return)$")
    customer_id: UUID | None = Field(default=None, alias="customerId")
    payment_mode: str = Field(default="cash", alias="paymentMode", pattern="^(cash|upi|card|credit)$")
    amount_paid: Decimal = Field(default=Decimal("0"), ge=0, alias="amountPaid")
    notes: str | None = Field(default=None, max_length=1000)
    line_items: list[TransactionItemCreate] = Field(min_length=1, alias="lineItems")

    @model_validator(mode="after")
    def payment_matches_credit_mode(self) -> "TransactionCreate":
        if self.payment_mode == "credit" and self.amount_paid != 0:
            raise ValueError("Credit transactions cannot include an immediate payment")
        return self
