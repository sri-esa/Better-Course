
from __future__ import annotations

import pytest
import respx
from fastapi.testclient import TestClient

from app.main import create_app
from app.mongo import get_database


@pytest.fixture
def plan_fixture(test_db):
    app = create_app()
    app.dependency_overrides[get_database] = lambda: test_db

    with respx.mock:
        respx.get(
            "https://www.googleapis.com/youtube/v3/playlists"
        ).respond(
            json={
                "items": [
                    {
                        "snippet": {
                            "title": "Full CS Course",
                            "channelTitle": "Prof",
                        }
                    }
                ]
            }
        )

        respx.get(
            "https://www.googleapis.com/youtube/v3/playlistItems"
        ).respond(
            json={
                "items": [
                    {
                        "contentDetails": {"videoId": f"v_{i}"},
                        "snippet": {"title": f"Video {i}"},
                    }
                    for i in range(4)
                ]
            }
        )

        respx.get(
            "https://www.googleapis.com/youtube/v3/videos"
        ).respond(
            json={
                "items": [
                    {
                        "id": f"v_{i}",
                        "snippet": {
                            "title": f"Video {i}",
                            "liveBroadcastContent": "none",
                        },
                        "contentDetails": {"duration": "PT30M"},
                    }
                    for i in range(4)
                ]
            }
        )

        with TestClient(app) as client:
            response = client.post(
                "/api/analyze",
                json={
                    "playlist_url": (
                        "https://www.youtube.com/playlist?"
                        "list=PL1234567890123456"
                    ),
                    "hours_per_week": 1.5,
                    "start_date": "2026-10-12",
                    "target_date": "2026-10-26",
                    "clustering_method": "embeddings",
                },
            )

            assert response.status_code == 201, response.text

            plan_id = response.json()["id"]

            yield client, plan_id


# ---------------------------------------------------------------------------
# Progress updates and status calculations
# ---------------------------------------------------------------------------


def test_progress_patch_and_status_math(plan_fixture):
    client, plan_id = plan_fixture

    # 1. Plan has not started before its start date.
    response = client.get(
        f"/api/plans/{plan_id}?today=2026-10-01"
    )

    assert response.status_code == 200
    assert response.json()["progress"]["status"] == "not_started"

    # 2. No videos completed by the second week: status should be behind.
    response = client.get(
        f"/api/plans/{plan_id}?today=2026-10-20"
    )

    assert response.status_code == 200
    assert response.json()["progress"]["status"] == "behind"

    # 3. Mark the first video as completed.
    patch_response = client.patch(
        f"/api/plans/{plan_id}/progress?today=2026-10-13",
        json={
            "updates": [
                {
                    "youtube_video_id": "v_0",
                    "completed": True,
                    "actual_seconds": 1800,
                }
            ]
        },
    )

    assert patch_response.status_code == 200

    progress = patch_response.json()["progress"]

    assert progress["completed_videos"] == 1
    assert progress["percent_complete"] == 25.0

    # 4. Reject a video that does not belong to this plan.
    bad_response = client.patch(
        f"/api/plans/{plan_id}/progress",
        json={
            "updates": [
                {
                    "youtube_video_id": "invalid_id",
                    "completed": True,
                }
            ]
        },
    )

    assert bad_response.status_code == 422
    assert bad_response.json()["error"]["code"] == "VALIDATION_ERROR"

    # 5. Untick v_0 and verify progress is reversed.
    untick_response = client.patch(
        f"/api/plans/{plan_id}/progress",
        json={
            "updates": [
                {
                    "youtube_video_id": "v_0",
                    "completed": False,
                }
            ]
        },
    )

    assert untick_response.status_code == 200

    progress = untick_response.json()["progress"]

    assert progress["completed_videos"] == 0
    assert progress["percent_complete"] == 0.0


# ---------------------------------------------------------------------------
# Adaptive pace replanning and completion
# ---------------------------------------------------------------------------


def test_replan_adaptive_pace_and_completion(plan_fixture):
    client, plan_id = plan_fixture

    # Complete three videos with actual time twice the estimated effort.
    progress_response = client.patch(
        f"/api/plans/{plan_id}/progress",
        json={
            "updates": [
                {
                    "youtube_video_id": f"v_{i}",
                    "completed": True,
                    "actual_seconds": 5400,
                }
                for i in range(3)
            ]
        },
    )

    assert progress_response.status_code == 200
    assert progress_response.json()["progress"]["completed_videos"] == 3

    # Replan the remaining video, v_3.
    replan_response = client.post(
        f"/api/plans/{plan_id}/replan?today=2026-10-15",
        json={
            "hours_per_week": 2.0,
            "adaptive_pace": True,
        },
    )

    assert replan_response.status_code == 200, replan_response.text

    data = replan_response.json()

    assert data["summary"]["replan_count"] == 1
    assert data["summary"]["pace_factor"] == 2.0

    remaining_videos = [
        video["youtube_video_id"]
        for week in data["weeks"]
        for topic in week["topics"]
        for video in topic["videos"]
    ]

    assert remaining_videos == ["v_3"]

    # Complete the final video.
    final_progress_response = client.patch(
        f"/api/plans/{plan_id}/progress?today=2026-10-16",
        json={
            "updates": [
                {
                    "youtube_video_id": "v_3",
                    "completed": True,
                }
            ]
        },
    )

    assert final_progress_response.status_code == 200

    # All four videos are now complete.
    get_response = client.get(
        f"/api/plans/{plan_id}?today=2026-10-16"
    )

    assert get_response.status_code == 200
    assert get_response.json()["progress"]["status"] == "complete"

    # Replanning a completed plan must return 409.
    full_replan_response = client.post(
        f"/api/plans/{plan_id}/replan?today=2026-10-16",
        json={},
    )

    assert full_replan_response.status_code == 409
    assert full_replan_response.json()["error"]["code"] == "PLAN_COMPLETE"
