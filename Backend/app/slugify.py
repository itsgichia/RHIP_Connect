import re
import unicodedata


def slugify(text: str) -> str:
    text = unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode("ascii")
    text = text.lower().strip()
    text = re.sub(r"[^a-z0-9]+", "-", text)
    return text.strip("-") or "item"


def unique_slug(base: str, existing: set[str]) -> str:
    slug = slugify(base)
    if slug not in existing:
        return slug
    n = 2
    while f"{slug}-{n}" in existing:
        n += 1
    return f"{slug}-{n}"
