"""Fetch public works from the ORCID Public API."""

from __future__ import annotations

import os
import re
import time
from typing import Any

import httpx
from dotenv import load_dotenv

load_dotenv()

ORCID_ID_RE = re.compile(r"^\d{4}-\d{4}-\d{4}-\d{3}[\dX]$", re.IGNORECASE)
REQUEST_TIMEOUT = 20.0
TOKEN_SKEW_SECONDS = 60

_token: str | None = None
_token_expires_at: float = 0.0


class OrcidConfigError(Exception):
    """Raised when ORCID client credentials are missing."""


class OrcidApiError(Exception):
    """Raised when the ORCID API returns an error response."""

    def __init__(self, message: str, status_code: int | None = None):
        super().__init__(message)
        self.status_code = status_code


def normalize_orcid_id(value: str | None) -> str | None:
    """Return a canonical ORCID iD or None if empty/invalid."""
    if value is None:
        return None
    raw = value.strip()
    if not raw:
        return None
    # Accept full URLs like https://orcid.org/0000-0002-1825-0097
    if "orcid.org/" in raw.lower():
        raw = raw.rstrip("/").split("/")[-1]
    raw = raw.upper()
    if not ORCID_ID_RE.match(raw):
        raise ValueError(
            "ORCID iD must look like 0000-0001-2345-6789 (last character may be X)"
        )
    return raw


def _client_credentials() -> tuple[str, str]:
    client_id = (os.getenv("ORCID_CLIENT_ID") or "").strip()
    client_secret = (os.getenv("ORCID_CLIENT_SECRET") or "").strip()
    if not client_id or not client_secret:
        raise OrcidConfigError(
            "ORCID_CLIENT_ID and ORCID_CLIENT_SECRET must be set in .env "
            "(register a free Public API app at https://orcid.org/developer-tools)"
        )
    return client_id, client_secret


def _api_base() -> str:
    return (os.getenv("ORCID_API_BASE") or "https://pub.orcid.org/v3.0").rstrip("/")


def _token_url() -> str:
    return (os.getenv("ORCID_TOKEN_URL") or "https://orcid.org/oauth/token").strip()


def _get_access_token(force: bool = False) -> str:
    global _token, _token_expires_at
    now = time.time()
    if not force and _token and now < _token_expires_at - TOKEN_SKEW_SECONDS:
        return _token

    client_id, client_secret = _client_credentials()
    with httpx.Client(timeout=REQUEST_TIMEOUT) as client:
        response = client.post(
            _token_url(),
            data={
                "client_id": client_id,
                "client_secret": client_secret,
                "grant_type": "client_credentials",
                "scope": "/read-public",
            },
            headers={"Accept": "application/json"},
        )
    if response.status_code >= 400:
        raise OrcidApiError(
            f"ORCID token request failed ({response.status_code})",
            status_code=response.status_code,
        )
    data = response.json()
    access = data.get("access_token")
    if not access:
        raise OrcidApiError("ORCID token response missing access_token")
    expires_in = int(data.get("expires_in") or 3600)
    _token = access
    _token_expires_at = now + expires_in
    return access


def _auth_headers(token: str) -> dict[str, str]:
    return {
        "Authorization": f"Bearer {token}",
        "Accept": "application/vnd.orcid+json",
    }


def _year_from_summary(summary: dict[str, Any]) -> int | None:
    pub_date = summary.get("publication-date") or {}
    year_val = (pub_date.get("year") or {}).get("value")
    if year_val and str(year_val).isdigit():
        return int(year_val)
    return None


def _title_from_summary(summary: dict[str, Any]) -> str:
    title_block = summary.get("title") or {}
    title = title_block.get("title") or {}
    return (title.get("value") or "").strip() or "Untitled work"


def _journal_from_summary(summary: dict[str, Any]) -> str:
    journal = summary.get("journal-title") or {}
    value = journal.get("value") if isinstance(journal, dict) else None
    if value:
        return str(value).strip()
    work_type = summary.get("type") or ""
    return str(work_type).replace("-", " ").strip()


def _external_ids(summary: dict[str, Any]) -> list[dict[str, Any]]:
    block = summary.get("external-ids") or {}
    return block.get("external-id") or []


def _doi_from_summary(summary: dict[str, Any]) -> str | None:
    for item in _external_ids(summary):
        if (item.get("external-id-type") or "").lower() == "doi":
            value = item.get("external-id-value")
            if value:
                return str(value).strip()
    return None


def _pmid_from_summary(summary: dict[str, Any]) -> str | None:
    for item in _external_ids(summary):
        if (item.get("external-id-type") or "").lower() in ("pmid", "pmc"):
            value = item.get("external-id-value")
            if value:
                return str(value).strip()
    return None


def _url_from_summary(summary: dict[str, Any], doi: str | None) -> str | None:
    url_block = summary.get("url") or {}
    if isinstance(url_block, dict) and url_block.get("value"):
        return str(url_block["value"]).strip()
    for item in _external_ids(summary):
        url_val = (item.get("external-id-url") or {}).get("value")
        if url_val:
            return str(url_val).strip()
    if doi:
        return f"https://doi.org/{doi}"
    return None


def _authors_from_contributors(summary: dict[str, Any]) -> list[str]:
    contributors = (summary.get("contributors") or {}).get("contributor") or []
    names: list[str] = []
    for contrib in contributors:
        credit = (contrib.get("credit-name") or {}).get("value")
        if credit:
            names.append(str(credit).strip())
    return names


def _work_from_summary(summary: dict[str, Any]) -> dict[str, Any]:
    put_code = summary.get("put-code")
    doi = _doi_from_summary(summary)
    pmid = _pmid_from_summary(summary)
    return {
        "id": f"orcid-{put_code}" if put_code is not None else f"orcid-{_title_from_summary(summary)[:40]}",
        "pmid": pmid,
        "title": _title_from_summary(summary),
        "journal": _journal_from_summary(summary),
        "year": _year_from_summary(summary),
        "authors": _authors_from_contributors(summary),
        "doi": doi,
        "url": _url_from_summary(summary, doi),
    }


def _escape_solr(value: str) -> str:
    """Escape Lucene/Solr special characters in a search term."""
    specials = r'+-&|!(){}[]^"~*?:\/'
    out = []
    for ch in value:
        if ch in specials:
            out.append("\\" + ch)
        else:
            out.append(ch)
    return "".join(out)


_HONORIFIC_RE = re.compile(
    r"^(Prof\.?|A/?Prof\.?|Associate Professor|Assistant Professor|"
    r"Dr\.?|Mr\.?|Ms\.?|Mrs\.?|Miss)\s+",
    re.IGNORECASE,
)


def split_person_name(full_name: str | None) -> tuple[str | None, str | None]:
    """Return (given_names, family_name) from a display name, or (None, None)."""
    if not full_name or not str(full_name).strip():
        return None, None
    name = _HONORIFIC_RE.sub("", str(full_name).strip())
    # Drop leading "Scientia" etc.
    name = re.sub(r"^(Scientia)\s+", "", name, flags=re.IGNORECASE)
    parts = [p for p in name.replace("-", " ").split() if p]
    if len(parts) < 2:
        return None, None
    return " ".join(parts[:-1]), parts[-1]


def _affiliation_terms(institution: str | None) -> list[str]:
    """Build ORCID affiliation-org-name search terms from a local institution label."""
    if not institution or not institution.strip():
        return []
    raw = institution.strip()
    terms: list[str] = [raw]
    lower = raw.lower()

    # Precinct partners often list UNSW on ORCID even when our seed uses the institute name
    if any(k in lower for k in ("unsw", "black dog", "george institute", "neura", "seslhd", "prince of wales")):
        terms.extend(["UNSW", "University of New South Wales"])
    if "black dog" in lower:
        terms.append("Black Dog Institute")
    if "george institute" in lower:
        terms.append("George Institute")
    if "children" in lower and "cancer" in lower:
        terms.extend(["Children's Cancer Institute", "UNSW"])
    if "schn" in lower or "sydney children" in lower:
        terms.extend(["Sydney Children's Hospital", "UNSW"])

    # De-dupe preserving order
    seen: set[str] = set()
    out: list[str] = []
    for t in terms:
        key = t.lower()
        if key not in seen:
            seen.add(key)
            out.append(t)
    return out


def _search_orcid_ids(query: str, rows: int = 5) -> list[str]:
    """Run an ORCID registry search; return ORCID iDs only."""
    token = _get_access_token()
    url = f"{_api_base()}/search/"
    params = {"q": query, "rows": str(rows)}

    with httpx.Client(timeout=REQUEST_TIMEOUT) as client:
        response = client.get(url, params=params, headers=_auth_headers(token))
        if response.status_code == 401:
            token = _get_access_token(force=True)
            response = client.get(url, params=params, headers=_auth_headers(token))

    if response.status_code >= 400:
        raise OrcidApiError(
            f"ORCID search failed ({response.status_code})",
            status_code=response.status_code,
        )

    data = response.json()
    ids: list[str] = []
    for result in data.get("result") or []:
        path = (result.get("orcid-identifier") or {}).get("path")
        if not path:
            continue
        try:
            normalised = normalize_orcid_id(path)
        except ValueError:
            continue
        if normalised:
            ids.append(normalised)
    return ids


def resolve_orcid_id(
    email: str | None = None,
    name: str | None = None,
    institution: str | None = None,
) -> str | None:
    """Find an existing ORCID iD for a person.

    Only returns an iD when there is a unique match:
    1. Public email search (exact)
    2. given-names + family-name + affiliation (institution variants)
    3. given-names + family-name alone (exactly one hit)

    Returns None when the person is not uniquely found in ORCID.
    """
    email_clean = (email or "").strip().lower()
    if email_clean and "@" in email_clean:
        hits = _search_orcid_ids(f"email:{_escape_solr(email_clean)}", rows=3)
        if len(hits) == 1:
            return hits[0]
        if len(hits) > 1:
            return None

    given, family = split_person_name(name)
    if not given or not family:
        return None

    name_q = (
        f"given-names:{_escape_solr(given)} AND "
        f"family-name:{_escape_solr(family)}"
    )

    for aff in _affiliation_terms(institution):
        # Prefer quoted multi-word affiliations
        aff_term = f'"{aff}"' if " " in aff else aff
        hits = _search_orcid_ids(
            f"{name_q} AND affiliation-org-name:{aff_term}",
            rows=5,
        )
        if len(hits) == 1:
            return hits[0]

    hits = _search_orcid_ids(name_q, rows=5)
    if len(hits) == 1:
        return hits[0]

    return None


def fetch_works(orcid_id: str) -> list[dict[str, Any]]:
    """Return normalised publication records for a public ORCID iD."""
    orcid = normalize_orcid_id(orcid_id)
    if not orcid:
        raise ValueError("ORCID iD is required")

    token = _get_access_token()
    url = f"{_api_base()}/{orcid}/works"

    with httpx.Client(timeout=REQUEST_TIMEOUT) as client:
        response = client.get(url, headers=_auth_headers(token))
        if response.status_code == 401:
            token = _get_access_token(force=True)
            response = client.get(url, headers=_auth_headers(token))

    if response.status_code == 404:
        raise OrcidApiError("ORCID record not found", status_code=404)
    if response.status_code >= 400:
        raise OrcidApiError(
            f"ORCID works request failed ({response.status_code})",
            status_code=response.status_code,
        )

    data = response.json()
    works: list[dict[str, Any]] = []
    seen_titles: set[str] = set()
    for group in data.get("group") or []:
        summaries = group.get("work-summary") or []
        if not summaries:
            continue
        # Prefer the first summary in each group (preferred/primary version)
        work = _work_from_summary(summaries[0])
        key = (work["title"] or "").lower()
        if key in seen_titles:
            continue
        seen_titles.add(key)
        works.append(work)

    works.sort(key=lambda w: (w.get("year") is None, -(w.get("year") or 0), w.get("title") or ""))
    return works
