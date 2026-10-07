from __future__ import annotations

import logging
from typing import Any, Dict, List

import numpy as np

from app.config import get_settings
from app.services.clustering.common import sanitize_topics

logger = logging.getLogger(__name__)


def _duration_chunking(videos: List[Dict[str, Any]], target_hours: float) -> List[Dict[str, Any]]:
    """Fallback chunker: groups consecutive videos until accumulated duration reaches target_hours."""
    target_seconds = target_hours * 3600
    n = len(videos)
    topics: List[Dict[str, Any]] = []

    start_idx = 0
    curr_seconds = 0

    for i, v in enumerate(videos):
        curr_seconds += v.get("duration_seconds", 0)
        # If we have at least 1 video and reached target (or at the last video)
        if (curr_seconds >= target_seconds and i > start_idx) or (i == n - 1):
            title = videos[start_idx].get("title", f"Topic {len(topics) + 1}").strip()
            if len(title) > 50:
                name = title[:47] + "..."
            else:
                name = title

            topics.append({
                "name": name,
                "difficulty": "intermediate",
                "summary": f"Covers lessons from {start_idx + 1} to {i + 1}.",
                "start_index": start_idx,
                "end_index": i,
            })
            start_idx = i + 1
            curr_seconds = 0

    return topics


def cluster_with_embeddings(videos: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Cluster videos using embeddings with order-preserving agglomerative clustering,

    or fall back to duration chunking if sentence-transformers is not available.
    """
    settings = get_settings()
    target_hours = settings.TARGET_TOPIC_HOURS
    total_seconds = sum(v.get("duration_seconds", 0) for v in videos)
    total_hours = total_seconds / 3600.0
    n = len(videos)

    if n <= 1:
        name = videos[0]["title"] if n == 1 else "Course Overview"
        return [{
            "name": name[:50],
            "difficulty": "intermediate",
            "summary": "Single topic curriculum.",
            "start_index": 0,
            "end_index": max(0, n - 1),
        }]

    # Try sentence-transformers + scikit-learn
    try:
        from sentence_transformers import SentenceTransformer
        from sklearn.cluster import AgglomerativeClustering

        model = SentenceTransformer("all-MiniLM-L6-v2")
        texts = [f"{v.get('title', '')}. {v.get('description', '')[:300]}" for v in videos]
        embeddings = model.encode(texts, normalize_embeddings=True)

        n_clusters = max(1, min(round(total_hours / target_hours), n))
        if n_clusters == 1:
            name = videos[0]["title"][:50]
            return [{
                "name": name,
                "difficulty": "intermediate",
                "summary": "Full topic overview.",
                "start_index": 0,
                "end_index": n - 1,
            }]

        # Create linear connectivity chain: video i connected only to i-1 and i+1
        connectivity = np.zeros((n, n), dtype=int)
        for i in range(n - 1):
            connectivity[i, i + 1] = 1
            connectivity[i + 1, i] = 1

        clustering = AgglomerativeClustering(
            n_clusters=n_clusters,
            linkage="ward",
            connectivity=connectivity,
        )
        labels = clustering.fit_predict(embeddings)

        # Extract contiguous segments from labels
        topics: List[Dict[str, Any]] = []
        seg_start = 0
        curr_label = labels[0]

        for i in range(1, n):
            if labels[i] != curr_label:
                first_title = videos[seg_start].get("title", f"Topic {len(topics) + 1}").strip()
                name = first_title[:47] + "..." if len(first_title) > 50 else first_title
                topics.append({
                    "name": name,
                    "difficulty": "intermediate",
                    "summary": f"Lessons {seg_start + 1} to {i}.",
                    "start_index": seg_start,
                    "end_index": i - 1,
                })
                seg_start = i
                curr_label = labels[i]

        # Last segment
        first_title = videos[seg_start].get("title", f"Topic {len(topics) + 1}").strip()
        name = first_title[:47] + "..." if len(first_title) > 50 else first_title
        topics.append({
            "name": name,
            "difficulty": "intermediate",
            "summary": f"Lessons {seg_start + 1} to {n}.",
            "start_index": seg_start,
            "end_index": n - 1,
        })

        return sanitize_topics(topics)

    except (ImportError, Exception) as e:
        # Fall back gracefully to duration chunking
        logger.warning(
            "Embedding clustering unavailable or failed (%s). Falling back to duration chunking.", e
        )
        # DECISION: Graceful fallback to duration chunking when embeddings are unavailable
        topics = _duration_chunking(videos, target_hours)
        return sanitize_topics(topics)
