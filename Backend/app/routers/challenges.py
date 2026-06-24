import asyncio
from typing import Optional

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from sqlalchemy.orm import Session

from app import email_service
from app.auth import get_current_user, require_roles
from app.database import SessionLocal, get_db
from app.models import (
    AIMatch,
    Challenge,
    ChallengeStatus,
    Notification,
    NotificationType,
    Profile,
    Role,
    User,
)
from app.schemas import (
    AIMatchResponse,
    ChallengeCreate,
    ChallengeListResponse,
    ChallengeMatchesResponse,
    ChallengePosterSnippet,
    ChallengeResponse,
    ProfileSummary,
)
from app.constants import ALL_SPECIALTIES, SPECIALTY_AREAS
from app.services.ai_service import AIOrchestrator

router = APIRouter(prefix="/challenges", tags=["challenges"])


def _normalize_specialty(value: Optional[str]) -> str:
    if not value or not value.strip() or value.strip() == ALL_SPECIALTIES:
        return ALL_SPECIALTIES
    return value.strip()


def _profiles_for_challenge(challenge: Challenge, db: Session) -> list[Profile]:
    q = db.query(Profile).filter(Profile.is_public == True)  # noqa: E712
    if challenge.specialty_area != ALL_SPECIALTIES:
        q = q.filter(Profile.specialty_area == challenge.specialty_area)
    return q.all()


def _profile_summary_from_match(profile: Profile, db: Session) -> ProfileSummary:
    from app.routers.directory import _profile_summary
    return _profile_summary(profile, db)


async def run_ai_matching(challenge_id: str):
    await asyncio.sleep(1.5)
    db = SessionLocal()
    try:
        challenge = db.query(Challenge).filter(Challenge.id == challenge_id).first()
        if not challenge:
            return

        challenge.status = ChallengeStatus.MATCHING
        db.commit()

        profiles = _profiles_for_challenge(challenge, db)

        ai = AIOrchestrator()
        matches = await ai.match_challenge(challenge, profiles)

        for m in matches:
            profile = db.query(Profile).filter(Profile.id == m["profile_id"]).first()
            if not profile:
                continue
            rank = m.get("rank", 1)
            ai_match = AIMatch(
                challenge_id=challenge.id,
                profile_id=m["profile_id"],
                score=m["score"],
                reasoning=m["reasoning"],
                rank=rank,
            )
            db.add(ai_match)
            db.add(Notification(
                user_id=profile.user_id,
                type=NotificationType.MATCH,
                title="You've been matched to a challenge",
                body=f"Your expertise was matched to: '{challenge.title}'",
                action_url=f"/challenges/{challenge.id}",
            ))

        db.flush()
        challenger = db.query(User).filter(User.id == challenge.posted_by).first()
        for m in matches:
            profile = db.query(Profile).filter(Profile.id == m["profile_id"]).first()
            if not profile:
                continue
            researcher = db.query(User).filter(User.id == profile.user_id).first()
            if researcher and challenger:
                await email_service.send_match_notification_email(
                    researcher,
                    challenge,
                    m.get("rank", 1),
                    m["reasoning"],
                    challenger.name,
                )

        challenge.status = ChallengeStatus.MATCHED
        db.commit()
    finally:
        db.close()


@router.post("")
async def create_challenge(
    body: ChallengeCreate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles([Role.CLINICIAN, Role.RESEARCHER, Role.ADMIN])),
):
    specialty = _normalize_specialty(body.specialty_area)
    if specialty not in SPECIALTY_AREAS and specialty != ALL_SPECIALTIES:
        raise HTTPException(status_code=400, detail="Invalid specialty area")

    challenge = Challenge(
        title=body.title,
        description=body.description,
        specialty_area=specialty,
        posted_by=current_user.id,
        status=ChallengeStatus.PENDING,
    )
    db.add(challenge)
    db.commit()
    db.refresh(challenge)

    background_tasks.add_task(run_ai_matching, challenge.id)
    return {"id": challenge.id, "status": "pending"}


@router.get("", response_model=ChallengeListResponse)
def list_challenges(
    status: Optional[str] = None,
    specialty: Optional[str] = None,
    page: int = 1,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    q = db.query(Challenge)
    if status:
        q = q.filter(Challenge.status == status)
    if specialty:
        q = q.filter(Challenge.specialty_area == specialty)
    total = q.count()
    challenges = q.order_by(Challenge.created_at.desc()).offset((page - 1) * 20).limit(20).all()

    results = []
    for c in challenges:
        poster = db.query(User).filter(User.id == c.posted_by).first()
        profile = db.query(Profile).filter(Profile.user_id == c.posted_by).first() if poster else None
        results.append(ChallengeResponse(
            id=c.id,
            title=c.title,
            description=c.description,
            specialty_area=c.specialty_area,
            status=c.status,
            created_at=c.created_at,
            posted_by=ChallengePosterSnippet(
                id=poster.id,
                name=poster.name,
                title=profile.title if profile else None,
            ) if poster else None,
        ))
    return ChallengeListResponse(challenges=results, total=total)


@router.get("/{challenge_id}", response_model=ChallengeResponse)
def get_challenge(
    challenge_id: str,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    c = db.query(Challenge).filter(Challenge.id == challenge_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Challenge not found")
    poster = db.query(User).filter(User.id == c.posted_by).first()
    profile = db.query(Profile).filter(Profile.user_id == c.posted_by).first() if poster else None
    return ChallengeResponse(
        id=c.id,
        title=c.title,
        description=c.description,
        specialty_area=c.specialty_area,
        status=c.status,
        created_at=c.created_at,
        posted_by=ChallengePosterSnippet(
            id=poster.id,
            name=poster.name,
            title=profile.title if profile else None,
        ) if poster else None,
    )


@router.get("/{challenge_id}/matches", response_model=ChallengeMatchesResponse)
def get_challenge_matches(
    challenge_id: str,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    challenge = db.query(Challenge).filter(Challenge.id == challenge_id).first()
    if not challenge:
        raise HTTPException(status_code=404, detail="Challenge not found")

    matches = (
        db.query(AIMatch)
        .filter(AIMatch.challenge_id == challenge_id)
        .order_by(AIMatch.rank)
        .all()
    )
    results = []
    for m in matches:
        profile = db.query(Profile).filter(Profile.id == m.profile_id).first()
        results.append(AIMatchResponse(
            id=m.id,
            profile_id=m.profile_id,
            score=m.score,
            reasoning=m.reasoning,
            rank=m.rank,
            profile=_profile_summary_from_match(profile, db) if profile else None,
        ))
    return ChallengeMatchesResponse(matches=results, challenge_status=challenge.status)
