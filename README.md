# RHIP Connect

Digital operating system for the Randwick Health & Innovation Precinct (RHIP). The platform includes a public landing page with precinct KPIs and an authenticated area for precinct workers: expertise directory, AI-powered challenge board, innovation pipeline, and precinct passport.

**Tech stack:** React 18 + Vite + Tailwind CSS · Python 3.11 + FastAPI · SQLite · Qwen via Ollama (local AI) · Firebase Auth · JWT

---

## Prerequisites

- **Node.js** 18+ and npm
- **Python** 3.11+
- **Firebase project** — handles sign-up, email verification, and password reset — [Firebase Console](https://console.firebase.google.com)
- **Ollama** (optional, for AI challenge matching) — [ollama.com](https://ollama.com)

---

## Project structure

```
RHIP_Connect/
├── Backend/          # FastAPI API (port 8000)
│   ├── app/
│   └── requirements.txt
├── Frontend/         # React + Vite UI (port 5173)
├── data/             # Mock JSON used by the seed script
└── README.md
```

---

## First-time setup

### 1. Clone the repo

```bash
git clone <your-repo-url>
cd RHIP_Connect
```

Create `Backend/.env` and `Frontend/.env` with your own values (see [Environment variables](#environment-variables) below).

### 2. Firebase (required)

Auth and auth-related emails (verification, password reset) run through Firebase.

**Frontend**

1. In [Firebase Console](https://console.firebase.google.com), create a project (or use the shared team project).
2. Enable **Authentication → Sign-in method → Email/Password**.
3. Register a **Web app** and copy the config into `Frontend/.env` (`VITE_FIREBASE_*` variables).
4. Under **Authentication → Settings → Authorized domains**, ensure `localhost` is listed.

**Backend**

1. Firebase Console → **Project settings → Service accounts → Generate new private key**.
2. Save the JSON as `Backend/firebase-service-account.json` (gitignored).
3. Set `FIREBASE_SERVICE_ACCOUNT_PATH=./firebase-service-account.json` in `Backend/.env`.

When Firebase is configured on both sides, the app uses:

- **Sign-up** — Firebase creates the account and sends the verification email (`sendEmailVerification`), then the backend creates the platform profile via `/auth/firebase/signup`.
- **Login** — Firebase sign-in; backend issues JWT via `/auth/firebase/login` after the Firebase email is verified.
- **Forgot password** — Firebase sends the reset email (`sendPasswordResetEmail`); the user completes reset through Firebase, then returns to log in.

### 3. Backend (Python)

From the repo root:

```bash
python3 -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate

cd Backend
pip install -r requirements.txt
```

### 4. Frontend (Node)

```bash
cd Frontend
npm install
```

### 5. Seed the database (first run only)

From `Backend/` with your virtual environment active:

```bash
python -m app.seed
```

This creates `Backend/rhip_connect.db` and loads demo users, profiles, projects, KPIs, and events from `data/`. **Warning:** re-running the seed drops and recreates all tables.

### 6. AI — Ollama (optional)

AI challenge matching uses Qwen locally. Skip this step and set `USE_MOCK_AI=true` in `Backend/.env` if you do not have Ollama installed.

```bash
ollama pull qwen2.5:7b    # one-time download
ollama serve              # leave running (or use the Ollama desktop app)
```

Verify the model is available:

```bash
ollama list
```

---

## Running the app

Use separate terminal windows/tabs. Start services in this order:

### Terminal 1 — AI (optional)

```bash
ollama serve
```

Skip if using `USE_MOCK_AI=true`.

### Terminal 2 — Backend API

```bash
source .venv/bin/activate
cd Backend
uvicorn app.main:app --reload --port 8000
```

API docs: [http://localhost:8000/docs](http://localhost:8000/docs)  
Health check: [http://localhost:8000/health](http://localhost:8000/health)

### Terminal 3 — Frontend

```bash
cd Frontend
npm run dev
```

Open the app: [http://localhost:5173](http://localhost:5173)

---

## Environment variables

### Backend (`Backend/.env`)

Key settings for `Backend/.env`:

| Variable | Description |
|----------|-------------|
| `SECRET_KEY` | JWT signing key — generate with `python3 -c "import secrets; print(secrets.token_urlsafe(64))"` |
| `DATABASE_URL` | SQLite path, e.g. `sqlite:///./rhip_connect.db` |
| `QWEN_URL` / `QWEN_MODEL` | Ollama endpoint and model (default: `http://localhost:11434`, `qwen2.5:7b`) |
| `USE_MOCK_AI` | Set to `true` to use rule-based matching instead of Ollama |
| `FIREBASE_SERVICE_ACCOUNT_PATH` | Path to Firebase service account JSON (required for Firebase auth) |
| `FRONTEND_URL` | Frontend origin used in platform notification email links |
| `ADMIN_EMAIL` | Recipient for tenant/investor enquiry notifications |
| `MAIL_*` | Optional SMTP for platform notification emails only (see below) |

### Frontend (`Frontend/.env`)

Key settings for `Frontend/.env`:

| Variable | Description |
|----------|-------------|
| `VITE_API_BASE_URL` | Backend API base URL, e.g. `http://localhost:8000/api/v1` |
| `VITE_FRONTEND_URL` | Frontend origin, e.g. `http://localhost:5173` |
| `VITE_FIREBASE_*` | Firebase web app config (required for sign-up, login, and auth emails) |

---

## Authentication & email

### Firebase (default — used in production and local dev)

When `VITE_FIREBASE_*` is set in the frontend and the backend service account is present, all user-facing auth email goes through Firebase:

| Action | How it works |
|--------|--------------|
| Sign-up | Firebase account + verification email → backend profile at `/auth/firebase/signup` |
| Email verification | Firebase verification link (check inbox/spam) |
| Login | Firebase sign-in → backend JWT at `/auth/firebase/login` |
| Forgot password | Firebase password-reset email |

New users must use a **work email** — personal domains (Gmail, Yahoo, etc.) are blocked client- and server-side.

### Seeded demo accounts (JWT fallback)

After seeding, you can log in with pre-loaded demo accounts without creating Firebase users. Login tries Firebase first; if the account is not found in Firebase, it falls back to the backend JWT endpoint (`/auth/login`):

| Role | Email | Password |
|------|-------|----------|
| Admin | `admin@rhip.edu.au` | `AdminPass1!` |
| Clinician | `clinician@rhip.edu.au` | `DemoPass1!` |
| Industry | `james@medtechcorp.com.au` | `Industry1!` |
| Investor | `sarah@pacificvc.com.au` | `Investor1!` |

Mock directory profiles from `data/mock_profiles.json` also use password `DemoPass1!`.

### Platform notification emails (optional SMTP)

Separate from Firebase auth email, the backend can send **platform notifications** via SMTP when `MAIL_USERNAME` and `MAIL_PASSWORD` are configured:

- AI match alerts, connection requests, new message alerts
- Passport tier upgrades
- Tenant and investor enquiry notifications to `ADMIN_EMAIL`

If SMTP is not configured, these emails are **logged to the backend console** instead — the app still works; you just won't receive real emails for those events. In-app notifications (bell icon) work regardless.

There is also a legacy backend-only auth path (`/auth/signup`, `/auth/forgot-password`) that uses this SMTP layer for verification and reset emails. It is only used when Firebase is **not** configured on the frontend.

---

## Useful commands

```bash
# Reseed database (drops existing data)
cd Backend && python -m app.seed

# Production build (frontend)
cd Frontend && npm run build && npm run preview

# Lint frontend
cd Frontend && npm run lint
```

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| CORS errors | Ensure the backend is on port 8000 and frontend on 5173 |
| AI matching fails | Check Ollama is running (`ollama list`) or set `USE_MOCK_AI=true` |
| Firebase sign-up/login errors | Verify `VITE_FIREBASE_*` in frontend and service account JSON on backend |
| Verification email not received | Check spam; confirm Email/Password is enabled in Firebase Console |
| Demo account login fails | Use seeded credentials above — backend JWT fallback only runs when Firebase auth fails for that email |
| Empty directory / KPIs | Run `python -m app.seed` from `Backend/` |
| `ModuleNotFoundError: app` | Run uvicorn from the `Backend/` directory, not the repo root |
| Platform emails not arriving | Expected if `MAIL_*` is unset — check backend terminal logs, or configure SMTP |

---

## Team workflow

1. Clone the repo and complete [First-time setup](#first-time-setup).
2. Never commit `.env` files or `firebase-service-account.json` — they are gitignored.
3. Use feature branches and pull requests for shared work.

For full product specification and API design, see [`rhip_connect.md`](./rhip_connect.md).
