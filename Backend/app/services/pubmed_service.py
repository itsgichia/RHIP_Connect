"""Fetch publication metadata from NCBI PubMed E-utilities."""

import json
import os
import time
from typing import Any

import httpx

EUTILS_BASE = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils"
DEFAULT_EMAIL = "z5580775g@gmail.com"
DEFAULT_TOOL = "rhip_connect"
RATE_LIMIT_SECONDS = 0.34 
REQUEST_TIMEOUT = 15.0


def _base_params() -> dict[str, str]:
    params = {
        "tool": DEFAULT_TOOL,
        "email": os.getenv("PUBMED_EMAIL", DEFAULT_EMAIL),
    }
    api_key = os.getenv("PUBMED_API_KEY")
    if api_key:
        params["api_key"] = api_key
    return params


def _throttle() -> None:
    time.sleep(RATE_LIMIT_SECONDS)


def search_pmids(query: str, max_results: int = 10) -> list[str]:
    """Return PubMed IDs matching an Entrez query."""
    params = {
        **_base_params(),
        "db": "pubmed",
        "term": query,
        "retmax": str(max_results),
        "retmode": "json",
        "sort": "relevance",
    }
    _throttle()
    with httpx.Client(timeout=REQUEST_TIMEOUT) as client:
        response = client.get(f"{EUTILS_BASE}/esearch.fcgi", params=params)
        response.raise_for_status()
        data = response.json()
    return data.get("esearchresult", {}).get("idlist", [])


def fetch_publication_summaries(pmids: list[str]) -> list[dict[str, Any]]:
    """Return normalised publication records for the given PMIDs."""
    if not pmids:
        return []

    params = {
        **_base_params(),
        "db": "pubmed",
        "id": ",".join(pmids),
        "retmode": "json",
    }
    _throttle()
    with httpx.Client(timeout=REQUEST_TIMEOUT) as client:
        response = client.get(f"{EUTILS_BASE}/esummary.fcgi", params=params)
        response.raise_for_status()
        data = response.json()

    results: list[dict[str, Any]] = []
    for pmid in pmids:
        record = data.get("result", {}).get(pmid, {})
        if not record or record.get("error"):
            continue
        authors = [
            author.get("name", "")
            for author in record.get("authors", [])
            if author.get("name")
        ]
        pubdate = record.get("pubdate", "")
        year = None
        if pubdate:
            year_token = pubdate.split()[0]
            if year_token.isdigit():
                year = int(year_token)

        results.append(
            {
                "pmid": pmid,
                "title": record.get("title", "").rstrip("."),
                "journal": record.get("source", record.get("fulljournalname", "")),
                "year": year,
                "authors": authors,
                "doi": _extract_doi(record),
                "url": f"https://pubmed.ncbi.nlm.nih.gov/{pmid}/",
            }
        )
    return results


def _extract_doi(record: dict[str, Any]) -> str | None:
    for item in record.get("articleids", []):
        if item.get("idtype") == "doi":
            return item.get("value")
    elocation = record.get("elocationid", "")
    if elocation.lower().startswith("doi:"):
        return elocation.split(":", 1)[1].strip()
    return None


def fetch_publications(query: str, max_results: int = 10) -> list[dict[str, Any]]:
    """Search PubMed and return publication metadata."""
    pmids = search_pmids(query, max_results=max_results)
    return fetch_publication_summaries(pmids)


def load_cache(cache_path: str) -> dict[str, list[dict[str, Any]]]:
    if not os.path.isfile(cache_path):
        return {}
    with open(cache_path) as handle:
        return json.load(handle)


def save_cache(cache_path: str, cache: dict[str, list[dict[str, Any]]]) -> None:
    os.makedirs(os.path.dirname(cache_path), exist_ok=True)
    with open(cache_path, "w") as handle:
        json.dump(cache, handle, indent=2)


def _resolve_pubmed_mode() -> str:
    """How seed loads publications: auto (default), cache, or live."""
    explicit = os.getenv("PUBMED_MODE", "").lower().strip()
    if explicit in ("auto", "cache", "live"):
        return explicit

    # Backwards compatibility with USE_LIVE_PUBMED
    legacy = os.getenv("USE_LIVE_PUBMED", "").lower()
    if legacy == "true":
        return "live"
    if legacy == "false":
        return "cache"
    return "auto"


def fetch_or_load_publications(
    email: str,
    query: str,
    cache: dict[str, list[dict[str, Any]]],
    max_results: int = 10,
    mode: str = "auto",
) -> tuple[list[dict[str, Any]], str]:
    """Return publications and source label: cache, live, or none.

    Modes:
    - auto: use cache when present, fetch from PubMed for missing researchers
    - cache: never call PubMed
    - live: always fetch from PubMed and refresh cache
    """
    if mode == "cache":
        return cache.get(email, []), "cache" if cache.get(email) else "none"

    if mode == "auto" and cache.get(email):
        return cache[email], "cache"

    try:
        publications = fetch_publications(query, max_results=max_results)
        if publications:
            cache[email] = publications
            return publications, "live"
    except (httpx.HTTPError, json.JSONDecodeError, KeyError, TimeoutError):
        pass

    if mode == "auto" and cache.get(email):
        return cache[email], "cache"
    return [], "none"
