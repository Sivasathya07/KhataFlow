from uuid import UUID
from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from app.agents.agent import BusinessAgent
from app.api.routes.inventory import get_business_id
from app.database.mongo import get_database

router = APIRouter(prefix="/agent", tags=["ai assistant"])
class AgentMessage(BaseModel):
    message: str = Field(min_length=1, max_length=2000)
    conversation_id: str | None = Field(default=None, alias="conversationId", max_length=100)
    preferred_language: str | None = Field(default=None, alias="preferredLanguage", max_length=20)

@router.post("/chat")
def chat(payload: AgentMessage, business_id: UUID = Depends(get_business_id)) -> dict:
    return {"data": BusinessAgent(get_database()).respond(business_id, payload.message, payload.conversation_id, payload.preferred_language)}
