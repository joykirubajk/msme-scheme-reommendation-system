# Report sections: Testing, Evaluation, Conclusion, Limitations, Future Work

Draft text for the final report. Every number here was produced by a command in this repository (named next to it) on 17 Nov 2026.
Places marked **[TO BE FILLED]** need the user-study results (see [user-study/README.md](user-study/README.md)).

---

## 1. Testing

### 1.1 Approach

Testing was layered so that each part can be checked on its own and together:

| Layer | Tool | What is tested |
|---|---|---|
| Eligibility engine (pure functions) | Jest | Every rule type, boundary values (ages 17/18/55/56, project cost at and around each limit), missing inputs (possibly eligible), age relaxation, legacy rule keys from the original database, special/social categories |
| Fallback scorer | Jest | Each scoring signal; parity with the Python scorer on 18 shared fixtures, so both ranking paths score the same way |
| Ranking client | Jest (mocked `fetch`) | Timeout, HTTP 500, malformed JSON, missing or duplicate ids, so any failure leads to the fallback |
| REST API | Jest + Supertest | Auth required (401), validation (400 with field errors), recommend, discovery filters, pagination, ids (400/404), collections, no stack traces or DB errors in responses |
| Database | Jest + Supertest on a real PostgreSQL 18 test database | Migration and seed idempotent; discovery SQL (each filter, combined filters, pagination covers every row once, LIKE-wildcard and quote strings treated as text); investment filter compared row-by-row with the same rule computed in JavaScript; save idempotent; cascade on user delete; legacy-dump reconcile |
| Ranking service | pytest | API contract, determinism (same input gives the same output), empty input, reproducible model build |
| Frontend | React Testing Library | Saved-schemes context (optimistic save, rollback on error, double click, logged-out prompt, logout clears state), Browse filters/search debounce/clear/load-more/error-retry, recommendation results (tiers, score, fallback notice, "Why this matched"), form validation and API payload, profile pre-fill |
| End-to-end (manual, real browser) | Playwright | Sign in, recommend, save/unsave across views, My Saved Schemes, Browse filters, 375 px mobile width without horizontal scroll |

Database tests run only against a database whose name ends in `_test`; otherwise they are reported as skipped, so the development data cannot be touched by tests.

### 1.2 Results

| Suite | Command | Result |
|---|---|---|
| Backend | `cd Backend && npm test` | **212 / 212 passed** (11 suites) |
| Backend coverage | `npm run test:coverage` | 77.1% lines, 78.7% branches overall; eligibility engine 97.8% lines, recommendation service 100%, fallback scorer 97.2% |
| Ranking service | `cd ranking-service && pytest` | **31 / 31 passed** |
| Frontend | `cd Frontend && npm run test:ci` | **42 / 42 passed** (4 suites) |
| All | `scripts/test-all.ps1` | all three suites passed |
| Production build | `cd Frontend && CI=true npm run build` | compiles with zero warnings |

### 1.3 Defects found by testing

Testing found real defects, which were fixed and covered by new tests:

1. **Unsave never worked from the new heart button.** The toggle read the "was it saved?" value inside a React state-updater function, which runs later, so every click sent "save". Found in the browser; fixed by keeping a synchronous copy of the saved ids; covered by the "clicking a saved heart unsaves it" test.
2. **The investment filter dropped most schemes.** In SQL, `NULL ~ pattern` is NULL, so every scheme without a minimum project cost was excluded (1 result instead of 13 for Tamil Nadu + manufacturing + Rs 5 lakh). Found while preparing the user-study task; the earlier test only checked that returned rows were valid, not that valid rows were returned. Fixed with `COALESCE`; the new test compares the API result with a JavaScript calculation over every row and fails on the old code (6 failures).
3. **A stale browser session acted as a different user.** After the database was restored from the original dump, a token saved in the browser belonged to a different account with the same id. The app now checks the stored session with `/api/auth/me` on load.
4. **The original database dump could not accept new rows**: its id sequences were behind the existing ids. The migration now resets them.
5. A documentation mismatch: the rules document said a scheme's `business_category` column was display-only, but the engine uses it as a rule. Found by the independent reference implementation in the evaluation; the document was corrected.

---

## 2. Evaluation

### 2.1 Recommendation quality (offline)

Command: `cd Backend && npm run eval` (full output: [evaluation/results/results.md](../evaluation/results/results.md)). Method: [evaluation/README.md](../evaluation/README.md).

Setup: 22 synthetic personas (including boundary and edge cases), the 22 sample schemes, 153 hand-labelled eligibility checks, and hand-written relevance grades (2 = what an adviser would suggest first, 1 = useful, 0 = not useful).

**Eligibility**

| Check | Result |
|---|---|
| Engine vs hand-labelled checks | 153 / 153 correct |
| Engine vs independent reference implementation (484 persona-scheme pairs) | precision 1.000, recall 1.000; exact tier agreement 484 / 484 |

**Ranking** (same recommended list per persona, ordered four ways; mean over 22 personas)

| Ordering | P@3 | P@5 | NDCG@3 | NDCG@5 | MRR |
|---|---|---|---|---|---|
| Database order | 0.636 | 0.491 | 0.685 | 0.777 | 0.667 |
| Random (mean of 200 shuffles) | 0.629 | 0.503 | 0.677 | 0.758 | 0.662 |
| Rule-based fallback | 0.697 | 0.527 | 0.804 | 0.845 | 0.817 |
| ML ranking service | **0.727** | **0.555** | **0.830** | **0.882** | **0.849** |

Per persona on NDCG@5 the ML service was better than the fallback for 6 personas, the same for 13 and worse for 3.

**Interpretation.** Both scoring methods put useful schemes nearer the top than database or random order (NDCG@5 0.85-0.88 vs 0.76-0.78; MRR for the first highly relevant scheme 0.82-0.85 vs 0.66-0.67). The ML service is slightly better than the fallback, mainly where the business description matters: for a brass-handicraft workshop (P05) it ranks the One District One Product scheme first instead of a food-processing scheme. The difference between ML and fallback is small and comes from a few personas, so it should not be over-claimed.

Weak cases: when a scheme's rules allow "any manufacturing business", a food-processing scheme can rank first for a garment unit (P03, NDCG@5 0.46). The rules cannot tell food from garments, and the text signal is weak with short descriptions.

**What this evaluation does and does not show.** The engine does exactly what the documented rules say (full agreement with a separately written implementation and with the hand labels). It does **not** show that the rules match the real government schemes: the scheme data is unverified. Personas and relevance grades are synthetic and were written by the developer, so the ranking numbers are indicative, not proof of usefulness to real users. The ranking weights were fixed before the evaluation and not tuned on it.

### 2.2 User evaluation

**[TO BE FILLED after the sessions - run `python docs/user-study/analysis/sus_analysis.py docs/user-study/results.csv` and paste the tables.]**

- Participants: **[n = __; __ business owners / planning to start, __ students; recruited via __]**
- Procedure: 5 tasks (sign up, get recommendations, explain the top match, browse with filters, save and remove), then the System Usability Scale and three ratings about the recommendations ([user-study/task-script.md](user-study/task-script.md), [user-study/questionnaire.md](user-study/questionnaire.md)).
- SUS: **[mean __ (SD __, median __, n = __)]**, which is **[above / below]** the commonly cited average of 68.
- Task success: **[T1 __/__, T2 __/__, T3 __/__, T4 __/__, T5 __/__]**; slowest task: **[__, median __ s]**.
- Recommendations: relevant **[mean __/5]**, understood why **[__/5]**, would trust as a starting point **[__/5]**.
- Main problems observed: **[list, with how many participants hit each]**.

With fewer than about 12 participants these results are indicative only (see [user-study/SAMPLE_SIZE.md](user-study/SAMPLE_SIZE.md)).

---

## 3. Conclusion

The project set out to help MSME owners find government schemes they may qualify for without reading every scheme's rules. The completed system does this in four steps: a saved business profile, a rule-based eligibility engine that sorts every scheme into eligible / possibly eligible / not eligible and explains each decision, a separate Python ranking service (with a built-in fallback) that orders the matches by relevance, and a browse-and-save interface.

The main technical results are:

- **Explainable eligibility.** Every recommendation lists the rules it passed, and possibly-eligible schemes say which input is missing. The engine agreed with 153 / 153 hand-labelled checks and with an independent implementation on all 484 persona-scheme pairs.
- **Better-than-baseline ordering.** On the synthetic evaluation, both ranking methods beat database and random order (NDCG@5 0.88 and 0.85 vs 0.78 and 0.76), with the ML service slightly ahead of the fallback.
- **Robustness.** The app keeps working when the ranking service is down, which is shown to the user and covered by tests.
- **Tested.** 285 automated tests across backend (including a real PostgreSQL test database), ranking service and frontend, all passing; testing found and fixed several real defects.

**[TO BE FILLED: one or two sentences from the user study, e.g. "In a study with n = __ participants the system scored a mean SUS of __, and __ of __ completed all tasks."]**

The main limitation is the data, not the software: the scheme rules are unverified summaries, so the system is a working prototype of the method, not yet a reliable source of advice.

---

## 4. Limitations

1. **Scheme data is unverified.** All 22 schemes are summaries written for development (19 from general knowledge, 3 from the original hand-entered database). Rules such as age limits and project-cost caps may be wrong or out of date. The app shows this on every scheme page. See [DATA_VERIFICATION.md](DATA_VERIFICATION.md).
2. **Small scheme catalogue.** 22 schemes, mostly national and Tamil Nadu; no Karnataka or Delhi schemes although those states can be selected.
3. **Rules are simplified.** Conditions such as document requirements, "one member per family", the list of eligible trades (KKT) or promoter contribution are not modelled. Previous-subsidy limits cannot be checked because the form does not ask for them.
4. **Ranking is hand-weighted, not learned.** There is no interaction data, so the weights were set by judgement. The text signal is weak with short descriptions.
5. **Evaluation is synthetic.** Personas, eligibility labels and relevance grades were written by the developer. **[Add if true: The user study had a small sample (n = __), so its numbers are indicative.]**
6. **Password-reset OTPs are not emailed.** They are printed in the backend console. They are stored in plain text and there is no rate limit on attempts.
7. **Other security gaps for production:** no rate limiting on login, JWT kept in localStorage (exposed if an XSS bug existed), `PUT /api/users/profile` can change the email without verification (the frontend does not use it).
8. **Not deployed.** Tested locally on Windows (Docker PostgreSQL, Node 24, Python 3.12).

---

## 5. Future work

1. **Verify and extend the scheme data** with official sources (state portals, Udyam / myScheme), add an admin page to edit schemes, and record the guideline date for each scheme.
2. **Learn the ranking from feedback.** Saved schemes and clicks are implicit relevance signals; once enough exist, train a learning-to-rank model and compare it with the current weights using the existing evaluation script.
3. **Better text matching** with sentence embeddings instead of TF-IDF, so a "garment unit" no longer matches a food-processing scheme.
4. **Ask for missing inputs.** When a scheme is possibly eligible, offer a one-click question ("Have you received a subsidy before?") and re-run.
5. **Email OTP and notifications** (nodemailer), hashed OTPs with attempt limits, login rate limiting, refresh tokens in HTTP-only cookies.
6. **Multilingual interface** (Tamil, Hindi), since many target users are more comfortable outside English.
7. **Application tracking** in collections (shortlisted / applied / approved) and deadline reminders.
8. **Deployment** with a managed PostgreSQL, the ranking service as a container, and monitoring.
