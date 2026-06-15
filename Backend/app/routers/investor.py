from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.auth import require_roles
from app.database import get_db
from app.models import KPI, Project, Role, User, Visibility
from app.routers.pipeline import _project_to_response
from app.schemas import InvestorOverviewResponse, KPIResponse

router = APIRouter(prefix="/investor", tags=["investor"])


def _investor_kpis(db: Session) -> list[KPI]:
    kpis = db.query(KPI).all()
    return [
        k for k in kpis
        if "investor" in (k.audience or []) or "all" in (k.audience or [])
    ]


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
