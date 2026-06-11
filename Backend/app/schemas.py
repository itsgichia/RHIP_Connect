from datetime import date, datetime
from typing import Optional

from pydantic import BaseModel, EmailStr, Field

from app.models import (
    ChallengeStatus,
    KPICategory,
    NotificationType,
    Readiness,
    Role,
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


# Profile / Directory
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


class DirectorySearchResponse(BaseModel):
    profiles: list[ProfileSummary]
    total: int
    page: int


# Challenges
class ChallengeCreate(BaseModel):
    title: str
    description: str = Field(min_length=50)
    specialty_area: str


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
