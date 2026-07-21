"""Challenge matching: knowledge topics vs capability/skills."""

from __future__ import annotations

import json
import os
import re
from typing import Any

import httpx
from dotenv import load_dotenv

from app.constants import ALL_SPECIALTIES
from app.models import Challenge, ChallengeKind, Profile

load_dotenv()

MIN_SCORE_KNOWLEDGE = 0.62
MIN_SCORE_CAPABILITY = 0.68
MIN_SCORE_EITHER = 0.65

CAPABILITY_ROLE_HINTS = (
    "biostatistician",
    "biostatistics",
    "statistician",
    "data scientist",
    "data analyst",
    "data visualisation",
    "data visualization",
    "registry manager",
    "lab tech",
    "laboratory",
    "health economist",
    "bioinformatician",
    "bioinformatics",
    "epidemiologist",
    "methodologist",
)


def _tokenize(text: str) -> set[str]:
    return {w for w in re.findall(r"[a-z0-9]+", (text or "").lower()) if len(w) > 2}


def _challenge_kind(challenge: Challenge) -> ChallengeKind:
    kind = getattr(challenge, "challenge_kind", None) or ChallengeKind.EITHER
    if isinstance(kind, str):
        try:
            kind = ChallengeKind(kind)
        except ValueError:
            kind = ChallengeKind.EITHER
    if kind != ChallengeKind.EITHER:
        return kind
    blob = f"{challenge.title} {challenge.description}".lower()
    if any(h in blob for h in CAPABILITY_ROLE_HINTS):
        return ChallengeKind.CAPABILITY
    return ChallengeKind.EITHER


def _min_score(kind: ChallengeKind) -> float:
    if kind == ChallengeKind.CAPABILITY:
        return MIN_SCORE_CAPABILITY
    if kind == ChallengeKind.KNOWLEDGE:
        return MIN_SCORE_KNOWLEDGE
    return MIN_SCORE_EITHER


def _facets(profile: Profile) -> list[str]:
    return list(profile.identity_facets or [])


def _skills(profile: Profile) -> list[str]:
    return list(profile.skills or [])


class AIOrchestrator:
    def __init__(self):
        self.url = os.getenv("QWEN_URL", "http://localhost:11434")
        self.model = os.getenv("QWEN_MODEL", "qwen2.5:3b")
        self.use_mock = os.getenv("USE_MOCK_AI", "false").lower() == "true"

    async def match_challenge(
        self,
        challenge: Challenge,
        profiles: list[Profile],
    ) -> list[dict[str, Any]]:
        if self.use_mock:
            return self._mock_match(challenge, profiles)
        return await self._call_qwen(challenge, profiles)

    def _score_profile(
        self,
        challenge: Challenge,
        profile: Profile,
        *,
        kind: ChallengeKind,
        keywords: set[str],
        challenge_text: str,
    ) -> dict[str, Any] | None:
        tags = profile.expertise_tags or []
        skills = _skills(profile)
        facets = _facets(profile)
        title_blob = " ".join(
            filter(
                None,
                [
                    profile.title or "",
                    profile.professional_title or "",
                    " ".join(skills),
                    " ".join(facets),
                ],
            )
        ).lower()
        tag_words = set()
        for tag in tags:
            tag_words.update(_tokenize(tag))
        skill_words = set()
        for skill in skills:
            skill_words.update(_tokenize(skill))
        bio_words = _tokenize(profile.bio or "")
        specialty_words = _tokenize(profile.specialty_area or "")
        title_words = _tokenize(title_blob)

        tag_overlap = len(keywords & (tag_words | bio_words | specialty_words))
        skill_overlap = len(keywords & (skill_words | title_words))
        role_hits = [h for h in CAPABILITY_ROLE_HINTS if h in challenge_text and h in title_blob]
        is_pro_tech = "professional_technical" in facets

        reasons: list[str] = []
        score = 0.0

        if kind == ChallengeKind.CAPABILITY:
            title_keyword_hit = any(w in title_blob for w in keywords if len(w) > 4)
            if skill_overlap == 0 and not role_hits and not title_keyword_hit:
                return None
            score = 0.45 + min(skill_overlap * 0.12, 0.36)
            if role_hits:
                score += 0.25
                reasons.append(f"role/title match ({role_hits[0]})")
            if skill_overlap:
                matched_skills = [s for s in skills if any(w in s.lower() for w in keywords)]
                if matched_skills:
                    reasons.append(f"skills: {', '.join(matched_skills[:3])}")
                else:
                    reasons.append("skills/title keyword overlap")
            elif title_keyword_hit:
                reasons.append("title matches the capability ask")
            if is_pro_tech:
                score += 0.08
                reasons.append("professional/technical identity")
            score += min(tag_overlap * 0.02, 0.06)

        elif kind == ChallengeKind.KNOWLEDGE:
            if tag_overlap == 0 and not any(t.lower() in challenge_text for t in tags):
                return None
            score = 0.5 + min(tag_overlap * 0.08, 0.4)
            if tags:
                matched = [t for t in tags if any(w in t.lower() for w in keywords)] or tags[:2]
                reasons.append(f"expertise: {', '.join(matched[:3])}")
            score += min(skill_overlap * 0.02, 0.06)

        else:  # EITHER
            score = 0.4 + min(tag_overlap * 0.06, 0.24) + min(skill_overlap * 0.1, 0.3)
            if role_hits:
                score += 0.2
                reasons.append(f"role/title match ({role_hits[0]})")
            if skill_overlap:
                matched_skills = [s for s in skills if any(w in s.lower() for w in keywords)]
                if matched_skills:
                    reasons.append(f"skills: {', '.join(matched_skills[:3])}")
            if tag_overlap:
                matched = [t for t in tags if any(w in t.lower() for w in keywords)]
                if matched:
                    reasons.append(f"expertise: {', '.join(matched[:3])}")
            if is_pro_tech and skill_overlap:
                score += 0.05

        score = min(round(score, 2), 0.98)
        if score < _min_score(kind):
            return None
        if not reasons:
            reasons.append(profile.title or profile.specialty_area or "profile fit")

        reasoning = f"{profile.name}: " + "; ".join(reasons) + f" — for “{challenge.title}”."
        return {
            "profile_id": profile.id,
            "score": score,
            "reasoning": reasoning,
        }

    def _mock_match(self, challenge: Challenge, profiles: list[Profile]) -> list[dict]:
        if not profiles:
            return []

        kind = _challenge_kind(challenge)
        challenge_text = f"{challenge.title} {challenge.description}".lower()
        keywords = _tokenize(challenge_text)

        scored = []
        for profile in profiles:
            item = self._score_profile(
                challenge,
                profile,
                kind=kind,
                keywords=keywords,
                challenge_text=challenge_text,
            )
            if item:
                scored.append(item)

        scored.sort(key=lambda x: x["score"], reverse=True)
        results = []
        for rank, item in enumerate(scored[:3], start=1):
            item["rank"] = rank
            results.append(item)
        return results

    def _format_profiles(self, profiles: list[Profile]) -> str:
        lines = []
        for p in profiles:
            tags = ", ".join((p.expertise_tags or [])[:6])
            skills = ", ".join(_skills(p)[:6])
            facets = ", ".join(_facets(p))
            lines.append(
                f"- ID: {p.id} | Name: {p.name} | Title: {p.title} "
                f"| Professional title: {p.professional_title or '-'} "
                f"| Facets: {facets or '-'} | Specialty: {p.specialty_area} "
                f"| Expertise: {tags or '-'} | Skills: {skills or '-'}"
            )
        return "\n".join(lines)

    async def _call_qwen(self, challenge: Challenge, profiles: list[Profile]) -> list[dict]:
        kind = _challenge_kind(challenge)
        cross_specialty = challenge.specialty_area == ALL_SPECIALTIES
        specialty_line = (
            "Specialty filter: none — search across all specialty areas and rank by best fit."
            if cross_specialty
            else f"Specialty area: {challenge.specialty_area}"
        )
        kind_line = (
            f"Challenge kind: {kind.value}. "
            "For capability asks, prefer people with matching skills, professional titles, "
            "or professional/technical identity — not topic-only academics. "
            "For knowledge asks, prefer expertise tags. "
            "If fewer than 3 genuine matches exist, return fewer. Never invent relevance."
        )
        prompt = f"""You are an AI assistant matching a precinct challenge to people.

Challenge posted:
Title: {challenge.title}
Description: {challenge.description}
{specialty_line}
{kind_line}

Available profiles:
{self._format_profiles(profiles)}

Return ONLY valid JSON. No markdown, no explanation, no preamble.
Return 0 to 3 best matches, sorted by relevance score descending.
Only include matches that are genuinely relevant (score >= {_min_score(kind)}).
Reasoning must cite concrete skills, titles, facets, or expertise — never say "clinical gap" unless the ask is clinical knowledge.
Format:
[
  {{"profile_id": "uuid-here", "score": 0.92, "reasoning": "One clear sentence."}}
]
Scores range 0.0 to 1.0."""

        payload = {
            "model": self.model,
            "prompt": prompt,
            "stream": False,
            "format": "json",
        }
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                resp = await client.post(f"{self.url}/api/generate", json=payload)
                raw = resp.json().get("response", "[]")
                raw = re.sub(r"```json|```", "", raw).strip()
                matches = json.loads(raw)
                if isinstance(matches, dict):
                    matches = matches.get("matches") or matches.get("results") or []
                filtered = []
                for m in matches:
                    if not isinstance(m, dict) or not m.get("profile_id"):
                        continue
                    try:
                        score = float(m.get("score", 0))
                    except (TypeError, ValueError):
                        continue
                    if score < _min_score(kind):
                        continue
                    filtered.append({
                        "profile_id": m["profile_id"],
                        "score": min(score, 0.98),
                        "reasoning": (m.get("reasoning") or "").strip()
                        or f"Matched on profile fit for “{challenge.title}”.",
                    })
                filtered.sort(key=lambda x: x["score"], reverse=True)
                for rank, m in enumerate(filtered[:3], start=1):
                    m["rank"] = rank
                return filtered[:3]
        except Exception as e:
            print(f"Qwen error: {e}")
            return self._mock_match(challenge, profiles)

    async def suggest_keywords_from_publications(
        self,
        publications: list[dict[str, Any]],
    ) -> dict[str, list[str]]:
        """Suggest expertise_tags and skills from publication titles/abstracts."""
        if self.use_mock or not publications:
            return self._mock_suggest_keywords(publications)

        docs = []
        for pub in publications[:8]:
            title = pub.get("title") or ""
            abstract = (pub.get("abstract") or "")[:400]
            docs.append(f"- {title}. {abstract}".strip())
        prompt = f"""From these research publications, extract:
1) expertise_tags: research topics/domains (3-8 short phrases)
2) skills: methods/capabilities e.g. biostatistics, data analysis (0-6 short phrases)

Publications:
{chr(10).join(docs)}

Return ONLY JSON: {{"expertise_tags": ["..."], "skills": ["..."]}}"""

        payload = {
            "model": self.model,
            "prompt": prompt,
            "stream": False,
            "format": "json",
        }
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                resp = await client.post(f"{self.url}/api/generate", json=payload)
                raw = resp.json().get("response", "{}")
                raw = re.sub(r"```json|```", "", raw).strip()
                data = json.loads(raw)
                return {
                    "expertise_tags": [str(t).strip() for t in (data.get("expertise_tags") or []) if str(t).strip()][:8],
                    "skills": [str(t).strip() for t in (data.get("skills") or []) if str(t).strip()][:6],
                }
        except Exception as e:
            print(f"Qwen suggest keywords error: {e}")
            return self._mock_suggest_keywords(publications)

    def _mock_suggest_keywords(self, publications: list[dict[str, Any]]) -> dict[str, list[str]]:
        tag_counts: dict[str, int] = {}
        skill_hints = {
            "statistic": "Biostatistics",
            "machine learning": "Machine learning",
            "deep learning": "Machine learning",
            "survey": "Survey analysis",
            "registry": "Registry management",
            "visuali": "Data visualisation",
            "genomic": "Genomics analysis",
            "trial": "Clinical trial design",
            "epidemiolog": "Epidemiology",
        }
        skills: list[str] = []
        for pub in publications[:10]:
            text = f"{pub.get('title') or ''} {pub.get('abstract') or ''}".lower()
            for word in re.findall(r"[a-z]{5,}", text):
                tag_counts[word] = tag_counts.get(word, 0) + 1
            for needle, label in skill_hints.items():
                if needle in text and label not in skills:
                    skills.append(label)
        stop = {
            "study", "results", "patients", "among", "using", "based", "health",
            "between", "associated", "australia", "methods", "conclusion",
        }
        tags = [
            w.title()
            for w, _ in sorted(tag_counts.items(), key=lambda x: -x[1])
            if w not in stop
        ][:6]
        return {"expertise_tags": tags, "skills": skills[:6]}

    async def explain_map_focus(
        self,
        *,
        name: str,
        title: str,
        role: str,
        specialty: str,
        topics: list[str],
        community: str,
        collaborators: list[str],
        nearby: list[str],
        challenge_title: str | None = None,
    ) -> str:
        """Short Knowledge Map briefing via Qwen (Ollama). Falls back locally if unavailable."""
        if self.use_mock:
            return self._mock_map_briefing(
                name=name,
                specialty=specialty,
                community=community,
                collaborators=collaborators,
                nearby=nearby,
                challenge_title=challenge_title,
            )

        collab = ", ".join(collaborators[:5]) or "none recorded"
        near = ", ".join(nearby[:5]) or "topical neighbours only"
        topics_s = ", ".join(topics[:8]) or specialty
        challenge_line = (
            f"They were opened from AI Match for challenge: {challenge_title}."
            if challenge_title
            else "Opened from free exploration of the Knowledge Map."
        )
        prompt = f"""You are explaining a person's place in a healthcare innovation ecosystem map.
Write 2 short sentences. Be concrete. Do NOT recommend who to contact next.
Do NOT invent collaborations. Tone: constructive and clear.

Person: {name} ({title}), role={role}
Specialty: {specialty}
Community: {community}
Topics: {topics_s}
Recorded collaborators: {collab}
Nearby expertise (similarity, not collaborators): {near}
Context: {challenge_line}

Return ONLY plain text (no JSON, no markdown)."""

        payload = {
            "model": self.model,
            "prompt": prompt,
            "stream": False,
        }
        try:
            async with httpx.AsyncClient(timeout=20.0) as client:
                resp = await client.post(f"{self.url}/api/generate", json=payload)
                text = (resp.json().get("response") or "").strip()
                if text:
                    return text[:600]
        except Exception as e:
            print(f"Qwen map briefing error: {e}")

        return self._mock_map_briefing(
            name=name,
            specialty=specialty,
            community=community,
            collaborators=collaborators,
            nearby=nearby,
            challenge_title=challenge_title,
        )

    def _mock_map_briefing(
        self,
        *,
        name: str,
        specialty: str,
        community: str,
        collaborators: list[str],
        nearby: list[str],
        challenge_title: str | None,
    ) -> str:
        base = (
            f"{name} sits in the {community} region of the map, with expertise aligned to {specialty}."
        )
        if collaborators:
            base += f" Recorded collaborations include {', '.join(collaborators[:3])}."
        elif nearby:
            base += (
                f" No recorded collaborations yet; nearby topical expertise includes "
                f"{', '.join(nearby[:3])}."
            )
        if challenge_title:
            base += f" This view explains their position relative to “{challenge_title}.”"
        return base
