from __future__ import annotations

import re
from typing import Any, Dict, List

from app.services.llm.base import LLMClient, LLMError


class FakeLLMClient(LLMClient):
    """Deterministic LLM client for tests."""

    def __init__(self, mode: str = "valid"):
        # mode: 'valid', 'invalid_json', 'invalid_ranges', 'raise_error', 'fail_once'
        self.mode = mode
        self.call_count = 0

    def generate_json(self, system: str, user: str, *, temperature: float = 0.2) -> Dict[str, Any]:
        self.call_count += 1

        if self.mode == "raise_error":
            raise LLMError("Simulated LLM connection failure")

        if self.mode == "fail_once":
            if self.call_count == 1:
                return {"topics": [{"name": "Bad", "start_index": 5, "end_index": 2}]}
            # On retry, succeed
            return self._generate_valid(user)

        if self.mode == "invalid_json":
            raise LLMError("Could not parse JSON: invalid syntax")

        if self.mode == "invalid_ranges":
            # Gaps and overlaps
            return {
                "topics": [
                    {"name": "Topic 1", "difficulty": "beginner", "start_index": 0, "end_index": 5},
                    {"name": "Topic 2", "difficulty": "intermediate", "start_index": 8, "end_index": 12},
                ]
            }

        return self._generate_valid(user)

    def _generate_valid(self, user: str) -> Dict[str, Any]:
        # Handle hybrid prompt (which gives segments with boundaries already fixed)
        if "Segment" in user and "boundaries" in user.lower():
            # Match Segment N: indices X to Y
            segment_matches = re.findall(r"Segment\s+(\d+):\s+indices\s+(\d+)\s+to\s+(\d+)", user)
            if segment_matches:
                topics: List[Dict[str, Any]] = []
                diffs = ["beginner", "intermediate", "advanced"]
                for i, (seg_id, start_idx, end_idx) in enumerate(segment_matches):
                    diff = diffs[i % len(diffs)]
                    topics.append({
                        "name": f"Subject Segment {seg_id}",
                        "difficulty": diff,
                        "summary": f"Summary for segment {seg_id} covering essential concepts.",
                        "start_index": int(start_idx),
                        "end_index": int(end_idx),
                    })
                return {"topics": topics}

        # Handle standard llm clustering prompt
        first_match = re.search(r"first topic starts at\s+(\d+)", user)
        last_match = re.search(r"last ends at\s+(\d+)", user)

        if first_match and last_match:
            start = int(first_match.group(1))
            end = int(last_match.group(1))
        else:
            # Fallback: find all video indices from lines like "0 | Intro to Arrays | 12"
            video_indices = [int(m) for m in re.findall(r"^(\d+)\s*\|", user, re.MULTILINE)]
            if video_indices:
                start = video_indices[0]
                end = video_indices[-1]
            else:
                start = 0
                end = 0

        topics: List[Dict[str, Any]] = []

        chunk_size = 4
        diffs = ["beginner", "intermediate", "advanced"]

        curr = start
        topic_idx = 1
        while curr <= end:
            chunk_end = min(curr + chunk_size - 1, end)
            diff = diffs[min((curr - start) // (chunk_size * 2), len(diffs) - 1)]
            topics.append({
                "name": f"Topic {topic_idx} Fundamentals",
                "difficulty": diff,
                "summary": f"Covers key concepts from lesson {curr} to {chunk_end}.",
                "start_index": curr,
                "end_index": chunk_end,
            })
            curr = chunk_end + 1
            topic_idx += 1

        return {"topics": topics}
