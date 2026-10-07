#!/usr/bin/env python3
"""Clustering evaluation script for StudyFlow.

Evaluates and compares LLM, Embeddings, and Hybrid clustering on playlists
from docs/playlist_library.csv and generates a detailed Markdown report.

Run offline dry run:
    python scripts/eval_clustering.py --dry-run
"""

import argparse
import csv
import os
import sys
from pathlib import Path
from typing import Any, Dict, List, Set

# Ensure backend root is on sys.path
backend_path = Path(__file__).resolve().parent.parent / "backend"
sys.path.insert(0, str(backend_path))

from app.services.clustering.common import sanitize_topics, validate_topics
from app.services.clustering.embedding_clusterer import cluster_with_embeddings
from app.services.clustering.hybrid_clusterer import cluster_hybrid
from app.services.clustering.llm_clusterer import cluster_with_llm
from app.services.llm.fake import FakeLLMClient


def generate_mock_videos(subject: str, n_videos: int = 24) -> List[Dict[str, Any]]:
    """Generate realistic dummy videos for offline dry-run evaluation."""
    topics_pool = {
        "Computer Networks": [
            "OSI Model Architecture", "Physical Layer Signals", "Data Link Layer Framing",
            "Error Detection CRC", "MAC Protocols CSMA/CD", "Ethernet Standards",
            "IP Addressing IPv4", "Subnetting and CIDR", "IPv6 Routing",
            "Routing Algorithms Dijkstra", "BGP and OSPF Protocols", "TCP Handshake and States",
            "Flow Control Sliding Window", "Congestion Control Tahoe/Reno", "UDP Protocol",
            "DNS Domain Name System", "HTTP and HTTPS Architecture", "Socket Programming"
        ],
        "Data Structures": [
            "Introduction to Space and Time Complexity", "Asymptotic Notations",
            "Array Memory Layout and Operations", "Dynamic Arrays and Resizing",
            "Singly Linked List Implementation", "Doubly Linked Lists",
            "Stack Applications and Postfix", "Queue Implementation Ring Buffer",
            "Binary Trees Traversal", "Binary Search Trees Search and Insert",
            "Balanced Trees AVL", "Heaps and Priority Queues",
            "Hashing and Collision Resolution", "Graph Representation Matrix and List",
            "Breadth First Search BFS", "Depth First Search DFS", "Shortest Path Dijkstra"
        ],
        "Calculus": [
            "Limits Intuition and Formal Definition", "Continuity and Discontinuities",
            "Derivatives from First Principles", "Power and Product Rules",
            "Quotient and Chain Rules", "Implicit Differentiation",
            "Extrema and Critical Points", "Mean Value Theorem", "Curve Sketching",
            "Riemann Sums and Definite Integrals", "Fundamental Theorem of Calculus",
            "Integration by Substitution", "Integration by Parts", "Partial Fractions",
            "Applications of Definite Integrals", "Volumes of Revolution Disk Method"
        ],
    }

    base_titles = topics_pool.get(subject, [f"{subject} Concept {i + 1}" for i in range(n_videos)])
    videos = []
    for i in range(n_videos):
        t = base_titles[i % len(base_titles)]
        videos.append({
            "position": i,
            "youtube_video_id": f"mock_vid_{i}",
            "title": f"Lecture {i + 1}: {t}",
            "description": f"Lecture notes and practical examples covering {t}.",
            "duration_seconds": 900 + (i % 6) * 300,  # 15 to 40 mins
        })
    return videos


def get_boundary_set(topics: List[Dict[str, Any]], n_videos: int) -> Set[int]:
    """Get internal partition boundaries (end_index for all topics except the last)."""
    return {t["end_index"] for t in topics if t["end_index"] < n_videos - 1}


def boundary_agreement(set_a: Set[int], set_b: Set[int]) -> float:
    """Calculate Jaccard similarity between two boundary sets."""
    if not set_a and not set_b:
        return 1.0
    union = set_a | set_b
    if not union:
        return 1.0
    return len(set_a & set_b) / len(union)


def run_evaluation(csv_path: str, output_path: str, dry_run: bool = True):
    playlists_to_eval = []
    with open(csv_path, mode="r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            playlists_to_eval.append(row)

    report_lines: List[str] = [
        "# StudyFlow: Clustering Evaluation Report",
        "",
        "This report evaluates topic clustering quality across three methods (`llm`, `embeddings`, `hybrid`).",
        "",
        "## Summary Metrics",
        "",
        "| Playlist | Subject | Method | Topics | Mean Topic (h) | Min (h) | Max (h) |",
        "|---|---|---|---|---|---|---|",
    ]

    detailed_sections: List[str] = []
    comparisons: List[str] = [
        "",
        "## Boundary Agreement (Pairwise Jaccard Index)",
        "",
        "| Playlist | LLM vs Embeddings | LLM vs Hybrid | Embeddings vs Hybrid |",
        "|---|---|---|---|",
    ]

    fake_client = FakeLLMClient(mode="valid")

    for p in playlists_to_eval:
        url = p.get("url", "")
        subject = p.get("subject", "General")
        notes = p.get("notes", "")

        videos = generate_mock_videos(subject, n_videos=24)
        n = len(videos)

        # 1. Run LLM
        llm_topics, _ = cluster_with_llm(videos, subject, "Online Educator", fake_client)
        # 2. Run Embeddings
        emb_topics = cluster_with_embeddings(videos)
        # 3. Run Hybrid
        hyb_topics, _ = cluster_hybrid(videos, subject, "Online Educator", fake_client)

        methods_data = {
            "llm": llm_topics,
            "embeddings": emb_topics,
            "hybrid": hyb_topics,
        }

        # Calculate metrics
        boundaries = {}
        for m_name, m_topics in methods_data.items():
            hours = [
                sum(videos[idx]["duration_seconds"] for idx in range(t["start_index"], t["end_index"] + 1)) / 3600.0
                for t in m_topics
            ]
            mean_h = sum(hours) / len(hours) if hours else 0.0
            min_h = min(hours) if hours else 0.0
            max_h = max(hours) if hours else 0.0
            boundaries[m_name] = get_boundary_set(m_topics, n)

            report_lines.append(
                f"| {subject} | {subject} | `{m_name}` | {len(m_topics)} | {mean_h:.2f} | {min_h:.2f} | {max_h:.2f} |"
            )

        # Boundary agreements
        agr_llm_emb = boundary_agreement(boundaries["llm"], boundaries["embeddings"])
        agr_llm_hyb = boundary_agreement(boundaries["llm"], boundaries["hybrid"])
        agr_emb_hyb = boundary_agreement(boundaries["embeddings"], boundaries["hybrid"])

        comparisons.append(
            f"| {subject} | {agr_llm_emb * 100:.1f}% | {agr_llm_hyb * 100:.1f}% | {agr_emb_hyb * 100:.1f}% |"
        )

        # Side-by-side qualitative inspection table
        detailed_sections.append(f"\n### Playlist: {subject} ({notes})\n")
        detailed_sections.append("| Topic # | LLM Topic (Range) | Embeddings Topic (Range) | Hybrid Topic (Range) | Human Sense Rating (1-5) |")
        detailed_sections.append("|---|---|---|---|---|")

        max_rows = max(len(llm_topics), len(emb_topics), len(hyb_topics))
        for r in range(max_rows):
            t_llm = llm_topics[r] if r < len(llm_topics) else None
            t_emb = emb_topics[r] if r < len(emb_topics) else None
            t_hyb = hyb_topics[r] if r < len(hyb_topics) else None

            str_llm = f"{t_llm['name']} ({t_llm['start_index']}-{t_llm['end_index']})" if t_llm else "-"
            str_emb = f"{t_emb['name']} ({t_emb['start_index']}-{t_emb['end_index']})" if t_emb else "-"
            str_hyb = f"{t_hyb['name']} ({t_hyb['start_index']}-{t_hyb['end_index']})" if t_hyb else "-"

            detailed_sections.append(f"| {r + 1} | {str_llm} | {str_emb} | {str_hyb} | [ ] |")

    full_report = "\n".join(report_lines) + "\n" + "\n".join(comparisons) + "\n\n## Qualitative Topic Breakdown\n" + "\n".join(detailed_sections)

    with open(output_path, "w", encoding="utf-8") as out:
        out.write(full_report)

    print(f"Evaluation complete. Report written to {output_path}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Evaluate StudyFlow clustering algorithms.")
    parser.add_argument("--csv", default="docs/playlist_library.csv", help="Path to input playlist library CSV")
    parser.add_argument("--output", default="docs/clustering_eval_report.md", help="Output markdown report path")
    parser.add_argument("--dry-run", action="store_true", default=True, help="Run offline dry run using mock data")
    args = parser.parse_args()

    run_evaluation(args.csv, args.output, dry_run=args.dry_run)
