# RHIP Connect — System Story & Audience Paths

Presentation-ready diagrams of how the platform works. Verified **precinct members** (clinicians, researchers, PhD students, and related roles) share **one Challenge Board** — anyone can post and get matched.

**Hosting (demo / shared environment):** React SPA on **Vercel**; FastAPI API in a **Docker** image on **Railway**; **PostgreSQL** on Railway. Local development can still use SQLite.

---

## 1. System story (problem → outcomes)

```mermaid
flowchart LR
    subgraph problem ["1. Problem"]
        need(["Siloed needs and expertise across RHIP"])
    end

    subgraph audiences ["2. Who it is for"]
        members["Precinct members"]
        industry["Industry"]
        investor["Investor"]
        publicAud["Government and Community"]
    end

    subgraph frontend ["3. What people use"]
        web["React app on Vercel"]
        landing["Landing and KPIs"]
        directory["Directory"]
        challenges["Challenge Board"]
        knowledgeMap["Knowledge Map"]
        pipeline["Pipeline"]
        passport["Passport"]
        portals["Community and Government"]
    end

    subgraph backend ["4. Behind the scenes"]
        api["FastAPI in Docker on Railway"]
        auth["Auth and secure login"]
        data[("PostgreSQL on Railway")]
    end

    subgraph intelligence ["5. Matching and data"]
        ai{{"AI matching"}}
        pubmed["PubMed enrichment"]
        mapAff["Map affinity"]
        firebase["Firebase Auth"]
    end

    subgraph outcomes ["6. Outcomes"]
        matched(["Matched collaborators"])
        investable["Investable pipeline"]
        impact["Precinct impact"]
        engaged["Event engagement"]
    end

    need ==> members & industry & investor & publicAud
    members & industry & investor & publicAud ==> web
    web --> landing & directory & challenges & knowledgeMap & pipeline & passport & portals
    web ==>|"HTTPS"| api
    api --> auth & data
    auth -.-> firebase
    challenges ==>|"Post challenge"| ai
    ai ==>|"Top matches"| matched
    matched ==>|"Messages"| engaged
    knowledgeMap --> mapAff
    pipeline --> investable
    landing --> impact
    portals --> impact
    passport --> engaged
    data -.-> pubmed
```

**How to read it:** Needs sit in silos → different audiences arrive → the website (Vercel) and API (Railway + Docker) connect them → AI matches people on the Challenge Board → collaboration, pipeline visibility, and engagement. Shared demo data lives in **PostgreSQL**, not a laptop SQLite file.

**Data sources:** profile publications and Knowledge Map co-author edges come from **PubMed** (seed + cache). OpenAlex is not the primary paper source on this branch — see [`DATA_SOURCES.md`](./DATA_SOURCES.md).

---

## 2. All audience paths (where they meet)

```mermaid
flowchart TD
    landing(["Landing — everyone starts here"])

    subgraph publicNoLogin ["Public — no login"]
        community["Community: districts, services, specialists"]
        government["Government: KPIs, stories, briefing, export"]
        investorPublic["Investor public: KPIs, contact, HTH teaser"]
    end

    subgraph authEntry ["Sign up or log in"]
        auth{{"Create account or sign in"}}
        dashboard["Dashboard"]
    end

    subgraph signedIn ["Signed-in paths"]
        members["Precinct members\nclinicians, researchers, PhD students, related roles"]
        industry["Industry partners"]
        investorAuth["Investor portal"]
    end

    subgraph hubs ["Where paths meet"]
        challengeBoard["One Challenge Board\npost + my challenges + matches for you"]
        messages["Messages"]
        directory["Directory"]
        mapHub["Knowledge Map"]
        pipeline["Pipeline"]
        passport["Passport"]
        adminOps["Admin: forms and content"]
    end

    impact(["Shared precinct impact and collaboration"])

    landing --> community & government & investorPublic & auth
    auth ==> dashboard
    dashboard --> members & industry & investorAuth

    members ==> challengeBoard
    challengeBoard ==> messages
    members --> directory & mapHub & pipeline & passport
    industry --> directory & mapHub & pipeline
    investorAuth --> mapHub & pipeline
    government --> pipeline

    community & government & investorPublic -->|"Forms and content"| adminOps
    messages & mapHub & pipeline & passport --> impact
```

**Challenge Board (one board):** Verified precinct members share the same experience — post a need, review AI Top 3, send an intro, and see **Matches for you** when others post. AI never matches you to your own challenge. Industry and Investor do not use this board.

---

## 3. Follow a member journey (example)

```mermaid
flowchart TD
    meet(["Meet a precinct member\nwith a ward data problem"])

    landing["Public Landing\nhero, KPIs, projects, partner CTAs"]
    auth{{"Create account or sign in\nwork email verified"}}
    home["Dashboard home"]

    directory["Directory\nsearch, filter, open profile"]
    post["Challenge Board\npost a need or opportunity"]
    ai{{"AI finds Top 3 matches\namong public profiles"}}
    chat["Send intro and chat in Messages"]
    mapView["Knowledge Map\nsearch, lenses, find a bridge"]
    passport["Passport\nscan event QR, earn tiers"]

    outcome(["Collaboration started\nengagement tracked"])

    meet --> landing
    landing -->|"Log in or create account"| auth
    auth ==> home
    home --> directory
    directory --> post
    post ==> ai
    ai ==> chat
    chat --> mapView
    mapView --> passport
    passport ==> outcome
```

**Same board for everyone with Challenges access:** clinicians, researchers, PhD students, and related verified members. The example above is one story; any of those people can post or be matched.

---

## 4. Challenge Board in plain language

| What the member does | Behind the scenes |
|----------------------|-------------------|
| Opens Challenge Board | Available to verified clinician / researcher / admin access (includes PhD and related profiles under those access roles) |
| Posts a challenge | Saved; AI matching runs; poster excluded from candidates |
| Reviews Top 3 matches | Scores + short reasons from AI (or mock scoring) |
| Sends an intro | Opens a Messages thread; other person is notified |
| Sees Matches for you | Their profile was selected for someone else’s challenge |

---

## 5. Deployed shape (shared demo)

```mermaid
flowchart LR
    users[Users] --> vercel[Vercel SPA]
    vercel -->|"HTTPS /api/v1"| railway[Railway FastAPI Docker]
    railway --> pg[(PostgreSQL)]
    railway --> firebase[Firebase Auth]
```

| Piece | Where it runs |
|-------|----------------|
| React + Vite frontend | **Vercel** |
| FastAPI backend | **Railway** (built from repo **Dockerfile**) |
| Database | **PostgreSQL** on Railway |
| Auth emails / ID tokens | **Firebase Auth** |

Seed the Railway database once (`python -m app.seed`) so directory and demo accounts appear for everyone using the Vercel link. Local SQLite is only for laptop development.

---

## Related boards (FigJam, if you still use them)

- [System Story](https://www.figma.com/board/JnhtskQ71AS6ol2cM2tfse)
- [Follow a User Journey](https://www.figma.com/board/hJCmC74D8gNJX44Udei4wd)
- [All Audience Paths](https://www.figma.com/board/PKz347tILC6qELDsC0W7NR)

This markdown file is the up-to-date source for presentations when FigJam cannot be edited.
