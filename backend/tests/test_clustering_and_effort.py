
from __future__ import annotations

from app.models.documents import Playlist, Video
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


# ---------------------------------------------------------------------------
# Topic validation
# ---------------------------------------------------------------------------


def test_validate_topics_happy_path():
    topics = [
        {
            "name": "Topic 1",
            "difficulty": "beginner",
            "start_index": 0,
            "end_index": 2,
        },
        {
            "name": "Topic 2",
            "difficulty": "intermediate",
            "start_index": 3,
            "end_index": 4,
        },
    ]

    assert validate_topics(topics, 5) == []


def test_validate_topics_gap():
    topics = [
        {"name": "Topic 1", "start_index": 0, "end_index": 2},
        {"name": "Topic 2", "start_index": 4, "end_index": 4},
    ]

    problems = validate_topics(topics, 5)

    assert any("gap or overlap" in problem for problem in problems)


def test_validate_topics_overlap():
    topics = [
        {"name": "Topic 1", "start_index": 0, "end_index": 2},
        {"name": "Topic 2", "start_index": 2, "end_index": 4},
    ]

    problems = validate_topics(topics, 5)

    assert any("gap or overlap" in problem for problem in problems)


def test_validate_topics_wrong_start_and_end():
    topics = [
        {"name": "Topic 1", "start_index": 1, "end_index": 3},
    ]

    problems = validate_topics(topics, 5)

    assert any("start_index must be 0" in problem for problem in problems)
    assert any("end_index must be 4" in problem for problem in problems)


# ---------------------------------------------------------------------------
# LLM clustering
# ---------------------------------------------------------------------------


def test_fake_llm_clustering_different_sizes():
    for size in [1, 5, 50, 300]:
        videos = create_dummy_videos(size)
        client = FakeLLMClient(mode="valid")

        topics, method_used = cluster_with_llm(
            videos=videos,
            playlist_title="Course Title",
            channel_title="Course Channel",
            client=client,
        )

        assert method_used == "llm"
        assert validate_topics(topics, size) == []
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


# ---------------------------------------------------------------------------
# Embeddings and hybrid clustering
# ---------------------------------------------------------------------------


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


# ---------------------------------------------------------------------------
# Effort estimation
# ---------------------------------------------------------------------------


def test_effort_multipliers():
    assert multiplier_for("beginner") == 1.25
    assert multiplier_for("intermediate") == 1.5
    assert multiplier_for("advanced") == 2.0
    assert multiplier_for("unknown") == 1.5


def test_build_topics_effort_calculation():
    videos = [
        {"youtube_video_id": "v1", "duration_seconds": 1800},
        {"youtube_video_id": "v2", "duration_seconds": 1800},
        {"youtube_video_id": "v3", "duration_seconds": 3600},
    ]

    clustering = {
        "topics": [
            {
                "name": "Topic A",
                "difficulty": "beginner",
                "start_index": 0,
                "end_index": 1,
            },
            {
                "name": "Topic B",
                "difficulty": "advanced",
                "start_index": 2,
                "end_index": 2,
            },
        ]
    }

    built = build_topics(clustering, videos)

    assert len(built) == 2

    # Topic 1: 1 hour x 1.25 = 1.25 hours.
    assert built[0]["id"] == 1
    assert built[0]["name"] == "Topic A"
    assert built[0]["effort_hours"] == 1.25
    assert built[0]["video_ids"] == ["v1", "v2"]
    assert built[0]["video_count"] == 2

    # Topic 2: 1 hour x 2.0 = 2 hours.
    assert built[1]["id"] == 2
    assert built[1]["effort_hours"] == 2.0
    assert built[1]["video_ids"] == ["v3"]
    assert built[1]["video_count"] == 1


# ---------------------------------------------------------------------------
# MongoDB clustering cache
# ---------------------------------------------------------------------------


def test_clustering_cache(mock_db):
    playlist = Playlist(
        id="playlist-cache-test",
        youtube_playlist_id="PL_cache_test",
        title="Cache Test",
        channel_title="Cache Channel",
        video_count=4,
        total_seconds=2400,
    )

    playlist.videos = [
        Video(
            playlist_id=playlist.id,
            youtube_video_id=f"vid_{i}",
            position=i,
            title=f"Video {i}",
            description="",
            duration_seconds=600,
        )
        for i in range(4)
    ]

    client = FakeLLMClient(mode="valid")

    # First call: compute and store the clustering result.
    first = get_or_create_clustering(
        mock_db,
        playlist,
        method="llm",
        llm_client=client,
    )

    assert first.method == "llm"
    assert client.call_count == 1

    # Second call: retrieve the cached result without another LLM call.
    second = get_or_create_clustering(
        mock_db,
        playlist,
        method="llm",
        llm_client=client,
    )

    assert second.id == first.id
    assert client.call_count == 1
