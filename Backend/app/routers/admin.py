from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.auth import require_roles
from app.database import get_db
from app.models import (
    Event,
    EventType,
    InvestorEnquiry,
    KPI,
    RewardTier,
    Role,
    TenantEnquiry,
    User,
)
from app.schemas import (
    EnquiriesListResponse,
    EventAdminResponse,
    EventCreate,
    InvestorEnquiryResponse,
    KPIResponse,
    KPIUpdate,
    TenantEnquiryResponse,
    UserAdminResponse,
    UserAdminUpdate,
)

router = APIRouter(prefix="/admin", tags=["admin"])

_TYPE_PREFIX = {
    EventType.CONFERENCE: "CONF",
    EventType.WORKSHOP: "WORKSHOP",
    EventType.SHOWCASE: "SHOWCASE",
    EventType.NETWORKING: "NET",
}


def _generate_qr_code(event_type: EventType, event_date, db: Session) -> str:
    prefix = _TYPE_PREFIX[event_type]
    month = event_date.strftime("%m")
    base = f"RHIP-{prefix}-{event_date.year}-{month}"
    code = base
    suffix = 1
    while db.query(Event).filter(Event.qr_code == code).first():
        code = f"{base}-{suffix}"
        suffix += 1
    return code


def _sync_event_totals(year: int, db: Session) -> None:
    total = db.query(Event).filter(Event.event_year == year).count()
    db.query(RewardTier).filter(RewardTier.year == year).update(
        {"total_events_in_year": total},
        synchronize_session=False,
    )


@router.get("/users", response_model=list[UserAdminResponse])
def list_users(
    db: Session = Depends(get_db),
    _: User = Depends(require_roles([Role.ADMIN])),
):
    return db.query(User).order_by(User.created_at.desc()).all()


@router.patch("/users/{user_id}", response_model=UserAdminResponse)
def update_user(
    user_id: str,
    body: UserAdminUpdate,
    db: Session = Depends(get_db),
    admin: User = Depends(require_roles([Role.ADMIN])),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.id == admin.id and body.is_active is False:
        raise HTTPException(status_code=400, detail="Cannot deactivate your own account")
    if body.role is not None:
        user.role = body.role
    if body.is_active is not None:
        user.is_active = body.is_active
    db.commit()
    db.refresh(user)
    return user


@router.get("/events", response_model=list[EventAdminResponse])
def list_events(
    db: Session = Depends(get_db),
    _: User = Depends(require_roles([Role.ADMIN])),
):
    return db.query(Event).order_by(Event.date.desc()).all()


@router.post("/events", response_model=EventAdminResponse)
def create_event(
    body: EventCreate,
    db: Session = Depends(get_db),
    admin: User = Depends(require_roles([Role.ADMIN])),
):
    event_year = body.date.year
    qr_code = _generate_qr_code(body.type, body.date, db)
    event = Event(
        name=body.name,
        date=body.date,
        event_year=event_year,
        qr_code=qr_code,
        type=body.type,
        created_by=admin.id,
    )
    db.add(event)
    db.flush()
    _sync_event_totals(event_year, db)
    db.commit()
    db.refresh(event)
    return event


@router.get("/enquiries", response_model=EnquiriesListResponse)
def list_enquiries(
    db: Session = Depends(get_db),
    _: User = Depends(require_roles([Role.ADMIN])),
):
    tenants = db.query(TenantEnquiry).order_by(TenantEnquiry.submitted_at.desc()).all()
    investors = db.query(InvestorEnquiry).order_by(InvestorEnquiry.submitted_at.desc()).all()
    return EnquiriesListResponse(
        tenants=[TenantEnquiryResponse.model_validate(t) for t in tenants],
        investors=[InvestorEnquiryResponse.model_validate(i) for i in investors],
    )


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
