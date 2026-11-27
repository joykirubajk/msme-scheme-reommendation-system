"""Supervised ML ranker (Logistic Regression or Random Forest) loaded from artifacts/."""
import json
from typing import Any, Dict, List, Optional

import joblib

from .scoring import TIER_FACTOR, clip01
from .text_model import artifact_dir


class MLRanker:
    """Wraps a fitted scikit-learn classifier that outputs P(relevant=1 | features)."""

    def __init__(self, estimator: Any, algorithm: str, metrics: Optional[Dict[str, Any]] = None):
        self.estimator = estimator
        self.algorithm = algorithm
        self.metrics = metrics or {}

    def predict_scores(self, feature_rows: List[List[float]], tiers: List[str]) -> List[float]:
        if not feature_rows:
            return []
        probs = self.estimator.predict_proba(feature_rows)[:, 1]
        return [
            round(clip01(float(p) * TIER_FACTOR.get(tier, 1.0)), 6)
            for p, tier in zip(probs, tiers)
        ]


def load_ml_ranker() -> Optional[MLRanker]:
    """Loads the trained ML ranker referenced by artifacts/manifest.json, if present."""
    manifest_path = artifact_dir() / "manifest.json"
    if not manifest_path.exists():
        return None
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    ml_meta = manifest.get("ml_model") or {}
    model_file = ml_meta.get("file")
    if not model_file:
        return None
    model_path = artifact_dir() / model_file
    if not model_path.exists():
        return None
    return MLRanker(
        estimator=joblib.load(model_path),
        algorithm=ml_meta.get("algorithm", "unknown"),
        metrics=ml_meta.get("cv_metrics"),
    )
