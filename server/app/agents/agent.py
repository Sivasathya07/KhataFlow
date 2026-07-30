import json
import logging
from uuid import UUID, uuid4
from app.agents.executor import execute
from app.agents.memory import ConversationMemory
from app.agents.planner import plan
from app.agents.tools import BusinessTools
from app.agents.llm_provider import LLMProvider

logger = logging.getLogger(__name__)

class BusinessAgent:
    def __init__(self, database: object) -> None:
        self.db = database
        self.tools = BusinessTools(database)
        self.memory = ConversationMemory(database)

    def respond(
        self,
        business_id: UUID,
        message: str,
        conversation_id: str | None = None,
        preferred_language: str | None = None,
    ) -> dict[str, object]:
        conversation_id = conversation_id or str(uuid4())
        
        from app.config import get_settings

        settings = get_settings()
        # Prefer env Groq/OpenAI; allow tenant override for custom OpenAI-compatible keys.
        biz = self.db["businesses"].find_one({"publicId": business_id}) or {}
        api_key = biz.get("openaiApiKey") or settings.effective_llm_key
        api_base = biz.get("openaiApiBase") or settings.effective_llm_base
        model = biz.get("openaiModel") or settings.effective_llm_model

        # If LLM key is configured, run the LLM-based agent
        if api_key:
            try:
                # Retrieve current shop context for RAG
                low_stock_items = self.tools.low_stock(business_id)
                top_debtors = self.tools.find_customers(business_id, "")
                sales_sum = self.tools.sales_total(business_id)
                
                # Retrieve list of all product names for matching
                products = list(self.db["products"].find({"businessId": business_id, "isActive": True}, {"_id": 0, "name": 1, "pricing.sellingPrice": 1}))
                product_list = [f"{p['name']} (Price: ₹{p.get('pricing', {}).get('sellingPrice', 0)})" for p in products]

                recent_msgs = self.memory.recent(business_id, conversation_id, limit=8)
                history_str = "\n".join([f"{msg['role']}: {msg['content']}" for msg in recent_msgs])

                system_prompt = (
                    "You are KhataFlow's intelligent business assistant for an Indian shop owner.\n\n"
                    "LANGUAGE RULES — CRITICAL:\n"
                    "1. You MUST fully support Tamil language (தமிழ்).\n"
                    "2. If the user writes or speaks in Tamil, Tanglish (Tamil words written in English letters), or asks to speak in Tamil (e.g. 'speak in tamil', 'tamil-il pesu', 'speak tamil', 'the ai assistant is not speaking in tamil'), reply ENTIRELY in clear, natural Tamil script (தமிழ்).\n"
                    "3. If the user writes in English and does NOT request Tamil, reply in English.\n"
                    "4. If the user mixes Tamil and English (Tanglish), reply in Tamil script (தமிழ்).\n"
                    "5. Whenever replying in Tamil, ALWAYS set \"detectedLanguage\": \"tamil\".\n"
                    "6. Common Tamil shop phrases to understand:\n"
                    "   - 'enna panra' / 'enna nadakuthu' = what is happening / status\n"
                    "   - 'stock iruka' / 'stock irukka' = is there stock\n"
                    "   - 'yeppo varum' = when will it arrive\n"
                    "   - 'vithu' = sold\n"
                    "   - 'vanga' = buy\n"
                    "   - 'kasu' / 'panam' = money\n"
                    "   - 'kadan' = debt\n"
                    "   - 'evvalo' = how much\n"
                    "   - 'sales evvalo' = how much sales\n\n"
                    "RESPONSE FORMAT — You MUST respond ONLY in this strict JSON format, no markdown block code formatting:\n"
                    "{\n"
                    '  "reply": "Your answer in Tamil script (தமிழ்) if user spoke Tamil/Tanglish or asked for Tamil; otherwise English",\n'
                    '  "detectedLanguage": "tamil" | "english" | "tanglish",\n'
                    '  "proposal": {\n'
                    '    "transactionType": "sale" | "purchase" | "return",\n'
                    '    "customerName": "customer name or null",\n'
                    '    "lineItems": [{"productName": "name", "quantity": number, "unitPrice": number}]\n'
                    '  } or null\n'
                    "}\n\n"
                    "BUSINESS RULES:\n"
                    "1. Never silently create transactions — always use the proposal object for review.\n"
                    "2. If user mentions selling, buying, returning products — draft a proposal.\n"
                    "3. Match product names exactly from the catalog below.\n"
                    "4. Be friendly and conversational like a helpful shop assistant."
                )

                extra_lang_instruction = ""
                if preferred_language == "tamil":
                    extra_lang_instruction = "\nUSER PREFERENCE: The user has selected Tamil mode. You MUST reply in Tamil script (தமிழ்) and set detectedLanguage to 'tamil'."

                prompt = (
                    f"Available Products Catalog:\n{product_list}\n\n"
                    f"Current Shop State Context:\n"
                    f"- Low Stock Alert Products: {low_stock_items}\n"
                    f"- Top Customer Debtors: {top_debtors}\n"
                    f"- Grand Total Recorded Sales: ₹{sales_sum}\n\n"
                    f"Conversation History:\n{history_str}\n\n"
                    f"User Message: {message}\n"
                    f"{extra_lang_instruction}"
                )

                provider = LLMProvider(api_key, api_base, model)
                raw_completion = provider.complete(system_prompt, prompt).strip()
                
                # Strip markdown json block wrappers if LLM returned them
                if raw_completion.startswith("```"):
                    lines = raw_completion.split("\n")
                    if lines[0].startswith("```json"):
                        raw_completion = "\n".join(lines[1:-1])
                    else:
                        raw_completion = "\n".join(lines[1:-1])

                data = json.loads(raw_completion)
                reply = data.get("reply", "I'm not sure how to help with that.")
                proposal = data.get("proposal")
                detected_language = data.get("detectedLanguage", "english")

                # Save history
                self.memory.append(business_id, conversation_id, "user", message)
                self.memory.append(business_id, conversation_id, "assistant", reply)

                requires_confirmation = proposal is not None
                return {
                    "conversationId": conversation_id,
                    "reply": reply,
                    "intent": "llm_chat",
                    "detectedLanguage": detected_language,
                    "requiresConfirmation": requires_confirmation,
                    "proposal": proposal
                }

            except Exception as e:
                logger.exception("LLM agent failed, falling back to rule-based agent")
                # Fall back gracefully to deterministic rule-based response on error
                pass

        # Fallback to rule-based agent if no key or if LLM failed
        action = plan(message)
        reply = execute(self.tools, business_id, action, message)
        
        self.memory.append(business_id, conversation_id, "user", message)
        self.memory.append(business_id, conversation_id, "assistant", reply)
        
        detected_lang = "tamil" if action.tamil else "english"
        return {
            "conversationId": conversation_id,
            "reply": reply,
            "intent": action.intent,
            "detectedLanguage": detected_lang,
            "requiresConfirmation": action.requires_confirmation,
            "proposal": None
        }
