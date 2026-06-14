from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app import email_service
from app.auth import get_current_user, require_roles
from app.database import get_db
from app.models import (
    Event,
    Notification,
    NotificationType,
    PassportEntry,
    RewardTier,
    RewardTierLevel,
    Role,
    User,
)
from app.schemas import (
    OkResponse,
    PassportEntryResponse,
    PassportEventResponse,
    PassportEventsResponse,
    PassportMyResponse,
    PassportScanRequest,
    PassportScanResponse,
)

router = APIRouter(prefix="/passport", tags=["passport"])

BRONZE_THRESHOLD = 3
SILVER_THRESHOLD = 6


def _current_year() -> int:
    return datetime.now().year


def _total_events_in_year(year: int, db: Session) -> int:
    return db.query(Event).filter(Event.event_year == year).count()


def _events_attended(user_id: str, year: int, db: Session) -> int:
    return (
        db.query(PassportEntry)
        .filter(PassportEntry.user_id == user_id, PassportEntry.event_year == year)
        .count()
    )


def _calculate_tier(events_attended: int, total_events: int) -> RewardTierLevel:
    if total_events > 0 and events_attended >= total_events:
        return RewardTierLevel.GOLD
    if events_attended >= SILVER_THRESHOLD:
        return RewardTierLevel.SILVER
    if events_attended >= BRONZE_THRESHOLD:
        return RewardTierLevel.BRONZE
    return RewardTierLevel.NONE


def _next_tier_at(tier: RewardTierLevel, events_attended: int, total_events: int) -> int | None:
    if tier == RewardTierLevel.GOLD:
        return None
    if tier == RewardTierLevel.SILVER:
        return total_events if total_events > events_attended else None
    if tier == RewardTierLevel.BRONZE:
        return SILVER_THRESHOLD
    return BRONZE_THRESHOLD


def _next_reward_text(tier: RewardTierLevel, events_attended: int, total_events: int) -> str | None:
    if tier == RewardTierLevel.GOLD:
        return "You've reached Gold — research grant contribution awarded!"
    if tier == RewardTierLevel.SILVER:
        remaining = max(0, total_events - events_attended)
        if remaining:
            return f"Attend {remaining} more event{'s' if remaining != 1 else ''} for Gold"
        return None
    if tier == RewardTierLevel.BRONZE:
        remaining = SILVER_THRESHOLD - events_attended
        return f"Attend {remaining} more event{'s' if remaining != 1 else ''} for Silver"
    remaining = BRONZE_THRESHOLD - events_attended
    return f"Attend {remaining} more event{'s' if remaining != 1 else ''} for Bronze"


def _get_or_create_reward_tier(user_id: str, year: int, db: Session) -> RewardTier:
    tier = db.query(RewardTier).filter(RewardTier.user_id == user_id).first()
    total = _total_events_in_year(year, db)
    if not tier:
        tier = RewardTier(
            user_id=user_id,
            year=year,
            tier=RewardTierLevel.NONE,
            events_attended=0,
            total_events_in_year=total,
        )
        db.add(tier)
        db.flush()
    return tier


def _recalculate_tier(user: User, db: Session) -> tuple[RewardTier, RewardTierLevel, bool]:
    year = _current_year()
    reward = _get_or_create_reward_tier(user.id, year, db)
    attended = _events_attended(user.id, year, db)
    total = _total_events_in_year(year, db)

    old_tier = reward.tier
    new_tier = _calculate_tier(attended, total)

    reward.year = year
    reward.events_attended = attended
    reward.total_events_in_year = total
    reward.tier = new_tier
    reward.last_calculated = datetime.utcnow()
    if new_tier == RewardTierLevel.GOLD and not reward.grant_awarded:
        reward.grant_awarded = True

    upgraded = new_tier != old_tier and new_tier != RewardTierLevel.NONE
    return reward, old_tier, upgraded


def _entry_to_response(entry: PassportEntry, event: Event) -> PassportEntryResponse:
    return PassportEntryResponse(
        id=entry.id,
        event_id=entry.event_id,
        event_name=event.name,
        event_type=event.type,
        event_date=event.date,
        scanned_at=entry.scanned_at,
    )


@router.post("/scan", response_model=PassportScanResponse)
async def scan_passport(
    body: PassportScanRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    event = db.query(Event).filter(Event.qr_code == body.qr_code.strip()).first()
    if not event:
        raise HTTPException(status_code=404, detail="Invalid QR code — event not found")

    year = _current_year()
    if event.event_year != year:
        raise HTTPException(status_code=400, detail=f"This event is for {event.event_year}, not the current passport year")

    existing = (
        db.query(PassportEntry)
        .filter(PassportEntry.user_id == current_user.id, PassportEntry.event_id == event.id)
        .first()
    )
    if existing:
        reward = _get_or_create_reward_tier(current_user.id, year, db)
        return PassportScanResponse(
            entry_logged=False,
            event_name=event.name,
            current_tier=reward.tier,
            events_attended=reward.events_attended,
            total_events_in_year=reward.total_events_in_year,
            next_tier_at=_next_tier_at(reward.tier, reward.events_attended, reward.total_events_in_year),
            tier_upgraded=False,
            already_scanned=True,
        )

    db.add(PassportEntry(
        user_id=current_user.id,
        event_id=event.id,
        event_year=year,
    ))
    db.flush()

    reward, _old_tier, upgraded = _recalculate_tier(current_user, db)

    if upgraded:
        tier_label = reward.tier.value.capitalize()
        db.add(Notification(
            user_id=current_user.id,
            type=NotificationType.PASSPORT,
            title=f"You've reached {tier_label} tier!",
            body=f"Attended {reward.events_attended} RHIP events this year.",
            action_url="/passport",
        ))
        await email_service.send_passport_tier_upgrade_email(
            current_user, reward.tier.value, reward.events_attended
        )

    db.commit()

    return PassportScanResponse(
        entry_logged=True,
        event_name=event.name,
        current_tier=reward.tier,
        events_attended=reward.events_attended,
        total_events_in_year=reward.total_events_in_year,
        next_tier_at=_next_tier_at(reward.tier, reward.events_attended, reward.total_events_in_year),
        tier_upgraded=upgraded,
        already_scanned=False,
    )


@router.get("/my", response_model=PassportMyResponse)
def get_my_passport(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    year = _current_year()
    reward, _, _ = _recalculate_tier(current_user, db)
    db.commit()

    entries = (
        db.query(PassportEntry)
        .filter(PassportEntry.user_id == current_user.id, PassportEntry.event_year == year)
        .order_by(PassportEntry.scanned_at.desc())
        .all()
    )
    entry_responses = []
    for entry in entries:
        event = db.query(Event).filter(Event.id == entry.event_id).first()
        if event:
            entry_responses.append(_entry_to_response(entry, event))

    return PassportMyResponse(
        tier=reward.tier,
        events_attended=reward.events_attended,
        total_events_in_year=reward.total_events_in_year,
        entries=entry_responses,
        next_reward=_next_reward_text(reward.tier, reward.events_attended, reward.total_events_in_year),
        past_gold=current_user.past_gold,
        year=year,
    )


@router.get("/events", response_model=PassportEventsResponse)
def list_passport_events(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    year = _current_year()
    attended_ids = {
        e.event_id
        for e in db.query(PassportEntry)
        .filter(PassportEntry.user_id == current_user.id, PassportEntry.event_year == year)
        .all()
    }
    events = (
        db.query(Event)
        .filter(Event.event_year == year)
        .order_by(Event.date.asc())
        .all()
    )
    return PassportEventsResponse(events=[
        PassportEventResponse(
            id=ev.id,
            name=ev.name,
            date=ev.date,
            type=ev.type,
            qr_code=ev.qr_code,
            attended=ev.id in attended_ids,
        )
        for ev in events
    ])


admin_router = APIRouter(prefix="/admin/passport", tags=["admin-passport"])


@admin_router.post("/reset-year", response_model=OkResponse)
def reset_passport_year(
    db: Session = Depends(get_db),
    _admin: User = Depends(require_roles([Role.ADMIN])),
):
    new_year = _current_year()

    gold_tiers = db.query(RewardTier).filter(RewardTier.tier == RewardTierLevel.GOLD).all()
    for tier in gold_tiers:
        user = db.query(User).filter(User.id == tier.user_id).first()
        if user:
            user.past_gold = True

    db.query(RewardTier).update({
        "tier": RewardTierLevel.NONE,
        "events_attended": 0,
        "grant_awarded": False,
        "year": new_year,
        "last_calculated": datetime.utcnow(),
    }, synchronize_session=False)
    db.flush()

    users_with_passport = (
        db.query(User)
        .join(PassportEntry, PassportEntry.user_id == User.id)
        .distinct()
        .all()
    )
    for user in users_with_passport:
        db.add(Notification(
            user_id=user.id,
            type=NotificationType.PASSPORT,
            title="Passport year reset",
            body=f"The passport year has reset. Start attending {new_year} RHIP events to earn rewards.",
            action_url="/passport",
        ))

    db.commit()
    return OkResponse()
