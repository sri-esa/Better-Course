# Better-Course
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

## Tech Stack

| Layer | Choice |
|---|---|
| Frontend | React + Tailwind |
| Backend | FastAPI (Python) |
| Database | PostgreSQL (SQLite for prototyping) |
| AI | LLM API + sentence embeddings |
| Data source | YouTube Data API v3 |
| Deployment | Vercel (frontend), Render/Railway (backend) |

## Team and Responsibilities

| Member | Role |
|---|---|
| Member 1 | Backend and Data Lead |
| Member 2 | AI and Scheduling Lead |
| Member 3 | Frontend Lead |
| Member 4 | Content, Testing and Community Lead |

---

### Member 1: Backend and Data Lead

**Goal:** get clean, reliable playlist data into the system and expose it through a stable API.

**Tasks**
- Set up the FastAPI project, folder structure and database schema (`playlists`, `videos`, `topics`, `plans`, `progress`)
- Build the YouTube ingestion service:
  - Parse the playlist ID from any valid URL format
  - Fetch all video IDs with `playlistItems.list` (handle pagination)
  - Fetch durations, titles and descriptions with `videos.list`
  - Convert ISO 8601 durations to seconds
- Handle edge cases: private or deleted videos, livestreams, very long playlists, API quota limits
- Add caching so the same playlist isn't fetched twice
- Build and document the REST endpoints (see `docs/api-contract.md`)
- Deploy the backend

**Deliverables:** working `/playlist` endpoint, DB migrations, deployed backend URL, endpoint docs.

---

### Member 2: AI and Scheduling Lead

**Goal:** the brain of the product, turning a flat list of videos into topics and a realistic schedule.

**Tasks**
- **Topic clustering**
  - Baseline: cluster videos using title and description embeddings
  - LLM pass: send ordered titles to the LLM and get back named topics with a difficulty tag, preserving playlist order
  - Optional upgrade: use transcripts for better accuracy
- **Effort estimation:** watch time multiplied by an adjustable factor (for example 1.5 to 2x) based on difficulty
- **Scheduler engine** (deterministic, not LLM-based):
  - Pack topics into weekly buckets given hours per week
  - Don't split a topic across weeks unless it exceeds one week's capacity
  - Output a weekly plan with topic deadlines and a final completion date
  - Feasibility check ("you need 12 hrs/week to finish by your date")
- **Replanning:** re-run the scheduler on remaining videos when the student falls behind or gets ahead
- Write unit tests for the scheduler

**Deliverables:** `clustering.py`, `scheduler.py`, test suite, short write-up comparing LLM-only, embeddings-only and hybrid clustering.

---

### Member 3: Frontend Lead

**Goal:** make the whole thing feel simple and usable.

**Tasks**
- Set up the React app with Tailwind and routing
- Build the input page: playlist link field, hours per week, target date
- Build the plan view: timeline by week, then topics, then videos with checkboxes
- Build the dashboard: overall progress bar, current week, "on track / behind" status
- Connect to the backend API and handle loading and error states
- Make it responsive (many students will use phones)
- Start with hardcoded sample JSON so work doesn't wait on the backend

**Deliverables:** deployed frontend, reusable components, responsive layouts.

---

### Member 4: Content, Testing and Community Lead

**Goal:** make sure StudyFlow works on real study material and is easy for real students to understand. You don't need to write code for this role.

**Tasks**
- **Playlist library:** collect 15 to 20 good study playlists across different subjects (for example DSA, DBMS, OS, Maths, GATE prep). Put them in a shared sheet with link, subject, and number of videos. The team uses these as test cases throughout development.
- **Manual testing:** once each milestone is ready, try the app with those playlists and report anything confusing or broken using the GitHub Issues template (what you did, what you expected, what happened, screenshot).
- **User feedback:** get 10 to 15 students to try the app and fill a short feedback form (was the plan realistic, were the topics sensible, what was confusing). Summarize the results in a short doc.
- **Wording and clarity:** read through the app's text (button labels, error messages, instructions) and suggest simpler wording.
- **Demo and docs:** help record the demo video and write the "How to use StudyFlow" guide for students.
- **Sharing:** help spread the word in college groups when we launch.

**Deliverables:** playlist library sheet, bug reports, feedback summary, user guide, demo video.

---

## How We Work Together

1. **Week 1 (everyone):** agree on the API contract (JSON shapes for playlist, topics and weekly plan) and write it in `docs/api-contract.md`.
2. **Mock early:** the frontend builds against sample JSON, the scheduler against fake topic data, so nobody is blocked.
3. **Integrate at the end of weeks 3 and 5**, not just at the finish.
4. **Git workflow:** one repo, feature branches, pull requests reviewed by at least one other member. `main` must always run.
5. **Weekly sync:** 30 minutes, each person shares what's done, what's next, and what's blocking.

## Timeline

| Week | Focus |
|---|---|
| 1 | Scope, API contract, repo setup, stack decisions, playlist library started |
| 2-3 | Parallel build: ingestion, clustering, UI skeleton |
| 3 (end) | First integration: pasted link produces a topic breakdown |
| 4-5 | Scheduler wired in, plan view, progress tracking, replanning |
| 6 | User testing, bug fixes, deployment, docs, demo video |

## Repository Structure

```
studyflow/
├── backend/
│   ├── app/
│   │   ├── api/          # routes
│   │   ├── services/     # youtube.py, clustering.py, scheduler.py
│   │   ├── models/       # DB schemas
│   │   └── main.py
│   └── tests/
├── frontend/
│   └── src/              # pages, components, hooks
├── docs/                 # api-contract.md, architecture, user guide, feedback summary
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