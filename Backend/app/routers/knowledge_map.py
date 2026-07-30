"""Knowledge Map API — landscape / focus / community / bridge graph."""

from __future__ import annotations

from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.database import get_db
from app.models import Challenge, Profile, User
from app.services.ai_service import AIOrchestrator
from app.services.map_service import build_knowledge_map

router = APIRouter(prefix="/map", tags=["map"])
ai = AIOrchestrator()


@router.get("")
def get_knowledge_map(
    focus: Optional[str] = Query(None, description="Profile id to enter focus mode"),
    challenge: Optional[str] = Query(None, description="Challenge id for Match handoff context"),
    q: Optional[str] = Query(None, description="Search / re-focus query"),
    lens: Optional[str] = Query(None, description="Overlay lens, e.g. role:industry"),
    community: Optional[str] = Query(None, description="Enter community explore mode"),
    pathA: Optional[str] = Query(None, alias="pathA", description="Bridge finder endpoint A"),
    pathB: Optional[str] = Query(None, alias="pathB", description="Bridge finder endpoint B"),
    show_affinity: bool = Query(
        False,
        description="Include affinity edges in landscape (always on in focus / search / community / bridge)",
    ),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    if focus:
        exists = (
            db.query(Profile.id)
            .filter(Profile.id == focus, Profile.is_public.is_(True))
            .first()
        )
        if not exists:
            raise HTTPException(status_code=404, detail="Profile not found on the map")

    payload = build_knowledge_map(
        db,
        focus_id=focus,
        challenge_id=challenge,
        query=q,
        lens=lens,
        show_affinity=show_affinity,
        community=community,
        path_a=pathA,
        path_b=pathB,
    )
    payload["generated_at"] = datetime.utcnow().isoformat() + "Z"

    if focus and payload.get("focus") is None and payload.get("mode") == "focus":
        raise HTTPException(status_code=404, detail="Profile not found on the map")

    if community and payload.get("mode") == "landscape" and not focus:
        # Community name did not resolve
        raise HTTPException(status_code=404, detail="Community not found on the map")

    return payload


@router.get("/briefing")
async def get_map_briefing(
    focus: str = Query(..., description="Profile id in focus"),
    challenge: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """Claude briefing explaining why this person sits where they do on the map."""
    payload = build_knowledge_map(
        db,
        focus_id=focus,
        challenge_id=challenge,
        show_affinity=True,
    )
    focus_data = payload.get("focus")
    if not focus_data:
        raise HTTPException(status_code=404, detail="Profile not found on the map")

    challenge_title = None
    if challenge:
        ch = db.query(Challenge).filter(Challenge.id == challenge).first()
        challenge_title = ch.title if ch else focus_data.get("challenge", {}).get("title")
    elif focus_data.get("challenge"):
        challenge_title = focus_data["challenge"].get("title")

    text = await ai.explain_map_focus(
        name=focus_data["name"],
        title=focus_data.get("title") or "",
        role=focus_data.get("role") or "",
        specialty=focus_data.get("specialty_area") or "",
        topics=focus_data.get("topics") or [],
        community=focus_data.get("community") or "",
        collaborators=[c["name"] for c in focus_data.get("collaborators") or []],
        nearby=[n["name"] for n in focus_data.get("nearby_expertise") or []],
        challenge_title=challenge_title,
    )
    return {
        "profile_id": focus,
        "briefing": text,
        "model": ai.model,
        "provider": "anthropic",
    }
