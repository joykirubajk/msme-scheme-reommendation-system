"""Trains Logistic Regression and Random Forest rankers on persona-scheme pairs.

    python scripts/train_ml_ranker.py
    python scripts/train_ml_ranker.py --algo logistic
    python scripts/train_ml_ranker.py --algo random_forest

Builds/updates artifacts/ml_ranker-<version>.joblib and records the selected
algorithm, cross-validation metrics, and feature importances in artifacts/manifest.json.
"""
import argparse
import json
import sys
from pathlib import Path
from typing import Any, Dict, List, Tuple

import joblib
import numpy as np
from sklearn.ensemble import RandomForestClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import StratifiedKFold, cross_validate
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from app.scoring import FEATURE_NAMES, extract_features, user_text_for  # noqa: E402
from app.text_model import load_model, scheme_text  # noqa: E402
from scripts.build_model import DEFAULT_INPUT, build  # noqa: E402

DEFAULT_PERSONAS = ROOT.parent / "evaluation" / "personas.json"


def _normalize_persona_profile(raw: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "age": raw.get("age"),
        "gender": raw.get("gender"),
        "social_category": raw.get("social_category"),
        "special_category": raw.get("special_category"),
        "business_category": raw.get("business_category"),
        "investment": raw.get("investment"),
        "location": raw.get("location") or raw.get("state"),
        "education": raw.get("education"),
        "experience": raw.get("experience") or raw.get("experience_years"),
        "business_description": raw.get("business_description"),
    }


def build_dataset(
    schemes_path: Path,
    personas_path: Path,
    out_dir: Path,
) -> Tuple[np.ndarray, np.ndarray, str]:
    schemes = json.loads(schemes_path.read_text(encoding="utf-8"))
    personas_doc = json.loads(personas_path.read_text(encoding="utf-8"))

    manifest_path = out_dir / "manifest.json"
    if not manifest_path.exists():
        build(schemes_path, out_dir)
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))

    # Load the TF-IDF model from out_dir
    vec = joblib.load(out_dir / manifest["vectorizer_file"])
    from app.text_model import TextModel

    text_model = TextModel(vec, manifest["model_version"], "artifact")
    key_to_name = personas_doc.get("scheme_keys", {})
    name_to_key = {v: k for k, v in key_to_name.items()}
    scheme_texts = [scheme_text(s) for s in schemes]

    X_rows: List[List[float]] = []
    y_rows: List[int] = []

    for persona in personas_doc.get("personas", []):
        profile = _normalize_persona_profile(persona.get("profile", {}))
        user_text = user_text_for(profile)
        sims = text_model.similarities(user_text, scheme_texts) if user_text else None

        rel_map = persona.get("relevance") or {}
        in_set = set((persona.get("spot_checks") or {}).get("in") or [])

        for idx, scheme in enumerate(schemes):
            s_key = name_to_key.get(scheme.get("name"), "")
            is_pos = (rel_map.get(s_key, 0) >= 1) or (s_key in in_set)
            scheme_copy = {**scheme, "tier": "eligible"}
            _, vec_row, _ = extract_features(profile, scheme_copy, sims[idx] if sims else None)
            X_rows.append(vec_row)
            y_rows.append(1 if is_pos else 0)

    return np.asarray(X_rows, dtype=float), np.asarray(y_rows, dtype=int), manifest["model_version"]


def evaluate_and_train(X: np.ndarray, y: np.ndarray, algo: str = "auto") -> Tuple[Any, str, Dict[str, Any], Dict[str, float]]:
    candidates = {
        "logistic_regression": make_pipeline(
            StandardScaler(),
            LogisticRegression(random_state=42, max_iter=1000, class_weight="balanced"),
        ),
        "random_forest": RandomForestClassifier(
            n_estimators=150,
            max_depth=5,
            random_state=42,
            class_weight="balanced",
        ),
    }

    cv = StratifiedKFold(n_splits=5, shuffle=True, random_state=42)
    results: Dict[str, Dict[str, float]] = {}

    for name, est in candidates.items():
        scores = cross_validate(est, X, y, cv=cv, scoring=["roc_auc", "f1", "accuracy"])
        results[name] = {
            "roc_auc": round(float(scores["test_roc_auc"].mean()), 4),
            "f1": round(float(scores["test_f1"].mean()), 4),
            "accuracy": round(float(scores["test_accuracy"].mean()), 4),
        }

    if algo == "logistic":
        chosen = "logistic_regression"
    elif algo == "random_forest":
        chosen = "random_forest"
    else:
        chosen = max(results.keys(), key=lambda k: (results[k]["roc_auc"], results[k]["f1"]))

    model = candidates[chosen]
    model.fit(X, y)

    if chosen == "logistic_regression":
        coefs = model.named_steps["logisticregression"].coef_[0]
        importance = {f: round(float(c), 4) for f, c in zip(FEATURE_NAMES, coefs)}
    else:
        imps = model.feature_importances_
        importance = {f: round(float(v), 4) for f, v in zip(FEATURE_NAMES, imps)}

    return model, chosen, results, importance


def train(
    schemes_path: Path = DEFAULT_INPUT,
    personas_path: Path = DEFAULT_PERSONAS,
    out_dir: Path = ROOT / "artifacts",
    algo: str = "auto",
) -> Dict[str, Any]:
    X, y, version = build_dataset(schemes_path, personas_path, out_dir)
    model, chosen, all_metrics, importance = evaluate_and_train(X, y, algo=algo)

    ml_file = f"ml_ranker-{version}.joblib"
    joblib.dump(model, out_dir / ml_file)

    manifest_path = out_dir / "manifest.json"
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    manifest["ml_model"] = {
        "algorithm": chosen,
        "file": ml_file,
        "features": FEATURE_NAMES,
        "n_samples": int(len(y)),
        "n_positive": int(y.sum()),
        "cv_metrics": all_metrics[chosen],
        "all_candidates_cv": all_metrics,
        "feature_weights_or_importance": importance,
    }
    manifest["note"] = f"TF-IDF + {chosen} trained on persona-scheme relevance pairs."
    manifest_path.write_text(json.dumps(manifest, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    return manifest


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--schemes", type=Path, default=DEFAULT_INPUT)
    ap.add_argument("--personas", type=Path, default=DEFAULT_PERSONAS)
    ap.add_argument("--out", type=Path, default=ROOT / "artifacts")
    ap.add_argument("--algo", choices=["auto", "logistic", "random_forest"], default="auto")
    args = ap.parse_args()
    m = train(args.schemes, args.personas, args.out, algo=args.algo)
    ml = m["ml_model"]
    print(f"Trained {ml['algorithm']} on {ml['n_samples']} pairs ({ml['n_positive']} positive)")
    print(f"CV metrics: {ml['all_candidates_cv']}")
    print(f"Feature weights/importance: {ml['feature_weights_or_importance']}")
