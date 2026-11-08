
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, Query
from pymongo.database import Database

from app.errors import AppError
from app.mongo import get_database
from app.schemas.plan import (
    PlanResponse,
    ProgressUpdateRequest,
    ProgressUpdateResponse,
    ReplanRequest,
)
from app.services.plans import (
    _UNSET,
    _load_plan,
    compute_progress,
    format_plan_response,
    replan,
)

router = APIRouter(prefix="/api/plans", tags=["plans"])


@router.get("/{plan_id}", response_model=PlanResponse)
def get_plan(
    plan_id: str,
    today: Optional[str] = Query(
        None,
        description="Client local date YYYY-MM-DD",
    ),
    db: Database = Depends(get_database),
):
    plan = _load_plan(db, plan_id)

    return format_plan_response(plan, today_str=today)


@router.patch(
    "/{plan_id}/progress",
    response_model=ProgressUpdateResponse,
)
def update_progress(
    plan_id: str,
    req: ProgressUpdateRequest,
    today: Optional[str] = Query(
        None,
        description="Client local date YYYY-MM-DD",
    ),
    db: Database = Depends(get_database),
):
    plan = _load_plan(db, plan_id)

    # Verify that every submitted video belongs to this plan.
    plan_video_ids = {
        video.youtube_video_id
        for video in plan.playlist.videos
    }

    for item in req.updates:
        if item.youtube_video_id not in plan_video_ids:
            raise AppError(
                "VALIDATION_ERROR",
                f"Video ID '{item.youtube_video_id}' does not belong to this plan.",
                status_code=422,
            )

    now = datetime.now(timezone.utc)

    # Insert or update progress records in MongoDB.
    for item in req.updates:
        completed_at = now if item.completed else None
        actual_seconds = item.actual_seconds if item.completed else None

        db.progress.update_one(
            {
                "plan_id": plan.id,
                "youtube_video_id": item.youtube_video_id,
            },
            {
                "$set": {
                    "completed": item.completed,
                    "completed_at": completed_at,
                    "actual_seconds": actual_seconds,
                },
                "$setOnInsert": {
                    "plan_id": plan.id,
                    "youtube_video_id": item.youtube_video_id,
                },
            },
            upsert=True,
        )

    # Reload the plan to calculate progress using the saved records.
    updated_plan = _load_plan(db, plan.id)

    progress_data = compute_progress(
        updated_plan,
        updated_plan.progress_records,
        today_str=today,
    )

    return {"progress": progress_data}


@router.post("/{plan_id}/replan", response_model=PlanResponse)
def replan_plan(
    plan_id: str,
    req: ReplanRequest,
    today: Optional[str] = Query(
        None,
        description="Client local date YYYY-MM-DD",
    ),
    db: Database = Depends(get_database),
):
    plan = _load_plan(db, plan_id)

    target_date_val = (
        req.target_date
        if req.target_date is not None
        else _UNSET
    )

    updated_plan = replan(
        db=db,
        plan=plan,
        hours_per_week=req.hours_per_week,
        target_date=target_date_val,
        start_date=req.start_date,
        adaptive_pace=req.adaptive_pace,
        today_str=today,
    )

    return format_plan_response(
        updated_plan,
        today_str=today,
    )
