
from __future__ import annotations

import copy
import logging
import uuid
from datetime import date, datetime, timezone
from typing import Any, Dict, List, Optional

from pymongo.database import Database

from app.errors import AppError
from app.models.documents import Plan, Playlist, Progress, Video
from app.services.scheduler import build_schedule

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------
# MongoDB document conversion helpers
# ---------------------------------------------------------------------


def _ensure_utc(value: Optional[datetime]) -> Optional[datetime]:
    """Ensure MongoDB timestamps are timezone-aware UTC."""
    if value is not None and value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value


def _playlist_from_document(
    db: Database,
    document: Dict[str, Any],
) -> Playlist:
    """Convert a MongoDB playlist document and its videos into a Playlist."""

    videos = [
        Video(
            playlist_id=str(video["playlist_id"]),
            youtube_video_id=video["youtube_video_id"],
            position=video["position"],
            title=video["title"],
            description=video.get("description", ""),
            duration_seconds=video["duration_seconds"],
            thumbnail_url=video.get("thumbnail_url"),
        )
        for video in db.videos.find(
            {"playlist_id": str(document["_id"])}
        ).sort("position", 1)
    ]

    return Playlist(
        id=str(document["_id"]),
        youtube_playlist_id=document["youtube_playlist_id"],
        title=document["title"],
        channel_title=document["channel_title"],
        video_count=document["video_count"],
        total_seconds=document["total_seconds"],
        warnings=document.get("warnings", []),
        fetched_at=_ensure_utc(document["fetched_at"]),
        videos=videos,
    )


def _load_plan(db: Database, plan_id: str) -> Plan:
    """Load a plan along with its playlist, videos and progress records."""

    document = db.plans.find_one({"_id": plan_id})

    if not document:
        raise AppError(
            "PLAN_NOT_FOUND",
            f"Plan with ID '{plan_id}' not found.",
            status_code=404,
        )

    playlist_document = db.playlists.find_one(
        {"_id": document["playlist_id"]}
    )

    if not playlist_document:
        raise AppError(
            "PLAYLIST_NOT_FOUND",
            "The playlist associated with this plan could not be found.",
            status_code=404,
        )

    playlist = _playlist_from_document(db, playlist_document)

    progress_records = [
        Progress(
            plan_id=record["plan_id"],
            youtube_video_id=record["youtube_video_id"],
            completed=record.get("completed", False),
            completed_at=_ensure_utc(record.get("completed_at")),
            actual_seconds=record.get("actual_seconds"),
        )
        for record in db.progress.find({"plan_id": plan_id})
    ]

    return Plan(
        id=str(document["_id"]),
        playlist_id=document["playlist_id"],
        hours_per_week=document["hours_per_week"],
        start_date=document["start_date"],
        target_date=document.get("target_date"),
        topics_json=document["topics_json"],
        schedule_json=document["schedule_json"],
        feasible=document["feasible"],
        required_hours_per_week=document.get("required_hours_per_week"),
        pace_factor=document.get("pace_factor", 1.0),
        replan_count=document.get("replan_count", 0),
        clustering_method_used=document["clustering_method_used"],
        created_at=_ensure_utc(document.get("created_at")),
        updated_at=_ensure_utc(document.get("updated_at")),
        playlist=playlist,
        progress_records=progress_records,
    )


# ---------------------------------------------------------------------
# Video assignment
# ---------------------------------------------------------------------


def assign_videos_to_weeks(
    topics: List[Dict[str, Any]],
    schedule: Dict[str, Any],
    videos_by_id: Dict[str, Dict[str, Any]],
) -> Dict[str, Any]:
    """Assign videos to weekly chunks based on cumulative effort."""

    updated_schedule = copy.deepcopy(schedule)

    # Map each topic to its schedule occurrences in chronological order.
    topic_chunks: Dict[int, List[Dict[str, Any]]] = {}

    for week in updated_schedule.get("weeks", []):
        for item in week.get("topics", []):
            topic_id = item["topic_id"]
            topic_chunks.setdefault(topic_id, []).append(item)

    # Assign videos to each topic.
    for topic in topics:
        topic_id = topic["id"]
        multiplier = topic["multiplier"]
        video_ids = topic["video_ids"]

        chunks = topic_chunks.get(topic_id, [])

        if not chunks:
            continue

        # If the topic fits into one chunk, assign every video there.
        if len(chunks) == 1:
            chunks[0]["videos"] = [
                {
                    "youtube_video_id": video_id,
                    "title": videos_by_id[video_id]["title"],
                    "duration_seconds": videos_by_id[video_id]["duration_seconds"],
                    "thumbnail_url": videos_by_id[video_id].get("thumbnail_url"),
                    "completed": False,
                }
                for video_id in video_ids
                if video_id in videos_by_id
            ]
            continue

        # Calculate cumulative chunk boundaries.
        chunk_boundaries: List[float] = []
        accumulated = 0.0

        for chunk in chunks:
            accumulated += chunk["hours"]
            chunk_boundaries.append(accumulated)

        for chunk in chunks:
            chunk["videos"] = []

        current_effort_offset = 0.0

        for video_id in video_ids:
            video_data = videos_by_id.get(video_id)

            if not video_data:
                continue

            video_effort = (
                video_data["duration_seconds"] / 3600.0
            ) * multiplier

            assigned_chunk_index = len(chunks) - 1

            for index, boundary in enumerate(chunk_boundaries[:-1]):
                if current_effort_offset < boundary - 1e-6:
                    assigned_chunk_index = index
                    break

            chunks[assigned_chunk_index]["videos"].append(
                {
                    "youtube_video_id": video_id,
                    "title": video_data["title"],
                    "duration_seconds": video_data["duration_seconds"],
                    "thumbnail_url": video_data.get("thumbnail_url"),
                    "completed": False,
                }
            )

            current_effort_offset += video_effort

    return updated_schedule


# ---------------------------------------------------------------------
# Create plan
# ---------------------------------------------------------------------


def create_plan(
    db: Database,
    playlist: Playlist,
    clustering_method_used: str,
    topics_json: List[Dict[str, Any]],
    hours_per_week: float,
    start_date: str,
    target_date: Optional[str] = None,
) -> Plan:
    """Generate a study schedule and save the plan in MongoDB."""

    videos_by_id = {
        video.youtube_video_id: {
            "title": video.title,
            "duration_seconds": video.duration_seconds,
            "thumbnail_url": video.thumbnail_url,
        }
        for video in playlist.videos
    }

    schedule = build_schedule(
        topics=topics_json,
        hours_per_week=hours_per_week,
        start_date=start_date,
        target_date=target_date,
    )

    schedule_with_videos = assign_videos_to_weeks(
        topics_json,
        schedule,
        videos_by_id,
    )

    plan_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc)

    plan_document = {
        "_id": plan_id,
        "playlist_id": playlist.id,
        "hours_per_week": hours_per_week,
        "start_date": start_date,
        "target_date": target_date,
        "topics_json": topics_json,
        "schedule_json": schedule_with_videos,
        "feasible": schedule["feasible"],
        "required_hours_per_week": schedule["required_hours_per_week"],
        "pace_factor": 1.0,
        "replan_count": 0,
        "clustering_method_used": clustering_method_used,
        "created_at": now,
        "updated_at": now,
    }

    db.plans.insert_one(plan_document)

    return _load_plan(db, plan_id)


# ---------------------------------------------------------------------
# Progress calculation
# ---------------------------------------------------------------------


def compute_progress(
    plan: Plan,
    progress_rows: List[Progress],
    today_str: Optional[str] = None,
) -> Dict[str, Any]:
    """Calculate effort-weighted completion and on-track / behind status."""

    if today_str:
        today = date.fromisoformat(today_str)
    else:
        today = datetime.now(timezone.utc).date()

    start_date = date.fromisoformat(plan.start_date)

    completed_map = {
        progress.youtube_video_id: progress
        for progress in progress_rows
        if progress.completed
    }

    video_multipliers: Dict[str, float] = {}
    video_durations: Dict[str, int] = {}

    total_videos_count = 0

    if plan.playlist and plan.playlist.videos:
        for video in plan.playlist.videos:
            video_durations[video.youtube_video_id] = video.duration_seconds

        total_videos_count = len(plan.playlist.videos)

    for topic in plan.topics_json:
        multiplier = topic.get("multiplier", 1.5)

        for video_id in topic.get("video_ids", []):
            video_multipliers[video_id] = multiplier

    total_effort_hours = sum(
        topic.get("effort_hours", 0.0)
        for topic in plan.topics_json
    )

    completed_videos_count = len(completed_map)
    completed_effort_hours = 0.0

    for video_id in completed_map:
        duration = video_durations.get(video_id, 0)
        multiplier = video_multipliers.get(video_id, 1.5)

        completed_effort_hours += (
            duration / 3600.0
        ) * multiplier

    completed_effort_hours = round(completed_effort_hours, 2)

    percent_complete = 0.0

    if total_effort_hours > 0:
        percent_complete = round(
            min(
                100.0,
                (completed_effort_hours / total_effort_hours) * 100.0,
            ),
            1,
        )

    # Calculate planned effort hours to date.
    planned_effort_hours_to_date = 0.0
    weeks = plan.schedule_json.get("weeks", [])

    for week in weeks:
        week_start = date.fromisoformat(week["start"])
        week_end = date.fromisoformat(week["end"])
        week_hours = float(week.get("hours", 0.0))

        if week_end < today:
            planned_effort_hours_to_date += week_hours

        elif week_start <= today <= week_end:
            total_days = (week_end - week_start).days + 1
            elapsed_days = (today - week_start).days + 1

            fraction = min(
                1.0,
                max(0.0, elapsed_days / total_days),
            )

            planned_effort_hours_to_date += week_hours * fraction

    planned_effort_hours_to_date = round(
        planned_effort_hours_to_date,
        2,
    )

    # Determine progress status.
    if today < start_date:
        status = "not_started"

    elif (
        total_videos_count > 0
        and completed_videos_count == total_videos_count
    ):
        status = "complete"

    elif planned_effort_hours_to_date <= 0.01:
        status = "on_track"

    elif completed_effort_hours > planned_effort_hours_to_date * 1.10:
        status = "ahead"

    elif completed_effort_hours < planned_effort_hours_to_date * 0.90:
        status = "behind"

    else:
        status = "on_track"

    return {
        "completed_videos": completed_videos_count,
        "total_videos": total_videos_count,
        "completed_effort_hours": completed_effort_hours,
        "percent_complete": percent_complete,
        "planned_effort_hours_to_date": planned_effort_hours_to_date,
        "status": status,
    }


# ---------------------------------------------------------------------
# Format API response
# ---------------------------------------------------------------------


def format_plan_response(
    plan: Plan,
    today_str: Optional[str] = None,
) -> Dict[str, Any]:
    """Format the complete plan response for the existing frontend."""

    progress_info = compute_progress(
        plan,
        plan.progress_records,
        today_str,
    )

    completed_set = {
        progress.youtube_video_id
        for progress in plan.progress_records
        if progress.completed
    }

    schedule_copy = copy.deepcopy(plan.schedule_json)

    for week in schedule_copy.get("weeks", []):
        for topic in week.get("topics", []):
            for video in topic.get("videos", []):
                video["completed"] = (
                    video["youtube_video_id"] in completed_set
                )

    playlist = plan.playlist

    playlist_data = {
        "youtube_playlist_id": playlist.youtube_playlist_id,
        "title": playlist.title,
        "channel_title": playlist.channel_title,
        "video_count": playlist.video_count,
        "total_watch_hours": round(
            playlist.total_seconds / 3600.0,
            1,
        ),
        "warnings": playlist.warnings or [],
    }

    settings_data = {
        "hours_per_week": plan.hours_per_week,
        "start_date": plan.start_date,
        "target_date": plan.target_date,
    }

    summary_data = {
        "total_effort_hours": round(
            sum(
                topic.get("effort_hours", 0.0)
                for topic in plan.topics_json
            ),
            2,
        ),
        "num_topics": len(plan.topics_json),
        "num_weeks": schedule_copy.get(
            "num_weeks",
            len(schedule_copy.get("weeks", [])),
        ),
        "completion_date": schedule_copy.get("completion_date"),
        "feasible": plan.feasible,
        "required_hours_per_week": plan.required_hours_per_week,
        "pace_factor": plan.pace_factor,
        "replan_count": plan.replan_count,
        "clustering_method_used": plan.clustering_method_used,
    }

    topics_data = [
        {
            "id": topic["id"],
            "name": topic["name"],
            "difficulty": topic["difficulty"],
            "effort_hours": topic["effort_hours"],
            "video_count": topic.get(
                "video_count",
                len(topic.get("video_ids", [])),
            ),
        }
        for topic in plan.topics_json
    ]

    return {
        "id": plan.id,
        "playlist": playlist_data,
        "settings": settings_data,
        "summary": summary_data,
        "topics": topics_data,
        "topic_deadlines": schedule_copy.get("topic_deadlines", []),
        "weeks": schedule_copy.get("weeks", []),
        "progress": progress_info,
    }


# Used to distinguish an omitted target_date from an explicit null.
_UNSET = object()


# ---------------------------------------------------------------------
# Replan
# ---------------------------------------------------------------------


def replan(
    db: Database,
    plan: Plan,
    hours_per_week: Optional[float] = None,
    target_date: Any = _UNSET,
    start_date: Optional[str] = None,
    adaptive_pace: bool = True,
    today_str: Optional[str] = None,
) -> Plan:
    """Replan remaining uncompleted videos and persist changes in MongoDB."""

    if today_str:
        today_date_str = today_str
    else:
        today_date_str = datetime.now(timezone.utc).date().isoformat()

    # 1. Collect completed and incomplete videos.
    completed_videos = {
        progress.youtube_video_id
        for progress in plan.progress_records
        if progress.completed
    }

    all_topic_videos = [
        video_id
        for topic in plan.topics_json
        for video_id in topic.get("video_ids", [])
    ]

    incomplete_videos = [
        video_id
        for video_id in all_topic_videos
        if video_id not in completed_videos
    ]

    if not incomplete_videos:
        raise AppError(
            "PLAN_COMPLETE",
            "All videos in this plan are already completed. Nothing left to replan.",
            status_code=409,
        )

    # 2. Adaptive pace computation.
    new_pace_factor = plan.pace_factor

    if adaptive_pace:
        completed_with_actual = [
            progress
            for progress in plan.progress_records
            if (
                progress.completed
                and progress.actual_seconds is not None
                and progress.actual_seconds > 0
            )
        ]

        if len(completed_with_actual) >= 3:
            duration_map = {
                video.youtube_video_id: video.duration_seconds
                for video in plan.playlist.videos
            }

            multiplier_map: Dict[str, float] = {}

            for topic in plan.topics_json:
                for video_id in topic["video_ids"]:
                    multiplier_map[video_id] = topic["multiplier"]

            total_actual = sum(
                progress.actual_seconds
                for progress in completed_with_actual
            )

            total_estimated = sum(
                duration_map.get(progress.youtube_video_id, 0)
                * multiplier_map.get(progress.youtube_video_id, 1.5)
                for progress in completed_with_actual
            )

            if total_estimated > 0:
                ratio = total_actual / total_estimated

                new_pace_factor = round(
                    max(0.5, min(2.0, ratio)),
                    2,
                )

    # 3. Build remaining topics, removing completed videos.
    duration_map = {
        video.youtube_video_id: video.duration_seconds
        for video in plan.playlist.videos
    }

    remaining_topics: List[Dict[str, Any]] = []

    for topic in plan.topics_json:
        incomplete_topic_videos = [
            video_id
            for video_id in topic["video_ids"]
            if video_id not in completed_videos
        ]

        if not incomplete_topic_videos:
            continue

        multiplier = topic["multiplier"]

        raw_seconds = sum(
            duration_map.get(video_id, 0)
            for video_id in incomplete_topic_videos
        )

        remaining_effort = round(
            (
                (raw_seconds / 3600.0)
                * multiplier
            ) * new_pace_factor,
            2,
        )

        remaining_topics.append(
            {
                "id": topic["id"],
                "name": topic["name"],
                "difficulty": topic["difficulty"],
                "multiplier": multiplier,
                "effort_hours": remaining_effort,
                "video_ids": incomplete_topic_videos,
                "video_count": len(incomplete_topic_videos),
            }
        )

    # 4. Resolve updated study settings.
    effective_start = start_date or today_date_str

    effective_hours_per_week = (
        hours_per_week
        if hours_per_week is not None
        else plan.hours_per_week
    )

    effective_target = (
        target_date
        if target_date is not _UNSET
        else plan.target_date
    )

    # 5. Build the new schedule and assign remaining videos.
    videos_by_id = {
        video.youtube_video_id: {
            "title": video.title,
            "duration_seconds": video.duration_seconds,
            "thumbnail_url": video.thumbnail_url,
        }
        for video in plan.playlist.videos
    }

    schedule = build_schedule(
        topics=remaining_topics,
        hours_per_week=effective_hours_per_week,
        start_date=effective_start,
        target_date=effective_target,
    )

    schedule_with_videos = assign_videos_to_weeks(
        remaining_topics,
        schedule,
        videos_by_id,
    )

    # 6. Update the Plan object.
    now = datetime.now(timezone.utc)

    plan.hours_per_week = effective_hours_per_week
    plan.start_date = effective_start
    plan.target_date = effective_target
    plan.schedule_json = schedule_with_videos
    plan.feasible = schedule["feasible"]
    plan.required_hours_per_week = schedule["required_hours_per_week"]
    plan.pace_factor = new_pace_factor
    plan.replan_count += 1
    plan.updated_at = now

    # 7. Persist changes in MongoDB.
    result = db.plans.update_one(
        {"_id": plan.id},
        {
            "$set": {
                "hours_per_week": plan.hours_per_week,
                "start_date": plan.start_date,
                "target_date": plan.target_date,
                "schedule_json": plan.schedule_json,
                "feasible": plan.feasible,
                "required_hours_per_week": plan.required_hours_per_week,
                "pace_factor": plan.pace_factor,
                "replan_count": plan.replan_count,
                "updated_at": now,
            }
        },
    )

    if result.matched_count == 0:
        raise AppError(
            "PLAN_NOT_FOUND",
            f"Plan with ID '{plan.id}' not found.",
            status_code=404,
        )

    return _load_plan(db, plan.id)
