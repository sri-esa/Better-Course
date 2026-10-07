from __future__ import annotations

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.db import Base
from app.models.entities import Playlist, Video
from app.services.clustering import (
    cluster_hybrid,
    cluster_with_embeddings,
    cluster_with_llm,
    get_or_create_clustering,
)
from app.services.clustering.common import validate_topics
from app.services.effort import build_topics, multiplier_for
from app.services.llm.fake import FakeLLMClient


def create_dummy_videos(n: int, duration_per_video: int = 600) -> list[dict]:
    return [
        {
            "position": i,
            "title": f"Video {i} Title",
            "description": f"Description for video {i}",
            "duration_seconds": duration_per_video,
            "youtube_video_id": f"vid_{i}",
        }
        for i in range(n)
    ]


# --------------------------------------------------------------------------- #
# Validation Tests
# --------------------------------------------------------------------------- #

def test_validate_topics_happy_path():
    topics = [
        {"name": "Topic 1", "difficulty": "beginner", "start_index": 0, "end_index": 2},
        {"name": "Topic 2", "difficulty": "intermediate", "start_index": 3, "end_index": 4},
    ]
    problems = validate_topics(topics, 5)
    assert problems == []


def test_validate_topics_gap():
    topics = [
        {"name": "Topic 1", "start_index": 0, "end_index": 2},
        {"name": "Topic 2", "start_index": 4, "end_index": 4},  # gap at 3
    ]
    problems = validate_topics(topics, 5)
    assert any("gap or overlap" in p for p in problems)


def test_validate_topics_overlap():
    topics = [
        {"name": "Topic 1", "start_index": 0, "end_index": 2},
        {"name": "Topic 2", "start_index": 2, "end_index": 4},  # overlap at 2
    ]
    problems = validate_topics(topics, 5)
    assert any("gap or overlap" in p for p in problems)


def test_validate_topics_wrong_start_and_end():
    topics = [
        {"name": "Topic 1", "start_index": 1, "end_index": 3},
    ]
    problems = validate_topics(topics, 5)
    assert any("start_index must be 0" in p for p in problems)
    assert any("end_index must be 4" in p for p in problems)


# --------------------------------------------------------------------------- #
# LLM Clusterer Tests (Sizes 1, 5, 50, 300)
# --------------------------------------------------------------------------- #

@pytest.mark.parametrize("size", [1, 5, 50, 300])
def test_fake_llm_clustering_different_sizes(size):
    videos = create_dummy_videos(size)
    client = FakeLLMClient(mode="valid")
    topics, method_used = cluster_with_llm(
        videos=videos,
        playlist_title="Course Title",
        channel_title="Course Channel",
        client=client,
    )
    assert method_used == "llm"
    problems = validate_topics(topics, size)
    assert problems == []
    # Verify continuous coverage
    assert topics[0]["start_index"] == 0
    assert topics[-1]["end_index"] == size - 1


def test_llm_clustering_retry_success():
    videos = create_dummy_videos(8)
    client = FakeLLMClient(mode="fail_once")
    topics, method_used = cluster_with_llm(
        videos=videos,
        playlist_title="Test Course",
        channel_title="Channel",
        client=client,
    )
    assert method_used == "llm"
    assert client.call_count == 2
    assert validate_topics(topics, 8) == []


def test_llm_clustering_fallback_to_embeddings_on_persistent_failure():
    videos = create_dummy_videos(10)
    client = FakeLLMClient(mode="raise_error")
    topics, method_used = cluster_with_llm(
        videos=videos,
        playlist_title="Failing LLM",
        channel_title="Channel",
        client=client,
    )
    assert method_used == "embeddings"
    assert validate_topics(topics, 10) == []


# --------------------------------------------------------------------------- #
# Embeddings and Hybrid Tests
# --------------------------------------------------------------------------- #

def test_embedding_clustering_contiguity():
    videos = create_dummy_videos(15)
    topics = cluster_with_embeddings(videos)
    assert validate_topics(topics, 15) == []


def test_hybrid_clustering():
    videos = create_dummy_videos(12)
    client = FakeLLMClient(mode="valid")
    topics, method_used = cluster_hybrid(
        videos=videos,
        playlist_title="Hybrid Course",
        channel_title="Hybrid Channel",
        client=client,
    )
    assert method_used == "hybrid"
    assert validate_topics(topics, 12) == []


# --------------------------------------------------------------------------- #
# Effort Estimation Tests
# --------------------------------------------------------------------------- #

def test_effort_multipliers():
    assert multiplier_for("beginner") == 1.25
    assert multiplier_for("intermediate") == 1.5
    assert multiplier_for("advanced") == 2.0
    assert multiplier_for("unknown") == 1.5


def test_build_topics_effort_calculation():
    videos = [
        {"youtube_video_id": "v1", "duration_seconds": 1800},  # 0.5h
        {"youtube_video_id": "v2", "duration_seconds": 1800},  # 0.5h -> Total 1.0h
        {"youtube_video_id": "v3", "duration_seconds": 3600},  # 1.0h
    ]
    clustering = {
        "topics": [
            {"name": "Topic A", "difficulty": "beginner", "start_index": 0, "end_index": 1},
            {"name": "Topic B", "difficulty": "advanced", "start_index": 2, "end_index": 2},
        ]
    }
    built = build_topics(clustering, videos)
    assert len(built) == 2
    # Topic 1: 1.0h * 1.25 = 1.25
    assert built[0]["id"] == 1
    assert built[0]["name"] == "Topic A"
    assert built[0]["effort_hours"] == 1.25
    assert built[0]["video_ids"] == ["v1", "v2"]
    assert built[0]["video_count"] == 2

    # Topic 2: 1.0h * 2.0 = 2.0
    assert built[1]["id"] == 2
    assert built[1]["effort_hours"] == 2.0
    assert built[1]["video_ids"] == ["v3"]
    assert built[1]["video_count"] == 1


# --------------------------------------------------------------------------- #
# Clustering Cache Integration
# --------------------------------------------------------------------------- #

def test_clustering_cache(monkeypatch):
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    Session = sessionmaker(bind=engine)
    session = Session()

    pl = Playlist(
        youtube_playlist_id="PL_cache_test",
        title="Cache Test",
        channel_title="Cache Channel",
        video_count=4,
        total_seconds=2400,
        warnings=[],
    )
    session.add(pl)
    session.flush()

    for i in range(4):
        v = Video(
            playlist_id=pl.id,
            youtube_video_id=f"vid_{i}",
            position=i,
            title=f"Video {i}",
            description="",
            duration_seconds=600,
        )
        session.add(v)
    session.commit()
    session.refresh(pl)

    client = FakeLLMClient(mode="valid")
    # First call: computes and stores
    c1 = get_or_create_clustering(session, pl, method="llm", llm_client=client)
    assert c1.method == "llm"
    assert client.call_count == 1

    # Second call: returns cached row without calling LLM again
    c2 = get_or_create_clustering(session, pl, method="llm", llm_client=client)
    assert c2.id == c1.id
    assert client.call_count == 1  # Not called again
