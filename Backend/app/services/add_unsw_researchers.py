"""
One-off helper: pull REAL, HEALTH-related UNSW researchers from ORCID + OpenAlex
and (re)build the auto-added set in mock_profiles.json.

- Uses OpenAlex to keep only researchers whose field is health-related
  (RHIP = Randwick Health & Innovation Precinct).
- Uses OpenAlex research topics to set a real specialty + expertise tags
  (so no more "Health Systems" everywhere / thin tags).
- Re-running is safe: it first removes the previous auto-added batch
  (profiles with an @unsw.example email) and rebuilds a fresh one.

Run from the Backend/ folder:
    python -m app.services.add_unsw_researchers
    python -m app.seed
"""

import json
import os
import time

from app.services.orcid_service import get_access_token, search_unsw
from app.services.openalex_service import get_author_info

DATA_PATH = os.path.join(
    os.path.dirname(__file__), "..", "..", "..", "data", "mock_profiles.json"
)

HOW_MANY = 40   # how many health researchers to add
SEARCH_ROWS = 250  # candidates to pull from ORCID (many get filtered out)

# Map OpenAlex field -> one of RHIP's four specialty areas
FIELD_TO_SPECIALTY = {
    "Neuroscience": "Mental Health & Neuroscience",
    "Psychology": "Mental Health & Neuroscience",
    "Immunology and Microbiology": "Personalised Medicine",
    "Biochemistry, Genetics and Molecular Biology": "Personalised Medicine",
    "Pharmacology, Toxicology and Pharmaceutics": "Personalised Medicine",
}


def main():
    with open(DATA_PATH) as f:
        profiles = json.load(f)

    # Remove the previous auto-added batch (marked by @unsw.example email),
    # so re-running gives a clean, health-filtered set.
    before = len(profiles)
    profiles = [p for p in profiles if not str(p.get("email", "")).endswith("@unsw.example")]
    removed = before - len(profiles)
    if removed:
        print(f"  (removed {removed} previously auto-added profiles)")

    existing_orcids = {p.get("orcid_id") for p in profiles if p.get("orcid_id")}
    existing_emails = {p.get("email") for p in profiles}

    token = get_access_token()
    candidate_ids = search_unsw(token, rows=SEARCH_ROWS)

    added = 0
    for oid in candidate_ids:
        if added >= HOW_MANY:
            break
        if oid in existing_orcids:
            continue
        try:
            info = get_author_info(oid)
        except Exception:
            continue
        # Keep only: found in OpenAlex, has a name, currently at UNSW, health field
        if not info or not info["name"]:
            continue
        if not info["currently_unsw"]:
            continue
        if not info["is_health"]:
            continue

        specialty = FIELD_TO_SPECIALTY.get(info["top_field"], "Health Systems")
        tags = info["topics"][:5] or ["Research"]

        slug = info["name"].lower().replace(" ", ".").replace("'", "").replace("/", "")
        email = f"{slug}@unsw.example"
        if email in existing_emails:
            email = f"{oid}@unsw.example"

        profiles.append({
            "name": info["name"],
            "email": email,
            "title": "Researcher",
            "specialty_area": specialty,
            "orcid_id": oid,
            "expertise_tags": tags,
            "bio": f"UNSW researcher in {info['top_field'] or 'health research'}.",
            "publications": 0,
            "active_projects": 1,
            "institution": "UNSW Sydney",
            "role": "researcher",
        })
        existing_orcids.add(oid)
        existing_emails.add(email)
        added += 1
        print(f"  + {info['name']} — {info['top_field']} ({oid})")
        time.sleep(0.3)  # be gentle with the APIs

    with open(DATA_PATH, "w") as f:
        json.dump(profiles, f, indent=2, ensure_ascii=False)

    print(f"\nAdded {added} health-related UNSW researchers to mock_profiles.json.")
    print("Now run:  python -m app.seed")


if __name__ == "__main__":
    main()