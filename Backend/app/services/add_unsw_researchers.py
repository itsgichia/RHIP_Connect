"""
One-off helper: pull REAL UNSW researchers from ORCID and append them to
mock_profiles.json (skips anyone already there). Then re-seed to load them.

Run from the Backend/ folder:
    python -m app.services.add_unsw_researchers
    python -m app.seed
"""

import json
import os
import time

from app.services.orcid_service import get_access_token, search_unsw, get_person

DATA_PATH = os.path.join(
    os.path.dirname(__file__), "..", "..", "..", "data", "mock_profiles.json"
)

HOW_MANY = 40  # how many new real researchers to add this run


def main():
    with open(DATA_PATH) as f:
        profiles = json.load(f)

    existing_orcids = {p.get("orcid_id") for p in profiles if p.get("orcid_id")}
    existing_emails = {p.get("email") for p in profiles}

    token = get_access_token()
    candidate_ids = search_unsw(token, rows=60)

    added = 0
    for oid in candidate_ids:
        if added >= HOW_MANY:
            break
        if oid in existing_orcids:
            continue
        try:
            person = get_person(token, oid)
        except Exception:
            continue
        # Only keep people with a name who are CURRENTLY at UNSW
        if not person["name"] or not person["currently_unsw"]:
            continue

        slug = (
            person["name"].lower().replace(" ", ".").replace("'", "").replace("/", "")
        )
        email = f"{slug}@unsw.example"
        if email in existing_emails:
            email = f"{oid}@unsw.example"

        profiles.append({
            "name": person["name"],
            "email": email,
            "title": "Researcher",
            "specialty_area": "Health Systems",  # adjust later if you like
            "orcid_id": oid,
            "expertise_tags": person["keywords"][:5] or ["Research"],
            "bio": f"UNSW researcher. Current affiliation: {person['current_affiliation']}.",
            "publications": 0,
            "active_projects": 1,
            "institution": "UNSW Sydney",
            "role": "researcher",
        })
        existing_orcids.add(oid)
        existing_emails.add(email)
        added += 1
        print(f"  + {person['name']} ({oid})")
        time.sleep(0.3)  # be gentle with the ORCID API

    with open(DATA_PATH, "w") as f:
        json.dump(profiles, f, indent=2, ensure_ascii=False)

    print(f"\nAdded {added} real UNSW researchers to mock_profiles.json.")
    print("Now run:  python -m app.seed")


if __name__ == "__main__":
    main()