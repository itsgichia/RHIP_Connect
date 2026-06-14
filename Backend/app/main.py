from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.database import Base, engine
from app.routers import auth, challenges, directory, forms, impact, messages, notifications, passport, pipeline

Base.metadata.create_all(bind=engine)

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
app.include_router(pipeline.router, prefix=API_PREFIX)
app.include_router(forms.router, prefix=API_PREFIX)
app.include_router(directory.router, prefix=API_PREFIX)
app.include_router(challenges.router, prefix=API_PREFIX)
app.include_router(messages.router, prefix=API_PREFIX)
app.include_router(notifications.router, prefix=API_PREFIX)
app.include_router(passport.router, prefix=API_PREFIX)
app.include_router(passport.admin_router, prefix=API_PREFIX)


@app.get("/health")
def health():
    return {"status": "ok"}
