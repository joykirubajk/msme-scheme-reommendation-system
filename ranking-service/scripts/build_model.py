"""Builds the TF-IDF artifact from a scheme list (JSON array).

    python scripts/build_model.py                       # uses Backend/db/seed/schemes.data.json
    python scripts/build_model.py --input my_export.json --out artifacts

Reproducible: TF-IDF has no randomness, the corpus is sorted by scheme name, and the
manifest holds no timestamps, so the same input + library versions give a byte-identical
manifest and the same model_version (first 8 hex chars of sha256 over corpus + params).
"""
import argparse
import hashlib
import json
import sys
from pathlib import Path

import joblib
import sklearn

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from app.scoring import TIER_FACTOR, WEIGHTS  # noqa: E402
from app.text_model import make_vectorizer, scheme_text, vectorizer_params  # noqa: E402

DEFAULT_INPUT = ROOT.parent / "Backend" / "db" / "seed" / "schemes.data.json"


def build(input_path: Path, out_dir: Path) -> dict:
    schemes = json.loads(input_path.read_text(encoding="utf-8"))
    texts = [scheme_text(s) for s in sorted(schemes, key=lambda s: s.get("name", ""))]
    if not texts:
        raise SystemExit("No schemes in input; nothing to build.")

    params = vectorizer_params()
    digest = hashlib.sha256(json.dumps({"corpus": texts, "params": params}, sort_keys=True, ensure_ascii=False).encode("utf-8")).hexdigest()
    version = digest[:8]

    vec = make_vectorizer()
    vec.fit(texts)

    out_dir.mkdir(parents=True, exist_ok=True)
    vec_file = f"tfidf-{version}.joblib"
    joblib.dump(vec, out_dir / vec_file)

    manifest = {
        "model_version": version,
        "vectorizer_file": vec_file,
        "corpus_sha256": digest,
        "n_documents": len(texts),
        "n_features": len(vec.vocabulary_),
        "vectorizer_params": params,
        "weights": WEIGHTS,
        "tier_factor": TIER_FACTOR,
        "sklearn_version": sklearn.__version__,
        "note": "Hand-set weights; no learning. See app/scoring.py.",
    }
    (out_dir / "manifest.json").write_text(json.dumps(manifest, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    return manifest


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--input", type=Path, default=DEFAULT_INPUT)
    ap.add_argument("--out", type=Path, default=ROOT / "artifacts")
    args = ap.parse_args()
    m = build(args.input, args.out)
    print(f"Built model {m['model_version']}: {m['n_documents']} documents, {m['n_features']} features -> {args.out}")
