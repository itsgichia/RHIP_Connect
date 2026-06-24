import json
import os
from datetime import date, datetime

from app.auth import hash_password
from app.database import Base, SessionLocal, engine
from app.profile_extras import build_profile_extras
from app.models import (
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
    Profile,
    Project,
    Readiness,
    Role,
    ServiceTeamMember,
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
    "Pacific VC": (InstitutionType.INDUSTRY, None),
}


def _load_json(filename: str) -> list:
    path = os.path.join(DATA_DIR, filename)
    with open(path) as f:
        return json.load(f)


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
                db.add(Profile(
                    user_id=user.id,
                    name=du["name"],
                    title=du["title"],
                    specialty_area=du.get("specialty_area") or "Health Systems",
                    expertise_tags=du["expertise_tags"],
                    bio=du["bio"],
                    publications=10,
                    active_projects=1,
                    patents=extras["patents"],
                    news=extras["news"],
                    awards=extras["awards"],
                    is_public=True,
                ))

        profiles_data = _load_json("mock_profiles.json")
        for p in profiles_data:
            inst_name = p.get("institution", "UNSW Sydney")
            if inst_name not in institutions:
                inst = Institution(name=inst_name, type=InstitutionType.MRI)
                db.add(inst)
                db.flush()
                institutions[inst_name] = inst

            role = Role.RESEARCHER if p.get("role") == "researcher" else Role.CLINICIAN
            user = User(
                name=p["name"],
                email=p["email"],
                password_hash=hash_password("DemoPass1!"),
                role=role,
                institution_id=institutions[inst_name].id,
                specialty_area=p["specialty_area"],
                is_verified=True,
                is_active=True,
            )
            db.add(user)
            db.flush()
            extras = build_profile_extras(p)
            db.add(Profile(
                user_id=user.id,
                name=p["name"],
                title=p["title"],
                specialty_area=p["specialty_area"],
                expertise_tags=p["expertise_tags"],
                bio=p["bio"],
                publications=p["publications"],
                active_projects=p["active_projects"],
                patents=extras["patents"],
                news=extras["news"],
                awards=extras["awards"],
                is_public=True,
            ))

        admin = db.query(User).filter(User.email == "admin@rhip.edu.au").first()
        projects_data = _load_json("mock_projects.json")
        researchers = db.query(User).filter(User.role == Role.RESEARCHER).all()
        for i, proj in enumerate(projects_data):
            lead = researchers[i % len(researchers)]
            db.add(Project(
                title=proj["title"],
                description=proj["description"],
                stage=proj["stage"],
                specialty_area=proj["specialty_area"],
                readiness=Readiness(proj["readiness"]),
                visibility=Visibility(proj["visibility"]),
                lead_researcher_id=lead.id,
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
        print("  clinician@rhip.edu.au / DemoPass1!")
        print("  admin@rhip.edu.au / AdminPass1!")
        print("  james@medtechcorp.com.au / Industry1!")
        print("  sarah@pacificvc.com.au / Investor1!")
        print(f"  {len(profiles_data)} researcher/clinician profiles created")
        print(f"  {len(_load_json('mock_services.json'))} clinical services seeded")
        print(f"  {len(_load_json('mock_specialists.json'))} community specialists seeded")
    finally:
        db.close()


if __name__ == "__main__":
    seed()
