from functools import lru_cache

from fastapi import FastAPI

from .schemas import RankRequest, RankResponse, RankedScheme
from .scoring import score_scheme, user_text_for
from .text_model import TextModel, load_model, scheme_text

app = FastAPI(title="MSME ranking service", version="1.0.0")


@lru_cache(maxsize=1)
def get_model() -> TextModel:
    return load_model()


@app.get("/health")
def health():
    model = get_model()
    return {"status": "ok", "model_version": model.version, "mode": model.mode}


@app.post("/rank", response_model=RankResponse)
def rank(req: RankRequest) -> RankResponse:
    model = get_model()
    profile = req.profile.model_dump()
    schemes = [s.model_dump() for s in req.schemes]
    if not schemes:
        return RankResponse(model_version=model.version, results=[])

    user_text = user_text_for(profile)
    texts = None
    if user_text:
        texts = model.similarities(user_text, [scheme_text(s) for s in schemes])

    results = []
    for i, s in enumerate(schemes):
        score, reasons = score_scheme(profile, s, texts[i] if texts else None)
        results.append(RankedScheme(scheme_id=s["id"], score=score, reasons=reasons))

    results.sort(key=lambda r: (-r.score, r.scheme_id))
    return RankResponse(model_version=model.version, results=results)
