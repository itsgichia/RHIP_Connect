from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import inspect, text

from app.database import Base, engine
from app.routers import admin, admin_community, auth, challenges, community, directory, forms, government, impact, investor, knowledge_map, messages, notifications, orcid, passport, pipeline, pulse

Base.metadata.create_all(bind=engine)


def _ensure_sqlite_columns() -> None:
    """Add columns introduced after initial create_all (SQLite has no autogenerate here)."""
    if not str(engine.url).startswith("sqlite"):
        return
    inspector = inspect(engine)
    tables = inspector.get_table_names()
    with engine.begin() as conn:
        if "projects" in tables:
            existing = {col["name"] for col in inspector.get_columns("projects")}
            if "impact_metrics" not in existing:
                conn.execute(text("ALTER TABLE projects ADD COLUMN impact_metrics JSON"))
            project_cols = [
                ("funder", "VARCHAR(32)"),
                ("grant_id", "VARCHAR(64)"),
                ("grant_url", "VARCHAR(512)"),
            ]
            for name, col_type in project_cols:
                if name not in existing:
                    conn.execute(text(f"ALTER TABLE projects ADD COLUMN {name} {col_type}"))
        if "profiles" in tables:
            existing = {col["name"] for col in inspector.get_columns("profiles")}
            profile_cols = [
                ("identity_facets", "JSON"),
                ("primary_lens", "VARCHAR(64)"),
                ("professional_title", "VARCHAR(255)"),
                ("career_level", "VARCHAR(32)"),
                ("skills", "JSON"),
                ("orcid_id", "VARCHAR(19)"),
                ("orcid_checked", "BOOLEAN DEFAULT 0"),
            ]
            for name, col_type in profile_cols:
                if name not in existing:
                    conn.execute(text(f"ALTER TABLE profiles ADD COLUMN {name} {col_type}"))
        if "challenges" in tables:
            existing = {col["name"] for col in inspector.get_columns("challenges")}
            if "challenge_kind" not in existing:
                conn.execute(
                    text("ALTER TABLE challenges ADD COLUMN challenge_kind VARCHAR(32) DEFAULT 'either'")
                )
        if "publications" in tables:
            existing = {col["name"] for col in inspector.get_columns("publications")}
            if "abstract" not in existing:
                conn.execute(text("ALTER TABLE publications ADD COLUMN abstract TEXT"))
        if "users" in tables:
            existing = {col["name"] for col in inspector.get_columns("users")}
            user_cols = [
                ("email_matches", "BOOLEAN DEFAULT 1"),
                ("email_connections", "BOOLEAN DEFAULT 1"),
                ("email_messages", "BOOLEAN DEFAULT 1"),
                ("email_passport", "BOOLEAN DEFAULT 1"),
            ]
            for name, col_type in user_cols:
                if name not in existing:
                    conn.execute(text(f"ALTER TABLE users ADD COLUMN {name} {col_type}"))
        if "events" in tables:
            existing = {col["name"] for col in inspector.get_columns("events")}
            event_cols = [
                ("cpd_eligible", "BOOLEAN DEFAULT 0"),
                ("cpd_hours", "FLOAT"),
                ("cpd_category", "VARCHAR(64)"),
                ("cpd_notes", "VARCHAR(500)"),
            ]
            for name, col_type in event_cols:
                if name not in existing:
                    conn.execute(text(f"ALTER TABLE events ADD COLUMN {name} {col_type}"))


_ensure_sqlite_columns()

try:
    from app.seed import sync_event_cpd_metadata

    sync_event_cpd_metadata()
except Exception:
    # Non-fatal: CPD metadata sync is best-effort for existing DBs.
    pass

app = FastAPI(title="RHIP Connect API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

API_PREFIX = "/api/v1"
app.include_router(auth.router, prefix=API_PREFIX)
app.include_router(impact.router, prefix=API_PREFIX)
app.include_router(community.router, prefix=API_PREFIX)
app.include_router(pipeline.router, prefix=API_PREFIX)
app.include_router(forms.router, prefix=API_PREFIX)
app.include_router(directory.router, prefix=API_PREFIX)
app.include_router(orcid.router, prefix=API_PREFIX)
app.include_router(challenges.router, prefix=API_PREFIX)
app.include_router(messages.router, prefix=API_PREFIX)
app.include_router(notifications.router, prefix=API_PREFIX)
app.include_router(passport.router, prefix=API_PREFIX)
app.include_router(passport.admin_router, prefix=API_PREFIX)
app.include_router(admin.router, prefix=API_PREFIX)
app.include_router(admin_community.router, prefix=API_PREFIX)
app.include_router(investor.router, prefix=API_PREFIX)
app.include_router(government.router, prefix=API_PREFIX)
app.include_router(pulse.router, prefix=API_PREFIX)
app.include_router(knowledge_map.router, prefix=API_PREFIX)


@app.get("/health")
def health():
    return {"status": "ok"}
