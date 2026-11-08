
from __future__ import annotations

import respx
from fastapi.testclient import TestClient

from app.main import create_app
from app.mongo import get_database
from app.services.plans import assign_videos_to_weeks
from app.services.scheduler import build_schedule


# ---------------------------------------------------------------------------
# Video assignment invariant tests
# ---------------------------------------------------------------------------


def test_assign_videos_to_weeks_unsplit():
    topics = [
        {
            "id": 1,
            "name": "Topic 1",
            "effort_hours": 3.0,
            "multiplier": 1.5,
            "video_ids": ["v1", "v2"],
        },
        {
            "id": 2,
            "name": "Topic 2",
            "effort_hours": 3.0,
            "multiplier": 1.5,
            "video_ids": ["v3", "v4"],
        },
    ]

    videos_by_id = {
        "v1": {"title": "V1", "duration_seconds": 3600, "thumbnail_url": None},
        "v2": {"title": "V2", "duration_seconds": 3600, "thumbnail_url": None},
        "v3": {"title": "V3", "duration_seconds": 3600, "thumbnail_url": None},
        "v4": {"title": "V4", "duration_seconds": 3600, "thumbnail_url": None},
    }

    schedule = build_schedule(
        topics,
        hours_per_week=6.0,
        start_date="2026-10-12",
    )

    schedule_with_videos = assign_videos_to_weeks(
        topics,
        schedule,
        videos_by_id,
    )

    assigned_videos = [
        video["youtube_video_id"]
        for week in schedule_with_videos["weeks"]
        for topic in week["topics"]
        for video in topic["videos"]
    ]

    assert assigned_videos == ["v1", "v2", "v3", "v4"]


def test_assign_videos_to_weeks_spilled_topic_invariant():
    # Oversized topic: 14 hours of effort split across three weeks.
    # Seven videos, each requiring two hours of effort.
    video_ids = [f"vid_{i}" for i in range(7)]

    videos_by_id = {
        video_id: {
            "title": f"Video {video_id}",
            "duration_seconds": 4800,
            "thumbnail_url": f"http://thumb/{video_id}.jpg",
        }
        for video_id in video_ids
    }

    topics = [
        {
            "id": 1,
            "name": "Deep Dive Topic",
            "effort_hours": 14.0,
            "multiplier": 1.5,
            "video_ids": video_ids,
        }
    ]

    schedule = build_schedule(
        topics,
        hours_per_week=6.0,
        start_date="2026-10-12",
    )

    schedule_with_videos = assign_videos_to_weeks(
        topics,
        schedule,
        videos_by_id,
    )

    # Every video must appear exactly once and in its original order.
    assigned_videos = [
        video["youtube_video_id"]
        for week in schedule_with_videos["weeks"]
        for topic in week["topics"]
        for video in topic["videos"]
    ]

    assert assigned_videos == video_ids
    assert len(assigned_videos) == len(set(assigned_videos))

    # Verify the expected distribution across weekly chunks.
    week1_videos = [
        video["youtube_video_id"]
        for video in schedule_with_videos["weeks"][0]["topics"][0]["videos"]
    ]

    week2_videos = [
        video["youtube_video_id"]
        for video in schedule_with_videos["weeks"][1]["topics"][0]["videos"]
    ]

    week3_videos = [
        video["youtube_video_id"]
        for video in schedule_with_videos["weeks"][2]["topics"][0]["videos"]
    ]

    assert week1_videos == ["vid_0", "vid_1", "vid_2"]
    assert week2_videos == ["vid_3", "vid_4", "vid_5"]
    assert week3_videos == ["vid_6"]


# ---------------------------------------------------------------------------
# POST /api/analyze and GET /api/plans/{id} integration tests
# ---------------------------------------------------------------------------


@respx.mock
def test_analyze_and_get_plan_integration(test_db):
    app = create_app()
    app.dependency_overrides[get_database] = lambda: test_db

    # Mock YouTube playlist details.
    respx.get(
        "https://www.googleapis.com/youtube/v3/playlists"
    ).respond(
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

    # Mock playlist videos.
    items = [
        {
            "contentDetails": {"videoId": f"v_{i}"},
            "snippet": {"title": f"Lesson {i}"},
        }
        for i in range(6)
    ]

    respx.get(
        "https://www.googleapis.com/youtube/v3/playlistItems"
    ).respond(
        json={"items": items}
    )

    # Mock video metadata.
    video_details = [
        {
            "id": f"v_{i}",
            "snippet": {
                "title": f"Lesson {i}",
                "description": f"Details for lesson {i}",
                "liveBroadcastContent": "none",
                "thumbnails": {
                    "medium": {
                        "url": (
                            "https://img.youtube.com/vi/"
                            f"v_{i}/mqdefault.jpg"
                        )
                    }
                },
            },
            "contentDetails": {"duration": "PT30M"},
        }
        for i in range(6)
    ]

    respx.get(
        "https://www.googleapis.com/youtube/v3/videos"
    ).respond(
        json={"items": video_details}
    )

    payload = {
        "playlist_url": (
            "https://www.youtube.com/playlist?"
            "list=PL1234567890123456"
        ),
        "hours_per_week": 4.0,
        "start_date": "2026-10-12",
        "target_date": "2026-11-15",
        "clustering_method": "embeddings",
    }

    with TestClient(app) as client:
        response = client.post("/api/analyze", json=payload)

        assert response.status_code == 201

        plan_data = response.json()

        # Verify the plan response structure.
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

        # Every source video must appear exactly once in the schedule.
        assigned_videos = [
            video["youtube_video_id"]
            for week in plan_data["weeks"]
            for topic in week["topics"]
            for video in topic["videos"]
        ]

        expected_videos = [f"v_{i}" for i in range(6)]

        assert assigned_videos == expected_videos

        # Test GET /api/plans/{id}.
        plan_id = plan_data["id"]

        get_response = client.get(
            f"/api/plans/{plan_id}?today=2026-10-12"
        )

        assert get_response.status_code == 200

        retrieved_data = get_response.json()

        assert retrieved_data["id"] == plan_id
        assert retrieved_data["playlist"]["title"] == (
            "Data Structures Full Course"
        )


def test_get_nonexistent_plan(test_db):
    app = create_app()
    app.dependency_overrides[get_database] = lambda: test_db

    with TestClient(app) as client:
        response = client.get("/api/plans/non-existent-uuid")

    assert response.status_code == 404
    assert response.json()["error"]["code"] == "PLAN_NOT_FOUND"
