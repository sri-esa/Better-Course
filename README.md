# StudyFlow: AI-Powered Study Planner for YouTube Playlists

> Paste a YouTube study playlist. Get a topic-wise breakdown and weekly deadlines you can actually follow.

## Problem

YouTube has some of the best free study material out there, often better than paid courses. But playlists come with no structure: you don't know the total effort, there's no pacing, and nothing keeps you accountable. Students start strong and quietly drop off.

## Solution

StudyFlow turns any YouTube playlist into a time-bound study plan:

1. Fetches video metadata (titles, durations, descriptions) via the YouTube Data API
2. Uses embeddings and an LLM to group videos into coherent topics
3. Estimates real study effort per topic (watch time plus notes and practice)
4. Generates topic-wise weekly deadlines based on the student's available hours and target date
5. Tracks progress and re-plans automatically when the student falls behind

## Quickstart

### Prerequisites
- Python 3.11+
- Node.js 20+

### Backend Setup
1. Navigate to the backend directory:
   ```bash
   cd backend
   ```
2. Create and activate a virtual environment (optional but recommended):
   ```bash
   python -m venv venv
   # Windows:
   .\venv\Scripts\activate
   # Linux/macOS:
   source venv/bin/activate
   ```
3. Install dependencies:
   ```bash
   pip install -e ".[dev]"
   ```
4. Set up environment variables:
   ```bash
   cp .env.example .env
   # Edit .env and provide your YOUTUBE_API_KEY and LLM_API_KEY
   ```
5. Run migrations:
   ```bash
   alembic upgrade head
   ```
6. Run tests:
   ```bash
   python -m pytest
   ```
7. Start the development server:
   ```bash
   uvicorn app.main:app --reload --port 8000
   ```

Check health: `http://localhost:8000/api/health`

## Repository Structure

```
studyflow/
├── backend/
│   ├── alembic/          # Database migrations
│   ├── app/
│   │   ├── api/          # FastAPI route handlers
│   │   ├── services/     # Core domain services (youtube, clustering, scheduler, effort, plans)
│   │   ├── models/       # SQLAlchemy models
│   │   └── main.py       # App entrypoint
│   └── tests/            # Pytest test suite
├── frontend/             # React SPA (Vite + TypeScript + Tailwind)
├── docs/                 # Documentation and API contracts
└── README.md
```

## Roadmap

- Multi-playlist merging
- Calendar export
- Reminders
- User accounts
- Transcript-based clustering

## License

MIT
