from datetime import date

import pytest

from app.services.scheduler import build_schedule

START = "2026-10-12"  # a Monday


def T(tid, hours, name=None):
    return {"id": tid, "name": name or f"Topic {tid}", "effort_hours": hours, "video_ids": []}


def week_ids(plan):
    """[[topic_id, ...], ...] per week, for compact assertions."""
    return [[it["topic_id"] for it in w["topics"]] for w in plan["weeks"]]


# --------------------------------------------------------------------------- #
# Packing
# --------------------------------------------------------------------------- #
def test_simple_packing():
    plan = build_schedule([T(1, 3), T(2, 3), T(3, 3)], hours_per_week=6, start_date=START)
    assert week_ids(plan) == [[1, 2], [3]]
    assert plan["num_weeks"] == 2
    assert plan["total_hours"] == 9


def test_topic_that_fits_is_not_split():
    # 5h leaves 1h free; the 4h topic must move whole to week 2, not be split.
    plan = build_schedule([T(1, 5), T(2, 4)], hours_per_week=6, start_date=START)
    assert week_ids(plan) == [[1], [2]]
    for w in plan["weeks"]:
        for it in w["topics"]:
            assert it["part"] == 1 and it["total_parts"] == 1


def test_exact_capacity_fits_in_one_week():
    plan = build_schedule([T(1, 4), T(2, 2)], hours_per_week=6, start_date=START)
    assert plan["num_weeks"] == 1
    assert plan["weeks"][0]["hours"] == 6


def test_float_noise_does_not_create_extra_week():
    # 0.1 + 0.2 + 0.3 is 0.6000000000000001 in floating point.
    plan = build_schedule([T(1, 0.1), T(2, 0.2), T(3, 0.3)], hours_per_week=0.6, start_date=START)
    assert plan["num_weeks"] == 1


def test_zero_effort_topic_is_kept():
    plan = build_schedule([T(1, 0), T(2, 3)], hours_per_week=6, start_date=START)
    assert week_ids(plan) == [[1, 2]]


def test_order_is_preserved():
    topics = [T(i, h) for i, h in enumerate([2, 5, 1, 4, 3, 6, 2], start=1)]
    plan = build_schedule(topics, hours_per_week=6, start_date=START)
    flat = [tid for week in week_ids(plan) for tid in week]
    assert flat == [1, 2, 3, 4, 5, 6, 7]


def test_weeks_never_exceed_capacity_and_hours_are_conserved():
    hours = [1.1, 7.3, 2.2, 15.5, 0.4, 3.9, 6.0, 9.9]
    topics = [T(i, h) for i, h in enumerate(hours, start=1)]
    plan = build_schedule(topics, hours_per_week=6, start_date=START)

    for w in plan["weeks"]:
        assert w["hours"] <= 6 + 1e-6
    scheduled = sum(it["hours"] for w in plan["weeks"] for it in w["topics"])
    assert scheduled == pytest.approx(sum(hours), abs=0.05)


# --------------------------------------------------------------------------- #
# Oversized topics
# --------------------------------------------------------------------------- #
def test_oversized_topic_spills_across_weeks():
    plan = build_schedule([T(1, 14)], hours_per_week=6, start_date=START)
    assert plan["num_weeks"] == 3
    parts = [(it["part"], it["total_parts"], it["hours"]) for w in plan["weeks"] for it in w["topics"]]
    assert parts == [(1, 3, 6), (2, 3, 6), (3, 3, 2)]
    # Deadline is the end of the LAST part.
    assert plan["topic_deadlines"][0]["deadline"] == plan["weeks"][2]["end"]


def test_oversized_topic_starts_on_fresh_week():
    plan = build_schedule([T(1, 2), T(2, 14)], hours_per_week=6, start_date=START)
    assert week_ids(plan) == [[1], [2], [2], [2]]
    assert plan["weeks"][0]["hours"] == 2


def test_next_topic_can_share_the_last_week_of_an_oversized_one():
    plan = build_schedule([T(1, 14), T(2, 3)], hours_per_week=6, start_date=START)
    assert week_ids(plan) == [[1], [1], [1, 2]]
    assert plan["weeks"][2]["hours"] == 5


# --------------------------------------------------------------------------- #
# Dates and deadlines
# --------------------------------------------------------------------------- #
def test_week_dates_are_consecutive_seven_day_blocks():
    plan = build_schedule([T(1, 5), T(2, 5)], hours_per_week=6, start_date=START)
    assert plan["weeks"][0]["start"] == "2026-10-12"
    assert plan["weeks"][0]["end"] == "2026-10-18"
    assert plan["weeks"][1]["start"] == "2026-10-19"
    assert plan["completion_date"] == "2026-10-25"


def test_topic_deadlines_are_end_of_their_week():
    plan = build_schedule([T(1, 3), T(2, 3), T(3, 3)], hours_per_week=6, start_date=START)
    deadlines = {d["topic_id"]: d["deadline"] for d in plan["topic_deadlines"]}
    assert deadlines == {1: "2026-10-18", 2: "2026-10-18", 3: "2026-10-25"}


def test_accepts_date_objects():
    plan = build_schedule(
        [T(1, 3)], hours_per_week=6, start_date=date(2026, 10, 12), target_date=date(2026, 12, 20)
    )
    assert plan["weeks"][0]["start"] == "2026-10-12"


# --------------------------------------------------------------------------- #
# Feasibility
# --------------------------------------------------------------------------- #
def test_feasible_when_plan_fits_before_target():
    plan = build_schedule([T(1, 6), T(2, 6)], hours_per_week=6, start_date=START, target_date="2026-10-25")
    assert plan["feasible"] is True
    assert plan["required_hours_per_week"] == 6.0


def test_infeasible_reports_required_hours():
    # 3 x 6h topics, only 2 weeks. Lower bound is 9h/week, but because topics
    # aren't split, 12h/week is what is actually needed ([6,6] + [6]).
    topics = [T(1, 6), T(2, 6), T(3, 6)]
    plan = build_schedule(topics, hours_per_week=6, start_date=START, target_date="2026-10-25")
    assert plan["feasible"] is False
    assert plan["required_hours_per_week"] == 12.0


def test_required_hours_actually_makes_the_plan_feasible():
    topics = [T(1, 6), T(2, 6), T(3, 6)]
    first = build_schedule(topics, hours_per_week=6, start_date=START, target_date="2026-10-25")
    retry = build_schedule(
        topics, hours_per_week=first["required_hours_per_week"], start_date=START, target_date="2026-10-25"
    )
    assert retry["feasible"] is True


def test_no_target_means_no_deadline_to_miss():
    plan = build_schedule([T(1, 50)], hours_per_week=5, start_date=START)
    assert plan["feasible"] is True
    assert plan["required_hours_per_week"] is None


def test_last_in_window_week_is_clipped_to_target():
    plan = build_schedule([T(1, 3)], hours_per_week=6, start_date=START, target_date="2026-10-15")
    assert plan["weeks"][0]["end"] == "2026-10-15"
    assert plan["completion_date"] == "2026-10-15"
    assert plan["feasible"] is True


def test_overrun_weeks_are_not_clipped():
    topics = [T(1, 6), T(2, 6), T(3, 6)]
    plan = build_schedule(topics, hours_per_week=6, start_date=START, target_date="2026-10-25")
    assert plan["weeks"][1]["end"] == "2026-10-25"  # last in-window week
    assert plan["weeks"][2]["start"] == "2026-10-26"  # overrun week, past target
    assert plan["completion_date"] == "2026-11-01"


# --------------------------------------------------------------------------- #
# Empty input
# --------------------------------------------------------------------------- #
def test_empty_topics():
    plan = build_schedule([], hours_per_week=6, start_date=START)
    assert plan["weeks"] == []
    assert plan["topic_deadlines"] == []
    assert plan["completion_date"] is None
    assert plan["num_weeks"] == 0
    assert plan["total_hours"] == 0
    assert plan["feasible"] is True


def test_empty_topics_with_target():
    plan = build_schedule([], hours_per_week=6, start_date=START, target_date="2026-12-20")
    assert plan["feasible"] is True
    assert plan["required_hours_per_week"] == 0.0


# --------------------------------------------------------------------------- #
# Validation
# --------------------------------------------------------------------------- #
@pytest.mark.parametrize("bad", [0, -3, None])
def test_rejects_bad_hours_per_week(bad):
    with pytest.raises(ValueError):
        build_schedule([T(1, 3)], hours_per_week=bad, start_date=START)


def test_rejects_negative_effort():
    with pytest.raises(ValueError):
        build_schedule([T(1, -1)], hours_per_week=6, start_date=START)


def test_rejects_duplicate_topic_ids():
    with pytest.raises(ValueError):
        build_schedule([T(1, 3), T(1, 2)], hours_per_week=6, start_date=START)


def test_rejects_topic_missing_fields():
    with pytest.raises(ValueError):
        build_schedule([{"id": 1, "name": "No effort"}], hours_per_week=6, start_date=START)


def test_rejects_target_before_start():
    with pytest.raises(ValueError):
        build_schedule([T(1, 3)], hours_per_week=6, start_date=START, target_date="2026-10-01")
