# Database setup

The backend needs PostgreSQL with two databases: `msme` (the app) and `msme_test` (automated tests only).
Database tests run only when `Backend/.env.test` points at a database whose name ends in `_test`, so they can never touch your real data.

## Option A - Docker (what the project was tested with)

Needs Docker Desktop running.

```powershell
docker run -d --name msme-postgres -e POSTGRES_PASSWORD=<password> -p 5432:5432 -v msme_pgdata:/var/lib/postgresql postgres:18
docker exec msme-postgres psql -U postgres -c "CREATE DATABASE msme" -c "CREATE DATABASE msme_test"
```

- Data lives in the Docker volume `msme_pgdata` and survives restarts.
- After a reboot: start Docker Desktop, then `docker start msme-postgres`.
- Use the same `<password>` as `DB_PASSWORD` in `Backend/.env` and `Backend/.env.test`.

## Option B - Native install

1. Install PostgreSQL 14+ from https://www.postgresql.org/download/windows/ (port 5432, include Command Line Tools).
2. `psql -U postgres -c "CREATE DATABASE msme;"` and `psql -U postgres -c "CREATE DATABASE msme_test;"`

## Create tables and sample data

```powershell
cd Backend
copy .env.example .env             # DB_PASSWORD, JWT_SECRET
copy .env.test.example .env.test   # DB_PASSWORD
npm install
npm run db:migrate                 # creates missing tables/columns/indexes; never drops anything
npm run db:seed                    # inserts the 22 sample schemes that are not already there
```

Both commands are safe to re-run.

## Restoring the original database dump (`msme_09112026.sql`)

`msme_09112026.sql` is a `pg_dump` custom-format backup of the original development database (PostgreSQL 18): 5 hand-entered Tamil Nadu schemes with an older rules format, and 2 user accounts. **It contains real people's emails, phone numbers and password hashes, so it is git-ignored. Do not commit or share it.**

To restore it into a fresh `msme` database (Docker shown; with a native install drop the `docker exec`/`docker cp` parts):

```powershell
docker cp msme_09112026.sql msme-postgres:/tmp/dump.backup
docker exec msme-postgres pg_restore -U postgres -d msme --no-owner /tmp/dump.backup
cd Backend
npm run db:migrate             # adds the new tables/columns and repairs the dump (see below)
npm run db:seed                # adds the 22 sample schemes
npm run db:reconcile-legacy    # replaces the 5 old-format rows with their normalised versions
```

What the migration repairs in that dump: its id sequences were reset below the existing ids (the next insert would have failed), `users.email` had no unique constraint, and `schemes.updated_at` was missing.

What `db:reconcile-legacy` does: the five old rows (TWEES, NEEDS, UYEGP, AABCS, KKT) all have a normalised version in the seed file. The script moves any saved-scheme rows to the new version and deletes the old row, in one transaction. User accounts are not touched. Running it twice does nothing the second time.

## Running the tests

```powershell
cd Backend
npm test
```

If Postgres is not reachable, database tests print `SKIPPED` instead of failing silently.
