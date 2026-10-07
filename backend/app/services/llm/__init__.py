from app.config import get_settings
from app.services.llm.base import LLMClient, LLMError
from app.services.llm.fake import FakeLLMClient
from app.services.llm.gemini import GeminiLLMClient


def get_llm_client() -> LLMClient:
    """Factory to retrieve configured LLM client."""
    settings = get_settings()
    provider = settings.LLM_PROVIDER.lower()

    if provider == "fake" or settings.TESTING or settings.ENVIRONMENT == "test" or not settings.LLM_API_KEY:
        return FakeLLMClient()
    elif provider == "gemini":
        return GeminiLLMClient()
    else:
        raise LLMError(f"Unsupported LLM provider: {provider}")


__all__ = ["LLMClient", "LLMError", "FakeLLMClient", "GeminiLLMClient", "get_llm_client"]
