"""
ORCID Public API service for RHIP Connect.

Why the API instead of scraping?
- ORCID has an official public REST API -> returns clean JSON (no HTML parsing)
- Free, legal, stable
- Lets us filter by CURRENT affiliation -> fixes the "scraper picks up people who
  left UNSW / non-UNSW collaborators" problem raised in the CBDRH feedback

Setup (one-time, free):
1. Register a Public API client at https://orcid.org/developer-tools
2. Add the credentials to Backend/.env:
       ORCID_CLIENT_ID=APP-XXXXXXXXXXXX
       ORCID_CLIENT_SECRET=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx

Test it (from the Backend/ folder, with the base env active):
       python -m app.services.orcid_service

Docs: https://info.orcid.org/documentation/api-tutorials/
"""

import os
import time
from datetime import datetime

import httpx
from dotenv import load_dotenv

load_dotenv()

# --- Endpoints ---
TOKEN_URL = "https://orcid.org/oauth/token"   # where we exchange creds for a token
PUB_API = "https://pub.orcid.org/v3.0"        # all public data lives under here

# Ask ORCID for JSON (the default response is XML)
JSON_HEADERS = {"Accept": "application/json"}

# ORCID records write UNSW's name lots of different ways, so we match on any of
# these lowercase fragments. Add more here if you spot other variants.
UNSW_NAME_FRAGMENTS = (
    "new south wales",  # "University of New South Wales"
    "unsw",             # "UNSW Sydney", "UNSW Australia", "UNSW", ...
)

# Cache the token in memory so we don't request a new one on every call.
# (ORCID public tokens are valid for ~20 years.)
_cached_token: str | None = None


def _is_unsw(org_name: str | None) -> bool:
    """True if this organisation name looks like UNSW (any known spelling)."""
    if not org_name:
        return False
    name = org_name.lower()
    return any(fragment in name for fragment in UNSW_NAME_FRAGMENTS)


def get_access_token() -> str:
    """Get a /read-public token via client_credentials (2-legged OAuth)."""
    global _cached_token
    if _cached_token:
        return _cached_token

    client_id = os.getenv("ORCID_CLIENT_ID")
    client_secret = os.getenv("ORCID_CLIENT_SECRET")
    if not client_id or not client_secret:
        raise RuntimeError(
            "Set ORCID_CLIENT_ID and ORCID_CLIENT_SECRET in Backend/.env first"
        )

    resp = httpx.post(
        TOKEN_URL,
        data={
            "client_id": client_id,
            "client_secret": client_secret,
            "grant_type": "client_credentials",
            "scope": "/read-public",
        },
        headers={"Accept": "application/json"},
        timeout=20,
    )
    resp.raise_for_status()
    _cached_token = resp.json()["access_token"]
    return _cached_token


def _auth_headers(token: str) -> dict:
    return {**JSON_HEADERS, "Authorization": f"Bearer {token}"}


# ---------------------------------------------------------------------------
# 1) Find ORCID iDs for UNSW people (by affiliation, optionally narrowed by name)
# ---------------------------------------------------------------------------

def search_unsw(
    token: str,
    given: str | None = None,
    family: str | None = None,
    rows: int = 50,
) -> list[str]:
    """Return a list of ORCID iDs whose affiliation is UNSW.

    UNSW appears under a few name variations, so we OR them together.
    """
    org = (
        'affiliation-org-name:("University of New South Wales" '
        'OR "UNSW Sydney" OR "UNSW Australia" OR "UNSW")'
    )
    parts = [org]
    if given:
        parts.append(f'given-names:"{given}"')
    if family:
        parts.append(f'family-name:"{family}"')
    query = " AND ".join(parts)

    resp = httpx.get(
        f"{PUB_API}/search/",
        headers=_auth_headers(token),
        params={"q": query, "rows": rows},
        timeout=30,
    )
    resp.raise_for_status()
    results = resp.json().get("result") or []
    return [r["orcid-identifier"]["path"] for r in results]


# ---------------------------------------------------------------------------
# 2) Pull one person's profile from a single ORCID iD
# ---------------------------------------------------------------------------

def get_person(token: str, orcid_id: str) -> dict:
    """Fetch name, keywords, and employment history for one ORCID iD.

    This is the raw material for auto-filling a profile (no manual entry)
    and for the connection recommendation layer.
    """
    r = httpx.get(f"{PUB_API}/{orcid_id}/record", headers=_auth_headers(token), timeout=30)
    r.raise_for_status()
    rec = r.json()

    person = rec.get("person", {})
    name = person.get("name") or {}
    given = (name.get("given-names") or {}).get("value", "")
    family = (name.get("family-name") or {}).get("value", "")

    # Keywords -> used for matching / recommendations (often empty; opt-in field)
    keywords = [
        k["content"]
        for k in (person.get("keywords") or {}).get("keyword", [])
        if k.get("content")
    ]

    # Employment -> used to FILTER "are they still at UNSW?"
    employments = []
    groups = (
        ((rec.get("activities-summary") or {}).get("employments") or {}).get(
            "affiliation-group", []
        )
    )
    for g in groups:
        for s in g.get("summaries", []):
            emp = s.get("employment-summary", {})
            org = (emp.get("organization") or {}).get("name")
            end = emp.get("end-date")  # None means still active there
            employments.append({"org": org, "current": end is None})

    # Still at UNSW = has a CURRENT (no end-date) employment whose org looks like UNSW
    currently_unsw = any(
        e["current"] and _is_unsw(e["org"]) for e in employments
    )

    return {
        "orcid_id": orcid_id,
        "name": f"{given} {family}".strip(),
        "keywords": keywords,
        "employments": employments,
        "current_affiliation": next(
            (e["org"] for e in employments if e["current"]), None
        ),
        "currently_unsw": currently_unsw,
    }


def get_works(token: str, orcid_id: str, limit: int = 20) -> list[str]:
    """Return publication titles -> feed these to an LLM to auto-extract keywords."""
    r = httpx.get(f"{PUB_API}/{orcid_id}/works", headers=_auth_headers(token), timeout=30)
    r.raise_for_status()
    titles = []
    for group in (r.json().get("group") or [])[:limit]:
        for ws in group.get("work-summary", []):
            title = ((ws.get("title") or {}).get("title") or {}).get("value")
            if title:
                titles.append(title)
                break
    return titles


# ---------------------------------------------------------------------------
# 3) Copy ORCID data onto an existing Profile row (DB integration)
# ---------------------------------------------------------------------------

def sync_profile_from_orcid(profile, orcid_id: str, token: str | None = None):
    """Fetch a person's ORCID data and copy it onto a Profile ORM object.

    `profile` is a models.Profile instance. This function only SETS attributes
    on it — the caller is responsible for db.commit(). We keep it that way so
    this module never has to import the DB layer (no circular imports).

    ORCID keywords flow into the existing `expertise_tags` field, and the work
    count into `publications`, so the data shows up in your directory right away.
    """
    token = token or get_access_token()
    data = get_person(token, orcid_id)
    works = get_works(token, orcid_id, limit=50)

    profile.orcid_id = orcid_id
    profile.current_affiliation = data["current_affiliation"]
    profile.is_current_unsw = data["currently_unsw"]

    # Only overwrite expertise_tags if ORCID actually gave us keywords
    if data["keywords"]:
        profile.expertise_tags = data["keywords"]

    # Publication count straight from ORCID's works list
    if works:
        profile.publications = len(works)

    profile.orcid_synced_at = datetime.utcnow()
    return profile


# ---------------------------------------------------------------------------
# Demo — run this file directly to test everything works
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    token = get_access_token()
    print("Token OK\n")

    # Try a real name, e.g. a UNSW researcher. Change these as you like.
    ids = search_unsw(token, family="Jorm", rows=5)
    print("Candidate ORCID iDs:", ids, "\n")

    for oid in ids:
        p = get_person(token, oid)
        print(f"{p['name']}  ({oid})")
        print("  Still at UNSW?:", p["currently_unsw"])
        print("  Affiliation   :", p["current_affiliation"])
        print("  Keywords      :", p["keywords"][:8])
        print("  Sample works  :", get_works(token, oid, limit=3))
        print()