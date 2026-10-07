from functools import lru_cache
from typing import List

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    YOUTUBE_API_KEY: str = ""
    DATABASE_URL: str = "sqlite:///./studyflow.db"
    CORS_ORIGINS: str = "http://localhost:5173"
    LLM_PROVIDER: str = "gemini"
    LLM_API_KEY: str | None = None
    LLM_MODEL: str | None = None
    CLUSTERING_METHOD: str = "llm"
    TARGET_TOPIC_HOURS: float = 4.0
    EFFORT_MULT_BEGINNER: float = 1.25
    EFFORT_MULT_INTERMEDIATE: float = 1.5
    EFFORT_MULT_ADVANCED: float = 2.0
    MAX_PLAYLIST_VIDEOS: int = 500
    PLAYLIST_CACHE_HOURS: int = 24
    RATE_LIMIT_ANALYZE: str = "10/minute"
    ENVIRONMENT: str = "development"
    TESTING: bool = False

    @property
    def cors_origins_list(self) -> List[str]:
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",") if origin.strip()]

    def check_required_keys(self) -> None:
        if not self.TESTING and self.ENVIRONMENT != "test":
            if not self.YOUTUBE_API_KEY:
                raise ValueError(
                    "YOUTUBE_API_KEY is required. Please set it in your environment or .env file."
                )
            if self.LLM_PROVIDER != "fake" and not self.LLM_API_KEY:
                # Warning or error for production/development
                pass


@lru_cache
def get_settings() -> Settings:
    settings = Settings()
    return settings
