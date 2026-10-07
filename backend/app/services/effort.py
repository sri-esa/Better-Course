from __future__ import annotations

from typing import Any, Dict, List

from app.config import get_settings


def multiplier_for(difficulty: str) -> float:
    """Return effort multiplier for a difficulty level from config."""
    settings = get_settings()
    d = (difficulty or "").lower().strip()
    if d == "beginner":
        return settings.EFFORT_MULT_BEGINNER
    elif d == "advanced":
        return settings.EFFORT_MULT_ADVANCED
    else:  # default intermediate
        return settings.EFFORT_MULT_INTERMEDIATE


def build_topics(clustering: Dict[str, Any], videos: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Build topic snapshots with multipliers, effort_hours, and video_ids.

    Assigns 1-based integer IDs to topics.
    """
    raw_topics = clustering.get("topics", [])
    built: List[Dict[str, Any]] = []

    for i, t in enumerate(raw_topics, start=1):
        diff = t.get("difficulty", "intermediate")
        mult = multiplier_for(diff)
        s_idx = t["start_index"]
        e_idx = t["end_index"]

        topic_videos = videos[s_idx : e_idx + 1]
        v_ids = [v["youtube_video_id"] for v in topic_videos]
        total_seconds = sum(v.get("duration_seconds", 0) for v in topic_videos)
        effort_hours = round((total_seconds / 3600.0) * mult, 2)

        built.append({
            "id": i,
            "name": t.get("name", f"Topic {i}"),
            "difficulty": diff,
            "multiplier": mult,
            "effort_hours": effort_hours,
            "video_ids": v_ids,
            "video_count": len(v_ids),
        })

    return built
