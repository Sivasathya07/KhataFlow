"""Shared constrained values for KhataFlow collections."""

from enum import Enum


class UserRole(str,Enum):
    OWNER = "owner"
    MANAGER = "manager"
    STAFF = "staff"


class TransactionType(str,Enum):
    SALE = "sale"
    RETURN = "return"
    PURCHASE = "purchase"
    ADJUSTMENT = "adjustment"


class TransactionInputType(str,Enum):
    VOICE = "voice"
    RECEIPT = "receipt"
    MANUAL = "manual"


class PaymentMethod(str,Enum):
    CASH = "cash"
    CARD = "card"
    UPI = "upi"
    BANK_TRANSFER = "bank_transfer"
    CREDIT = "credit"
    OTHER = "other"


class NotificationChannel(str,Enum):
    IN_APP = "in_app"
    PUSH = "push"
    EMAIL = "email"
    WHATSAPP = "whatsapp"


class NotificationStatus(str,Enum):
    PENDING = "pending"
    SENT = "sent"
    READ = "read"
    FAILED = "failed"


class InsightCategory(str,Enum):
    SALES = "sales"
    INVENTORY = "inventory"
    CUSTOMER = "customer"
    CASHFLOW = "cashflow"
    OPERATIONS = "operations"


class InsightSeverity(str,Enum):
    INFO = "info"
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"
