"""Conservative intent planner; write operations always require explicit UI confirmation."""

from dataclasses import dataclass


@dataclass(frozen=True)
class Plan:
    intent: str
    requires_confirmation: bool = False
    tamil: bool = False


import re

def _is_tamil(text: str) -> bool:
    if any("\u0B80" <= ch <= "\u0BFF" for ch in text):
        return True
    text_lower = text.lower()
    words = set(re.findall(r"\b\w+\b", text_lower))
    tamil_words = {
        "tamil", "tamizh", "thamizh", "tanglish", "enna", "evvalo", "evalo", "iruka", "irukka", "irukku", "sollu", "sollunga",
        "pesu", "pesunga", "kadan", "panam", "kasu", "kaasu", "vithu", "vanga", "vaanga", "stock", "nikuthu",
        "varum", "yar", "yaar", "indru", "inaiku", "iniku", "kuduthu", "koduthu",
        "roopai", "rubai", "nandri", "vanakkam", "vanakam", "yaro", "yaaro",
        "aachu", "aayichu", "seri", "aama", "illai", "illaiye", "kammi", "jaasthi",
        "vikanum", "vanganum", "pannanum", "tharen", "vangonga", "sollinga",
        "enaku", "enakku", "unaku", "unakku", "udhavi", "uthavi"
    }
    if any(w in tamil_words for w in words):
        return True
    phrases = (
        "stock iruk", "report sollu", "sales evvalo", "kadan iruk", "yeppo varum",
        "enna nadakuthu", "enna panra", "speak in tamil", "speak tamil", "in tamil",
        "tamil-il", "tamil la", "tamil pesu", "tamil sollu", "tamizh-il", "thamizh-il",
        "tamil assistant"
    )
    return any(p in text_lower for p in phrases)


def plan(message: str) -> Plan:
    text = message.casefold()
    tamil = _is_tamil(text)
    if any(word in text for word in ("low stock", "restock", "stock alert", "reorder", "stock iruk", "stock illa", "குறைவான", "ஸ்டாக்")):
        return Plan("low_stock", tamil=tamil)
    if any(word in text for word in ("debtor", "outstanding", "who owes", "credit due", "due list", "kadan", "கடன்", "யார் கடன்")):
        return Plan("top_debtors", tamil=tamil)
    if any(word in text for word in ("today sales", "today's sales", "sales today", "இன்று விற்பனை", "indru sales")):
        return Plan("sales_today", tamil=tamil)
    if any(word in text for word in ("customer", "கஸ்டமர்", "வாடிக்கையாளர்")):
        return Plan("customer_search", tamil=tamil)
    if any(word in text for word in ("sales", "revenue", "turnover", "விற்பனை", "sales evvalo", "report sollu")):
        return Plan("sales_total", tamil=tamil)
    if any(word in text for word in ("create", "sell", "purchase", "adjust", "bill", "vithu", "vanga", "விற்று", "வாங்கு")):
        return Plan("propose_transaction", True, tamil=tamil)
    return Plan("help", tamil=tamil)

