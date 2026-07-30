"""Executes only read operations; mutating actions are returned as safe proposals."""

from uuid import UUID

from app.agents.planner import Plan
from app.agents.tools import BusinessTools


def execute(tools: BusinessTools, business_id: UUID, plan: Plan, message: str) -> str:
    t = plan.tamil
    if plan.intent == "low_stock":
        items = tools.low_stock(business_id)
        if not items:
            return "எந்த பொருளும் குறைந்த அளவில் இல்லை." if t else "No products are at or below their reorder level."
        label = "குறைந்த ஸ்டாக்: " if t else "Low stock: "
        return label + ", ".join(f"{item['name']} ({item['quantity']})" for item in items)
    if plan.intent == "top_debtors":
        debtors = tools.top_debtors(business_id)
        if not debtors:
            return "எந்த வாடிக்கையாளரும் கடன் வைத்திருக்கவில்லை." if t else "No customers currently have outstanding credit."
        label = "கடன் வாடிக்கையாளர்கள்: " if t else "Top debtors: "
        return label + ", ".join(f"{item['name']} — ₹{item['outstandingBalance']}" for item in debtors)
    if plan.intent == "customer_search":
        matches = tools.find_customers(business_id, message.replace("customer", "").strip())
        if not matches:
            return "பொருந்தும் வாடிக்கையாளர் கிடைக்கவில்லை." if t else "No matching customer was found."
        label = "வாடிக்கையாளர்கள்: " if t else "Customers: "
        return label + ", ".join(f"{item['name']} — ₹{item['outstandingBalance']} நிலுவை" for item in matches)
    if plan.intent == "sales_today":
        val = tools.sales_today(business_id)
        return f"இன்றைய விற்பனை: ₹{val}." if t else f"Today's recorded sales: ₹{val}."
    if plan.intent == "sales_total":
        val = tools.sales_total(business_id)
        return f"மொத்த விற்பனை: ₹{val}." if t else f"Recorded sales total: ₹{val}."
    if plan.requires_confirmation:
        return "நான் அந்த செயலை தயார் செய்யலாம், ஆனால் நீங்கள் உறுதிப்படுத்திய பிறகே மாற்றங்கள் செய்யப்படும்." if t else "I can prepare that action, but I need you to review and confirm it before changing stock or accounts."
    return (
        "வணக்கம்! நான் உங்கள் KhataFlow தமிழ் உதவியாளர். குறைந்த ஸ்டாக், கடன் வாடிக்கையாளர்கள், இன்றைய விற்பனை, வாடிக்கையாளர் தேடல், மொத்த விற்பனை ஆகியவற்றில் நான் உதவ முடியும். என்ன உதவி வேண்டும்?"
        if t else
        "I can help with low stock, top debtors, today's sales, customer search, sales totals, "
        "and preparing a sale, purchase, or stock adjustment (with your confirmation)."
    )
