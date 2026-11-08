
from __future__ import annotations

import logging
import re
import time
import urllib.parse
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional, Tuple

import httpx
from pymongo.database import Database
from pymongo.errors import DuplicateKeyError

from app.config import get_settings
from app.errors import AppError
from app.models.documents import Playlist, Video

logger = logging.getLogger(__name__)

YOUTUBE_API_BASE = "https://www.googleapis.com/youtube/v3"

BARE_PLAYLIST_ID_REGEX = re.compile(r"^[A-Za-z0-9_-]{10,64}$")

ISO_DURATION_REGEX = re.compile(
    r"^P(?:(?P<days>\d+)D)?(?:T(?:(?P<hours>\d+)H)?"
    r"(?:(?P<minutes>\d+)M)?(?:(?P<seconds>\d+)S)?)?$"
)

ALLOWED_HOSTS = {
    "youtube.com",
    "www.youtube.com",
    "m.youtube.com",
    "music.youtube.com",
    "youtu.be",
}


def parse_playlist_id(url_or_id: str) -> str:
    """Extract and validate YouTube playlist ID from URL or bare ID."""
    if not url_or_id or not isinstance(url_or_id, str):
        raise AppError(
            "INVALID_URL",
            "Playlist URL or ID must be a non-empty string.",
        )

    cleaned = url_or_id.strip()

    if BARE_PLAYLIST_ID_REGEX.match(cleaned):
        if cleaned.startswith("RD"):
            raise AppError(
                "INVALID_URL",
                "Auto-generated YouTube mix playlists (starting with 'RD') are not supported.",
            )
        return cleaned

    try:
        parsed = urllib.parse.urlparse(cleaned)
    except Exception as e:
        raise AppError("INVALID_URL", f"Invalid URL format: {e}")

    hostname = (parsed.hostname or "").lower()

    if hostname not in ALLOWED_HOSTS:
        raise AppError(
            "INVALID_URL",
            f"Invalid YouTube host '{hostname}'. Only YouTube links are supported.",
        )

    qs = urllib.parse.parse_qs(parsed.query)
    playlist_ids = qs.get("list")

    if not playlist_ids or not playlist_ids[0]:
        raise AppError(
            "INVALID_URL",
            "URL does not contain a 'list=' playlist parameter.",
        )

    playlist_id = playlist_ids[0].strip()

    if not BARE_PLAYLIST_ID_REGEX.match(playlist_id):
        raise AppError(
            "INVALID_URL",
            f"Invalid playlist ID format: '{playlist_id}'.",
        )

    if playlist_id.startswith("RD"):
        raise AppError(
            "INVALID_URL",
            "Auto-generated YouTube mix playlists (starting with 'RD') are not supported.",
        )

    return playlist_id


def parse_iso8601_duration(s: str) -> int:
    """Parse ISO 8601 duration string into seconds."""
    if not s or not isinstance(s, str):
        raise ValueError("Invalid ISO 8601 duration: empty or non-string")

    s = s.strip()

    if s in ("P", "PT"):
        raise ValueError(f"Invalid ISO 8601 duration: '{s}'")

    match = ISO_DURATION_REGEX.match(s)

    if not match:
        raise ValueError(f"Invalid ISO 8601 duration: '{s}'")

    days = int(match.group("days") or 0)
    hours = int(match.group("hours") or 0)
    minutes = int(match.group("minutes") or 0)
    seconds = int(match.group("seconds") or 0)

    if not any(
        [
            match.group("days"),
            match.group("hours"),
            match.group("minutes"),
            match.group("seconds"),
        ]
    ):
        raise ValueError(f"Invalid ISO 8601 duration: '{s}'")

    return days * 86400 + hours * 3600 + minutes * 60 + seconds


class YouTubeService:
    def __init__(
        self,
        api_key: Optional[str] = None,
        client: Optional[httpx.Client] = None,
    ):
        self.settings = get_settings()
        self.api_key = api_key or self.settings.YOUTUBE_API_KEY
        self._client = client

    def _get_client(self) -> httpx.Client:
        if self._client is not None:
            return self._client
        return httpx.Client(timeout=15.0)

    def _api_get(
        self,
        endpoint: str,
        params: Dict[str, Any],
    ) -> Dict[str, Any]:
        """Call YouTube Data API v3 with retries on transient errors."""
        params_with_key = {**params, "key": self.api_key}
        url = f"{YOUTUBE_API_BASE}/{endpoint}"

        retries = 3
        backoff = 0.5

        for attempt in range(1, retries + 1):
            try:
                client = self._get_client()
                response = client.get(url, params=params_with_key)

                if response.status_code == 403:
                    data = response.json()
                    errors = data.get("error", {}).get("errors", [])
                    reasons = [e.get("reason") for e in errors]

                    if "quotaExceeded" in reasons or any(
                        "quota" in (e.get("message") or "").lower()
                        for e in errors
                    ):
                        raise AppError(
                            "YOUTUBE_QUOTA_EXCEEDED",
                            "YouTube API daily quota exceeded. Please try again later.",
                            status_code=503,
                        )

                    raise AppError(
                        "PLAYLIST_PRIVATE",
                        "This playlist is private or doesn't exist. "
                        "Make sure it's public or unlisted.",
                        status_code=403,
                    )

                if response.status_code == 404:
                    raise AppError(
                        "PLAYLIST_NOT_FOUND",
                        "This playlist was not found. Please verify the URL.",
                        status_code=404,
                    )

                if response.status_code >= 500 and attempt < retries:
                    time.sleep(backoff)
                    backoff *= 2
                    continue

                response.raise_for_status()
                return response.json()

            except (httpx.NetworkError, httpx.TimeoutException) as e:
                if attempt < retries:
                    time.sleep(backoff)
                    backoff *= 2
                    continue

                raise AppError(
                    "INTERNAL_ERROR",
                    f"Failed to connect to YouTube Data API: {e}",
                    status_code=500,
                )

            except AppError:
                raise

            except Exception as e:
                raise AppError(
                    "INTERNAL_ERROR",
                    f"Unexpected error communicating with YouTube API: {e}",
                    status_code=500,
                )

        raise AppError(
            "INTERNAL_ERROR",
            "Failed to fetch data from YouTube API after retries.",
        )

    def fetch_playlist_details(self, playlist_id: str) -> Tuple[str, str]:
        """Fetch playlist title and channelTitle."""
        data = self._api_get(
            "playlists",
            {"part": "snippet", "id": playlist_id},
        )

        items = data.get("items", [])

        if not items:
            raise AppError(
                "PLAYLIST_NOT_FOUND",
                "This playlist is private or doesn't exist. "
                "Make sure it's public or unlisted.",
                status_code=404,
            )

        snippet = items[0].get("snippet", {})

        title = snippet.get("title", "Untitled Playlist")
        channel_title = snippet.get("channelTitle", "Unknown Channel")

        return title, channel_title

    def fetch_all_playlist_item_video_ids(
        self,
        playlist_id: str,
    ) -> List[Tuple[str, str]]:
        """Fetch video IDs and titles in playlist order."""
        items_result: List[Tuple[str, str]] = []
        page_token: Optional[str] = None
        max_videos = self.settings.MAX_PLAYLIST_VIDEOS

        while True:
            params: Dict[str, Any] = {
                "part": "snippet,contentDetails",
                "playlistId": playlist_id,
                "maxResults": 50,
            }

            if page_token:
                params["pageToken"] = page_token

            data = self._api_get("playlistItems", params)
            items = data.get("items", [])

            for item in items:
                content_details = item.get("contentDetails", {})
                snippet = item.get("snippet", {})

                vid = (
                    content_details.get("videoId")
                    or snippet.get("resourceId", {}).get("videoId")
                )

                title = snippet.get("title", "")

                if vid:
                    items_result.append((vid, title))

                if len(items_result) > max_videos:
                    raise AppError(
                        "PLAYLIST_TOO_LARGE",
                        f"Playlist exceeds maximum supported limit of {max_videos} videos.",
                        status_code=422,
                    )

            page_token = data.get("nextPageToken")

            if not page_token:
                break

        return items_result

    def fetch_videos_metadata(
        self,
        video_ids: List[str],
    ) -> Dict[str, Dict[str, Any]]:
        """Fetch video duration and metadata in batches of 50."""
        results: Dict[str, Dict[str, Any]] = {}
        batch_size = 50

        for i in range(0, len(video_ids), batch_size):
            chunk = video_ids[i : i + batch_size]

            data = self._api_get(
                "videos",
                {
                    "part": "contentDetails,snippet",
                    "id": ",".join(chunk),
                },
            )

            for item in data.get("items", []):
                vid = item.get("id")

                if vid:
                    results[vid] = item

        return results

    def fetch_and_filter_playlist(
        self,
        playlist_id: str,
    ) -> Tuple[str, str, List[Dict[str, Any]], List[Dict[str, Any]]]:
        """Fetch playlist metadata, filter videos and return warnings."""
        title, channel_title = self.fetch_playlist_details(playlist_id)

        raw_items = self.fetch_all_playlist_item_video_ids(playlist_id)

        all_vids = [v[0] for v in raw_items]
        metadata_map = self.fetch_videos_metadata(all_vids)

        kept_videos: List[Dict[str, Any]] = []
        warnings: List[Dict[str, Any]] = []
        seen_vids: set[str] = set()

        position = 0

        for vid, raw_title in raw_items:
            # Duplicate check
            if vid in seen_vids:
                warnings.append(
                    {
                        "youtube_video_id": vid,
                        "title": raw_title,
                        "reason": "duplicate",
                    }
                )
                continue

            seen_vids.add(vid)

            # Missing/private/deleted videos
            if vid not in metadata_map:
                warnings.append(
                    {
                        "youtube_video_id": vid,
                        "title": raw_title,
                        "reason": "private_or_deleted",
                    }
                )
                continue

            v_meta = metadata_map[vid]

            snippet = v_meta.get("snippet", {})
            content_details = v_meta.get("contentDetails", {})

            v_title = snippet.get("title", raw_title)

            if v_title.strip() in ("Private video", "Deleted video"):
                warnings.append(
                    {
                        "youtube_video_id": vid,
                        "title": v_title,
                        "reason": "private_or_deleted",
                    }
                )
                continue

            # Live or upcoming streams
            live_broadcast = snippet.get("liveBroadcastContent", "none")

            if live_broadcast in ("live", "upcoming"):
                warnings.append(
                    {
                        "youtube_video_id": vid,
                        "title": v_title,
                        "reason": "live_stream",
                    }
                )
                continue

            # Duration parsing
            duration_iso = content_details.get("duration", "PT0S")

            try:
                duration_seconds = parse_iso8601_duration(duration_iso)
            except ValueError:
                duration_seconds = 0

            if duration_seconds <= 0:
                warnings.append(
                    {
                        "youtube_video_id": vid,
                        "title": v_title,
                        "reason": "zero_duration",
                    }
                )
                continue

            thumbnails = snippet.get("thumbnails", {})

            thumbnail_url = (
                thumbnails.get("medium", {}).get("url")
                or thumbnails.get("standard", {}).get("url")
                or thumbnails.get("default", {}).get("url")
            )

            kept_videos.append(
                {
                    "youtube_video_id": vid,
                    "position": position,
                    "title": v_title,
                    "description": (snippet.get("description") or "")[:1000],
                    "duration_seconds": duration_seconds,
                    "thumbnail_url": thumbnail_url,
                }
            )

            position += 1

        if not kept_videos:
            raise AppError(
                "PLAYLIST_EMPTY",
                "This playlist contains no usable videos.",
                status_code=422,
            )

        return title, channel_title, kept_videos, warnings


# ---------------------------------------------------------------------
# MongoDB playlist storage
# ---------------------------------------------------------------------


def _playlist_from_mongo(
    db: Database,
    document: Dict[str, Any],
) -> Playlist:
    """Convert a MongoDB playlist document into a Playlist object."""

    fetched_at = document["fetched_at"]

    # PyMongo returns naive UTC datetimes by default.
    if fetched_at.tzinfo is None:
        fetched_at = fetched_at.replace(tzinfo=timezone.utc)

    videos = [
        Video(
            playlist_id=str(video["playlist_id"]),
            youtube_video_id=video["youtube_video_id"],
            position=video["position"],
            title=video["title"],
            description=video.get("description", ""),
            duration_seconds=video["duration_seconds"],
            thumbnail_url=video.get("thumbnail_url"),
        )
        for video in db.videos.find(
            {"playlist_id": str(document["_id"])}
        ).sort("position", 1)
    ]

    return Playlist(
        id=str(document["_id"]),
        youtube_playlist_id=document["youtube_playlist_id"],
        title=document["title"],
        channel_title=document["channel_title"],
        video_count=document["video_count"],
        total_seconds=document["total_seconds"],
        warnings=document.get("warnings", []),
        fetched_at=fetched_at,
        videos=videos,
    )


def _video_documents(
    playlist_id: str,
    videos: List[Dict[str, Any]],
) -> List[Dict[str, Any]]:
    """Prepare video documents for insertion into MongoDB."""

    return [
        {
            "_id": f"{playlist_id}:{video['youtube_video_id']}",
            "playlist_id": playlist_id,
            "youtube_video_id": video["youtube_video_id"],
            "position": video["position"],
            "title": video["title"],
            "description": video.get("description", ""),
            "duration_seconds": video["duration_seconds"],
            "thumbnail_url": video.get("thumbnail_url"),
        }
        for video in videos
    ]


def get_or_fetch_playlist(
    db: Database,
    url_or_id: str,
    refresh: bool = False,
    service: Optional[YouTubeService] = None,
) -> Playlist:
    """
    Return a cached playlist if it is fresh.
    Otherwise fetch it from YouTube and store it in MongoDB.
    """

    playlist_id = parse_playlist_id(url_or_id)
    settings = get_settings()

    playlists = db.playlists
    videos_collection = db.videos

    existing = playlists.find_one(
        {"youtube_playlist_id": playlist_id}
    )

    now = datetime.now(timezone.utc)

    # Return cached playlist if it is still fresh.
    if existing and not refresh:
        fetched_at = existing["fetched_at"]

        if fetched_at.tzinfo is None:
            fetched_at = fetched_at.replace(tzinfo=timezone.utc)

        cache_expiry = fetched_at + timedelta(
            hours=settings.PLAYLIST_CACHE_HOURS
        )

        if now < cache_expiry:
            return _playlist_from_mongo(db, existing)

    if service is None:
        service = YouTubeService()

    # Keep the existing YouTube fetching and filtering logic.
    title, channel_title, kept_videos, warnings = (
        service.fetch_and_filter_playlist(playlist_id)
    )

    total_seconds = sum(
        video["duration_seconds"] for video in kept_videos
    )

    playlist_values = {
        "youtube_playlist_id": playlist_id,
        "title": title,
        "channel_title": channel_title,
        "video_count": len(kept_videos),
        "total_seconds": total_seconds,
        "warnings": warnings,
        "fetched_at": now,
    }

    # Refresh an existing playlist.
    if existing:
        playlist_document_id = str(existing["_id"])

        video_documents = _video_documents(
            playlist_document_id,
            kept_videos,
        )

        # Replace the old video records.
        videos_collection.delete_many(
            {"playlist_id": playlist_document_id}
        )

        if video_documents:
            videos_collection.insert_many(video_documents)

        playlists.update_one(
            {"_id": playlist_document_id},
            {"$set": playlist_values},
        )

        updated = playlists.find_one(
            {"_id": playlist_document_id}
        )

        return _playlist_from_mongo(db, updated)

    # Create a new playlist.
    new_playlist = Playlist(
        youtube_playlist_id=playlist_id,
        title=title,
        channel_title=channel_title,
        video_count=len(kept_videos),
        total_seconds=total_seconds,
        warnings=warnings,
        fetched_at=now,
    )

    playlist_document = {
        "_id": new_playlist.id,
        **playlist_values,
    }

    try:
        playlists.insert_one(playlist_document)

        video_documents = _video_documents(
            new_playlist.id,
            kept_videos,
        )

        if video_documents:
            videos_collection.insert_many(video_documents)

        saved_playlist = playlists.find_one(
            {"_id": new_playlist.id}
        )

        return _playlist_from_mongo(db, saved_playlist)

    except DuplicateKeyError:
        # Another request may have created the same playlist concurrently.
        concurrent_playlist = playlists.find_one(
            {"youtube_playlist_id": playlist_id}
        )

        if concurrent_playlist:
            return _playlist_from_mongo(db, concurrent_playlist)

        raise
