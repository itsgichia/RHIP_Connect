"""Resolve patents, news, and awards from explicit profile seed data only."""

from __future__ import annotations


def build_profile_extras(profile: dict) -> dict:
    """Return patents, news, and awards from seed JSON only — never invent mock entries."""
    return {
        "patents": list(profile.get("patents") or []),
        "news": list(profile.get("news") or []),
        "awards": list(profile.get("awards") or []),
    }
