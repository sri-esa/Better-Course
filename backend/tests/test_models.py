from datetime import datetime, timezone

import pytest
from sqlalchemy import create_engine
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import sessionmaker

from app.db import Base
from app.models.entities import Clustering, Plan, Playlist, Progress, Video


@pytest.fixture
def db_session():
    # In-memory SQLite for testing models
    engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
    Base.metadata.create_all(engine)
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()


def test_create_and_read_playlist_and_videos(db_session):
    pl = Playlist(
        youtube_playlist_id="PL1234567890",
        title="Intro to CS",
        channel_title="CS Channel",
        video_count=2,
        total_seconds=1200,
        warnings=[],
    )
    db_session.add(pl)
    db_session.commit()

    v1 = Video(
        playlist_id=pl.id,
        youtube_video_id="v111",
        position=0,
        title="Lesson 1",
        description="Intro",
        duration_seconds=600,
        thumbnail_url="http://example.com/1.jpg",
    )
    v2 = Video(
        playlist_id=pl.id,
        youtube_video_id="v222",
        position=1,
        title="Lesson 2",
        description="Variables",
        duration_seconds=600,
        thumbnail_url="http://example.com/2.jpg",
    )
    db_session.add_all([v1, v2])
    db_session.commit()

    retrieved = db_session.query(Playlist).filter_by(id=pl.id).first()
    assert retrieved is not None
    assert retrieved.title == "Intro to CS"
    assert len(retrieved.videos) == 2
    assert retrieved.videos[0].title == "Lesson 1"
    assert retrieved.videos[1].title == "Lesson 2"


def test_unique_video_per_playlist_constraint(db_session):
    pl = Playlist(
        youtube_playlist_id="PL111",
        title="Test",
        channel_title="Test",
        video_count=1,
        total_seconds=300,
        warnings=[],
    )
    db_session.add(pl)
    db_session.commit()

    v1 = Video(
        playlist_id=pl.id,
        youtube_video_id="dup_vid",
        position=0,
        title="First",
        description="",
        duration_seconds=300,
    )
    v2 = Video(
        playlist_id=pl.id,
        youtube_video_id="dup_vid",
        position=1,
        title="Second duplicate",
        description="",
        duration_seconds=300,
    )
    db_session.add(v1)
    db_session.commit()

    db_session.add(v2)
    with pytest.raises(IntegrityError):
        db_session.commit()
    db_session.rollback()


def test_clustering_model(db_session):
    pl = Playlist(
        youtube_playlist_id="PL_cluster",
        title="Cluster Test",
        channel_title="Tester",
        video_count=1,
        total_seconds=100,
        warnings=[],
    )
    db_session.add(pl)
    db_session.commit()

    clustering = Clustering(
        playlist_id=pl.id,
        method="llm",
        method_used="llm",
        videos_hash="hash123",
        result_json={"topics": [{"name": "Topic 1", "difficulty": "beginner", "start_index": 0, "end_index": 0}]},
    )
    db_session.add(clustering)
    db_session.commit()

    found = db_session.query(Clustering).filter_by(playlist_id=pl.id).first()
    assert found is not None
    assert found.method == "llm"
    assert found.result_json["topics"][0]["name"] == "Topic 1"


def test_plan_and_progress(db_session):
    pl = Playlist(
        youtube_playlist_id="PL_plan",
        title="Plan Test",
        channel_title="Tester",
        video_count=1,
        total_seconds=3600,
        warnings=[],
    )
    db_session.add(pl)
    db_session.commit()

    plan = Plan(
        playlist_id=pl.id,
        hours_per_week=5.0,
        start_date="2026-10-12",
        target_date="2026-10-19",
        topics_json=[{"id": 1, "name": "Topic 1", "difficulty": "beginner", "effort_hours": 1.5, "video_ids": ["vid1"]}],
        schedule_json={"weeks": []},
        feasible=True,
        required_hours_per_week=5.0,
        clustering_method_used="llm",
    )
    db_session.add(plan)
    db_session.commit()

    progress = Progress(
        plan_id=plan.id,
        youtube_video_id="vid1",
        completed=True,
        completed_at=datetime.now(timezone.utc),
        actual_seconds=3600,
    )
    db_session.add(progress)
    db_session.commit()

    retrieved_plan = db_session.query(Plan).filter_by(id=plan.id).first()
    assert retrieved_plan is not None
    assert len(retrieved_plan.progress_records) == 1
    assert retrieved_plan.progress_records[0].completed is True
    assert retrieved_plan.progress_records[0].actual_seconds == 3600
