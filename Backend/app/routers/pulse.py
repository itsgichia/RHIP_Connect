"""Network graph + translation success stories (Directory, Government, Investor)."""

from __future__ import annotations

import json
import math
from datetime import datetime
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import (
    AIMatch,
    Profile,
    Thread,
    ThreadParticipant,
    ThreadStatus,
    User,
)

router = APIRouter(prefix="/pulse", tags=["pulse"])

_DATA_DIR = Path(__file__).resolve().parents[3] / "data"
_STORIES_PATH = _DATA_DIR / "mock_stories.json"

_ROLE_COLORS = {
    "clinician": "#0D7377",
    "researcher": "#14919B",
    "industry": "#C45C26",
    "investor": "#1B3A4B",
    "admin": "#5C6B73",
}


def _load_stories() -> list[dict]:
    if not _STORIES_PATH.exists():
        return []
    with open(_STORIES_PATH, encoding="utf-8") as f:
        return json.load(f)


@router.get("/network")
def pulse_network(db: Session = Depends(get_db)):
    """Role-clustered network of public profiles + match/thread edges."""
    profiles = (
        db.query(Profile)
        .join(User, Profile.user_id == User.id)
        .filter(Profile.is_public.is_(True))
        .limit(48)
        .all()
    )

    nodes: list[dict] = []
    role_buckets: dict[str, list[Profile]] = {}
    for p in profiles:
        role = p.user.role.value if p.user and p.user.role else "researcher"
        role_buckets.setdefault(role, []).append(p)

    role_order = ["clinician", "researcher", "industry", "investor", "admin"]
    for role_idx, role in enumerate(role_order):
        bucket = role_buckets.get(role, [])
        if not bucket:
            continue
        base_angle = (2 * math.pi * role_idx) / max(len(role_order), 1)
        for i, p in enumerate(bucket):
            spread = (i - (len(bucket) - 1) / 2) * 0.22
            angle = base_angle + spread
            radius = 38 + (i % 3) * 8
            nodes.append(
                {
                    "id": p.id,
                    "label": p.name.split()[-1] if p.name else "User",
                    "name": p.name,
                    "role": role,
                    "specialty_area": p.specialty_area,
                    "color": _ROLE_COLORS.get(role, "#14919B"),
                    "x": round(50 + radius * math.cos(angle), 2),
                    "y": round(50 + radius * math.sin(angle), 2),
                }
            )

    profile_ids = {n["id"] for n in nodes}
    edges: list[dict] = []
    seen: set[tuple[str, str]] = set()

    matches = db.query(AIMatch).order_by(AIMatch.created_at.desc()).limit(80).all()
    for m in matches:
        challenge = m.challenge
        if not challenge or m.profile_id not in profile_ids:
            continue
        poster = db.query(User).filter(User.id == challenge.posted_by).first()
        if not poster or not poster.profile or poster.profile.id not in profile_ids:
            continue
        a, b = sorted([poster.profile.id, m.profile_id])
        key = (a, b)
        if key in seen:
            continue
        seen.add(key)
        edges.append(
            {
                "id": f"match-{m.id}",
                "source": a,
                "target": b,
                "type": "match",
                "weight": round(m.score, 2),
            }
        )

    threads = (
        db.query(Thread)
        .filter(Thread.status.in_([ThreadStatus.PENDING, ThreadStatus.ACTIVE]))
        .limit(40)
        .all()
    )
    for t in threads:
        parts = db.query(ThreadParticipant).filter(ThreadParticipant.thread_id == t.id).all()
        user_ids = [p.user_id for p in parts]
        if len(user_ids) < 2:
            continue
        profiles_for_thread = (
            db.query(Profile).filter(Profile.user_id.in_(user_ids[:2])).all()
        )
        if len(profiles_for_thread) < 2:
            continue
        a, b = sorted([profiles_for_thread[0].id, profiles_for_thread[1].id])
        if a not in profile_ids or b not in profile_ids:
            continue
        key = (a, b)
        if key in seen:
            continue
        seen.add(key)
        edges.append(
            {
                "id": f"thread-{t.id}",
                "source": a,
                "target": b,
                "type": "connection",
                "weight": 0.7,
            }
        )

    # Honesty: never fabricate edges to pad density. Prefer /api/v1/map for Knowledge Map.

    return {
        "generated_at": datetime.utcnow().isoformat() + "Z",
        "nodes": nodes,
        "edges": edges,
        "legend": [
            {"role": role, "color": color, "label": role.replace("_", " ").title()}
            for role, color in _ROLE_COLORS.items()
        ],
    }


@router.get("/stories")
def list_stories():
    """Curated translation success stories."""
    stories = _load_stories()
    return {"stories": stories, "count": len(stories)}


@router.get("/stories/{story_id}")
def get_story(story_id: str):
    stories = _load_stories()
    for story in stories:
        if story.get("id") == story_id:
            return story
    raise HTTPException(status_code=404, detail="Story not found")
