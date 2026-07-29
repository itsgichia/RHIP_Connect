import httpx
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.database import get_db
from app.models import Profile, User
from app.schemas import OrcidWorksResponse, PublicationResponse
from app.services import orcid_service
from app.services.openalex_service import get_collaborations

router = APIRouter(prefix="/orcid", tags=["orcid"])


_miss_cache: set[str] = set()


def _resolve_and_store_orcid(profile: Profile, db: Session) -> str | None:
    """Look up ORCID for this profile's user; persist when uniquely found."""
    if profile.orcid_id:
        return profile.orcid_id
    # Avoid hammering ORCID for profiles that already failed this process lifetime
    if profile.id in _miss_cache:
        return None

    user = db.query(User).filter(User.id == profile.user_id).first()
    email = user.email if user else None
    name = profile.name or (user.name if user else None)
    institution = None
    if user and user.institution_id:
        from app.models import Institution

        inst = db.query(Institution).filter(Institution.id == user.institution_id).first()
        institution = inst.name if inst else None

    try:
        found = orcid_service.resolve_orcid_id(
            email=email, name=name, institution=institution
        )
    except orcid_service.OrcidConfigError:
        raise
    except (orcid_service.OrcidApiError, httpx.HTTPError, ValueError):
        found = None

    if found:
        profile.orcid_id = found
        profile.orcid_checked = True
        db.commit()
        db.refresh(profile)
        return profile.orcid_id

    _miss_cache.add(profile.id)
    if not profile.orcid_checked:
        profile.orcid_checked = True
        db.commit()
    return None


@router.get("/works/{orcid_id}", response_model=OrcidWorksResponse)
def get_orcid_works(
    orcid_id: str,
    _: User = Depends(get_current_user),
):
    """Fetch public works for an ORCID iD via the ORCID Public API."""
    try:
        normalised = orcid_service.normalize_orcid_id(orcid_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    if not normalised:
        raise HTTPException(status_code=400, detail="ORCID iD is required")

    try:
        works = orcid_service.fetch_works(normalised)
    except orcid_service.OrcidConfigError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except orcid_service.OrcidApiError as exc:
        status = 404 if exc.status_code == 404 else 502
        if exc.status_code in (401, 403):
            status = 503
        raise HTTPException(status_code=status, detail=str(exc)) from exc
    except httpx.HTTPError as exc:
        raise HTTPException(
            status_code=502, detail=f"Could not reach ORCID API: {exc}"
        ) from exc

    return OrcidWorksResponse(
        orcid_id=normalised,
        works=[PublicationResponse(**work) for work in works],
    )


@router.get("/profile/{profile_id}/works", response_model=OrcidWorksResponse)
def get_profile_orcid_works(
    profile_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Resolve ORCID from the existing RHIP user (email/name) if needed, then fetch works.

    Only returns an ORCID iD when that person uniquely exists in ORCID.
    Profiles with no ORCID match get an empty works list and null orcid_id.
    """
    profile = db.query(Profile).filter(Profile.id == profile_id).first()
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")
    is_owner = profile.user_id == current_user.id
    if not profile.is_public and not is_owner:
        raise HTTPException(status_code=404, detail="Profile not found")

    try:
        orcid_id = _resolve_and_store_orcid(profile, db)
    except orcid_service.OrcidConfigError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc

    if not orcid_id:
        return OrcidWorksResponse(orcid_id=None, works=[])

    try:
        works = orcid_service.fetch_works(orcid_id)
    except orcid_service.OrcidApiError as exc:
        status = 404 if exc.status_code == 404 else 502
        if exc.status_code in (401, 403):
            status = 503
        raise HTTPException(status_code=status, detail=str(exc)) from exc
    except httpx.HTTPError as exc:
        raise HTTPException(
            status_code=502, detail=f"Could not reach ORCID API: {exc}"
        ) from exc

    return OrcidWorksResponse(
        orcid_id=orcid_id,
        works=[PublicationResponse(**work) for work in works],
    )


@router.get("/collaborations")
def orcid_collaborations(orcid_id: str):
    """Return co-author countries/institutions from OpenAlex for the collaboration map.

    Public: returns only open OpenAlex aggregates (CC0).
    e.g. GET /api/v1/orcid/collaborations?orcid_id=0000-0003-0390-661X
    """
    try:
        normalised = orcid_service.normalize_orcid_id(orcid_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    if not normalised:
        raise HTTPException(status_code=400, detail="ORCID iD is required")

    try:
        return get_collaborations(normalised)
    except httpx.HTTPError as exc:
        raise HTTPException(
            status_code=502, detail=f"OpenAlex fetch failed: {exc}"
        ) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=502, detail=f"OpenAlex fetch failed: {exc}"
        ) from exc
