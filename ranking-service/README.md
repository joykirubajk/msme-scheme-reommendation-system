# Ranking service

Small FastAPI service that ranks schemes **after** the Node backend has decided which ones the user is eligible for. It never decides eligibility.

## How it ranks (and what it is not)

No click or application data exists, so nothing is *learned*. Each scheme gets a hand-set weighted score (`app/scoring.py`):

| Signal | Weight | Meaning |
|---|---|---|
| text | 0.35 | TF-IDF cosine between the user's business description and the scheme text (x2, capped at 1) |
| investment | 0.25 | how close the user's investment is to the scheme's typical size (log scale) |
| benefit | 0.15 | size of the quantified benefit (subsidy %, max subsidy, loan amount) |
| specificity | 0.15 | scheme targets the user's state / business type / category (women, SC/ST, ...) |
| age | 0.10 | user's age is near the middle of the scheme's age range |

A signal that cannot be computed (e.g. no description entered) is dropped and the remaining weights are re-normalised. "Possibly eligible" schemes are multiplied by 0.9.

**Limitations (say these out loud in the viva):** weights are subjective, not tuned on data; the score is a relevance heuristic, not a probability; the text signal is weak with a 22-scheme corpus and short descriptions; seed scheme data is unverified (see `docs/DATA_VERIFICATION.md`).

If this service is down, the Node backend uses `Backend/services/fallbackScorer.js` (same formulas minus text) and marks the response `ranked_by: "fallback"`. `tests/fixtures/parity.json` keeps the two implementations identical.

## Setup (Windows, local venv, no Docker)

```
cd ranking-service
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
python scripts/build_model.py        # builds artifacts/ from Backend/db/seed/schemes.data.json
uvicorn app.main:app --port 8090
```

Then in `Backend/.env`: `RANKING_SERVICE_URL=http://127.0.0.1:8090` (port 8001 is blocked on some Windows machines).
Health check: `http://127.0.0.1:8090/health` -> `{"status":"ok","model_version":"...","mode":"artifact"}`. Interactive docs: `/docs`.

Without `build_model.py` the service still works in `adhoc` mode (it fits TF-IDF on the schemes in each request).

To build from a database export instead of the seed file: `python scripts/build_model.py --input export.json` (JSON array of scheme objects). Rebuild whenever scheme text changes; the build is reproducible (no randomness, no timestamps) and `model_version` is the first 8 hex chars of a hash of the corpus and vectoriser settings.

## API

`POST /rank`
```json
{ "profile": { "age": 29, "gender": "female", "business_category": "manufacturing", "investment": 400000,
               "location": "tamil_nadu", "business_description": "home pickle unit" },
  "schemes": [ { "id": 1, "name": "...", "description": "...", "business_category": "manufacturing",
                 "max_investment": 3000000, "location": "all_india", "benefits": { "subsidy_percent": 35 },
                 "rules": { "max_project_cost": 3000000 }, "beneficiary_categories": ["pwd"], "tier": "eligible" } ] }
```
returns `{ "model_version": "b1d7c570", "results": [ { "scheme_id": 1, "score": 0.65, "reasons": ["..."] } ] }` sorted by score (ties: lower id first). Empty `schemes` -> empty `results`. Invalid body -> 422. `rules` use the canonical vocabulary in `docs/RULES_SCHEMA.md` (the Node side normalises them).

## Tests

```
pytest            # from ranking-service/ with the venv active
```
Covers scoring maths, API contract, determinism, empty input, artifact build reproducibility, and the Node parity fixture. After changing `app/scoring.py`, run `python scripts/make_parity_fixtures.py` and port the change to `Backend/services/fallbackScorer.js`.
