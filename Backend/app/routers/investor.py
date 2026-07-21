from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app import email_service
from app.auth import require_roles
from app.database import get_db
from app.models import KPI, Project, ProjectInvestment, Role, User, Visibility
from app.roi import DISCLAIMER, score_project
from app.routers.pipeline import _project_to_detail, _project_to_response
from app.schemas import (
    ImpactLink,
    InvestorOverviewResponse,
    InvestorProjectDetailResponse,
    InvestorProjectResponse,
    KPIResponse,
    MessageResponse,
    ProjectInvestmentCreate,
    RoiComponent,
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
    if project.visibility != Visibility.PUBLIC or project.trl < 4:
        raise HTTPException(status_code=404, detail="Project not found")
    return project


def _to_investor_project(project: Project, db: Session) -> InvestorProjectResponse:
    base = _project_to_response(project, db)
    scored = score_project(project)
    impact = scored.get("impact_link")
    return InvestorProjectResponse(
        **base.model_dump(),
        indicative_score=scored["indicative_score"],
        indicative_band=scored["indicative_band"],
        illustrative_multiple=scored["illustrative_multiple"],
        roi_components=[RoiComponent.model_validate(c) for c in scored["roi_components"]],
        impact_link=ImpactLink.model_validate(impact) if impact else None,
        roi_disclaimer=scored["roi_disclaimer"],
    )


def _to_investor_detail(project: Project, db: Session) -> InvestorProjectDetailResponse:
    base = _project_to_detail(project, db)
    scored = score_project(project)
    impact = scored.get("impact_link")
    return InvestorProjectDetailResponse(
        **base.model_dump(),
        indicative_score=scored["indicative_score"],
        indicative_band=scored["indicative_band"],
        illustrative_multiple=scored["illustrative_multiple"],
        roi_components=[RoiComponent.model_validate(c) for c in scored["roi_components"]],
        impact_link=ImpactLink.model_validate(impact) if impact else None,
        roi_disclaimer=scored["roi_disclaimer"],
    )


@router.get("/overview", response_model=InvestorOverviewResponse)
def get_overview(
    db: Session = Depends(get_db),
    _: User = Depends(require_roles([Role.INVESTOR])),
):
    kpis = _investor_kpis(db)
    hth = next((k for k in kpis if k.metric_name == "hth_occupancy"), None)

    projects = (
        db.query(Project)
        .filter(Project.visibility == Visibility.PUBLIC, Project.trl >= 4)
        .all()
    )
    scored = [_to_investor_project(p, db) for p in projects]
    scored.sort(key=lambda p: (p.indicative_score, p.trl), reverse=True)

    return InvestorOverviewResponse(
        kpis=[KPIResponse.model_validate(k) for k in kpis],
        hth_occupancy=KPIResponse.model_validate(hth) if hth else None,
        projects=scored,
        investable_count=len(scored),
        roi_disclaimer=DISCLAIMER,
    )


@router.get("/projects/{project_id}", response_model=InvestorProjectDetailResponse)
def get_project_detail(
    project_id: str,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles([Role.INVESTOR])),
):
    project = _get_investable_project(db, project_id)
    return _to_investor_detail(project, db)


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
