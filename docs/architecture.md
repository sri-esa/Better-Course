# StudyFlow: System Architecture

StudyFlow transforms unstructured educational YouTube playlists into followable, structured curricula with difficulty-adjusted effort estimates and deterministic weekly pacing.

---

## High-Level Architecture

```
┌─────────────────────────┐          HTTPS/JSON          ┌───────────────────────────────────────────────┐
│       React SPA         │ ───────────────────────────> │                    FastAPI                    │
│   (Vite + Tailwind)     │ <─────────────────────────── │ api/                                          │
│                         │                              │   POST /api/analyze                           │
│                         │                              │   GET  /api/plans/{id}                        │
│                         │                              │   PATCH /api/plans/{id}/progress              │
│                         │                              │   POST /api/plans/{id}/replan                 │
│                         │                              │   POST /api/playlists                         │
│                         │                              │   GET  /api/health                            │
│                         │                              │ services/                                     │
│                         │                              │   youtube.py     (ingestion & filtering)      │
│                         │                              │   clustering/    (LLM, embeddings, hybrid)    │
│                         │                              │   effort.py      (difficulty multipliers)     │
│                         │                              │   scheduler.py   (deterministic packing)      │
│                         │                              │   plans.py       (video assignment & replan)  │
│                         │                              │ models/          (SQLAlchemy 2.0 ORM)         │
└─────────────────────────┘                              └───────────────────────┬───────────────────────┘
                                                                                 │
                                                    ┌────────────────────────────┴──────────────────────┐
                                                    ▼                                                   ▼
                                         YouTube Data API v3                                  Pluggable LLM Provider
                                         (metadata, durations)                                (Gemini 1.5 Flash / Fake)
```

---

## Core Domain Services

### 1. Ingestion (`services/youtube.py`)
- **URL & ID Parsing**: Accepts standard playlists (`youtube.com/playlist?list=...`), watch links with playlist params, short links (`youtu.be`), or bare playlist IDs. Mixes (`RD...`) and foreign domains are rejected with `INVALID_URL`.
- **Duration Parsing**: Converts ISO 8601 durations (`PT#H#M#S`, `P#DT#H#M#S`) into exact integer seconds.
- **Filtering**: Filters deleted/private videos, live broadcasts, zero-duration videos, and duplicate video IDs. Skipped videos are tracked in playlist `warnings`.
- **Caching**: Playlists are cached in the database for 24 hours (`PLAYLIST_CACHE_HOURS`).

### 2. Topic Clustering (`services/clustering/`)
- **LLM Clustering (`llm_clusterer.py`)**: Prompts the LLM with strict index-range rules and target topic duration hints. For playlists exceeding 120 videos, processes in 100-video windows with context stitching. Retries up to 2 times on validation error before falling back to embeddings.
- **Embedding Clustering (`embedding_clusterer.py`)**: Uses sentence-transformers (`all-MiniLM-L6-v2`) and scikit-learn `AgglomerativeClustering` with an order-preserving linear connectivity chain to guarantee contiguous topic boundaries. Degrades gracefully to duration chunking if PyTorch/embeddings are not installed.
- **Hybrid Clustering (`hybrid_clusterer.py`)**: Fixes topic boundaries with embeddings and invokes the LLM solely for topic naming, difficulty assessment, and summaries.
- **Caching**: Deduplicated by `(playlist_id, method, videos_hash)`.

### 3. Effort Estimation (`services/effort.py`)
Applies configurable multipliers based on educational difficulty to reflect real study time (including note-taking and practice):
- Beginner: **1.25x**
- Intermediate: **1.5x**
- Advanced: **2.0x**

### 4. Scheduler Engine (`services/scheduler.py`)
A deterministic, pure function packing topics into consecutive 7-day buckets:
- Never splits topics across weeks unless a single topic exceeds one week's capacity (spilled topic).
- Respects order without backfilling gaps.
- Computes topic deadlines and feasibility against optional target completion dates.

### 5. Plans & Video Assignment (`services/plans.py`)
- Maps continuous topic effort to discrete video boundaries: videos are assigned to weekly chunks by their cumulative effort offset.
- Computes effort-weighted completion and dynamic status (`not_started`, `on_track`, `ahead`, `behind`, `complete`).
- Adaptive Re-planning: Adjusts the student's pace factor based on logged actual seconds vs estimated seconds and reschedules remaining uncompleted videos from `today`.
