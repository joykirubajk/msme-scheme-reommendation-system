import json
from pathlib import Path

from make_parity_fixtures import build_fixtures

FIXTURE = Path(__file__).parent / "fixtures" / "parity.json"


def test_fixture_file_is_up_to_date_with_python_scorer():
    """If this fails, you changed app/scoring.py: run scripts/make_parity_fixtures.py, then port the
    change to Backend/services/fallbackScorer.js (its Jest test reads the same file)."""
    assert json.loads(FIXTURE.read_text(encoding="utf-8")) == build_fixtures()
