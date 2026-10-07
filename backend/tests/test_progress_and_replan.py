from __future__ import annotations

import pytest
import respx
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.db import Base, get_db
from app.main import create_app


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


@pytest.fixture
def plan_fixture(test_db):
    app = create_app()

    def override_get_db():
        yield test_db

    app.dependency_overrides[get_db] = override_get_db

    with respx.mock:
        respx.get("https://www.googleapis.com/youtube/v3/playlists").respond(
            json={"items": [{"snippet": {"title": "Full CS Course", "channelTitle": "Prof"}}]}
        )
        respx.get("https://www.googleapis.com/youtube/v3/playlistItems").respond(
            json={
                "items": [
                    {"contentDetails": {"videoId": f"v_{i}"}, "snippet": {"title": f"Video {i}"}}
                    for i in range(4)
                ]
            }
        )
        respx.get("https://www.googleapis.com/youtube/v3/videos").respond(
            json={
                "items": [
                    {
                        "id": f"v_{i}",
                        "snippet": {"title": f"Video {i}", "liveBroadcastContent": "none"},
                        "contentDetails": {"duration": "PT30M"},  # 1800s (0.5h) * 1.5 = 0.75h effort
                    }
                    for i in range(4)
                ]
            }
        )

        client = TestClient(app)
        res = client.post(
            "/api/analyze",
            json={
                "playlist_url": "https://www.youtube.com/playlist?list=PL1234567890123456",
                "hours_per_week": 1.5,
                "start_date": "2026-10-12",
                "target_date": "2026-10-26",
                "clustering_method": "embeddings",
            },
        )
        assert res.status_code == 201
        plan_id = res.json()["id"]

    return client, plan_id


def test_progress_patch_and_status_math(plan_fixture):
    client, plan_id = plan_fixture

    # 1. Not started if today < start_date
    res_not_started = client.get(f"/api/plans/{plan_id}?today=2026-10-01")
    assert res_not_started.json()["progress"]["status"] == "not_started"

    # 2. Behind if on week 2 with 0 videos done
    res_behind = client.get(f"/api/plans/{plan_id}?today=2026-10-20")
    assert res_behind.json()["progress"]["status"] == "behind"

    # 3. Update progress for v_0
    patch_res = client.patch(
        f"/api/plans/{plan_id}/progress?today=2026-10-13",
        json={"updates": [{"youtube_video_id": "v_0", "completed": True, "actual_seconds": 1800}]},
    )
    assert patch_res.status_code == 200
    progress = patch_res.json()["progress"]
    assert progress["completed_videos"] == 1
    assert progress["percent_complete"] == 25.0

    # 4. Reject invalid video ID
    bad_res = client.patch(
        f"/api/plans/{plan_id}/progress",
        json={"updates": [{"youtube_video_id": "invalid_id", "completed": True}]},
    )
    assert bad_res.status_code == 422
    assert bad_res.json()["error"]["code"] == "VALIDATION_ERROR"

    # 5. Untick v_0
    untick_res = client.patch(
        f"/api/plans/{plan_id}/progress",
        json={"updates": [{"youtube_video_id": "v_0", "completed": False}]},
    )
    assert untick_res.json()["progress"]["completed_videos"] == 0
    assert untick_res.json()["progress"]["percent_complete"] == 0.0


def test_replan_adaptive_pace_and_completion(plan_fixture):
    client, plan_id = plan_fixture

    # Complete 3 videos with actual_seconds higher than estimated
    # Each video estimated effort is 0.75h = 2700s. We supply 5400s (2x pace ratio).
    client.patch(
        f"/api/plans/{plan_id}/progress",
        json={
            "updates": [
                {"youtube_video_id": "v_0", "completed": True, "actual_seconds": 5400},
                {"youtube_video_id": "v_1", "completed": True, "actual_seconds": 5400},
                {"youtube_video_id": "v_2", "completed": True, "actual_seconds": 5400},
            ]
        },
    )

    # Replan the remaining 1 video (v_3)
    replan_res = client.post(
        f"/api/plans/{plan_id}/replan?today=2026-10-15",
        json={"hours_per_week": 2.0, "adaptive_pace": True},
    )
    assert replan_res.status_code == 200
    data = replan_res.json()
    assert data["summary"]["replan_count"] == 1
    assert data["summary"]["pace_factor"] == 2.0  # Clamped / calculated 2.0

    # Remaining videos in the weeks must only be v_3
    remaining_vids = [
        v["youtube_video_id"]
        for w in data["weeks"]
        for t in w["topics"]
        for v in t["videos"]
    ]
    assert remaining_vids == ["v_3"]

    # Now complete v_3 as well
    client.patch(
        f"/api/plans/{plan_id}/progress?today=2026-10-16",
        json={"updates": [{"youtube_video_id": "v_3", "completed": True}]},
    )

    # Status should now be complete
    get_res = client.get(f"/api/plans/{plan_id}?today=2026-10-16")
    assert get_res.json()["progress"]["status"] == "complete"

    # Attempting to replan with all completed should return 409 PLAN_COMPLETE
    full_replan_res = client.post(
        f"/api/plans/{plan_id}/replan?today=2026-10-16",
        json={},
    )
    assert full_replan_res.status_code == 409
    assert full_replan_res.json()["error"]["code"] == "PLAN_COMPLETE"
