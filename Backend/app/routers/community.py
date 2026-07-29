from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import String, cast, or_
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import (
    ClinicalService,
    CommunitySpecialist,
    Facility,
    HealthDistrict,
    KPI,
    Profile,
    ServiceTeamMember,
)
from app.schemas import (
    DistrictDetail,
    DistrictMetrics,
    DistrictSummary,
    FacilitySummary,
    KPIResponse,
    ServiceDetail,
    ServiceListResponse,
    ServiceSummary,
    ServiceTeamMemberResponse,
    SpecialistDetail,
    SpecialistListResponse,
    SpecialistSummary,
)

router = APIRouter(prefix="/community", tags=["community"])


def _community_kpis(db: Session) -> list[KPIResponse]:
    kpis = db.query(KPI).all()
    return [
        KPIResponse.model_validate(k)
        for k in kpis
        if "community" in (k.audience or []) or "all" in (k.audience or [])
    ]


def _service_summary(service: ClinicalService) -> ServiceSummary:
    return ServiceSummary(
        id=service.id,
        slug=service.slug,
        name=service.name,
        summary=service.summary,
        specialty=service.specialty,
        facility_name=service.facility.name,
        facility_slug=service.facility.slug,
        district_slug=service.district.slug,
        contact_phone=service.contact_phone,
    )


def _specialist_summary(specialist: CommunitySpecialist) -> SpecialistSummary:
    return SpecialistSummary(
        id=specialist.id,
        slug=specialist.slug,
        name=specialist.name,
        title=specialist.title,
        specialties=specialist.specialties or [],
        department=specialist.department,
        facility_name=specialist.facility.name,
        facility_slug=specialist.facility.slug,
        phone=specialist.phone,
        address=specialist.address,
        service_name=specialist.service.name if specialist.service else None,
        service_slug=specialist.service.slug if specialist.service else None,
        profile_id=specialist.profile_id,
    )


def _facility_summary(facility: Facility, db: Session) -> FacilitySummary:
    service_count = (
        db.query(ClinicalService)
        .filter(
            ClinicalService.facility_id == facility.id,
            ClinicalService.is_public == True,  # noqa: E712
        )
        .count()
    )
    return FacilitySummary(
        id=facility.id,
        slug=facility.slug,
        name=facility.name,
        address=facility.address,
        phone=facility.phone,
        description=facility.description,
        district_slug=facility.district.slug,
        district_name=facility.district.name,
        service_count=service_count,
    )


@router.get("/districts", response_model=list[DistrictSummary])
def list_districts(db: Session = Depends(get_db)):
    return db.query(HealthDistrict).order_by(HealthDistrict.name).all()


@router.get("/districts/{slug}", response_model=DistrictDetail)
def get_district(slug: str, db: Session = Depends(get_db)):
    district = db.query(HealthDistrict).filter(HealthDistrict.slug == slug).first()
    if not district:
        raise HTTPException(status_code=404, detail="District not found")

    facilities = db.query(Facility).filter(Facility.district_id == district.id).all()
    service_count = (
        db.query(ClinicalService)
        .filter(
            ClinicalService.district_id == district.id,
            ClinicalService.is_public == True,  # noqa: E712
        )
        .count()
    )
    specialist_count = (
        db.query(CommunitySpecialist)
        .filter(
            CommunitySpecialist.district_id == district.id,
            CommunitySpecialist.is_public == True,  # noqa: E712
        )
        .count()
    )

    return DistrictDetail(
        id=district.id,
        slug=district.slug,
        name=district.name,
        description=district.description,
        metrics=DistrictMetrics(
            kpis=_community_kpis(db),
            facility_count=len(facilities),
            service_count=service_count,
            specialist_count=specialist_count,
        ),
        facilities=[_facility_summary(f, db) for f in facilities],
    )


@router.get("/facilities", response_model=list[FacilitySummary])
def list_facilities(
    district: Optional[str] = None,
    db: Session = Depends(get_db),
):
    q = db.query(Facility)
    if district:
        q = q.join(HealthDistrict).filter(HealthDistrict.slug == district)
    facilities = q.order_by(Facility.name).all()
    return [_facility_summary(f, db) for f in facilities]


@router.get("/services", response_model=ServiceListResponse)
def list_services(
    district: Optional[str] = None,
    facility: Optional[str] = None,
    specialty: Optional[str] = None,
    query: Optional[str] = None,
    db: Session = Depends(get_db),
):
    q = db.query(ClinicalService).filter(ClinicalService.is_public == True)  # noqa: E712

    if district:
        q = q.join(HealthDistrict).filter(HealthDistrict.slug == district)
    if facility:
        q = q.join(Facility).filter(Facility.slug == facility)
    if specialty:
        q = q.filter(ClinicalService.specialty == specialty)
    if query:
        pattern = f"%{query}%"
        q = q.filter(
            or_(
                ClinicalService.name.ilike(pattern),
                ClinicalService.summary.ilike(pattern),
                ClinicalService.description.ilike(pattern),
                ClinicalService.specialty.ilike(pattern),
            )
        )

    services = q.order_by(ClinicalService.name).all()
    specialties = sorted({s.specialty for s in services})

    return ServiceListResponse(
        services=[_service_summary(s) for s in services],
        total=len(services),
        specialties=specialties,
    )


@router.get("/services/{slug}", response_model=ServiceDetail)
def get_service(slug: str, db: Session = Depends(get_db)):
    service = (
        db.query(ClinicalService)
        .filter(ClinicalService.slug == slug, ClinicalService.is_public == True)  # noqa: E712
        .first()
    )
    if not service:
        raise HTTPException(status_code=404, detail="Service not found")

    team = (
        db.query(ServiceTeamMember)
        .filter(ServiceTeamMember.service_id == service.id)
        .order_by(ServiceTeamMember.display_order)
        .all()
    )

    summary = _service_summary(service)
    return ServiceDetail(
        **summary.model_dump(),
        description=service.description,
        contact_email=service.contact_email,
        contact_address=service.contact_address,
        referral_info=service.referral_info,
        patient_resources=service.patient_resources or [],
        team=[ServiceTeamMemberResponse.model_validate(m) for m in team],
        district_name=service.district.name,
    )


@router.get("/specialists", response_model=SpecialistListResponse)
def list_specialists(
    district: Optional[str] = None,
    facility: Optional[str] = None,
    service: Optional[str] = None,
    specialty: Optional[str] = None,
    query: Optional[str] = None,
    db: Session = Depends(get_db),
):
    q = db.query(CommunitySpecialist).filter(CommunitySpecialist.is_public == True)  # noqa: E712

    if district:
        q = q.join(HealthDistrict).filter(HealthDistrict.slug == district)
    if facility:
        q = q.join(Facility).filter(Facility.slug == facility)
    if service:
        q = q.join(ClinicalService).filter(ClinicalService.slug == service)
    if specialty:
        q = q.filter(cast(CommunitySpecialist.specialties, String).ilike(f"%{specialty}%"))
    if query:
        pattern = f"%{query}%"
        q = q.filter(
            or_(
                CommunitySpecialist.name.ilike(pattern),
                CommunitySpecialist.title.ilike(pattern),
                CommunitySpecialist.department.ilike(pattern),
            )
        )

    specialists = q.order_by(CommunitySpecialist.name).all()
    all_specialties: set[str] = set()
    for s in specialists:
        all_specialties.update(s.specialties or [])

    return SpecialistListResponse(
        specialists=[_specialist_summary(s) for s in specialists],
        total=len(specialists),
        specialties=sorted(all_specialties),
    )


@router.get("/specialists/{slug}", response_model=SpecialistDetail)
def get_specialist(slug: str, db: Session = Depends(get_db)):
    specialist = (
        db.query(CommunitySpecialist)
        .filter(CommunitySpecialist.slug == slug, CommunitySpecialist.is_public == True)  # noqa: E712
        .first()
    )
    if not specialist:
        raise HTTPException(status_code=404, detail="Specialist not found")

    bio = specialist.bio
    if not bio and specialist.profile_id:
        profile = db.query(Profile).filter(Profile.id == specialist.profile_id).first()
        if profile:
            bio = profile.bio

    related: list[CommunitySpecialist] = []
    if specialist.service_id:
        related = (
            db.query(CommunitySpecialist)
            .filter(
                CommunitySpecialist.service_id == specialist.service_id,
                CommunitySpecialist.id != specialist.id,
                CommunitySpecialist.is_public == True,  # noqa: E712
            )
            .order_by(CommunitySpecialist.name)
            .limit(4)
            .all()
        )

    summary = _specialist_summary(specialist)
    return SpecialistDetail(
        **summary.model_dump(),
        district_name=specialist.district.name,
        district_slug=specialist.district.slug,
        bio=bio,
        email=specialist.email,
        clinic_hours=specialist.clinic_hours,
        languages=specialist.languages or [],
        accepting_referrals=specialist.accepting_referrals,
        related_specialists=[_specialist_summary(s) for s in related],
    )
