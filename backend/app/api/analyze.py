
from datetime import date, datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, Query, Request
from pymongo.database import Database

from app.config import get_settings
from app.errors import AppError
from app.limiter import limiter
from app.mongo import get_database
from app.schemas.plan import AnalyzeRequest, PlanResponse
from app.services.clustering import get_or_create_clustering
from app.services.effort import build_topics
from app.services.plans import create_plan, format_plan_response
from app.services.youtube import get_or_fetch_playlist

router = APIRouter(prefix="/api/analyze", tags=["analyze"])
settings = get_settings()


@router.post("", response_model=PlanResponse, status_code=201)
@limiter.limit(settings.RATE_LIMIT_ANALYZE)
def analyze_playlist(
    request: Request,
    req: AnalyzeRequest,
    today: Optional[str] = Query(
        None,
        description="Client local date YYYY-MM-DD",
    ),
    db: Database = Depends(get_database),
):
    # 1. Normalize and validate dates.
    now_date_str = datetime.now(timezone.utc).date().isoformat()
    start_date = req.start_date or now_date_str

    if req.target_date:
        if date.fromisoformat(req.target_date) < date.fromisoformat(start_date):
            raise AppError(
                "VALIDATION_ERROR",
                "target_date cannot be before start_date.",
                status_code=422,
            )

    # 2. Fetch or retrieve the cached playlist.
    playlist = get_or_fetch_playlist(db, req.playlist_url)

    # 3. Retrieve or compute topic clustering.
    clustering = get_or_create_clustering(
        db,
        playlist,
        method=req.clustering_method,
    )

    # 4. Estimate effort and build topic snapshot.
    videos_dicts = [
        {
            "youtube_video_id": video.youtube_video_id,
            "duration_seconds": video.duration_seconds,
            "title": video.title,
            "thumbnail_url": video.thumbnail_url,
        }
        for video in playlist.videos
    ]

    topics_snapshot = build_topics(
        clustering.result_json,
        videos_dicts,
    )

    # 5. Generate and save the study plan.
    plan = create_plan(
        db=db,
        playlist=playlist,
        clustering_method_used=clustering.method_used,
        topics_json=topics_snapshot,
        hours_per_week=req.hours_per_week,
        start_date=start_date,
        target_date=req.target_date,
    )

    # 6. Return the existing frontend response format.
    return format_plan_response(
        plan,
        today_str=today or now_date_str,
    )
