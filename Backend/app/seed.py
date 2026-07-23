import json
import os
from datetime import date, datetime

from app.auth import hash_password
from app.database import Base, SessionLocal, engine
from app.identity import (
    derive_career_level,
    derive_facets_from_seed,
    validate_primary_lens,
)
from app.profile_extras import build_profile_extras
from app.services.pubmed_service import (
    fetch_or_load_publications,
    load_cache,
    save_cache,
    _resolve_pubmed_mode,
)
from app.trl import readiness_from_trl, trl_from_readiness
from app.models import (
    AIMatch,
    Challenge,
    ChallengeStatus,
    ClinicalService,
    CommunitySpecialist,
    Event,
    EventType,
    Facility,
    HealthDistrict,
    Institution,
    InstitutionType,
    KPI,
    KPICategory,
    ParticipantRole,
    Profile,
    Project,
    Publication,
    Readiness,
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

# Seeded collaborations that create real knowledge-map edges across disciplines.
CROSS_DISCIPLINARY_THREADS = [
    ("c.wakefield@unsw.edu.au", "sarah.okonjo@health.nsw.gov.au"),
    ("p.mitchell@unsw.edu.au", "rebecca.tan@schn.health.nsw.gov.au"),
    ("a.patel@georgeinstitute.org.au", "cameron.holloway@health.nsw.gov.au"),
    ("d.ziegler@unsw.edu.au", "isabelle.fontaine@schn.health.nsw.gov.au"),
    ("c.sue@neura.edu.au", "grace.mitchell@schn.health.nsw.gov.au"),
    ("a.wernerseidler@unsw.edu.au", "lisa.nguyen@schn.health.nsw.gov.au"),
    ("v.perkovic@unsw.edu.au", "anthony.joshua@health.nsw.gov.au"),
    ("l.jorm@unsw.edu.au", "omar.haddad@health.nsw.gov.au"),
    ("v.macefield@unsw.edu.au", "adrian.havryk@health.nsw.gov.au"),
    ("j.mattick@unsw.edu.au", "craig.haifer@health.nsw.gov.au"),
    ("c.loo@unsw.edu.au", "clinician@rhip.edu.au"),
    ("m.haber@ccia.org.au", "anthony.joshua@health.nsw.gov.au"),
    ("g.halliday@neura.edu.au", "marcus.webb@health.nsw.gov.au"),
    ("h.brodaty@unsw.edu.au", "marcus.webb@health.nsw.gov.au"),
]

CROSS_DISCIPLINARY_CHALLENGES = [
    {
        "poster_email": "clinician@rhip.edu.au",
        "title": "Need genomic psychiatry expertise for treatment-resistant cases",
        "description": (
            "Looking for researchers who can help design a rapid genomic workup "
            "pathway for complex mood and neurodevelopmental presentations."
        ),
        "specialty_area": "Mental Health & Neuroscience",
        "match_emails": [
            "p.mitchell@unsw.edu.au",
            "m.kavanagh@unsw.edu.au",
            "c.sue@neura.edu.au",
        ],
        "scores": [0.91, 0.84, 0.79],
    },
    {
        "poster_email": "isabelle.fontaine@schn.health.nsw.gov.au",
        "title": "Survivorship mental health support for paediatric oncology",
        "description": (
            "Seeking collaborators for a shared care model linking childhood cancer "
            "survivorship clinics with digital and liaison psychiatry services."
        ),
        "specialty_area": "Rare Diseases",
        "match_emails": [
            "c.wakefield@unsw.edu.au",
            "sarah.okonjo@health.nsw.gov.au",
            "a.wernerseidler@unsw.edu.au",
        ],
        "scores": [0.93, 0.88, 0.81],
    },
    {
        "poster_email": "michael.torres@health.nsw.gov.au",
        "title": "ED triage for rare disease and mental health presentations",
        "description": (
            "Need health systems and digital health partners to reduce bounce-backs "
            "for complex rare disease and youth mental health presentations."
        ),
        "specialty_area": "Health Systems",
        "match_emails": [
            "l.jorm@unsw.edu.au",
            "a.wernerseidler@unsw.edu.au",
            "lisa.nguyen@schn.health.nsw.gov.au",
        ],
        "scores": [0.89, 0.86, 0.82],
    },
]


def _load_json(filename: str) -> list:
    path = os.path.join(DATA_DIR, filename)
    with open(path) as f:
        return json.load(f)


def _project_funding(stage: int, index: int) -> tuple[float, float, date, list]:
    """Return funding_goal, funding_raised, started_at, and breakdown for a project."""
    base_goals = {
        4: 750_000,
        5: 1_200_000,
        6: 2_000_000,
        7: 3_500_000,
        8: 5_000_000,
        9: 8_000_000,
        10: 12_000_000,
    }
    goal = base_goals.get(stage, 1_000_000) * (1 + (index % 5) * 0.12)
    progress_ratios = [0.18, 0.32, 0.45, 0.58, 0.71, 0.84]
    raised = goal * progress_ratios[index % len(progress_ratios)]
    years_active = max(1, stage - 2 + (index % 3))
    started = date(2026, 6, 25).replace(year=2026 - years_active)

    categories = [
        ("Research & Development", 0.35, "Core R&D, prototyping, and validation studies"),
        ("Clinical Trials", 0.25, "Patient recruitment, trial sites, and monitoring"),
        ("Personnel", 0.20, "Research staff, clinicians, and project management"),
        ("Equipment & Infrastructure", 0.12, "Lab equipment, devices, and facility costs"),
        ("Commercialisation", 0.08, "Regulatory, IP, and go-to-market activities"),
    ]
    breakdown = [
        {
            "label": label,
            "amount": round(raised * share),
            "description": desc,
        }
        for label, share, desc in categories
    ]
    return goal, raised, started, breakdown


def _resolve_trl(proj: dict) -> int:
    if "trl" in proj:
        return int(proj["trl"])
    return trl_from_readiness(proj.get("readiness", "feasibility"), proj.get("stage", 5))


def _add_profile(db, institutions: dict, profile_data: dict) -> Profile:
    inst_name = profile_data.get("institution", "UNSW Sydney")
    if inst_name not in institutions:
        inst = Institution(name=inst_name, type=InstitutionType.MRI)
        db.add(inst)
        db.flush()
        institutions[inst_name] = inst

    role = Role.RESEARCHER if profile_data.get("role") == "researcher" else Role.CLINICIAN
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
    extras = build_profile_extras(profile_data)
    facets = derive_facets_from_seed(profile_data)
    primary = validate_primary_lens(facets, profile_data.get("primary_lens"))
    career = derive_career_level(profile_data)
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
    )
    db.add(profile)
    db.flush()
    return profile


PROFESSIONAL_TECHNICAL_DEMOS = [
    {
        "name": "Dr. Priya Nair",
        "email": "priya.nair@unsw.edu.au",
        "title": "Biostatistician",
        "specialty_area": "Health Systems",
        "expertise_tags": ["Biostatistics", "Clinical trial design", "Survival analysis"],
        "skills": ["Biostatistics", "Survival analysis", "Clinical trial design", "R", "Data visualisation"],
        "bio": "Biostatistician supporting RHIP clinical trials and registry analyses across SESLHD and UNSW.",
        "publications": 28,
        "active_projects": 3,
        "institution": "UNSW Sydney",
        "role": "researcher",
        "identity_facets": ["professional_technical", "researcher"],
        "primary_lens": "professional_technical",
        "professional_title": "Biostatistician",
        "career_level": "mid",
    },
    {
        "name": "Marcus Wei",
        "email": "marcus.wei@seslhd.health.nsw.gov.au",
        "title": "Clinical Registry Manager",
        "specialty_area": "Rare Diseases",
        "expertise_tags": ["Registry management", "Data governance", "Rare disease cohorts"],
        "skills": ["Registry management", "Data governance", "Data quality", "Cohort building"],
        "bio": "Manages multi-site clinical registries for rare disease programmes linked to Sydney Children's Hospital and RHIP partners.",
        "publications": 4,
        "active_projects": 2,
        "institution": "SESLHD",
        "role": "researcher",
        "identity_facets": ["professional_technical"],
        "primary_lens": "professional_technical",
        "professional_title": "Registry manager",
        "career_level": "mid",
    },
    {
        "name": "Aisha Rahman",
        "email": "aisha.rahman@unsw.edu.au",
        "title": "Health Data Scientist",
        "specialty_area": "Mental Health & Neuroscience",
        "expertise_tags": ["Data analysis", "Python", "Electronic medical records", "R", "Data visualisation"],
        "skills": ["Data analysis", "Data visualisation", "Python", "EMR analytics", "Dashboarding", "R"],
        "bio": "Data analyst embedded with CBDRH-linked projects, supporting clinicians and researchers with EMR-derived insights.",
        "publications": 6,
        "active_projects": 2,
        "institution": "UNSW Sydney",
        "role": "researcher",
        "identity_facets": ["professional_technical"],
        "primary_lens": "professional_technical",
        "professional_title": "Data analyst",
        "career_level": "ecr",
    },
    {
        "name": "Dr. Samira Okonkwo",
        "email": "samira.okonkwo@unsw.edu.au",
        "title": "Epidemiologist",
        "specialty_area": "Health Systems",
        "expertise_tags": [
            "Epidemiology",
            "Population health",
            "Surveillance",
            "Outbreak investigation",
            "Health equity",
        ],
        "skills": ["Epidemiology", "R", "Survey design", "GIS", "Causal inference"],
        "bio": (
            "Epidemiologist supporting RHIP population-health programmes, linking SESLHD "
            "surveillance data with UNSW translational research teams."
        ),
        "publications": 19,
        "active_projects": 3,
        "institution": "UNSW Sydney",
        "role": "researcher",
        "identity_facets": ["professional_technical", "researcher"],
        "primary_lens": "professional_technical",
        "professional_title": "Epidemiologist",
        "career_level": "mid",
    },
    {
        "name": "Dr. James Chen",
        "email": "james.chen@unsw.edu.au",
        "title": "Research Fellow",
        "specialty_area": "Personalised Medicine",
        "expertise_tags": [
            "Precision oncology",
            "Biomarker discovery",
            "Translational research",
            "Clinical genomics",
        ],
        "skills": ["Clinical genomics", "Grant writing", "Protocol design", "Stakeholder engagement"],
        "bio": (
            "Research Fellow bridging laboratory genomics and clinical oncology pathways "
            "across the Randwick precinct and Prince of Wales Hospital."
        ),
        "publications": 22,
        "active_projects": 2,
        "institution": "UNSW Sydney",
        "role": "researcher",
        "identity_facets": ["professional_technical", "researcher"],
        "primary_lens": "professional_technical",
        "professional_title": "Research fellow",
        "career_level": "ecr",
    },
    {
        "name": "Hannah Park",
        "email": "hannah.park@seslhd.health.nsw.gov.au",
        "title": "Clinical Trials Coordinator",
        "specialty_area": "Rare Diseases",
        "expertise_tags": [
            "Clinical trials",
            "GCP",
            "Participant recruitment",
            "Protocol compliance",
            "Rare disease cohorts",
        ],
        "skills": ["Trial coordination", "Ethics submissions", "REDCap", "Stakeholder liaison"],
        "bio": (
            "Coordinates multi-site rare-disease trials for SESLHD and Sydney Children's Hospital, "
            "connecting investigators with regulatory and ethics pathways."
        ),
        "publications": 3,
        "active_projects": 4,
        "institution": "SESLHD",
        "role": "researcher",
        "identity_facets": ["professional_technical"],
        "primary_lens": "professional_technical",
        "professional_title": "Clinical trials coordinator",
        "career_level": "mid",
    },
    {
        "name": "Dr. Noah Bergström",
        "email": "noah.bergstrom@unsw.edu.au",
        "title": "Health Economist",
        "specialty_area": "Health Systems",
        "expertise_tags": [
            "Health economics",
            "Cost-effectiveness",
            "HTA",
            "Value-based care",
            "Budget impact",
        ],
        "skills": ["Health economics", "Modelling", "R", "Evidence synthesis", "Policy briefing"],
        "bio": (
            "Health economist advising RHIP partners on cost-effectiveness and value-based "
            "care models for new diagnostics and digital pathways."
        ),
        "publications": 14,
        "active_projects": 2,
        "institution": "UNSW Sydney",
        "role": "researcher",
        "identity_facets": ["professional_technical", "researcher"],
        "primary_lens": "professional_technical",
        "professional_title": "Health economist",
        "career_level": "mid",
    },
    {
        "name": "Mei Lin Zhao",
        "email": "mei.zhao@unsw.edu.au",
        "title": "Bioinformatician",
        "specialty_area": "Rare Diseases",
        "expertise_tags": [
            "Bioinformatics",
            "Variant interpretation",
            "Rare disease genomics",
            "Pipeline development",
        ],
        "skills": ["Python", "Nextflow", "Variant calling", "SQL", "Data pipelines"],
        "bio": (
            "Bioinformatician building analysis pipelines for rare-disease genomics programmes "
            "shared across UNSW and Sydney Children's Hospital Network."
        ),
        "publications": 8,
        "active_projects": 3,
        "institution": "UNSW Sydney",
        "role": "researcher",
        "identity_facets": ["professional_technical"],
        "primary_lens": "professional_technical",
        "professional_title": "Bioinformatician",
        "career_level": "ecr",
    },
]

# Policy / health-system governance demos — identity_facets include policy
POLICY_DEMOS = [
    {
        "name": "Dr. Lauren Whitfield",
        "email": "lauren.whitfield@health.nsw.gov.au",
        "title": "Senior Policy Advisor",
        "specialty_area": "Health Systems",
        "expertise_tags": [
            "Health policy",
            "System reform",
            "Workforce planning",
            "Intergovernmental liaison",
        ],
        "skills": ["Policy analysis", "Stakeholder engagement", "Briefing", "Evaluation design"],
        "bio": (
            "Senior policy advisor linking NSW Health system reform priorities with RHIP "
            "research and clinical translation programmes."
        ),
        "publications": 5,
        "active_projects": 2,
        "institution": "NSW Health",
        "role": "researcher",
        "identity_facets": ["policy"],
        "primary_lens": "policy",
        "career_level": "senior",
    },
    {
        "name": "Omar Haddad",
        "email": "omar.haddad@unsw.edu.au",
        "title": "Health Policy Analyst",
        "specialty_area": "Mental Health & Neuroscience",
        "expertise_tags": [
            "Mental health policy",
            "Service redesign",
            "Lived-experience engagement",
            "Implementation science",
        ],
        "skills": ["Policy analysis", "Qualitative research", "Co-design", "Evidence synthesis"],
        "bio": (
            "Policy analyst focused on mental health service redesign, working across UNSW, "
            "Black Dog Institute, and SESLHD planning teams."
        ),
        "publications": 7,
        "active_projects": 2,
        "institution": "UNSW Sydney",
        "role": "researcher",
        "identity_facets": ["policy", "researcher"],
        "primary_lens": "policy",
        "career_level": "mid",
    },
    {
        "name": "Dr. Fiona Kelleher",
        "email": "fiona.kelleher@seslhd.health.nsw.gov.au",
        "title": "Director of Clinical Governance",
        "specialty_area": "Rare Diseases",
        "expertise_tags": [
            "Clinical governance",
            "Patient safety",
            "Quality improvement",
            "Rare disease pathways",
        ],
        "skills": ["Clinical governance", "Risk management", "Quality frameworks", "Policy drafting"],
        "bio": (
            "Leads clinical governance for rare-disease pathways across SESLHD, aligning "
            "hospital policy with RHIP research translation."
        ),
        "publications": 9,
        "active_projects": 1,
        "institution": "SESLHD",
        "role": "researcher",
        "identity_facets": ["policy", "clinician"],
        "primary_lens": "policy",
        "career_level": "executive",
    },
    {
        "name": "Priya Desai",
        "email": "priya.desai@unsw.edu.au",
        "title": "Research Policy Officer",
        "specialty_area": "Personalised Medicine",
        "expertise_tags": [
            "Research policy",
            "Ethics and governance",
            "Genomic medicine policy",
            "Data sharing frameworks",
        ],
        "skills": ["Policy drafting", "Ethics review", "Stakeholder facilitation", "Grant strategy"],
        "bio": (
            "Supports genomic and personalised-medicine programmes with research governance "
            "and data-sharing policy across the Randwick precinct."
        ),
        "publications": 4,
        "active_projects": 2,
        "institution": "UNSW Sydney",
        "role": "researcher",
        "identity_facets": ["policy"],
        "primary_lens": "policy",
        "career_level": "ecr",
    },
]

# HDR / postgraduate students — User.role=researcher, career_level=student
POSTGRADUATE_STUDENT_DEMOS = [
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
    {
        "name": "Elena Vargas",
        "email": "elena.vargas@unsw.edu.au",
        "title": "PhD Candidate",
        "specialty_area": "Mental Health & Neuroscience",
        "expertise_tags": [
            "Youth mental health",
            "Adolescent wellbeing",
            "Digital interventions",
            "Social media and mental health",
            "Implementation science",
        ],
        "skills": ["Qualitative research", "Survey design", "R", "Literature synthesis"],
        "bio": (
            "PhD candidate at UNSW and the Black Dog Institute studying digital mental health "
            "interventions for teenagers and young people, including harms linked to social media "
            "use, across SESLHD and RHIP clinical partners."
        ),
        "publications": 2,
        "active_projects": 1,
        "institution": "UNSW Sydney",
        "role": "researcher",
        "identity_facets": ["researcher"],
        "primary_lens": "researcher",
        "career_level": "student",
    },
    {
        "name": "Tomás Okello",
        "email": "t.okello@unsw.edu.au",
        "title": "Bioinformatician",
        "specialty_area": "Personalised Medicine",
        "expertise_tags": [
            "Genomics",
            "Bioinformatics",
            "Precision oncology",
            "Computational biology",
        ],
        "skills": [
            "Bioinformatics",
            "Python",
            "Pipeline tooling",
            "Data cleaning",
            "Genomics analysis",
        ],
        "bio": (
            "Bioinformatician and MPhil researcher in personalised medicine, collaborating with "
            "RHIP teams on genomic data pipelines that support clinical decision-making. "
            "Methods overlap with biostatistics and computational biology."
        ),
        "publications": 0,
        "active_projects": 1,
        "institution": "UNSW Sydney",
        "role": "researcher",
        "identity_facets": ["professional_technical", "researcher"],
        "primary_lens": "professional_technical",
        "professional_title": "Bioinformatician",
        "career_level": "student",
    },
    {
        "name": "Mei Lin Chen",
        "email": "mei.chen@student.unsw.edu.au",
        "title": "PhD Student",
        "specialty_area": "Rare Diseases",
        "expertise_tags": [
            "Rare disease registries",
            "Patient-reported outcomes",
            "Health systems",
        ],
        "skills": ["Epidemiology", "Stata", "Patient engagement", "Grant writing"],
        "bio": (
            "PhD student focusing on rare disease registry design and how precinct partners "
            "share data to improve diagnosis pathways for families."
        ),
        "publications": 1,
        "active_projects": 1,
        "institution": "UNSW Sydney",
        "role": "researcher",
        "identity_facets": ["researcher"],
        "primary_lens": "researcher",
        "career_level": "student",
    },
]


def _enrich_publications(db, profiles_by_email: dict[str, Profile], manifest: list[dict]) -> None:
    cache_path = os.path.join(DATA_DIR, "pubmed_cache.json")
    cache = load_cache(cache_path)
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

    save_cache(cache_path, cache)
    print(
        f"  PubMed: {stats['papers']} papers "
        f"({stats['cache']} from cache, {stats['live']} live, {stats['none']} missing)"
    )


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
            if du["role"] in (Role.CLINICIAN, Role.RESEARCHER, Role.ADMIN):
                extras = build_profile_extras(du)
                if du["role"] == Role.ADMIN:
                    facets = []
                else:
                    facets = derive_facets_from_seed({
                        **du,
                        "role": "clinician" if du["role"] == Role.CLINICIAN else "researcher",
                    })
                    if du["role"] == Role.CLINICIAN and "researcher" not in facets:
                        # Demo clinician also engages in research trials
                        facets = ["clinician", "researcher"]
                db.add(Profile(
                    user_id=user.id,
                    name=du["name"],
                    title=du["title"],
                    specialty_area=du.get("specialty_area") or "",
                    expertise_tags=du.get("expertise_tags") or [],
                    bio=du.get("bio") or "",
                    publications=du.get("publications", 0),
                    active_projects=du.get("active_projects", 0),
                    patents=extras["patents"],
                    news=extras["news"],
                    awards=extras["awards"],
                    is_public=True,
                    identity_facets=facets,
                    primary_lens=facets[0] if facets else None,
                    career_level=(
                        "senior" if du["role"] == Role.CLINICIAN
                        else ("mid" if du["role"] != Role.ADMIN else None)
                    ),
                ))

        researchers_data = _load_json("researchers_manifest.json")
        clinicians_data = [
            p for p in _load_json("mock_profiles.json")
            if p.get("role") == "clinician"
        ]
        profiles_data = (
            researchers_data
            + clinicians_data
            + PROFESSIONAL_TECHNICAL_DEMOS
            + POLICY_DEMOS
            + POSTGRADUATE_STUDENT_DEMOS
        )
        profiles_by_email: dict[str, Profile] = {}

        for p in profiles_data:
            profile = _add_profile(db, institutions, p)
            profiles_by_email[p["email"]] = profile

        _enrich_publications(db, profiles_by_email, researchers_data)

        admin = db.query(User).filter(User.email == "admin@rhip.edu.au").first()
        users_by_email = {u.email: u for u in db.query(User).all()}
        projects_data = _load_json("mock_projects.json")
        researchers = db.query(User).filter(User.role == Role.RESEARCHER).all()
        clinicians = db.query(User).filter(User.role == Role.CLINICIAN).all()
        for i, proj in enumerate(projects_data):
            lead = users_by_email.get(proj.get("lead_email"))
            if not lead or lead.role != Role.RESEARCHER:
                lead = researchers[i % len(researchers)]

            partner = users_by_email.get(proj.get("clinical_partner_email"))
            if partner and partner.role != Role.CLINICIAN:
                partner = None
            if partner is None and clinicians:
                # Prefer same specialty, then intentionally rotate for cross-links.
                same_specialty = [
                    c for c in clinicians
                    if c.specialty_area == proj["specialty_area"]
                ]
                pool = same_specialty or clinicians
                partner = pool[(i * 3) % len(pool)]

            goal, raised, started, breakdown = _project_funding(proj["stage"], i)
            trl = _resolve_trl(proj)
            db.add(Project(
                title=proj["title"],
                description=proj["description"],
                stage=proj["stage"],
                specialty_area=proj["specialty_area"],
                readiness=Readiness(readiness_from_trl(trl)),
                trl=trl,
                visibility=Visibility(proj["visibility"]),
                lead_researcher_id=lead.id,
                clinical_partner_id=partner.id if partner else None,
                funding_goal=goal,
                funding_raised=raised,
                started_at=started,
                funding_breakdown=breakdown,
                impact_metrics=proj.get("impact"),
            ))

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
            db.add(Event(
                name=ev["name"],
                date=event_date,
                event_year=event_date.year,
                qr_code=ev["qr_code"],
                type=EventType(ev["type"]),
                created_by=admin.id,
            ))

        project_count = len(projects_data)
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
        print("Database seeded successfully!")
        print("Demo accounts:")
        print("clinician@rhip.edu.au / DemoPass1!")
        print("admin@rhip.edu.au / AdminPass1!")
        print("james@medtechcorp.com.au / Industry1!")
        print("sarah@pacificvc.com.au / Investor1!")
        print("z5580775@ad.unsw.edu.au / DemoPass1!  (PhD student — Gichia Muiruri)")
        partnered = sum(1 for p in projects_data if p.get("clinical_partner_email"))
        print(f"  {len(researchers_data)} real RHIP researchers seeded (PubMed enriched)")
        print(f"  {len(clinicians_data)} clinician profiles seeded")
        print(f"  {len(PROFESSIONAL_TECHNICAL_DEMOS)} professional/technical profiles seeded")
        print(f"  {len(POLICY_DEMOS)} policy profiles seeded")
        print(f"  {len(POSTGRADUATE_STUDENT_DEMOS)} postgraduate student profiles seeded")
        print(f"  {len(projects_data)} projects seeded ({partnered} with clinical partners)")
        print(f"  {len(CROSS_DISCIPLINARY_THREADS)} cross-disciplinary collaboration threads")
        print(f"  {len(CROSS_DISCIPLINARY_CHALLENGES)} cross-disciplinary challenges with AI matches")
        print(f"  {len(_load_json('mock_services.json'))} clinical services seeded")
        print(f"  {len(_load_json('mock_specialists.json'))} community specialists seeded")
    finally:
        db.close()


if __name__ == "__main__":
    seed()
