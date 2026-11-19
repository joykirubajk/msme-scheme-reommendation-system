"""Text side of the ranking: TF-IDF cosine similarity between the user's business
description and each scheme's text.

The vectoriser is fitted on the scheme corpus by scripts/build_model.py and loaded
from artifacts/. If no artifact exists the service fits one on the schemes in the
request ("adhoc" mode) so it still works, just with less stable IDF weights.
"""
import json
import os
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional, Tuple

import joblib
from sklearn.feature_extraction.text import TfidfVectorizer

VECTORIZER_PARAMS = dict(
    lowercase=True,
    stop_words="english",
    ngram_range=(1, 2),
    sublinear_tf=True,
    min_df=1,
)


def make_vectorizer() -> TfidfVectorizer:
    return TfidfVectorizer(**VECTORIZER_PARAMS)


def vectorizer_params() -> Dict[str, Any]:
    """JSON-friendly copy for the manifest."""
    return {**VECTORIZER_PARAMS, "ngram_range": list(VECTORIZER_PARAMS["ngram_range"])}


def _as_list(value: Any) -> List[str]:
    if isinstance(value, dict):
        return [str(k) for k in value.keys()]
    if isinstance(value, (list, tuple)):
        return [str(v) for v in value]
    return []


def scheme_text(scheme: Dict[str, Any]) -> str:
    """One string per scheme. Slugs like sc_st are split so they match words."""
    rules = scheme.get("rules") or {}
    parts = [
        scheme.get("name") or "",
        scheme.get("description") or "",
        scheme.get("business_category") or "",
        " ".join(_as_list(rules.get("business_categories"))),
        " ".join(_as_list(scheme.get("beneficiary_categories"))),
    ]
    return " ".join(parts).replace("_", " ")


class TextModel:
    def __init__(self, vectorizer: Optional[TfidfVectorizer], version: str, mode: str):
        self.vectorizer = vectorizer
        self.version = version
        self.mode = mode  # "artifact" | "adhoc"

    def similarities(self, user_text: str, scheme_texts: List[str]) -> List[Tuple[float, List[str]]]:
        """Returns (cosine, shared keywords) per scheme, in input order."""
        vec = self.vectorizer
        if vec is None:
            vec = make_vectorizer()
            try:
                vec.fit(scheme_texts)
            except ValueError:  # empty vocabulary (e.g. only stop words)
                return [(0.0, []) for _ in scheme_texts]

        u = vec.transform([user_text])
        s = vec.transform(scheme_texts)
        terms = vec.get_feature_names_out()
        out: List[Tuple[float, List[str]]] = []
        for i in range(s.shape[0]):
            row = s[i]
            # both vectors are L2-normalised, so the dot product is the cosine
            cos = float(u.multiply(row).sum())
            shared = u.multiply(row).tocoo()
            ranked = sorted(zip(shared.data, [terms[j] for j in shared.col]), key=lambda t: (-t[0], t[1]))
            out.append((cos, [t for _, t in ranked[:3]]))
        return out


def artifact_dir() -> Path:
    env = os.environ.get("RANKING_ARTIFACT_DIR")
    return Path(env) if env else Path(__file__).resolve().parent.parent / "artifacts"


def load_model() -> TextModel:
    manifest_path = artifact_dir() / "manifest.json"
    if manifest_path.exists():
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
        vec_path = artifact_dir() / manifest["vectorizer_file"]
        if vec_path.exists():
            return TextModel(joblib.load(vec_path), manifest["model_version"], "artifact")
    return TextModel(None, "adhoc", "adhoc")
