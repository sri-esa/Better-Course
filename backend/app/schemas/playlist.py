from datetime import datetime
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


class PlaylistIngestRequest(BaseModel):
    playlist_url: str = Field(..., description="YouTube playlist URL or ID")
    refresh: bool = Field(False, description="Force refresh from YouTube API")


class VideoItemSchema(BaseModel):
    youtube_video_id: str
    position: int
    title: str
    description: str
    duration_seconds: int
    thumbnail_url: Optional[str] = None


class PlaylistResponse(BaseModel):
    id: str
    youtube_playlist_id: str
    title: str
    channel_title: str
    video_count: int
    total_seconds: int
    warnings: List[Dict[str, Any]]
    fetched_at: datetime
    videos: List[VideoItemSchema]

    model_config = {"from_attributes": True}
