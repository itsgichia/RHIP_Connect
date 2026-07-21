"""Indicative investment-readiness scoring for investor pipeline views.

This is a transparent model estimate — not a financial forecast or guaranteed ROI.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from app.models import Project, Readiness

_DATA_DIR = Path(__file__).resolve().parents[2] / "data"
_STORIES_PATH = _DATA_DIR / "mock_stories.json"
_PROJECTS_PATH = _DATA_DIR / "mock_projects.json"

_READINESS_POINTS = {
    Readiness.EARLY: 5,
    Readiness.FEASIBILITY: 10,
    Readiness.CLINICAL: 16,
    Readiness.COMMERCIAL: 20,
}

_EVIDENCE_LEVEL_BONUS = {
    "projected": 0.55,
    "pilot": 0.75,
    "clinical": 0.9,
    "validated": 1.0,
}

DISCLAIMER = (
    "Indicative score weights translation readiness (TRL), commercial readiness, "
    "capital progress, and documented impact evidence on each project. "
    "It is a model estimate for comparison — not a financial forecast, IRR, or guaranteed return."
)


def _load_json(path: Path) -> list | dict:
    if not path.exists():
        return []
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def _story_index() -> dict[str, dict]:
    stories = _load_json(_STORIES_PATH)
    if not isinstance(stories, list):
        return {}
    return {s["title"].strip().lower(): s for s in stories if s.get("title")}


def _project_impact_index() -> dict[str, dict]:
    projects = _load_json(_PROJECTS_PATH)
    if not isinstance(projects, list):
        return {}
    out: dict[str, dict] = {}
    for p in projects:
        title = (p.get("title") or "").strip().lower()
        impact = p.get("impact")
        if title and isinstance(impact, dict):
            out[title] = impact
    return out


def _trl_points(trl: int) -> float:
    clamped = max(4, min(9, trl or 4))
    return round(((clamped - 4) / 5) * 40, 1)


def _funding_points(raised: float, goal: float) -> float:
    if goal and goal > 0:
        return round(min(raised / goal, 1.0) * 25, 1)
    if raised > 0:
        return 12.0
    return 8.0


def _normalize_impact(raw: dict, source: str, story_id: str | None = None) -> dict:
    patients = int(raw.get("patients_helped") or 0)
    days = int(raw.get("time_saved_days") or 0)
    cost = float(raw.get("cost_reduced_aud") or 0)
    level = (raw.get("evidence_level") or "pilot").lower()
    note = raw.get("evidence_note") or ""
    return {
        "source": source,
        "story_id": story_id,
        "patients_helped": patients,
        "time_saved_days": days,
        "cost_reduced_aud": cost,
        "evidence_level": level,
        "evidence_note": note,
    }


def _points_from_impact(impact: dict) -> float:
    patients = float(impact.get("patients_helped") or 0)
    cost = float(impact.get("cost_reduced_aud") or 0)
    days = float(impact.get("time_saved_days") or 0)
    level = (impact.get("evidence_level") or "pilot").lower()
    level_mult = _EVIDENCE_LEVEL_BONUS.get(level, 0.75)

    patient_part = min(patients / 3000, 1.0) * 7
    cost_part = min(cost / 3_500_000, 1.0) * 5
    time_part = min(days / 60, 1.0) * 3
    return round((patient_part + cost_part + time_part) * level_mult, 1)


def _resolve_impact(project: Project) -> tuple[float, dict | None]:
    """Prefer DB metrics, then mock project impact, then success-story match."""
    title_key = (project.title or "").strip().lower()

    if isinstance(project.impact_metrics, dict) and project.impact_metrics:
        impact = _normalize_impact(project.impact_metrics, source="project")
        return _points_from_impact(impact), impact

    project_impacts = _project_impact_index()
    if title_key in project_impacts:
        impact = _normalize_impact(project_impacts[title_key], source="project")
        return _points_from_impact(impact), impact

    story = _story_index().get(title_key)
    if story:
        raw = story.get("impact") or {}
        raw = {
            **raw,
            "evidence_level": raw.get("evidence_level") or "validated",
            "evidence_note": raw.get("evidence_note")
            or "Matched to a precinct success story",
        }
        impact = _normalize_impact(raw, source="story", story_id=story.get("id"))
        return _points_from_impact(impact), impact

    return 0.0, None


def _band(score: float) -> str:
    if score >= 75:
        return "strong"
    if score >= 55:
        return "promising"
    return "developing"


def _illustrative_multiple(score: float) -> float:
    return round(1.1 + (score / 100) * 2.4, 2)


def score_project(project: Project) -> dict[str, Any]:
    trl = _trl_points(project.trl)
    readiness = float(_READINESS_POINTS.get(project.readiness, 8))
    funding = _funding_points(project.funding_raised or 0, project.funding_goal or 0)
    impact, impact_meta = _resolve_impact(project)

    total = round(min(trl + readiness + funding + impact, 100), 1)

    if impact_meta:
        level = impact_meta.get("evidence_level", "pilot")
        detail = (
            f"{impact_meta.get('evidence_note') or 'Documented impact metrics'} "
            f"({level})"
        ).strip()
    else:
        detail = "No documented impact metrics yet"

    components = [
        {
            "key": "trl",
            "label": "Translation readiness (TRL)",
            "points": trl,
            "max_points": 40,
            "detail": f"TRL {project.trl} — later stages reduce technology risk",
        },
        {
            "key": "readiness",
            "label": "Commercial readiness",
            "points": readiness,
            "max_points": 20,
            "detail": f"{project.readiness.value.replace('_', ' ').title()} stage",
        },
        {
            "key": "funding",
            "label": "Capital progress",
            "points": funding,
            "max_points": 25,
            "detail": "Funding raised toward goal (momentum signal)",
        },
        {
            "key": "impact",
            "label": "Documented impact evidence",
            "points": impact,
            "max_points": 15,
            "detail": detail,
        },
    ]

    return {
        "indicative_score": total,
        "indicative_band": _band(total),
        "illustrative_multiple": _illustrative_multiple(total),
        "roi_components": components,
        "impact_link": impact_meta,
        "roi_disclaimer": DISCLAIMER,
    }
