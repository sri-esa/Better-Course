
from datetime import datetime, timezone

import pytest
from pymongo.errors import DuplicateKeyError

from app.models.documents import Clustering, Plan, Playlist, Progress, Video
from app.services.plans import _load_plan
from app.services.clustering import _clustering_from_document


def test_create_and_read_playlist_and_videos(mongo_db):
    playlist = Playlist(
        youtube_playlist_id="PL1234567890",
        title="Intro to CS",
        channel_title="CS Channel",
        video_count=2,
        total_seconds=1200,
    )

    mongo_db.playlists.insert_one(
        {
            "_id": playlist.id,
            "youtube_playlist_id": playlist.youtube_playlist_id,
            "title": playlist.title,
            "channel_title": playlist.channel_title,
            "video_count": playlist.video_count,
            "total_seconds": playlist.total_seconds,
            "warnings": [],
            "fetched_at": playlist.fetched_at,
        }
    )

    videos = [
        Video(
            playlist_id=playlist.id,
            youtube_video_id="v111",
            position=0,
            title="Lesson 1",
            description="Intro",
            duration_seconds=600,
            thumbnail_url="http://example.com/1.jpg",
        ),
        Video(
            playlist_id=playlist.id,
            youtube_video_id="v222",
            position=1,
            title="Lesson 2",
            description="Variables",
            duration_seconds=600,
            thumbnail_url="http://example.com/2.jpg",
        ),
    ]

    mongo_db.videos.insert_many(
        [
            {
                "_id": f"{playlist.id}:{video.youtube_video_id}",
                "playlist_id": playlist.id,
                "youtube_video_id": video.youtube_video_id,
                "position": video.position,
                "title": video.title,
                "description": video.description,
                "duration_seconds": video.duration_seconds,
                "thumbnail_url": video.thumbnail_url,
            }
            for video in videos
        ]
    )

    from app.services.youtube import _playlist_from_mongo

    retrieved = _playlist_from_mongo(
        mongo_db,
        mongo_db.playlists.find_one({"_id": playlist.id}),
    )

    assert retrieved is not None
    assert retrieved.title == "Intro to CS"
    assert len(retrieved.videos) == 2
    assert retrieved.videos[0].title == "Lesson 1"
    assert retrieved.videos[1].title == "Lesson 2"


def test_unique_video_per_playlist_constraint(mongo_db):
    playlist_id = "playlist-unique-test"

    mongo_db.videos.insert_one(
        {
            "_id": "first-video",
            "playlist_id": playlist_id,
            "youtube_video_id": "dup_vid",
            "position": 0,
            "title": "First",
            "description": "",
            "duration_seconds": 300,
        }
    )

    with pytest.raises(DuplicateKeyError):
        mongo_db.videos.insert_one(
            {
                "_id": "second-video",
                "playlist_id": playlist_id,
                "youtube_video_id": "dup_vid",
                "position": 1,
                "title": "Second duplicate",
                "description": "",
                "duration_seconds": 300,
            }
        )


def test_clustering_model(mongo_db):
    playlist_id = "playlist-cluster-test"

    document = {
        "_id": "cluster-test-id",
        "playlist_id": playlist_id,
        "method": "llm",
        "method_used": "llm",
        "videos_hash": "hash123",
        "result_json": {
            "topics": [
                {
                    "name": "Topic 1",
                    "difficulty": "beginner",
                    "start_index": 0,
                    "end_index": 0,
                }
            ]
        },
        "created_at": datetime.now(timezone.utc),
    }

    mongo_db.clusterings.insert_one(document)

    found_document = mongo_db.clusterings.find_one(
        {"playlist_id": playlist_id}
    )

    found = _clustering_from_document(found_document)

    assert isinstance(found, Clustering)
    assert found.method == "llm"
    assert found.result_json["topics"][0]["name"] == "Topic 1"


def test_plan_and_progress(mongo_db):
    playlist_id = "playlist-plan-test"
    plan_id = "plan-test-id"
    now = datetime.now(timezone.utc)

    mongo_db.playlists.insert_one(
        {
            "_id": playlist_id,
            "youtube_playlist_id": "PL_plan",
            "title": "Plan Test",
            "channel_title": "Tester",
            "video_count": 1,
            "total_seconds": 3600,
            "warnings": [],
            "fetched_at": now,
        }
    )

    mongo_db.videos.insert_one(
        {
            "_id": f"{playlist_id}:vid1",
            "playlist_id": playlist_id,
            "youtube_video_id": "vid1",
            "position": 0,
            "title": "Lesson 1",
            "description": "",
            "duration_seconds": 3600,
            "thumbnail_url": None,
        }
    )

    plan = Plan(
        id=plan_id,
        playlist_id=playlist_id,
        hours_per_week=5.0,
        start_date="2026-10-12",
        target_date="2026-10-19",
        topics_json=[
            {
                "id": 1,
                "name": "Topic 1",
                "difficulty": "beginner",
                "effort_hours": 1.5,
                "video_ids": ["vid1"],
            }
        ],
        schedule_json={"weeks": []},
        feasible=True,
        required_hours_per_week=5.0,
        clustering_method_used="llm",
    )

    mongo_db.plans.insert_one(
        {
            "_id": plan.id,
            "playlist_id": plan.playlist_id,
            "hours_per_week": plan.hours_per_week,
            "start_date": plan.start_date,
            "target_date": plan.target_date,
            "topics_json": plan.topics_json,
            "schedule_json": plan.schedule_json,
            "feasible": plan.feasible,
            "required_hours_per_week": plan.required_hours_per_week,
            "pace_factor": plan.pace_factor,
            "replan_count": plan.replan_count,
            "clustering_method_used": plan.clustering_method_used,
            "created_at": now,
            "updated_at": now,
        }
    )

    progress = Progress(
        plan_id=plan_id,
        youtube_video_id="vid1",
        completed=True,
        completed_at=now,
        actual_seconds=3600,
    )

    mongo_db.progress.insert_one(
        {
            "plan_id": progress.plan_id,
            "youtube_video_id": progress.youtube_video_id,
            "completed": progress.completed,
            "completed_at": progress.completed_at,
            "actual_seconds": progress.actual_seconds,
        }
    )

    retrieved_plan = _load_plan(mongo_db, plan_id)

    assert isinstance(retrieved_plan, Plan)
    assert retrieved_plan.id == plan_id
    assert len(retrieved_plan.progress_records) == 1
    assert retrieved_plan.progress_records[0].completed is True
    assert retrieved_plan.progress_records[0].actual_seconds == 3600
