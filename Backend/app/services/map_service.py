"""Knowledge Map graph builder: topic geography, typed edges, opportunity insights."""

from __future__ import annotations

import math
import re
from collections import defaultdict, deque
from typing import Any

from sqlalchemy.orm import Session

from app.identity import profile_facets
from app.models import (
    Challenge,
    Institution,
    Profile,
    Project,
    Publication,
    User,
)

ROLE_COLORS = {
    "clinician": "#0D7377",
    "researcher": "#14919B",
    "professional_technical": "#B45309",
    "policy": "#5B21B6",
    "admin": "#5C6B73",
}

AFFINITY_MIN_WEIGHT = 0.28
AFFINITY_MAX_EDGES = 200
NEIGHBOURHOOD_HOPS_AFFINITY = 8


def _normalize_topic(raw: str) -> str:
    return re.sub(r"\s+", " ", (raw or "").strip().lower())


def _normalize_doi(raw: str | None) -> str | None:
    """Canonical DOI for co-authorship matching (ORCID paper identity)."""
    if not raw:
        return None
    doi = str(raw).strip()
    if not doi:
        return None
    lower = doi.lower()
    for prefix in (
        "https://doi.org/",
        "http://doi.org/",
        "https://dx.doi.org/",
        "http://dx.doi.org/",
        "doi:",
    ):
        if lower.startswith(prefix):
            doi = doi[len(prefix) :]
            break
    doi = doi.strip().rstrip("/").lower()
    return doi or None


def _paper_identity(pub: Publication) -> tuple[str, dict[str, Any]] | None:
    """Return (match_key, paper meta) for co-authorship.

    Same principle as the old PubMed PMID graph: two profiles sharing a paper
    identifier are collaborators. Prefer DOI (ORCID's primary external id);
    fall back to PMID when a work has no DOI.
    """
    doi = _normalize_doi(pub.doi)
    pmid = str(pub.pmid).strip() if pub.pmid else ""
    title = pub.title or ""
    year = pub.year
    if doi:
        url = pub.url or f"https://doi.org/{doi}"
        return f"doi:{doi}", {
            "key": f"doi:{doi}",
            "doi": doi,
            "pmid": pmid or None,
            "title": title,
            "year": year,
            "url": url,
        }
    if pmid:
        url = pub.url or f"https://pubmed.ncbi.nlm.nih.gov/{pmid}/"
        return f"pmid:{pmid}", {
            "key": f"pmid:{pmid}",
            "doi": None,
            "pmid": pmid,
            "title": title,
            "year": year,
            "url": url,
        }
    return None


def _display_topic(raw: str) -> str:
    cleaned = re.sub(r"\s+", " ", (raw or "").strip())
    return cleaned or "General"


def _profile_topics(profile: Profile) -> list[str]:
    tags = [t for t in (profile.expertise_tags or []) if isinstance(t, str) and t.strip()]
    skills = [t for t in (profile.skills or []) if isinstance(t, str) and t.strip()]
    topics: list[str] = []
    seen: set[str] = set()
    for tag in tags + skills:
        key = _normalize_topic(tag)
        if key and key not in seen:
            seen.add(key)
            topics.append(_display_topic(tag))
    specialty = (profile.specialty_area or "").strip()
    if specialty:
        key = _normalize_topic(specialty)
        if key not in seen:
            topics.append(_display_topic(specialty))
    if not topics:
        topics.append("General")
    return topics


def _primary_topic(topics: list[str]) -> str:
    return topics[0] if topics else "General"


def _institution_name(user: User | None, db: Session) -> str | None:
    if not user or not user.institution_id:
        return None
    inst = db.query(Institution).filter(Institution.id == user.institution_id).first()
    return inst.name if inst else None


def _jaccard(a: set[str], b: set[str]) -> float:
    if not a or not b:
        return 0.0
    inter = len(a & b)
    if inter == 0:
        return 0.0
    return inter / len(a | b)


def _overlap_coeff(a: set[str], b: set[str]) -> float:
    """Szymkiewicz–Simpson: shared topics relative to the smaller set."""
    if not a or not b:
        return 0.0
    inter = len(a & b)
    if inter == 0:
        return 0.0
    return inter / min(len(a), len(b))


def _topic_affinity(a: set[str], b: set[str], specialty_a: str, specialty_b: str) -> float:
    """Blend overlap + Jaccard; shared specialty is a honest affinity floor."""
    if not a or not b:
        return 0.0
    overlap = _overlap_coeff(a, b)
    jaccard = _jaccard(a, b)
    weight = 0.65 * overlap + 0.35 * jaccard
    spec_a = _normalize_topic(specialty_a)
    spec_b = _normalize_topic(specialty_b)
    if spec_a and spec_a == spec_b and spec_a != "general":
        weight = max(weight, 0.32)
    return weight


def _token_set(text: str) -> set[str]:
    return {t for t in re.findall(r"[a-z0-9]+", (text or "").lower()) if len(t) > 2}


def _layout_by_topic(nodes_meta: list[dict[str, Any]]) -> None:
    """Assign stable x/y in viewBox 0–100 using topic communities as geography."""
    communities: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for node in nodes_meta:
        communities[node["community"]].append(node)

    community_ids = sorted(communities.keys(), key=lambda c: (-len(communities[c]), c.lower()))
    n_communities = max(len(community_ids), 1)

    for c_idx, community in enumerate(community_ids):
        members = communities[community]
        # Place community centres on a ring; single community sits near centre.
        if n_communities == 1:
            cx, cy = 50.0, 50.0
            base_radius = 28.0
        else:
            angle = (2 * math.pi * c_idx) / n_communities - math.pi / 2
            ring = 32.0 if n_communities <= 6 else 36.0
            cx = 50.0 + ring * math.cos(angle)
            cy = 50.0 + ring * math.sin(angle)
            base_radius = 10.0 + min(8.0, len(members) * 0.6)

        for i, node in enumerate(members):
            if len(members) == 1:
                node["x"] = round(cx, 2)
                node["y"] = round(cy, 2)
                continue
            spread = (2 * math.pi * i) / len(members)
            # Slight radial jitter by index for readability without looking random each request.
            r = base_radius * (0.55 + (i % 3) * 0.18)
            node["x"] = round(cx + r * math.cos(spread), 2)
            node["y"] = round(cy + r * math.sin(spread), 2)
            # Clamp into viewBox padding
            node["x"] = max(6.0, min(94.0, node["x"]))
            node["y"] = max(8.0, min(92.0, node["y"]))


def _build_nodes(db: Session, limit: int = 120) -> tuple[list[dict], dict[str, Profile], dict[str, set[str]]]:
    profiles = (
        db.query(Profile)
        .join(User, Profile.user_id == User.id)
        .filter(Profile.is_public.is_(True))
        .limit(limit)
        .all()
    )

    nodes: list[dict] = []
    profile_by_id: dict[str, Profile] = {}
    topic_sets: dict[str, set[str]] = {}

    for p in profiles:
        user = p.user
        access_role = user.role.value if user and user.role else "researcher"
        facets = profile_facets(p, user)
        # Prefer primary_lens / first facet for colour; fall back to access role
        display_role = p.primary_lens or (facets[0] if facets else access_role)
        topics = _profile_topics(p)
        community = (p.specialty_area or "").strip() or _primary_topic(topics)
        topic_keys = {_normalize_topic(t) for t in topics}
        topic_sets[p.id] = topic_keys
        profile_by_id[p.id] = p
        nodes.append(
            {
                "id": p.id,
                "label": p.name.split()[-1] if p.name else "User",
                "name": p.name,
                "title": p.title,
                "role": display_role,
                "access_role": access_role,
                "identity_facets": facets,
                "career_level": p.career_level,
                "specialty_area": p.specialty_area,
                "topics": topics,
                "community": community,
                "institution_name": _institution_name(user, db),
                "color": ROLE_COLORS.get(display_role, ROLE_COLORS.get(access_role, "#14919B")),
                "active_projects": p.active_projects or 0,
                "publications": p.publications or 0,
            }
        )

    _layout_by_topic(nodes)
    return nodes, profile_by_id, topic_sets


def _real_edges(db: Session, profile_ids: set[str], profile_by_id: dict[str, Profile]) -> list[dict]:
    edges: list[dict] = []
    seen: set[tuple[str, str, str]] = set()

    def add_edge(
        source: str,
        target: str,
        *,
        edge_id: str,
        kind: str,
        weight: float,
        provenance: dict,
    ) -> None:
        if source not in profile_ids or target not in profile_ids or source == target:
            return
        a, b = sorted([source, target])
        key = (a, b, kind)
        if key in seen:
            return
        seen.add(key)
        edges.append(
            {
                "id": edge_id,
                "source": a,
                "target": b,
                "type": "real",
                "kind": kind,
                "weight": round(weight, 2),
                "provenance": provenance,
            }
        )

    # ORCID-style co-authorship: shared paper identity (DOI preferred, PMID fallback)
    pubs = (
        db.query(Publication)
        .filter(Publication.profile_id.in_(profile_ids))
        .all()
    )
    paper_profiles: dict[str, set[str]] = defaultdict(set)
    paper_meta: dict[str, dict[str, Any]] = {}
    for pub in pubs:
        identity = _paper_identity(pub)
        if not identity:
            continue
        key, meta = identity
        paper_profiles[key].add(pub.profile_id)
        if key not in paper_meta:
            paper_meta[key] = meta

    pair_papers: dict[tuple[str, str], list[dict[str, Any]]] = defaultdict(list)
    for key, owners in paper_profiles.items():
        if len(owners) < 2:
            continue
        owner_list = sorted(owners)
        meta = paper_meta.get(key) or {}
        for i, a in enumerate(owner_list):
            for b in owner_list[i + 1 :]:
                pair_papers[(a, b)].append(dict(meta))

    for (a, b), papers in pair_papers.items():
        shared_count = len(papers)
        weight = min(0.99, 0.75 + 0.05 * shared_count)
        titles = [p["title"] for p in papers if p.get("title")][:3]
        dois = [p["doi"] for p in papers if p.get("doi")]
        pmids = [p["pmid"] for p in papers if p.get("pmid")]
        urls = [p["url"] for p in papers if p.get("url")]
        add_edge(
            a,
            b,
            edge_id=f"coauthor-{a}-{b}",
            kind="coauthor",
            weight=weight,
            provenance={
                "source": "orcid",
                "shared_count": shared_count,
                "papers": papers,
                "dois": dois,
                "pmids": pmids,
                "titles": titles,
                "urls": urls,
                "doi": dois[0] if dois else None,
                "pmid": pmids[0] if pmids else None,
                "title": titles[0] if titles else None,
                "url": urls[0] if urls else None,
            },
        )

    return edges


def _affinity_edges(nodes: list[dict], topic_sets: dict[str, set[str]]) -> list[dict]:
    edges: list[dict] = []
    scored: list[tuple[float, str, str, list[str]]] = []

    for i, a in enumerate(nodes):
        set_a = topic_sets.get(a["id"], set())
        if not set_a:
            continue
        for b in nodes[i + 1 :]:
            set_b = topic_sets.get(b["id"], set())
            weight = _topic_affinity(
                set_a,
                set_b,
                a.get("specialty_area") or "",
                b.get("specialty_area") or "",
            )
            if weight < AFFINITY_MIN_WEIGHT:
                continue
            shared = sorted(set_a & set_b)
            scored.append((weight, a["id"], b["id"], shared))

    scored.sort(key=lambda row: (-row[0], row[1], row[2]))
    for weight, source, target, shared in scored[:AFFINITY_MAX_EDGES]:
        a, b = sorted([source, target])
        edges.append(
            {
                "id": f"affinity-{a}-{b}",
                "source": a,
                "target": b,
                "type": "affinity",
                "kind": "topic_overlap",
                "weight": round(weight, 2),
                "provenance": {
                    "source": "expertise_tags",
                    "shared_topics": shared[:6],
                },
            }
        )
    return edges


def _community_role_mix(nodes: list[dict]) -> dict[str, dict[str, int]]:
    mix: dict[str, dict[str, int]] = defaultdict(lambda: defaultdict(int))
    for n in nodes:
        mix[n["community"]][n["role"]] += 1
    return {c: dict(roles) for c, roles in mix.items()}


def _landscape_insights(nodes: list[dict]) -> list[dict]:
    insights: list[dict] = []
    mix = _community_role_mix(nodes)

    for community, roles in mix.items():
        researchers = roles.get("researcher", 0)
        clinicians = roles.get("clinician", 0)
        total = sum(roles.values())
        if total < 2:
            continue

        if researchers >= 2 and clinicians == 0:
            insights.append(
                {
                    "id": f"opp-clinical-{_normalize_topic(community)}",
                    "type": "opportunity",
                    "code": "clinical_near_cluster",
                    "tone": "positive",
                    "target_community": community,
                    "message": (
                        f"This {community} community could benefit from stronger clinical partnerships."
                    ),
                }
            )

    # Cap landscape insights so the map stays calm
    return insights[:6]


def _focus_insights(
    focus_node: dict,
    neighbourhood_nodes: list[dict],
    challenge: Challenge | None,
) -> list[dict]:
    insights: list[dict] = []
    roles = {n["role"] for n in neighbourhood_nodes}
    focus_roles_nearby = roles | {focus_node["role"]}

    has_research = "researcher" in focus_roles_nearby
    has_clinical = "clinician" in focus_roles_nearby

    if has_research and not has_clinical:
        insights.append(
            {
                "id": f"opp-clinical-focus-{focus_node['id']}",
                "type": "opportunity",
                "code": "clinical_near_cluster",
                "tone": "positive",
                "target_node": focus_node["id"],
                "message": (
                    "This community could benefit from stronger clinical partnerships."
                ),
            }
        )

    if challenge:
        challenge_tokens = _token_set(
            f"{challenge.title} {challenge.description} {challenge.specialty_area}"
        )
        person_tokens = set()
        for t in focus_node.get("topics") or []:
            person_tokens |= _token_set(t)
        person_tokens |= _token_set(focus_node.get("specialty_area") or "")
        shared = sorted(challenge_tokens & person_tokens)
        if shared:
            insights.append(
                {
                    "id": f"match-context-{focus_node['id']}",
                    "type": "match_context",
                    "code": "shared_topics",
                    "tone": "positive",
                    "target_node": focus_node["id"],
                    "shared_topics": shared[:8],
                    "message": (
                        f"Shared themes with “{challenge.title}”: "
                        + ", ".join(shared[:5])
                    ),
                }
            )

    return insights[:2]


def _projects_for_profile(db: Session, profile: Profile) -> list[dict]:
    projects = (
        db.query(Project)
        .filter(Project.lead_researcher_id == profile.user_id)
        .limit(5)
        .all()
    )
    return [
        {
            "id": p.id,
            "title": p.title,
            "specialty_area": p.specialty_area,
            "trl": p.trl,
        }
        for p in projects
    ]


def _filter_nodes(
    nodes: list[dict],
    *,
    query: str | None,
    role_lens: str | None,
) -> list[dict]:
    filtered = nodes
    if role_lens:
        filtered = [
            n
            for n in filtered
            if role_lens in (n.get("identity_facets") or [])
            or n.get("role") == role_lens
            or n.get("access_role") == role_lens
        ]
    if query:
        q = query.strip().lower()
        if q:
            filtered = [
                n
                for n in filtered
                if q in (n["name"] or "").lower()
                or q in (n["title"] or "").lower()
                or q in (n["specialty_area"] or "").lower()
                or q in (n["community"] or "").lower()
                or any(q in t.lower() for t in n.get("topics") or [])
                or q in (n.get("institution_name") or "").lower()
            ]
    return filtered


def _parse_role_lens(lens: str | None) -> str | None:
    if not lens:
        return None
    raw = lens.strip().lower()
    if raw.startswith("role:"):
        raw = raw.split(":", 1)[1]
    if raw in ROLE_COLORS or raw in {
        "clinician",
        "researcher",
        "professional_technical",
        "policy",
        "admin",
    }:
        return raw
    return None


def _resolve_community_name(community: str | None, communities: list[str]) -> str | None:
    if not community:
        return None
    raw = community.strip()
    if not raw:
        return None
    for c in communities:
        if c.lower() == raw.lower():
            return c
    # Allow partial match (e.g. "mental health")
    lowered = raw.lower()
    matches = [c for c in communities if lowered in c.lower()]
    return matches[0] if len(matches) == 1 else (matches[0] if matches else None)


def _build_community_view(
    nodes: list[dict],
    real_edges: list[dict],
    community_name: str,
) -> dict[str, Any]:
    members = [n for n in nodes if n["community"] == community_name]
    role_mix: dict[str, int] = defaultdict(int)
    institution_counts: dict[str, int] = defaultdict(int)
    topic_counts: dict[str, int] = defaultdict(int)

    member_ids = {m["id"] for m in members}
    for m in members:
        role_mix[m["role"]] += 1
        inst = m.get("institution_name")
        if inst:
            institution_counts[inst] += 1
        for t in m.get("topics") or []:
            topic_counts[t] += 1

    # Connectors: members with a real edge to someone outside this community
    bridges_out: list[dict] = []
    seen_connectors: set[str] = set()
    node_by_id = {n["id"]: n for n in nodes}
    for e in real_edges:
        a, b = e["source"], e["target"]
        if a in member_ids and b not in member_ids:
            connector, other = a, b
        elif b in member_ids and a not in member_ids:
            connector, other = b, a
        else:
            continue
        if connector in seen_connectors:
            continue
        seen_connectors.add(connector)
        c_node = node_by_id[connector]
        o_node = node_by_id.get(other)
        bridges_out.append(
            {
                "id": connector,
                "name": c_node["name"],
                "role": c_node["role"],
                "connects_to": o_node["name"] if o_node else other,
                "connects_to_community": o_node["community"] if o_node else None,
            }
        )
        if len(bridges_out) >= 6:
            break

    insights = [
        i
        for i in _landscape_insights(nodes)
        if i.get("target_community") == community_name
    ]

    return {
        "name": community_name,
        "member_count": len(members),
        "role_mix": dict(role_mix),
        "institutions": [
            {"name": name, "count": count}
            for name, count in sorted(institution_counts.items(), key=lambda x: -x[1])[:6]
        ],
        "topics": [
            name
            for name, _ in sorted(topic_counts.items(), key=lambda x: -x[1])[:10]
            if _normalize_topic(name) != _normalize_topic(community_name)
        ],
        "members": [
            {
                "id": m["id"],
                "name": m["name"],
                "role": m["role"],
                "title": m["title"],
                "institution_name": m.get("institution_name"),
            }
            for m in sorted(members, key=lambda x: x["name"])
        ],
        "insights": insights,
        "bridges_out": bridges_out,
    }


def _adjacency(edges: list[dict]) -> dict[str, list[tuple[str, dict]]]:
    adj: dict[str, list[tuple[str, dict]]] = defaultdict(list)
    for e in edges:
        adj[e["source"]].append((e["target"], e))
        adj[e["target"]].append((e["source"], e))
    return adj


def find_bridge_path(
    nodes: list[dict],
    real_edges: list[dict],
    affinity_edges: list[dict],
    a_id: str,
    b_id: str,
    topic_sets: dict[str, set[str]],
) -> dict[str, Any]:
    node_by_id = {n["id"]: n for n in nodes}
    a_node = node_by_id.get(a_id)
    b_node = node_by_id.get(b_id)
    shared = sorted(topic_sets.get(a_id, set()) & topic_sets.get(b_id, set()))

    base = {
        "from": {
            "id": a_id,
            "name": a_node["name"] if a_node else a_id,
            "role": a_node["role"] if a_node else None,
        },
        "to": {
            "id": b_id,
            "name": b_node["name"] if b_node else b_id,
            "role": b_node["role"] if b_node else None,
        },
        "shared_topics": shared[:8],
    }

    if not a_node or not b_node:
        return {
            **base,
            "found": False,
            "kind": "none",
            "hops": [],
            "edges": [],
            "summary": "One or both people are not on the public map.",
        }

    if a_id == b_id:
        return {
            **base,
            "found": True,
            "kind": "real",
            "hops": [{"profile_id": a_id, "name": a_node["name"], "role": a_node["role"]}],
            "edges": [],
            "summary": f"{a_node['name']} is the same person — no bridge needed.",
        }

    def pack(path_tuples: list, kind: str) -> dict[str, Any]:
        # path_tuples from _bfs_path_clean
        hops = [
            {
                "profile_id": nid,
                "name": node_by_id[nid]["name"],
                "role": node_by_id[nid]["role"],
            }
            for nid in path_tuples["nodes"]
        ]
        edges = path_tuples["edges"]
        hop_names = " → ".join(h["name"] for h in hops)
        if kind == "real":
            summary = f"Recorded collaboration path: {hop_names}."
        elif kind == "mixed":
            summary = (
                f"Mixed path (recorded ties and topical similarity): {hop_names}."
            )
        else:
            summary = f"Topical similarity path (not recorded collaborators): {hop_names}."
        return {
            **base,
            "found": True,
            "kind": kind,
            "hops": hops,
            "edges": edges,
            "summary": summary,
        }

    real_path = _bfs_path_nodes(real_edges, a_id, b_id, max_depth=5)
    if real_path:
        return pack(real_path, "real")

    # Include all affinity edges already on the map (not only very strong ones),
    # so same-community topical bridges still surface.
    mixed_edges = real_edges + affinity_edges
    mixed_path = _bfs_path_nodes(mixed_edges, a_id, b_id, max_depth=5)
    if mixed_path:
        kinds = {e["type"] for e in mixed_path["edges"]}
        kind = "mixed" if "real" in kinds and "affinity" in kinds else (
            "real" if kinds == {"real"} else "affinity"
        )
        return pack(mixed_path, kind)

    shared_label = ", ".join(shared[:4]) if shared else "no overlapping topics"
    return {
        **base,
        "found": False,
        "kind": "none",
        "hops": [],
        "edges": [],
        "summary": (
            f"No bridge within 5 hops between {a_node['name']} and {b_node['name']}. "
            f"Shared topics: {shared_label}."
        ),
    }


def _bfs_path_nodes(
    edges: list[dict],
    start: str,
    end: str,
    max_depth: int = 5,
) -> dict[str, Any] | None:
    if start == end:
        return {"nodes": [start], "edges": []}

    adj = _adjacency(edges)
    queue: deque[str] = deque([start])
    parent: dict[str, tuple[str, dict]] = {}
    visited = {start}

    while queue:
        current = queue.popleft()
        depth = 0
        walk = current
        while walk in parent:
            depth += 1
            walk = parent[walk][0]
            if depth > max_depth:
                break
        if depth >= max_depth:
            continue
        for neighbour, edge in adj.get(current, []):
            if neighbour in visited:
                continue
            visited.add(neighbour)
            parent[neighbour] = (current, edge)
            if neighbour == end:
                nodes_path = [end]
                edges_path: list[dict] = []
                node = end
                while node != start:
                    prev, e = parent[node]
                    edges_path.append(
                        {
                            "id": e["id"],
                            "source": e["source"],
                            "target": e["target"],
                            "type": e["type"],
                            "kind": e.get("kind"),
                            "weight": e.get("weight"),
                        }
                    )
                    nodes_path.append(prev)
                    node = prev
                nodes_path.reverse()
                edges_path.reverse()
                return {"nodes": nodes_path, "edges": edges_path}
            queue.append(neighbour)
    return None

def build_knowledge_map(
    db: Session,
    *,
    focus_id: str | None = None,
    challenge_id: str | None = None,
    query: str | None = None,
    lens: str | None = None,
    show_affinity: bool = False,
    community: str | None = None,
    path_a: str | None = None,
    path_b: str | None = None,
) -> dict[str, Any]:
    nodes, profile_by_id, topic_sets = _build_nodes(db)
    profile_ids = {n["id"] for n in nodes}
    role_lens = _parse_role_lens(lens)

    real = _real_edges(db, profile_ids, profile_by_id)
    affinity = _affinity_edges(nodes, topic_sets)

    challenge: Challenge | None = None
    if challenge_id:
        challenge = db.query(Challenge).filter(Challenge.id == challenge_id).first()

    communities = sorted({n["community"] for n in nodes})
    community_name = _resolve_community_name(community, communities)

    # Mode priority: bridge > community > focus > landscape
    path_view: dict[str, Any] | None = None
    if path_a and path_b:
        mode = "bridge"
        path_view = find_bridge_path(nodes, real, affinity, path_a, path_b, topic_sets)
    elif community_name and not focus_id:
        mode = "community"
    elif focus_id:
        mode = "focus"
    else:
        mode = "landscape"

    focus_node = next((n for n in nodes if n["id"] == focus_id), None) if focus_id else None

    # Search / lens attention
    attention_ids: set[str] | None = None
    if query or role_lens:
        matched = _filter_nodes(nodes, query=query, role_lens=role_lens)
        attention_ids = {n["id"] for n in matched}

    for n in nodes:
        n["highlighted"] = attention_ids is None or n["id"] in attention_ids
        n["dimmed"] = attention_ids is not None and n["id"] not in attention_ids
        n["in_focus_neighbourhood"] = True
        n["on_path"] = False

    focus_payload: dict[str, Any] | None = None
    community_view: dict[str, Any] | None = None
    visible_affinity = affinity if (show_affinity or mode in ("focus", "community", "bridge") or bool(query)) else []

    if mode == "bridge" and path_view:
        path_ids = {h["profile_id"] for h in path_view.get("hops") or []}
        path_edge_ids = {e["id"] for e in path_view.get("edges") or []}
        for n in nodes:
            on_path = n["id"] in path_ids
            n["on_path"] = on_path
            n["highlighted"] = on_path or n["id"] in {path_a, path_b}
            n["dimmed"] = not on_path if path_view.get("found") else False
            n["in_focus_neighbourhood"] = not n["dimmed"]
        # Show path edges + keep real edges for context; affinity only on path
        path_edges = path_view.get("edges") or []
        visible_affinity = [e for e in affinity if e["id"] in path_edge_ids]
        # Ensure path edges are in the graph even if filtered
        real_ids = {e["id"] for e in real}
        extra = [e for e in path_edges if e["id"] not in real_ids and e.get("type") == "real"]
        real = real + extra
        insights = []
        if path_view.get("shared_topics"):
            insights.append(
                {
                    "id": f"path-shared-{path_a}-{path_b}",
                    "type": "path_context",
                    "code": "shared_topics",
                    "tone": "positive",
                    "shared_topics": path_view["shared_topics"],
                    "message": path_view.get("summary") or "",
                }
            )

    elif mode == "community" and community_name:
        for n in nodes:
            in_c = n["community"] == community_name
            n["highlighted"] = in_c
            n["dimmed"] = not in_c
            n["in_focus_neighbourhood"] = in_c
        member_ids = {n["id"] for n in nodes if n["community"] == community_name}
        visible_affinity = [
            e
            for e in affinity
            if e["source"] in member_ids and e["target"] in member_ids
        ]
        community_view = _build_community_view(nodes, real, community_name)
        insights = community_view.get("insights") or []

    elif mode == "focus" and focus_node:
        real_neighbours: set[str] = set()
        for e in real:
            if e["source"] == focus_id:
                real_neighbours.add(e["target"])
            elif e["target"] == focus_id:
                real_neighbours.add(e["source"])

        affinity_neighbours: list[tuple[float, str]] = []
        for e in affinity:
            other = None
            if e["source"] == focus_id:
                other = e["target"]
            elif e["target"] == focus_id:
                other = e["source"]
            if other:
                affinity_neighbours.append((e["weight"], other))
        affinity_neighbours.sort(key=lambda row: -row[0])
        top_affinity_ids = {nid for _, nid in affinity_neighbours[:NEIGHBOURHOOD_HOPS_AFFINITY]}

        neighbourhood_ids = {focus_id} | real_neighbours | top_affinity_ids
        community = focus_node["community"]
        for n in nodes:
            in_focus = n["id"] in neighbourhood_ids or n["community"] == community
            n["in_focus_neighbourhood"] = in_focus
            n["dimmed"] = not in_focus
            n["highlighted"] = n["id"] == focus_id or n["id"] in real_neighbours

        visible_affinity = [
            e
            for e in affinity
            if e["source"] == focus_id
            or e["target"] == focus_id
            or (
                e["source"] in neighbourhood_ids
                and e["target"] in neighbourhood_ids
                and e["weight"] >= 0.45
            )
        ]

        profile = profile_by_id[focus_id]
        edge_by_neighbour: dict[str, dict] = {}
        for e in real:
            if e["source"] == focus_id:
                edge_by_neighbour[e["target"]] = e
            elif e["target"] == focus_id:
                edge_by_neighbour[e["source"]] = e

        collaborator_nodes: list[dict] = []
        for n in nodes:
            if n["id"] not in real_neighbours:
                continue
            edge = edge_by_neighbour.get(n["id"]) or {}
            prov = edge.get("provenance") or {}
            papers = list(prov.get("papers") or [])
            shared_publications = []
            if papers:
                for paper in papers:
                    doi = paper.get("doi")
                    pmid = paper.get("pmid")
                    title = paper.get("title") or (
                        f"DOI {doi}" if doi else (f"PMID {pmid}" if pmid else "Shared work")
                    )
                    url = paper.get("url")
                    if not url and doi:
                        url = f"https://doi.org/{doi}"
                    elif not url and pmid:
                        url = f"https://pubmed.ncbi.nlm.nih.gov/{pmid}/"
                    shared_publications.append(
                        {
                            "doi": doi,
                            "pmid": pmid,
                            "title": title,
                            "url": url,
                            "year": paper.get("year"),
                        }
                    )
            else:
                # Backward-compatible provenance without papers[]
                dois = list(prov.get("dois") or [])
                if not dois and prov.get("doi"):
                    dois = [prov["doi"]]
                pmids = list(prov.get("pmids") or [])
                if not pmids and prov.get("pmid"):
                    pmids = [prov["pmid"]]
                titles = list(prov.get("titles") or [])
                if not titles and prov.get("title"):
                    titles = [prov["title"]]
                n = max(len(dois), len(pmids), 1 if titles else 0)
                for i in range(n):
                    doi = dois[i] if i < len(dois) else None
                    pmid = pmids[i] if i < len(pmids) else None
                    title = (
                        titles[i]
                        if i < len(titles)
                        else (titles[0] if titles else (f"DOI {doi}" if doi else f"PMID {pmid}"))
                    )
                    url = (
                        f"https://doi.org/{doi}"
                        if doi
                        else (f"https://pubmed.ncbi.nlm.nih.gov/{pmid}/" if pmid else None)
                    )
                    shared_publications.append(
                        {"doi": doi, "pmid": pmid, "title": title, "url": url}
                    )
            collaborator_nodes.append(
                {
                    **n,
                    "shared_publications": shared_publications,
                    "shared_count": prov.get("shared_count") or len(shared_publications),
                }
            )

        nearby_expertise = [
            n for n in nodes if n["id"] in top_affinity_ids and n["id"] not in real_neighbours
        ]

        focus_payload = {
            "profile_id": focus_id,
            "name": focus_node["name"],
            "title": focus_node["title"],
            "role": focus_node["role"],
            "identity_facets": focus_node.get("identity_facets") or [],
            "career_level": focus_node.get("career_level"),
            "institution_name": focus_node.get("institution_name"),
            "specialty_area": focus_node["specialty_area"],
            "topics": focus_node["topics"],
            "community": focus_node["community"],
            "collaborators": collaborator_nodes,
            "nearby_expertise": nearby_expertise,
            "projects": _projects_for_profile(db, profile),
            "has_real_collaborations": len(collaborator_nodes) > 0,
            "challenge": (
                {
                    "id": challenge.id,
                    "title": challenge.title,
                    "specialty_area": challenge.specialty_area,
                }
                if challenge
                else None
            ),
            "empty_collaborations_message": (
                None
                if collaborator_nodes
                else "No recorded collaborations yet — here is the topical neighbourhood."
            ),
        }

        insights = _focus_insights(
            focus_node, [focus_node] + collaborator_nodes + nearby_expertise, challenge
        )
    else:
        insights = _landscape_insights(nodes)
        if query:
            q = query.strip().lower()
            insights = [
                i
                for i in insights
                if q in (i.get("target_community") or "").lower()
                or q in i.get("message", "").lower()
            ] or insights[:2]

    edges = real + visible_affinity

    return {
        "mode": mode,
        "generated_at": None,
        "nodes": nodes,
        "edges": edges,
        "insights": insights,
        "focus": focus_payload,
        "community_view": community_view,
        "path_view": path_view,
        "communities": communities,
        "show_affinity": bool(
            show_affinity or mode in ("focus", "community", "bridge") or bool(query)
        ),
        "legend": {
            "roles": [
                {"role": role, "color": color, "label": role.replace("_", " ").title()}
                for role, color in ROLE_COLORS.items()
            ],
            "edges": [
                {
                    "type": "real",
                    "label": "Recorded collaboration",
                    "description": "ORCID co-authorship (shared publications by DOI)",
                },
                {
                    "type": "affinity",
                    "label": "Related expertise",
                    "description": "Shared topics — not collaborators",
                },
            ],
        },
        "query": query or None,
        "lens": role_lens,
        "community": community_name,
    }
