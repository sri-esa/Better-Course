from __future__ import annotations

import pytest
import respx
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.db import Base, get_db
from app.main import create_app
from app.services.plans import assign_videos_to_weeks
from app.services.scheduler import build_schedule

# --------------------------------------------------------------------------- #
# Video Assignment Invariant Tests
# --------------------------------------------------------------------------- #

def test_assign_videos_to_weeks_unsplit():
    topics = [
        {"id": 1, "name": "Topic 1", "effort_hours": 3.0, "multiplier": 1.5, "video_ids": ["v1", "v2"]},
        {"id": 2, "name": "Topic 2", "effort_hours": 3.0, "multiplier": 1.5, "video_ids": ["v3", "v4"]},
    ]
    videos_by_id = {
        "v1": {"title": "V1", "duration_seconds": 3600, "thumbnail_url": None},
        "v2": {"title": "V2", "duration_seconds": 3600, "thumbnail_url": None},
        "v3": {"title": "V3", "duration_seconds": 3600, "thumbnail_url": None},
        "v4": {"title": "V4", "duration_seconds": 3600, "thumbnail_url": None},
    }
    sched = build_schedule(topics, hours_per_week=6.0, start_date="2026-10-12")
    sched_with_vids = assign_videos_to_weeks(topics, sched, videos_by_id)

    flat_vids = [
        v["youtube_video_id"]
        for w in sched_with_vids["weeks"]
        for t in w["topics"]
        for v in t["videos"]
    ]
    assert flat_vids == ["v1", "v2", "v3", "v4"]


def test_assign_videos_to_weeks_spilled_topic_invariant():
    # Oversized topic: 14 hours effort split across 3 weeks (capacity 6h)
    # 7 videos of 2h effort each (duration 4800s * 1.5 = 7200s = 2h)
    video_ids = [f"vid_{i}" for i in range(7)]
    videos_by_id = {
        vid: {"title": f"Video {vid}", "duration_seconds": 4800, "thumbnail_url": f"http://thumb/{vid}.jpg"}
        for vid in video_ids
    }
    topics = [
        {"id": 1, "name": "Deep Dive Topic", "effort_hours": 14.0, "multiplier": 1.5, "video_ids": video_ids}
    ]
    sched = build_schedule(topics, hours_per_week=6.0, start_date="2026-10-12")
    sched_with_vids = assign_videos_to_weeks(topics, sched, videos_by_id)

    # Invariant: Every video appears exactly once across weeks, in exact order
    flat_vids = [
        v["youtube_video_id"]
        for w in sched_with_vids["weeks"]
        for t in w["topics"]
        for v in t["videos"]
    ]
    assert flat_vids == video_ids
    assert len(flat_vids) == len(set(flat_vids))

    # Verify distribution across chunks:
    # Week 1 capacity 6h -> covers vid_0 (0h), vid_1 (2h), vid_2 (4h) -> 3 videos
    # Week 2 capacity 6h -> covers vid_3 (6h), vid_4 (8h), vid_5 (10h) -> 3 videos
    # Week 3 remainder 2h -> covers vid_6 (12h) -> 1 video
    week1_vids = [v["youtube_video_id"] for v in sched_with_vids["weeks"][0]["topics"][0]["videos"]]
    week2_vids = [v["youtube_video_id"] for v in sched_with_vids["weeks"][1]["topics"][0]["videos"]]
    week3_vids = [v["youtube_video_id"] for v in sched_with_vids["weeks"][2]["topics"][0]["videos"]]
    assert week1_vids == ["vid_0", "vid_1", "vid_2"]
    assert week2_vids == ["vid_3", "vid_4", "vid_5"]
    assert week3_vids == ["vid_6"]


# --------------------------------------------------------------------------- #
# Integration Tests for POST /api/analyze and GET /api/plans/{id}
# --------------------------------------------------------------------------- #

@pytest.fixture
def test_db():
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    TestingSession = sessionmaker(bind=engine)
    session = TestingSession()
    try:
        yield session
    finally:
        session.close()


@respx.mock
def test_analyze_and_get_plan_integration(test_db):
    app = create_app()

    def override_get_db():
        yield test_db

    app.dependency_overrides[get_db] = override_get_db

    # Mock YouTube API
    respx.get("https://www.googleapis.com/youtube/v3/playlists").respond(
        json={
            "items": [
                {
                    "snippet": {
                        "title": "Data Structures Full Course",
                        "channelTitle": "Code Academy",
                    }
                }
            ]
        }
    )

    items = [
        {"contentDetails": {"videoId": f"v_{i}"}, "snippet": {"title": f"Lesson {i}"}}
        for i in range(6)
    ]
    respx.get("https://www.googleapis.com/youtube/v3/playlistItems").respond(
        json={"items": items}
    )

    v_details = [
        {
            "id": f"v_{i}",
            "snippet": {
                "title": f"Lesson {i}",
                "description": f"Details for lesson {i}",
                "liveBroadcastContent": "none",
                "thumbnails": {"medium": {"url": f"https://img.youtube.com/vi/v_{i}/mqdefault.jpg"}},
            },
            "contentDetails": {"duration": "PT30M"},  # 1800s each -> total 3h watch time
        }
        for i in range(6)
    ]
    respx.get("https://www.googleapis.com/youtube/v3/videos").respond(
        json={"items": v_details}
    )

    client = TestClient(app)
    payload = {
        "playlist_url": "https://www.youtube.com/playlist?list=PL1234567890123456",
        "hours_per_week": 4.0,
        "start_date": "2026-10-12",
        "target_date": "2026-11-15",
        "clustering_method": "embeddings",
    }
    response = client.post("/api/analyze", json=payload)
    assert response.status_code == 201
    plan_data = response.json()

    # Verify Plan Object matches Section 10 specification
    assert "id" in plan_data
    assert plan_data["playlist"]["title"] == "Data Structures Full Course"
    assert plan_data["playlist"]["video_count"] == 6
    assert plan_data["playlist"]["total_watch_hours"] == 3.0
    assert plan_data["settings"]["hours_per_week"] == 4.0
    assert plan_data["settings"]["start_date"] == "2026-10-12"
    assert plan_data["settings"]["target_date"] == "2026-11-15"

    assert "summary" in plan_data
    assert plan_data["summary"]["feasible"] is True
    assert plan_data["summary"]["clustering_method_used"] == "embeddings"

    assert len(plan_data["topics"]) >= 1
    assert len(plan_data["weeks"]) >= 1
    assert "progress" in plan_data
    assert plan_data["progress"]["total_videos"] == 6
    assert plan_data["progress"]["completed_videos"] == 0
    assert plan_data["progress"]["percent_complete"] == 0.0

    # Invariant check on API response: every video appears exactly once across weeks
    all_response_videos = [
        v["youtube_video_id"]
        for w in plan_data["weeks"]
        for t in w["topics"]
        for v in t["videos"]
    ]
    expected_vids = [f"v_{i}" for i in range(6)]
    assert all_response_videos == expected_vids

    # Test GET /api/plans/{id}
    plan_id = plan_data["id"]
    get_res = client.get(f"/api/plans/{plan_id}?today=2026-10-12")
    assert get_res.status_code == 200
    retrieved_data = get_res.json()
    assert retrieved_data["id"] == plan_id
    assert retrieved_data["playlist"]["title"] == "Data Structures Full Course"


def test_get_nonexistent_plan(test_db):
    app = create_app()

    def override_get_db():
        yield test_db

    app.dependency_overrides[get_db] = override_get_db

    client = TestClient(app)
    res = client.get("/api/plans/non-existent-uuid")
    assert res.status_code == 404
    assert res.json()["error"]["code"] == "PLAN_NOT_FOUND"
