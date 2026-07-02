from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app import email_service
from app.auth import require_roles
from app.database import get_db
from app.models import KPI, Project, ProjectInvestment, Role, User, Visibility
from app.routers.pipeline import _project_to_detail, _project_to_response
from app.schemas import (
    InvestorOverviewResponse,
    KPIResponse,
    MessageResponse,
    ProjectDetailResponse,
    ProjectInvestmentCreate,
)

router = APIRouter(prefix="/investor", tags=["investor"])


def _investor_kpis(db: Session) -> list[KPI]:
    kpis = db.query(KPI).all()
    return [
        k for k in kpis
        if "investor" in (k.audience or []) or "all" in (k.audience or [])
    ]


def _get_investable_project(db: Session, project_id: str) -> Project:
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    if project.visibility != Visibility.PUBLIC or project.stage < 4:
        raise HTTPException(status_code=404, detail="Project not found")
    return project


@router.get("/overview", response_model=InvestorOverviewResponse)
def get_overview(
    db: Session = Depends(get_db),
    _: User = Depends(require_roles([Role.INVESTOR])),
):
    kpis = _investor_kpis(db)
    hth = next((k for k in kpis if k.metric_name == "hth_occupancy"), None)

    projects = (
        db.query(Project)
        .filter(Project.visibility == Visibility.PUBLIC, Project.stage >= 4)
        .order_by(Project.stage.desc())
        .all()
    )

    return InvestorOverviewResponse(
        kpis=[KPIResponse.model_validate(k) for k in kpis],
        hth_occupancy=KPIResponse.model_validate(hth) if hth else None,
        projects=[_project_to_response(p, db) for p in projects],
        investable_count=len(projects),
    )


@router.get("/projects/{project_id}", response_model=ProjectDetailResponse)
def get_project_detail(
    project_id: str,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles([Role.INVESTOR])),
):
    project = _get_investable_project(db, project_id)
    return _project_to_detail(project, db)


@router.post("/projects/{project_id}/invest", response_model=MessageResponse)
async def invest_in_project(
    project_id: str,
    body: ProjectInvestmentCreate,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles([Role.INVESTOR])),
):
    project = _get_investable_project(db, project_id)

    investment = ProjectInvestment(
        project_id=project.id,
        investor_id=user.id,
        amount=body.amount,
        message=body.message,
    )
    db.add(investment)
    project.funding_raised = (project.funding_raised or 0) + body.amount
    db.commit()
    db.refresh(investment)

    await email_service.send_project_investment_notification(
        project, user, investment
    )

    return MessageResponse(
        message=(
            f"Your expression of interest for AUD {body.amount:,.0f} in "
            f"\"{project.title}\" has been received. RHIP will be in touch."
        )
    )
