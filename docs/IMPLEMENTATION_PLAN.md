# Implementation Plan — MSME Scheme Recommendation Platform

Status: **PLAN ONLY.** No code has been changed. Phases start only on `start phase N`.
Audit basis: full read of `Backend/`, `Frontend/src/`, `PROJECT_REPORT.md`. The app was **not booted**: there is no `.env`, no `node_modules`, and `psql` is not installed on this machine, so nothing below claims runtime behaviour.

---

## 0. Revision after decisions (supersedes anything below that conflicts)

The open questions were answered by delegation ("decide yourself"). Resulting changes:

- **Additive-only DB changes.** The live DB may hold data. Nothing is dropped, renamed, truncated or type-changed. Therefore: **no JSON→JSONB conversion** (columns stay `JSON`), no `pg_trgm`/GIN indexes, no separate `db/migrations/` folder — one idempotent `Backend/db/schema.sql` (`IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS`) applied by `npm run db:migrate`. New `schemes.verified` / `schemes.official_source` columns record provenance.
- **Seed data:** 19 placeholder schemes, all `verified=false`, inserted only if no scheme with the same name exists (existing rows untouched). Verification TODO: `docs/DATA_VERIFICATION.md`.
- **Engine must read legacy rule keys** (Phase 2): existing live rows may use the old vocabulary (`max_investment`, `state`, …); an alias table maps them to the normalised keys (see `docs/RULES_SCHEMA.md`). Also accept `beneficiary_categories` as array *or* object.
- **Tiers:** `eligible` + `possibly_eligible`; possibly-eligible results list the missing inputs. `/recommend` authenticated; `user_profiles` added (table created in Phase 1, used from Phase 3).
- **Postgres is not installed on the dev machine**: DB-dependent steps are written but verified only when Postgres exists (`docs/DB_SETUP.md`). DB tests skip unless `DB_NAME` ends in `_test`.
- **Phase 1 actual scope** (changed from §4): `utils/validate.js` and `middleware/validate.js` are deferred to Phase 3 (first user of request validation) to avoid dead code; jest only (no `cross-env` needed, Jest sets `NODE_ENV=test`); `app.js` split from `server.js` so Supertest can import the app.
- **Git workflow:** one local branch per phase (`phase-N-...`), commit locally at phase end, never push, never touch `main`. Fake homepage stats/email removal is its own commit.
- **Navigation / collections:** no React Router; single Saved list (as planned).
- **Phase 3 as built:** business profile lives at `/api/business-profile` (not `/api/profile`); `/api/meta/options` moves to Phase 5; the recommend response keeps its flat `data` list.

---

## 1. Audit

### 1.1 The five "done" items

| # | Claimed done | Verdict | Evidence |
|---|---|---|---|
| 1 | Express project structure + server | **Mostly done** | `Backend/server.js` boots, mounts 3 routers. Missing: global error handler (controllers call `next(error)` → Express default handler, leaks stack in dev), CORS allows `:5173` not CRA `:3000` (`server.js:25-28`), no `/health`. |
| 2 | PostgreSQL setup + scheme data model | **Partial / overstated** | No `schema.sql`, migration, or seed in repo; tables exist only as SQL text in `PROJECT_REPORT.md:207-253`. `models/scheme.js` has only `create` + `findAll`. No indexes. No scheme data in repo → recommendations cannot be reproduced by anyone else. `PROJECT_REPORT.md:104` says Sequelize; code uses raw `pg` (`config/db.js`). |
| 3 | Sign up, sign in, OTP password reset | **Done, with caveats** | Works by code reading. OTP is only `console.log`ged (`authController.js:241`), stored plain, `Math.random` (`models/user.js:83`), 90 s expiry, no rate limit. The `resetToken` JWT from verify-otp (`:279`) is never used; `resetPassword` re-checks the OTP itself. Login returns "Invalid user" vs "Invalid password" (user enumeration, `:99/:109`). |
| 4 | JWT authorization + profile management | **Partial** | JWT middleware fine (`middleware/auth.js`) but token lives 365 days (`authController.js:12`). "Profile" = name/email/phone only. **Two** `updateProfile` handlers: `authController.js:165` (validates phone) and `userController.js:137` (allows email change, no uniqueness/format check, no validation); frontend uses the first via `/auth/profile`. No business/eligibility profile exists. |
| 5 | React front end, responsive UI, API client, session persistence | **Mostly done** | Components + per-component CSS exist; `api.js` has interceptor + localStorage session. Gaps: session restored from localStorage without validating token and no 401 interceptor (expired token = silent failures); responsive CSS not visually verified (not run). **Hard-coded fake stats** in `Homepage.jsx:229-238` ("10K+ Businesses Helped", "₹1000Cr Funds Distributed", "50+" fallback) and a fake `.gov.in` support email (`:477`) — must go before submission (see "no invented metrics"). |

### 1.2 Pending modules — what already exists

**Recommendation (partial, buggy)** — `schemeController.js`
- `checkEligibility` (`:4-51`) confirmed buggy:
  - `:38` dangling `if (rules.min_education && user.education)` with no body → it swallows the next `if` (`:40`) so the `max_previous_subsidy` check only runs when the education condition is true.
  - `:10-17` age logic is contradictory: `max_age_special` applied only if `beneficiary_category` truthy, else an `else` branch that checks `max_age_general` only if `max_age_special` also exists; plain `max_age` at `:19`.
  - Truthiness guards (`user.investment &&`, `user.income &&`) skip a legitimate value of `0` and silently pass on missing data.
  - `age` is not validated → `undefined < n` is `false`, so a missing age passes `min_age`.
  - Education, `business_category`, `social_category` are never compared. `user.experience` default `0` is sent by the form, so "unknown" can't be told from "0 years".
  - Duplicate vocab for the same concept: `max_investment`/`max_project_cost`, `state`/`domicile`, `min_experience`/`min_experience_years`, `max_income`/`max_family_income`, `max_previous_subsidy`/`prior_subsidy_limit`.
  - `user.location !== rules.state` strict compare (`:25`): form sends `tamil_nadu` (snake_case), no "All India" handling, no case folding.
  - `beneficiary_categories` is treated as an **object** (`Object.keys`, `:43-45`) but the frontend treats it as an **array** (`RecommendedSchemes.jsx:159-163`, `SchemeDetails.jsx:141-148`). One of them is wrong; real DB shape is unknown (no seed).
  - Form `beneficiary_category` is one value, `sc_st`, while `social_category` is `sc`/`st`/`obc` — overlapping, inconsistent.
- No scoring/ordering/reasons. Every card hard-codes "Perfect Match" (`RecommendedSchemes.jsx:79`).
- `POST /api/schemes/recommend` is **unauthenticated** (`routes/schemes.js:7`), profile is not stored, and no input validation (`req.body` used raw). (The UI gates the form behind login, the API does not.)
- Response is `data: [...]` — no pagination/ranking metadata.

**Discovery (mostly missing)**
- `GET /api/schemes` returns everything (`Scheme.findAll` = `SELECT *`), no query params.
- `GET /api/schemes/:id` **does not exist** though `api.js:201` calls it.
- Homepage does filter/search **client-side** on the full list (`Homepage.jsx:81-116`), category list derived from loaded data, **no location filter**, shows 2 cards then max 9 (`:143-145`) — no pagination.
- `Homepage.jsx:353` reads `scheme.eligibility` which the schema does not have.

**Collections (backend works, frontend partial)**
- Backend save/unsave/saved/check exist (`userController.js:25-130`, routes `users.js:17-20`). Looks correct *if* `UNIQUE(user_id, scheme_id)` exists (report says yes). Gaps: `scheme_id`/`schemeId` not type-validated (non-numeric → pg error → 500); no bulk "which of these are saved"; `checkSchemeSaved` response `{isSaved}` is consistent with `api.js` but unused.
- Frontend: save state lives **only** in `Homepage.jsx` (`savedSchemes`, `:16`). `RecommendedSchemes` and `SchemeDetails` have no save control. `MyCollections` removes locally but does **not** tell Homepage → hearts go stale. `Profile.jsx:147` passes `user.savedSchemes` which is never populated (harmless, it refetches). Toggle uses a stale closure (`:57-79`), no optimistic update/rollback. Save button is a "+" not a heart.

**Cross-cutting**
- `App.js` has no router (state-based `currentPage`); the recommendation form is an inline section on the home page, results held in `App` state.
- No tests anywhere; no `.env.example`; `PORT=5000` in report vs `8000` in code/frontend; `DATABASE_URL` in report vs `DB_HOST/DB_PORT/...` in `config/db.js`; `pool.on('error') → process.exit(-1)`; `sequelize` dependency unused; `services/` + `utils/` folders documented but absent; `package-lock.json` is git-ignored (builds not reproducible).
- No real scheme data anywhere in repo.

---

## 2. Decisions (with justification)

| Topic | Decision | Why |
|---|---|---|
| Eligibility output | **Three tiers**: `eligible` (all rules pass), `possibly_eligible` (nothing fails, ≥1 rule unknown because user skipped an optional field), `not_eligible` (≥1 hard fail). API returns eligible + possibly_eligible; not_eligible are excluded (optionally returned with `?include=all` for debugging/eval). | Strict filter punishes users who skip optional fields and hides schemes; tiers are honest and explainable. Cheap to build because the engine already tracks `unknownRules`. |
| Where engine runs | **JS only**, load all schemes (`SELECT *`) per request. | Scheme count is tens to low hundreds; one indexed table scan is trivial; keeps one source of truth (the pure module), unit-testable without a DB. SQL pre-filtering is used only for *discovery* (category/location/keyword), not eligibility. |
| Rules schema | JSON keys fixed to one vocabulary (§3), documented in `docs/RULES_SCHEMA.md`, validated at seed time. Column `JSON` → `JSONB`. | Removes the 5 duplicate-key aliases; enables GIN/indexing later. |
| Missing-input behaviour | Required form fields (age, gender, business_category, investment, location) must be present (validated, 400). Optional fields absent → rule goes to `unknownRules`, never a silent pass. `0` is a real value. | Explicit and testable. |
| Ranking approach | **Option A: content-based** — TF-IDF cosine (user business text vs scheme text) + feature-fit score (investment/age position inside scheme's range, benefit magnitude, category/location specificity, beneficiary match), fixed documented weights. | Needs no labels. Option B (sentence-embeddings) adds a ~100 MB model download and offline/demo risk for a 30-scheme corpus where TF-IDF is adequate. Option C (learning-to-rank) would need labels we don't have; training on labels derived from our own rules would be circular and I'd not report it as accuracy. |
| ML honesty | Weights are hand-set, not learned. Reported as "content-based ranking", evaluated against persona-derived relevance (documented as synthetic). | No fake accuracy. |
| Fallback | Node computes a deterministic score from the same feature-fit terms (no text similarity); 1.5 s timeout; response carries `ranked_by: "ml" \| "fallback"`. | Service down must not break recommendations. |
| Profile persistence | **Yes**: new table `user_profiles` (1:1 with users, `ON DELETE CASCADE`). Form pre-fills from it; "Save my profile" checkbox. Recommend endpoint becomes **authenticated** and accepts either a body (preview) or uses the stored profile. | Re-run without retyping; fixes unauthenticated endpoint. |
| Navigation | **Keep state-based nav**; add `discover` page to `App.js`. No React Router. | Migration cost: every `onNavigate` call, back-button/URL handling, deep links, and CRA test setup changes — not needed for a demo. Trade-off accepted: no deep links/URL back button. Revisit if you want shareable scheme URLs. |
| Collections | **Single "Saved" list** (no named collections). | Named lists need new table/UI/endpoints for little demo value; single list covers the requirement. |
| Backend tests | **Jest + Supertest** (ESM via `node --experimental-vm-modules`) against a separate Postgres DB `msme_test`. | Vitest also fine, but Jest matches CRA frontend test runner → one tool to explain. |
| Python service | **FastAPI** + scikit-learn, pytest. | Typed contract (pydantic), auto `/docs`, `/health`. |

---

## 3. Normalised rules vocabulary (preview — full doc is Phase 1 deliverable)

All keys optional; absent key = no constraint. Money in INR (integer), ages in years.

```json
{
  "min_age": 18, "max_age": 45,
  "max_age_relaxed": 50,               // applies if user matches any group in relaxed_age_for
  "relaxed_age_for": ["sc_st","women","pwd"],
  "genders": ["female"],
  "states": ["all_india"],             // or e.g. ["tamil_nadu"]; "all_india" = no restriction
  "min_project_cost": 0, "max_project_cost": 5000000,
  "max_annual_income": 300000,
  "min_experience_years": 0,
  "min_education": "10th",             // ordered: none<8th<10th<12th<diploma<graduation<postgraduation
  "business_categories": ["manufacturing","service"],   // [] / absent = any
  "social_categories": ["sc","st"],
  "special_categories": ["pwd","widow"],
  "max_previous_subsidy": 0,
  "is_new_enterprise_only": false
}
```
`schemes.beneficiary_categories` becomes a JSON **array** of special-category slugs (display-only "priority for"; eligibility uses `rules.special_categories`). `schemes.benefits` stays `{ subsidy_percent, max_subsidy, loan_amount, ... }`.
Canonical slugs for states / categories live in one shared file `Backend/utils/constants.js`; the Frontend dropdowns get their options from API (`/api/meta/options`) so they can't drift.

---

## 4. Phases

Order and dependencies:

```
1 Foundation ─▶ 2 Eligibility engine ─▶ 3 Profile + recommend API ─▶ 4 Ranking service ─┐
        │                                                                              ├▶ 8 Evaluation ─▶ 9 Report/user-eval kit
        └▶ 5 Discovery ─▶ 6 Collections ─▶ 7 Test hardening (frontend + coverage) ───────┘
```
Rationale: foundation (schema, seed, rules vocabulary, error handling, test DB) is what every other phase builds on. Engine before ranking because ranking only sees engine output. Discovery before collections because the save button must live in Browse. Tests are written **inside** each phase; Phase 7 fills gaps and frontend tests.

Effort is rough focused-work time for one developer.

---

### Phase 1 — Foundation & hygiene  (≈ 1 day)
**Goal:** reproducible DB, one rules vocabulary, safe server baseline, test harness.
**Why first:** every later phase needs schema, seed data, error handling and a test DB.

Create:
- `Backend/db/schema.sql` — `users`, `schemes` (`rules/benefits/beneficiary_categories` as **JSONB**), `user_saved_schemes`, `user_profiles`; indexes (`schemes(business_category)`, `schemes(location)`, GIN on `rules`, `user_saved_schemes(user_id)`, `pg_trgm`/`tsvector` on name+description for search). `CREATE ... IF NOT EXISTS`, idempotent, plus `db/migrations/001_*.sql` for upgrading your existing dev DB without data loss (JSON→JSONB, new table).
- `Backend/db/seed/schemes.seed.js` + `Backend/db/seed/schemes.data.json` — see Open Q1. Each entry has `"verified": false` and a `source_url` field; seed script prints which are unverified.
- `Backend/scripts/migrate.js`, `scripts/seed.js` (npm scripts `db:migrate`, `db:seed`).
- `Backend/utils/constants.js` (slugs), `utils/response.js` (`ok/fail`), `utils/validate.js` (small hand validators — no new dep), `middleware/errorHandler.js` (+ 404 handler), `middleware/validate.js`.
- `Backend/.env.example`, `Frontend/.env.example`, `docs/RULES_SCHEMA.md`.
- `GET /api/health`.
Modify: `server.js` (CORS from `CORS_ORIGINS` env defaulting to `http://localhost:3000`, error handler, health), `config/db.js` (support test DB via `DB_NAME` env; don't `process.exit` in tests), `Backend/package.json` (scripts; dev deps **jest, supertest, cross-env** — named here per your rule).
Remove fake stats/email from `Homepage.jsx` (replace with real `allSchemes.length`, drop the others). *(Touches frontend; small.)*

**API contract (global):** every response `{ "success": bool, "message": str?, "data": any? }`; errors `{ "success": false, "message": "...", "errors": [{field,message}]? }`, no stack.
**DB changes:** as above — flagged: JSON→JSONB and `user_profiles`; nothing destructive.
**Acceptance:** `npm run db:migrate && npm run db:seed` on empty DB gives working app; backend boots; frontend on `:3000` can call API (CORS); `GET /api/health` 200; unknown route → JSON 404; thrown error → JSON 500 without stack; `npm test` runs a smoke test against `msme_test`.
**Verification:** run migrate/seed twice (idempotent), boot server, curl health + a forced error, run smoke test. *(Needs Postgres reachable — see Open Q2.)*
**Risks:** your existing dev data shape unknown (Q1); touching `db.js`'s exit-on-error.

### Phase 2 — Eligibility engine (B1)  (≈ 1–1.5 days)
**Goal:** pure, tested, explainable engine.
**Why here:** core of the product; ranking and API depend on its output shape.

Create:
- `Backend/services/eligibilityEngine.js` — `evaluate(profile, scheme) → { schemeId, tier, eligible, passedRules[], failedRules[], unknownRules[] }`, each rule entry `{ rule, label, expected, actual, message }`; `evaluateAll(profile, schemes)`. Normalisers: state/location slug folding (case, spaces, `all_india`), education ordinal, special-category mapping (`sc_st` ⇄ `social_category`).
- `Backend/services/__tests__/eligibilityEngine.test.js` — table-driven: boundary ages (min−1, min, max, max+1), relaxed-age groups, missing optional → unknown, `0` values, gender, All-India vs specific state, project-cost range, income cap, education ordering, business-category `any`, special/social category, previous subsidy.
Modify: `schemeController.js` `recommendSchemes` delegates to engine (old `checkEligibility` deleted); keep response backward compatible for now (`data` still the list, items gain `eligibility` object) so the frontend still works until Phase 3/4.
**Missing-input behaviour (documented in `RULES_SCHEMA.md`):** profile field absent → rule in `unknownRules`; tier `possibly_eligible`. Required fields validated before engine runs.
**Acceptance:** all table tests pass; the old dangling-`if` bug has a regression test; engine has no I/O.
**Verification:** `npm test` output pasted in report.
**Risks:** rule semantics for real schemes depend on verified data (Q1); relaxed-age modelling may need one more key once real schemes are in.

### Phase 3 — Profile persistence + recommend API  (≈ 1 day)
**Goal:** authenticated, validated recommend endpoint; stored business profile.
Create: `models/profile.js`, `controllers/profileController.js`, `routes/profile.js`; `services/recommendationService.js` (load schemes → engine → ordered by tier then deterministic fallback score, placeholder for Phase 4 merge).
Modify: `routes/schemes.js` (`POST /recommend` behind `authMiddleware` + `validate`), `Frontend/RecommendationForm.jsx` (options from API, prefill from profile, save-profile checkbox, send `experience: null` when blank), `api.js` (`profileAPI`, 401 interceptor → sign-out), `RecommendedSchemes.jsx` (read tier, show "Eligible" vs "Possibly eligible — confirm X", **remove "Perfect Match"**).
**API:**
- `GET /api/profile` → `{ data: { profile: {...}|null } }`; `PUT /api/profile` body = profile fields → `{ data: { profile } }`.
- `POST /api/schemes/recommend` body `{ profile?: {...}, save_profile?: bool }` (omit `profile` ⇒ use stored; 400 if neither) →
  ```json
  { "success": true, "data": { "ranked_by": "rules", "count": 7,
    "recommendations": [ { "scheme": {...}, "tier": "eligible", "score": null,
       "eligibility": { "passedRules": [...], "failedRules": [], "unknownRules": [...] }, "reasons": [] } ] } }
  ```
**DB:** `user_profiles(user_id PK→users ON DELETE CASCADE, age, gender, social_category, special_category, business_category, investment, state, annual_income, education, experience_years, updated_at)`.
**Acceptance:** 401 without token; 400 on bad input with field errors; stored profile reused; form pre-fills.
**Tests:** Supertest — auth required, validation errors, stored vs body profile, tier output.
**Risks:** frontend contract change (`data` array → `data.recommendations`) — done atomically in this phase.

### Phase 4 — Python ranking service (B2)  (≈ 2 days)
**Goal:** ML-style ranking microservice + Node integration with graceful fallback.
Create `ranking-service/`:
- `app/main.py` (FastAPI: `GET /health`, `POST /rank`), `app/schemas.py` (pydantic), `app/features.py` (feature-fit), `app/text_model.py` (TF-IDF), `app/scoring.py` (weights in one dict + docstring), `scripts/build_model.py` (fits TF-IDF on scheme corpus pulled from a JSON export; `random_state=42`; writes `artifacts/model-<sha8>.joblib` + `artifacts/manifest.json` with corpus hash, sklearn version, weights), `tests/` (pytest), `requirements.txt` (pinned: fastapi, uvicorn, scikit-learn, joblib, pydantic, pytest, httpx), `README.md`.
- Node: `services/rankingClient.js` (fetch with `AbortController`, timeout `RANKING_TIMEOUT_MS=1500`), `services/fallbackScorer.js` (same feature-fit terms, deterministic), env `RANKING_SERVICE_URL`.
**Contract:** `POST /rank`
```json
{ "profile": { "age":32,"gender":"female","business_category":"manufacturing","investment":800000,"state":"tamil_nadu","education":"graduation","experience_years":2,"business_description":"..." },
  "schemes": [ { "id":1,"name":"...","description":"...","business_category":"...","max_investment":5000000,"benefits":{},"rules":{},"tier":"eligible" } ] }
```
→ `{ "model_version":"abc12345", "results":[ { "scheme_id":1, "score":0.82, "reasons":["Investment ₹8.0L sits comfortably within ₹0–50L limit","Description matches 'manufacturing, food processing'"] } ] }` sorted desc; empty `schemes` ⇒ empty `results` (200).
`business_description` is a new optional free-text field on the form/profile (feeds the TF-IDF side; without it TF-IDF uses category + education text only — limitation).
**Score** = fixed weighted sum (e.g. 0.35 text similarity, 0.25 investment fit, 0.15 benefit magnitude (normalised), 0.15 specificity (state/category/beneficiary match), 0.10 age-fit), clipped 0–1, tier `eligible` > `possibly_eligible` as a tie-break/penalty. Exact weights decided in-phase and printed in manifest.
Modify: `recommendationService.js` (call client → merge → on timeout/error/5xx use fallback, set `ranked_by:"fallback"`), `RecommendedSchemes.jsx` + CSS (score bar/badge, tier chip, "Why this matched" expandable from `reasons` + `passedRules`, "Basic ranking used" notice when fallback, loading/error states).
**Limitations stated up front:** no interaction data ⇒ hand-set weights; text signal is weak for short descriptions; scores are relevance heuristics, not probabilities.
**Acceptance:** service up → `ranked_by:"ml"`; kill service → still returns list with `"fallback"` within timeout+; `pytest` passes (contract, determinism: same input ⇒ same output, empty input); rebuild with same corpus ⇒ identical manifest hash.
**Tests:** pytest; Jest mocks `fetch` for timeout/500/malformed JSON.
**Dependencies (new):** Python ≥3.10 packages above; **no new npm deps** (Node 18+ `fetch`).
**Risks:** Python venv on Windows; score weights are subjective — mitigated by Phase 8 comparing against baselines.

### Phase 5 — Scheme discovery (C)  (≈ 1.5 days)
**Goal:** server-side filter/search/pagination + Browse UI.
Create: `models/scheme.js` additions (`search`, `findById`, `distinctOptions`), `routes/meta.js` or extend schemes routes, `Frontend/src/components/DiscoverSchemes.jsx` + `styles/DiscoverSchemes.css`.
**API (all parameterised SQL, whitelist for `sort`):**
- `GET /api/schemes?category=&state=&q=&min_investment=&max_investment=&sort=name|investment|newest&order=asc|desc&page=1&limit=12` →
  `{ data: { schemes:[...], pagination:{ page, limit, total, totalPages } } }`. `state` matches scheme location equal to the state **or** `all_india`. `q` uses `ILIKE` over name/description (or `tsvector` if migrated in Phase 1).
- `GET /api/schemes/:id` (integer-validated; 404 if absent).
- `GET /api/schemes/filters` → `{ data: { categories:[...], locations:[...] } }` (DISTINCT from DB; route declared **before** `/:id`).
Frontend: new `currentPage==='discover'` in `App.js`, nav link from header; filters (category, location, search with debounce, investment range optional), result count, clear filters, loading/empty/error states, "Load more"/pagination, reuse `SchemeDetails`. Homepage list becomes "featured" using `?limit=` (remove client-side filtering of full list).
**DB:** indexes from Phase 1 (verified with `EXPLAIN` in report).
**Acceptance:** each filter narrows server-side; combined filters work; `%`/`_`/quote injection strings are harmless; invalid `page/limit/sort` ⇒ 400 or clamped.
**Tests:** Supertest on filters, pagination boundaries, injection strings, `:id` 404/400; RTL for filter UI (Phase 7 if time).
**Risks:** Homepage refactor touches a 500-line file — kept to the schemes section only.

### Phase 6 — Collections / favourites (D)  (≈ 1 day)
**Goal:** one consistent saved-state everywhere.
Create: `Frontend/src/context/SavedSchemesContext.jsx` (ids set, `toggle` with **optimistic update + rollback**, loads once on login, clears on logout), `components/SaveButton.jsx` (heart, used in Recommended/Discover/Details/MyCollections; unauthenticated click ⇒ sign-in prompt via `onNavigate('signin')`).
Modify: `userController.js` (validate integer ids; add `getSavedIds`), `routes/users.js`, `api.js`, `Homepage.jsx`/`RecommendedSchemes.jsx`/`SchemeDetails.jsx`/`MyCollections.jsx` (consume context, remove local `savedSchemes`), `App.js` (provider), `Profile.jsx` (drop dead `user.savedSchemes` prop).
**API:** `GET /api/users/schemes/saved/ids` → `{ data:{ ids:[1,4,9] } }` (bulk lookup, no N+1); existing endpoints unchanged in shape; save is idempotent (already `ON CONFLICT DO NOTHING`); invalid id ⇒ 400.
**DB:** none expected; Phase 1 schema already has `UNIQUE(user_id, scheme_id)` + `ON DELETE CASCADE`. Verified by a test that deletes a user and checks rows gone.
**Acceptance:** heart state identical across all views; remove in My Collections updates Browse instantly; failed request rolls back and shows message; double-click doesn't duplicate.
**Tests:** Supertest (auth, duplicate, cascade, ids endpoint, invalid id); RTL (optimistic + rollback) in Phase 7.

### Phase 7 — Test hardening & frontend tests (E1)  (≈ 1 day)
Fill gaps: coverage report for backend; RTL tests for `RecommendationForm` validation, `RecommendedSchemes` rendering (tiers/fallback notice), `SaveButton`/context, `DiscoverSchemes` filters (mock `api.js`). Scripts: `Backend: npm test`, `Frontend: npm test -- --watchAll=false`, `ranking-service: pytest`, and root `scripts/test-all.(sh|ps1)` (CI-ready, no CI configured). Safety: test config refuses to run unless `DB_NAME` ends with `_test`.
New dev deps: `@testing-library/react`, `@testing-library/jest-dom`, `@testing-library/user-event` (Frontend).
**Acceptance:** all three suites green from a clean checkout following README steps.

### Phase 8 — Recommendation-quality evaluation (E2)  (≈ 1 day)
Create `evaluation/`: `personas.json` (≈ 25–40 synthetic personas incl. edge cases, each with `expected_eligible` **derived from rules by a documented procedure + hand-checked**), `relevance.json` (graded relevance 0–2 per persona×scheme, rubric documented — this is human-judgement-style and I'll flag it as synthetic), `run_eval.js` (+ Python helper for ML ranker calls), output `results/results.md` + `.csv`.
Metrics: eligibility precision/recall/F1 (engine vs expected), precision@k, NDCG@k (k=3,5) for **no ranking (DB order) vs rule-based fallback vs ML**. Seeded, reproducible: `npm run eval`.
**Honesty:** since relevance is synthetic and derived from the same rule vocabulary, eligibility recall/precision partly measure self-consistency; report says so. If ML ≈ fallback, that is reported as-is.
**Risk:** result quality depends on verified seed data (Q1).

### Phase 9 — User-evaluation kit, docs, conclusion (E3)  (≈ 1.5 days)
Create `docs/user-study/`: `task-script.md` (sign up → recommendations → filter → save), `consent-and-notes.md`, `questionnaire.md` (SUS 10 items + perceived-relevance 1–5 + open questions), `analysis/sus_analysis.py` (SUS scoring, task success, time-on-task, CSV in → table out) + `results-template.csv`, `SAMPLE_SIZE.md` (minimum sensible: 5 per user group finds most usability problems — Nielsen; for SUS aim ≥ 10–15 and report as *indicative, not statistically representative*; report mean ± SD and n, don't claim significance).
Modify `PROJECT_REPORT.md`: fix Sequelize→`pg`, add Python service + architecture diagram, API table, rules schema, setup for 3 services, env vars. Draft `docs/REPORT_SECTIONS.md`: Testing, Evaluation, Conclusion, Limitations, Future work — **numbers only from Phase 7/8 outputs**; user-study numbers as `[TO BE FILLED: n=__, SUS=__]` placeholders.
Add root `README.md` (quick start).

**Total estimate:** ≈ 11–12 focused days.

---

## 5. Optional hardening (flagged, not scheduled)
- OTP: send via email (nodemailer), hash OTP, `crypto.randomInt`, rate-limit + attempt cap, single-use reset token.
- JWT lifetime 365 d → 7 d (+ refresh); generic login error message; `helmet` + `express-rate-limit`.
- Remove duplicate `userController.updateProfile` (email change unvalidated).
- Commit `package-lock.json` (currently git-ignored).
- Remove unused `sequelize` dependency.

---

## 6. Open questions (most important first)

1. **Scheme data source.** There is no scheme data in the repo. Do you (a) have an existing DB dump/CSV I should normalise, (b) want me to draft ~15–25 seed entries (PMEGP, MUDRA, CGTMSE, Stand-Up India, PMFME, a few state schemes) **marked `verified:false` with `source_url` blanks for you to confirm against official portals** (msme.gov.in, udyamimitra, state sites), or (c) will you supply a list? I will not present any figure as official until you confirm it.
2. **Database access.** `psql`/Postgres isn't available in my shell and there is no `.env`. Is Postgres running locally (which version/port), and may I create a second DB `msme_test` on it? If I can't reach it, DB-dependent verification will be reported as *not run*.
3. **Existing dev data.** Does your current `schemes` table contain rows? If yes, what shape is `beneficiary_categories` (array or object) and `rules` keys — can you export it so Phase 1's migration doesn't lose it?
4. **Python.** Python 3.12.4 is present. OK to use a local `venv` inside `ranking-service/` and install fastapi/uvicorn/scikit-learn/joblib/pydantic/pytest (named in Phase 4)? Or must it run in Docker?
5. **Tier decision.** OK with `eligible / possibly_eligible` shown (not_eligible hidden), or do you want strict filter only?
6. **Profile persistence.** OK to add the `user_profiles` table and make `/recommend` authenticated (anonymous demo would stop working)?
7. **Navigation / collections scope.** Confirm: stay state-based (no React Router) and single "Saved" list (no named collections)?
8. **Phase 1 cleanup scope.** OK to remove the fake homepage stats ("10K+ businesses", "₹1000Cr") and the fake `support@msme-schemes.gov.in` contact? (Needed to honour "no invented metrics"; they're cosmetic but would be indefensible in a viva.)

**Next:** answer the questions, then type `start phase 1`.
