
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional


def generate_uuid() -> str:
    return str(uuid.uuid4())


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


@dataclass
class Video:
    playlist_id: str
    youtube_video_id: str
    position: int
    title: str
    description: str = ""
    duration_seconds: int = 0
    thumbnail_url: Optional[str] = None
    id: Optional[int] = None


@dataclass
class Playlist:
    youtube_playlist_id: str
    title: str
    channel_title: str
    id: str = field(default_factory=generate_uuid)
    video_count: int = 0
    total_seconds: int = 0
    warnings: List[Dict[str, Any]] = field(default_factory=list)
    fetched_at: datetime = field(default_factory=utc_now)
    videos: List[Video] = field(default_factory=list)


@dataclass
class Clustering:
    playlist_id: str
    method: str
    method_used: str
    videos_hash: str
    result_json: Dict[str, Any]
    id: Optional[str] = None
    created_at: datetime = field(default_factory=utc_now)


@dataclass
class Progress:
    plan_id: str
    youtube_video_id: str
    completed: bool = False
    completed_at: Optional[datetime] = None
    actual_seconds: Optional[int] = None


@dataclass
class Plan:
    playlist_id: str
    hours_per_week: float
    start_date: str
    topics_json: List[Dict[str, Any]]
    schedule_json: Dict[str, Any]
    feasible: bool
    clustering_method_used: str
    id: str = field(default_factory=generate_uuid)
    target_date: Optional[str] = None
    required_hours_per_week: Optional[float] = None
    pace_factor: float = 1.0
    replan_count: int = 0
    created_at: datetime = field(default_factory=utc_now)
    updated_at: datetime = field(default_factory=utc_now)
    playlist: Optional[Playlist] = None
    progress_records: List[Progress] = field(default_factory=list)
