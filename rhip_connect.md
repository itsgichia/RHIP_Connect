# RHIP Connect — Cursor Project Specification v2

## Project Overview

**RHIP Connect** is the digital operating system for the Randwick Health & Innovation Precinct
(RHIP) in Sydney, Australia. It serves as the Aim 3 deliverable for CDEV3000/6000:
*"Develop a Precinct-wide Impact & Communications Framework with a unified reporting
dashboard and communications strategy tailored to industry, government, clinicians,
researchers and community members."*

The platform has two distinct experiences:
1. **Public landing page** — the Aim 3 dashboard. No login required. Tailored KPI views
   for investors, government, and community. Investor contact form. HTH tenant enquiry
   form. Showcase of the Randwick precinct.
2. **Authenticated platform** — for precinct workers. Expertise directory, AI-powered
   challenge board with in-app chat, innovation pipeline, and precinct passport.

**Sign-up is self-service but restricted to work emails.** Gmail, Yahoo, Hotmail and other
personal domains are blocked at registration. All accounts are pending email verification
before first login. No admin provisioning required.

---

## Tech Stack

| Layer          | Technology                        | Reason                                            |
|---------------|----------------------------------|---------------------------------------------------|
| Frontend      | React 18 + Vite                   | Fast setup, component reuse                       |
| Styling       | Tailwind CSS v3                   | Utility-first, no component library overhead      |
| Backend       | Python 3.11 + FastAPI             | Async-ready, Pydantic validation                  |
| Database      | SQLite (via SQLAlchemy)           | No server needed, fine for prototype              |
| AI Engine     | Qwen via Ollama (local)           | Free, runs locally, reliable JSON output          |
| AI Fallback   | Alibaba DashScope API             | Cloud option if no GPU available                  |
| Auth          | JWT (python-jose + bcrypt)        | Stateless, simple to implement                    |
| Email         | fastapi-mail + SendGrid           | Transactional emails: verify, reset, notifications|
| Dev email     | Mailtrap                          | Catches emails in development without sending     |

**Qwen:** `ollama pull qwen2.5:7b` then `ollama serve` → `http://localhost:11434`.
DashScope fallback: OpenAI-compatible at `https://dashscope.aliyuncs.com/compatible-mode/v1`.

**Email service:** Use Mailtrap (`smtp.mailtrap.io`) in development — free, catches all
outgoing emails in an inbox you can inspect. Switch to SendGrid in production.

---

## Project Structure

```
rhip-connect/
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── layout/
│   │   │   │   ├── AppLayout.jsx        # Authenticated layout: NavBar + Sidebar + Outlet
│   │   │   │   ├── NavBar.jsx           # Top bar — role badge + user menu
│   │   │   │   ├── Sidebar.jsx          # Role-filtered nav links
│   │   │   │   └── PublicNavBar.jsx     # Landing page nav — Log In top left
│   │   │   ├── ui/
│   │   │   │   ├── ProfileCard.jsx      # Researcher/clinician card
│   │   │   │   ├── ChallengeCard.jsx    # Challenge board listing
│   │   │   │   ├── ProjectCard.jsx      # Pipeline project card
│   │   │   │   ├── MatchCard.jsx        # AI match result — score + initiate chat
│   │   │   │   ├── StatCard.jsx         # KPI metric card (landing page)
│   │   │   │   ├── TierBadge.jsx        # Passport tier badge
│   │   │   │   ├── NotificationBell.jsx # In-app notification dropdown
│   │   │   │   └── ChatThread.jsx       # Inline chat component
│   │   │   └── forms/
│   │   │       ├── ChallengeForm.jsx    # Post a challenge
│   │   │       ├── TenantEnquiryForm.jsx # HTH tenant application
│   │   │       └── InvestorContactForm.jsx # Investor contact
│   │   ├── pages/
│   │   │   ├── LandingPage.jsx          # Public Aim 3 dashboard (default route /)
│   │   │   ├── LoginPage.jsx
│   │   │   ├── SignupPage.jsx
│   │   │   ├── ForgotPasswordPage.jsx
│   │   │   ├── ResetPasswordPage.jsx
│   │   │   ├── VerifyEmailPage.jsx
│   │   │   ├── DashboardPage.jsx        # Role-based home after login
│   │   │   ├── DirectoryPage.jsx
│   │   │   ├── ChallengePage.jsx        # Challenge board + AI matching + chat
│   │   │   ├── PipelinePage.jsx
│   │   │   ├── PassportPage.jsx
│   │   │   └── AdminPage.jsx
│   │   ├── context/
│   │   │   ├── AuthContext.jsx          # JWT state: user, role, token
│   │   │   └── NotificationContext.jsx  # In-app notification state
│   │   ├── hooks/
│   │   │   ├── useAuth.js
│   │   │   ├── useApi.js                # Axios with auth header interceptor
│   │   │   └── useNotifications.js      # Poll /notifications every 30s
│   │   └── utils/
│   │       ├── roles.js                 # Role constants + permission helpers
│   │       └── blockedDomains.js        # Client-side domain validation (UX only)
│   ├── index.html
│   ├── vite.config.js
│   ├── tailwind.config.js
│   └── package.json
│
├── backend/
│   ├── app/
│   │   ├── main.py                      # FastAPI app, CORS, router mounting
│   │   ├── database.py                  # SQLAlchemy engine + session
│   │   ├── models.py                    # All ORM models
│   │   ├── schemas.py                   # Pydantic request/response schemas
│   │   ├── auth.py                      # JWT + password hashing + email validation
│   │   ├── seed.py                      # Seed DB with mock data
│   │   ├── email_service.py             # fastapi-mail wrapper + all email templates
│   │   ├── routers/
│   │   │   ├── auth.py                  # signup, login, verify, forgot, reset
│   │   │   ├── directory.py
│   │   │   ├── challenges.py            # challenge CRUD + AI matching + threads
│   │   │   ├── pipeline.py
│   │   │   ├── passport.py
│   │   │   ├── impact.py                # KPIs + audience-filtered views
│   │   │   ├── messages.py              # chat threads + messages
│   │   │   ├── notifications.py         # in-app notifications
│   │   │   ├── forms.py                 # tenant + investor contact forms → email admin
│   │   │   └── admin.py
│   │   └── services/
│   │       └── ai_service.py            # AIOrchestrator: Qwen calls
│   ├── requirements.txt
│   └── .env
│
└── data/
    ├── mock_profiles.json
    ├── mock_projects.json
    └── mock_events.json
```

---

## Design System

```javascript
// tailwind.config.js — extend.colors
colors: {
  rhip: {
    dark:      '#0D2137',  // nav bg, hero bg, dark slide backgrounds
    navy:      '#1A3A5C',  // card bg on dark surfaces
    teal:      '#028090',  // primary CTA, headers, icon circles
    seafoam:   '#00A896',  // secondary accent, hover states, score bars
    lightTeal: '#E8F7F8',  // card fills, tag backgrounds
    coral:     '#D85A30',  // AI badge, warnings, tier highlights
    amber:     '#E67E22',  // Gold tier colour
    white:     '#FFFFFF',
    body:      '#2D3748',  // main body text
    muted:     '#718096',  // secondary text, timestamps
    lightBg:   '#F5F9FA',  // page background
    cardBg:    '#EBF4F5',  // subtle card fill
    ice:       '#CADCFC',  // text on dark backgrounds
  }
}

// Fonts: Inter (body) + Lora or Playfair Display (display/headings)
// Load via Google Fonts in index.html

// Border radius: rounded-2xl for cards, rounded-full for avatars + badges
// Shadows: shadow-sm for light bg cards, shadow-none on dark bg cards
// Spacing: gap-4 (16px) between cards, gap-8 (32px) between sections
```

---

## Blocked Email Domains

```python
# backend/app/auth.py
BLOCKED_DOMAINS = [
    "gmail.com", "googlemail.com",
    "yahoo.com", "yahoo.co.uk", "yahoo.com.au", "yahoo.co.nz",
    "hotmail.com", "hotmail.co.uk", "hotmail.com.au",
    "outlook.com", "live.com", "live.com.au", "msn.com",
    "icloud.com", "me.com", "mac.com",
    "protonmail.com", "proton.me", "tutanota.com",
    "aol.com", "mail.com", "zoho.com",
]

def is_blocked_email(email: str) -> bool:
    domain = email.split("@")[-1].lower()
    return domain in BLOCKED_DOMAINS
```

Note: This is domain-blocking only, not domain-whitelisting. Any non-personal work email
(e.g. `@unsw.edu.au`, `@health.nsw.gov.au`, `@blackdoginstitute.org.au`,
`@georgeinstitute.org`) is accepted. Admin can add domains to the blocked list in future.

---

## User Roles

```python
class Role(str, Enum):
    ADMIN      = "admin"
    CLINICIAN  = "clinician"
    RESEARCHER = "researcher"
    INDUSTRY   = "industry"
    INVESTOR   = "investor"   # external read-only, no login required for landing page
```

| Feature                   | Admin | Clinician | Researcher | Industry | Investor |
|---------------------------|-------|-----------|------------|----------|----------|
| Public landing page       | ✓     | ✓         | ✓          | ✓        | ✓ (no login) |
| Expertise Directory       | CRUD  | Read      | Read       | Read     | —        |
| Post a Challenge          | ✓     | ✓         | ✓          | —        | —        |
| View Challenges           | All   | All       | All        | Read     | —        |
| Initiate chat             | ✓     | ✓         | ✓          | —        | —        |
| Innovation Pipeline       | CRUD  | Read      | Read+Post  | Read     | Public   |
| Precinct Passport         | Admin | ✓         | ✓          | —        | —        |
| KPIs (all tiers)          | All   | Precinct  | Precinct   | Selected | Public   |
| Admin panel               | ✓     | —         | —          | —        | —        |

---

## Database Models

```python
# backend/app/models.py

class Institution(Base):
    id:             UUID   (PK)
    name:           String
    type:           Enum('hospital', 'university', 'MRI', 'industry')
    partner_pct:    Integer  # 40 / 40 / 20 for UNSW / SESLHD / SCHN

class User(Base):
    id:             UUID   (PK)
    name:           String
    email:          String (unique)
    password_hash:  String
    role:           Role enum
    institution_id: FK -> Institution (nullable)
    specialty_area: String (nullable)  # set at signup for clinician/researcher
    is_verified:    Boolean  # False until email verified
    is_active:      Boolean  # True after verification
    created_at:     DateTime
    # Email verification / password reset tokens stored as short-lived DB records
    past_gold:      Boolean  # True if ever earned Gold tier in a previous year

class EmailToken(Base):
    # Stores short-lived tokens for email verification and password reset
    id:             UUID   (PK)
    user_id:        FK -> User
    token:          String (unique, hashed)
    type:           Enum('verify', 'reset')
    expires_at:     DateTime
    used:           Boolean

class Profile(Base):
    id:             UUID   (PK)
    user_id:        FK -> User (unique)
    name:           String
    title:          String
    specialty_area: String
    expertise_tags: JSON   # list of strings, max 8
    bio:            Text
    publications:   Integer
    active_projects:Integer
    is_public:      Boolean

class Challenge(Base):
    id:             UUID   (PK)
    posted_by:      FK -> User
    title:          String
    description:    Text
    specialty_area: String
    status:         Enum('pending', 'matching', 'matched', 'closed')
    created_at:     DateTime

class AIMatch(Base):
    id:             UUID   (PK)
    challenge_id:   FK -> Challenge
    profile_id:     FK -> Profile
    score:          Float  # 0.0 – 1.0
    reasoning:      Text   # one sentence from Qwen
    rank:           Integer # 1, 2, or 3 only
    created_at:     DateTime

class Thread(Base):
    # A conversation between two users, initiated from a challenge match
    id:             UUID   (PK)
    challenge_id:   FK -> Challenge (nullable)
    match_id:       FK -> AIMatch (nullable)
    status:         Enum('pending', 'active', 'declined', 'closed')
    created_at:     DateTime
    # pending = initiation message sent, receiver has not accepted yet
    # active  = both parties in conversation
    # declined = receiver declined connection request

class ThreadParticipant(Base):
    id:             UUID   (PK)
    thread_id:      FK -> Thread
    user_id:        FK -> User
    role:           Enum('initiator', 'receiver')
    accepted:       Boolean  # receiver must accept before thread becomes active
    joined_at:      DateTime (nullable)  # set when accepted

class Message(Base):
    id:             UUID   (PK)
    thread_id:      FK -> Thread
    sender_id:      FK -> User
    content:        Text
    created_at:     DateTime
    read_at:        DateTime (nullable)

class Notification(Base):
    id:             UUID   (PK)
    user_id:        FK -> User
    type:           Enum('match', 'connection_request', 'message', 'passport', 'system')
    title:          String
    body:           Text
    action_url:     String (nullable)  # e.g. "/challenges/123" or "/messages/456"
    is_read:        Boolean
    created_at:     DateTime

class Project(Base):
    id:             UUID   (PK)
    title:          String
    description:    Text
    stage:          Integer  # 1–10
    specialty_area: String
    lead_researcher_id:  FK -> User
    clinical_partner_id: FK -> User (nullable)
    readiness:      Enum('early', 'feasibility', 'clinical', 'commercial')
    visibility:     Enum('public', 'precinct', 'internal')

class Event(Base):
    id:             UUID   (PK)
    name:           String
    date:           Date
    event_year:     Integer  # derived from date, used for passport year grouping
    qr_code:        String (unique)
    type:           Enum('conference', 'workshop', 'showcase', 'networking')
    created_by:     FK -> User

class PassportEntry(Base):
    id:             UUID   (PK)
    user_id:        FK -> User
    event_id:       FK -> Event
    event_year:     Integer  # denormalised for fast year queries
    scanned_at:     DateTime
    # unique constraint: (user_id, event_id)

class RewardTier(Base):
    id:             UUID   (PK)
    user_id:        FK -> User (unique)
    year:           Integer  # current passport year
    tier:           Enum('none', 'bronze', 'silver', 'gold')
    events_attended:Integer
    total_events_in_year: Integer  # total RHIP events for this year
    grant_awarded:  Boolean
    last_calculated:DateTime

class KPI(Base):
    id:             UUID   (PK)
    metric_name:    String
    display_label:  String  # human-readable label e.g. "Research Community Members"
    value:          Float
    display_value:  String  # formatted e.g. "7,000+" or "68%"
    category:       Enum('core', 'research', 'clinical', 'commercial', 'facility')
    audience:       JSON    # list: ["all"] or ["investor", "government"] etc.
    period:         String  # "2026" or "Q1 2026"
    unit:           String (nullable)  # "%" for occupancy rate
    is_live:        Boolean  # True = admin can update via dashboard

class TenantEnquiry(Base):
    id:             UUID   (PK)
    company_name:   String
    contact_name:   String
    email:          String
    phone:          String
    company_type:   String  # biotech, medtech, healthtech, pharma, other
    desks_needed:   Integer
    preferred_start:Date (nullable)
    message:        Text
    submitted_at:   DateTime
    # On save: triggers email to admin (no further app state needed)

class InvestorEnquiry(Base):
    id:             UUID   (PK)
    name:           String
    email:          String
    phone:          String
    message:        Text
    submitted_at:   DateTime
    # On save: triggers email to admin
```

---

## API Endpoints

All authenticated routes prefix: `/api/v1`. Auth header: `Authorization: Bearer <token>`.

### Auth

```
POST /auth/signup
  Body: { name, email, password, role, institution_name, specialty_area }
  Validates: email not in BLOCKED_DOMAINS, email not already registered
  Action: create inactive user, send verification email
  Returns: { message: "Verification email sent. Check your inbox." }

GET  /auth/verify/{token}
  Action: activate user account, mark token used
  Returns: { message: "Email verified. You can now log in." }

POST /auth/login
  Body: { email, password }
  Validates: user is_verified + is_active
  Returns: { access_token, refresh_token, role, user_id, name }

POST /auth/refresh
  Body: { refresh_token }
  Returns: { access_token }

POST /auth/forgot-password
  Body: { email }
  Action: if email exists, generate reset token, send reset email
  Returns: { message: "If that email is registered, a reset link has been sent." }
  Note: always return the same message regardless of whether email exists (security)

POST /auth/reset-password
  Body: { token, new_password }
  Validates: token exists, not expired, not used
  Action: update password, mark token used
  Returns: { message: "Password updated. You can now log in." }
```

### Email Templates (email_service.py)

```python
# All templates live in email_service.py as functions
# Each returns a MessageSchema for fastapi-mail

def send_verification_email(name: str, email: str, verify_url: str)
  Subject: "Verify your RHIP Connect account"
  Body: "Hi {name}, click the link below to verify your account..."
  Link: {FRONTEND_URL}/auth/verify/{token}

def send_password_reset_email(name: str, email: str, reset_url: str)
  Subject: "Reset your RHIP Connect password"
  Body: "Hi {name}, you requested a password reset..."
  Link: {FRONTEND_URL}/auth/reset-password/{token}
  Expiry: 1 hour

def send_match_notification_email(researcher: User, challenge: Challenge, match: AIMatch)
  Subject: "You've been matched to a clinical challenge on RHIP Connect"
  Body: "Dr. {clinician} posted a challenge: '{challenge.title}'.
         Qwen ranked you #{match.rank} because: {match.reasoning}.
         Log in to view and respond."

def send_connection_request_email(receiver: User, initiator: User, challenge: Challenge, opening_message: str)
  Subject: "{initiator.name} wants to connect with you on RHIP Connect"
  Body: "Re: '{challenge.title}' — {initiator.name} sent: '{opening_message}'.
         Log in to accept or decline."

def send_new_message_email(recipient: User, sender: User, thread_id: str)
  Subject: "New message from {sender.name} on RHIP Connect"
  Body: "You have a new message. Log in to reply."
  Note: only send if recipient has not read the thread in the last 30 minutes

def send_tenant_enquiry_confirmation(enquiry: TenantEnquiry)
  To: ADMIN_EMAIL (from .env)
  Subject: "New HTH Tenant Enquiry — {enquiry.company_name}"
  Body: full enquiry details

def send_investor_enquiry_notification(enquiry: InvestorEnquiry)
  To: ADMIN_EMAIL (from .env)
  Subject: "New Investor Contact — {enquiry.name}"
  Body: full enquiry details

def send_passport_tier_upgrade_email(user: User, new_tier: str, events_attended: int)
  Subject: "You've reached {new_tier} tier on the RHIP Precinct Passport!"
  Body: "Congratulations..."
```

### Directory

```
GET /directory/search
  Guard: authenticated
  Params: ?query=&specialty=&institution=&page=1&limit=12
  Returns: { profiles: Profile[], total, page }

GET /directory/{profile_id}
  Guard: authenticated
  Returns: Profile (full detail)
```

### Challenges

```
POST /challenges
  Guard: clinician | researcher | admin
  Body: { title, description, specialty_area }
  Action: save challenge (status='pending'), fire background AI matching task
  Returns: { id, status: "pending" }

GET /challenges
  Guard: authenticated
  Params: ?status=&specialty=&page=
  Returns: { challenges: Challenge[], total }
  Note: all authenticated roles see all open challenges (industry = read-only)

GET /challenges/{id}
  Guard: authenticated
  Returns: Challenge + posted_by profile snippet

GET /challenges/{id}/matches
  Guard: authenticated
  Returns: { matches: AIMatch[], challenge_status }
  Note: frontend polls this until challenge_status === 'matched'
```

### Messages & Threads

```
POST /threads/initiate
  Guard: clinician | researcher | admin
  Body: { match_id, opening_message }
  Action:
    - Create Thread (status='pending', linked to match + challenge)
    - Create ThreadParticipant for initiator (accepted=true)
    - Create ThreadParticipant for receiver (accepted=false)
    - Create first Message with opening_message
    - Create in-app Notification for receiver
    - Send connection_request email to receiver
  Returns: { thread_id, status: "pending" }

POST /threads/{thread_id}/respond
  Guard: authenticated (must be the receiver)
  Body: { accepted: bool }
  Action:
    - If accepted: update ThreadParticipant.accepted=true, Thread.status='active'
    - If declined: Thread.status='declined'
    - Create in-app Notification for initiator
  Returns: { thread_id, status }

GET /threads
  Guard: authenticated
  Returns: all threads the current user is a participant in
  Includes: last message snippet, other participant's name, thread status, challenge title

GET /threads/{thread_id}/messages
  Guard: authenticated (must be a participant)
  Returns: { messages: Message[], challenge_context: Challenge snippet }
  Note: challenge title + description shown at top as context (read-only)

POST /threads/{thread_id}/messages
  Guard: authenticated (must be a participant, thread must be 'active')
  Body: { content }
  Action: save message, create in-app Notification for other participant,
          send email if other participant last seen > 30 min ago
  Returns: Message
```

### Notifications

```
GET /notifications
  Guard: authenticated
  Returns: { notifications: Notification[], unread_count }
  Note: frontend polls this every 30 seconds

PATCH /notifications/{id}/read
  Guard: authenticated (must be owner)
  Returns: { ok: true }

PATCH /notifications/read-all
  Guard: authenticated
  Action: mark all notifications as read for current user
  Returns: { ok: true }
```

### Passport

```
POST /passport/scan
  Guard: authenticated
  Body: { qr_code }
  Validates: event exists, not a duplicate scan for this user
  Action: insert PassportEntry, recalculate tier, send tier-upgrade email if tier changed
  Returns: { entry_logged, event_name, current_tier, events_attended,
             total_events_in_year, next_tier_at, tier_upgraded }

GET /passport/my
  Guard: authenticated
  Returns: { tier, events_attended, total_events_in_year, entries: PassportEntry[],
             next_reward, past_gold, year }

GET /passport/events
  Guard: authenticated
  Returns: all Event[] for current year (shows which ones user has/hasn't attended)

# Annual reset — run as a scheduled job on January 1 each year
# Logic:
#   1. For every RewardTier where tier='gold', set user.past_gold=true
#   2. Reset all RewardTier records: tier='none', events_attended=0, grant_awarded=false
#   3. Update year to new year
# For prototype: expose as an admin endpoint to trigger manually
POST /admin/passport/reset-year    Guard: admin
```

### Impact / KPIs

```
GET /impact/kpis
  Guard: none (public endpoint)
  Params: ?audience=all|investor|government|community
  Returns: KPI[] filtered by audience
  Note: no auth required — this powers the public landing page

GET /impact/kpis/all
  Guard: authenticated
  Returns: all KPIs including precinct-only and internal visibility

PATCH /impact/kpis/{id}
  Guard: admin
  Body: { value, display_value }
  Note: admin can update live KPIs (e.g. HTH occupancy rate) from the admin panel
```

### Forms (public — no auth required)

```
POST /forms/tenant-enquiry
  Guard: none (public)
  Body: { company_name, contact_name, email, phone, company_type,
          desks_needed, preferred_start, message }
  Action: save TenantEnquiry, send email to ADMIN_EMAIL
  Returns: { message: "Enquiry received. RHIP will be in touch within 2 business days." }

POST /forms/investor-contact
  Guard: none (public)
  Body: { name, email, phone, message }
  Action: save InvestorEnquiry, send email to ADMIN_EMAIL
  Returns: { message: "Message received. RHIP will be in touch soon." }
```

### Pipeline

```
GET /pipeline/projects
  Guard: none for public visibility, authenticated for precinct+internal
  Params: ?stage=&specialty=&readiness=
  Returns: { projects: Project[] } filtered by visibility based on auth status

GET /pipeline/projects/{id}
  Guard: same as above

POST /pipeline/projects
  Guard: researcher | admin
  Body: { title, description, stage, specialty_area, readiness, visibility }
  Returns: Project

PATCH /pipeline/projects/{id}
  Guard: owner | admin
  Body: partial update
```

### Admin

```
GET  /admin/users               Guard: admin   Returns: User[]
PATCH /admin/users/{id}         Guard: admin   Body: { role, is_active }
GET  /admin/events              Guard: admin   Returns: Event[]
POST /admin/events              Guard: admin   Body: { name, date, type }
                                               Returns: Event with generated qr_code
GET  /admin/enquiries           Guard: admin   Returns: { tenants: [], investors: [] }
PATCH /admin/kpis/{id}          Guard: admin   Body: { display_value }
```

---

## AI Service

```python
# backend/app/services/ai_service.py

class AIOrchestrator:

    def __init__(self):
        self.url   = os.getenv("QWEN_URL", "http://localhost:11434")
        self.model = os.getenv("QWEN_MODEL", "qwen2.5:7b")

    async def match_challenge(
        self,
        challenge: Challenge,
        profiles: list[Profile]
    ) -> list[dict]:
        """
        Returns top 3 matches as:
        [{ profile_id, score (0.0-1.0), reasoning (one sentence), rank (1/2/3) }]
        Sorted by score descending.
        """
        prompt = f"""You are an AI assistant helping match a clinical challenge to
researchers at a health innovation precinct.

Challenge posted:
Title: {challenge.title}
Description: {challenge.description}
Specialty area: {challenge.specialty_area}

Available researcher profiles:
{self._format_profiles(profiles)}

Return ONLY valid JSON. No markdown, no explanation, no preamble.
Return exactly the top 3 best matches, sorted by relevance score descending.
Format:
[
  {{"profile_id": "uuid-here", "score": 0.92, "reasoning": "One clear sentence explaining why this is a strong match."}},
  {{"profile_id": "uuid-here", "score": 0.85, "reasoning": "One clear sentence."}},
  {{"profile_id": "uuid-here", "score": 0.71, "reasoning": "One clear sentence."}}
]
Scores range 0.0 to 1.0. Be strict — only include genuinely relevant matches."""

        return await self._call_qwen_json(prompt)

    def _format_profiles(self, profiles: list) -> str:
        lines = []
        for p in profiles:
            tags = ", ".join(p.expertise_tags[:6])
            lines.append(
                f"- ID: {p.id} | Name: {p.name} | Title: {p.title} "
                f"| Specialty: {p.specialty_area} | Expertise: {tags}"
            )
        return "\n".join(lines)

    async def _call_qwen_json(self, prompt: str) -> list:
        """
        POST to Ollama /api/generate with format="json".
        Parse response["response"] as JSON.
        Strip markdown fences before parsing.
        Return empty list on any error — never crash the endpoint.
        """
        import httpx, json, re
        payload = {
            "model":  self.model,
            "prompt": prompt,
            "stream": False,
            "format": "json"
        }
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                resp = await client.post(
                    f"{self.url}/api/generate",
                    json=payload
                )
                raw = resp.json().get("response", "[]")
                # Strip markdown fences if present
                raw = re.sub(r"```json|```", "", raw).strip()
                return json.loads(raw)
        except Exception as e:
            print(f"Qwen error: {e}")
            return []
```

**Background task wiring in challenges.py:**

```python
from fastapi import BackgroundTasks

@router.post("/challenges")
async def create_challenge(
    body: ChallengeCreate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles([Role.CLINICIAN, Role.RESEARCHER, Role.ADMIN]))
):
    challenge = Challenge(**body.dict(), posted_by=current_user.id, status="pending")
    db.add(challenge)
    db.commit()
    db.refresh(challenge)

    background_tasks.add_task(run_ai_matching, challenge.id, db)
    return {"id": challenge.id, "status": "pending"}

async def run_ai_matching(challenge_id: str, db: Session):
    challenge = db.query(Challenge).get(challenge_id)
    challenge.status = "matching"
    db.commit()

    profiles = db.query(Profile).filter(
        Profile.specialty_area == challenge.specialty_area
    ).all()

    ai = AIOrchestrator()
    matches = await ai.match_challenge(challenge, profiles)

    for rank, m in enumerate(matches[:3], start=1):
        profile = db.query(Profile).get(m["profile_id"])
        if not profile:
            continue
        db.add(AIMatch(
            challenge_id=challenge.id,
            profile_id=m["profile_id"],
            score=m["score"],
            reasoning=m["reasoning"],
            rank=rank
        ))
        # In-app notification for each matched researcher
        db.add(Notification(
            user_id=profile.user_id,
            type="match",
            title="You've been matched to a challenge",
            body=f"Your expertise was matched to: '{challenge.title}'",
            action_url=f"/challenges/{challenge.id}"
        ))
        # Email notification
        challenger = db.query(User).get(challenge.posted_by)
        await email_service.send_match_notification_email(
            profile.user, challenge, AIMatch(rank=rank, reasoning=m["reasoning"])
        )

    challenge.status = "matched"
    db.commit()
```

---

## Landing Page — Full Section Spec

The landing page IS the Aim 3 deliverable. Route: `/`. No authentication required.

```
PublicNavBar
  Left:   RHIP Connect logo
  Far left: "Log In" button (teal outlined)    ← as requested
  Right:  "Become a Tenant" CTA (teal filled)

──────────────────────────────────────────────
SECTION 1: Hero
  Background: dark navy (rhip-dark)
  Headline: "The Future of Lifelong Health"
  Subheadline: "56 hectares. 22,000 people. One innovation ecosystem."
  Animated counter cards (4 across):
    - 7,000+  Research community members
    - 22,000  Campus workforce
    - $1.5B   Infrastructure investment
    - 1.8M+   Patient interactions per year
  CTA buttons: "Explore the Precinct" (scrolls down) | "Log In"

──────────────────────────────────────────────
SECTION 2: About RHIP
  Background: white
  Two columns:
    Left:  Paragraph about what RHIP is (co-located precinct, UNSW + SESLHD + SCHN)
    Right: Partner logos row (UNSW, NSW Health, Sydney Children's)
  Key facts: 3 major teaching hospitals · 4 medical research institutes · Top 20 globally (UNSW)

──────────────────────────────────────────────
SECTION 3: Precinct by the Numbers — Audience-Tailored KPIs
  Background: rhip-lightBg
  Section title: "Precinct Performance"

  Audience tab switcher (3 tabs):
  ┌─────────────┬──────────────────┬─────────────────┐
  │ For Investors│ For Government  │ For Community   │
  └─────────────┴──────────────────┴─────────────────┘

  "For Investors" tab shows:
    - Active Innovation Projects (count from pipeline)
    - HTH Occupancy Rate (% with progress bar + "6 industry floors")
    - Industry Partnerships (count)
    - Research Publications per year
    - Spinouts created (count)

  "For Government" tab shows:
    - Patient Interactions per year (1.8M+)
    - Workforce in Health & Education (40% of Randwick LGA)
    - Active Clinical Trials
    - Research Grants Active ($value)
    - International Research Network Ranking (UNSW #1 in Australia)

  "For Community" tab shows:
    - Patient interactions per year
    - Education programs available
    - Community health events
    - Healthcare disciplines represented
    - Years of health history (since 1858 — Prince of Wales origin)

  All KPI values come from GET /impact/kpis?audience=investor|government|community

──────────────────────────────────────────────
SECTION 4: Innovation in Progress
  Background: white
  Title: "What's Being Built Right Now"
  Subtitle: "Active projects from idea to clinical adoption"
  Shows 6 ProjectCards (public visibility only, stages 4–8, most commercially advanced)
  Stage badge colour-coded: Early (gray) → Feasibility (teal) → Clinical (seafoam) → Commercial (coral)
  "View all projects" link → redirects to login (prompts signup if not member)

──────────────────────────────────────────────
SECTION 5: The Randwick Precinct
  Background: rhip-dark
  Title: "More Than a Campus"
  Three column layout:
    Column 1 — Location & Connectivity:
      - 6km to Sydney CBD
      - 5km to Tech Central
      - Light rail & buses
      - 6km to Sydney Airport
      Icons + short descriptors

    Column 2 — Lifestyle:
      - Coogee Beach (2km)
      - Randwick Town Junction
      - The Spot dining precinct
      - NIDA — National Institute of Dramatic Art
      Icons + short descriptors

    Column 3 — The Precinct:
      - 56 hectares
      - 4.2km contiguous border
      - UNSW Kensington Campus
      - Prince of Wales Hospital
      - Sydney Children's Hospital
      - Health Translation Hub (new 2025)
      Icons + short descriptors

──────────────────────────────────────────────
SECTION 6: Health Translation Hub
  Background: rhip-lightTeal
  Two columns:
    Left:
      Title: "The Health Translation Hub"
      Opened: 2025 | 35,000 m² | $600M investment
      Description: "Six dedicated industry floors designed for co-location with the
                    precinct's hospitals and research institutes. Where discovery
                    meets clinical practice."
      Key features: 6 industry floors · Startup space · Education facilities ·
                    35,000m² · Direct hospital connectivity

      HTH Occupancy indicator:
        Label: "Current Occupancy"
        Visual: progress bar + percentage (e.g. "68% occupied")
        Subtext: "2 floors currently available"

    Right:
      Tenant Enquiry Form:
        Title: "Enquire About Tenancy"
        Fields:
          - Company name (required)
          - Contact name (required)
          - Email (required)
          - Phone (required)
          - Company type (dropdown: Biotech / MedTech / HealthTech / Pharma /
                         Digital Health / Research / Other)
          - Number of desks needed (number input)
          - Preferred start date (date picker)
          - Message (textarea)
        Submit → POST /forms/tenant-enquiry → email to ADMIN_EMAIL
        Success state: "Thank you. RHIP will be in touch within 2 business days."

──────────────────────────────────────────────
SECTION 7: Contact & Investment
  Background: white
  Two columns:
    Left:
      Title: "Partner With Us"
      Body: "RHIP brings together the clinical scale, research capability, and
             infrastructure that industry and investors cannot access anywhere else
             in the Southern Hemisphere."
      What we offer investors:
        ✓ Access to a pipeline of 15+ investable projects
        ✓ Co-location in the Health Translation Hub
        ✓ Direct clinical trial partnerships
        ✓ IP licensing opportunities
        ✓ A 7,000-strong research talent pool

    Right:
      Investor Contact Form:
        Title: "Get in Touch"
        Fields:
          - Full name (required)
          - Email (required)
          - Phone (required)
          - Message (required)
        Submit → POST /forms/investor-contact → email to ADMIN_EMAIL
        Success state: "Message received. The RHIP team will be in touch."

──────────────────────────────────────────────
SECTION 8: Footer
  Background: rhip-dark
  Left:   RHIP Connect logo + "The future of lifelong health"
  Centre: Links: About | Pipeline | HTH | Contact | Log In
  Right:  Partner acknowledgement + Bidjigal Country acknowledgement
  Bottom: © 2026 RHIP Connect · CDEV3000/6000 · UNSW Sydney
```

---

## Authenticated Pages — Detailed Spec

### DashboardPage.jsx
Role-based default home after login.

**Clinician view:**
- Recent challenges posted by this user + their match status
- Notification feed (last 5)
- Passport tier card (progress ring)
- Quick action: "Post a Challenge" button

**Researcher view:**
- Challenges you've been matched to (from AIMatch notifications)
- Connection requests pending (ThreadParticipant where accepted=false)
- Active conversations (threads with recent messages)
- Passport tier card

**Industry view:**
- Latest open challenges (read-only browse)
- Pipeline projects in commercial stage
- HTH availability summary

**Admin view:**
- User counts by role
- Challenges pending matching
- Unread tenant + investor enquiries
- Upcoming events (next 30 days)

### DirectoryPage.jsx
- SearchBar: text input + specialty dropdown + institution text
- 3-column ProfileCard grid (2 tablet, 1 mobile)
- Each ProfileCard: avatar placeholder, name, title, institution, specialty badge,
  top 3 expertise tags, publication count, active projects count
- Click → ProfileDetailModal with full bio + "Send Message" button
  (Send Message → creates a direct thread without a challenge, or prompts to reference one)
- URL params: `/directory?query=&specialty=` (state in URL for shareability)

### ChallengePage.jsx
Two-panel layout:

**Left panel (40% width):**
- "Post a Challenge" heading
- ChallengeForm:
  - Title (text input)
  - Description (textarea, min 50 chars)
  - Specialty area (dropdown: the 4 areas)
  - Submit button

- Below form: ChallengeList — all open challenges from the community
  (shows who posted + specialty badge + title + posted X minutes/hours ago)

**Right panel (60% width) — states:**

1. *Empty state:* "Post a challenge to see AI-matched researchers"

2. *Matching state* (status='matching'):
   Animated teal spinner
   "Qwen is searching 25 precinct profiles…"
   Progress indicator

3. *Matched state* (status='matched'):
   Section header: "Top 3 Matches"
   3 MatchCards, each containing:
     - Rank badge (#1 / #2 / #3) — #1 gets "Best Match" teal badge
     - Profile photo placeholder + name + title + institution
     - Score bar: teal fill, width = score × 100%, label "87% match"
     - Reasoning text: italic, one sentence from Qwen
     - Expertise tags (3 visible)
     - ─────────────────────────────────
     - "Start a conversation" text area (placeholder: "Introduce yourself and explain what you're looking for...")
     - "Send" button

   Clicking Send on a MatchCard:
   → POST /threads/initiate { match_id, opening_message }
   → MatchCard transitions to "Connection request sent"
   → Receiver gets in-app notification + email

### ChallengeChatView.jsx (sub-view)
When a challenge match leads to an accepted thread:
- Top bar: challenge title + posted by + specialty badge (read-only context)
- Chat area: messages bubble (initiator right, receiver left)
  Same visual style as iMessage — right side teal bubbles, left side light gray
- Bottom: message input + send button
- Timestamps on messages
- "Accepted" state shown clearly at top

### PipelinePage.jsx
- Stage filter row: 10 pill buttons (1–10), selecting filters the grid
  Stage labels: 1 Need · 2 Idea · 3 PoC · 4 Feasibility · 5 Proof of Value ·
                6 Initial Trials · 7 Validation · 8 Approval · 9 Clinical Use · 10 Standard of Care
- Specialty tabs below: All · Mental Health · Personalised Medicine · Rare Diseases · Health Systems
- ProjectGrid: 3-column card layout
- ProjectCard: title, stage badge (colour by readiness), specialty, lead researcher,
  brief description, "View details" link

### PassportPage.jsx
Layout:

Top half — My Passport:
- Large PassportCard component:
  - Dark navy background, rounded corners, gold/silver/bronze tier visual
  - Tier name centred in large serif font
  - "X / Y events this year" below
  - Progress ring showing completion
  - "Past Gold" small badge if user.past_gold = true
  - Year displayed (2026)

- QR Scan section:
  - Input field (label: "Enter event QR code")
  - Scan button → POST /passport/scan
  - Success: animated stamp appearing + "Added to your passport!" toast
  - If already scanned: "You've already scanned this event"

Bottom half — Event List:
- Two column grid: "Attended" (with dates) | "Upcoming" (not yet attended)
- Each event shows: name, type badge, date, attended/not-attended status

Right sidebar (desktop) — Reward Tiers:
- Bronze: 3 events → Profile badge + featured in directory
- Silver: 6 events → Priority grant application access
- Gold: All {n} events this year → Research grant contribution awarded
- Annual reset note: "Tiers reset on 1 January. Past Gold members are permanently recognised."

---

## Notifications System

### Frontend (useNotifications.js + NotificationBell.jsx)

```javascript
// Poll GET /notifications every 30 seconds
// NotificationBell in NavBar shows red badge with unread_count
// Clicking bell opens dropdown showing last 10 notifications
// Each notification: icon (by type) + title + body + relative timestamp
// Clicking a notification: mark as read + navigate to action_url
```

Notification types and icons:
- `match` → brain/AI icon, teal — "You've been matched to a challenge"
- `connection_request` → person icon, seafoam — "{name} wants to connect"
- `message` → chat icon, teal — "New message from {name}"
- `passport` → stamp icon, amber — "You've reached {tier} tier!"
- `system` → bell icon, gray — general announcements

---

## Sign-Up & Auth Pages

### SignupPage.jsx
Fields:
- Full name
- Work email (validated against blocked domains on blur — show error "Personal email
  addresses are not accepted. Please use your institutional email.")
- Password (min 8 chars, show/hide toggle)
- Confirm password
- Role (dropdown: Clinician / Researcher / Industry Partner)
- Institution name (free text)
- Specialty area (dropdown, shown only for Clinician + Researcher roles)

Submit → POST /auth/signup
Success → Show: "Check your inbox. We've sent a verification email to {email}."

### LoginPage.jsx
- Email + password
- "Log In" button
- "Forgot password?" link → /auth/forgot-password
- "Don't have an account? Sign up" link → /auth/signup
- "Log In" button is in the **top left of the NavBar** on the landing page (not just inside LoginPage)

### ForgotPasswordPage.jsx
- Email input
- Submit → POST /auth/forgot-password
- Always show: "If that email is registered, a reset link has been sent."

### ResetPasswordPage.jsx
- New password + confirm (token comes from URL param)
- Submit → POST /auth/reset-password
- Success → redirect to login with success toast

### VerifyEmailPage.jsx
- Token comes from URL param (from verification email link)
- On mount: call GET /auth/verify/{token}
- Success → "Email verified! You can now log in." + button to LoginPage
- Error → "This link has expired or is invalid. Request a new one."

---

## Demo Personas & Scripts

### Demo Persona 1 — Clinician

**Login:** `clinician@rhip.edu.au` / `DemoPass1!`

**Demo script:**

1. Log in → land on DashboardPage
2. Navigate to Challenge Board
3. Fill ChallengeForm:
   - Title: "Treatment-resistant depression in young adults"
   - Description: "I'm seeing increasing numbers of young adult patients aged 18–30 who
     have failed two or more antidepressant trials. I'm looking for research partners
     exploring neurostimulation or ketamine-based approaches, and interested in active
     trials we could refer patients to."
   - Specialty: Mental Health & Neuroscience
4. Submit → watch matching spinner → top 3 matches appear:
   - #1 Prof. Sarah Chen (~92%) — "Research on treatment-resistant depression and
     neurostimulation directly aligns with the clinical gap described."
   - #2 Dr. Rachel Huang (~78%) — "Digital mental health tools for bipolar/depression
     monitoring complement clinical referral pathway development."
   - #3 A/Prof. Maya Patel (~65%) — "Comorbidity expertise relevant to complex
     treatment-resistant presentations."
5. Click "Start a conversation" on Match #1
6. Type: "Hi Prof. Chen, I've been seeing many patients who have failed multiple
   antidepressant trials. Your work on TMS and ketamine caught my attention — would love
   to discuss a possible clinical research partnership."
7. Send → "Connection request sent" state
8. Show Notifications bell → new in-app notification visible

### Demo Persona 2 — Investor (public landing page)

**No login required.**

**Demo script:**

1. Open `http://localhost:5173` (the landing page)
2. Point out Log In button top left
3. Scroll through: hero KPIs → About RHIP → KPI tabs (switch between Investor/Government/Community)
4. Show Innovation in Progress section → highlight stage 7–8 projects
5. Scroll to HTH section → show occupancy rate + tenant form
6. Scroll to Contact section → fill out investor contact form (demo: name + email + message)
7. Submit → "Message received" success state

---

## Passport Annual Reset — Logic

```python
# Run on January 1 each year
# Can be triggered manually from admin panel for demo

async def reset_passport_year(db: Session):
    new_year = datetime.now().year
    
    # Step 1: Award past_gold to anyone who was Gold last year
    gold_tiers = db.query(RewardTier).filter(RewardTier.tier == "gold").all()
    for tier in gold_tiers:
        tier.user.past_gold = True
    
    # Step 2: Reset all tiers
    db.query(RewardTier).update({
        "tier": "none",
        "events_attended": 0,
        "grant_awarded": False,
        "year": new_year,
        "last_calculated": datetime.now()
    })
    
    db.commit()
    
    # Step 3: Send reset notification to all users with a passport entry
    users_with_passport = db.query(User).join(PassportEntry).distinct().all()
    for user in users_with_passport:
        db.add(Notification(
            user_id=user.id,
            type="passport",
            title="Passport year reset",
            body=f"The passport year has reset. Start attending 2026 RHIP events to earn rewards.",
            action_url="/passport"
        ))
    db.commit()
```

Tier thresholds:
- Bronze: 3 events attended
- Silver: 6 events attended
- Gold: all events in the year (total set by however many Events are created by admin)

---

## Environment Variables

```bash
# backend/.env
SECRET_KEY=change-this-to-a-long-random-string
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=60
REFRESH_TOKEN_EXPIRE_DAYS=7

# Qwen AI
QWEN_URL=http://localhost:11434
QWEN_MODEL=qwen2.5:7b
# Cloud fallback:
# QWEN_URL=https://dashscope.aliyuncs.com/compatible-mode/v1
# QWEN_API_KEY=your-dashscope-key
# QWEN_MODEL=qwen-turbo

# Database
DATABASE_URL=sqlite:///./rhip_connect.db

# Email — use Mailtrap in development
MAIL_USERNAME=your-mailtrap-username
MAIL_PASSWORD=your-mailtrap-password
MAIL_FROM=noreply@rhipnexus.edu.au
MAIL_FROM_NAME=RHIP Connect
MAIL_SERVER=smtp.mailtrap.io
MAIL_PORT=587
MAIL_STARTTLS=True
MAIL_SSL_TLS=False

# Admin
ADMIN_EMAIL=admin@rhip.edu.au
FRONTEND_URL=http://localhost:5173
```

```bash
# frontend/.env
VITE_API_BASE_URL=http://localhost:8000/api/v1
```

---

## Startup Commands

```bash
# 1. AI (run first, leave running)
ollama pull qwen2.5:7b
ollama serve

# 2. Backend
cd backend
pip install fastapi uvicorn sqlalchemy python-jose bcrypt httpx \
            python-dotenv pydantic fastapi-mail aiofiles
uvicorn app.main:app --reload --port 8000
# First run only:
python -m app.seed

# 3. Frontend
cd frontend
npm create vite@latest . -- --template react
npm install axios react-router-dom tailwindcss @headlessui/react \
            @heroicons/react react-hot-toast date-fns
npx tailwindcss init -p
npm run dev
# Runs on http://localhost:5173

# 4. Email testing (Mailtrap)
# Sign up at mailtrap.io → free plan → copy SMTP credentials to .env
# All emails go to your Mailtrap inbox — nothing actually sent to real addresses
```

---

## Build Priority

**Week 4–5 (build these first):**
1. Backend: `main.py`, `database.py`, `models.py`, `auth.py`, `seed.py`
2. Auth flow end-to-end: signup → email verify → login → JWT
3. Landing page (static + KPI API)
4. Expertise directory (search + profiles)
5. **AI matching engine** ← highest priority demo item

**Week 6–7 (parallelise across team):**
6. Challenge board + AIMatchPanel + thread initiation
7. Messaging + notifications (in-app + email)
8. Pipeline page
9. Passport + QR scan + tier calculation
10. Admin panel (basic)

**Week 8–9:**
11. HTH tenant form + investor contact form (email wiring)
12. KPI audience tabs on landing page
13. Polish, demo rehearsal, report

---

## The Demo — What Must Work on Presentation Day

In order of importance:
1. Public landing page loads with real KPIs and renders all sections cleanly
2. Clinician posts a challenge → AI returns top 3 matches with reasoning → match card shows
3. Clinician types opening message → sends → notification appears in bell
4. Email notification received (show Mailtrap inbox on screen if needed)
5. Investor contact form submits successfully

Everything else is secondary to these five moments.

---

*Built for CDEV3000/6000, Semester 1 2026, UNSW Sydney.*
*Stack: React + FastAPI + Qwen AI · Aim 3: Precinct-wide Impact & Communications Framework*