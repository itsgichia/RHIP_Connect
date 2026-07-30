"""Challenge matching: knowledge topics vs capability/skills.

Uses synonym clusters + soft stems so related roles/topics can match
(e.g. bioinformatician ↔ bioinformatics; teenager ↔ youth) without
padding weak results to force a top-3.
"""

from __future__ import annotations

import json
import os
import re
from typing import Any

from anthropic import AsyncAnthropic
from dotenv import load_dotenv

from app.constants import ALL_SPECIALTIES
from app.models import Challenge, ChallengeKind, Profile

load_dotenv()

MIN_SCORE_KNOWLEDGE = 0.55
MIN_SCORE_CAPABILITY = 0.60
MIN_SCORE_EITHER = 0.55

# Exact phrases still used for kind detection / display.
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
    "computational biology",
    "computational biologist",
    "paediatrician",
    "pediatrician",
    "paediatric",
    "pediatric",
)

# Same-cluster = strong role match. Related clusters = soft overlap (e.g. biostats ↔ bioinfo).
ROLE_CLUSTERS: tuple[frozenset[str], ...] = (
    frozenset({
        "biostatistician", "biostatistics", "statistician", "statistics",
        "statistical", "biostat",
    }),
    frozenset({
        "bioinformatician", "bioinformatics", "bioinformatic",
        "computational biology", "computational biologist", "genomics analysis",
        "genomic analysis", "sequence analysis",
    }),
    frozenset({
        "data scientist", "data science", "data analyst", "data analysis",
        "data visualisation", "data visualization", "dashboarding",
        "emr analytics",
    }),
    frozenset({
        "registry manager", "registry management", "clinical registry",
        "data governance", "cohort building",
    }),
    frozenset({"lab tech", "laboratory", "lab technician", "laboratory technician"}),
    frozenset({"health economist", "health economics", "economic evaluation"}),
    frozenset({"epidemiologist", "epidemiology", "epi"}),
    frozenset({"methodologist", "methodology", "research methods"}),
    # Clinical paediatric roles (+ common typos). Not related to data-science clusters.
    frozenset({
        "paediatrician", "pediatrician", "paediatric", "pediatric",
        "paeds", "peds", "paediatric neurology", "pediatric neurology",
        "paediatric neurologist", "pediatric neurologist",
        "paeditrican", "peditrician", "paeditrician", "pediatrician",
        "paediatrician", "paedetrician",
    }),
)

# Index of the paediatrician clinical cluster above.
CLINICAL_PAEDS_CLUSTER_INDEX = 8

# Indices into ROLE_CLUSTERS that share transferable methods work.
RELATED_ROLE_PAIRS: tuple[tuple[int, int], ...] = (
    (0, 1),  # biostatistics ↔ bioinformatics
    (0, 2),  # biostatistics ↔ data science
    (1, 2),  # bioinformatics ↔ data science
)

_PAEDS_CLINICAL_SIGNALS = (
    "paediatric", "pediatric", "paediatrician", "pediatrician",
    "paeds", "peds", "paediatric neurology", "pediatric neurology",
    "child health", "sydney children's", "schn",
)

# Topic families expand challenge keywords so natural-language asks find related expertise.
TOPIC_SYNONYM_GROUPS: tuple[frozenset[str], ...] = (
    frozenset({
        "teenager", "teenagers", "teen", "teens", "adolescent", "adolescents",
        "adolescence", "youth", "young", "paediatric", "pediatric", "child",
        "children", "school",
    }),
    frozenset({
        "mental", "psychiatry", "psychiatric", "psychological", "psychology",
        "wellbeing", "wellness", "depression", "anxiety", "mood",
    }),
    frozenset({
        "social", "media", "digital", "online", "internet", "screen",
        "smartphone", "technology", "intervention", "interventions",
    }),
    frozenset({
        "genomic", "genomics", "genome", "precision", "personalised",
        "personalized", "oncology", "cancer",
    }),
    frozenset({
        "researcher", "research", "academic", "scientist", "investigator",
        "phd", "postdoc", "hdr",
    }),
)

_STEM_SUFFIXES = (
    "icians", "ician", "istics", "istic", "ations", "ation", "ings", "ing",
    "ers", "ies", "ian", "ists", "ist", "ments", "ment", "ness", "able",
    "s",
)


def _tokenize(text: str) -> set[str]:
    return {w for w in re.findall(r"[a-z0-9]+", (text or "").lower()) if len(w) > 2}


def _stem_token(word: str) -> str:
    w = word.lower()
    for suffix in _STEM_SUFFIXES:
        if w.endswith(suffix) and len(w) - len(suffix) >= 4:
            return w[: -len(suffix)]
    return w


def _stem_set(words: set[str]) -> set[str]:
    return {_stem_token(w) for w in words} | words


def _prefix_related(a: str, b: str) -> bool:
    """True when two tokens share a long prefix (near-forms / morphology)."""
    if a == b:
        return True
    shorter, longer = (a, b) if len(a) <= len(b) else (b, a)
    if len(shorter) < 6:
        return False
    need = max(6, min(len(shorter) - 1, 8))
    return longer.startswith(shorter[:need])


def _soft_overlap(a: set[str], b: set[str]) -> int:
    """Exact overlap, then stem overlap, then long-prefix near-forms."""
    if not a or not b:
        return 0
    exact = len(a & b)
    if exact:
        return exact
    stems_a = _stem_set(a)
    stems_b = _stem_set(b)
    stem_hits = len(stems_a & stems_b)
    if stem_hits:
        return stem_hits
    count = 0
    for wa in a:
        if any(_prefix_related(wa, wb) for wb in b):
            count += 1
    return count


def _expand_topic_keywords(keywords: set[str]) -> set[str]:
    expanded = set(keywords)
    for group in TOPIC_SYNONYM_GROUPS:
        if keywords & group:
            expanded |= group
    return expanded


def _topic_group_indices(tokens: set[str]) -> set[int]:
    return {i for i, group in enumerate(TOPIC_SYNONYM_GROUPS) if tokens & group}


def _shared_topic_groups(challenge_tokens: set[str], profile_tokens: set[str]) -> set[int]:
    """Synonym families present on both sides (e.g. youth + mental + digital)."""
    return _topic_group_indices(challenge_tokens) & _topic_group_indices(profile_tokens)


def _cluster_hits(text: str) -> set[int]:
    hits: set[int] = set()
    lower = (text or "").lower()
    tokens = _tokenize(lower)
    stems = _stem_set(tokens)
    for idx, cluster in enumerate(ROLE_CLUSTERS):
        for phrase in cluster:
            if " " in phrase:
                if phrase in lower:
                    hits.add(idx)
                    break
            elif (
                phrase in tokens
                or _stem_token(phrase) in stems
                or any(_prefix_related(phrase, t) for t in tokens)
            ):
                hits.add(idx)
                break
    return hits


def _role_relatedness(challenge_text: str, profile_blob: str) -> tuple[str, float]:
    """Return (label, boost). Exact cluster > related cluster > none."""
    c_hits = _cluster_hits(challenge_text)
    p_hits = _cluster_hits(profile_blob)
    if not c_hits or not p_hits:
        # Legacy exact phrase both sides
        legacy = [h for h in CAPABILITY_ROLE_HINTS if h in challenge_text and h in profile_blob]
        if legacy:
            return legacy[0], 0.25
        return "", 0.0
    shared = c_hits & p_hits
    if shared:
        idx = next(iter(shared))
        cluster = ROLE_CLUSTERS[idx]
        preferred = (
            "paediatrician", "pediatrician", "bioinformatician", "biostatistician",
            "data scientist", "data analyst", "epidemiologist", "methodologist",
            "health economist", "registry manager",
        )
        sample = next((p for p in preferred if p in cluster), next(iter(cluster)))
        return sample, 0.28
    for a, b in RELATED_ROLE_PAIRS:
        if (a in c_hits and b in p_hits) or (b in c_hits and a in p_hits):
            return "related methods role", 0.18
    return "", 0.0


def _is_clinical_paeds_ask(challenge_text: str) -> bool:
    return CLINICAL_PAEDS_CLUSTER_INDEX in _cluster_hits(challenge_text)


def _has_paediatric_clinical_signal(profile_blob: str, facets: list[str]) -> bool:
    """True when profile looks like paediatric clinical practice (not just any clinician)."""
    blob = (profile_blob or "").lower()
    if not any(s in blob for s in _PAEDS_CLINICAL_SIGNALS):
        return False
    # Prefer clinician identity; still allow researcher-clinicians with clear paediatric tags.
    if "clinician" in facets:
        return True
    return any(
        s in blob
        for s in (
            "paediatrician", "pediatrician", "paediatric neurologist",
            "pediatric neurologist", "paediatric neurology", "pediatric neurology",
        )
    )


def _has_specific_role_ask(challenge_text: str) -> bool:
    """True when the ask names a concrete capability role (not just 'researcher')."""
    return bool(_cluster_hits(challenge_text)) or any(
        h in challenge_text for h in CAPABILITY_ROLE_HINTS
    )


def _challenge_kind(challenge: Challenge) -> ChallengeKind:
    kind = getattr(challenge, "challenge_kind", None) or ChallengeKind.EITHER
    if isinstance(kind, str):
        try:
            kind = ChallengeKind(kind)
        except ValueError:
            kind = ChallengeKind.EITHER
    blob = f"{challenge.title} {challenge.description}".lower()
    # Capability radio + topical prose (no named role) → score as either so expertise can match.
    if kind == ChallengeKind.CAPABILITY and not _has_specific_role_ask(blob):
        return ChallengeKind.EITHER
    if kind != ChallengeKind.EITHER:
        return kind
    if _has_specific_role_ask(blob):
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
        self.api_key = (os.getenv("ANTHROPIC_API_KEY") or "").strip()
        self.model = os.getenv("ANTHROPIC_MODEL", "claude-haiku-4-5")
        mock_flag = os.getenv("USE_MOCK_AI", "false").lower() == "true"
        self.use_mock = mock_flag or not self.api_key
        self._client: AsyncAnthropic | None = (
            None if self.use_mock else AsyncAnthropic(api_key=self.api_key)
        )

    async def _complete(self, prompt: str, *, max_tokens: int = 1024) -> str:
        """Call Anthropic Messages API; returns concatenated text content."""
        if not self._client:
            raise RuntimeError("Anthropic client not configured")
        message = await self._client.messages.create(
            model=self.model,
            max_tokens=max_tokens,
            messages=[{"role": "user", "content": prompt}],
        )
        parts: list[str] = []
        for block in message.content:
            text = getattr(block, "text", None)
            if text:
                parts.append(text)
        return "".join(parts).strip()

    async def match_challenge(
        self,
        challenge: Challenge,
        profiles: list[Profile],
    ) -> list[dict[str, Any]]:
        if self.use_mock:
            return self._mock_match(challenge, profiles)
        results = await self._call_claude(challenge, profiles)
        # If the LLM finds nothing, still try semantic/related matching locally.
        if not results:
            return self._mock_match(challenge, profiles)
        return results

    def _score_profile(
        self,
        challenge: Challenge,
        profile: Profile,
        *,
        kind: ChallengeKind,
        keywords: set[str],
        challenge_text: str,
        raw_keywords: set[str] | None = None,
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
                ],
            )
        ).lower()
        profile_blob = (
            f"{title_blob} {' '.join(tags)} {' '.join(facets)} {profile.bio or ''} "
            f"{profile.specialty_area or ''}"
        ).lower()

        tag_words: set[str] = set()
        for tag in tags:
            tag_words.update(_tokenize(tag))
        skill_words: set[str] = set()
        for skill in skills:
            skill_words.update(_tokenize(skill))
        bio_words = _tokenize(profile.bio or "")
        specialty_words = _tokenize(profile.specialty_area or "")
        title_words = _tokenize(
            f"{profile.title or ''} {profile.professional_title or ''}".lower()
        )
        skill_pool = skill_words
        topic_pool = tag_words | bio_words | specialty_words
        raw = raw_keywords if raw_keywords is not None else keywords

        generic = {
            "researcher", "research", "academic", "scientist", "investigator",
            "phd", "postdoc", "hdr", "student", "candidate", "looking", "someone",
            "relevant", "need", "help", "study", "collaborate", "works", "especially",
            "detrimental", "related", "among", "people", "health", "use", "across",
            "please", "connect", "work", "with", "that", "this", "from", "have",
        }
        topical_raw = raw - generic
        topical_expanded = keywords - generic

        # Direct overlap prefers the asker's own words; groups catch synonyms.
        direct_tag_overlap = _soft_overlap(topical_raw, topic_pool)
        expanded_tag_overlap = _soft_overlap(topical_expanded, topic_pool)
        shared_groups = _shared_topic_groups(topical_raw, topic_pool)
        skill_overlap = _soft_overlap(topical_expanded, skill_pool)
        title_overlap = _soft_overlap(topical_expanded, title_words)
        role_label, role_boost = _role_relatedness(challenge_text, profile_blob)
        is_pro_tech = "professional_technical" in facets
        is_researcher = "researcher" in facets
        is_clinician = "clinician" in facets
        clinical_paeds_ask = _is_clinical_paeds_ask(challenge_text)
        paeds_signal = _has_paediatric_clinical_signal(profile_blob, facets)

        # Clinical paediatrician asks must match paediatric clinical signal — not data scientists.
        if clinical_paeds_ask and not paeds_signal:
            return None

        # Phrase / tag hits in the raw challenge text (high precision).
        phrase_tags = [t for t in tags if t.lower() in challenge_text]
        bio_phrase_hit = any(
            phrase in (profile.bio or "").lower()
            for phrase in ("social media", "teenager", "teenagers", "adolescent", "youth mental")
            if phrase in challenge_text or any(
                w in challenge_text for w in phrase.split()
            )
        )

        reasons: list[str] = []
        score = 0.0

        # Topical strength: multi-theme synonym overlap or direct word hits.
        topical_strength = direct_tag_overlap + len(shared_groups) + (2 if phrase_tags else 0)

        if kind == ChallengeKind.CAPABILITY:
            title_keyword_hit = title_overlap > 0 or any(
                len(w) > 4 and w in title_blob for w in topical_expanded
            )
            if skill_overlap == 0 and not role_label and not title_keyword_hit and not paeds_signal:
                return None
            if clinical_paeds_ask:
                # Role/title gate already enforced via paeds_signal early return.
                score = 0.50 + (0.28 if role_label else 0.18)
                if is_clinician:
                    score += 0.10
                    reasons.append("clinician identity")
                if role_label:
                    reasons.append(f"role/title match ({role_label})")
                matched_tags = [
                    t for t in tags
                    if any(s in t.lower() for s in ("paediatric", "pediatric", "child", "neurolog"))
                ]
                if matched_tags:
                    reasons.append(f"expertise: {', '.join(matched_tags[:3])}")
                elif "paediatric" in profile_blob or "pediatric" in profile_blob:
                    reasons.append("paediatric clinical expertise")
                score += min(expanded_tag_overlap * 0.02, 0.06)
            else:
                score = 0.45 + min(skill_overlap * 0.12, 0.36)
                if role_boost:
                    score += role_boost
                    reasons.append(f"role/title match ({role_label})")
                if skill_overlap:
                    matched_skills = [
                        s for s in skills
                        if _soft_overlap(_tokenize(s), topical_expanded) > 0
                    ]
                    if matched_skills:
                        reasons.append(f"skills: {', '.join(matched_skills[:3])}")
                    else:
                        reasons.append("skills/title keyword overlap")
                elif title_keyword_hit:
                    reasons.append("title matches the capability ask")
                if is_pro_tech:
                    score += 0.08
                    reasons.append("professional/technical identity")
                score += min(expanded_tag_overlap * 0.02, 0.06)

        elif kind == ChallengeKind.KNOWLEDGE:
            if topical_strength == 0 and not phrase_tags and not bio_phrase_hit:
                return None
            # Single broad theme (e.g. only "mental") is too weak alone.
            if direct_tag_overlap == 0 and len(shared_groups) < 2 and not phrase_tags:
                return None
            score = 0.45 + min(direct_tag_overlap * 0.1, 0.3) + min(len(shared_groups) * 0.08, 0.24)
            if phrase_tags:
                score += 0.08
            if tags:
                matched = phrase_tags or [
                    t for t in tags
                    if _soft_overlap(_tokenize(t), topical_expanded) > 0
                ] or tags[:2]
                reasons.append(f"expertise: {', '.join(matched[:3])}")
            if is_researcher and len(shared_groups) >= 2:
                score += 0.03
            score += min(skill_overlap * 0.02, 0.06)

        else:  # EITHER
            if (
                topical_strength == 0
                and skill_overlap == 0
                and not role_label
                and title_overlap == 0
                and not phrase_tags
            ):
                return None
            # Topic-only path needs real topical signal (not one vague synonym).
            topic_ok = (
                direct_tag_overlap > 0
                or len(shared_groups) >= 2
                or bool(phrase_tags)
                or bio_phrase_hit
            )
            capability_ok = bool(role_label) or skill_overlap > 0 or title_overlap > 0
            if not topic_ok and not capability_ok:
                return None
            score = (
                0.34
                + min(direct_tag_overlap * 0.08, 0.24)
                + min(len(shared_groups) * 0.07, 0.21)
                + min(skill_overlap * 0.1, 0.28)
                + min(title_overlap * 0.05, 0.1)
            )
            if phrase_tags:
                score += min(0.06 * len(phrase_tags), 0.12)
            # Precision bonuses for the social-media / youth digital ask.
            blob_tags = " ".join(tags).lower()
            if "social media" in challenge_text and "social media" in profile_blob:
                score += 0.12
            elif "social media" in challenge_text and (
                "digital" in blob_tags or "online" in blob_tags or "e-mental" in blob_tags
            ):
                score += 0.06
            if any(w in challenge_text for w in ("teenager", "teenagers", "adolescent", "youth")) and any(
                w in blob_tags for w in ("youth", "adolescent", "teen", "child", "paediatric", "pediatric", "school")
            ):
                score += 0.08
            if role_boost:
                score += role_boost
                reasons.append(f"role/title match ({role_label})")
            if skill_overlap:
                matched_skills = [
                    s for s in skills
                    if _soft_overlap(_tokenize(s), topical_expanded) > 0
                ]
                if matched_skills:
                    reasons.append(f"skills: {', '.join(matched_skills[:3])}")
            if topic_ok:
                matched = phrase_tags or [
                    t for t in tags
                    if _soft_overlap(_tokenize(t), topical_expanded) > 0
                ]
                if matched:
                    reasons.append(f"expertise: {', '.join(matched[:3])}")
            if is_researcher and len(shared_groups) >= 2:
                score += 0.03
                reasons.append("researcher identity")
            if is_pro_tech and (skill_overlap or role_label):
                score += 0.05

            # Require youth+mental (or social/digital) together for topic-led either-matches
            # when the ask clearly names a youth population.
            youth_ask = bool(
                topical_raw
                & {"teenager", "teenagers", "teen", "teens", "adolescent", "adolescents", "youth", "child", "children"}
            )
            if topic_ok and not capability_ok and youth_ask:
                youth_groups = {0}  # TOPIC_SYNONYM_GROUPS[0] = youth/teen
                if not (shared_groups & youth_groups) and not any(
                    w in blob_tags for w in ("youth", "adolescent", "teen", "child", "paediatric", "pediatric", "school")
                ):
                    return None

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
        raw_keywords = _tokenize(challenge_text)
        keywords = _expand_topic_keywords(raw_keywords)

        scored = []
        for profile in profiles:
            item = self._score_profile(
                challenge,
                profile,
                kind=kind,
                keywords=keywords,
                challenge_text=challenge_text,
                raw_keywords=raw_keywords,
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

    async def _call_claude(self, challenge: Challenge, profiles: list[Profile]) -> list[dict]:
        kind = _challenge_kind(challenge)
        challenge_text = f"{challenge.title} {challenge.description}".lower()
        raw_keywords = _tokenize(challenge_text)
        keywords = _expand_topic_keywords(raw_keywords)
        profiles_by_id = {p.id: p for p in profiles}

        cross_specialty = challenge.specialty_area == ALL_SPECIALTIES
        specialty_line = (
            "Specialty filter: none — search across all specialty areas and rank by best fit."
            if cross_specialty
            else f"Specialty area: {challenge.specialty_area}"
        )
        kind_line = (
            f"Challenge kind: {kind.value}. "
            "For capability asks, prefer matching or closely related skills/titles "
            "(e.g. bioinformatician ↔ bioinformatics ↔ biostatistician when methods overlap). "
            "For paediatrician / paediatric clinical asks, prefer clinicians with paediatric "
            "expertise — not data scientists or unrelated professional/technical staff. "
            "For knowledge asks, match on expertise topics and related synonyms "
            "(e.g. teenagers ↔ youth/adolescent; social media ↔ digital interventions). "
            "Read the full prompt semantically — do not require exact keyword overlap. "
            "If fewer than 3 genuine matches exist, return fewer. Never invent relevance "
            "or pad with weak matches."
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
Include closely related people when relevance is clear (score >= {_min_score(kind)}).
Skip anyone who is only loosely or generically related.
Reasoning MUST name only the matched person's name from that profile row (the same profile_id).
Do NOT mention any other person. Do NOT invent "overlaps with" between unrelated people.
Cite that person's concrete skills, titles, facets, or expertise only.
Never say "clinical gap" unless the ask is clinical knowledge.
Format:
[
  {{"profile_id": "uuid-here", "score": 0.92, "reasoning": "One clear sentence about this person only."}}
]
Scores range 0.0 to 1.0."""

        try:
            raw = await self._complete(prompt, max_tokens=1024)
            raw = re.sub(r"```json|```", "", raw).strip()
            matches = json.loads(raw)
            if isinstance(matches, dict):
                matches = matches.get("matches") or matches.get("results") or []
            validated: list[dict[str, Any]] = []
            seen: set[str] = set()
            for m in matches:
                if not isinstance(m, dict) or not m.get("profile_id"):
                    continue
                profile_id = m["profile_id"]
                if profile_id in seen:
                    continue
                profile = profiles_by_id.get(profile_id)
                if not profile:
                    continue
                # Local scorer is source of truth for fit + reasoning text.
                local = self._score_profile(
                    challenge,
                    profile,
                    kind=kind,
                    keywords=keywords,
                    challenge_text=challenge_text,
                    raw_keywords=raw_keywords,
                )
                if not local:
                    continue
                seen.add(profile_id)
                validated.append(local)
            validated.sort(key=lambda x: x["score"], reverse=True)
            for rank, item in enumerate(validated[:3], start=1):
                item["rank"] = rank
            return validated[:3]
        except Exception as e:
            print(f"Anthropic match error: {e}")
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

        try:
            raw = await self._complete(prompt, max_tokens=512)
            raw = re.sub(r"```json|```", "", raw).strip()
            data = json.loads(raw)
            return {
                "expertise_tags": [str(t).strip() for t in (data.get("expertise_tags") or []) if str(t).strip()][:8],
                "skills": [str(t).strip() for t in (data.get("skills") or []) if str(t).strip()][:6],
            }
        except Exception as e:
            print(f"Anthropic suggest keywords error: {e}")
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
        """Short Knowledge Map briefing via Claude. Falls back locally if unavailable."""
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

        try:
            text = await self._complete(prompt, max_tokens=256)
            if text:
                return text[:600]
        except Exception as e:
            print(f"Anthropic map briefing error: {e}")

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
