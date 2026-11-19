"""Regenerates tests/fixtures/parity.json from the Python scorer.
Run after intentionally changing app/scoring.py, then update Backend/services/fallbackScorer.js to match
(Backend: npm test checks it against this file)."""
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
sys.path.insert(0, str(ROOT / "tests"))

from app.scoring import score_scheme  # noqa: E402
from parity_cases import CASES  # noqa: E402


def build_fixtures():
    out = []
    for name, profile, scheme in CASES:
        score, _ = score_scheme(profile, scheme)
        out.append({"name": name, "profile": profile, "scheme": scheme, "expected_score": score})
    return out


if __name__ == "__main__":
    path = ROOT / "tests" / "fixtures" / "parity.json"
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(build_fixtures(), indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"wrote {path}")
