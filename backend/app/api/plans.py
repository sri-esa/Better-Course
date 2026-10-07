from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.db import get_db
from app.errors import AppError
from app.models.entities import Plan, Progress
from app.schemas.plan import (
    PlanResponse,
    ProgressUpdateRequest,
    ProgressUpdateResponse,
    ReplanRequest,
)
from app.services.plans import _UNSET, compute_progress, format_plan_response, replan

router = APIRouter(prefix="/api/plans", tags=["plans"])


@router.get("/{plan_id}", response_model=PlanResponse)
def get_plan(
    plan_id: str,
    today: Optional[str] = Query(None, description="Client local date YYYY-MM-DD"),
    db: Session = Depends(get_db),
):
    plan = db.query(Plan).filter_by(id=plan_id).first()
    if not plan:
        raise AppError("PLAN_NOT_FOUND", f"Plan with ID '{plan_id}' not found.", status_code=404)

    return format_plan_response(plan, today_str=today)


@router.patch("/{plan_id}/progress", response_model=ProgressUpdateResponse)
def update_progress(
    plan_id: str,
    req: ProgressUpdateRequest,
    today: Optional[str] = Query(None, description="Client local date YYYY-MM-DD"),
    db: Session = Depends(get_db),
):
    plan = db.query(Plan).filter_by(id=plan_id).first()
    if not plan:
        raise AppError("PLAN_NOT_FOUND", f"Plan with ID '{plan_id}' not found.", status_code=404)

    plan_video_ids = {v.youtube_video_id for v in plan.playlist.videos}
    for item in req.updates:
        if item.youtube_video_id not in plan_video_ids:
            raise AppError(
                "VALIDATION_ERROR",
                f"Video ID '{item.youtube_video_id}' does not belong to this plan.",
                status_code=422,
            )

    now = datetime.now(timezone.utc)
    for item in req.updates:
        record = (
            db.query(Progress)
            .filter_by(plan_id=plan.id, youtube_video_id=item.youtube_video_id)
            .first()
        )
        if not record:
            record = Progress(plan_id=plan.id, youtube_video_id=item.youtube_video_id)
            db.add(record)

        record.completed = item.completed
        if item.completed:
            record.completed_at = now
            record.actual_seconds = item.actual_seconds
        else:
            record.completed_at = None
            record.actual_seconds = None

    db.commit()
    db.refresh(plan)

    progress_data = compute_progress(plan, plan.progress_records, today_str=today)
    return {"progress": progress_data}


@router.post("/{plan_id}/replan", response_model=PlanResponse)
def replan_plan(
    plan_id: str,
    req: ReplanRequest,
    today: Optional[str] = Query(None, description="Client local date YYYY-MM-DD"),
    db: Session = Depends(get_db),
):
    plan = db.query(Plan).filter_by(id=plan_id).first()
    if not plan:
        raise AppError("PLAN_NOT_FOUND", f"Plan with ID '{plan_id}' not found.", status_code=404)

    target_date_val = req.target_date if req.target_date is not None else _UNSET

    updated_plan = replan(
        db=db,
        plan=plan,
        hours_per_week=req.hours_per_week,
        target_date=target_date_val,
        start_date=req.start_date,
        adaptive_pace=req.adaptive_pace,
        today_str=today,
    )

    return format_plan_response(updated_plan, today_str=today)
