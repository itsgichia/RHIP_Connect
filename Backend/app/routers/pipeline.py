from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.auth import get_optional_user, require_roles
from app.database import get_db
from app.models import Project, ProjectInvestment, Readiness, Role, User, Visibility
from app.schemas import (
    FundingBreakdownItem,
    ProjectCreate,
    ProjectDetailResponse,
    ProjectListResponse,
    ProjectResponse,
)

router = APIRouter(prefix="/pipeline", tags=["pipeline"])


def _months_since(start: Optional[date]) -> int:
    if not start:
        return 0
    today = date.today()
    return max(0, (today.year - start.year) * 12 + today.month - start.month)


def _project_to_response(project: Project, db: Session) -> ProjectResponse:
    lead = db.query(User).filter(User.id == project.lead_researcher_id).first()
    return ProjectResponse(
        id=project.id,
        title=project.title,
        description=project.description,
        stage=project.stage,
        specialty_area=project.specialty_area,
        readiness=project.readiness,
        visibility=project.visibility,
        lead_researcher_name=lead.name if lead else None,
        funding_goal=project.funding_goal or 0,
        funding_raised=project.funding_raised or 0,
        started_at=project.started_at,
    )


def _project_to_detail(project: Project, db: Session) -> ProjectDetailResponse:
    base = _project_to_response(project, db)
    goal = project.funding_goal or 0
    raised = project.funding_raised or 0
    investor_count = (
        db.query(ProjectInvestment)
        .filter(ProjectInvestment.project_id == project.id)
        .count()
    )
    breakdown = [
        FundingBreakdownItem.model_validate(item)
        for item in (project.funding_breakdown or [])
    ]
    return ProjectDetailResponse(
        **base.model_dump(),
        funding_breakdown=breakdown,
        duration_months=_months_since(project.started_at),
        funding_progress_pct=round((raised / goal) * 100, 1) if goal > 0 else 0,
        investor_count=investor_count,
    )


def _allowed_visibilities(user: Optional[User]) -> list[Visibility]:
    if not user:
        return [Visibility.PUBLIC]
    if user.role == Role.ADMIN:
        return [Visibility.PUBLIC, Visibility.PRECINCT, Visibility.INTERNAL]
    if user.role == Role.INVESTOR:
        return [Visibility.PUBLIC]
    return [Visibility.PUBLIC, Visibility.PRECINCT]


@router.get("/projects", response_model=ProjectListResponse)
def list_projects(
    stage: Optional[int] = None,
    specialty: Optional[str] = None,
    readiness: Optional[str] = None,
    db: Session = Depends(get_db),
    user: Optional[User] = Depends(get_optional_user),
):
    query = db.query(Project).filter(Project.visibility.in_(_allowed_visibilities(user)))
    if stage is not None:
        query = query.filter(Project.stage == stage)
    if specialty:
        query = query.filter(Project.specialty_area == specialty)
    if readiness:
        try:
            query = query.filter(Project.readiness == Readiness(readiness))
        except ValueError:
            pass
    projects = query.order_by(Project.stage.desc()).all()
    return ProjectListResponse(projects=[_project_to_response(p, db) for p in projects])


@router.get("/projects/{project_id}", response_model=ProjectResponse)
def get_project(
    project_id: str,
    db: Session = Depends(get_db),
    user: Optional[User] = Depends(get_optional_user),
):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    if project.visibility not in _allowed_visibilities(user):
        raise HTTPException(status_code=403, detail="Not authorized")
    return _project_to_response(project, db)


@router.post("/projects", response_model=ProjectResponse)
def create_project(
    body: ProjectCreate,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles([Role.RESEARCHER, Role.ADMIN])),
):
    project = Project(
        title=body.title,
        description=body.description,
        stage=body.stage,
        specialty_area=body.specialty_area,
        readiness=body.readiness,
        visibility=body.visibility,
        lead_researcher_id=user.id,
    )
    db.add(project)
    db.commit()
    db.refresh(project)
    return _project_to_response(project, db)
