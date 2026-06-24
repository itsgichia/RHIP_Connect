from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app import email_service
from app.auth import get_current_user, require_roles
from app.database import get_db
from app.models import (
    AIMatch,
    Challenge,
    Message,
    Notification,
    NotificationType,
    ParticipantRole,
    Profile,
    Role,
    Thread,
    ThreadParticipant,
    ThreadStatus,
    User,
)
from app.schemas import (
    ChallengeContext,
    ChatMessageResponse,
    DirectThreadInitiateRequest,
    MessageCreate,
    ProfileThreadResponse,
    ThreadInitiateRequest,
    ThreadInitiateResponse,
    ThreadListItem,
    ThreadListResponse,
    ThreadMessagesResponse,
    ThreadRespondRequest,
    ThreadRespondResponse,
)

router = APIRouter(prefix="/threads", tags=["messages"])


def _get_participant(thread_id: str, user_id: str, db: Session) -> ThreadParticipant | None:
    return (
        db.query(ThreadParticipant)
        .filter(
            ThreadParticipant.thread_id == thread_id,
            ThreadParticipant.user_id == user_id,
        )
        .first()
    )


def _other_participant(thread_id: str, user_id: str, db: Session) -> ThreadParticipant | None:
    return (
        db.query(ThreadParticipant)
        .filter(
            ThreadParticipant.thread_id == thread_id,
            ThreadParticipant.user_id != user_id,
        )
        .first()
    )


def _require_participant(thread_id: str, user: User, db: Session) -> ThreadParticipant:
    participant = _get_participant(thread_id, user.id, db)
    if not participant:
        raise HTTPException(status_code=403, detail="Not a participant in this thread")
    return participant


def _find_direct_thread(user_a_id: str, user_b_id: str, db: Session) -> Thread | None:
    a_thread_ids = [
        row[0]
        for row in db.query(ThreadParticipant.thread_id)
        .filter(ThreadParticipant.user_id == user_a_id)
        .all()
    ]
    if not a_thread_ids:
        return None

    shared_thread_ids = [
        row[0]
        for row in db.query(ThreadParticipant.thread_id)
        .filter(
            ThreadParticipant.user_id == user_b_id,
            ThreadParticipant.thread_id.in_(a_thread_ids),
        )
        .all()
    ]
    if not shared_thread_ids:
        return None

    return (
        db.query(Thread)
        .filter(
            Thread.id.in_(shared_thread_ids),
            Thread.challenge_id.is_(None),
        )
        .order_by(Thread.created_at.desc())
        .first()
    )


@router.post("/initiate", response_model=ThreadInitiateResponse)
async def initiate_thread(
    body: ThreadInitiateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles([Role.CLINICIAN, Role.RESEARCHER, Role.ADMIN])),
):
    ai_match = db.query(AIMatch).filter(AIMatch.id == body.match_id).first()
    if not ai_match:
        raise HTTPException(status_code=404, detail="Match not found")

    existing = db.query(Thread).filter(Thread.match_id == body.match_id).first()
    if existing:
        raise HTTPException(status_code=400, detail="Connection request already sent for this match")

    challenge = db.query(Challenge).filter(Challenge.id == ai_match.challenge_id).first()
    if not challenge:
        raise HTTPException(status_code=404, detail="Challenge not found")

    profile = db.query(Profile).filter(Profile.id == ai_match.profile_id).first()
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")

    receiver = db.query(User).filter(User.id == profile.user_id).first()
    if not receiver:
        raise HTTPException(status_code=404, detail="Receiver not found")

    if receiver.id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot connect with your own profile")

    thread = Thread(
        challenge_id=challenge.id,
        match_id=ai_match.id,
        status=ThreadStatus.PENDING,
    )
    db.add(thread)
    db.flush()

    db.add(ThreadParticipant(
        thread_id=thread.id,
        user_id=current_user.id,
        role=ParticipantRole.INITIATOR,
        accepted=True,
        joined_at=datetime.utcnow(),
    ))
    db.add(ThreadParticipant(
        thread_id=thread.id,
        user_id=receiver.id,
        role=ParticipantRole.RECEIVER,
        accepted=False,
    ))
    db.add(Message(
        thread_id=thread.id,
        sender_id=current_user.id,
        content=body.opening_message,
    ))
    db.add(Notification(
        user_id=receiver.id,
        type=NotificationType.CONNECTION_REQUEST,
        title=f"{current_user.name} wants to connect",
        body=f"Re: '{challenge.title}' — open Messages to accept or decline.",
        action_url=f"/messages/{thread.id}",
    ))
    db.commit()

    await email_service.send_connection_request_email(
        receiver, current_user, challenge, body.opening_message
    )

    return ThreadInitiateResponse(thread_id=thread.id, status=thread.status)


@router.get("/by-profile/{profile_id}", response_model=ProfileThreadResponse)
def get_thread_by_profile(
    profile_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles([Role.CLINICIAN, Role.RESEARCHER, Role.ADMIN])),
):
    profile = db.query(Profile).filter(Profile.id == profile_id).first()
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")
    if profile.user_id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot message your own profile")

    existing = _find_direct_thread(current_user.id, profile.user_id, db)
    if not existing:
        return ProfileThreadResponse()

    return ProfileThreadResponse(thread_id=existing.id, status=existing.status)


@router.post("/initiate-profile", response_model=ThreadInitiateResponse)
async def initiate_profile_thread(
    body: DirectThreadInitiateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles([Role.CLINICIAN, Role.RESEARCHER, Role.ADMIN])),
):
    profile = db.query(Profile).filter(Profile.id == body.profile_id).first()
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")

    receiver = db.query(User).filter(User.id == profile.user_id).first()
    if not receiver:
        raise HTTPException(status_code=404, detail="Receiver not found")

    if receiver.id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot connect with your own profile")

    existing = _find_direct_thread(current_user.id, receiver.id, db)
    if existing:
        return ThreadInitiateResponse(
            thread_id=existing.id,
            status=existing.status,
            is_new=False,
        )

    thread = Thread(status=ThreadStatus.PENDING)
    db.add(thread)
    db.flush()

    db.add(ThreadParticipant(
        thread_id=thread.id,
        user_id=current_user.id,
        role=ParticipantRole.INITIATOR,
        accepted=True,
        joined_at=datetime.utcnow(),
    ))
    db.add(ThreadParticipant(
        thread_id=thread.id,
        user_id=receiver.id,
        role=ParticipantRole.RECEIVER,
        accepted=False,
    ))
    db.add(Message(
        thread_id=thread.id,
        sender_id=current_user.id,
        content=body.opening_message,
    ))
    db.add(Notification(
        user_id=receiver.id,
        type=NotificationType.CONNECTION_REQUEST,
        title=f"{current_user.name} wants to connect",
        body=f"Message from the Expertise Directory — open Messages to accept or decline.",
        action_url=f"/messages/{thread.id}",
    ))
    db.commit()

    await email_service.send_connection_request_email(
        receiver, current_user, None, body.opening_message
    )

    return ThreadInitiateResponse(thread_id=thread.id, status=thread.status, is_new=True)


@router.post("/{thread_id}/respond", response_model=ThreadRespondResponse)
def respond_to_thread(
    thread_id: str,
    body: ThreadRespondRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    thread = db.query(Thread).filter(Thread.id == thread_id).first()
    if not thread:
        raise HTTPException(status_code=404, detail="Thread not found")

    participant = _require_participant(thread_id, current_user, db)
    if participant.role != ParticipantRole.RECEIVER:
        raise HTTPException(status_code=403, detail="Only the receiver can respond")
    if thread.status != ThreadStatus.PENDING:
        raise HTTPException(status_code=400, detail="Thread is no longer pending")

    initiator_part = _other_participant(thread_id, current_user.id, db)
    challenge = (
        db.query(Challenge).filter(Challenge.id == thread.challenge_id).first()
        if thread.challenge_id
        else None
    )

    if body.accepted:
        participant.accepted = True
        participant.joined_at = datetime.utcnow()
        thread.status = ThreadStatus.ACTIVE
        notif_title = f"{current_user.name} accepted your connection"
        notif_body = f"You can now chat about '{challenge.title if challenge else 'your challenge'}'."
    else:
        thread.status = ThreadStatus.DECLINED
        notif_title = f"{current_user.name} declined your connection"
        notif_body = f"Your request regarding '{challenge.title if challenge else 'a challenge'}' was declined."

    if initiator_part:
        db.add(Notification(
            user_id=initiator_part.user_id,
            type=NotificationType.CONNECTION_REQUEST,
            title=notif_title,
            body=notif_body,
            action_url=f"/messages/{thread.id}",
        ))

    db.commit()
    return ThreadRespondResponse(thread_id=thread.id, status=thread.status)


@router.get("", response_model=ThreadListResponse)
def list_threads(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    participant_rows = (
        db.query(ThreadParticipant)
        .filter(ThreadParticipant.user_id == current_user.id)
        .all()
    )
    thread_ids = [p.thread_id for p in participant_rows]
    if not thread_ids:
        return ThreadListResponse(threads=[])

    threads = db.query(Thread).filter(Thread.id.in_(thread_ids)).order_by(Thread.created_at.desc()).all()
    results = []

    for thread in threads:
        my_part = _get_participant(thread.id, current_user.id, db)
        other_part = _other_participant(thread.id, current_user.id, db)
        other_user = (
            db.query(User).filter(User.id == other_part.user_id).first()
            if other_part
            else None
        )
        challenge = (
            db.query(Challenge).filter(Challenge.id == thread.challenge_id).first()
            if thread.challenge_id
            else None
        )
        last_msg = (
            db.query(Message)
            .filter(Message.thread_id == thread.id)
            .order_by(Message.created_at.desc())
            .first()
        )
        unread = (
            db.query(Message)
            .filter(
                Message.thread_id == thread.id,
                Message.sender_id != current_user.id,
                Message.read_at.is_(None),
            )
            .count()
            > 0
        )
        pending_response = (
            my_part.role == ParticipantRole.RECEIVER
            and not my_part.accepted
            and thread.status == ThreadStatus.PENDING
        )

        results.append(ThreadListItem(
            id=thread.id,
            status=thread.status,
            challenge_title=challenge.title if challenge else None,
            other_participant_name=other_user.name if other_user else "Unknown",
            last_message_snippet=(
                last_msg.content[:80] + ("…" if len(last_msg.content) > 80 else "")
                if last_msg
                else None
            ),
            last_message_at=last_msg.created_at if last_msg else thread.created_at,
            unread=unread,
            pending_response=pending_response,
        ))

    return ThreadListResponse(threads=results)


@router.get("/{thread_id}/messages", response_model=ThreadMessagesResponse)
def get_thread_messages(
    thread_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    thread = db.query(Thread).filter(Thread.id == thread_id).first()
    if not thread:
        raise HTTPException(status_code=404, detail="Thread not found")
    _require_participant(thread_id, current_user, db)

    my_part = _get_participant(thread_id, current_user.id, db)
    can_respond = (
        my_part.role == ParticipantRole.RECEIVER
        and thread.status == ThreadStatus.PENDING
        and not my_part.accepted
    )

    messages = (
        db.query(Message)
        .filter(Message.thread_id == thread_id)
        .order_by(Message.created_at.asc())
        .all()
    )

    for msg in messages:
        if msg.sender_id != current_user.id and msg.read_at is None:
            msg.read_at = datetime.utcnow()

    db.commit()

    challenge_context = None
    if thread.challenge_id:
        challenge = db.query(Challenge).filter(Challenge.id == thread.challenge_id).first()
        if challenge:
            poster = db.query(User).filter(User.id == challenge.posted_by).first()
            challenge_context = ChallengeContext(
                id=challenge.id,
                title=challenge.title,
                description=challenge.description,
                specialty_area=challenge.specialty_area,
                posted_by_name=poster.name if poster else None,
            )

    chat_messages = []
    for msg in messages:
        sender = db.query(User).filter(User.id == msg.sender_id).first()
        chat_messages.append(ChatMessageResponse(
            id=msg.id,
            thread_id=msg.thread_id,
            sender_id=msg.sender_id,
            sender_name=sender.name if sender else "Unknown",
            content=msg.content,
            created_at=msg.created_at,
            is_mine=msg.sender_id == current_user.id,
        ))

    return ThreadMessagesResponse(
        messages=chat_messages,
        challenge_context=challenge_context,
        thread_status=thread.status,
        can_respond=can_respond,
    )


@router.post("/{thread_id}/messages", response_model=ChatMessageResponse)
async def send_message(
    thread_id: str,
    body: MessageCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    thread = db.query(Thread).filter(Thread.id == thread_id).first()
    if not thread:
        raise HTTPException(status_code=404, detail="Thread not found")
    _require_participant(thread_id, current_user, db)

    if thread.status != ThreadStatus.ACTIVE:
        raise HTTPException(status_code=400, detail="Thread is not active")

    message = Message(
        thread_id=thread_id,
        sender_id=current_user.id,
        content=body.content,
    )
    db.add(message)

    other_part = _other_participant(thread_id, current_user.id, db)
    if other_part:
        db.add(Notification(
            user_id=other_part.user_id,
            type=NotificationType.MESSAGE,
            title=f"New message from {current_user.name}",
            body=body.content[:120],
            action_url=f"/messages/{thread_id}",
        ))

    db.commit()
    db.refresh(message)

    if other_part:
        recipient = db.query(User).filter(User.id == other_part.user_id).first()
        if recipient:
            recent = (
                db.query(Message)
                .filter(
                    Message.thread_id == thread_id,
                    Message.sender_id == recipient.id,
                    Message.read_at.isnot(None),
                )
                .order_by(Message.read_at.desc())
                .first()
            )
            should_email = (
                not recent
                or recent.read_at < datetime.utcnow() - timedelta(minutes=30)
            )
            if should_email:
                await email_service.send_new_message_email(recipient, current_user, thread_id)

    return ChatMessageResponse(
        id=message.id,
        thread_id=message.thread_id,
        sender_id=message.sender_id,
        sender_name=current_user.name,
        content=message.content,
        created_at=message.created_at,
        is_mine=True,
    )
