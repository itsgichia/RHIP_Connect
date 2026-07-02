import csv
import io
from datetime import date

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import KPI, Project, User, Visibility
from app.routers.pipeline import _months_since, _project_to_response
from app.schemas import (
    GovernmentOverviewResponse,
    GovernmentProjectResponse,
    KPIBreakdownItem,
    KPIDetailResponse,
    KPIResponse,
    KPITrendPoint,
)

router = APIRouter(prefix="/government", tags=["government"])

_TRANSLATION_STATUS = {
    "early": "Early discovery — pre-clinical exploration",
    "feasibility": "Feasibility assessment — preparing for clinical validation",
    "clinical": "Clinical validation — active trials and patient studies",
    "commercial": "Translation ready — approaching clinical adoption",
}

_FACILITY_SPLITS = {
    "hospital_beds": [
        ("Prince of Wales Hospital", 0.50, "Adult tertiary inpatient capacity"),
        ("Sydney Children's Hospital", 0.33, "Paediatric inpatient capacity"),
        ("Prince of Wales Private Hospital", 0.17, "Elective and maternity beds"),
    ],
    "allied_health": [
        ("Prince of Wales Hospital", 0.45, "Physio, OT, speech pathology, social work"),
        ("Sydney Children's Hospital", 0.35, "Paediatric allied health teams"),
        ("Community outreach (SESLHD)", 0.20, "District-wide community programs"),
    ],
    "patient_interactions": [
        ("Emergency & acute care", 0.42, "ED presentations and inpatient episodes"),
        ("Outpatient clinics", 0.38, "Specialist and GP-linked appointments"),
        ("Community & preventive care", 0.20, "Screening, education, and outreach"),
    ],
}

_GRANT_SPLITS = [
    ("NHMRC & MRFF", 0.45, "National competitive research funding"),
    ("UNSW & institutional", 0.25, "University and MRI-backed programs"),
    ("Industry co-funded", 0.18, "Precinct partnership grants"),
    ("Philanthropic & foundation", 0.12, "Charitable and foundation support"),
]


def _government_kpis(db: Session) -> list[KPI]:
    kpis = db.query(KPI).all()
    return [
        k for k in kpis
        if "government" in (k.audience or []) or "all" in (k.audience or [])
    ]


def _translation_projects(db: Session) -> list[Project]:
    return (
        db.query(Project)
        .filter(Project.visibility == Visibility.PUBLIC, Project.stage >= 4)
        .order_by(Project.stage.desc())
        .all()
    )


def _to_government_project(project: Project, db: Session) -> GovernmentProjectResponse:
    base = _project_to_response(project, db)
    return GovernmentProjectResponse(
        id=base.id,
        title=base.title,
        description=base.description,
        stage=base.stage,
        specialty_area=base.specialty_area,
        readiness=base.readiness,
        lead_researcher_name=base.lead_researcher_name,
        started_at=base.started_at,
        duration_months=_months_since(project.started_at),
        translation_status=_TRANSLATION_STATUS.get(
            project.readiness.value, "Active innovation project"
        ),
    )


def _trend_for_kpi(kpi: KPI) -> list[KPITrendPoint]:
    base = kpi.value
    years = [2022, 2023, 2024, 2025, 2026]
    growth = [0.78, 0.85, 0.92, 0.96, 1.0]
    points = []
    for year, factor in zip(years, growth):
        val = base * factor
        if kpi.unit == "%":
            display = f"{round(val)}%"
        elif kpi.metric_name == "research_grants":
            display = f"${val / 1_000_000:.0f}M"
        elif val >= 1_000_000:
            display = f"{val / 1_000_000:.1f}M"
        elif val >= 1_000:
            display = f"{int(val):,}"
        else:
            display = str(int(val)) if val == int(val) else f"{val:.1f}"
        points.append(KPITrendPoint(year=year, value=round(val, 2), display_value=display))
    return points


def _breakdown_for_kpi(kpi: KPI, db: Session) -> tuple[str, list[KPIBreakdownItem]]:
    if kpi.metric_name == "clinical_trials":
        projects = _translation_projects(db)
        trial_projects = [p for p in projects if p.stage >= 6]
        by_specialty: dict[str, int] = {}
        for p in trial_projects:
            by_specialty[p.specialty_area] = by_specialty.get(p.specialty_area, 0) + 1
        total = max(kpi.value, sum(by_specialty.values()) or 1)
        if not by_specialty:
            shares = [
                ("Mental Health & Neuroscience", 0.28),
                ("Personalised Medicine", 0.32),
                ("Rare Diseases", 0.18),
                ("Health Systems", 0.22),
            ]
            items = [
                KPIBreakdownItem(
                    label=label,
                    value=round(total * share),
                    display_value=str(round(total * share)),
                    description=f"Active trials in {label.lower()}",
                )
                for label, share in shares
            ]
        else:
            items = [
                KPIBreakdownItem(
                    label=label,
                    value=float(count),
                    display_value=str(count),
                    description=f"{count} linked precinct trial{'s' if count != 1 else ''}",
                )
                for label, count in sorted(by_specialty.items(), key=lambda x: -x[1])
            ]
        summary = (
            f"{int(kpi.value)} active clinical trials across the Randwick precinct, "
            "linking hospital care with university and MRI research."
        )
        return summary, items

    if kpi.metric_name == "research_grants":
        items = [
            KPIBreakdownItem(
                label=label,
                value=round(kpi.value * share),
                display_value=f"${kpi.value * share / 1_000_000:.1f}M",
                description=desc,
            )
            for label, share, desc in _GRANT_SPLITS
        ]
        summary = (
            f"{kpi.display_value} in active research grants supporting translation "
            "from discovery to clinical care across the precinct."
        )
        return summary, items

    if kpi.metric_name in _FACILITY_SPLITS:
        items = [
            KPIBreakdownItem(
                label=label,
                value=round(kpi.value * share),
                display_value=(
                    f"{round(kpi.value * share):,}"
                    if kpi.unit != "%"
                    else f"{round(kpi.value * share)}%"
                ),
                description=desc,
            )
            for label, share, desc in _FACILITY_SPLITS[kpi.metric_name]
        ]
        summary = f"{kpi.display_label}: {kpi.display_value} across Randwick campus facilities and programs."
        return summary, items

    if kpi.metric_name == "workforce_pct":
        items = [
            KPIBreakdownItem(
                label="Health & clinical services",
                value=25,
                display_value="25%",
                description="Hospital, community, and allied health workforce",
            ),
            KPIBreakdownItem(
                label="Education & research",
                value=15,
                display_value="15%",
                description="UNSW, MRIs, and research institutes on campus",
            ),
            KPIBreakdownItem(
                label="Other campus sectors",
                value=60,
                display_value="60%",
                description="Support services, industry, and precinct operations",
            ),
        ]
        summary = (
            "40% of the campus workforce is in health and education — "
            "the highest concentration in any Australian health precinct."
        )
        return summary, items

    if kpi.metric_name == "unsw_ranking":
        items = [
            KPIBreakdownItem(
                label="International research collaborations",
                value=1,
                display_value="#1",
                description="Australia's leading research network ranking",
            ),
            KPIBreakdownItem(
                label="Medicine & health disciplines",
                value=19,
                display_value="Top 19 globally",
                description="UNSW Medicine & Health global standing",
            ),
            KPIBreakdownItem(
                label="Precinct partner institutions",
                value=4,
                display_value="4 MRIs",
                description="Medical research institutes co-located at Randwick",
            ),
        ]
        summary = (
            "The precinct combines Australia's #1 international research network "
            "with co-located hospitals and medical research institutes."
        )
        return summary, items

    summary = f"Latest reported figure for {kpi.display_label.lower()}."
    return summary, [
        KPIBreakdownItem(
            label=kpi.display_label,
            value=kpi.value,
            display_value=kpi.display_value,
            description=f"Reporting period: {kpi.period}",
        )
    ]


@router.get("/overview", response_model=GovernmentOverviewResponse)
def get_overview(db: Session = Depends(get_db)):
    kpis = _government_kpis(db)
    projects = _translation_projects(db)
    return GovernmentOverviewResponse(
        kpis=[KPIResponse.model_validate(k) for k in kpis],
        projects=[_to_government_project(p, db) for p in projects],
        translation_count=len(projects),
    )


@router.get("/kpis/{metric_name}", response_model=KPIDetailResponse)
def get_kpi_detail(metric_name: str, db: Session = Depends(get_db)):
    kpi = db.query(KPI).filter(KPI.metric_name == metric_name).first()
    if not kpi:
        raise HTTPException(status_code=404, detail="Metric not found")
    if "government" not in (kpi.audience or []) and "all" not in (kpi.audience or []):
        raise HTTPException(status_code=404, detail="Metric not found")
    summary, breakdown = _breakdown_for_kpi(kpi, db)
    return KPIDetailResponse(
        kpi=KPIResponse.model_validate(kpi),
        summary=summary,
        breakdown=breakdown,
        trend=_trend_for_kpi(kpi),
    )


@router.get("/projects/{project_id}", response_model=GovernmentProjectResponse)
def get_project_detail(project_id: str, db: Session = Depends(get_db)):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project or project.visibility != Visibility.PUBLIC or project.stage < 4:
        raise HTTPException(status_code=404, detail="Project not found")
    return _to_government_project(project, db)


@router.get("/export")
def export_impact_snapshot(db: Session = Depends(get_db)):
    kpis = _government_kpis(db)
    projects = _translation_projects(db)

    buffer = io.StringIO()
    writer = csv.writer(buffer)
    writer.writerow(["RHIP Connect — Precinct Impact Snapshot"])
    writer.writerow(["Period", "2026"])
    writer.writerow(["Generated", date.today().isoformat()])
    writer.writerow([])
    writer.writerow(["Key Metrics"])
    writer.writerow(["Metric", "Value", "Category", "Period"])
    for kpi in kpis:
        writer.writerow([kpi.display_label, kpi.display_value, kpi.category.value, kpi.period])
    writer.writerow([])
    writer.writerow(["Translation Pipeline"])
    writer.writerow(["Title", "Specialty", "Stage", "Readiness", "Lead Researcher"])
    for project in projects:
        lead_user = db.query(User).filter(User.id == project.lead_researcher_id).first()
        writer.writerow([
            project.title,
            project.specialty_area,
            project.stage,
            project.readiness.value,
            lead_user.name if lead_user else "",
        ])

    buffer.seek(0)
    filename = f"rhip-impact-snapshot-{date.today().isoformat()}.csv"
    return StreamingResponse(
        iter([buffer.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
