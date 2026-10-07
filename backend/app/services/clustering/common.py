from __future__ import annotations

import hashlib
from typing import Any, Dict, List

ALLOWED_DIFFICULTIES = {"beginner", "intermediate", "advanced"}


def hash_videos(video_ids: List[str]) -> str:
    """Compute SHA-256 hash of ordered YouTube video IDs."""
    combined = ",".join(video_ids)
    return hashlib.sha256(combined.encode("utf-8")).hexdigest()


def validate_topics(topics: List[Dict[str, Any]], n_videos: int) -> List[str]:
    """Validate topic breakdown structure, order, contiguous coverage, and fields.

    Returns a list of error strings; empty list indicates valid topics.
    """
    problems: List[str] = []

    if n_videos <= 0:
        problems.append("n_videos must be greater than 0.")
        return problems

    if not topics or not isinstance(topics, list):
        problems.append("Topics must be a non-empty list.")
        return problems

    # Check first start_index
    first_start = topics[0].get("start_index")
    if first_start != 0:
        problems.append(f"First topic start_index must be 0, got {first_start}.")

    # Check last end_index
    last_end = topics[-1].get("end_index")
    if last_end != n_videos - 1:
        problems.append(f"Last topic end_index must be {n_videos - 1}, got {last_end}.")

    expected_next_start = 0
    for i, t in enumerate(topics):
        if not isinstance(t, dict):
            problems.append(f"Topic {i} is not a dictionary.")
            continue

        name = t.get("name")
        if not name or not isinstance(name, str) or not name.strip():
            problems.append(f"Topic {i} must have a non-empty string name.")

        start = t.get("start_index")
        end = t.get("end_index")

        if start is None or not isinstance(start, int):
            problems.append(f"Topic {i} has invalid start_index: {start}.")
            continue
        if end is None or not isinstance(end, int):
            problems.append(f"Topic {i} has invalid end_index: {end}.")
            continue

        if start > end:
            problems.append(f"Topic {i} has start_index {start} > end_index {end}.")

        if start != expected_next_start:
            problems.append(
                f"Topic {i} has start_index {start}, but expected {expected_next_start} (gap or overlap)."
            )

        expected_next_start = end + 1

    return problems


def sanitize_topics(topics: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Sanitize topic names (trim <= 60 chars) and normalize difficulty."""
    sanitized: List[Dict[str, Any]] = []
    for t in topics:
        name = (t.get("name") or "Untitled Topic").strip()
        if len(name) > 60:
            name = name[:57] + "..."

        difficulty = str(t.get("difficulty") or "intermediate").lower().strip()
        if difficulty not in ALLOWED_DIFFICULTIES:
            difficulty = "intermediate"

        summary = (t.get("summary") or "").strip()
        # Summary under 20 words
        summary_words = summary.split()
        if len(summary_words) > 20:
            summary = " ".join(summary_words[:20]) + "..."

        sanitized.append({
            "name": name,
            "difficulty": difficulty,
            "summary": summary,
            "start_index": t["start_index"],
            "end_index": t["end_index"],
        })
    return sanitized
