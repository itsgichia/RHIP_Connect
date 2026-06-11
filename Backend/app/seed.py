import json
import os
from datetime import date, datetime

from app.auth import hash_password
from app.database import Base, SessionLocal, engine
from app.models import (
    Event,
    EventType,
    Institution,
    InstitutionType,
    KPI,
    KPICategory,
    Profile,
    Project,
    Readiness,
    Role,
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
                db.add(Profile(
                    user_id=user.id,
                    name=du["name"],
                    title=du["title"],
                    specialty_area=du.get("specialty_area") or "Health Systems",
                    expertise_tags=du["expertise_tags"],
                    bio=du["bio"],
                    publications=10,
                    active_projects=1,
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
            db.add(Profile(
                user_id=user.id,
                name=p["name"],
                title=p["title"],
                specialty_area=p["specialty_area"],
                expertise_tags=p["expertise_tags"],
                bio=p["bio"],
                publications=p["publications"],
                active_projects=p["active_projects"],
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

        kpis = [
            ("active_innovation_projects", "Active Innovation Projects", 15, "15+", KPICategory.COMMERCIAL, ["investor", "all"], None),
            ("hth_occupancy", "HTH Occupancy Rate", 68, "68%", KPICategory.FACILITY, ["investor", "all"], "%"),
            ("industry_partnerships", "Industry Partnerships", 42, "42", KPICategory.COMMERCIAL, ["investor"], None),
            ("publications_year", "Research Publications per Year", 3200, "3,200+", KPICategory.RESEARCH, ["investor"], None),
            ("spinouts", "Spinouts Created", 12, "12", KPICategory.COMMERCIAL, ["investor"], None),
            ("patient_interactions", "Patient Interactions per Year", 1800000, "1.8M+", KPICategory.CLINICAL, ["government", "community", "all"], None),
            ("workforce_pct", "Workforce in Health & Education", 40, "40%", KPICategory.CORE, ["government"], "%"),
            ("clinical_trials", "Active Clinical Trials", 156, "156", KPICategory.CLINICAL, ["government"], None),
            ("research_grants", "Research Grants Active", 89000000, "$89M", KPICategory.RESEARCH, ["government"], None),
            ("unsw_ranking", "International Research Network Ranking", 1, "#1 in Australia", KPICategory.RESEARCH, ["government"], None),
            ("education_programs", "Education Programs Available", 48, "48", KPICategory.CORE, ["community"], None),
            ("community_events", "Community Health Events", 24, "24", KPICategory.CORE, ["community"], None),
            ("disciplines", "Healthcare Disciplines Represented", 35, "35", KPICategory.CLINICAL, ["community"], None),
            ("years_history", "Years of Health History", 168, "Since 1858", KPICategory.CORE, ["community"], None),
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

        db.commit()
        print("Database seeded successfully!")
        print("Demo accounts:")
        print("  clinician@rhip.edu.au / DemoPass1!")
        print("  admin@rhip.edu.au / AdminPass1!")
        print("  james@medtechcorp.com.au / Industry1!")
        print(f"  {len(profiles_data)} researcher/clinician profiles created")
    finally:
        db.close()


if __name__ == "__main__":
    seed()
