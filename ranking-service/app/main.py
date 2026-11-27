from functools import lru_cache
from typing import Optional

from fastapi import FastAPI

from .ml_ranker import MLRanker, load_ml_ranker
from .schemas import RankRequest, RankResponse, RankedScheme
from .scoring import extract_features, score_scheme, user_text_for
from .text_model import TextModel, load_model, scheme_text

app = FastAPI(title="MSME ranking service", version="1.0.0")


@lru_cache(maxsize=1)
def get_model() -> TextModel:
    return load_model()


@lru_cache(maxsize=1)
def get_ml_ranker() -> Optional[MLRanker]:
    return load_ml_ranker()


@app.get("/health")
def health():
    model = get_model()
    ml = get_ml_ranker()
    info = {"status": "ok", "model_version": model.version, "mode": model.mode}
    if ml is not None:
        info["ml_algorithm"] = ml.algorithm
    return info


@app.post("/rank", response_model=RankResponse)
def rank(req: RankRequest) -> RankResponse:
    model = get_model()
    ml = get_ml_ranker()
    profile = req.profile.model_dump()
    schemes = [s.model_dump() for s in req.schemes]
    if not schemes:
        return RankResponse(model_version=model.version, results=[])

    user_text = user_text_for(profile)
    texts = None
    if user_text:
        texts = model.similarities(user_text, [scheme_text(s) for s in schemes])

    results = []
    if ml is not None:
        vectors = []
        reasons_list = []
        tiers = []
        for i, s in enumerate(schemes):
            _, vec_row, reasons = extract_features(profile, s, texts[i] if texts else None)
            vectors.append(vec_row)
            reasons_list.append(reasons)
            tiers.append(s.get("tier", "eligible"))
        scores = ml.predict_scores(vectors, tiers)
        for s, score, reasons in zip(schemes, scores, reasons_list):
            results.append(RankedScheme(scheme_id=s["id"], score=score, reasons=reasons))
    else:
        for i, s in enumerate(schemes):
            score, reasons = score_scheme(profile, s, texts[i] if texts else None)
            results.append(RankedScheme(scheme_id=s["id"], score=score, reasons=reasons))

    results.sort(key=lambda r: (-r.score, r.scheme_id))
    return RankResponse(model_version=model.version, results=results)
