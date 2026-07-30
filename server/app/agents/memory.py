"""Bounded, database-backed conversation memory for the business assistant."""
from typing import Any
from uuid import UUID

class ConversationMemory:
    def __init__(self, database: Any) -> None:
        self._collection = database["agent_conversations"]

    def recent(self, business_id: UUID, conversation_id: str, limit: int = 12) -> list[dict[str, str]]:
        row = self._collection.find_one({"businessId": business_id, "conversationId": conversation_id}, {"_id": 0}) or {}
        return row.get("messages", [])[-limit:]

    def append(self, business_id: UUID, conversation_id: str, role: str, content: str) -> None:
        self._collection.update_one({"businessId": business_id, "conversationId": conversation_id}, {"$push": {"messages": {"role": role, "content": content}}, "$setOnInsert": {"businessId": business_id, "conversationId": conversation_id}}, upsert=True)
