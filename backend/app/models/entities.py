import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from sqlalchemy import (
    JSON,
    Boolean,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base


def generate_uuid() -> str:
    return str(uuid.uuid4())


class Playlist(Base):
    __tablename__ = "playlists"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    youtube_playlist_id: Mapped[str] = mapped_column(String(64), unique=True, index=True, nullable=False)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    channel_title: Mapped[str] = mapped_column(String(255), nullable=False)
    video_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    total_seconds: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    warnings: Mapped[List[Dict[str, Any]]] = mapped_column(JSON, nullable=False, default=list)
    fetched_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

    videos: Mapped[List["Video"]] = relationship(
        "Video",
        back_populates="playlist",
        cascade="all, delete-orphan",
        order_by="Video.position",
    )
    clusterings: Mapped[List["Clustering"]] = relationship(
        "Clustering",
        back_populates="playlist",
        cascade="all, delete-orphan",
    )
    plans: Mapped[List["Plan"]] = relationship(
        "Plan",
        back_populates="playlist",
        cascade="all, delete-orphan",
    )


class Video(Base):
    __tablename__ = "videos"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    playlist_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("playlists.id", ondelete="CASCADE"), nullable=False, index=True
    )
    youtube_video_id: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    position: Mapped[int] = mapped_column(Integer, nullable=False)
    title: Mapped[str] = mapped_column(String(500), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False, default="")
    duration_seconds: Mapped[int] = mapped_column(Integer, nullable=False)
    thumbnail_url: Mapped[Optional[str]] = mapped_column(String(1000), nullable=True)

    playlist: Mapped["Playlist"] = relationship("Playlist", back_populates="videos")

    __table_args__ = (
        UniqueConstraint("playlist_id", "youtube_video_id", name="uq_playlist_video"),
        Index("ix_playlist_position", "playlist_id", "position"),
    )


class Clustering(Base):
    __tablename__ = "clusterings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    playlist_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("playlists.id", ondelete="CASCADE"), nullable=False, index=True
    )
    method: Mapped[str] = mapped_column(String(32), nullable=False)
    method_used: Mapped[str] = mapped_column(String(32), nullable=False)
    videos_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    result_json: Mapped[Dict[str, Any]] = mapped_column(JSON, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

    playlist: Mapped["Playlist"] = relationship("Playlist", back_populates="clusterings")

    __table_args__ = (
        UniqueConstraint("playlist_id", "method", "videos_hash", name="uq_playlist_method_hash"),
    )


class Plan(Base):
    __tablename__ = "plans"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    playlist_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("playlists.id", ondelete="CASCADE"), nullable=False, index=True
    )
    hours_per_week: Mapped[float] = mapped_column(Float, nullable=False)
    start_date: Mapped[str] = mapped_column(String(10), nullable=False)
    target_date: Mapped[Optional[str]] = mapped_column(String(10), nullable=True)
    topics_json: Mapped[List[Dict[str, Any]]] = mapped_column(JSON, nullable=False)
    schedule_json: Mapped[Dict[str, Any]] = mapped_column(JSON, nullable=False)
    feasible: Mapped[bool] = mapped_column(Boolean, nullable=False)
    required_hours_per_week: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    pace_factor: Mapped[float] = mapped_column(Float, nullable=False, default=1.0)
    replan_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    clustering_method_used: Mapped[str] = mapped_column(String(32), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    playlist: Mapped["Playlist"] = relationship("Playlist", back_populates="plans")
    progress_records: Mapped[List["Progress"]] = relationship(
        "Progress",
        back_populates="plan",
        cascade="all, delete-orphan",
    )


class Progress(Base):
    __tablename__ = "progress"

    plan_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("plans.id", ondelete="CASCADE"), primary_key=True
    )
    youtube_video_id: Mapped[str] = mapped_column(String(64), primary_key=True)
    completed: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    actual_seconds: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)

    plan: Mapped["Plan"] = relationship("Plan", back_populates="progress_records")
