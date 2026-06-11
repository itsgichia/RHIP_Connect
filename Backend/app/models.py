import enum
import uuid
from datetime import date, datetime

from sqlalchemy import (
    JSON,
    Boolean,
    Date,
    DateTime,
    Enum,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Role(str, enum.Enum):
    ADMIN = "admin"
    CLINICIAN = "clinician"
    RESEARCHER = "researcher"
    INDUSTRY = "industry"
    INVESTOR = "investor"


class InstitutionType(str, enum.Enum):
    HOSPITAL = "hospital"
    UNIVERSITY = "university"
    MRI = "MRI"
    INDUSTRY = "industry"


class ChallengeStatus(str, enum.Enum):
    PENDING = "pending"
    MATCHING = "matching"
    MATCHED = "matched"
    CLOSED = "closed"


class ThreadStatus(str, enum.Enum):
    PENDING = "pending"
    ACTIVE = "active"
    DECLINED = "declined"
    CLOSED = "closed"


class ParticipantRole(str, enum.Enum):
    INITIATOR = "initiator"
    RECEIVER = "receiver"


class NotificationType(str, enum.Enum):
    MATCH = "match"
    CONNECTION_REQUEST = "connection_request"
    MESSAGE = "message"
    PASSPORT = "passport"
    SYSTEM = "system"


class Readiness(str, enum.Enum):
    EARLY = "early"
    FEASIBILITY = "feasibility"
    CLINICAL = "clinical"
    COMMERCIAL = "commercial"


class Visibility(str, enum.Enum):
    PUBLIC = "public"
    PRECINCT = "precinct"
    INTERNAL = "internal"


class EventType(str, enum.Enum):
    CONFERENCE = "conference"
    WORKSHOP = "workshop"
    SHOWCASE = "showcase"
    NETWORKING = "networking"


class RewardTierLevel(str, enum.Enum):
    NONE = "none"
    BRONZE = "bronze"
    SILVER = "silver"
    GOLD = "gold"


class KPICategory(str, enum.Enum):
    CORE = "core"
    RESEARCH = "research"
    CLINICAL = "clinical"
    COMMERCIAL = "commercial"
    FACILITY = "facility"


class EmailTokenType(str, enum.Enum):
    VERIFY = "verify"
    RESET = "reset"


def _uuid() -> str:
    return str(uuid.uuid4())


class Institution(Base):
    __tablename__ = "institutions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    type: Mapped[InstitutionType] = mapped_column(Enum(InstitutionType), nullable=False)
    partner_pct: Mapped[int | None] = mapped_column(Integer, nullable=True)

    users: Mapped[list["User"]] = relationship(back_populates="institution")


class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[Role] = mapped_column(Enum(Role), nullable=False)
    institution_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("institutions.id"), nullable=True
    )
    specialty_area: Mapped[str | None] = mapped_column(String(255), nullable=True)
    is_verified: Mapped[bool] = mapped_column(Boolean, default=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=False)
    past_gold: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    institution: Mapped["Institution | None"] = relationship(back_populates="users")
    profile: Mapped["Profile | None"] = relationship(back_populates="user", uselist=False)
    email_tokens: Mapped[list["EmailToken"]] = relationship(back_populates="user")
    notifications: Mapped[list["Notification"]] = relationship(back_populates="user")


class EmailToken(Base):
    __tablename__ = "email_tokens"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"), nullable=False)
    token: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    type: Mapped[EmailTokenType] = mapped_column(Enum(EmailTokenType), nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    used: Mapped[bool] = mapped_column(Boolean, default=False)

    user: Mapped["User"] = relationship(back_populates="email_tokens")


class Profile(Base):
    __tablename__ = "profiles"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    user_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id"), unique=True, nullable=False
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    specialty_area: Mapped[str] = mapped_column(String(255), nullable=False)
    expertise_tags: Mapped[list] = mapped_column(JSON, default=list)
    bio: Mapped[str] = mapped_column(Text, default="")
    publications: Mapped[int] = mapped_column(Integer, default=0)
    active_projects: Mapped[int] = mapped_column(Integer, default=0)
    is_public: Mapped[bool] = mapped_column(Boolean, default=True)

    user: Mapped["User"] = relationship(back_populates="profile")
    institution_name: Mapped[str | None] = None  # populated in API responses


class Challenge(Base):
    __tablename__ = "challenges"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    posted_by: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"), nullable=False)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    specialty_area: Mapped[str] = mapped_column(String(255), nullable=False)
    status: Mapped[ChallengeStatus] = mapped_column(
        Enum(ChallengeStatus), default=ChallengeStatus.PENDING
    )
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    poster: Mapped["User"] = relationship(foreign_keys=[posted_by])
    matches: Mapped[list["AIMatch"]] = relationship(back_populates="challenge")


class AIMatch(Base):
    __tablename__ = "ai_matches"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    challenge_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("challenges.id"), nullable=False
    )
    profile_id: Mapped[str] = mapped_column(String(36), ForeignKey("profiles.id"), nullable=False)
    score: Mapped[float] = mapped_column(Float, nullable=False)
    reasoning: Mapped[str] = mapped_column(Text, nullable=False)
    rank: Mapped[int] = mapped_column(Integer, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    challenge: Mapped["Challenge"] = relationship(back_populates="matches")
    profile: Mapped["Profile"] = relationship()


class Thread(Base):
    __tablename__ = "threads"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    challenge_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("challenges.id"), nullable=True
    )
    match_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("ai_matches.id"), nullable=True
    )
    status: Mapped[ThreadStatus] = mapped_column(Enum(ThreadStatus), default=ThreadStatus.PENDING)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class ThreadParticipant(Base):
    __tablename__ = "thread_participants"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    thread_id: Mapped[str] = mapped_column(String(36), ForeignKey("threads.id"), nullable=False)
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"), nullable=False)
    role: Mapped[ParticipantRole] = mapped_column(Enum(ParticipantRole), nullable=False)
    accepted: Mapped[bool] = mapped_column(Boolean, default=False)
    joined_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)


class Message(Base):
    __tablename__ = "messages"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    thread_id: Mapped[str] = mapped_column(String(36), ForeignKey("threads.id"), nullable=False)
    sender_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    read_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)


class Notification(Base):
    __tablename__ = "notifications"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"), nullable=False)
    type: Mapped[NotificationType] = mapped_column(Enum(NotificationType), nullable=False)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    body: Mapped[str] = mapped_column(Text, nullable=False)
    action_url: Mapped[str | None] = mapped_column(String(512), nullable=True)
    is_read: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    user: Mapped["User"] = relationship(back_populates="notifications")


class Project(Base):
    __tablename__ = "projects"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    stage: Mapped[int] = mapped_column(Integer, nullable=False)
    specialty_area: Mapped[str] = mapped_column(String(255), nullable=False)
    lead_researcher_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id"), nullable=False
    )
    clinical_partner_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("users.id"), nullable=True
    )
    readiness: Mapped[Readiness] = mapped_column(Enum(Readiness), nullable=False)
    visibility: Mapped[Visibility] = mapped_column(Enum(Visibility), nullable=False)


class Event(Base):
    __tablename__ = "events"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    date: Mapped[date] = mapped_column(Date, nullable=False)
    event_year: Mapped[int] = mapped_column(Integer, nullable=False)
    qr_code: Mapped[str] = mapped_column(String(64), unique=True, nullable=False)
    type: Mapped[EventType] = mapped_column(Enum(EventType), nullable=False)
    created_by: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"), nullable=False)


class PassportEntry(Base):
    __tablename__ = "passport_entries"
    __table_args__ = (UniqueConstraint("user_id", "event_id", name="uq_user_event"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"), nullable=False)
    event_id: Mapped[str] = mapped_column(String(36), ForeignKey("events.id"), nullable=False)
    event_year: Mapped[int] = mapped_column(Integer, nullable=False)
    scanned_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class RewardTier(Base):
    __tablename__ = "reward_tiers"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    user_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id"), unique=True, nullable=False
    )
    year: Mapped[int] = mapped_column(Integer, nullable=False)
    tier: Mapped[RewardTierLevel] = mapped_column(
        Enum(RewardTierLevel), default=RewardTierLevel.NONE
    )
    events_attended: Mapped[int] = mapped_column(Integer, default=0)
    total_events_in_year: Mapped[int] = mapped_column(Integer, default=0)
    grant_awarded: Mapped[bool] = mapped_column(Boolean, default=False)
    last_calculated: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class KPI(Base):
    __tablename__ = "kpis"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    metric_name: Mapped[str] = mapped_column(String(255), nullable=False)
    display_label: Mapped[str] = mapped_column(String(255), nullable=False)
    value: Mapped[float] = mapped_column(Float, nullable=False)
    display_value: Mapped[str] = mapped_column(String(64), nullable=False)
    category: Mapped[KPICategory] = mapped_column(Enum(KPICategory), nullable=False)
    audience: Mapped[list] = mapped_column(JSON, default=list)
    period: Mapped[str] = mapped_column(String(32), default="2026")
    unit: Mapped[str | None] = mapped_column(String(16), nullable=True)
    is_live: Mapped[bool] = mapped_column(Boolean, default=False)


class TenantEnquiry(Base):
    __tablename__ = "tenant_enquiries"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    company_name: Mapped[str] = mapped_column(String(255), nullable=False)
    contact_name: Mapped[str] = mapped_column(String(255), nullable=False)
    email: Mapped[str] = mapped_column(String(255), nullable=False)
    phone: Mapped[str] = mapped_column(String(64), nullable=False)
    company_type: Mapped[str] = mapped_column(String(64), nullable=False)
    desks_needed: Mapped[int] = mapped_column(Integer, nullable=False)
    preferred_start: Mapped[date | None] = mapped_column(Date, nullable=True)
    message: Mapped[str] = mapped_column(Text, default="")
    submitted_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class InvestorEnquiry(Base):
    __tablename__ = "investor_enquiries"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    email: Mapped[str] = mapped_column(String(255), nullable=False)
    phone: Mapped[str] = mapped_column(String(64), nullable=False)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    submitted_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
