from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.db import get_db
from app.errors import AppError
from app.models.entities import Plan
from app.schemas.plan import PlanResponse
from app.services.plans import format_plan_response

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
