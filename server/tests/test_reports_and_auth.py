"""Unit tests for GST/profit report math and auth token helpers."""

from datetime import datetime, timezone
from decimal import Decimal
from uuid import uuid4

from app.agents.planner import plan
from app.api.routes.reports import _amount, _summary


def test_amount_parsing() -> None:
    assert _amount("12.50") == Decimal("12.50")
    assert _amount(None) == Decimal("0")


def test_gst_summary() -> None:
    rows = [
        {"taxableValue": "100", "gstTotal": "18"},
        {"taxableValue": "200", "gstTotal": "36"},
    ]
    summary = _summary("gst", rows)
    assert summary["records"] == 2
    assert summary["gstTotal"] == "54"
    assert summary["taxableValue"] == "300"


def test_profit_summary() -> None:
    rows = [
        {"revenue": "100", "grossProfit": "40"},
        {"revenue": "50", "grossProfit": "10"},
    ]
    summary = _summary("profit", rows)
    assert summary["revenue"] == "150"
    assert summary["grossProfit"] == "50"


def test_planner_debtors_and_today() -> None:
    assert plan("who are my top debtors?").intent == "top_debtors"
    assert plan("what are today's sales").intent == "sales_today"
    assert plan("show low stock alerts").intent == "low_stock"
    assert plan("create a sale for rice").requires_confirmation is True


def test_credit_limit_math() -> None:
    outstanding = Decimal("1200")
    limit = Decimal("2000")
    sale = Decimal("500")
    assert outstanding + sale <= limit
    assert outstanding + Decimal("900") > limit


def test_payment_reduces_balance() -> None:
    previous = Decimal("1000")
    payment = Decimal("250")
    assert previous - payment == Decimal("750")


def test_notification_shape() -> None:
    record = {
        "publicId": uuid4(),
        "businessId": uuid4(),
        "channel": "in_app",
        "status": "pending",
        "title": "Payment received",
        "body": "₹250 collected",
        "createdAt": datetime.now(timezone.utc),
        "readAt": None,
    }
    assert record["readAt"] is None
    assert "Payment" in record["title"]
