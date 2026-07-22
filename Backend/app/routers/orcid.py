"""
ORCID + collaboration endpoints for RHIP Connect.

- POST /orcid/import         -> import a logged-in user's ORCID data (auth)
- GET  /orcid/collaborations -> where a researcher's co-authors are, for the map
                                (public: it only returns open OpenAlex data)

Registered under /api/v1/orcid (see main.py).
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.database import get_db
from app.models import Profile, User
from app.services.orcid_service import sync_profile_from_orcid
from app.services.openalex_service import get_collaborations

router = APIRouter(prefix="/orcid", tags=["orcid"])


@router.post("/import")
def import_orcid(
    orcid_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Import the logged-in user's ORCID data into their profile.

    e.g. POST /api/v1/orcid/import?orcid_id=0000-0003-0390-661X
    """
    profile = db.query(Profile).filter(Profile.user_id == current_user.id).first()
    if not profile:
        raise HTTPException(status_code=404, detail="No profile found for this user")

    try:
        sync_profile_from_orcid(profile, orcid_id)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"ORCID import failed: {e}")

    db.commit()
    db.refresh(profile)

    return {
        "ok": True,
        "orcid_id": profile.orcid_id,
        "name": profile.name,
        "current_affiliation": profile.current_affiliation,
        "is_current_unsw": profile.is_current_unsw,
        "expertise_tags": profile.expertise_tags,
        "publications": profile.publications,
    }


@router.get("/collaborations")
def orcid_collaborations(orcid_id: str):
    """Return where a researcher's co-authors are (by country + institution),
    for the collaboration map. Data comes from OpenAlex (open, CC0).

    e.g. GET /api/v1/orcid/collaborations?orcid_id=0000-0003-0390-661X
    """
    try:
        return get_collaborations(orcid_id)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"OpenAlex fetch failed: {e}")