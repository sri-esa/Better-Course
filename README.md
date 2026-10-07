# StudyFlow — AI-Powered Study Planner for YouTube Playlists (MERN Stack)

StudyFlow transforms YouTube study playlists into structured, realistic study schedules with academic topic grouping, estimated study effort, weekly deadlines, video progress tracking, and automatic replanning.

Built strictly on the **MERN** stack (**M**ongoDB, **E**xpress.js, **R**eact, **N**ode.js).

---

## 🎓 Why StudyFlow for College & Evaluator Demonstrations

- **Strictly MERN Stack:** Built entirely in JavaScript/Node.js and React. No extraneous frameworks or microservices.
- **Simple & Student-Friendly Codebase:** Built without over-engineering or complex state management. Any student can comfortably explain every function in Express and React.
- **Editorial Cinematic Design:** Inspired by modern creative-tech studios, featuring dark aesthetics, oversized editorial typography, restrained electric lime accents, and smooth responsive cards.
- **Robust Offline Presentation Mode:** Works seamlessly even without YouTube API keys, internet, or local MongoDB via realistic built-in fallback courses (e.g. *Operating Systems Complete Course* and *Data Structures & Algorithms*).

---

## 🛠️ Architecture & Tech Stack

### MERN Components:
- **M (Database):** MongoDB with Mongoose (with in-memory fail-safe persistence for offline college presentations)
- **E (Backend Framework):** Express.js
- **R (Frontend Library):** React 19 + Vite + Tailwind CSS v4 + React Router v7 + Lucide React
- **N (Runtime):** Node.js v22

### AI & Media Services:
- **YouTube Service:** `server/services/youtube.js` (playlist parsing, pagination, ISO 8601 duration parser)
- **AI Clustering:** `server/services/clustering.js` (Gemini Flash topic grouping with deterministic fallback)
- **Scheduler Engine:** `server/services/scheduler.js` (Deterministic effort calculation and deadline distribution)

---

## 📁 Project Structure

```text
studyflow/
├── server/                 # Express & Node.js backend
│   ├── models/             # Mongoose schemas (StudyPlan)
│   ├── routes/             # Express API endpoints (/api)
│   ├── services/           # YouTube parsing, AI clustering, and scheduling logic
│   ├── .env                # Port and API keys
│   ├── index.js            # Express app entrypoint
│   └── package.json
├── frontend/               # React + Vite frontend
│   ├── src/
│   │   ├── components/     # Navbar, Footer
│   │   ├── pages/          # Landing, CreatePlan, StudyPlan, Dashboard, PlaylistDetails
│   │   ├── App.jsx         # React Router setup
│   │   └── main.jsx        # Root render
│   ├── index.html
│   ├── vite.config.js
│   └── package.json
└── README.md
```

---

## 🚀 Getting Started

### 1. Prerequisites
- Node.js 18+ and npm
- (Optional) Local MongoDB instance or MongoDB Atlas URI

### 2. Backend Setup
```bash
cd server

# Install dependencies
npm install

# Start Express server
node index.js
```
The server will start on [http://127.0.0.1:8000](http://127.0.0.1:8000).

### 3. Frontend Setup
```bash
cd frontend

# Install dependencies
npm install

# Run development server
npm run dev
```
Open [http://localhost:5173](http://localhost:5173) in your browser.

---

## 📋 API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/health` | Health check endpoint (`{"status": "ok"}`) |
| `POST` | `/api/playlists/analyze` | Analyzes playlist, groups topics, estimates effort, and generates weekly schedule |
| `GET` | `/api/playlists/:playlistId` | Retrieves playlist overview and syllabus breakdown |
| `GET` | `/api/plans/:planId` | Retrieves full study plan, topic modules, and weekly timeline |
| `GET` | `/api/plans/latest/current` | Returns the most recently active study plan |
| `PATCH` | `/api/progress/:videoId` | Marks a video as completed or incomplete |
| `POST` | `/api/plans/:planId/replan` | Deterministically recalculates and redistributes remaining workload |

---

## 💡 How Study Effort & Scheduling Works

1. **Study Effort Multiplier:**
   - **Relaxed (1.25x):** Basic viewing and brief conceptual notes.
   - **Balanced (1.5x):** Standard active note-taking and pausing.
   - **Intensive (2.0x):** Code practice, problem solving, and detailed revisions.
2. **Feasibility Formula:**
   $$\text{Required Hours/Week} = \frac{\text{Total Estimated Effort Hours}}{\text{Weeks Available to Target Date}}$$
   If $\text{Hours Available} \ge \text{Required Hours}$, status is marked as **`FEASIBLE`**. Otherwise, it alerts **`NEEDS X.XH/WEEK`**.
3. **Deterministic Replanning:**
   When a student falls behind, the replanner filters for uncompleted topics and redistributes the remaining hours across remaining weeks without calling LLMs.
