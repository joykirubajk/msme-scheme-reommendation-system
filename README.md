# MSME Scheme Recommendation Platform

Helps Indian micro, small and medium enterprises find government schemes they may qualify for.
React frontend, Node/Express API with a rule-based eligibility engine, a Python ranking service, and PostgreSQL.

Full project report: [PROJECT_REPORT.md](PROJECT_REPORT.md). Testing, evaluation and conclusion: [docs/REPORT_SECTIONS.md](docs/REPORT_SECTIONS.md).

> Scheme data is unverified development data. Confirm everything on official portals before relying on it.

## Requirements

- Node.js 18+ (tested on 24)
- Python 3.10+ (tested on 3.12), only for the ranking service
- PostgreSQL 14+ (tested on 18), installed locally **or** run with Docker Desktop

## Quick start (Windows, PowerShell)

### 1. Database

With Docker Desktop running:

```powershell
docker run -d --name msme-postgres -e POSTGRES_PASSWORD=<choose-a-password> -p 5432:5432 -v msme_pgdata:/var/lib/postgresql postgres:18
docker exec msme-postgres psql -U postgres -c "CREATE DATABASE msme" -c "CREATE DATABASE msme_test"
```

After a reboot just run `docker start msme-postgres`. Without Docker, see [docs/DB_SETUP.md](docs/DB_SETUP.md).

### 2. Backend (port 8000)

```powershell
cd Backend
npm install
copy .env.example .env             # set DB_PASSWORD and JWT_SECRET
copy .env.test.example .env.test   # set DB_PASSWORD (tests use the msme_test database)
npm run db:migrate                 # create tables (safe to re-run)
npm run db:seed                    # add the 22 sample schemes (safe to re-run)
npm run dev
```

### 3. Ranking service (port 8090, optional)

```powershell
cd ranking-service
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
python scripts/build_model.py
uvicorn app.main:app --port 8090
```

Then add `RANKING_SERVICE_URL=http://127.0.0.1:8090` to `Backend/.env` and restart the backend.
Without it the app still works and uses the built-in fallback scorer.

### 4. Frontend (port 3000)

```powershell
cd Frontend
npm install
npm start
```

Open http://localhost:3000, create an account, click **Find Your Schemes**.

> Forgot-password OTPs are printed in the backend terminal (email sending is not set up).

## Tests and evaluation

```powershell
scripts\test-all.ps1        # backend + ranking service + frontend
cd Backend; npm run eval    # recommendation-quality evaluation -> evaluation/results/results.md
```

Individually: `cd Backend; npm test` / `npm run test:coverage`, `cd ranking-service; pytest`, `cd Frontend; npm run test:ci`.

## Folders

| Folder | Contents |
|---|---|
| `Backend/` | Express API, eligibility engine, SQL schema and seed data, Jest tests |
| `Frontend/` | React app and its tests |
| `ranking-service/` | FastAPI ranking service and pytest tests |
| `evaluation/` | Offline evaluation (personas, metrics, results) |
| `docs/` | Rules schema, DB setup, data verification checklist, report sections, user-study kit |
| `scripts/` | Run-all-tests scripts |
