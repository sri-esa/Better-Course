from __future__ import annotations

import copy
import logging
import uuid
from datetime import date, datetime, timezone
from typing import Any, Dict, List, Optional

from sqlalchemy.orm import Session

from app.errors import AppError
from app.models.entities import Plan, Playlist, Progress
from app.services.scheduler import build_schedule

logger = logging.getLogger(__name__)


def assign_videos_to_weeks(
    topics: List[Dict[str, Any]],
    schedule: Dict[str, Any],
    videos_by_id: Dict[str, Dict[str, Any]],
) -> Dict[str, Any]:
    """Assign videos to weekly chunks based on video cumulative effort offsets

    and chunk hour boundaries.
    """
    updated_schedule = copy.deepcopy(schedule)

    # 1. Map each topic to its schedule occurrences/chunks in chronological order
    # item in week["topics"]: {"topic_id": int, "name": str, "hours": float, "part": int, "total_parts": int}
    topic_chunks: Dict[int, List[Dict[str, Any]]] = {}
    for w in updated_schedule.get("weeks", []):
        for item in w.get("topics", []):
            tid = item["topic_id"]
            if tid not in topic_chunks:
                topic_chunks[tid] = []
            topic_chunks[tid].append(item)

    # 2. Assign videos per topic
    for topic in topics:
        tid = topic["id"]
        mult = topic["multiplier"]
        v_ids = topic["video_ids"]
        chunks = topic_chunks.get(tid, [])

        if not chunks:
            continue

        if len(chunks) == 1:
            # Unsplit topic: all videos go to this chunk
            chunks[0]["videos"] = [
                {
                    "youtube_video_id": vid,
                    "title": videos_by_id[vid]["title"],
                    "duration_seconds": videos_by_id[vid]["duration_seconds"],
                    "thumbnail_url": videos_by_id[vid].get("thumbnail_url"),
                    "completed": False,
                }
                for vid in v_ids
                if vid in videos_by_id
            ]
            continue

        # Spilled topic across multiple weeks/chunks
        # Cumulative chunk boundaries in effort hours
        chunk_boundaries: List[float] = []
        accum = 0.0
        for ch in chunks:
            accum += ch["hours"]
            chunk_boundaries.append(accum)

        # Initialize video list for each chunk
        for ch in chunks:
            ch["videos"] = []

        curr_effort_offset = 0.0
        for vid in v_ids:
            v_data = videos_by_id.get(vid)
            if not v_data:
                continue

            v_effort = (v_data["duration_seconds"] / 3600.0) * mult
            # Find which chunk covers curr_effort_offset
            assigned_chunk_idx = len(chunks) - 1  # default to last chunk
            for idx, boundary in enumerate(chunk_boundaries[:-1]):
                if curr_effort_offset < boundary - 1e-6:
                    assigned_chunk_idx = idx
                    break

            chunks[assigned_chunk_idx]["videos"].append({
                "youtube_video_id": vid,
                "title": v_data["title"],
                "duration_seconds": v_data["duration_seconds"],
                "thumbnail_url": v_data.get("thumbnail_url"),
                "completed": False,
            })
            curr_effort_offset += v_effort

    return updated_schedule


def create_plan(
    db: Session,
    playlist: Playlist,
    clustering_method_used: str,
    topics_json: List[Dict[str, Any]],
    hours_per_week: float,
    start_date: str,
    target_date: Optional[str] = None,
) -> Plan:
    """Orchestrate schedule generation, video assignment, and persistence."""
    # 1. Build video lookup dictionary
    videos_by_id = {
        v.youtube_video_id: {
            "title": v.title,
            "duration_seconds": v.duration_seconds,
            "thumbnail_url": v.thumbnail_url,
        }
        for v in playlist.videos
    }

    # 2. Call scheduler
    schedule = build_schedule(
        topics=topics_json,
        hours_per_week=hours_per_week,
        start_date=start_date,
        target_date=target_date,
    )

    # 3. Assign concrete videos to weekly chunks
    schedule_with_videos = assign_videos_to_weeks(topics_json, schedule, videos_by_id)

    # 4. Persist Plan
    plan_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc)

    plan = Plan(
        id=plan_id,
        playlist_id=playlist.id,
        hours_per_week=hours_per_week,
        start_date=start_date,
        target_date=target_date,
        topics_json=topics_json,
        schedule_json=schedule_with_videos,
        feasible=schedule["feasible"],
        required_hours_per_week=schedule["required_hours_per_week"],
        pace_factor=1.0,
        replan_count=0,
        clustering_method_used=clustering_method_used,
        created_at=now,
        updated_at=now,
    )
    db.add(plan)
    db.commit()
    db.refresh(plan)
    return plan


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

    # Map video_id to completed state
    completed_map = {p.youtube_video_id: p for p in progress_rows if p.completed}

    # Video multiplier lookup from topics_json
    vid_to_mult: Dict[str, float] = {}
    vid_to_duration: Dict[str, int] = {}
    total_videos_count = 0

    # Build lookup from playlist videos or topics
    if plan.playlist and plan.playlist.videos:
        for v in plan.playlist.videos:
            vid_to_duration[v.youtube_video_id] = v.duration_seconds
        total_videos_count = len(plan.playlist.videos)

    for topic in plan.topics_json:
        mult = topic.get("multiplier", 1.5)
        for vid in topic.get("video_ids", []):
            vid_to_mult[vid] = mult

    total_effort_hours = sum(t.get("effort_hours", 0.0) for t in plan.topics_json)

    completed_videos_count = len(completed_map)
    completed_effort_hours = 0.0

    for vid in completed_map:
        dur = vid_to_duration.get(vid, 0)
        mult = vid_to_mult.get(vid, 1.5)
        completed_effort_hours += (dur / 3600.0) * mult

    completed_effort_hours = round(completed_effort_hours, 2)

    percent_complete = 0.0
    if total_effort_hours > 0:
        percent_complete = round(min(100.0, (completed_effort_hours / total_effort_hours) * 100.0), 1)

    # Planned effort hours to date
    planned_effort_hours_to_date = 0.0
    weeks = plan.schedule_json.get("weeks", [])

    for w in weeks:
        w_start = date.fromisoformat(w["start"])
        w_end = date.fromisoformat(w["end"])
        w_hours = float(w.get("hours", 0.0))

        if w_end < today:
            # Past week: fully planned
            planned_effort_hours_to_date += w_hours
        elif w_start <= today <= w_end:
            # Current active week: scale by elapsed days
            total_days = (w_end - w_start).days + 1
            elapsed_days = (today - w_start).days + 1
            fraction = min(1.0, max(0.0, elapsed_days / total_days))
            planned_effort_hours_to_date += w_hours * fraction
        else:
            # Future week
            pass

    planned_effort_hours_to_date = round(planned_effort_hours_to_date, 2)

    # Status determination
    if today < start_date:
        status = "not_started"
    elif total_videos_count > 0 and completed_videos_count == total_videos_count:
        status = "complete"
    else:
        if planned_effort_hours_to_date <= 0.01:
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


def format_plan_response(
    plan: Plan,
    today_str: Optional[str] = None,
) -> Dict[str, Any]:
    """Format full Plan response matching Section 10 specification."""
    progress_info = compute_progress(plan, plan.progress_records, today_str)

    # Merge completed flags into schedule_json weeks
    completed_set = {p.youtube_video_id for p in plan.progress_records if p.completed}
    schedule_copy = copy.deepcopy(plan.schedule_json)
    for w in schedule_copy.get("weeks", []):
        for t in w.get("topics", []):
            for v in t.get("videos", []):
                v["completed"] = v["youtube_video_id"] in completed_set

    # Format playlist summary
    pl = plan.playlist
    pl_data = {
        "youtube_playlist_id": pl.youtube_playlist_id,
        "title": pl.title,
        "channel_title": pl.channel_title,
        "video_count": pl.video_count,
        "total_watch_hours": round(pl.total_seconds / 3600.0, 1),
        "warnings": pl.warnings or [],
    }

    # Format settings
    settings_data = {
        "hours_per_week": plan.hours_per_week,
        "start_date": plan.start_date,
        "target_date": plan.target_date,
    }

    # Format summary
    summary_data = {
        "total_effort_hours": round(sum(t.get("effort_hours", 0.0) for t in plan.topics_json), 2),
        "num_topics": len(plan.topics_json),
        "num_weeks": schedule_copy.get("num_weeks", len(schedule_copy.get("weeks", []))),
        "completion_date": schedule_copy.get("completion_date"),
        "feasible": plan.feasible,
        "required_hours_per_week": plan.required_hours_per_week,
        "pace_factor": plan.pace_factor,
        "replan_count": plan.replan_count,
        "clustering_method_used": plan.clustering_method_used,
    }

    # Format topics summary list
    topics_data = [
        {
            "id": t["id"],
            "name": t["name"],
            "difficulty": t["difficulty"],
            "effort_hours": t["effort_hours"],
            "video_count": t.get("video_count", len(t.get("video_ids", []))),
        }
        for t in plan.topics_json
    ]

    return {
        "id": plan.id,
        "playlist": pl_data,
        "settings": settings_data,
        "summary": summary_data,
        "topics": topics_data,
        "topic_deadlines": schedule_copy.get("topic_deadlines", []),
        "weeks": schedule_copy.get("weeks", []),
        "progress": progress_info,
    }


_UNSET = object()


def replan(
    db: Session,
    plan: Plan,
    hours_per_week: Optional[float] = None,
    target_date: Any = _UNSET,
    start_date: Optional[str] = None,
    adaptive_pace: bool = True,
    today_str: Optional[str] = None,
) -> Plan:
    """Replan remaining uncompleted videos starting from today."""
    if today_str:
        today_date_str = today_str
    else:
        today_date_str = datetime.now(timezone.utc).date().isoformat()

    # 1. Collect completed and incomplete videos
    completed_vids = {p.youtube_video_id for p in plan.progress_records if p.completed}
    all_topic_vids = [vid for t in plan.topics_json for vid in t.get("video_ids", [])]
    incomplete_vids = [vid for vid in all_topic_vids if vid not in completed_vids]

    if not incomplete_vids:
        raise AppError(
            "PLAN_COMPLETE",
            "All videos in this plan are already completed. Nothing left to replan.",
            status_code=409,
        )

    # 2. Adaptive pace computation
    new_pace_factor = plan.pace_factor
    if adaptive_pace:
        completed_with_actual = [
            p for p in plan.progress_records
            if p.completed and p.actual_seconds is not None and p.actual_seconds > 0
        ]
        if len(completed_with_actual) >= 3:
            dur_map = {v.youtube_video_id: v.duration_seconds for v in plan.playlist.videos}
            mult_map = {}
            for t in plan.topics_json:
                for vid in t["video_ids"]:
                    mult_map[vid] = t["multiplier"]

            sum_actual = sum(p.actual_seconds for p in completed_with_actual)
            sum_estimated = sum(
                dur_map.get(p.youtube_video_id, 0) * mult_map.get(p.youtube_video_id, 1.5)
                for p in completed_with_actual
            )
            if sum_estimated > 0:
                ratio = sum_actual / sum_estimated
                new_pace_factor = round(max(0.5, min(2.0, ratio)), 2)

    # 3. Build remaining topics (dropping empty topics)
    dur_map = {v.youtube_video_id: v.duration_seconds for v in plan.playlist.videos}
    remaining_topics: List[Dict[str, Any]] = []

    for topic in plan.topics_json:
        t_incomplete = [v for v in topic["video_ids"] if v not in completed_vids]
        if not t_incomplete:
            continue
        mult = topic["multiplier"]
        raw_seconds = sum(dur_map.get(v, 0) for v in t_incomplete)
        remaining_effort = round(((raw_seconds / 3600.0) * mult) * new_pace_factor, 2)
        remaining_topics.append({
            "id": topic["id"],
            "name": topic["name"],
            "difficulty": topic["difficulty"],
            "multiplier": mult,
            "effort_hours": remaining_effort,
            "video_ids": t_incomplete,
            "video_count": len(t_incomplete),
        })

    # 4. Resolve settings
    effective_start = start_date or today_date_str
    effective_hpw = hours_per_week if hours_per_week is not None else plan.hours_per_week
    effective_target = target_date if target_date is not _UNSET else plan.target_date

    # 5. Build schedule and assign videos
    videos_by_id = {
        v.youtube_video_id: {
            "title": v.title,
            "duration_seconds": v.duration_seconds,
            "thumbnail_url": v.thumbnail_url,
        }
        for v in plan.playlist.videos
    }

    schedule = build_schedule(
        topics=remaining_topics,
        hours_per_week=effective_hpw,
        start_date=effective_start,
        target_date=effective_target,
    )
    schedule_with_videos = assign_videos_to_weeks(remaining_topics, schedule, videos_by_id)

    # 6. Update plan
    plan.hours_per_week = effective_hpw
    plan.start_date = effective_start
    plan.target_date = effective_target
    plan.schedule_json = schedule_with_videos
    plan.feasible = schedule["feasible"]
    plan.required_hours_per_week = schedule["required_hours_per_week"]
    plan.pace_factor = new_pace_factor
    plan.replan_count += 1
    plan.updated_at = datetime.now(timezone.utc)

    db.commit()
    db.refresh(plan)
    return plan
