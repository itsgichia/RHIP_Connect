"""
OpenAlex provider for RHIP Connect.

Given a researcher's ORCID iD, this talks to OpenAlex (free, open, CC0 — no API
key) for two things:
  - get_collaborations() -> where their co-authors are (for the map)
  - get_author_info()    -> their research topics + field (for keywords + a
                            "is this a health researcher?" filter)

Everything lives behind these functions, so if we ever swap OpenAlex for
Scopus / ROS, we only rewrite this file. (Adapter pattern.)

Docs: https://docs.openalex.org
"""

import os
from collections import Counter

import httpx

OPENALEX_API = "https://api.openalex.org"

# OpenAlex "polite pool": including an email gets faster, more reliable service.
POLITE_EMAIL = os.getenv("OPENALEX_EMAIL", "rhip-connect@unsw.edu.au")

# OpenAlex research FIELDS we count as health-related for RHIP
# (Randwick Health & Innovation Precinct — broad, includes biomedical).
HEALTH_FIELDS = {
    "Medicine",
    "Nursing",
    "Health Professions",
    "Neuroscience",
    "Psychology",
    "Immunology and Microbiology",
    "Pharmacology, Toxicology and Pharmaceutics",
    "Biochemistry, Genetics and Molecular Biology",
    "Dentistry",
    "Veterinary",
}


# ---------------------------------------------------------------------------
# Collaboration data (for the map)
# ---------------------------------------------------------------------------

def get_collaborations(orcid_id: str, max_works: int = 200) -> dict:
    """Where this researcher's co-authors are, aggregated by country + institution."""
    orcid_url = f"https://orcid.org/{orcid_id}"
    resp = httpx.get(
        f"{OPENALEX_API}/works",
        params={
            "filter": f"authorships.author.orcid:{orcid_url}",
            "per-page": min(max_works, 200),
            "select": "id,authorships",
            "mailto": POLITE_EMAIL,
        },
        timeout=30,
    )
    resp.raise_for_status()
    works = resp.json().get("results", [])

    country_counts: Counter = Counter()
    institution_counts: Counter = Counter()
    institution_country: dict = {}

    for work in works:
        seen_countries = set()
        seen_institutions = set()
        for authorship in work.get("authorships", []):
            for inst in authorship.get("institutions", []):
                name = inst.get("display_name")
                cc = inst.get("country_code")
                if name and name not in seen_institutions:
                    institution_counts[name] += 1
                    if cc:
                        institution_country[name] = cc
                    seen_institutions.add(name)
                if cc and cc not in seen_countries:
                    country_counts[cc] += 1
                    seen_countries.add(cc)

    return {
        "orcid_id": orcid_id,
        "work_count": len(works),
        "countries": [
            {"country_code": cc, "count": n} for cc, n in country_counts.most_common()
        ],
        "institutions": [
            {"name": name, "country_code": institution_country.get(name), "count": n}
            for name, n in institution_counts.most_common(30)
        ],
    }


# ---------------------------------------------------------------------------
# Author info: topics + field + "is health?" (for keywords + filtering)
# ---------------------------------------------------------------------------

def get_author_info(orcid_id: str) -> dict | None:
    """Fetch a researcher's OpenAlex profile.

    is_health is based on their PRIMARY research field only (topics[0].field).
    Using just the top field avoids false positives — e.g. a food scientist
    whose secondary field happens to be biochemistry no longer slips through.
    """
    resp = httpx.get(
        f"{OPENALEX_API}/authors",
        params={"filter": f"orcid:https://orcid.org/{orcid_id}", "mailto": POLITE_EMAIL},
        timeout=30,
    )
    resp.raise_for_status()
    results = resp.json().get("results", [])
    if not results:
        return None
    author = results[0]

    topics = author.get("topics") or []
    topic_names = [t["display_name"] for t in topics[:6] if t.get("display_name")]
    fields = [
        t["field"]["display_name"]
        for t in topics
        if t.get("field") and t["field"].get("display_name")
    ]
    top_field = fields[0] if fields else None

    # Health check = PRIMARY field only (not top-3). Tighter, fewer false positives.
    is_health = bool(fields) and fields[0] in HEALTH_FIELDS

    insts = author.get("last_known_institutions") or []
    inst_names = [i.get("display_name", "") for i in insts if i.get("display_name")]
    currently_unsw = any(
        ("new south wales" in n.lower()) or ("unsw" in n.lower()) for n in inst_names
    )

    return {
        "name": author.get("display_name"),
        "topics": topic_names,
        "top_field": top_field,
        "is_health": is_health,
        "currently_unsw": currently_unsw,
        "current_affiliation": inst_names[0] if inst_names else None,
    }


# Quick test:  python -m app.services.openalex_service
if __name__ == "__main__":
    for oid, who in [
        ("0000-0003-0390-661X", "Louisa Jorm (should be health)"),
        ("0000-0002-7306-8001", "Rishi Ravindra Naik (food scientist — should NOT be health)"),
    ]:
        info = get_author_info(oid)
        if info:
            print(f"{who}: field={info['top_field']} | is_health={info['is_health']}")