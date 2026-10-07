from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional

from sqlalchemy.orm import Session

from app.config import get_settings
from app.models.entities import Clustering, Playlist
from app.services.clustering.common import hash_videos
from app.services.clustering.embedding_clusterer import cluster_with_embeddings
from app.services.clustering.hybrid_clusterer import cluster_hybrid
from app.services.clustering.llm_clusterer import cluster_with_llm
from app.services.llm import get_llm_client
from app.services.llm.base import LLMClient

logger = logging.getLogger(__name__)


def get_or_create_clustering(
    db: Session,
    playlist: Playlist,
    method: Optional[str] = None,
    llm_client: Optional[LLMClient] = None,
) -> Clustering:
    """Retrieve existing cached Clustering or compute new one and cache in DB."""
    settings = get_settings()
    chosen_method = (method or settings.CLUSTERING_METHOD).lower()
    if chosen_method not in ("llm", "embeddings", "hybrid"):
        chosen_method = "llm"

    video_ids = [v.youtube_video_id for v in playlist.videos]
    v_hash = hash_videos(video_ids)

    # Check cache
    existing = (
        db.query(Clustering)
        .filter_by(playlist_id=playlist.id, method=chosen_method, videos_hash=v_hash)
        .first()
    )
    if existing:
        return existing

    # Convert ORM videos to dictionaries for clusterer
    videos_dicts: List[Dict[str, Any]] = [
        {
            "position": v.position,
            "title": v.title,
            "description": v.description,
            "duration_seconds": v.duration_seconds,
            "youtube_video_id": v.youtube_video_id,
        }
        for v in playlist.videos
    ]

    client = llm_client or get_llm_client()

    topics: List[Dict[str, Any]]
    method_used: str

    if chosen_method == "embeddings":
        topics = cluster_with_embeddings(videos_dicts)
        method_used = "embeddings"
    elif chosen_method == "hybrid":
        topics, method_used = cluster_hybrid(
            videos=videos_dicts,
            playlist_title=playlist.title,
            channel_title=playlist.channel_title,
            client=client,
        )
    else:  # llm
        topics, method_used = cluster_with_llm(
            videos=videos_dicts,
            playlist_title=playlist.title,
            channel_title=playlist.channel_title,
            client=client,
        )

    clustering_record = Clustering(
        playlist_id=playlist.id,
        method=chosen_method,
        method_used=method_used,
        videos_hash=v_hash,
        result_json={"topics": topics},
    )
    db.add(clustering_record)
    db.commit()
    db.refresh(clustering_record)
    return clustering_record


__all__ = [
    "get_or_create_clustering",
    "cluster_with_llm",
    "cluster_with_embeddings",
    "cluster_hybrid",
]
