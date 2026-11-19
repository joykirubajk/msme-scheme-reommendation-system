"""Scoring: a fixed, hand-set weighted sum of five signals. NOT a learned model.

There is no click / application data, so weights cannot be learned. They are
documented here and written to artifacts/manifest.json. Each signal is in [0, 1];
a signal that cannot be computed (None) is dropped and the remaining weights are
re-normalised. Backend/services/fallbackScorer.js re-implements every signal except
`text` with the same formulas (checked by the parity fixture test).

  text         0.35  TF-IDF cosine(user's business description, scheme text), x2, capped at 1
  investment   0.25  closeness of the user's investment to the scheme's typical size (log scale)
  benefit      0.15  size of the quantified benefit (subsidy %, max subsidy, loan)
  specificity  0.15  scheme is targeted at the user's state / business type / category
  age          0.10  user's age is near the middle of the scheme's age range

final = weighted average of available signals x tier factor (possibly_eligible x0.9), clipped to [0, 1].
"""
import math
from typing import Any, Dict, List, Optional, Tuple

WEIGHTS = {"text": 0.35, "investment": 0.25, "benefit": 0.15, "specificity": 0.15, "age": 0.10}
TIER_FACTOR = {"eligible": 1.0, "possibly_eligible": 0.9}
TEXT_SCALE = 2.0
MIN_DESCRIPTION_CHARS = 3


def clip01(x: float) -> float:
    return max(0.0, min(1.0, x))


def fmt_inr(x: float) -> str:
    if x >= 1e7:
        return f"₹{x / 1e7:.1f} Cr"
    if x >= 1e5:
        return f"₹{x / 1e5:.1f}L"
    return f"₹{x:,.0f}"


def _num(v: Any) -> Optional[float]:
    if isinstance(v, bool) or v is None:
        return None
    try:
        f = float(v)
    except (TypeError, ValueError):
        return None
    return f if math.isfinite(f) else None


def _slug(v: Any) -> Optional[str]:
    return v.strip().lower().replace(" ", "_").replace("-", "_") if isinstance(v, str) and v.strip() else None


def _slugs(v: Any) -> List[str]:
    if isinstance(v, dict):
        v = list(v.keys())
    return [s for s in (_slug(x) for x in v) if s] if isinstance(v, (list, tuple)) else []


# ---------------------------------------------------------------- signals
def investment_fit(investment: Optional[float], rules: Dict[str, Any], max_investment: Optional[float]) -> Tuple[Optional[float], Optional[str]]:
    inv = _num(investment)
    limit = _num(rules.get("max_project_cost"))
    if limit is None or limit <= 0:
        limit = _num(max_investment)
    if inv is None or limit is None or limit <= 0:
        return None, None
    lo = _num(rules.get("min_project_cost")) or 0.0
    target = math.sqrt(lo * limit) if lo > 0 else limit
    fit = 1.0 - min(1.0, abs(math.log10(max(inv, 1.0)) - math.log10(target)) / 2.0)
    reason = None
    if fit >= 0.7:
        reason = f"Your investment ({fmt_inr(inv)}) is close to this scheme's typical size ({fmt_inr(target)})"
    return fit, reason


def benefit_magnitude(benefits: Optional[Dict[str, Any]]) -> Tuple[float, Optional[str]]:
    b = benefits or {}
    pct = _num(b.get("subsidy_percent"))
    max_sub = _num(b.get("max_subsidy"))
    loan = _num(b.get("loan_amount"))
    pct_c = clip01(pct / 100.0) if pct is not None else 0.0
    if max_sub is not None and max_sub > 0:
        amt = clip01(math.log10(max_sub) / 7.0)
    elif loan is not None and loan > 0:
        amt = clip01(math.log10(loan) / 8.0) * 0.5
    else:
        amt = 0.0
    value = 0.6 * pct_c + 0.4 * amt
    reason = None
    if value >= 0.5:
        bits = []
        if pct is not None:
            bits.append(f"{pct:g}% subsidy")
        if max_sub is not None:
            bits.append(f"up to {fmt_inr(max_sub)}")
        reason = "Strong financial benefit" + (f" ({', '.join(bits)})" if bits else "")
    return value, reason


def user_groups(profile: Dict[str, Any]) -> set:
    g = set()
    gender, social, special = _slug(profile.get("gender")), _slug(profile.get("social_category")), _slug(profile.get("special_category"))
    if gender == "female":
        g.add("women")
    if gender == "transgender":
        g.add("transgender")
    if social in ("sc", "st"):
        g.update({social, "sc_st"})
    if social == "obc":
        g.add("obc")
    if special:
        g.add(special)
        if special in ("bpl_women", "widow"):
            g.add("women")
    return g


def specificity(profile: Dict[str, Any], scheme: Dict[str, Any], rules: Dict[str, Any]) -> Tuple[float, List[str]]:
    score, reasons = 0.0, []

    user_loc = _slug(profile.get("location"))
    states = [s for s in _slugs(rules.get("states")) if s not in ("all_india", "any")]
    scheme_loc = _slug(scheme.get("location"))
    if scheme_loc in (None, "any", "all_india"):
        scheme_loc = None
    if user_loc and (user_loc in states or scheme_loc == user_loc):
        score += 0.4
        reasons.append(f"Specific to {user_loc.replace('_', ' ').title()}")

    user_cat = _slug(profile.get("business_category"))
    cats = [c for c in _slugs(rules.get("business_categories"))] or ([_slug(scheme.get("business_category"))] if _slug(scheme.get("business_category")) else [])
    if cats and "any" not in cats and user_cat and user_cat != "any" and user_cat in cats:
        score += 0.3
        reasons.append(f"Targets {user_cat} businesses")

    targets = set(_slugs(scheme.get("beneficiary_categories"))) | set(_slugs(rules.get("special_categories"))) | set(_slugs(rules.get("social_categories")))
    if _slugs(rules.get("genders")) == ["female"]:
        targets.add("women")
    hit = sorted(targets & user_groups(profile))
    if hit:
        score += 0.3
        reasons.append("Priority scheme for " + ", ".join(h.replace("_", "/").upper() if h in ("sc_st",) else h.replace("_", " ") for h in hit))

    return min(1.0, score), reasons


def age_fit(age: Optional[float], rules: Dict[str, Any]) -> Tuple[Optional[float], Optional[str]]:
    a = _num(age)
    hi = _num(rules.get("max_age"))
    if a is None or hi is None:
        return None, None
    lo = _num(rules.get("min_age")) or 18.0
    if hi <= lo:
        return None, None
    centre, half = (lo + hi) / 2.0, (hi - lo) / 2.0
    fit = clip01(1.0 - abs(a - centre) / half)
    reason = f"Your age ({a:g}) is well within this scheme's target range ({lo:g}-{hi:g})" if fit >= 0.8 else None
    return fit, reason


# ---------------------------------------------------------------- combine
def combine(components: Dict[str, Optional[float]], tier: str) -> float:
    avail = {k: v for k, v in components.items() if v is not None}
    total_w = sum(WEIGHTS[k] for k in avail)
    if total_w == 0:
        return 0.0
    base = sum(WEIGHTS[k] * v for k, v in avail.items()) / total_w
    return clip01(base * TIER_FACTOR.get(tier, 1.0))


def score_scheme(profile: Dict[str, Any], scheme: Dict[str, Any], text: Optional[Tuple[float, List[str]]] = None) -> Tuple[float, List[str]]:
    """profile / scheme are plain dicts. `text` = (cosine, keywords) or None when the user gave no description."""
    rules = scheme.get("rules") or {}
    comps: Dict[str, Optional[float]] = {}
    notes: Dict[str, List[str]] = {}

    if text is not None:
        cos, keywords = text
        comps["text"] = clip01(cos * TEXT_SCALE)
        if comps["text"] >= 0.3 and keywords:
            notes["text"] = [f"Your business description matches this scheme (keywords: {', '.join(keywords)})"]
    else:
        comps["text"] = None

    comps["investment"], r = investment_fit(profile.get("investment"), rules, scheme.get("max_investment"))
    if r:
        notes["investment"] = [r]
    comps["benefit"], r = benefit_magnitude(scheme.get("benefits"))
    if r:
        notes["benefit"] = [r]
    comps["specificity"], rs = specificity(profile, scheme, rules)
    if rs:
        notes["specificity"] = rs
    comps["age"], r = age_fit(profile.get("age"), rules)
    if r:
        notes["age"] = [r]

    score = round(combine(comps, scheme.get("tier", "eligible")), 6)

    # reasons ordered by how much each signal contributed
    ordered = sorted((k for k in notes), key=lambda k: (-(WEIGHTS[k] * (comps[k] or 0.0)), k))
    reasons = [line for k in ordered for line in notes[k]][:4]
    if not reasons:
        reasons = ["Meets the eligibility rules for this scheme"]
    return score, reasons


def user_text_for(profile: Dict[str, Any]) -> Optional[str]:
    d = profile.get("business_description")
    if isinstance(d, str) and len(d.strip()) >= MIN_DESCRIPTION_CHARS:
        return d.strip()
    return None
