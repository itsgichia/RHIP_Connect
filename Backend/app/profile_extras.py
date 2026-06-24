"""Generate patents, news, and awards for profile seed data."""

from __future__ import annotations

AWARD_POOL = [
    ("NHMRC Investigator Grant", "NHMRC"),
    ("UNSW Excellence in Research Award", "UNSW Sydney"),
    ("Randwick Health Precinct Innovation Prize", "RHIP"),
    ("Australian Academy of Health and Medical Sciences Fellowship", "AAHMS"),
    ("NSW Health Research Recognition Award", "NSW Health"),
    ("Black Dog Institute Research Excellence Award", "Black Dog Institute"),
    ("George Institute Impact Award", "The George Institute"),
    ("Sydney Children's Hospitals Network Clinical Research Award", "SCHN"),
]

NEWS_TEMPLATES = [
    "{name} awarded NHMRC funding for {topic} research",
    "New {topic} trial launched at Randwick Health Precinct",
    "{name} presents findings on {topic} at international conference",
    "RHIP collaboration advances {topic} translation to clinic",
    "Precinct researchers publish breakthrough in {topic}",
]


def _stable_index(key: str, modulo: int) -> int:
    return sum(ord(c) for c in key) % modulo


def _generate_extras(profile: dict) -> dict:
    tags = profile.get("expertise_tags") or []
    specialty = profile.get("specialty_area") or "Health Systems"
    pubs = profile.get("publications") or 0
    institution = profile.get("institution") or "UNSW Sydney"
    name = profile.get("name") or "Researcher"
    last_name = name.split()[-1]
    seed = profile.get("email") or name
    idx = _stable_index(seed, 997)

    patents = []
    if pubs >= 35 and tags:
        count = min(4, max(1, pubs // 45))
        for i in range(count):
            tag = tags[i % len(tags)]
            patents.append({
                "title": f"Systems and methods for {tag.lower()} in clinical applications",
                "number": f"AU{2016 + (idx + i) % 9}{(idx * 13 + i * 7919) % 100000:05d}",
                "year": 2017 + (idx + i * 2) % 9,
            })

    news = []
    for i, template in enumerate(NEWS_TEMPLATES[:3]):
        topic = tags[i % len(tags)] if tags else specialty
        year = 2024 + (i + idx) % 2
        month = 1 + (idx + i * 3) % 12
        day = 1 + (idx + i) % 28
        news.append({
            "title": template.format(name=last_name, topic=topic.lower()),
            "date": f"{year}-{month:02d}-{day:02d}",
            "summary": (
                f"Research led by {name} highlights progress in {topic.lower()} "
                f"within {specialty.lower()} at {institution}."
            ),
        })

    awards = []
    count = 2 if pubs >= 80 else 1
    for i in range(count):
        title, org = AWARD_POOL[(idx + i * 5) % len(AWARD_POOL)]
        awards.append({
            "title": title,
            "year": 2020 + (idx + i * 2) % 6,
            "organisation": org if org != "UNSW Sydney" else institution,
        })

    return {"patents": patents, "news": news, "awards": awards}


def build_profile_extras(profile: dict) -> dict:
    """Return patents, news, and awards — explicit JSON fields override generated data."""
    generated = _generate_extras(profile)
    return {
        "patents": profile["patents"] if "patents" in profile else generated["patents"],
        "news": profile["news"] if "news" in profile else generated["news"],
        "awards": profile["awards"] if "awards" in profile else generated["awards"],
    }
