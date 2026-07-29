from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import String, cast, or_
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.database import get_db
from app.identity import (
    normalize_career_level,
    normalize_facets,
    profile_facets,
    validate_primary_lens,
)
from app.models import Institution, Profile, Project, Publication, User
from app.routers.pipeline import _allowed_visibilities, _project_to_response
from app.schemas import (
    DirectorySearchResponse,
    KeywordSuggestionsResponse,
    ProfileDetail,
    ProfileSummary,
    ProfileUpdate,
    PublicationResponse,
)
from app.services.orcid_service import normalize_orcid_id

router = APIRouter(prefix="/directory", tags=["directory"])


def _ensure_profile(user: User, db: Session) -> Profile:
    """Create a minimal private profile when a user is missing one (e.g. legacy investor accounts)."""
    profile = db.query(Profile).filter(Profile.user_id == user.id).first()
    if profile:
        return profile
    profile = Profile(
        user_id=user.id,
        name=user.name,
        title=user.name,
        specialty_area=user.specialty_area or "Health Systems",
        expertise_tags=[],
        skills=[],
        bio="",
        publications=0,
        active_projects=0,
        patents=[],
        news=[],
        awards=[],
        is_public=False,
        identity_facets=[],
        primary_lens=None,
        professional_title=None,
        career_level=None,
    )
    db.add(profile)
    db.commit()
    db.refresh(profile)
    return profile


def _profile_summary(profile: Profile, db: Session) -> ProfileSummary:
    user = db.query(User).filter(User.id == profile.user_id).first()
    institution_name = None
    if user and user.institution_id:
        inst = db.query(Institution).filter(Institution.id == user.institution_id).first()
        institution_name = inst.name if inst else None
    facets = profile_facets(profile, user)
    return ProfileSummary(
        id=profile.id,
        name=profile.name,
        title=profile.title,
        specialty_area=profile.specialty_area,
        expertise_tags=profile.expertise_tags or [],
        skills=profile.skills or [],
        publications=profile.publications,
        active_projects=profile.active_projects,
        institution_name=institution_name,
        identity_facets=facets,
        primary_lens=profile.primary_lens or (facets[0] if facets else None),
        career_level=profile.career_level,
        professional_title=profile.professional_title,
        orcid_id=profile.orcid_id,
    )


def _profile_detail(profile: Profile, db: Session, current_user: User) -> ProfileDetail:
    summary = _profile_summary(profile, db)
    allowed = _allowed_visibilities(current_user)
    projects = (
        db.query(Project)
        .filter(
            Project.lead_researcher_id == profile.user_id,
            Project.visibility.in_(allowed),
        )
        .order_by(Project.trl.desc(), Project.stage.desc())
        .all()
    )
    publications = (
        db.query(Publication)
        .filter(Publication.profile_id == profile.id)
        .order_by(Publication.year.desc(), Publication.title)
        .limit(20)
        .all()
    )
    return ProfileDetail(
        **summary.model_dump(),
        bio=profile.bio,
        is_public=profile.is_public,
        is_own_profile=profile.user_id == current_user.id,
        patents=profile.patents or [],
        news=profile.news or [],
        awards=profile.awards or [],
        scholarly_works=[
            PublicationResponse.model_validate(pub) for pub in publications
        ],
        projects=[_project_to_response(p, db) for p in projects],
    )


@router.get("/me", response_model=ProfileDetail)
def get_my_profile(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    profile = _ensure_profile(current_user, db)
    return _profile_detail(profile, db, current_user)


@router.patch("/me", response_model=ProfileDetail)
def update_my_profile(
    body: ProfileUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    profile = _ensure_profile(current_user, db)

    if body.is_public is not None:
        profile.is_public = body.is_public
    if body.title is not None:
        profile.title = body.title.strip() or profile.title
    if body.specialty_area is not None:
        profile.specialty_area = body.specialty_area
    if body.bio is not None:
        profile.bio = body.bio
    if body.expertise_tags is not None:
        profile.expertise_tags = body.expertise_tags
    if body.skills is not None:
        profile.skills = [s.strip() for s in body.skills if s and str(s).strip()]
    if body.professional_title is not None:
        profile.professional_title = body.professional_title.strip() or None
    if body.career_level is not None:
        profile.career_level = normalize_career_level(body.career_level)
    if body.identity_facets is not None:
        facets = normalize_facets(body.identity_facets)
        if not facets:
            raise HTTPException(status_code=400, detail="Select at least one identity facet")
        profile.identity_facets = facets
        profile.primary_lens = validate_primary_lens(facets, body.primary_lens or profile.primary_lens)
    elif body.primary_lens is not None:
        facets = profile_facets(profile, current_user)
        profile.primary_lens = validate_primary_lens(facets, body.primary_lens)
    if "orcid_id" in body.model_fields_set:
        try:
            profile.orcid_id = normalize_orcid_id(body.orcid_id)
            profile.orcid_checked = True
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

    db.commit()
    db.refresh(profile)
    return _profile_detail(profile, db, current_user)


@router.post("/me/suggest-keywords", response_model=KeywordSuggestionsResponse)
async def suggest_my_keywords(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Opt-in: suggest expertise_tags and skills from publications (user must confirm via PATCH)."""
    profile = db.query(Profile).filter(Profile.user_id == current_user.id).first()
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")
    pubs = (
        db.query(Publication)
        .filter(Publication.profile_id == profile.id)
        .order_by(Publication.year.desc())
        .limit(10)
        .all()
    )
    if not pubs:
        raise HTTPException(
            status_code=400,
            detail="No publications on your profile yet to suggest keywords from",
        )
    from app.services.ai_service import AIOrchestrator

    ai = AIOrchestrator()
    suggested = await ai.suggest_keywords_from_publications(
        [
            {
                "title": p.title,
                "abstract": getattr(p, "abstract", None) or "",
            }
            for p in pubs
        ]
    )
    return KeywordSuggestionsResponse(
        expertise_tags=suggested.get("expertise_tags") or [],
        skills=suggested.get("skills") or [],
        source="publications",
    )


@router.get("/me/suggestions", response_model=DirectorySearchResponse)
def suggested_connections(
    limit: int = 6,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Same-institution people with overlapping tags/skills."""
    profile = db.query(Profile).filter(Profile.user_id == current_user.id).first()
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")

    my_tags = {t.lower() for t in (profile.expertise_tags or [])}
    my_skills = {s.lower() for s in (profile.skills or [])}
    q = db.query(Profile).filter(
        Profile.is_public == True,  # noqa: E712
        Profile.id != profile.id,
    )
    if current_user.institution_id:
        peer_ids = [
            u.id
            for u in db.query(User)
            .filter(User.institution_id == current_user.institution_id)
            .all()
        ]
        q = q.filter(Profile.user_id.in_(peer_ids))

    candidates = q.limit(80).all()
    scored = []
    for p in candidates:
        tags = {t.lower() for t in (p.expertise_tags or [])}
        skills = {s.lower() for s in (p.skills or [])}
        overlap = len(my_tags & tags) + len(my_skills & skills) * 1.5
        if overlap <= 0 and current_user.institution_id:
            overlap = 0.5  # same institution soft boost
        if overlap > 0:
            scored.append((overlap, p))
    scored.sort(key=lambda x: -x[0])
    profiles = [p for _, p in scored[: max(1, min(limit, 12))]]
    return DirectorySearchResponse(
        profiles=[_profile_summary(p, db) for p in profiles],
        total=len(profiles),
        page=1,
    )


@router.get("/search", response_model=DirectorySearchResponse)
def search_directory(
    query: Optional[str] = None,
    specialty: Optional[str] = None,
    institution: Optional[str] = None,
    facets: Optional[str] = None,
    career_level: Optional[str] = None,
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

    level = normalize_career_level(career_level)
    if level:
        q = q.filter(Profile.career_level == level)

    required_facets = normalize_facets(
        [f.strip() for f in (facets or "").split(",") if f.strip()]
    )
    # SQLite JSON: require each facet string to appear in the stored array text
    for facet in required_facets:
        q = q.filter(cast(Profile.identity_facets, String).like(f'%"{facet}"%'))

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
    current_user: User = Depends(get_current_user),
):
    profile = db.query(Profile).filter(Profile.id == profile_id).first()
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")
    is_owner = profile.user_id == current_user.id
    if not profile.is_public and not is_owner:
        raise HTTPException(status_code=404, detail="Profile not found")
    return _profile_detail(profile, db, current_user)
