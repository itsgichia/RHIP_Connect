"""Competitive grants: ARC NCGP API + curated MRFF cache.

ARC: public JSON API (no key) — https://dataportal.arc.gov.au/NCGP/API/grants
MRFF: no public grants API; curated rows from the Health grant-recipients Excel.
"""

from __future__ import annotations

import json
import os
import re
from typing import Any

import httpx

ARC_API_BASE = "https://dataportal.arc.gov.au/NCGP/API/grants"
ARC_WEB_GRANT = "https://dataportal.arc.gov.au/NCGP/Web/Grant/Grant"
REQUEST_TIMEOUT = 20.0
DATA_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "..", "data")


def _default_arc_cache_path() -> str:
    return os.path.join(DATA_DIR, "arc_grants_cache.json")


def _default_mrff_cache_path() -> str:
    return os.path.join(DATA_DIR, "mrff_grants_cache.json")


def load_cache(cache_path: str) -> dict[str, Any]:
    if not os.path.isfile(cache_path):
        return {}
    with open(cache_path) as handle:
        return json.load(handle)


def save_cache(cache_path: str, cache: dict[str, Any]) -> None:
    os.makedirs(os.path.dirname(cache_path) or ".", exist_ok=True)
    with open(cache_path, "w") as handle:
        json.dump(cache, handle, indent=2)


def resolve_grant_mode() -> str:
    """How seed loads ARC grants: auto (default), cache, or live."""
    explicit = os.getenv("GRANT_MODE", "").lower().strip()
    if explicit in ("auto", "cache", "live"):
        return explicit
    return "auto"


def _title_from_summary(summary: str) -> str:
    """ARC summaries often start with 'Title. Rest of abstract...'."""
    text = (summary or "").strip()
    if not text:
        return "Untitled grant"
    first = text.split(".", 1)[0].strip()
    if 12 <= len(first) <= 180:
        return first
    return text[:160].rstrip() + ("…" if len(text) > 160 else "")


def _normalise_arc_record(code: str, attributes: dict[str, Any], self_link: str | None = None) -> dict[str, Any]:
    summary = attributes.get("grant-summary") or attributes.get("grant_summary") or ""
    amount = attributes.get("announced-funding-amount")
    if amount is None:
        amount = attributes.get("announced_funding_amount")
    current = attributes.get("current-funding-amount")
    if current is None:
        current = attributes.get("current_funding_amount")
    return {
        "id": attributes.get("id") or code,
        "code": attributes.get("code") or code,
        "scheme_name": attributes.get("scheme-name") or attributes.get("scheme_name"),
        "funding_commencement_year": (
            attributes.get("funding-commencement-year")
            or attributes.get("funding_commencement_year")
        ),
        "scheme_information": (
            attributes.get("scheme-information") or attributes.get("scheme_information")
        ),
        "current_admin_organisation": (
            attributes.get("current-admin-organisation")
            or attributes.get("current_admin_organisation")
        ),
        "announcement_admin_organisation": (
            attributes.get("announcement-admin-organisation")
            or attributes.get("announcement_admin_organisation")
        ),
        "grant_summary": summary,
        "title": _title_from_summary(summary),
        "lead_investigator": (
            attributes.get("lead-investigator") or attributes.get("lead_investigator")
        ),
        "current_funding_amount": current,
        "announced_funding_amount": amount,
        "grant_status": attributes.get("grant-status") or attributes.get("grant_status"),
        "primary_field_of_research": (
            attributes.get("primary-field-of-research")
            or attributes.get("primary_field_of_research")
        ),
        "anticipated_end_date": (
            attributes.get("anticipated-end-date") or attributes.get("anticipated_end_date")
        ),
        "investigators": attributes.get("investigators"),
        "self_link": self_link or f"{ARC_WEB_GRANT}/{code}",
    }


def fetch_arc_grant_live(code: str) -> dict[str, Any] | None:
    """Fetch one ARC grant by code via free-text search (richest attribute set)."""
    code = (code or "").strip()
    if not code:
        return None
    params = {
        "page[number]": 1,
        "page[size]": 10,
        "filter": code,
    }
    with httpx.Client(timeout=REQUEST_TIMEOUT, follow_redirects=True) as client:
        response = client.get(
            ARC_API_BASE,
            params=params,
            headers={"User-Agent": "RHIP-Connect/1.0", "Accept": "application/vnd.api+json"},
        )
        response.raise_for_status()
        payload = response.json()

    for item in payload.get("data") or []:
        attrs = item.get("attributes") or {}
        item_code = (attrs.get("code") or "").strip()
        if item_code == code or item.get("id") == code:
            link = (item.get("links") or {}).get("self") or f"{ARC_WEB_GRANT}/{code}"
            return _normalise_arc_record(code, attrs, link)
    return None


def fetch_or_load_arc_grant(
    code: str,
    cache: dict[str, Any],
    mode: str = "auto",
) -> tuple[dict[str, Any] | None, str]:
    """Return ARC grant dict and source: cache, live, or none."""
    code = (code or "").strip()
    if mode == "cache":
        row = cache.get(code)
        return row, ("cache" if row else "none")

    if mode == "auto" and cache.get(code):
        return cache[code], "cache"

    try:
        live = fetch_arc_grant_live(code)
        if live:
            cache[code] = live
            return live, "live"
    except (httpx.HTTPError, json.JSONDecodeError, KeyError, TimeoutError, OSError):
        pass

    if mode == "auto" and cache.get(code):
        return cache[code], "cache"
    return None, "none"


def load_mrff_grant(grant_id: str, cache: dict[str, Any] | None = None) -> dict[str, Any] | None:
    """Lookup a curated MRFF grant (local cache only)."""
    grant_id = (grant_id or "").strip()
    if not grant_id:
        return None
    if cache is None:
        cache = load_cache(_default_mrff_cache_path())
    row = cache.get(grant_id)
    if not row:
        return None
    # Ensure title/summary aliases for seed
    out = dict(row)
    out.setdefault("title", row.get("title") or "Untitled MRFF grant")
    out.setdefault("grant_summary", row.get("summary") or row.get("grant_summary") or "")
    out.setdefault("self_link", row.get("grant_url"))
    return out


def enrich_manifest_entry(
    entry: dict[str, Any],
    *,
    arc_cache: dict[str, Any],
    mrff_cache: dict[str, Any],
    mode: str = "auto",
) -> tuple[dict[str, Any] | None, str]:
    """Merge curated overlay with ARC/MRFF metadata for seeding a Project."""
    funder = (entry.get("funder") or "").lower().strip()
    grant_id = (entry.get("grant_id") or "").strip()
    if not grant_id or funder not in ("arc", "mrff"):
        return None, "none"

    source = "none"
    remote: dict[str, Any] | None = None
    if funder == "arc":
        remote, source = fetch_or_load_arc_grant(grant_id, arc_cache, mode=mode)
    else:
        remote = load_mrff_grant(grant_id, mrff_cache)
        source = "cache" if remote else "none"

    if not remote:
        return None, source

    title = remote.get("title") or _title_from_summary(remote.get("grant_summary") or "")
    description = (remote.get("grant_summary") or remote.get("summary") or title).strip()
    amount = remote.get("announced_funding_amount") or remote.get("current_funding_amount") or 0
    try:
        amount = float(amount or 0)
    except (TypeError, ValueError):
        amount = 0.0

    year = remote.get("funding_commencement_year")
    if not year and remote.get("contract_start"):
        m = re.match(r"^(\d{4})", str(remote["contract_start"]))
        year = int(m.group(1)) if m else None

    grant_url = remote.get("self_link") or remote.get("grant_url")
    if funder == "arc":
        # Always use the public ARC grant page keyed by grant code (not API self-links).
        grant_url = f"{ARC_WEB_GRANT}/{grant_id}"
    elif funder == "mrff":
        # Require a GrantConnect award page (/Ga/Show/<uuid>), not search/news placeholders.
        if not grant_url or "/Ga/Show/" not in str(grant_url):
            return None, "none"

    merged = {
        **entry,
        "title": title,
        "description": description,
        "announced_funding_amount": amount,
        "funding_year": year,
        "grant_url": grant_url,
        "scheme_name": remote.get("scheme_name") or remote.get("mrff_initiative") or funder.upper(),
        "lead_investigator": remote.get("lead_investigator"),
        "organisation": remote.get("current_admin_organisation") or remote.get("organisation"),
    }
    return merged, source
