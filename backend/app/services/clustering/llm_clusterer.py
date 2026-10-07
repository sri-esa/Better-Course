from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional, Tuple

from app.config import get_settings
from app.services.clustering.common import sanitize_topics, validate_topics
from app.services.clustering.embedding_clusterer import cluster_with_embeddings
from app.services.llm.base import LLMClient

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """You are a curriculum designer. You organize an ordered list of educational videos
into study topics. You never reorder videos and never invent content."""

USER_PROMPT_TEMPLATE = """Playlist: "{playlist_title}" by {channel_title}
Total videos: {n}. Total watch time: {hours:.1f} hours.
{previous_topic_context}

Videos (index | title | minutes):
{videos_list}

Split the videos into consecutive topics.
Rules:
1. Topics are contiguous index ranges in the original order. Every index must belong
   to exactly one topic. The first topic starts at {first_index} and the last ends at {last_index}.
2. Each topic should be one coherent subject. Aim for roughly {target_hours} hours of
   video per topic (acceptable range 1 to 8 hours). A topic should have at least 2 videos
   unless a single video is clearly standalone (introduction, wrap-up, exam review).
3. Name each topic in 6 words or fewer, specific to the content
   (good: "Binary Trees and Traversals", bad: "Part 3").
4. Set difficulty to beginner, intermediate or advanced based on the content and where
   it sits in the playlist's progression.
5. Add a summary of at most 20 words.
Return ONLY JSON matching:
{{"topics": [{{"name": str, "difficulty": "beginner|intermediate|advanced",
             "summary": str, "start_index": int, "end_index": int}}]}}"""


def _format_video_lines(videos_slice: List[Dict[str, Any]]) -> str:
    lines = []
    for v in videos_slice:
        idx = v["position"]
        title = v.get("title", "")
        mins = round(v.get("duration_seconds", 0) / 60)
        lines.append(f"{idx} | {title} | {mins}")
    return "\n".join(lines)


def _cluster_window(
    client: LLMClient,
    playlist_title: str,
    channel_title: str,
    videos_slice: List[Dict[str, Any]],
    first_index: int,
    last_index: int,
    target_hours: float,
    previous_topic_name: Optional[str] = None,
) -> List[Dict[str, Any]]:
    """Cluster a window of videos with retry on validation failures."""
    n_slice = len(videos_slice)
    total_sec = sum(v.get("duration_seconds", 0) for v in videos_slice)
    hours = total_sec / 3600.0

    prev_context = (
        f"The previous topic ended with '{previous_topic_name}'."
        if previous_topic_name
        else ""
    )

    base_user_prompt = USER_PROMPT_TEMPLATE.format(
        playlist_title=playlist_title,
        channel_title=channel_title,
        n=n_slice,
        hours=hours,
        previous_topic_context=prev_context,
        videos_list=_format_video_lines(videos_slice),
        first_index=first_index,
        last_index=last_index,
        target_hours=target_hours,
    )

    prompt = base_user_prompt
    max_retries = 2

    for attempt in range(max_retries + 1):
        try:
            result = client.generate_json(SYSTEM_PROMPT, prompt, temperature=0.2)
            topics = result.get("topics", [])
            # Shift check if slice starts > 0: validate expects 0-indexed relative or absolute
            # Let's adjust topics for validation:
            # We want absolute indices in the output
            problems = []
            if not topics or not isinstance(topics, list):
                problems.append("Response must contain a non-empty 'topics' list.")
            else:
                if topics[0].get("start_index") != first_index:
                    problems.append(f"First topic start_index must be {first_index}, got {topics[0].get('start_index')}.")
                if topics[-1].get("end_index") != last_index:
                    problems.append(f"Last topic end_index must be {last_index}, got {topics[-1].get('end_index')}.")

                expected = first_index
                for idx, t in enumerate(topics):
                    s = t.get("start_index")
                    e = t.get("end_index")
                    if s != expected:
                        problems.append(f"Topic {idx} start_index is {s}, expected {expected}.")
                    if s is not None and e is not None and s > e:
                        problems.append(f"Topic {idx} start_index {s} > end_index {e}.")
                    if e is not None:
                        expected = e + 1

            if not problems:
                return sanitize_topics(topics)

            logger.warning("LLM clustering validation failed (attempt %d): %s", attempt + 1, problems)
            if attempt < max_retries:
                # Append problems to prompt and retry
                prompt = (
                    f"{base_user_prompt}\n\nIMPORTANT: Your previous output had the following errors:\n"
                    + "\n".join(f"- {p}" for p in problems)
                    + "\nPlease fix these errors and return valid contiguous index ranges."
                )

        except Exception as e:
            logger.warning("LLM call failed on attempt %d: %s", attempt + 1, e)
            if attempt < max_retries:
                continue

    raise ValueError("LLM failed to return valid topics after retries.")


def cluster_with_llm(
    videos: List[Dict[str, Any]],
    playlist_title: str,
    channel_title: str,
    client: LLMClient,
) -> Tuple[List[Dict[str, Any]], str]:
    """Cluster videos using LLM with windowing for > 120 videos and fallback to embeddings."""
    settings = get_settings()
    target_hours = settings.TARGET_TOPIC_HOURS
    n = len(videos)

    if n <= 1:
        name = videos[0]["title"] if n == 1 else "Curriculum"
        return [
            {
                "name": name[:50],
                "difficulty": "intermediate",
                "summary": "Single video overview.",
                "start_index": 0,
                "end_index": max(0, n - 1),
            }
        ], "llm"

    try:
        if n <= 120:
            topics = _cluster_window(
                client=client,
                playlist_title=playlist_title,
                channel_title=channel_title,
                videos_slice=videos,
                first_index=0,
                last_index=n - 1,
                target_hours=target_hours,
            )
            # Final validation
            val_problems = validate_topics(topics, n)
            if val_problems:
                raise ValueError(f"Final topics invalid: {val_problems}")
            return topics, "llm"

        # Windowing for n > 120 (windows of 100)
        window_size = 100
        all_topics: List[Dict[str, Any]] = []
        last_topic_name: Optional[str] = None

        for start_pos in range(0, n, window_size):
            end_pos = min(start_pos + window_size, n)
            slice_videos = videos[start_pos:end_pos]

            window_topics = _cluster_window(
                client=client,
                playlist_title=playlist_title,
                channel_title=channel_title,
                videos_slice=slice_videos,
                first_index=start_pos,
                last_index=end_pos - 1,
                target_hours=target_hours,
                previous_topic_name=last_topic_name,
            )

            # Stitch and merge window's first topic if matching previous window's last topic
            if all_topics and window_topics:
                first_new = window_topics[0]
                prev_last = all_topics[-1]
                if first_new["name"].strip().lower() == prev_last["name"].strip().lower():
                    # Merge into prev_last
                    prev_last["end_index"] = first_new["end_index"]
                    window_topics = window_topics[1:]

            all_topics.extend(window_topics)
            if all_topics:
                last_topic_name = all_topics[-1]["name"]

        val_problems = validate_topics(all_topics, n)
        if val_problems:
            raise ValueError(f"Window stitched topics invalid: {val_problems}")

        return all_topics, "llm"

    except Exception as e:
        logger.warning("LLM clustering failed (%s). Falling back to embeddings.", e)
        # DECISION: Fallback to embeddings method when LLM fails
        fallback_topics = cluster_with_embeddings(videos)
        return fallback_topics, "embeddings"
