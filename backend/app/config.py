
from functools import lru_cache
from typing import List

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # YouTube
    YOUTUBE_API_KEY: str = ""

    # MongoDB Atlas
    MONGODB_URI: str = ""
    MONGODB_USERNAME: str = ""
    MONGODB_PASSWORD: str = ""
    MONGODB_DATABASE: str = "syllabify"

    # Frontend and API configuration
    CORS_ORIGINS: str = (
        "http://localhost:5173,https://syllabify-two.vercel.app"
    )

    # LLM configuration
    LLM_PROVIDER: str = "gemini"
    LLM_API_KEY: str | None = None
    LLM_MODEL: str | None = None

    # Clustering and study planning
    CLUSTERING_METHOD: str = "llm"
    TARGET_TOPIC_HOURS: float = 4.0
    EFFORT_MULT_BEGINNER: float = 1.25
    EFFORT_MULT_INTERMEDIATE: float = 1.5
    EFFORT_MULT_ADVANCED: float = 2.0

    # Playlist configuration
    MAX_PLAYLIST_VIDEOS: int = 500
    PLAYLIST_CACHE_HOURS: int = 24

    # API protection
    RATE_LIMIT_ANALYZE: str = "10/minute"

    # Environment
    ENVIRONMENT: str = "development"
    TESTING: bool = False

    @property
    def cors_origins_list(self) -> List[str]:
        return [
            origin.strip()
            for origin in self.CORS_ORIGINS.split(",")
            if origin.strip()
        ]

    def check_required_keys(self) -> None:
        if self.TESTING or self.ENVIRONMENT == "test":
            return

        if not self.MONGODB_URI:
            raise ValueError("MONGODB_URI is required.")

        if not self.MONGODB_USERNAME:
            raise ValueError("MONGODB_USERNAME is required.")

        if not self.MONGODB_PASSWORD:
            raise ValueError("MONGODB_PASSWORD is required.")

        if not self.YOUTUBE_API_KEY:
            raise ValueError(
                "YOUTUBE_API_KEY is required. "
                "Please set it in your environment or .env file."
            )

        if self.LLM_PROVIDER != "fake" and not self.LLM_API_KEY:
            # Retain the existing behaviour: the LLM key is not
            # currently enforced as a startup failure.
            pass


@lru_cache
def get_settings() -> Settings:
    return Settings()
