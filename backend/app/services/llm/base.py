from typing import Any, Dict, Protocol


class LLMError(Exception):
    """Raised when an LLM provider fails to generate or return valid output."""
    pass


class LLMClient(Protocol):
    def generate_json(self, system: str, user: str, *, temperature: float = 0.2) -> Dict[str, Any]:
        """Generate structured JSON response given system prompt and user prompt."""
        ...
