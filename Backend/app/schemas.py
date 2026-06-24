from datetime import date, datetime
from typing import Optional

from pydantic import BaseModel, EmailStr, Field

from app.models import (
    ChallengeStatus,
    EventType,
    KPICategory,
    NotificationType,
    Readiness,
    RewardTierLevel,
    Role,
    ThreadStatus,
    Visibility,
)


# Auth
class SignupRequest(BaseModel):
    name: str
    email: EmailStr
    password: str = Field(min_length=8)
    role: Role
    institution_name: str
    specialty_area: Optional[str] = None


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    role: Role
    user_id: str
    name: str


class RefreshRequest(BaseModel):
    refresh_token: str


class RefreshResponse(BaseModel):
    access_token: str


class MessageResponse(BaseModel):
    message: str


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str = Field(min_length=8)


class FirebaseSignupRequest(BaseModel):
    id_token: str
    name: str
    role: Role
    institution_name: str
    specialty_area: Optional[str] = None


class FirebaseLoginRequest(BaseModel):
    id_token: str


# Profile / Directory
class ProfilePatent(BaseModel):
    title: str
    number: Optional[str] = None
    year: Optional[int] = None


class ProfileNewsItem(BaseModel):
    title: str
    date: str
    summary: str
    url: Optional[str] = None


class ProfileAward(BaseModel):
    title: str
    year: int
    organisation: str


class ProfileSummary(BaseModel):
    id: str
    name: str
    title: str
    specialty_area: str
    expertise_tags: list[str]
    publications: int
    active_projects: int
    institution_name: Optional[str] = None

    model_config = {"from_attributes": True}


class ProfileDetail(ProfileSummary):
    bio: str
    is_public: bool
    is_own_profile: bool = False
    patents: list[ProfilePatent] = Field(default_factory=list)
    news: list[ProfileNewsItem] = Field(default_factory=list)
    awards: list[ProfileAward] = Field(default_factory=list)
    projects: list["ProjectResponse"] = Field(default_factory=list)


class DirectorySearchResponse(BaseModel):
    profiles: list[ProfileSummary]
    total: int
    page: int


# Challenges
class ChallengeCreate(BaseModel):
    title: str
    description: str = Field(min_length=50)
    specialty_area: Optional[str] = None


class ChallengePosterSnippet(BaseModel):
    id: str
    name: str
    title: Optional[str] = None

    model_config = {"from_attributes": True}


class ChallengeResponse(BaseModel):
    id: str
    title: str
    description: str
    specialty_area: str
    status: ChallengeStatus
    created_at: datetime
    posted_by: Optional[ChallengePosterSnippet] = None

    model_config = {"from_attributes": True}


class ChallengeListResponse(BaseModel):
    challenges: list[ChallengeResponse]
    total: int


class AIMatchResponse(BaseModel):
    id: str
    profile_id: str
    score: float
    reasoning: str
    rank: int
    profile: Optional[ProfileSummary] = None

    model_config = {"from_attributes": True}


class ChallengeMatchesResponse(BaseModel):
    matches: list[AIMatchResponse]
    challenge_status: ChallengeStatus


# KPIs
class KPIResponse(BaseModel):
    id: str
    metric_name: str
    display_label: str
    value: float
    display_value: str
    category: KPICategory
    audience: list[str]
    period: str
    unit: Optional[str] = None
    is_live: bool

    model_config = {"from_attributes": True}


class KPIUpdate(BaseModel):
    value: Optional[float] = None
    display_value: Optional[str] = None


# Pipeline
class ProjectResponse(BaseModel):
    id: str
    title: str
    description: str
    stage: int
    specialty_area: str
    readiness: Readiness
    visibility: Visibility
    lead_researcher_name: Optional[str] = None

    model_config = {"from_attributes": True}


class ProjectListResponse(BaseModel):
    projects: list[ProjectResponse]


class ProjectCreate(BaseModel):
    title: str
    description: str
    stage: int = Field(ge=1, le=10)
    specialty_area: str
    readiness: Readiness
    visibility: Visibility


# Forms
class TenantEnquiryCreate(BaseModel):
    company_name: str
    contact_name: str
    email: EmailStr
    phone: str
    company_type: str
    desks_needed: int
    preferred_start: Optional[date] = None
    message: str = ""


class InvestorEnquiryCreate(BaseModel):
    name: str
    email: EmailStr
    phone: str
    message: str


# Notifications
class NotificationResponse(BaseModel):
    id: str
    type: NotificationType
    title: str
    body: str
    action_url: Optional[str] = None
    is_read: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class NotificationListResponse(BaseModel):
    notifications: list[NotificationResponse]
    unread_count: int


class OkResponse(BaseModel):
    ok: bool = True


# Threads / Messages
class ThreadInitiateRequest(BaseModel):
    match_id: str
    opening_message: str = Field(min_length=1)


class DirectThreadInitiateRequest(BaseModel):
    profile_id: str
    opening_message: str = Field(min_length=1)


class ThreadInitiateResponse(BaseModel):
    thread_id: str
    status: ThreadStatus
    is_new: bool = True


class ProfileThreadResponse(BaseModel):
    thread_id: Optional[str] = None
    status: Optional[ThreadStatus] = None


class ThreadRespondRequest(BaseModel):
    accepted: bool


class ThreadRespondResponse(BaseModel):
    thread_id: str
    status: ThreadStatus


class ChallengeContext(BaseModel):
    id: str
    title: str
    description: str
    specialty_area: str
    posted_by_name: Optional[str] = None


class ChatMessageResponse(BaseModel):
    id: str
    thread_id: str
    sender_id: str
    sender_name: str
    content: str
    created_at: datetime
    is_mine: bool = False

    model_config = {"from_attributes": True}


class MessageCreate(BaseModel):
    content: str = Field(min_length=1)


class ThreadListItem(BaseModel):
    id: str
    status: ThreadStatus
    challenge_title: Optional[str] = None
    other_participant_name: str
    last_message_snippet: Optional[str] = None
    last_message_at: Optional[datetime] = None
    unread: bool = False
    pending_response: bool = False


class ThreadListResponse(BaseModel):
    threads: list[ThreadListItem]


class ThreadMessagesResponse(BaseModel):
    messages: list[ChatMessageResponse]
    challenge_context: Optional[ChallengeContext] = None
    thread_status: ThreadStatus
    can_respond: bool = False


# Passport
class PassportScanRequest(BaseModel):
    qr_code: str = Field(min_length=1)


class PassportEntryResponse(BaseModel):
    id: str
    event_id: str
    event_name: str
    event_type: EventType
    event_date: date
    scanned_at: datetime

    model_config = {"from_attributes": True}


class PassportScanResponse(BaseModel):
    entry_logged: bool
    event_name: str
    current_tier: RewardTierLevel
    events_attended: int
    total_events_in_year: int
    next_tier_at: Optional[int] = None
    tier_upgraded: bool
    already_scanned: bool = False


class PassportMyResponse(BaseModel):
    tier: RewardTierLevel
    events_attended: int
    total_events_in_year: int
    entries: list[PassportEntryResponse]
    next_reward: Optional[str] = None
    past_gold: bool
    year: int


class PassportEventResponse(BaseModel):
    id: str
    name: str
    date: date
    type: EventType
    qr_code: str
    attended: bool


class PassportEventsResponse(BaseModel):
    events: list[PassportEventResponse]


# User
class UserResponse(BaseModel):
    id: str
    name: str
    email: str
    role: Role
    specialty_area: Optional[str] = None
    is_verified: bool
    is_active: bool

    model_config = {"from_attributes": True}


# Admin
class UserAdminResponse(UserResponse):
    created_at: datetime

    model_config = {"from_attributes": True}


class UserAdminUpdate(BaseModel):
    role: Optional[Role] = None
    is_active: Optional[bool] = None


class EventCreate(BaseModel):
    name: str = Field(min_length=1)
    date: date
    type: EventType


class EventAdminResponse(BaseModel):
    id: str
    name: str
    date: date
    event_year: int
    qr_code: str
    type: EventType

    model_config = {"from_attributes": True}


class TenantEnquiryResponse(BaseModel):
    id: str
    company_name: str
    contact_name: str
    email: str
    phone: str
    company_type: str
    desks_needed: int
    preferred_start: Optional[date] = None
    message: str
    submitted_at: datetime

    model_config = {"from_attributes": True}


class InvestorEnquiryResponse(BaseModel):
    id: str
    name: str
    email: str
    phone: str
    message: str
    submitted_at: datetime

    model_config = {"from_attributes": True}


class EnquiriesListResponse(BaseModel):
    tenants: list[TenantEnquiryResponse]
    investors: list[InvestorEnquiryResponse]


# Investor
class InvestorOverviewResponse(BaseModel):
    kpis: list[KPIResponse]
    hth_occupancy: Optional[KPIResponse] = None
    projects: list[ProjectResponse]
    investable_count: int


# Community / Public health services
class PatientResource(BaseModel):
    title: str
    description: str
    url: Optional[str] = None


class FacilitySummary(BaseModel):
    id: str
    slug: str
    name: str
    address: str
    phone: str
    description: str
    district_slug: str
    district_name: str
    service_count: int = 0

    model_config = {"from_attributes": True}


class ServiceSummary(BaseModel):
    id: str
    slug: str
    name: str
    summary: str
    specialty: str
    facility_name: str
    facility_slug: str
    district_slug: str
    contact_phone: str

    model_config = {"from_attributes": True}


class ServiceTeamMemberResponse(BaseModel):
    id: str
    name: str
    title: str
    role: str
    phone: str
    profile_id: Optional[str] = None

    model_config = {"from_attributes": True}


class ServiceDetail(ServiceSummary):
    description: str
    contact_email: str
    contact_address: str
    referral_info: str
    patient_resources: list[PatientResource] = Field(default_factory=list)
    team: list[ServiceTeamMemberResponse] = Field(default_factory=list)
    district_name: str


class ServiceListResponse(BaseModel):
    services: list[ServiceSummary]
    total: int
    specialties: list[str] = Field(default_factory=list)


class SpecialistSummary(BaseModel):
    id: str
    slug: str
    name: str
    title: str
    specialties: list[str]
    department: str
    facility_name: str
    facility_slug: str
    phone: str
    address: str
    service_name: Optional[str] = None
    service_slug: Optional[str] = None
    profile_id: Optional[str] = None

    model_config = {"from_attributes": True}


class SpecialistDetail(SpecialistSummary):
    district_name: str
    district_slug: str
    bio: str = ""
    email: str = ""
    clinic_hours: str = ""
    languages: list[str] = Field(default_factory=list)
    accepting_referrals: bool = True
    related_specialists: list[SpecialistSummary] = Field(default_factory=list)


class SpecialistListResponse(BaseModel):
    specialists: list[SpecialistSummary]
    total: int
    specialties: list[str] = Field(default_factory=list)


class ServiceAdminResponse(BaseModel):
    id: str
    slug: str
    name: str
    summary: str
    description: str
    specialty: str
    contact_phone: str
    contact_email: str
    contact_address: str
    referral_info: str
    patient_resources: list[PatientResource] = Field(default_factory=list)
    is_public: bool
    facility_id: str
    facility_name: str
    district_id: str

    model_config = {"from_attributes": True}


class ServiceAdminCreate(BaseModel):
    name: str
    summary: str
    description: str = ""
    specialty: str
    contact_phone: str = ""
    contact_email: str = ""
    contact_address: str = ""
    referral_info: str = ""
    facility_id: str
    is_public: bool = True


class ServiceAdminUpdate(BaseModel):
    name: Optional[str] = None
    summary: Optional[str] = None
    description: Optional[str] = None
    specialty: Optional[str] = None
    contact_phone: Optional[str] = None
    contact_email: Optional[str] = None
    contact_address: Optional[str] = None
    referral_info: Optional[str] = None
    is_public: Optional[bool] = None


class SpecialistAdminResponse(BaseModel):
    id: str
    slug: str
    name: str
    title: str
    specialties: list[str]
    department: str
    phone: str
    address: str
    email: str
    bio: str
    clinic_hours: str
    languages: list[str]
    accepting_referrals: bool
    is_public: bool
    facility_id: str
    facility_name: str
    service_id: Optional[str] = None
    service_name: Optional[str] = None
    profile_id: Optional[str] = None

    model_config = {"from_attributes": True}


class SpecialistAdminCreate(BaseModel):
    name: str
    title: str = ""
    specialties: list[str] = Field(default_factory=list)
    department: str = ""
    phone: str = ""
    address: str = ""
    email: str = ""
    bio: str = ""
    clinic_hours: str = ""
    languages: list[str] = Field(default_factory=list)
    accepting_referrals: bool = True
    facility_id: str
    service_id: Optional[str] = None
    is_public: bool = True


class SpecialistAdminUpdate(BaseModel):
    name: Optional[str] = None
    title: Optional[str] = None
    specialties: Optional[list[str]] = None
    department: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    email: Optional[str] = None
    bio: Optional[str] = None
    clinic_hours: Optional[str] = None
    languages: Optional[list[str]] = None
    accepting_referrals: Optional[bool] = None
    service_id: Optional[str] = None
    is_public: Optional[bool] = None


class FacilityAdminOption(BaseModel):
    id: str
    name: str
    slug: str


class ServiceAdminOption(BaseModel):
    id: str
    name: str
    slug: str
    specialty: str


class DistrictMetrics(BaseModel):
    kpis: list[KPIResponse]
    facility_count: int
    service_count: int
    specialist_count: int


class DistrictSummary(BaseModel):
    id: str
    slug: str
    name: str
    description: str

    model_config = {"from_attributes": True}


class DistrictDetail(DistrictSummary):
    metrics: DistrictMetrics
    facilities: list[FacilitySummary]


ProfileDetail.model_rebuild()
