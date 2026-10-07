from datetime import date, datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy.orm import Session

from app.config import get_settings
from app.db import get_db
from app.errors import AppError
from app.schemas.plan import AnalyzeRequest, PlanResponse
from app.services.clustering import get_or_create_clustering
from app.services.effort import build_topics
from app.services.plans import create_plan, format_plan_response
from app.services.youtube import get_or_fetch_playlist

router = APIRouter(prefix="/api/analyze", tags=["analyze"])
settings = get_settings()


@router.post("", response_model=PlanResponse, status_code=201)
def analyze_playlist(
    request: Request,
    req: AnalyzeRequest,
    today: Optional[str] = Query(None, description="Client local date YYYY-MM-DD"),
    db: Session = Depends(get_db),
):
    # 1. Date normalization and validation
    now_date_str = datetime.now(timezone.utc).date().isoformat()
    start_date = req.start_date or now_date_str

    if req.target_date:
        if date.fromisoformat(req.target_date) < date.fromisoformat(start_date):
            raise AppError(
                "VALIDATION_ERROR",
                "target_date cannot be before start_date.",
                status_code=422,
            )

    # 2. Ingest or retrieve cached playlist
    playlist = get_or_fetch_playlist(db, req.playlist_url)

    # 3. Topic clustering (retrieves cache or computes)
    clustering = get_or_create_clustering(db, playlist, method=req.clustering_method)

    # 4. Effort estimation & topic snapshot
    videos_dicts = [
        {
            "youtube_video_id": v.youtube_video_id,
            "duration_seconds": v.duration_seconds,
            "title": v.title,
            "thumbnail_url": v.thumbnail_url,
        }
        for v in playlist.videos
    ]
    topics_snapshot = build_topics(clustering.result_json, videos_dicts)

    # 5. Create plan with scheduler & video assignment
    plan = create_plan(
        db=db,
        playlist=playlist,
        clustering_method_used=clustering.method_used,
        topics_json=topics_snapshot,
        hours_per_week=req.hours_per_week,
        start_date=start_date,
        target_date=req.target_date,
    )

    # 6. Format and return plan response
    return format_plan_response(plan, today_str=today or now_date_str)
