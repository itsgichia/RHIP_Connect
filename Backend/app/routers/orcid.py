"""
ORCID import endpoint for RHIP Connect.

Lets a logged-in user pull their public ORCID data straight into their own
profile — no manual entry. Keywords flow into expertise_tags and the work
count into publications, so the enriched data shows up in the directory.

Registered under /api/v1/orcid (see main.py).
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.database import get_db
from app.models import Profile, User
from app.services.orcid_service import sync_profile_from_orcid

router = APIRouter(prefix="/orcid", tags=["orcid"])


@router.post("/import")
def import_orcid(
    orcid_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Import the logged-in user's ORCID data into their profile.

    `orcid_id` is passed as a query parameter, e.g.
        POST /api/v1/orcid/import?orcid_id=0000-0003-0390-661X
    """
    profile = db.query(Profile).filter(Profile.user_id == current_user.id).first()
    if not profile:
        raise HTTPException(status_code=404, detail="No profile found for this user")

    try:
        sync_profile_from_orcid(profile, orcid_id)
    except Exception as e:  # network / bad ORCID iD / ORCID down
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