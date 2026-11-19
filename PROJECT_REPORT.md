# MSME Scheme Recommendation Platform

A full-stack web application that helps **Micro, Small and Medium Enterprises (MSMEs)** in India find government schemes they may qualify for. A user describes their business once; the system checks every scheme's eligibility rules, explains why each scheme matched, and ranks the matches by relevance.

> Scheme data in this project is a set of **unverified summaries** written for development (see [docs/DATA_VERIFICATION.md](docs/DATA_VERIFICATION.md)). The app says so on every scheme page. It is not an official government service.

Report sections on testing, evaluation, conclusion, limitations and future work: [docs/REPORT_SECTIONS.md](docs/REPORT_SECTIONS.md).

---

## 1. Overview

Finding a suitable scheme is hard: each scheme has its own rules on age, gender, state, project cost, income, education, experience, business type and social category, and these rules are spread across many portals.

The platform:

1. collects a business profile (and saves it, so the user does not retype it),
2. runs a **rule-based eligibility engine** (Node.js) over every scheme and sorts each one into *eligible*, *possibly eligible* (some information missing) or *not eligible*,
3. sends the eligible schemes to a **Python ranking service** that scores how relevant each one is,
4. shows the ranked list with a match score and a "Why this matched" explanation,
5. lets the user browse and filter all schemes and save the ones they like.

```text
Sign up / Sign in
      |
Business profile form  ----------------------> saved in user_profiles
      |
POST /api/schemes/recommend (Node)
      |-- eligibility engine: eligible / possibly eligible / not eligible + reasons
      |-- ranking: Python service (TF-IDF + feature fit)  or  built-in fallback scorer
      |
Ranked results with score and "Why this matched"
      |
View details  |  Save (heart)  |  Browse & filter all schemes
```

---

## 2. Features

### Authentication and account
- Sign up, sign in, sign out; passwords hashed with bcryptjs
- JWT authentication (7-day tokens), protected routes, session kept in localStorage and re-checked with the server on page load
- Forgot password with a 6-digit OTP (generated with `crypto.randomInt`, valid 5 minutes). **In this version the OTP is printed in the backend console, not emailed** (see Limitations)
- View and edit name and phone; change password; delete account (saved schemes and profile are deleted with it)

### Recommendations
- Business profile form: age, gender, business type, investment, state (required); social category, special category, annual income, education, experience, new-enterprise flag, business description (optional)
- Profile saved per user and pre-filled next time
- Three tiers: **Eligible**, **Possibly eligible** (lists the missing inputs, e.g. "Add to confirm: annual income"), not eligible (hidden)
- Match score (0-100%) and "Why this matched" (ranking reasons + each rule passed)
- If the Python service is down, a fallback scorer is used and the page says so

### Scheme discovery
- Browse page with keyword search, business type, state, project cost and sort
- Filtering, search and pagination happen on the server (parameterised SQL)
- Dropdown values come from the database
- "Load more" pagination, result count, clear filters, loading / empty / error states
- Details view: who can apply, benefits, priority groups, link to the official website, unverified-data notice

### Saved schemes
- Heart button on every scheme card and on the details page
- Same saved state everywhere (home, browse, recommendations, details, My Saved Schemes)
- Optimistic update with rollback on error; double clicks ignored; signed-out users are sent to sign in

---

## 3. Tech stack

| Layer | Technology |
|---|---|
| Frontend | React 18 (Create React App / react-scripts 5), Axios, React Context + hooks, plain CSS per component |
| Backend | Node.js (ESM), Express 5, `pg` (node-postgres) with raw parameterised SQL - **no ORM**, jsonwebtoken, bcryptjs, cors, dotenv |
| Ranking service | Python 3.12, FastAPI, Uvicorn, scikit-learn (TF-IDF), joblib, Pydantic |
| Database | PostgreSQL 18 (local install or Docker container) |
| Testing | Jest + Supertest (backend), pytest (ranking service), React Testing Library (frontend) |

---

## 4. Architecture

```text
 Browser (React, :3000)
    |  Axios, JWT in Authorization header
    v
 Express API (Node, :8000)
    |-- routes/      auth, users, schemes, business-profile
    |-- controllers/ request handling, validation, consistent { success, message, data } responses
    |-- services/    eligibilityEngine.js, recommendationService.js, rankingClient.js, fallbackScorer.js
    |-- models/      SQL queries (user, scheme, profile)
    |-- middleware/  JWT auth, error handler (no stack traces to clients)
    |
    |-- SQL --> PostgreSQL (:5432)
    |
    '-- HTTP POST /rank (1.5 s timeout) --> Ranking service (FastAPI, :8090)
                                              |-- TF-IDF model built by scripts/build_model.py
                                              '-- scoring.py: weighted relevance score + reasons
```

**Why two services?** Eligibility is hard rules that must be exact and explainable, so it lives next to the data in Node. Relevance ranking is a separate concern that may change (or be replaced by a learned model later), so it runs as its own Python service that Node can do without: if it is slow or down, Node uses `fallbackScorer.js`, which implements the same formulas minus the text-similarity part, and the response says `ranked_by: "fallback"`.

### Eligibility engine (`Backend/services/eligibilityEngine.js`)
- Pure functions, no database access, so it is easy to test.
- Reads the rules vocabulary in [docs/RULES_SCHEMA.md](docs/RULES_SCHEMA.md); also understands older rule keys from the original database through an alias table.
- For each rule: *passed* (value given and it fits), *failed* (value given and it does not fit) or *unknown* (value not given). Any failed rule = not eligible; otherwise any unknown = possibly eligible; otherwise eligible.
- Handles age limits with relaxation for women / SC/ST / PwD / transgender applicants, state (with all-India schemes), project cost range, income cap, experience, education level, business type, social and special category, new-enterprise-only schemes.

### Ranking (`ranking-service/`)
Score = weighted sum of five signals, each 0-1; missing signals are dropped and the weights re-normalised; possibly-eligible schemes are multiplied by 0.9.

| Signal | Weight | Meaning |
|---|---|---|
| Text similarity | 0.35 | TF-IDF cosine similarity between the business description and the scheme text |
| Investment fit | 0.25 | how well the project cost sits inside the scheme's range |
| Benefit size | 0.15 | normalised subsidy / loan amount |
| Specificity | 0.15 | state-specific, category-specific or priority-group schemes rank above generic ones |
| Age fit | 0.10 | distance from the scheme's age limits |

The weights were set by hand; nothing is learned, because there is no user-interaction data yet. The TF-IDF artefact is reproducible (no randomness, version = hash of corpus + settings).

---

## 5. Database design

Created by `Backend/db/schema.sql` (`npm run db:migrate`). The migration is additive and idempotent: it never drops or changes existing data, and it also repairs databases restored from the original dump (see [docs/DB_SETUP.md](docs/DB_SETUP.md)).

| Table | Key columns |
|---|---|
| `users` | id, email (unique), password_hash, name, phone, reset_otp, reset_otp_expires, created_at, updated_at |
| `schemes` | id, name, description, business_category, max_investment, location, rules (JSON), benefits (JSON), beneficiary_categories (JSON array), verified, official_source, created_at, updated_at |
| `user_saved_schemes` | id, user_id -> users (ON DELETE CASCADE), scheme_id -> schemes (ON DELETE CASCADE), saved_at, UNIQUE(user_id, scheme_id) |
| `user_profiles` | user_id (PK, -> users, cascade), age, gender, social_category, special_category, business_category, investment, state, annual_income, education, experience_years, is_new_enterprise, business_description, updated_at |

Indexes: scheme business_category, location, name and LOWER(name); saved schemes by user.

---

## 6. REST API

All responses: `{ success, message?, data?, errors? }`. Validation errors return 400 with `errors: [{ field, message }]`.

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/api/health` | - | Health check |
| POST | `/api/auth/signup` | - | Register; returns user + token |
| POST | `/api/auth/login` | - | Sign in; returns user + token |
| GET | `/api/auth/me` | JWT | Current user |
| PUT | `/api/auth/profile` | JWT | Update name / phone |
| POST | `/api/auth/reset-password/request` | - | Create an OTP |
| POST | `/api/auth/reset-password/verify-otp` | - | Check an OTP |
| POST | `/api/auth/reset-password` | - | Set a new password with the OTP |
| GET / PUT | `/api/users/profile` | JWT | Account details |
| PUT | `/api/users/change-password` | JWT | Change password |
| DELETE | `/api/users/account` | JWT | Delete account (cascades) |
| GET / PUT | `/api/business-profile` | JWT | Saved business profile |
| POST | `/api/schemes/recommend` | JWT | Body `{ profile?, save_profile? }` (no profile = use saved one). Returns ranked schemes with `tier`, `score`, `reasons`, `eligibility`, plus `ranked_by` (`ml` / `fallback`) and `model_version` |
| GET | `/api/schemes` | - | `?category=&state=&q=&investment=&sort=name\|investment\|newest&order=asc\|desc&page=&limit=` -> `{ schemes, pagination }` |
| GET | `/api/schemes/filters` | - | Distinct business types and states for the dropdowns |
| GET | `/api/schemes/:id` | - | One scheme (400 bad id, 404 missing) |
| POST | `/api/users/schemes/save` | JWT | Save `{ scheme_id }` (idempotent) |
| DELETE | `/api/users/schemes/save/:id` | JWT | Unsave (idempotent) |
| GET | `/api/users/schemes/saved` | JWT | Saved schemes, newest first |
| GET | `/api/users/schemes/saved/ids` | JWT | Ids of all saved schemes in one call |
| GET | `/api/users/schemes/save/:id` | JWT | Is one scheme saved? |

Ranking service: `GET /health`, `POST /rank` (see [ranking-service/README.md](ranking-service/README.md)).

---

## 7. Security

- Passwords hashed with bcryptjs; generic "Invalid email or password" on failed login
- JWT on all user-data routes; tokens expire after 7 days; the frontend clears the session on any 401
- All SQL parameterised; sort columns whitelisted; LIKE wildcards escaped in search
- Input validation on profile, discovery query and ids
- Global error handler: no stack traces or database messages reach the client
- CORS restricted to configured origins
- Secrets only in `.env` files, which are git-ignored
- Known gaps are listed under Limitations in [docs/REPORT_SECTIONS.md](docs/REPORT_SECTIONS.md)

---

## 8. Project structure

```text
Backend/            Express API (routes, controllers, services, models, middleware, db/, scripts/, tests/)
Frontend/           React app (components/, context/, services/api.js, utils/, styles/, __tests__/)
ranking-service/    FastAPI ranking service (app/, scripts/build_model.py, tests/)
evaluation/         Offline evaluation: personas, reference implementation, run_eval.mjs, results/
docs/               Rules schema, DB setup, data verification, plan, progress, report sections, user-study kit
scripts/            test-all.sh / test-all.ps1
```

---

## 9. Getting started

See the step-by-step [README.md](README.md). Short version:

```bash
# 1. Database (Docker) - or install PostgreSQL natively, see docs/DB_SETUP.md
docker run -d --name msme-postgres -e POSTGRES_PASSWORD=<password> -p 5432:5432 -v msme_pgdata:/var/lib/postgresql postgres:18

# 2. Backend
cd Backend && npm install && copy .env.example .env   # edit DB_PASSWORD, JWT_SECRET
npm run db:migrate && npm run db:seed && npm run dev   # :8000

# 3. Ranking service (optional - the app works without it)
cd ranking-service && python -m venv .venv && .venv\Scripts\activate
pip install -r requirements.txt && python scripts/build_model.py
uvicorn app.main:app --port 8090                       # then set RANKING_SERVICE_URL in Backend/.env

# 4. Frontend
cd Frontend && npm install && npm start                 # :3000
```

Environment variables: [Backend/.env.example](Backend/.env.example), [Frontend/.env.example](Frontend/.env.example).

---

## 10. Testing and evaluation (summary)

| Suite | Command | Result (last run) |
|---|---|---|
| Backend (Jest + Supertest, incl. real-Postgres tests) | `cd Backend && npm test` | 212 / 212 passed, about 77% line coverage (eligibility engine about 98%) |
| Ranking service (pytest) | `cd ranking-service && pytest` | 31 / 31 passed |
| Frontend (React Testing Library) | `cd Frontend && npm run test:ci` | 42 / 42 passed |
| All three | `scripts/test-all.ps1` or `scripts/test-all.sh` | all passed |
| Recommendation quality | `cd Backend && npm run eval` | see [evaluation/results/results.md](evaluation/results/results.md) |

Details and discussion: [docs/REPORT_SECTIONS.md](docs/REPORT_SECTIONS.md).

---

## 🎓 What I Learned

Through this project, I gained practical experience in:

* Building a full-stack web application
* Designing REST APIs
* React frontend development
* Node.js and Express.js backend development
* PostgreSQL database design
* JWT authentication
* Password security using bcryptjs
* Protected API routes
* Frontend-backend integration using Axios
* Environment-based configuration
* Structuring a scalable application
* Writing an explainable rule engine and testing it with edge cases
* Running a separate Python service and designing a fallback when it is unavailable
* Evaluating a recommender honestly with offline metrics (Precision@k, NDCG)

---

## 👨‍💻 Developer

**Bharath Ganesh**

Bachelor's in Electrical and Electronics Engineering
Full-Stack Developer | React | Node.js | Express.js | PostgreSQL

---

## 📄 License

This project was developed for educational and portfolio purposes.
