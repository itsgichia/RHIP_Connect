"""
OpenAlex collaboration provider for RHIP Connect.

Given a researcher's ORCID iD, this fetches their works from OpenAlex (free,
open, CC0 — no API key needed) and aggregates WHERE their co-authors are, so
the frontend can draw a collaboration map.

Why this lives behind get_collaborations():
    The rest of the app only calls get_collaborations(orcid_id). If we ever
    swap OpenAlex for Scopus / ROS / etc., we only rewrite THIS file — the
    endpoint and frontend stay the same. (Adapter pattern.)

Docs: https://docs.openalex.org
"""

import os
from collections import Counter

import httpx

OPENALEX_API = "https://api.openalex.org"

# OpenAlex "polite pool": including an email gets faster, more reliable service.
# Not required, not a paid thing — just good manners. Override in Backend/.env.
POLITE_EMAIL = os.getenv("OPENALEX_EMAIL", "rhip-connect@unsw.edu.au")


def get_collaborations(orcid_id: str, max_works: int = 200) -> dict:
    """Return where this researcher's co-authors are, aggregated by country
    and by institution.

    Shape:
    {
      "orcid_id": "...",
      "work_count": 87,
      "countries":    [{"country_code": "AU", "count": 60}, ...],   # for a choropleth
      "institutions": [{"name": "UNSW Sydney", "country_code": "AU", "count": 40}, ...]
    }
    """
    orcid_url = f"https://orcid.org/{orcid_id}"
    resp = httpx.get(
        f"{OPENALEX_API}/works",
        params={
            "filter": f"authorships.author.orcid:{orcid_url}",
            "per-page": min(max_works, 200),   # OpenAlex caps per-page at 200
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
        # Count each country/institution at most once per paper
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
            {"country_code": cc, "count": n}
            for cc, n in country_counts.most_common()
        ],
        "institutions": [
            {"name": name, "country_code": institution_country.get(name), "count": n}
            for name, n in institution_counts.most_common(30)
        ],
    }


# Quick manual test:  python -m app.services.openalex_service
if __name__ == "__main__":
    import json

    data = get_collaborations("0000-0003-0390-661X")  # Louisa Jorm
    print(f"Works found: {data['work_count']}\n")
    print("Top countries:")
    for c in data["countries"][:10]:
        print(f"  {c['country_code']}: {c['count']}")
    print("\nTop institutions:")
    for i in data["institutions"][:10]:
        print(f"  {i['name']} ({i['country_code']}): {i['count']}")