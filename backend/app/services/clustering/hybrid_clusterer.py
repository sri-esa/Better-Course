from __future__ import annotations

import logging
from typing import Any, Dict, List, Tuple

from app.services.clustering.common import sanitize_topics
from app.services.clustering.embedding_clusterer import cluster_with_embeddings
from app.services.llm.base import LLMClient

logger = logging.getLogger(__name__)

HYBRID_SYSTEM_PROMPT = """You are a curriculum designer. You are given predefined topic boundaries for a series of educational videos.
Your job is to name each topic, assign its difficulty, and write a concise summary.
You must NOT change the start_index or end_index boundaries."""

HYBRID_USER_PROMPT = """Playlist: "{playlist_title}" by {channel_title}

Below are the fixed video segments. For each segment, review its video titles and provide:
1. name (6 words or fewer, content specific)
2. difficulty (beginner, intermediate, or advanced)
3. summary (at most 20 words)

Segments:
{segments_description}

Return ONLY JSON matching:
{{"topics": [{{"name": str, "difficulty": "beginner|intermediate|advanced", "summary": str, "start_index": int, "end_index": int}}]}}"""


def cluster_hybrid(
    videos: List[Dict[str, Any]],
    playlist_title: str,
    channel_title: str,
    client: LLMClient,
) -> Tuple[List[Dict[str, Any]], str]:
    """Hybrid clustering: boundaries from embeddings, metadata (name, difficulty, summary) from LLM."""
    base_segments = cluster_with_embeddings(videos)
    if not base_segments:
        return [], "embeddings"

    # Build description of segments
    lines = []
    for i, seg in enumerate(base_segments):
        s = seg["start_index"]
        e = seg["end_index"]
        seg_titles = [videos[idx].get("title", "") for idx in range(s, min(e + 1, len(videos)))]
        titles_sample = ", ".join(f'"{t}"' for t in seg_titles[:5])
        if len(seg_titles) > 5:
            titles_sample += f" ... (+{len(seg_titles) - 5} more)"
        lines.append(f"Segment {i + 1}: indices {s} to {e} | Titles: {titles_sample}")

    prompt = HYBRID_USER_PROMPT.format(
        playlist_title=playlist_title,
        channel_title=channel_title,
        segments_description="\n".join(lines),
    )

    try:
        result = client.generate_json(HYBRID_SYSTEM_PROMPT, prompt, temperature=0.2)
        llm_topics = result.get("topics", [])
        if len(llm_topics) == len(base_segments):
            # Apply names and difficulties while strictly preserving base segment boundaries
            merged_topics: List[Dict[str, Any]] = []
            for base_seg, llm_seg in zip(base_segments, llm_topics):
                merged_topics.append({
                    "name": llm_seg.get("name") or base_seg["name"],
                    "difficulty": llm_seg.get("difficulty") or base_seg["difficulty"],
                    "summary": llm_seg.get("summary") or base_seg["summary"],
                    "start_index": base_seg["start_index"],
                    "end_index": base_seg["end_index"],
                })
            return sanitize_topics(merged_topics), "hybrid"

        logger.warning(
            "Hybrid LLM output length mismatch (%d vs %d). Keeping embedding names.",
            len(llm_topics),
            len(base_segments),
        )
        return base_segments, "embeddings"
    except Exception as e:
        logger.warning("Hybrid LLM naming failed (%s). Keeping embedding names.", e)
        # DECISION: Fall back to embedding segment names if LLM naming fails
        return base_segments, "embeddings"
