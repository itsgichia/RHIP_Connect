from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.database import get_db
from app.models import Institution, Profile, User
from app.schemas import DirectorySearchResponse, ProfileDetail, ProfileSummary

router = APIRouter(prefix="/directory", tags=["directory"])


def _profile_summary(profile: Profile, db: Session) -> ProfileSummary:
    user = db.query(User).filter(User.id == profile.user_id).first()
    institution_name = None
    if user and user.institution_id:
        inst = db.query(Institution).filter(Institution.id == user.institution_id).first()
        institution_name = inst.name if inst else None
    return ProfileSummary(
        id=profile.id,
        name=profile.name,
        title=profile.title,
        specialty_area=profile.specialty_area,
        expertise_tags=profile.expertise_tags or [],
        publications=profile.publications,
        active_projects=profile.active_projects,
        institution_name=institution_name,
    )


@router.get("/search", response_model=DirectorySearchResponse)
def search_directory(
    query: Optional[str] = None,
    specialty: Optional[str] = None,
    institution: Optional[str] = None,
    page: int = 1,
    limit: int = 12,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    q = db.query(Profile).filter(Profile.is_public == True)  # noqa: E712

    if specialty:
        q = q.filter(Profile.specialty_area == specialty)
    if query:
        pattern = f"%{query}%"
        q = q.filter(
            or_(
                Profile.name.ilike(pattern),
                Profile.title.ilike(pattern),
                Profile.bio.ilike(pattern),
            )
        )
    if institution:
        inst_ids = [
            i.id for i in db.query(Institution).filter(Institution.name.ilike(f"%{institution}%")).all()
        ]
        user_ids = [
            u.id for u in db.query(User).filter(User.institution_id.in_(inst_ids)).all()
        ] if inst_ids else []
        q = q.filter(Profile.user_id.in_(user_ids))

    total = q.count()
    profiles = q.offset((page - 1) * limit).limit(limit).all()
    return DirectorySearchResponse(
        profiles=[_profile_summary(p, db) for p in profiles],
        total=total,
        page=page,
    )


@router.get("/{profile_id}", response_model=ProfileDetail)
def get_profile(
    profile_id: str,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    profile = db.query(Profile).filter(Profile.id == profile_id).first()
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")
    summary = _profile_summary(profile, db)
    return ProfileDetail(
        **summary.model_dump(),
        bio=profile.bio,
        is_public=profile.is_public,
    )
