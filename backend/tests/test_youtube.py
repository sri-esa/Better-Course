import httpx
import pytest
import respx
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.db import Base, get_db
from app.errors import AppError
from app.main import create_app
from app.services.youtube import (
    YouTubeService,
    get_or_fetch_playlist,
    parse_iso8601_duration,
    parse_playlist_id,
)

# --------------------------------------------------------------------------- #
# URL and Duration Parsing
# --------------------------------------------------------------------------- #

@pytest.mark.parametrize(
    "valid_input,expected_id",
    [
        ("PL1234567890123456", "PL1234567890123456"),
        ("https://www.youtube.com/playlist?list=PL1234567890123456", "PL1234567890123456"),
        ("https://youtube.com/playlist?list=PL1234567890123456", "PL1234567890123456"),
        ("https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=PL1234567890123456", "PL1234567890123456"),
        ("https://m.youtube.com/watch?v=dQw4w9WgXcQ&list=PL1234567890123456", "PL1234567890123456"),
        ("https://music.youtube.com/playlist?list=PL1234567890123456", "PL1234567890123456"),
        ("https://youtu.be/dQw4w9WgXcQ?list=PL1234567890123456", "PL1234567890123456"),
    ],
)
def test_parse_playlist_id_valid(valid_input, expected_id):
    assert parse_playlist_id(valid_input) == expected_id


@pytest.mark.parametrize(
    "invalid_input",
    [
        "",
        "   ",
        "https://vimeo.com/123456789",
        "https://www.youtube.com/watch?v=dQw4w9WgXcQ",  # no list param
        "RD1234567890",  # mix
        "https://www.youtube.com/playlist?list=RD1234567890",
        "short",  # too short for bare id
        "https://evil.com/playlist?list=PL1234567890123456",
    ],
)
def test_parse_playlist_id_invalid(invalid_input):
    with pytest.raises(AppError) as exc_info:
        parse_playlist_id(invalid_input)
    assert exc_info.value.code == "INVALID_URL"


@pytest.mark.parametrize(
    "duration_str,expected_seconds",
    [
        ("PT1H2M3S", 3723),
        ("PT45S", 45),
        ("PT10M", 600),
        ("P1DT2H", 93600),
        ("PT1H", 3600),
        ("P0D", 0),
        ("PT0S", 0),
        ("P1D", 86400),
        ("P2DT3H4M5S", 2 * 86400 + 3 * 3600 + 4 * 60 + 5),
    ],
)
def test_parse_iso8601_duration_valid(duration_str, expected_seconds):
    assert parse_iso8601_duration(duration_str) == expected_seconds


@pytest.mark.parametrize(
    "invalid_duration",
    ["", "   ", "PT", "P", "10:00", "invalid", "P1Y", "P1M"],
)
def test_parse_iso8601_duration_invalid(invalid_duration):
    with pytest.raises(ValueError):
        parse_iso8601_duration(invalid_duration)


# --------------------------------------------------------------------------- #
# YouTube API Ingestion, Filtering, and Pagination
# --------------------------------------------------------------------------- #


@pytest.fixture
def mock_db():
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
def test_youtube_pagination_and_filtering(mock_db):
    client = httpx.Client()
    service = YouTubeService(api_key="test_key", client=client)

    # 1. Playlists request
    respx.get("https://www.googleapis.com/youtube/v3/playlists").respond(
        json={
            "items": [
                {
                    "snippet": {
                        "title": "Algorithms 101",
                        "channelTitle": "Tech Academy",
                    }
                }
            ]
        }
    )

    # 2. PlaylistItems request (2 pages)
    page1_items = [{"contentDetails": {"videoId": f"v_{i}"}, "snippet": {"title": f"Video {i}"}} for i in range(50)]
    # Duplicate v_0, private video v_51, live video v_52, zero duration v_53
    page2_items = [
        {"contentDetails": {"videoId": "v_0"}, "snippet": {"title": "Duplicate of Video 0"}},
        {"contentDetails": {"videoId": "v_51"}, "snippet": {"title": "Private video"}},
        {"contentDetails": {"videoId": "v_52"}, "snippet": {"title": "Live Stream"}},
        {"contentDetails": {"videoId": "v_53"}, "snippet": {"title": "Zero Duration"}},
        {"contentDetails": {"videoId": "v_54"}, "snippet": {"title": "Normal Video 54"}},
    ]

    respx.get("https://www.googleapis.com/youtube/v3/playlistItems").side_effect = [
        httpx.Response(200, json={"items": page1_items, "nextPageToken": "page_2"}),
        httpx.Response(200, json={"items": page2_items}),
    ]

    # 3. Videos metadata batching
    # Batch 1 (first 50 videos: v_0..v_49)
    batch1_items = [
        {
            "id": f"v_{i}",
            "snippet": {
                "title": f"Video {i}",
                "description": f"Description for video {i}",
                "liveBroadcastContent": "none",
                "thumbnails": {"medium": {"url": f"https://thumb.url/{i}.jpg"}},
            },
            "contentDetails": {"duration": "PT10M"},  # 600s
        }
        for i in range(50)
    ]

    # Batch 2 (v_51, v_52, v_53, v_54) - notice v_0 was duplicate so not sent or included
    batch2_items = [
        # v_51 is missing from videos response (simulating deleted/unreachable)
        {
            "id": "v_52",
            "snippet": {"title": "Live Stream", "liveBroadcastContent": "live"},
            "contentDetails": {"duration": "PT10M"},
        },
        {
            "id": "v_53",
            "snippet": {"title": "Zero Duration", "liveBroadcastContent": "none"},
            "contentDetails": {"duration": "PT0S"},
        },
        {
            "id": "v_54",
            "snippet": {
                "title": "Normal Video 54",
                "description": "Valid video",
                "liveBroadcastContent": "none",
                "thumbnails": {"medium": {"url": "https://thumb.url/54.jpg"}},
            },
            "contentDetails": {"duration": "PT5M"},  # 300s
        },
    ]

    respx.get("https://www.googleapis.com/youtube/v3/videos").side_effect = [
        httpx.Response(200, json={"items": batch1_items}),
        httpx.Response(200, json={"items": batch2_items}),
    ]

    playlist = get_or_fetch_playlist(mock_db, "PL1234567890123456", service=service)

    assert playlist.title == "Algorithms 101"
    assert playlist.channel_title == "Tech Academy"
    # Kept videos: 50 from page 1 + v_54 from page 2 = 51 videos
    assert playlist.video_count == 51
    assert len(playlist.videos) == 51
    assert playlist.videos[0].youtube_video_id == "v_0"
    assert playlist.videos[0].position == 0
    assert playlist.videos[50].youtube_video_id == "v_54"
    assert playlist.videos[50].position == 50

    # Warnings recorded
    reasons = [w["reason"] for w in playlist.warnings]
    assert "duplicate" in reasons
    assert "private_or_deleted" in reasons
    assert "live_stream" in reasons
    assert "zero_duration" in reasons


@respx.mock
def test_quota_exceeded_error_mapping():
    client = httpx.Client()
    service = YouTubeService(api_key="test_key", client=client)

    respx.get("https://www.googleapis.com/youtube/v3/playlists").respond(
        status_code=403,
        json={
            "error": {
                "errors": [{"reason": "quotaExceeded", "message": "Daily limit exceeded"}]
            }
        },
    )

    with pytest.raises(AppError) as exc_info:
        service.fetch_playlist_details("PL1234567890")
    assert exc_info.value.code == "YOUTUBE_QUOTA_EXCEEDED"
    assert exc_info.value.status_code == 503


@respx.mock
def test_private_playlist_error_mapping():
    client = httpx.Client()
    service = YouTubeService(api_key="test_key", client=client)

    respx.get("https://www.googleapis.com/youtube/v3/playlists").respond(
        status_code=404,
        json={"items": []},
    )

    with pytest.raises(AppError) as exc_info:
        service.fetch_playlist_details("PL1234567890")
    assert exc_info.value.code == "PLAYLIST_NOT_FOUND"


@respx.mock
def test_caching_and_refresh(mock_db):
    client = httpx.Client()
    service = YouTubeService(api_key="test_key", client=client)

    route_pl = respx.get("https://www.googleapis.com/youtube/v3/playlists").respond(
        json={"items": [{"snippet": {"title": "Title 1", "channelTitle": "Channel 1"}}]}
    )
    respx.get("https://www.googleapis.com/youtube/v3/playlistItems").respond(
        json={"items": [{"contentDetails": {"videoId": "vid1"}, "snippet": {"title": "Vid 1"}}]}
    )
    respx.get("https://www.googleapis.com/youtube/v3/videos").respond(
        json={
            "items": [
                {
                    "id": "vid1",
                    "snippet": {"title": "Vid 1", "liveBroadcastContent": "none"},
                    "contentDetails": {"duration": "PT10M"},
                }
            ]
        }
    )

    # First call: fetches
    p1 = get_or_fetch_playlist(mock_db, "PL1234567890123456", service=service)
    assert p1.title == "Title 1"
    assert route_pl.call_count == 1

    # Second call without refresh: uses cache, no new HTTP call
    p2 = get_or_fetch_playlist(mock_db, "PL1234567890123456", service=service)
    assert p2.id == p1.id
    assert route_pl.call_count == 1

    # Third call with refresh: makes HTTP call again
    p3 = get_or_fetch_playlist(mock_db, "PL1234567890123456", refresh=True, service=service)
    assert p3.id == p1.id
    assert route_pl.call_count == 2


@respx.mock
def test_api_playlists_endpoint(mock_db):
    app = create_app()

    def override_get_db():
        yield mock_db

    app.dependency_overrides[get_db] = override_get_db

    respx.get("https://www.googleapis.com/youtube/v3/playlists").respond(
        json={"items": [{"snippet": {"title": "API Playlist", "channelTitle": "API Channel"}}]}
    )
    respx.get("https://www.googleapis.com/youtube/v3/playlistItems").respond(
        json={"items": [{"contentDetails": {"videoId": "v_api"}, "snippet": {"title": "Video API"}}]}
    )
    respx.get("https://www.googleapis.com/youtube/v3/videos").respond(
        json={
            "items": [
                {
                    "id": "v_api",
                    "snippet": {"title": "Video API", "liveBroadcastContent": "none", "description": "desc"},
                    "contentDetails": {"duration": "PT5M"},
                }
            ]
        }
    )

    test_client = TestClient(app)
    response = test_client.post("/api/playlists", json={"playlist_url": "https://www.youtube.com/playlist?list=PL1234567890123456"})
    assert response.status_code == 200
    data = response.json()
    assert data["title"] == "API Playlist"
    assert data["video_count"] == 1
    assert data["videos"][0]["youtube_video_id"] == "v_api"
