"""
Deterministic study scheduler for StudyFlow.

Takes an ordered list of topics (each with an estimated effort in hours) and
packs them into weekly buckets given the student's weekly capacity.

Rules
-----
* Topics stay in playlist order (lectures usually build on each other).
* A topic that fits in a week is never split across weeks.
* A topic bigger than one week's capacity starts on a fresh week and spills
  across consecutive weeks (it is the only case where splitting happens).
* Packing is "next-fit": once a week can't take the next topic, we move on and
  never go back to fill gaps. This keeps the plan in order and easy to read.

No LLM and no network calls in here, so it is fast and fully testable.
"""

from __future__ import annotations

import math
from datetime import date, datetime, timedelta
from typing import Any, Iterable

EPS = 1e-9
HOURS_STEP = 0.25  # granularity for the "required hours per week" search


# --------------------------------------------------------------------------- #
# Helpers
# --------------------------------------------------------------------------- #
def _to_date(value: date | datetime | str) -> date:
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, date):
        return value
    return date.fromisoformat(value)


def _validate(topics: list[dict[str, Any]], hours_per_week: float) -> None:
    if hours_per_week is None or hours_per_week <= 0:
        raise ValueError("hours_per_week must be greater than 0")

    seen: set[Any] = set()
    for t in topics:
        for key in ("id", "name", "effort_hours"):
            if key not in t:
                raise ValueError(f"topic is missing required field '{key}': {t}")
        if t["effort_hours"] < 0:
            raise ValueError(f"topic {t['id']} has negative effort_hours")
        if t["id"] in seen:
            raise ValueError(f"duplicate topic id: {t['id']}")
        seen.add(t["id"])


def _item(topic: dict[str, Any], hours: float, part: int, total_parts: int) -> dict[str, Any]:
    return {
        "topic_id": topic["id"],
        "name": topic["name"],
        "hours": hours,
        "part": part,
        "total_parts": total_parts,
    }


def _pack(topics: Iterable[dict[str, Any]], capacity: float) -> list[dict[str, Any]]:
    """Pack topics into weeks. Returns [{"hours": float, "items": [...]}, ...]."""
    weeks: list[dict[str, Any]] = [{"hours": 0.0, "items": []}]

    def new_week() -> None:
        weeks.append({"hours": 0.0, "items": []})

    for t in topics:
        effort = float(t["effort_hours"])

        if effort > capacity + EPS:
            # Oversized topic: start on a fresh week, spill over consecutive weeks.
            if weeks[-1]["items"]:
                new_week()
            parts = math.ceil(effort / capacity - EPS)
            for part in range(1, parts + 1):
                chunk = capacity if part < parts else effort - capacity * (parts - 1)
                weeks[-1]["items"].append(_item(t, chunk, part, parts))
                weeks[-1]["hours"] += chunk
                if part < parts:
                    new_week()
        else:
            if weeks[-1]["hours"] + effort > capacity + EPS:
                new_week()
            weeks[-1]["items"].append(_item(t, effort, 1, 1))
            weeks[-1]["hours"] += effort

    if not weeks[-1]["items"]:  # empty input
        weeks.pop()
    return weeks


def _min_feasible_hours(topics: list[dict[str, Any]], weeks_available: int) -> float:
    """Smallest weekly capacity (in 0.25h steps) whose packing fits in the time window.

    We search upward from the simple lower bound (total / weeks) because the
    no-split rule can force a bit more than that.
    """
    total = sum(float(t["effort_hours"]) for t in topics)
    if total <= EPS:
        return 0.0
    capacity = max(HOURS_STEP, math.ceil(total / weeks_available / HOURS_STEP) * HOURS_STEP)
    # At capacity >= total everything fits in one week, so this always terminates.
    while len(_pack(topics, capacity)) > weeks_available:
        capacity += HOURS_STEP
    return capacity


# --------------------------------------------------------------------------- #
# Public API
# --------------------------------------------------------------------------- #
def build_schedule(
    topics: list[dict[str, Any]],
    hours_per_week: float,
    start_date: date | datetime | str,
    target_date: date | datetime | str | None = None,
) -> dict[str, Any]:
    """Build a weekly study plan.

    Parameters
    ----------
    topics:
        Ordered list of ``{"id", "name", "effort_hours", "video_ids"?}``.
    hours_per_week:
        How many hours the student can study per week.
    start_date:
        First day of week 1 (ISO string, ``date`` or ``datetime``).
    target_date:
        Optional deadline. When given, the result says whether the plan fits
        and what weekly hours would be needed to make it.

    Returns
    -------
    dict with keys:
        weeks, topic_deadlines, completion_date, total_hours, num_weeks,
        feasible, required_hours_per_week
        (``feasible`` is True and ``required_hours_per_week`` is None when no
        target_date is given, since there is no deadline to miss.)
    """
    _validate(topics, hours_per_week)
    start = _to_date(start_date)
    target = _to_date(target_date) if target_date is not None else None
    if target is not None and target < start:
        raise ValueError("target_date is before start_date")

    packed = _pack(topics, float(hours_per_week))

    # Build week records with dates and per-topic deadlines.
    weeks_out: list[dict[str, Any]] = []
    finish_date: dict[Any, date] = {}
    for i, w in enumerate(packed):
        w_start = start + timedelta(days=7 * i)
        w_end = w_start + timedelta(days=6)
        if target is not None and w_start <= target:
            w_end = min(w_end, target)  # last in-window week stops at the target

        for item in w["items"]:
            if item["part"] == item["total_parts"]:
                finish_date[item["topic_id"]] = w_end

        weeks_out.append(
            {
                "week": i + 1,
                "start": w_start.isoformat(),
                "end": w_end.isoformat(),
                "hours": round(w["hours"], 2),
                "topics": [{**it, "hours": round(it["hours"], 2)} for it in w["items"]],
            }
        )

    topic_deadlines = [
        {"topic_id": t["id"], "name": t["name"], "deadline": finish_date[t["id"]].isoformat()}
        for t in topics
        if t["id"] in finish_date
    ]
    completion_date = weeks_out[-1]["end"] if weeks_out else None
    total_hours = round(sum(float(t["effort_hours"]) for t in topics), 2)

    # Feasibility against the deadline.
    feasible = True
    required: float | None = None
    if target is not None:
        days = (target - start).days + 1
        weeks_available = max(1, math.ceil(days / 7))
        feasible = len(packed) <= weeks_available
        required = _min_feasible_hours(topics, weeks_available)

    return {
        "weeks": weeks_out,
        "topic_deadlines": topic_deadlines,
        "completion_date": completion_date,
        "total_hours": total_hours,
        "num_weeks": len(weeks_out),
        "feasible": feasible,
        "required_hours_per_week": required,
    }


if __name__ == "__main__":
    import json

    demo_topics = [
        {"id": 1, "name": "Arrays & Strings", "effort_hours": 6.5, "video_ids": []},
        {"id": 2, "name": "Linked Lists", "effort_hours": 4.0, "video_ids": []},
        {"id": 3, "name": "Trees", "effort_hours": 9.0, "video_ids": []},
        {"id": 4, "name": "Graphs", "effort_hours": 20.0, "video_ids": []},
    ]
    print(json.dumps(build_schedule(demo_topics, 8, "2026-10-12", "2026-12-20"), indent=2))
