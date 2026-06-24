from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.auth import require_roles
from app.database import get_db
from app.models import ClinicalService, CommunitySpecialist, Facility, HealthDistrict, Profile, Role, User
from app.schemas import (
    FacilityAdminOption,
    ServiceAdminCreate,
    ServiceAdminOption,
    ServiceAdminResponse,
    ServiceAdminUpdate,
    SpecialistAdminCreate,
    SpecialistAdminResponse,
    SpecialistAdminUpdate,
)
from app.slugify import unique_slug

router = APIRouter(prefix="/admin/community", tags=["admin-community"])


def _service_admin_response(service: ClinicalService) -> ServiceAdminResponse:
    return ServiceAdminResponse(
        id=service.id,
        slug=service.slug,
        name=service.name,
        summary=service.summary,
        description=service.description,
        specialty=service.specialty,
        contact_phone=service.contact_phone,
        contact_email=service.contact_email,
        contact_address=service.contact_address,
        referral_info=service.referral_info,
        patient_resources=service.patient_resources or [],
        is_public=service.is_public,
        facility_id=service.facility_id,
        facility_name=service.facility.name,
        district_id=service.district_id,
    )


def _specialist_admin_response(specialist: CommunitySpecialist) -> SpecialistAdminResponse:
    return SpecialistAdminResponse(
        id=specialist.id,
        slug=specialist.slug,
        name=specialist.name,
        title=specialist.title,
        specialties=specialist.specialties or [],
        department=specialist.department,
        phone=specialist.phone,
        address=specialist.address,
        email=specialist.email,
        bio=specialist.bio,
        clinic_hours=specialist.clinic_hours,
        languages=specialist.languages or [],
        accepting_referrals=specialist.accepting_referrals,
        is_public=specialist.is_public,
        facility_id=specialist.facility_id,
        facility_name=specialist.facility.name,
        service_id=specialist.service_id,
        service_name=specialist.service.name if specialist.service else None,
        profile_id=specialist.profile_id,
    )


@router.get("/facilities", response_model=list[FacilityAdminOption])
def list_facility_options(
    db: Session = Depends(get_db),
    _: User = Depends(require_roles([Role.ADMIN])),
):
    return db.query(Facility).order_by(Facility.name).all()


@router.get("/service-options", response_model=list[ServiceAdminOption])
def list_service_options(
    db: Session = Depends(get_db),
    _: User = Depends(require_roles([Role.ADMIN])),
):
    return db.query(ClinicalService).order_by(ClinicalService.name).all()


@router.get("/services", response_model=list[ServiceAdminResponse])
def list_services(
    db: Session = Depends(get_db),
    _: User = Depends(require_roles([Role.ADMIN])),
):
    services = db.query(ClinicalService).order_by(ClinicalService.name).all()
    return [_service_admin_response(s) for s in services]


@router.post("/services", response_model=ServiceAdminResponse)
def create_service(
    body: ServiceAdminCreate,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles([Role.ADMIN])),
):
    facility = db.query(Facility).filter(Facility.id == body.facility_id).first()
    if not facility:
        raise HTTPException(status_code=404, detail="Facility not found")

    existing = {s.slug for s in db.query(ClinicalService).all()}
    slug = unique_slug(body.name, existing)

    service = ClinicalService(
        slug=slug,
        name=body.name,
        summary=body.summary,
        description=body.description,
        specialty=body.specialty,
        contact_phone=body.contact_phone,
        contact_email=body.contact_email,
        contact_address=body.contact_address,
        referral_info=body.referral_info,
        is_public=body.is_public,
        district_id=facility.district_id,
        facility_id=facility.id,
    )
    db.add(service)
    db.commit()
    db.refresh(service)
    return _service_admin_response(service)


@router.patch("/services/{service_id}", response_model=ServiceAdminResponse)
def update_service(
    service_id: str,
    body: ServiceAdminUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles([Role.ADMIN])),
):
    service = db.query(ClinicalService).filter(ClinicalService.id == service_id).first()
    if not service:
        raise HTTPException(status_code=404, detail="Service not found")

    updates = body.model_dump(exclude_unset=True)
    if "name" in updates and updates["name"] != service.name:
        existing = {s.slug for s in db.query(ClinicalService).filter(ClinicalService.id != service_id).all()}
        service.slug = unique_slug(updates["name"], existing)
    for key, value in updates.items():
        setattr(service, key, value)

    db.commit()
    db.refresh(service)
    return _service_admin_response(service)


@router.delete("/services/{service_id}")
def delete_service(
    service_id: str,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles([Role.ADMIN])),
):
    service = db.query(ClinicalService).filter(ClinicalService.id == service_id).first()
    if not service:
        raise HTTPException(status_code=404, detail="Service not found")
    service.is_public = False
    db.commit()
    return {"message": "Service hidden from public directory"}


@router.get("/specialists", response_model=list[SpecialistAdminResponse])
def list_specialists(
    db: Session = Depends(get_db),
    _: User = Depends(require_roles([Role.ADMIN])),
):
    specialists = db.query(CommunitySpecialist).order_by(CommunitySpecialist.name).all()
    return [_specialist_admin_response(s) for s in specialists]


@router.post("/specialists", response_model=SpecialistAdminResponse)
def create_specialist(
    body: SpecialistAdminCreate,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles([Role.ADMIN])),
):
    facility = db.query(Facility).filter(Facility.id == body.facility_id).first()
    if not facility:
        raise HTTPException(status_code=404, detail="Facility not found")
    if body.service_id:
        service = db.query(ClinicalService).filter(ClinicalService.id == body.service_id).first()
        if not service:
            raise HTTPException(status_code=404, detail="Service not found")

    existing = {s.slug for s in db.query(CommunitySpecialist).all()}
    slug = unique_slug(body.name, existing)

    specialist = CommunitySpecialist(
        slug=slug,
        name=body.name,
        title=body.title,
        specialties=body.specialties,
        department=body.department,
        phone=body.phone,
        address=body.address,
        email=body.email,
        bio=body.bio,
        clinic_hours=body.clinic_hours,
        languages=body.languages,
        accepting_referrals=body.accepting_referrals,
        is_public=body.is_public,
        district_id=facility.district_id,
        facility_id=facility.id,
        service_id=body.service_id,
    )
    db.add(specialist)
    db.commit()
    db.refresh(specialist)
    return _specialist_admin_response(specialist)


@router.patch("/specialists/{specialist_id}", response_model=SpecialistAdminResponse)
def update_specialist(
    specialist_id: str,
    body: SpecialistAdminUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles([Role.ADMIN])),
):
    specialist = db.query(CommunitySpecialist).filter(CommunitySpecialist.id == specialist_id).first()
    if not specialist:
        raise HTTPException(status_code=404, detail="Specialist not found")

    updates = body.model_dump(exclude_unset=True)
    if "name" in updates and updates["name"] != specialist.name:
        existing = {
            s.slug for s in db.query(CommunitySpecialist).filter(CommunitySpecialist.id != specialist_id).all()
        }
        specialist.slug = unique_slug(updates["name"], existing)
    if "service_id" in updates and updates["service_id"]:
        service = db.query(ClinicalService).filter(ClinicalService.id == updates["service_id"]).first()
        if not service:
            raise HTTPException(status_code=404, detail="Service not found")

    for key, value in updates.items():
        setattr(specialist, key, value)

    db.commit()
    db.refresh(specialist)
    return _specialist_admin_response(specialist)


@router.delete("/specialists/{specialist_id}")
def delete_specialist(
    specialist_id: str,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles([Role.ADMIN])),
):
    specialist = db.query(CommunitySpecialist).filter(CommunitySpecialist.id == specialist_id).first()
    if not specialist:
        raise HTTPException(status_code=404, detail="Specialist not found")
    specialist.is_public = False
    db.commit()
    return {"message": "Specialist hidden from public directory"}
