#!/usr/bin/env bash
# Runs all three test suites. Exit code is non-zero if any suite fails.
# Needs: Postgres reachable with Backend/.env.test (DB_NAME ending in _test) for the DB tests,
#        ranking-service/.venv created per ranking-service/README.md.
set -u
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
status=0

echo "== Backend (Jest + Supertest) =="
(cd "$ROOT/Backend" && npm test) || status=1

echo "== Ranking service (pytest) =="
if [ -x "$ROOT/ranking-service/.venv/Scripts/python.exe" ]; then PY="$ROOT/ranking-service/.venv/Scripts/python.exe";
elif [ -x "$ROOT/ranking-service/.venv/bin/python" ]; then PY="$ROOT/ranking-service/.venv/bin/python";
else PY=python; fi
(cd "$ROOT/ranking-service" && "$PY" -m pytest -q) || status=1

echo "== Frontend (React Testing Library) =="
(cd "$ROOT/Frontend" && CI=true npx react-scripts test --watchAll=false) || status=1

if [ $status -eq 0 ]; then echo "ALL SUITES PASSED"; else echo "SOME SUITES FAILED"; fi
exit $status
