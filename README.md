# StudyFlow: AI-Powered Study Planner for YouTube Playlists

StudyFlow converts unstructured YouTube educational playlists into structured, time-bound curricula with realistic effort estimation, weekly schedules, progress tracking, and adaptive re-planning.

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
5. Run tests:
   ```bash
   python -m pytest
   ```
6. Start the development server:
   ```bash
   uvicorn app.main:app --reload --port 8000
   ```

Check health: `http://localhost:8000/api/health`

## Repository Structure
```
studyflow/
├── backend/
│   ├── app/
│   │   ├── api/          # FastAPI route handlers
│   │   ├── services/     # Core domain services
│   │   ├── models/       # SQLAlchemy models
│   │   └── main.py       # App entrypoint
│   └── tests/            # Pytest test suite
├── frontend/             # React SPA
├── docs/                 # Documentation and API contracts
└── README.md
```
