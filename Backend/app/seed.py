import json
import os
from datetime import date, datetime

from app.auth import hash_password
from app.database import Base, SessionLocal, engine
from app.identity import (
    access_role_from_facets,
    derive_career_level,
    derive_facets_from_seed,
    validate_primary_lens,
)
from app.profile_extras import build_profile_extras
from app.services.grant_service import (
    enrich_manifest_entry,
    load_cache,
    resolve_grant_mode,
    save_cache,
)
from app.services.pubmed_service import (
    fetch_or_load_publications,
    load_cache as load_pubmed_cache,
    save_cache as save_pubmed_cache,
    _resolve_pubmed_mode,
)
from app.trl import readiness_from_trl
from app.models import (
    AIMatch,
    Challenge,
    ChallengeStatus,
    ClinicalService,
    CommunitySpecialist,
    CpdCategory,
    Event,
    EventType,
    Facility,
    HealthDistrict,
    Institution,
    InstitutionType,
    KPI,
    KPICategory,
    ParticipantRole,
    PassportEntry,
    Profile,
    Project,
    ProjectFunder,
    Publication,
    Readiness,
    RewardTier,
    RewardTierLevel,
    Role,
    ServiceTeamMember,
    Thread,
    ThreadParticipant,
    ThreadStatus,
    User,
    Visibility,
)

DATA_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "data")

SPECIALTY_AREAS = [
    "Mental Health & Neuroscience",
    "Personalised Medicine",
    "Rare Diseases",
    "Health Systems",
]

INSTITUTION_MAP = {
    "UNSW Sydney": (InstitutionType.UNIVERSITY, 40),
    "SESLHD": (InstitutionType.HOSPITAL, 40),
    "SCHN": (InstitutionType.HOSPITAL, 20),
    "Black Dog Institute": (InstitutionType.MRI, None),
    "The George Institute": (InstitutionType.MRI, None),
    "Children's Cancer Institute": (InstitutionType.MRI, None),
    "NeuRA": (InstitutionType.MRI, None),
    "Pacific VC": (InstitutionType.INDUSTRY, None),
}

# Seeded collaborations among real researchers (knowledge-map edges).
CROSS_DISCIPLINARY_THREADS = [
    ("c.loo@unsw.edu.au", "p.mitchell@unsw.edu.au"),
    ("h.christensen@unsw.edu.au", "a.wernerseidler@unsw.edu.au"),
    ("d.ziegler@unsw.edu.au", "m.haber@ccia.org.au"),
    ("k.anstey@unsw.edu.au", "h.brodaty@unsw.edu.au"),
    ("b.neal@georgeinstitute.org.au", "a.patel@georgeinstitute.org.au"),
    ("p.sachdev@unsw.edu.au", "g.halliday@neura.edu.au"),
    ("r.bryant@unsw.edu.au", "s.harvey@unsw.edu.au"),
    ("c.sue@neura.edu.au", "p.schofield@neura.edu.au"),
    ("l.jorm@unsw.edu.au", "v.perkovic@unsw.edu.au"),
    ("m.teesson@unsw.edu.au", "k.boydell@unsw.edu.au"),
    ("j.newby@unsw.edu.au", "a.wernerseidler@unsw.edu.au"),
    ("c.wakefield@unsw.edu.au", "d.ziegler@unsw.edu.au"),
    ("v.macefield@unsw.edu.au", "c.weickert@neura.edu.au"),
]

# No pre-seeded challenges — users post their own from the Challenge Board.
CROSS_DISCIPLINARY_CHALLENGES = []


def _load_json(filename: str) -> list:
    path = os.path.join(DATA_DIR, filename)
    with open(path) as f:
        return json.load(f)


def _add_profile(db, institutions: dict, profile_data: dict) -> Profile:
    inst_name = profile_data.get("institution", "UNSW Sydney")
    if inst_name not in institutions:
        inst = Institution(name=inst_name, type=InstitutionType.MRI)
        db.add(inst)
        db.flush()
        institutions[inst_name] = inst

    fallback_role = Role.RESEARCHER if profile_data.get("role") == "researcher" else Role.CLINICIAN
    extras = build_profile_extras(profile_data)
    facets = derive_facets_from_seed(profile_data)
    # Clinical researchers (e.g. Colleen Loo) need CLINICIAN access for CPD / MyCPD.
    role = access_role_from_facets(facets, fallback=fallback_role)
    user = User(
        name=profile_data["name"],
        email=profile_data["email"],
        password_hash=hash_password("DemoPass1!"),
        role=role,
        institution_id=institutions[inst_name].id,
        specialty_area=profile_data["specialty_area"],
        is_verified=True,
        is_active=True,
    )
    db.add(user)
    db.flush()
    primary = validate_primary_lens(facets, profile_data.get("primary_lens"))
    career = derive_career_level(profile_data)
    orcid_id = profile_data.get("orcid_id")
    profile = Profile(
        user_id=user.id,
        name=profile_data["name"],
        title=profile_data["title"],
        specialty_area=profile_data["specialty_area"],
        expertise_tags=profile_data["expertise_tags"],
        skills=profile_data.get("skills") or [],
        bio=profile_data["bio"],
        publications=profile_data.get("publications", 0),
        active_projects=profile_data.get("active_projects", 1),
        patents=extras["patents"],
        news=extras["news"],
        awards=extras["awards"],
        is_public=True,
        identity_facets=facets,
        primary_lens=primary,
        professional_title=profile_data.get("professional_title"),
        career_level=career,
        orcid_id=orcid_id,
        orcid_checked=bool(orcid_id),
    )
    db.add(profile)
    db.flush()
    return profile


# Real student login for demos (not fictional directory filler).
REAL_STUDENT_PROFILES = [
    {
        "name": "Gichia Muiruri",
        "email": "z5580775@ad.unsw.edu.au",
        "title": "PhD Student",
        "specialty_area": "Health Systems",
        "expertise_tags": [
            "Digital health",
            "Research collaboration platforms",
            "Health innovation",
            "Precinct networks",
        ],
        "skills": ["Python", "React", "Product design", "Stakeholder research"],
        "bio": (
            "PhD student at UNSW Sydney working on digital collaboration tooling for the "
            "Randwick Health & Innovation Precinct. Interested in how clinicians, researchers, "
            "and industry partners find each other and turn ideas into translation pathways."
        ),
        "publications": 0,
        "active_projects": 1,
        "institution": "UNSW Sydney",
        "role": "researcher",
        "identity_facets": ["researcher"],
        "primary_lens": "researcher",
        "career_level": "student",
    },
]

# Real professional/technical staff (biostatistics, data science, bioinformatics)
# sourced from UNSW / CBDRH / NeuRA-linked / Children's Cancer Institute public profiles.
PROFESSIONAL_TECHNICAL_REAL = [
    {
        "name": "Dr. Sanja Lujic",
        "email": "s.lujic@unsw.edu.au",
        "title": "Senior Lecturer in Biostatistics",
        "specialty_area": "Health Systems",
        "expertise_tags": [
            "Biostatistics",
            "Linked administrative data",
            "Health services research",
            "Multimorbidity",
            "Population ageing",
        ],
        "skills": [
            "Biostatistics",
            "Data linkage",
            "Statistical modelling",
            "R",
            "SAS",
            "Health data curation",
        ],
        "bio": (
            "Senior Lecturer in Biostatistics and Director of Teaching at the Centre for Big Data "
            "Research in Health (CBDRH), UNSW Sydney (Randwick). Experienced biostatistician "
            "specialising in linked administrative health datasets, multimorbidity, and teaching "
            "in the Master of Science in Health Data Science."
        ),
        "publications": 76,
        "active_projects": 3,
        "institution": "UNSW Sydney",
        "role": "researcher",
        "identity_facets": ["professional_technical", "researcher"],
        "primary_lens": "professional_technical",
        "professional_title": "Biostatistician",
        "career_level": "mid",
        "pubmed_query": "Lujic S[Author] AND UNSW[Affiliation]",
        "news": [
            {
                "title": "Centre for Big Data Research in Health — Health Data Science",
                "date": "2025-06-01",
                "summary": (
                    "Dr Lujic convenes postgraduate health data science teaching and linked-data "
                    "methods at CBDRH within the Randwick precinct."
                ),
                "url": "https://research.unsw.edu.au/people/dr-sanja-lujic",
            }
        ],
    },
    {
        "name": "Dr. Heidi Welberry",
        "email": "h.welberry@unsw.edu.au",
        "title": "Lecturer in Data Science and Biostatistics",
        "specialty_area": "Mental Health & Neuroscience",
        "expertise_tags": [
            "Biostatistics",
            "Dementia",
            "Aged care",
            "Linked data",
            "Health services research",
            "Primary care",
        ],
        "skills": [
            "Data science",
            "Biostatistics",
            "Linked administrative data",
            "Epidemiology",
            "R",
            "Care-pathway analytics",
        ],
        "bio": (
            "Lecturer specialising in data science and biostatistics at the Centre for Big Data "
            "Research in Health and the Centre for Healthy Brain Ageing (CHeBA), UNSW Sydney. "
            "Collaborates on dementia prevention and care projects across CHeBA and Neuroscience "
            "Research Australia (NeuRA) in the Randwick precinct."
        ),
        "publications": 25,
        "active_projects": 2,
        "institution": "UNSW Sydney",
        "role": "researcher",
        "identity_facets": ["professional_technical", "researcher"],
        "primary_lens": "professional_technical",
        "professional_title": "Data scientist / biostatistician",
        "career_level": "ecr",
        "pubmed_query": "Welberry H[Author] AND (UNSW[Affiliation] OR NeuRA[Affiliation] OR CHeBA[Affiliation])",
        "news": [
            {
                "title": "CHeBA / NeuRA dementia data collaboration",
                "date": "2025-03-01",
                "summary": (
                    "Dr Welberry applies linked data and biostatistics to dementia prevention and "
                    "aged-care pathways across CBDRH, CHeBA and NeuRA."
                ),
                "url": "https://research.unsw.edu.au/people/dr-heidi-jane-welberry",
            }
        ],
    },
    {
        "name": "Prof. Mark Cowley",
        "email": "m.cowley@ccia.org.au",
        "title": "Deputy Director, Enabling Platforms & Collaboration",
        "specialty_area": "Rare Diseases",
        "expertise_tags": [
            "Bioinformatics",
            "Computational biology",
            "Genomics",
            "Precision medicine",
            "Childhood cancer",
            "Multi-omics",
        ],
        "skills": [
            "Bioinformatics",
            "Whole genome sequencing analysis",
            "RNA-seq",
            "Pipeline engineering",
            "Clinical genomics informatics",
            "Python",
        ],
        "bio": (
            "Professor Mark Cowley is Deputy Director (Enabling Platforms and Collaboration) at "
            "Children's Cancer Institute and Group Leader, Computational Biology, based at the "
            "Randwick Health & Innovation Precinct. He leads genome informatics and data platforms "
            "for Australia's Zero Childhood Cancer program, translating multi-omics analytics into "
            "clinical diagnostics for children with cancer."
        ),
        "publications": 120,
        "active_projects": 5,
        "institution": "Children's Cancer Institute",
        "role": "researcher",
        "identity_facets": ["professional_technical", "researcher"],
        "primary_lens": "professional_technical",
        "professional_title": "Computational biologist / bioinformatician",
        "career_level": "senior",
        "pubmed_query": "Cowley MJ[Author] AND (Children's Cancer[Affiliation] OR UNSW[Affiliation])",
        "news": [
            {
                "title": "Zero Childhood Cancer — genomics and bioinformatics",
                "date": "2025-05-01",
                "summary": (
                    "Prof. Cowley leads computational biology enabling platforms for ZERO at "
                    "Children's Cancer Institute in Randwick."
                ),
                "url": "https://www.ccia.org.au/about-cci/our-people/mark-cowley",
            }
        ],
        "awards": [
            {
                "title": "Good Design Award — ZeroDash precision medicine platform",
                "year": 2023,
                "organisation": "Good Design Australia",
            }
        ],
    },
]

# Real policy / health-systems people (HIA, equity, workplace MH policy translation)
# sourced from UNSW / Black Dog / LHD partnership public profiles.
POLICY_REAL = [
    {
        "name": "A/Prof. Fiona Haigh",
        "email": "f.haigh@unsw.edu.au",
        "title": "Associate Professor; Health Equity Academic Advisor",
        "specialty_area": "Health Systems",
        "expertise_tags": [
            "Health impact assessment",
            "Health equity",
            "Health policy",
            "Social determinants of health",
            "Human rights and health",
            "Climate and health",
        ],
        "skills": [
            "Health Impact Assessment (HIA)",
            "Equity-focused policy appraisal",
            "Stakeholder co-governance",
            "Health systems evaluation",
            "Policy translation",
            "Capacity building",
        ],
        "bio": (
            "Associate Professor at the International Centre for Future Health Systems, UNSW Sydney, "
            "and Health Equity Academic Advisor to Sydney Local Health District. Internationally "
            "recognised for Health Impact Assessment and embedding health equity into policy, "
            "planning and governance — including equity frameworks for Local Health Districts and "
            "NSW Health, and prior HIA capacity building with SESLHD."
        ),
        "publications": 60,
        "active_projects": 4,
        "institution": "UNSW Sydney",
        "role": "researcher",
        "identity_facets": ["policy", "researcher"],
        "primary_lens": "policy",
        "professional_title": "Health equity / policy advisor",
        "career_level": "senior",
        "pubmed_query": "Haigh F[Author] AND UNSW[Affiliation]",
        "news": [
            {
                "title": "Equity-focused HIA informing LHD and NSW Health policy",
                "date": "2025-04-01",
                "summary": (
                    "A/Prof. Haigh develops equity frameworks and HIA tools used across Local "
                    "Health Districts, with statewide NSW Health implementation planned."
                ),
                "url": "https://research.unsw.edu.au/people/associate-professor-fiona-anne-haigh",
            }
        ],
    },
    {
        "name": "Dr. Mark Deady",
        "email": "m.deady@unsw.edu.au",
        "title": "Senior Research Fellow; Workplace Mental Health Research Lead",
        "specialty_area": "Mental Health & Neuroscience",
        "expertise_tags": [
            "Workplace mental health",
            "Mental health policy",
            "Prevention and early intervention",
            "Digital mental health",
            "Substance use",
            "Knowledge translation",
        ],
        "skills": [
            "Policy translation",
            "Workplace mental health frameworks",
            "Digital intervention design",
            "Implementation research",
            "Clinical trial evaluation",
            "Stakeholder engagement",
        ],
        "bio": (
            "Senior Research Fellow at the Black Dog Institute (Randwick) and research lead for "
            "the Workplace Mental Health Research Program. Translates evidence on prevention and "
            "early intervention into guidance for employers and policymakers, including mentally "
            "healthy workplace frameworks used across high-risk workforces."
        ),
        "publications": 80,
        "active_projects": 3,
        "institution": "Black Dog Institute",
        "role": "researcher",
        "identity_facets": ["policy", "researcher"],
        "primary_lens": "policy",
        "professional_title": "Mental health policy / workplace MH lead",
        "career_level": "mid",
        "pubmed_query": "Deady M[Author] AND (Black Dog[Affiliation] OR UNSW[Affiliation])",
        "news": [
            {
                "title": "Mentally healthy workplace framework for employers and policymakers",
                "date": "2024-07-01",
                "summary": (
                    "Dr Deady co-authored a mentally healthy framework to guide employers and "
                    "policy makers, linking Black Dog research to workplace and system policy."
                ),
                "url": "https://research.unsw.edu.au/people/dr-mark-deady",
            }
        ],
    },
]


def _enrich_publications(db, profiles_by_email: dict[str, Profile], manifest: list[dict]) -> None:
    cache_path = os.path.join(DATA_DIR, "pubmed_cache.json")
    cache = load_pubmed_cache(cache_path)
    mode = _resolve_pubmed_mode()
    max_results = int(os.getenv("PUBMED_MAX_RESULTS", "8"))
    stats = {"cache": 0, "live": 0, "none": 0, "papers": 0}

    researchers_with_query = [
        e for e in manifest if e.get("pubmed_query") and e.get("email")
    ]
    missing = sum(1 for e in researchers_with_query if not cache.get(e["email"]))

    if mode == "auto":
        if missing:
            print(
                f"  PubMed (auto): {len(cache)} cached, fetching {missing} missing from NCBI..."
            )
        else:
            print(f"  PubMed (auto): all {len(researchers_with_query)} researchers cached")
    elif mode == "live":
        print(f"  PubMed (live): refreshing all {len(researchers_with_query)} researchers...")
    else:
        print(f"  PubMed (cache only): {len(cache)} researchers in cache")

    for entry in manifest:
        query = entry.get("pubmed_query")
        email = entry.get("email")
        if not query or not email:
            continue
        profile = profiles_by_email.get(email)
        if not profile:
            continue

        publications, source = fetch_or_load_publications(
            email=email,
            query=query,
            cache=cache,
            max_results=max_results,
            mode=mode,
        )
        stats[source] += 1
        stats["papers"] += len(publications)

        if source == "live":
            print(f"    + {len(publications)} papers for {entry['name']}")

        for pub in publications:
            db.add(Publication(
                profile_id=profile.id,
                pmid=pub.get("pmid"),
                title=pub.get("title", "Untitled"),
                journal=pub.get("journal", ""),
                year=pub.get("year"),
                authors=pub.get("authors", []),
                doi=pub.get("doi"),
                url=pub.get("url"),
                abstract=pub.get("abstract"),
            ))
        if publications:
            profile.publications = max(profile.publications, len(publications))

    save_pubmed_cache(cache_path, cache)
    print(
        f"  PubMed: {stats['papers']} papers "
        f"({stats['cache']} from cache, {stats['live']} live, {stats['none']} missing)"
    )


def _enrich_skills_from_publications(
    db, profiles_by_email: dict[str, Profile]
) -> None:
    """Fill empty skills/expertise from publication titles (and abstracts when present).

    Uses the same keyword extractor as the opt-in Suggest flow (mock heuristics at
    seed time so Railway seed stays fast). Live Anthropic suggestions still run
    via POST /directory/me/suggest-keywords when ANTHROPIC_API_KEY is set.
    """
    from app.services.ai_service import AIOrchestrator

    ai = AIOrchestrator()
    filled_skills = 0
    filled_tags = 0

    for profile in profiles_by_email.values():
        needs_skills = not (profile.skills or [])
        needs_tags = not (profile.expertise_tags or [])
        if not needs_skills and not needs_tags:
            continue

        pubs = (
            db.query(Publication)
            .filter(Publication.profile_id == profile.id)
            .order_by(Publication.year.desc())
            .limit(10)
            .all()
        )
        if not pubs:
            continue

        suggested = ai._mock_suggest_keywords(
            [
                {
                    "title": p.title,
                    "abstract": getattr(p, "abstract", None) or "",
                }
                for p in pubs
            ]
        )
        if needs_skills and suggested.get("skills"):
            profile.skills = suggested["skills"]
            filled_skills += 1
        if needs_tags and suggested.get("expertise_tags"):
            profile.expertise_tags = suggested["expertise_tags"]
            filled_tags += 1

    print(
        f"  Skills/tags from papers: {filled_skills} skills, "
        f"{filled_tags} expertise tag profiles filled"
    )


def _seed_grant_projects(db, users_by_email: dict[str, User]) -> int:
    """Create investable projects from curated ARC/MRFF grant IDs."""
    manifest_path = os.path.join(DATA_DIR, "grants_manifest.json")
    if not os.path.isfile(manifest_path):
        print("  Grants: no grants_manifest.json — skipping")
        return 0

    with open(manifest_path) as handle:
        manifest = json.load(handle)

    arc_path = os.path.join(DATA_DIR, "arc_grants_cache.json")
    mrff_path = os.path.join(DATA_DIR, "mrff_grants_cache.json")
    arc_cache = load_cache(arc_path)
    mrff_cache = load_cache(mrff_path)
    mode = resolve_grant_mode()
    stats = {"cache": 0, "live": 0, "none": 0, "seeded": 0}

    for entry in manifest:
        enriched, source = enrich_manifest_entry(
            entry,
            arc_cache=arc_cache,
            mrff_cache=mrff_cache,
            mode=mode,
        )
        stats[source] = stats.get(source, 0) + 1
        if not enriched:
            print(f"    ! grant {entry.get('grant_id')} missing ({source})")
            continue

        lead = users_by_email.get(enriched["lead_email"])
        if not lead or not lead.profile:
            print(f"    ! no lead user for {enriched.get('grant_id')} ({enriched['lead_email']})")
            continue

        funder = ProjectFunder(enriched["funder"])
        trl = int(enriched.get("trl") or 5)
        stage = int(enriched.get("stage") or max(4, min(trl, 10)))
        amount = float(enriched.get("announced_funding_amount") or 0)
        # Competitive grants are fully awarded; show modest additional raise room for EOIs.
        funding_goal = amount * 1.15 if amount else 1_000_000
        funding_raised = amount if amount else funding_goal * 0.45
        year = enriched.get("funding_year")
        started = date(int(year), 1, 1) if year else date(2021, 1, 1)

        scheme = enriched.get("scheme_name") or funder.value.upper()
        breakdown = [
            {
                "label": f"{scheme} award",
                "amount": round(funding_raised * 0.85),
                "description": f"Competitive {funder.value.upper()} funding ({enriched['grant_id']})",
            },
            {
                "label": "Partner / co-investment",
                "amount": round(funding_raised * 0.15),
                "description": "Institutional and partner contributions",
            },
        ]

        db.add(Project(
            title=enriched["title"],
            description=enriched["description"],
            stage=stage,
            specialty_area=enriched.get("specialty_area") or "Health Systems",
            readiness=Readiness(readiness_from_trl(trl)),
            trl=trl,
            visibility=Visibility(enriched.get("visibility") or "public"),
            lead_researcher_id=lead.id,
            clinical_partner_id=None,
            funding_goal=funding_goal,
            funding_raised=funding_raised,
            started_at=started,
            funding_breakdown=breakdown,
            impact_metrics=enriched.get("impact"),
            funder=funder,
            grant_id=enriched["grant_id"],
            grant_url=enriched.get("grant_url"),
        ))
        stats["seeded"] += 1
        print(f"    + {funder.value.upper()} {enriched['grant_id']} → {enriched['title'][:70]}")

    save_cache(arc_path, arc_cache)
    print(
        f"  Grants: {stats['seeded']} projects "
        f"(arc/mrff sources: {stats['cache']} cache, {stats['live']} live, {stats['none']} missing)"
    )
    return stats["seeded"]


# Demo CPD scans for clinician demos (Passport QR codes shown in the UI).
DEMO_CPD_ATTENDANCE = {
    "c.loo@unsw.edu.au": [
        "RHIP-SHOWCASE-2026",
        "RHIP-CONF-2026-04",
        "RHIP-WORKSHOP-2026-05",
    ],
}


def _seed_passport_attendance(db, users_by_email: dict[str, User]) -> int:
    """Attach demo passport scans + reward tiers for curated clinician accounts."""
    created = 0
    year = date.today().year
    total_events = db.query(Event).filter(Event.event_year == year).count()
    for email, qr_codes in DEMO_CPD_ATTENDANCE.items():
        user = users_by_email.get(email)
        if not user:
            continue
        attended = 0
        for qr_code in qr_codes:
            event = db.query(Event).filter(Event.qr_code == qr_code).first()
            if not event:
                continue
            exists = (
                db.query(PassportEntry)
                .filter(PassportEntry.user_id == user.id, PassportEntry.event_id == event.id)
                .first()
            )
            if exists:
                attended += 1
                continue
            db.add(PassportEntry(
                user_id=user.id,
                event_id=event.id,
                event_year=event.event_year,
                scanned_at=datetime.combine(event.date, datetime.min.time()),
            ))
            created += 1
            attended += 1
        if attended == 0:
            continue
        if attended >= total_events > 0:
            tier = RewardTierLevel.GOLD
        elif attended >= 6:
            tier = RewardTierLevel.SILVER
        elif attended >= 3:
            tier = RewardTierLevel.BRONZE
        else:
            tier = RewardTierLevel.NONE
        reward = db.query(RewardTier).filter(RewardTier.user_id == user.id).first()
        if not reward:
            reward = RewardTier(
                user_id=user.id,
                year=year,
                tier=tier,
                events_attended=attended,
                total_events_in_year=total_events,
                grant_awarded=tier == RewardTierLevel.GOLD,
            )
            db.add(reward)
        else:
            reward.year = year
            reward.tier = tier
            reward.events_attended = attended
            reward.total_events_in_year = total_events
            if tier == RewardTierLevel.GOLD:
                reward.grant_awarded = True
            reward.last_calculated = datetime.utcnow()
    return created


def sync_event_cpd_metadata() -> int:
    """Patch CPD fields on existing events from mock_events.json (by qr_code)."""
    events_data = _load_json("mock_events.json")
    db = SessionLocal()
    updated = 0
    try:
        for ev in events_data:
            event = db.query(Event).filter(Event.qr_code == ev["qr_code"]).first()
            if not event:
                continue
            # Only backfill defaults — do not overwrite admin-configured CPD metadata.
            if event.cpd_eligible or event.cpd_hours is not None or event.cpd_category is not None:
                continue
            if not ev.get("cpd_eligible"):
                continue
            cpd_category = ev.get("cpd_category")
            event.cpd_eligible = True
            event.cpd_hours = (
                float(ev["cpd_hours"]) if ev.get("cpd_hours") is not None else None
            )
            event.cpd_category = CpdCategory(cpd_category) if cpd_category else None
            event.cpd_notes = ev.get("cpd_notes")
            updated += 1
        db.commit()
    finally:
        db.close()
    return updated


def sync_clinician_access_roles() -> int:
    """Promote users with a clinician identity facet to CLINICIAN access role."""
    db = SessionLocal()
    updated = 0
    try:
        for profile in db.query(Profile).all():
            facets = profile.identity_facets or []
            if "clinician" not in facets:
                continue
            user = db.query(User).filter(User.id == profile.user_id).first()
            if not user or user.role in (Role.ADMIN, Role.INDUSTRY, Role.INVESTOR):
                continue
            if user.role != Role.CLINICIAN:
                user.role = Role.CLINICIAN
                updated += 1
        db.commit()
    finally:
        db.close()
    return updated


def sync_demo_cpd_attendance() -> int:
    """Backfill demo passport/CPD scans for curated clinician accounts on existing DBs."""
    db = SessionLocal()
    try:
        users_by_email = {u.email: u for u in db.query(User).all()}
        created = _seed_passport_attendance(db, users_by_email)
        db.commit()
        return created
    finally:
        db.close()


def seed():
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()

    try:
        institutions = {}
        for name, (itype, pct) in INSTITUTION_MAP.items():
            inst = Institution(name=name, type=itype, partner_pct=pct)
            db.add(inst)
            institutions[name] = inst
        db.flush()

        demo_users = [
            {
                "name": "Dr. Alex Rivera",
                "email": "clinician@rhip.edu.au",
                "password": "DemoPass1!",
                "role": Role.CLINICIAN,
                "institution": "SESLHD",
                "specialty_area": "Mental Health & Neuroscience",
                "title": "Consultant Psychiatrist",
                "expertise_tags": ["Depression", "Youth mental health", "Clinical trials"],
                "bio": "Clinical lead for treatment-resistant depression clinic at Prince of Wales Hospital.",
            },
            {
                "name": "Admin User",
                "email": "admin@rhip.edu.au",
                "password": "AdminPass1!",
                "role": Role.ADMIN,
                "institution": "UNSW Sydney",
                "specialty_area": None,
                "title": "Platform Administrator",
                "expertise_tags": [],
                "bio": "RHIP Connect platform administrator.",
            },
            {
                "name": "James Industry",
                "email": "james@medtechcorp.com.au",
                "password": "Industry1!",
                "role": Role.INDUSTRY,
                "institution": "UNSW Sydney",
                "specialty_area": None,
                "title": "Partnership Manager",
                "expertise_tags": [],
                "bio": "Industry partnership lead at MedTech Corp.",
            },
            {
                "name": "Sarah Chen",
                "email": "sarah@pacificvc.com.au",
                "password": "Investor1!",
                "role": Role.INVESTOR,
                "institution": "Pacific VC",
                "specialty_area": None,
                "title": "Investment Director",
                "expertise_tags": [],
                "bio": "Health and life sciences investor focused on precinct innovation.",
            },
        ]

        for du in demo_users:
            user = User(
                name=du["name"],
                email=du["email"],
                password_hash=hash_password(du["password"]),
                role=du["role"],
                institution_id=institutions[du["institution"]].id,
                specialty_area=du.get("specialty_area"),
                is_verified=True,
                is_active=True,
            )
            db.add(user)
            db.flush()
            extras = build_profile_extras(du)
            if du["role"] == Role.ADMIN:
                facets = []
            elif du["role"] in (Role.CLINICIAN, Role.RESEARCHER):
                facets = derive_facets_from_seed({
                    **du,
                    "role": "clinician" if du["role"] == Role.CLINICIAN else "researcher",
                })
                if du["role"] == Role.CLINICIAN and "researcher" not in facets:
                    # Demo clinician also engages in research trials
                    facets = ["clinician", "researcher"]
            else:
                # Industry / investor — account profile for My Profile, not directory discovery
                facets = []
            is_public = du["role"] in (Role.CLINICIAN, Role.RESEARCHER, Role.ADMIN)
            db.add(Profile(
                user_id=user.id,
                name=du["name"],
                title=du["title"],
                specialty_area=du.get("specialty_area") or (
                    "Investment" if du["role"] == Role.INVESTOR else "Health Systems"
                ),
                expertise_tags=du.get("expertise_tags") or [],
                bio=du.get("bio") or "",
                publications=du.get("publications", 0),
                active_projects=du.get("active_projects", 0),
                patents=extras["patents"],
                news=extras["news"],
                awards=extras["awards"],
                is_public=is_public,
                identity_facets=facets,
                primary_lens=facets[0] if facets else None,
                career_level=(
                    "senior" if du["role"] == Role.CLINICIAN
                    else ("mid" if du["role"] == Role.RESEARCHER else None)
                ),
            ))

        # Directory = real RHIP researchers + professional/technical + policy + student login.
        researchers_data = _load_json("researchers_manifest.json")
        profiles_data = (
            researchers_data
            + PROFESSIONAL_TECHNICAL_REAL
            + POLICY_REAL
            + REAL_STUDENT_PROFILES
        )
        profiles_by_email: dict[str, Profile] = {}

        for p in profiles_data:
            profile = _add_profile(db, institutions, p)
            profiles_by_email[p["email"]] = profile

        _enrich_publications(
            db,
            profiles_by_email,
            researchers_data + PROFESSIONAL_TECHNICAL_REAL + POLICY_REAL,
        )
        _enrich_skills_from_publications(db, profiles_by_email)

        admin = db.query(User).filter(User.email == "admin@rhip.edu.au").first()
        users_by_email = {u.email: u for u in db.query(User).all()}

        # Investable pipeline = real ARC/MRFF grants only (no mock_projects.json)
        grant_count = _seed_grant_projects(db, users_by_email)

        # Active collaboration threads (real edges on the knowledge map)
        for initiator_email, receiver_email in CROSS_DISCIPLINARY_THREADS:
            initiator = users_by_email.get(initiator_email)
            receiver = users_by_email.get(receiver_email)
            if not initiator or not receiver:
                continue
            thread = Thread(status=ThreadStatus.ACTIVE)
            db.add(thread)
            db.flush()
            db.add(ThreadParticipant(
                thread_id=thread.id,
                user_id=initiator.id,
                role=ParticipantRole.INITIATOR,
                accepted=True,
                joined_at=datetime.utcnow(),
            ))
            db.add(ThreadParticipant(
                thread_id=thread.id,
                user_id=receiver.id,
                role=ParticipantRole.RECEIVER,
                accepted=True,
                joined_at=datetime.utcnow(),
            ))

        # Clinical challenges with AI matches across disciplines
        for challenge_data in CROSS_DISCIPLINARY_CHALLENGES:
            poster = users_by_email.get(challenge_data["poster_email"])
            if not poster:
                continue
            challenge = Challenge(
                posted_by=poster.id,
                title=challenge_data["title"],
                description=challenge_data["description"],
                specialty_area=challenge_data["specialty_area"],
                status=ChallengeStatus.MATCHED,
            )
            db.add(challenge)
            db.flush()
            for rank, (match_email, score) in enumerate(
                zip(challenge_data["match_emails"], challenge_data["scores"]),
                start=1,
            ):
                match_user = users_by_email.get(match_email)
                if not match_user or not match_user.profile:
                    continue
                db.add(AIMatch(
                    challenge_id=challenge.id,
                    profile_id=match_user.profile.id,
                    score=score,
                    reasoning=(
                        f"Cross-disciplinary fit for '{challenge_data['title']}' "
                        f"based on overlapping expertise and precinct collaboration history."
                    ),
                    rank=rank,
                ))

        events_data = _load_json("mock_events.json")
        for ev in events_data:
            event_date = date.fromisoformat(ev["date"])
            cpd_eligible = bool(ev.get("cpd_eligible"))
            cpd_category = ev.get("cpd_category")
            db.add(Event(
                name=ev["name"],
                date=event_date,
                event_year=event_date.year,
                qr_code=ev["qr_code"],
                type=EventType(ev["type"]),
                created_by=admin.id,
                cpd_eligible=cpd_eligible,
                cpd_hours=float(ev["cpd_hours"]) if cpd_eligible and ev.get("cpd_hours") is not None else None,
                cpd_category=CpdCategory(cpd_category) if cpd_eligible and cpd_category else None,
                cpd_notes=ev.get("cpd_notes") if cpd_eligible else None,
            ))
        db.flush()

        # Demo CPD evidence for Colleen Loo (clinical psychiatrist demo account)
        _seed_passport_attendance(db, users_by_email)

        project_count = grant_count
        kpis = [
            ("active_innovation_projects", "Active Innovation Projects", project_count, f"{project_count}+", KPICategory.COMMERCIAL, ["investor", "all"], None),
            ("hth_occupancy", "HTH Occupancy Rate", 68, "68%", KPICategory.FACILITY, ["investor", "all"], "%"),
            ("industry_partnerships", "Industry Partnerships", 42, "42", KPICategory.COMMERCIAL, ["investor"], None),
            ("publications_year", "Research Publications per Year", 3200, "3,200+", KPICategory.RESEARCH, ["investor"], None),
            ("spinouts", "Spinouts Created", 12, "12", KPICategory.COMMERCIAL, ["investor"], None),
            ("patents_filed", "Patents Filed", 87, "87", KPICategory.COMMERCIAL, ["investor"], None),
            ("venture_funding", "Venture Funding Raised", 142, "$142M", KPICategory.COMMERCIAL, ["investor"], None),
            ("patient_interactions", "Patient Interactions per Year", 1800000, "1.8M+", KPICategory.CLINICAL, ["government", "community", "all"], None),
            ("workforce_pct", "Workforce in Health & Education", 40, "40%", KPICategory.CORE, ["government"], "%"),
            ("clinical_trials", "Active Clinical Trials", 156, "156", KPICategory.CLINICAL, ["government"], None),
            ("research_grants", "Research Grants Active", 89000000, "$89M", KPICategory.RESEARCH, ["government"], None),
            ("unsw_ranking", "International Research Network Ranking", 1, "#1 in Australia", KPICategory.RESEARCH, ["government"], None),
            ("hospital_beds", "Hospital Beds", 2400, "2,400+", KPICategory.CLINICAL, ["government"], None),
            ("allied_health", "Allied Health Professionals", 3200, "3,200", KPICategory.CLINICAL, ["government"], None),
            ("education_programs", "Education Programs Available", 48, "48", KPICategory.CORE, ["community"], None),
            ("community_events", "Community Health Events", 32, "32", KPICategory.CORE, ["community"], None),
            ("disciplines", "Healthcare Disciplines Represented", 35, "35", KPICategory.CLINICAL, ["community"], None),
            ("years_history", "Years of Health History", 168, "Since 1858", KPICategory.CORE, ["community"], None),
            ("volunteer_hours", "Community Volunteer Hours", 12000, "12,000+", KPICategory.CORE, ["community"], None),
            ("health_screenings", "Free Health Screenings", 8500, "8,500", KPICategory.CLINICAL, ["community"], None),
            ("research_members", "Research Community Members", 7000, "7,000+", KPICategory.RESEARCH, ["all"], None),
            ("campus_workforce", "Campus Workforce", 22000, "22,000", KPICategory.CORE, ["all"], None),
            ("infrastructure", "Infrastructure Investment", 1.5, "$1.5B", KPICategory.FACILITY, ["all"], None),
        ]
        for metric_name, label, value, display, category, audience, unit in kpis:
            db.add(KPI(
                metric_name=metric_name,
                display_label=label,
                value=value,
                display_value=display,
                category=category,
                audience=audience,
                period="2026",
                unit=unit,
                is_live=metric_name == "hth_occupancy",
            ))

        district = HealthDistrict(
            slug="seslhd-randwick",
            name="South Eastern Sydney — Randwick Campus",
            description=(
                "The Randwick Health & Innovation Precinct serves communities across "
                "South Eastern Sydney Local Health District, with major facilities at "
                "Prince of Wales Hospital, Sydney Children's Hospital, and the Health Translation Hub."
            ),
        )
        db.add(district)
        db.flush()

        facilities_by_slug = {}
        for f in _load_json("mock_facilities.json"):
            facility = Facility(
                slug=f["slug"],
                name=f["name"],
                address=f["address"],
                phone=f["phone"],
                description=f["description"],
                district_id=district.id,
            )
            db.add(facility)
            facilities_by_slug[f["slug"]] = facility
        db.flush()

        profiles_by_email = {}
        for prof in db.query(Profile).all():
            user = db.query(User).filter(User.id == prof.user_id).first()
            if user:
                profiles_by_email[user.email] = prof
        profiles_by_name = {p.name: p for p in db.query(Profile).all()}

        services_by_slug = {}
        for s in _load_json("mock_services.json"):
            service = ClinicalService(
                slug=s["slug"],
                name=s["name"],
                summary=s["summary"],
                description=s["description"],
                specialty=s["specialty"],
                contact_phone=s["contact_phone"],
                contact_email=s.get("contact_email", ""),
                contact_address=s.get("contact_address", ""),
                referral_info=s.get("referral_info", ""),
                patient_resources=s.get("patient_resources", []),
                district_id=district.id,
                facility_id=facilities_by_slug[s["facility_slug"]].id,
            )
            db.add(service)
            db.flush()
            services_by_slug[s["slug"]] = service

            for i, member in enumerate(s.get("team", [])):
                profile = profiles_by_name.get(member["name"])
                db.add(ServiceTeamMember(
                    service_id=service.id,
                    name=member["name"],
                    title=member.get("title", ""),
                    role=member.get("role", ""),
                    phone=member.get("phone", ""),
                    profile_id=profile.id if profile else None,
                    display_order=i,
                ))

        for sp in _load_json("mock_specialists.json"):
            profile = None
            if sp.get("profile_email"):
                profile = profiles_by_email.get(sp["profile_email"])
            if not profile:
                profile = profiles_by_name.get(sp["name"])

            db.add(CommunitySpecialist(
                slug=sp["slug"],
                name=sp["name"],
                title=sp.get("title", ""),
                specialties=sp.get("specialties", []),
                department=sp.get("department", ""),
                phone=sp.get("phone", ""),
                address=sp.get("address", ""),
                email=sp.get("email", ""),
                bio=sp.get("bio", ""),
                clinic_hours=sp.get("clinic_hours", ""),
                languages=sp.get("languages", []),
                accepting_referrals=sp.get("accepting_referrals", True),
                district_id=district.id,
                facility_id=facilities_by_slug[sp["facility_slug"]].id,
                service_id=services_by_slug[sp["service_slug"]].id if sp.get("service_slug") else None,
                profile_id=profile.id if profile else None,
            ))

        db.commit()
    finally:
        db.close()


if __name__ == "__main__":
    seed()
