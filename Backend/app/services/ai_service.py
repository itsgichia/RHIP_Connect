import json
import os
import re
from typing import Any

import httpx
from dotenv import load_dotenv

from app.constants import ALL_SPECIALTIES
from app.models import Challenge, Profile

load_dotenv()


class AIOrchestrator:
    def __init__(self):
        self.url = os.getenv("QWEN_URL", "http://localhost:11434")
        self.model = os.getenv("QWEN_MODEL", "qwen2.5:7b")
        self.use_mock = os.getenv("USE_MOCK_AI", "false").lower() == "true"

    async def match_challenge(
        self,
        challenge: Challenge,
        profiles: list[Profile],
    ) -> list[dict[str, Any]]:
        if self.use_mock:
            return self._mock_match(challenge, profiles)
        return await self._call_qwen(challenge, profiles)

    def _mock_match(self, challenge: Challenge, profiles: list[Profile]) -> list[dict]:
        if not profiles:
            return []

        cross_specialty = challenge.specialty_area == ALL_SPECIALTIES
        desc_words = set(challenge.description.lower().split())
        title_words = set(challenge.title.lower().split())
        keywords = desc_words | title_words

        scored = []
        for profile in profiles:
            if not cross_specialty and profile.specialty_area != challenge.specialty_area:
                continue
            tag_words = set()
            for tag in profile.expertise_tags or []:
                tag_words.update(tag.lower().split())
            bio_words = set(profile.bio.lower().split()) if profile.bio else set()
            specialty_words = set(profile.specialty_area.lower().split())
            overlap = len(keywords & (tag_words | bio_words | specialty_words))
            base = 0.55 + min(overlap * 0.05, 0.35)
            if profile.name in challenge.description or any(
                t.lower() in challenge.description.lower() for t in (profile.expertise_tags or [])
            ):
                base += 0.1
            if cross_specialty and any(
                w in keywords for w in profile.specialty_area.lower().split()
            ):
                base += 0.05
            score = min(round(base, 2), 0.98)
            top_tags = ", ".join((profile.expertise_tags or [])[:3])
            reasoning = (
                f"{profile.name}'s expertise in {top_tags} directly aligns with "
                f"the clinical gap described in '{challenge.title}'."
            )
            scored.append({
                "profile_id": profile.id,
                "score": score,
                "reasoning": reasoning,
            })

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
            lines.append(
                f"- ID: {p.id} | Name: {p.name} | Title: {p.title} "
                f"| Specialty: {p.specialty_area} | Expertise: {tags}"
            )
        return "\n".join(lines)

    async def _call_qwen(self, challenge: Challenge, profiles: list[Profile]) -> list[dict]:
        cross_specialty = challenge.specialty_area == ALL_SPECIALTIES
        specialty_line = (
            "Specialty filter: none — search across all specialty areas and rank by best fit."
            if cross_specialty
            else f"Specialty area: {challenge.specialty_area}"
        )
        prompt = f"""You are an AI assistant helping match a clinical challenge to
researchers at a health innovation precinct.

Challenge posted:
Title: {challenge.title}
Description: {challenge.description}
{specialty_line}

Available researcher profiles:
{self._format_profiles(profiles)}

Return ONLY valid JSON. No markdown, no explanation, no preamble.
Return exactly the top 3 best matches, sorted by relevance score descending.
Format:
[
  {{"profile_id": "uuid-here", "score": 0.92, "reasoning": "One clear sentence explaining why this is a strong match."}},
  {{"profile_id": "uuid-here", "score": 0.85, "reasoning": "One clear sentence."}},
  {{"profile_id": "uuid-here", "score": 0.71, "reasoning": "One clear sentence."}}
]
Scores range 0.0 to 1.0. Be strict — only include genuinely relevant matches."""

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
                for rank, m in enumerate(matches[:3], start=1):
                    m["rank"] = rank
                return matches[:3]
        except Exception as e:
            print(f"Qwen error: {e}")
            return self._mock_match(challenge, profiles)
