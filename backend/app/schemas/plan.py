from datetime import date
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field, field_validator


class AnalyzeRequest(BaseModel):
    playlist_url: str = Field(..., description="YouTube playlist URL or ID")
    hours_per_week: float = Field(..., gt=0, le=120, description="Available study hours per week")
    start_date: Optional[str] = Field(None, description="Start date ISO format (YYYY-MM-DD)")
    target_date: Optional[str] = Field(None, description="Optional target completion date ISO format")
    clustering_method: Optional[str] = Field(None, description="'llm', 'embeddings', or 'hybrid'")

    @field_validator("start_date")
    @classmethod
    def validate_start_date(cls, v: Optional[str]) -> Optional[str]:
        if v:
            try:
                date.fromisoformat(v)
            except ValueError:
                raise ValueError("start_date must be a valid ISO date YYYY-MM-DD")
        return v

    @field_validator("target_date")
    @classmethod
    def validate_target_date(cls, v: Optional[str]) -> Optional[str]:
        if v:
            try:
                date.fromisoformat(v)
            except ValueError:
                raise ValueError("target_date must be a valid ISO date YYYY-MM-DD")
        return v


class PlaylistSummarySchema(BaseModel):
    youtube_playlist_id: str
    title: str
    channel_title: str
    video_count: int
    total_watch_hours: float
    warnings: List[Dict[str, Any]] = []


class SettingsSchema(BaseModel):
    hours_per_week: float
    start_date: str
    target_date: Optional[str] = None


class SummarySchema(BaseModel):
    total_effort_hours: float
    num_topics: int
    num_weeks: int
    completion_date: Optional[str] = None
    feasible: bool
    required_hours_per_week: Optional[float] = None
    pace_factor: float
    replan_count: int
    clustering_method_used: str


class TopicSummarySchema(BaseModel):
    id: int
    name: str
    difficulty: str
    effort_hours: float
    video_count: int


class TopicDeadlineSchema(BaseModel):
    topic_id: int
    name: str
    deadline: str


class VideoScheduleItemSchema(BaseModel):
    youtube_video_id: str
    title: str
    duration_seconds: int
    thumbnail_url: Optional[str] = None
    completed: bool = False


class TopicScheduleItemSchema(BaseModel):
    topic_id: int
    name: str
    hours: float
    part: int
    total_parts: int
    videos: List[VideoScheduleItemSchema] = []


class WeekScheduleSchema(BaseModel):
    week: int
    start: str
    end: str
    hours: float
    topics: List[TopicScheduleItemSchema] = []


class ProgressSchema(BaseModel):
    completed_videos: int
    total_videos: int
    completed_effort_hours: float
    percent_complete: float
    planned_effort_hours_to_date: float
    status: str


class ProgressUpdateItem(BaseModel):
    youtube_video_id: str
    completed: bool
    actual_seconds: Optional[int] = Field(None, ge=0, le=86400)


class ProgressUpdateRequest(BaseModel):
    updates: List[ProgressUpdateItem] = Field(..., max_length=200)


class ProgressUpdateResponse(BaseModel):
    progress: ProgressSchema


class ReplanRequest(BaseModel):
    hours_per_week: Optional[float] = Field(None, gt=0, le=120)
    target_date: Optional[str] = None
    start_date: Optional[str] = None
    adaptive_pace: bool = True

    @field_validator("start_date")
    @classmethod
    def validate_start_date(cls, v: Optional[str]) -> Optional[str]:
        if v:
            try:
                date.fromisoformat(v)
            except ValueError:
                raise ValueError("start_date must be a valid ISO date YYYY-MM-DD")
        return v

    @field_validator("target_date")
    @classmethod
    def validate_target_date(cls, v: Optional[str]) -> Optional[str]:
        if v:
            try:
                date.fromisoformat(v)
            except ValueError:
                raise ValueError("target_date must be a valid ISO date YYYY-MM-DD")
        return v


class PlanResponse(BaseModel):
    id: str
    playlist: PlaylistSummarySchema
    settings: SettingsSchema
    summary: SummarySchema
    topics: List[TopicSummarySchema]
    topic_deadlines: List[TopicDeadlineSchema]
    weeks: List[WeekScheduleSchema]
    progress: ProgressSchema
