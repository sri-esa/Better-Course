# StudyFlow API Contract

Base URL: `/api`

All requests and responses use JSON format. Dates follow the ISO 8601 standard (`YYYY-MM-DD`).

---

## Standard Error Format

All error responses share a unified structure:

```json
{
  "error": {
    "code": "PLAYLIST_NOT_FOUND",
    "message": "Human-readable explanation of the error",
    "details": {}
  }
}
```

### Error Codes and HTTP Status Codes

| Error Code | HTTP Status | Description |
|---|---|---|
| `INVALID_URL` | 400 | Not a valid or supported YouTube playlist URL or ID |
| `VALIDATION_ERROR` | 422 | Invalid parameters, negative values, target date before start date |
| `PLAYLIST_NOT_FOUND` | 404 | Playlist does not exist or is inaccessible |
| `PLAYLIST_PRIVATE` | 403 | Playlist is marked private |
| `PLAYLIST_TOO_LARGE` | 422 | Playlist exceeds maximum supported limit (500 videos) |
| `PLAYLIST_EMPTY` | 422 | Playlist contains zero usable videos |
| `YOUTUBE_QUOTA_EXCEEDED` | 503 | YouTube API daily quota exceeded |
| `PLAN_NOT_FOUND` | 404 | Requested plan ID not found |
| `PLAN_COMPLETE` | 409 | Attempting to re-plan when all videos are already completed |
| `RATE_LIMITED` | 429 | Request rate limit exceeded |
| `INTERNAL_ERROR` | 500 | Unexpected server error (stack traces sanitized) |

---

## Endpoints

### 1. Health Check
`GET /api/health`

**Response (`200 OK`):**
```json
{
  "status": "ok"
}
```

---

### 2. Ingest Playlist (Inspect & Debug)
`POST /api/playlists`

**Request:**
```json
{
  "playlist_url": "https://www.youtube.com/playlist?list=PLxxxx",
  "refresh": false
}
```

**Response (`200 OK`):**
```json
{
  "id": "uuid-string",
  "youtube_playlist_id": "PLxxxx",
  "title": "Course Title",
  "channel_title": "Channel Name",
  "video_count": 42,
  "total_seconds": 25200,
  "warnings": [
    {
      "youtube_video_id": "abc",
      "title": "Private video",
      "reason": "private_or_deleted"
    }
  ],
  "fetched_at": "2026-10-07T12:00:00Z",
  "videos": [
    {
      "youtube_video_id": "vid_1",
      "position": 0,
      "title": "Intro Video",
      "description": "Video description...",
      "duration_seconds": 600,
      "thumbnail_url": "https://img.youtube.com/..."
    }
  ]
}
```

---

### 3. Analyze Playlist and Generate Plan
`POST /api/analyze?today=YYYY-MM-DD`

Rate limited (10/min default). Combines playlist ingestion, topic clustering, effort estimation, and deterministic weekly scheduling.

**Request:**
```json
{
  "playlist_url": "https://www.youtube.com/playlist?list=PLxxxx",
  "hours_per_week": 8.0,
  "start_date": "2026-10-12",
  "target_date": "2026-12-20",
  "clustering_method": "llm"
}
```

**Response (`201 Created`):**
```json
{
  "id": "5f1c2e1a-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
  "playlist": {
    "youtube_playlist_id": "PLxxxx",
    "title": "Data Structures Full Course",
    "channel_title": "Tech Channel",
    "video_count": 52,
    "total_watch_hours": 24.2,
    "warnings": []
  },
  "settings": {
    "hours_per_week": 8.0,
    "start_date": "2026-10-12",
    "target_date": "2026-12-20"
  },
  "summary": {
    "total_effort_hours": 38.5,
    "num_topics": 9,
    "num_weeks": 5,
    "completion_date": "2026-11-15",
    "feasible": true,
    "required_hours_per_week": 6.5,
    "pace_factor": 1.0,
    "replan_count": 0,
    "clustering_method_used": "llm"
  },
  "topics": [
    {
      "id": 1,
      "name": "Arrays and Strings",
      "difficulty": "beginner",
      "effort_hours": 6.5,
      "video_count": 7
    }
  ],
  "topic_deadlines": [
    {
      "topic_id": 1,
      "name": "Arrays and Strings",
      "deadline": "2026-10-18"
    }
  ],
  "weeks": [
    {
      "week": 1,
      "start": "2026-10-12",
      "end": "2026-10-18",
      "hours": 6.5,
      "topics": [
        {
          "topic_id": 1,
          "name": "Arrays and Strings",
          "hours": 6.5,
          "part": 1,
          "total_parts": 1,
          "videos": [
            {
              "youtube_video_id": "dQw4w9WgXcQ",
              "title": "Intro to Arrays",
              "duration_seconds": 720,
              "thumbnail_url": "https://img.youtube.com/...",
              "completed": false
            }
          ]
        }
      ]
    }
  ],
  "progress": {
    "completed_videos": 0,
    "total_videos": 52,
    "completed_effort_hours": 0.0,
    "percent_complete": 0.0,
    "planned_effort_hours_to_date": 0.0,
    "status": "not_started"
  }
}
```

---

### 4. Get Plan
`GET /api/plans/{plan_id}?today=YYYY-MM-DD`

Retrieves plan by ID with live completion status merged in.

**Response (`200 OK`):**
Returns the full Plan object (matching the schema above).

---

### 5. Update Progress
`PATCH /api/plans/{plan_id}/progress?today=YYYY-MM-DD`

**Request:**
```json
{
  "updates": [
    {
      "youtube_video_id": "dQw4w9WgXcQ",
      "completed": true,
      "actual_seconds": 1500
    }
  ]
}
```

**Response (`200 OK`):**
```json
{
  "progress": {
    "completed_videos": 1,
    "total_videos": 52,
    "completed_effort_hours": 0.3,
    "percent_complete": 0.8,
    "planned_effort_hours_to_date": 6.5,
    "status": "behind"
  }
}
```

---

### 6. Re-plan
`POST /api/plans/{plan_id}/replan?today=YYYY-MM-DD`

Re-schedules remaining uncompleted videos from `today`.

**Request:**
```json
{
  "hours_per_week": 10.0,
  "target_date": "2026-12-31",
  "start_date": "2026-10-20",
  "adaptive_pace": true
}
```

**Response (`200 OK`):**
Returns the full updated Plan object.
