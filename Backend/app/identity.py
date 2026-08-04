"""Identity facets helpers — multiselect profile identity vs platform access role."""

from __future__ import annotations

from app.constants import (
    CAREER_LEVELS,
    CLINICAL_SIGNAL_WORDS,
    IDENTITY_FACETS,
)
from app.models import Profile, Role, User


def normalize_facets(raw: list[str] | None) -> list[str]:
    if not raw:
        return []
    seen: set[str] = set()
    out: list[str] = []
    for item in raw:
        key = (item or "").strip().lower()
        if key in IDENTITY_FACETS and key not in seen:
            seen.add(key)
            out.append(key)
    return out


def normalize_career_level(raw: str | None) -> str | None:
    if not raw:
        return None
    key = raw.strip().lower()
    return key if key in CAREER_LEVELS else None


def access_role_from_facets(facets: list[str], fallback: Role | None = None) -> Role:
    """Map identity facets to a single User.role for API permission gates."""
    if "clinician" in facets:
        return Role.CLINICIAN
    if "researcher" in facets or "professional_technical" in facets or "policy" in facets:
        return Role.RESEARCHER
    if fallback:
        return fallback
    return Role.RESEARCHER


def derive_facets_from_seed(profile_data: dict) -> list[str]:
    """Infer facets for seed/manifest rows when identity_facets is absent."""
    explicit = normalize_facets(profile_data.get("identity_facets"))
    if explicit:
        return explicit

    role = (profile_data.get("role") or "researcher").lower()
    title = (profile_data.get("title") or "").lower()
    bio = (profile_data.get("bio") or "").lower()
    blob = f"{title} {bio}"

    if role == "clinician":
        facets = ["clinician"]
        if any(w in blob for w in ("research", "professor", "fellow", "trial")):
            facets.append("researcher")
        return facets

    facets = ["researcher"]
    if any(s in blob for s in CLINICAL_SIGNAL_WORDS):
        facets = ["clinician", "researcher"]
    return facets


def derive_career_level(profile_data: dict) -> str | None:
    explicit = normalize_career_level(profile_data.get("career_level"))
    if explicit:
        return explicit
    title = (profile_data.get("title") or "").lower()
    if "student" in title or "phd candidate" in title:
        return "student"
    if "fellow" in title or "lecturer" in title or "early career" in title:
        return "ecr"
    if "associate professor" in title or "senior research" in title or "senior lecturer" in title:
        return "mid"
    if "professor" in title or "director" in title or "head of" in title:
        return "senior"
    if "executive" in title or "ceo" in title:
        return "executive"
    return "mid"


def profile_facets(profile: Profile, user: User | None = None) -> list[str]:
    facets = normalize_facets(profile.identity_facets)
    if facets:
        return facets
    if user and user.role:
        if user.role == Role.CLINICIAN:
            return ["clinician"]
        if user.role == Role.RESEARCHER:
            return ["researcher"]
        if user.role == Role.ADMIN:
            return ["researcher"]
        if user.role == Role.INDUSTRY:
            return []
        if user.role == Role.INVESTOR:
            return []
    return []


def profile_has_all_facets(profile: Profile, required: list[str], user: User | None = None) -> bool:
    have = set(profile_facets(profile, user))
    return all(f in have for f in required)


def user_can_view_cpd(user: User, profile: Profile | None = None) -> bool:
    """CPD / MyCPD export for admins, clinicians, and dual clinician+researcher identities."""
    if user.role == Role.ADMIN or user.role == Role.CLINICIAN:
        return True
    facets = profile_facets(profile, user) if profile else []
    # Clinical academics often keep researcher access role but hold both facets.
    if "clinician" in facets:
        return True
    return False


def validate_primary_lens(facets: list[str], primary: str | None) -> str | None:
    if not facets:
        return None
    if primary and primary in facets:
        return primary
    return facets[0]
