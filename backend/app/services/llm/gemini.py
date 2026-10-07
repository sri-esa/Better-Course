from __future__ import annotations

import json
import logging
import re
from typing import Any, Dict

from app.config import get_settings
from app.services.llm.base import LLMClient, LLMError

logger = logging.getLogger(__name__)


class GeminiLLMClient(LLMClient):
    """Google Gemini LLM client implementation."""

    def __init__(self, api_key: str | None = None, model: str | None = None):
        settings = get_settings()
        self.api_key = api_key or settings.LLM_API_KEY
        self.model_name = model or settings.LLM_MODEL or "gemini-1.5-flash"

        if not self.api_key:
            raise LLMError("LLM_API_KEY is not configured for Gemini.")

        try:
            import google.generativeai as genai
            genai.configure(api_key=self.api_key)
            self._client = genai.GenerativeModel(
                model_name=self.model_name,
                generation_config={"response_mime_type": "application/json"},
            )
        except Exception as e:
            raise LLMError(f"Failed to initialize Gemini client: {e}")

    def generate_json(self, system: str, user: str, *, temperature: float = 0.2) -> Dict[str, Any]:
        logger.debug("Prompting Gemini with system: %s | user: %s", system[:100], user[:100])
        try:
            prompt = f"{system}\n\n{user}" if system else user
            response = self._client.generate_content(
                prompt,
                generation_config={"temperature": temperature, "response_mime_type": "application/json"},
            )

            raw_text = (response.text or "").strip()
            # Defensive clean: strip markdown code blocks if returned
            if raw_text.startswith("```"):
                raw_text = re.sub(r"^```(?:json)?\n?", "", raw_text)
                raw_text = re.sub(r"\n?```$", "", raw_text).strip()

            return json.loads(raw_text)
        except Exception as e:
            logger.warning("Gemini generation failed: %s", e)
            raise LLMError(f"Gemini call failed: {e}")
