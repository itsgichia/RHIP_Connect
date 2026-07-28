# Data sources — PubMed vs OpenAlex

**Decision (this branch):** PubMed is the primary source for publications, seeding, and Knowledge Map co-author edges. OpenAlex is **not** used as a replacement for paper lists.

## What each source is for

| Goal | Source |
|------|--------|
| Paper list on a profile | **PubMed** |
| Who in RHIP co-authored with whom? | **PubMed** PMIDs → Knowledge Map |
| Which countries/institutions has this ORCID collaborated with? | OpenAlex (optional; not on this branch) |
| “Currently at UNSW” badge | ORCID (identity/affiliation; not PubMed or OpenAlex) |

They answer different questions:

- **PubMed:** “What papers did this person publish?”
- **OpenAlex:** “What field are they in, and who/where have they collaborated with?”

## How PubMed is used here

```mermaid
flowchart LR
  Manifest[researchers_manifest.json]
  PubMed[pubmed_service]
  Pubs[(Publication rows)]
  KMap[Knowledge Map]
  Manifest --> PubMed --> Pubs --> KMap
```

1. Seed loads [`data/researchers_manifest.json`](../data/researchers_manifest.json) — **real RHIP researchers only** (no `mock_profiles.json` filler).
2. [`Backend/app/services/pubmed_service.py`](../Backend/app/services/pubmed_service.py) fetches (or loads from [`data/pubmed_cache.json`](../data/pubmed_cache.json)) paper metadata.
3. [`Backend/app/seed.py`](../Backend/app/seed.py) stores `Publication` rows and updates profile publication counts.
4. [`Backend/app/services/map_service.py`](../Backend/app/services/map_service.py) builds **coauthor** edges when two seeded profiles share a PMID.

PubMed does **not** supply a world collaboration map, OpenAlex-style primary-field health filters, or a live UNSW employment badge.

## Why not switch to OpenAlex for publications

- RHIP is health-focused; PubMed is the biomedical literature index.
- This branch already depends on PubMed for seed data and Knowledge Map edges.
- Cached PubMed responses keep demos reliable offline (`PUBMED_MODE=cache` / `auto`).
- Replacing PubMed with OpenAlex for papers would break PMID-based coauthor edges unless that graph is rebuilt.

## OpenAlex (deferred)

OpenAlex + ORCID (see the `diva` branch) is useful for:

- Discovering researchers by ORCID and filtering by primary research field
- A **world** collaboration map (co-author countries/institutions)

If that map becomes a priority later, treat OpenAlex as an **extra** feature keyed by `orcid_id` — keep PubMed for paper lists and the internal Knowledge Map. Do not run two competing “where do papers come from?” pipelines.

## ARC / MRFF competitive grants (Investor Portal)

**Decision:** Curated grant IDs linked to seeded researchers; enrich at seed time on the backend. The React client never calls ARC or Health APIs directly.

| Funder | Machine access | How RHIP uses it |
|--------|----------------|------------------|
| **ARC** | Public NCGP API (no key): `https://dataportal.arc.gov.au/NCGP/API/grants` | [`grant_service.py`](../Backend/app/services/grant_service.py) fetches by grant code; cache in [`data/arc_grants_cache.json`](../data/arc_grants_cache.json) |
| **MRFF** | No public grants API; Health publishes [Excel recipients](https://www.health.gov.au/resources/publications/medical-research-future-fund-mrff-grant-recipients) | Curated rows in [`data/mrff_grants_cache.json`](../data/mrff_grants_cache.json); each `grant_url` must be a GrantConnect award page (`/Ga/Show/<uuid>`) that shows the matching `MRF…` internal reference — never search (`/Ga/List?Keyword=…`) or news placeholders |

```mermaid
flowchart LR
  Manifest[grants_manifest.json]
  ArcAPI[ARC NCGP API]
  MrffCache[mrff_grants_cache.json]
  GrantSvc[grant_service]
  Projects[(Project rows)]
  Investor[Investor Pipeline]
  Manifest --> GrantSvc
  ArcAPI --> GrantSvc
  MrffCache --> GrantSvc
  GrantSvc --> Projects --> Investor
```

1. [`data/grants_manifest.json`](../data/grants_manifest.json) lists grant IDs, funder (`arc` / `mrff`), lead researcher email, and investor overlay (TRL, specialty, impact).
2. Seed calls `enrich_manifest_entry` → creates `Project` rows with `funder`, `grant_id`, `grant_url`.
3. Investor overview/pipeline expose those fields (badges, funder filter, competitive-grants callout).
4. **There is no `mock_projects.json` pipeline** — investable projects are grant-backed only.

Modes: `GRANT_MODE=auto` (default) | `cache` | `live` — same idea as PubMed. Prefer cache for demos.
