# Progress log

Plan: [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md). Workflow: one local branch per phase, commit locally, never push, never touch `main`. Phases start only on `start phase N`.

## Status

| Phase | Branch | Status |
|---|---|---|
| 1 Foundation | `phase-1-foundation` | Done, committed (2 commits) |
| 2 Eligibility engine | `phase-2-eligibility-engine` | Done, committed |
| 3 Profile + authenticated recommend API | `phase-3-profile-recommend` | Done, committed |
| 4 Python ranking service | `phase-4-ranking-service` | Done, committed |
| 5 Scheme discovery | `phase-5-discovery` | Done, committed |
| 6 Collections | `phase-5-discovery` (same branch) | Done, committed |
| 7 Test hardening | `phase-5-discovery` | Done, committed |
| 8 Recommendation evaluation | `phase-5-discovery` | Done, committed |
| 9 User-study kit + report | `phase-5-discovery` | Done, committed (user study itself still to be run) |

## Phase 1 - Foundation (done)
- Additive, idempotent `Backend/db/schema.sql` (`npm run db:migrate`); new `user_profiles` table; `schemes.verified` / `official_source` columns. Nothing dropped or retyped.
- 19 placeholder schemes, all `verified:false` (`npm run db:seed`, insert-if-name-missing). Checklist: [DATA_VERIFICATION.md](DATA_VERIFICATION.md).
- `app.js` split from `server.js`; JSON 404 + global error handler; `GET /api/health`; CORS from env incl. `:3000`.
- Jest + Supertest; `.env.example` files; docs: [RULES_SCHEMA.md](RULES_SCHEMA.md), [DB_SETUP.md](DB_SETUP.md).
- Separate commit removed fake homepage stats and fake `.gov.in` email.
- Verified: `npm test` 12/12 pass; server boot + curl OK. **Not verified:** migrate/seed/DB tests (no Postgres), frontend compile (no `Frontend/node_modules`).

## Phase 2 - Eligibility engine (done)
- `Backend/services/eligibilityEngine.js`: pure module (`evaluate`, `evaluateAll`, `normalizeProfile`, `normalizeRules`, `missingRequiredFields`). Per scheme: `tier` (`eligible` / `possibly_eligible` / `not_eligible`), `passedRules`, `failedRules`, `unknownRules`, `missingInputs`.
- Missing optional input -> rule goes to `unknownRules` (never a silent pass). `0` is a real value. Legacy rule keys from an existing DB are read through aliases.
- Old `checkEligibility` (dangling `if`, truthiness guards, uncompared education/business/social category) removed; regression tests added.
- `POST /api/schemes/recommend` now validates required fields (400 + field errors), returns eligible then possibly-eligible schemes with `tier` and `eligibility`. Still unauthenticated (Phase 3).
- Frontend (small): "Perfect Match" replaced by Eligible / Possibly eligible badge + "Add to confirm: ..." line; form sends `experience: null` when blank (was `0`, which would fail experience rules).
- Tests: `npm test` 88/88 pass (84 engine/regression/seed + 4 endpoint tests with mocked DB). Frontend not compiled (no `Frontend/node_modules`).
- Known: until Phase 3 adds the "new enterprise?" form field, schemes marked new-enterprise-only show as *possibly eligible* asking for it.

## Phase 3 - Business profile + authenticated recommend (done)
- New endpoints (JWT required): `GET /api/business-profile` -> `{ data: { profile | null } }`; `PUT /api/business-profile` (full replace, validated). Named `business-profile` to avoid clashing with the existing account `/api/users/profile`.
- `POST /api/schemes/recommend` now requires login. Body `{ profile?, save_profile? }`: profile validated (400 + `errors[{field,message}]`), saved only when `save_profile === true`; without `profile` the saved one is used (400 if none).
- Response shape unchanged from Phase 2 (`data` = list with `tier` + `eligibility`, plus `count`, `eligible_count`, `possible_count`).
- `Backend/utils/validate.js` (`validateProfile`), `models/profile.js` (upsert), `controllers/profileController.js`, `routes/businessProfile.js`.
- DB (additive): `ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS is_new_enterprise BOOLEAN` in `schema.sql`.
- Frontend: form pre-fills from the saved profile, new "Starting a new enterprise?" + "Describe your business" fields, "Save these details" checkbox, API validation messages shown; API client clears the session and sends the user to sign-in on a 401 for a token-bearing request.
- Profile field names in the API: `state`, `annual_income`, `experience_years`, `special_category` (the form maps its own names to these).
- Tests: `npm test` 114/114 pass across 7 suites (profile endpoints, auth required, validator boundaries, saved-profile flow; DB mocked). Frontend files syntax-checked with @babel/parser only - **not compiled or run in a browser**. `user_profiles` SQL never run against Postgres.
- Plan deviations: the `/api/meta/options` endpoint is deferred to Phase 5 (it ships with the filter-options endpoint); `data` stays a flat list instead of `data.recommendations`.

## Phase 4 - Python ranking service (done)
- `ranking-service/` (FastAPI, local venv, pinned `requirements.txt`, own README): `GET /health`, `POST /rank`. Score = fixed weighted sum of five signals (TF-IDF text similarity 0.35, investment fit 0.25, benefit size 0.15, specificity 0.15, age fit 0.10); missing signals dropped and weights re-normalised; possibly-eligible x0.9. **Hand-set weights, nothing is learned** (no interaction data) - see `ranking-service/README.md` for limitations.
- `scripts/build_model.py` builds a reproducible TF-IDF artifact (`artifacts/`, git-ignored): no randomness, no timestamps, version = hash of corpus + settings. Works without it in `adhoc` mode.
- Node: `services/rankingClient.js` (1.5 s timeout, strict response validation), `services/fallbackScorer.js` (same formulas minus text), `services/recommendationService.js` (engine -> ML, else fallback). `POST /recommend` now also returns `score`, `reasons` per scheme and `ranked_by` (`ml` | `fallback` | `none`), `model_version`; ordered by score, not by tier.
- Parity: `ranking-service/tests/fixtures/parity.json` is generated from the Python scorer; Node's fallback scorer is tested against all 18 cases, and a Python test fails if the fixture goes stale.
- Frontend: match-score bar, "Why this matched" (reasons + passed rules), notice when fallback was used. `ranked_by` passed from form -> App -> results.
- Tests: Node `npm test` 154/154 (8 suites); Python `pytest` 31/31. Live check: built the model, ran uvicorn on :8090, ran real seed schemes through the Node orchestrator over HTTP -> `ranked_by: ml`, food-processing scheme ranked first for a pickle-unit profile; with the URL unset -> `fallback`. Frontend syntax-checked only (not compiled/run in a browser).
- Note: port 8001 is blocked on this Windows machine ("forbidden by access permissions"); docs use 8090.
- To use: follow `ranking-service/README.md`, then set `RANKING_SERVICE_URL` in `Backend/.env`.

## Phases 5-9 (done, 17 Nov 2026)
Phases 5-9 were built in one session on `phase-5-discovery` as separate commits (one branch instead of five, to keep the stack simple).

- **Database:** Postgres 18 now runs in Docker (`msme-postgres`, volume `msme_pgdata`). The original dump `msme_09112026.sql` was restored into `msme`; the migration repairs it (sequences, email unique, updated_at); TWEES, AABCS and KKT from the dump were added to the seed in normalised form; `npm run db:reconcile-legacy` replaced the 5 legacy rows. The dump is git-ignored (personal data). DB tests now really run (not skipped).
- **5 Discovery:** `GET /api/schemes` filters/search/sort/pagination, `/filters`, `/:id`; Browse page; home shows featured schemes.
- **6 Collections:** `/saved/ids`, id validation, 401 for deleted users; `SavedSchemesContext` + `SaveButton` everywhere (optimistic + rollback).
- **7 Tests:** 42 frontend RTL tests; backend coverage script; `scripts/test-all.(ps1|sh)`.
- **8 Evaluation:** `evaluation/` (22 personas, 153 spot checks, reference implementation, P@k/NDCG/MRR); `npm run eval`.
- **9 Docs:** root README, rewritten PROJECT_REPORT.md, DB_SETUP.md, REPORT_SECTIONS.md, user-study kit; security fixes (generic login error, crypto OTP 5 min, 7-day JWT, sequelize removed).
- **Bugs found and fixed:** unsave never sent (state-updater read), investment filter dropped schemes without a minimum cost, stale session not validated, dump sequences behind ids.
- **Verified:** backend 212/212, pytest 31/31, frontend 42/42, `CI=true` production build clean, full flow checked in a real browser (desktop + 375 px).

## Manual TODO (owner: you)
1. **Run the user study** (`docs/user-study/`), then fill the `[TO BE FILLED]` parts of `docs/REPORT_SECTIONS.md`.
2. **Verify scheme data** against official sources ([DATA_VERIFICATION.md](DATA_VERIFICATION.md)) - the biggest remaining weakness.
3. Decide what to do with the files you had staged before this work (`demo-recording/`, `.playwright-mcp/`, `phase.md`) - they are still staged, not committed.
4. Merge / push the branches yourself when ready.
5. Optional: email sending for OTP (needs SMTP credentials).

## Known caveats
- Seed data is placeholder data; treat as unverified.
- Stand-Up India seed models "SC/ST or women" as special categories `sc_st`, `bpl_women`, `widow` (vocabulary has no plain "women"), so non-BPL women are excluded until the real rule is confirmed and the vocabulary is extended.
