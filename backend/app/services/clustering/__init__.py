
from __future__ import annotations

import logging
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from pymongo.database import Database
from pymongo.errors import DuplicateKeyError

from app.config import get_settings
from app.models.documents import Clustering, Playlist
from app.services.clustering.common import hash_videos
from app.services.clustering.embedding_clusterer import cluster_with_embeddings
from app.services.clustering.hybrid_clusterer import cluster_hybrid
from app.services.clustering.llm_clusterer import cluster_with_llm
from app.services.llm import get_llm_client
from app.services.llm.base import LLMClient

logger = logging.getLogger(__name__)


def _clustering_from_document(document: Dict[str, Any]) -> Clustering:
    """Convert a MongoDB clustering document into a Clustering object."""
    return Clustering(
        id=str(document["_id"]),
        playlist_id=str(document["playlist_id"]),
        method=document["method"],
        method_used=document["method_used"],
        videos_hash=document["videos_hash"],
        result_json=document["result_json"],
        created_at=document.get("created_at", datetime.now(timezone.utc)),
    )


def get_or_create_clustering(
    db: Database,
    playlist: Playlist,
    method: Optional[str] = None,
    llm_client: Optional[LLMClient] = None,
) -> Clustering:
    """Retrieve cached clustering or compute and store a new result in MongoDB."""

    settings = get_settings()
    chosen_method = (method or settings.CLUSTERING_METHOD).lower()

    if chosen_method not in ("llm", "embeddings", "hybrid"):
        chosen_method = "llm"

    video_ids = [video.youtube_video_id for video in playlist.videos]
    videos_hash = hash_videos(video_ids)

    clusterings = db.clusterings

    # Check MongoDB cache.
    existing = clusterings.find_one(
        {
            "playlist_id": playlist.id,
            "method": chosen_method,
            "videos_hash": videos_hash,
        }
    )

    if existing:
        return _clustering_from_document(existing)

    # Convert videos into dictionaries for the clustering algorithms.
    videos_dicts: List[Dict[str, Any]] = [
        {
            "position": video.position,
            "title": video.title,
            "description": video.description,
            "duration_seconds": video.duration_seconds,
            "youtube_video_id": video.youtube_video_id,
        }
        for video in playlist.videos
    ]

    topics: List[Dict[str, Any]]
    method_used: str

    if chosen_method == "embeddings":
        topics = cluster_with_embeddings(videos_dicts)
        method_used = "embeddings"

    elif chosen_method == "hybrid":
        try:
            client = llm_client or get_llm_client()

            topics, method_used = cluster_hybrid(
                videos=videos_dicts,
                playlist_title=playlist.title,
                channel_title=playlist.channel_title,
                client=client,
            )

        except Exception as e:
            logger.warning(
                "Hybrid clustering failed to initialize LLM (%s), using embeddings.",
                e,
            )
            topics = cluster_with_embeddings(videos_dicts)
            method_used = "embeddings"

    else:  # LLM clustering
        try:
            client = llm_client or get_llm_client()

            topics, method_used = cluster_with_llm(
                videos=videos_dicts,
                playlist_title=playlist.title,
                channel_title=playlist.channel_title,
                client=client,
            )

        except Exception as e:
            logger.warning(
                "LLM clustering failed to initialize LLM (%s), using embeddings.",
                e,
            )
            topics = cluster_with_embeddings(videos_dicts)
            method_used = "embeddings"

    clustering_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc)

    document = {
        "_id": clustering_id,
        "playlist_id": playlist.id,
        "method": chosen_method,
        "method_used": method_used,
        "videos_hash": videos_hash,
        "result_json": {"topics": topics},
        "created_at": now,
    }

    try:
        clusterings.insert_one(document)
        return _clustering_from_document(document)

    except DuplicateKeyError:
        # Another request may have created the same cache entry concurrently.
        concurrent_record = clusterings.find_one(
            {
                "playlist_id": playlist.id,
                "method": chosen_method,
                "videos_hash": videos_hash,
            }
        )

        if concurrent_record:
            return _clustering_from_document(concurrent_record)

        raise


__all__ = [
    "get_or_create_clustering",
    "cluster_with_llm",
    "cluster_with_embeddings",
    "cluster_hybrid",
]
