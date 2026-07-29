from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.auth import get_current_user, require_roles
from app.database import get_db
from app.models import KPI, Role, User
from app.schemas import KPIResponse, KPIUpdate

router = APIRouter(prefix="/impact", tags=["impact"])


@router.get("/kpis", response_model=list[KPIResponse])
def get_public_kpis(audience: str = "all", db: Session = Depends(get_db)):
    kpis = db.query(KPI).all()
    if audience == "all":
        filtered = [k for k in kpis if "all" in (k.audience or [])]
    else:
        filtered = [
            k for k in kpis
            if audience in (k.audience or []) or "all" in (k.audience or [])
        ]
    return filtered


@router.get("/kpis/all", response_model=list[KPIResponse])
def get_all_kpis(
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    return db.query(KPI).all()


@router.patch("/kpis/{kpi_id}", response_model=KPIResponse)
def update_kpi(
    kpi_id: str,
    body: KPIUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles([Role.ADMIN])),
):
    kpi = db.query(KPI).filter(KPI.id == kpi_id).first()
    if not kpi:
        raise HTTPException(status_code=404, detail="KPI not found")
    if body.value is not None:
        kpi.value = body.value
    if body.display_value is not None:
        kpi.display_value = body.display_value
    db.commit()
    db.refresh(kpi)
    return kpi
