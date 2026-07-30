"""LLM Provider supporting OpenAI and OpenAI-compatible endpoints with dynamic tenant keys."""
import openai
import logging

logger = logging.getLogger(__name__)

class LLMProvider:
    def __init__(self, api_key: str | None = None, api_base: str | None = None, model: str | None = None) -> None:
        self.api_key = api_key
        self.api_base = api_base
        self.model = model or "gpt-4o"

    def complete(self, system_prompt: str, prompt: str) -> str:
        if not self.api_key:
            raise RuntimeError("No LLM provider key configured. Set GROQ_API_KEY in server/.env or add a tenant key in Settings.")
        
        client = openai.OpenAI(
            api_key=self.api_key,
            base_url=self.api_base or None
        )
        
        try:
            response = client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.1
            )
            return response.choices[0].message.content or ""
        except Exception as e:
            logger.exception("LLM API call failed")
            raise RuntimeError(f"AI Assistant API call failed: {str(e)}")
