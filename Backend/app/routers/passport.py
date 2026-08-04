import csv
import io
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app import email_service
from app.auth import get_current_user, require_roles
from app.database import get_db
from app.identity import user_can_view_cpd
from app.models import (
    CpdCategory,
    Event,
    Notification,
    NotificationType,
    PassportEntry,
    Profile,
    RewardTier,
    RewardTierLevel,
    Role,
    User,
)
from app.schemas import (
    CpdTranscriptEntry,
    CpdTranscriptResponse,
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

CPD_DISCLAIMER = (
    "This transcript is verified attendance evidence from RHIP Connect. "
    "It is not an accredited CPD certificate. Log hours in your college CPD home "
    "(e.g. MyCPD) according to your professional judgement and college guidance."
)

CPD_CATEGORY_LABELS = {
    CpdCategory.EDUCATIONAL_ACTIVITIES: "Educational Activities",
    CpdCategory.REVIEWING_PERFORMANCE: "Reviewing Performance",
    CpdCategory.MEASURING_OUTCOMES: "Measuring Outcomes",
}


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
        return f"Attend {remaining} more event{'s' if remaining != 1 else ''} for Bronze"
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
        cpd_eligible=bool(event.cpd_eligible),
        cpd_hours=event.cpd_hours if event.cpd_eligible else None,
        cpd_category=event.cpd_category if event.cpd_eligible else None,
        cpd_notes=event.cpd_notes if event.cpd_eligible else None,
    )


def _cpd_entries_for_user(user_id: str, year: int, db: Session) -> list[tuple[PassportEntry, Event]]:
    rows = (
        db.query(PassportEntry, Event)
        .join(Event, Event.id == PassportEntry.event_id)
        .filter(
            PassportEntry.user_id == user_id,
            PassportEntry.event_year == year,
            Event.cpd_eligible.is_(True),
            Event.cpd_hours.isnot(None),
            Event.cpd_category.isnot(None),
        )
        .order_by(Event.date.asc(), PassportEntry.scanned_at.asc())
        .all()
    )
    return rows


def _build_cpd_transcript(user: User, db: Session) -> CpdTranscriptResponse:
    year = _current_year()
    rows = _cpd_entries_for_user(user.id, year, db)
    hours_by_category: dict[str, float] = {c.value: 0.0 for c in CpdCategory}
    entries: list[CpdTranscriptEntry] = []
    total = 0.0

    for entry, event in rows:
        hours = float(event.cpd_hours or 0)
        total += hours
        hours_by_category[event.cpd_category.value] = (
            hours_by_category.get(event.cpd_category.value, 0.0) + hours
        )
        entries.append(
            CpdTranscriptEntry(
                event_id=event.id,
                event_name=event.name,
                event_type=event.type,
                event_date=event.date,
                scanned_at=entry.scanned_at,
                cpd_hours=hours,
                cpd_category=event.cpd_category,
                cpd_notes=event.cpd_notes,
                verified=True,
            )
        )

    return CpdTranscriptResponse(
        year=year,
        user_name=user.name,
        user_email=user.email,
        total_hours=round(total, 2),
        events_count=len(entries),
        hours_by_category={k: round(v, 2) for k, v in hours_by_category.items() if v > 0},
        entries=entries,
        disclaimer=CPD_DISCLAIMER,
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
            cpd_eligible=bool(event.cpd_eligible),
            cpd_hours=event.cpd_hours if event.cpd_eligible else None,
            cpd_category=event.cpd_category if event.cpd_eligible else None,
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
        cpd_eligible=bool(event.cpd_eligible),
        cpd_hours=event.cpd_hours if event.cpd_eligible else None,
        cpd_category=event.cpd_category if event.cpd_eligible else None,
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
    cpd_hours_total = 0.0
    cpd_events_count = 0
    for entry in entries:
        event = db.query(Event).filter(Event.id == entry.event_id).first()
        if event:
            entry_responses.append(_entry_to_response(entry, event))
            if event.cpd_eligible and event.cpd_hours:
                cpd_hours_total += float(event.cpd_hours)
                cpd_events_count += 1

    profile = db.query(Profile).filter(Profile.user_id == current_user.id).first()
    return PassportMyResponse(
        tier=reward.tier,
        events_attended=reward.events_attended,
        total_events_in_year=reward.total_events_in_year,
        entries=entry_responses,
        next_reward=_next_reward_text(reward.tier, reward.events_attended, reward.total_events_in_year),
        past_gold=current_user.past_gold,
        year=year,
        cpd_hours_total=round(cpd_hours_total, 2),
        cpd_events_count=cpd_events_count,
        can_view_cpd=user_can_view_cpd(current_user, profile),
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
            cpd_eligible=bool(ev.cpd_eligible),
            cpd_hours=ev.cpd_hours if ev.cpd_eligible else None,
            cpd_category=ev.cpd_category if ev.cpd_eligible else None,
        )
        for ev in events
    ])


@router.get("/cpd", response_model=CpdTranscriptResponse)
def get_cpd_transcript(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return _build_cpd_transcript(current_user, db)


@router.get("/cpd/export")
def export_cpd_transcript_csv(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    transcript = _build_cpd_transcript(current_user, db)
    buffer = io.StringIO()
    writer = csv.writer(buffer)
    writer.writerow([
        "Event name",
        "Event date",
        "Event type",
        "CPD hours",
        "CPD category",
        "Scanned at (UTC)",
        "Notes",
        "Verified attendance",
    ])
    for entry in transcript.entries:
        writer.writerow([
            entry.event_name,
            entry.event_date.isoformat(),
            entry.event_type.value,
            entry.cpd_hours,
            CPD_CATEGORY_LABELS.get(entry.cpd_category, entry.cpd_category.value),
            entry.scanned_at.isoformat(sep=" ", timespec="seconds"),
            entry.cpd_notes or "",
            "yes",
        ])
    writer.writerow([])
    writer.writerow(["Total CPD hours", transcript.total_hours])
    writer.writerow(["Year", transcript.year])
    writer.writerow(["Clinician", transcript.user_name])
    writer.writerow(["Email", transcript.user_email])
    writer.writerow(["Disclaimer", transcript.disclaimer])

    buffer.seek(0)
    filename = f"rhip-cpd-transcript-{transcript.year}.csv"
    return StreamingResponse(
        iter([buffer.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


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

    # Clear scan history for the reset year so tier recalculation stays at zero.
    db.query(PassportEntry).filter(PassportEntry.event_year == new_year).delete(
        synchronize_session=False
    )

    total_events = _total_events_in_year(new_year, db)
    db.query(RewardTier).update({
        "tier": RewardTierLevel.NONE,
        "events_attended": 0,
        "grant_awarded": False,
        "year": new_year,
        "total_events_in_year": total_events,
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
