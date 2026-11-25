import math

import pytest

from app import scoring
from app.scoring import age_fit, benefit_magnitude, combine, investment_fit, score_scheme, specificity
from parity_cases import BASE, CASES, _scheme


def test_weights_sum_to_one():
    assert math.isclose(sum(scoring.WEIGHTS.values()), 1.0)


def test_investment_fit_log_scale():
    assert investment_fit(1_000_000, {"max_project_cost": 1_000_000}, None)[0] == pytest.approx(1.0)
    assert investment_fit(10_000, {"max_project_cost": 1_000_000}, None)[0] == pytest.approx(0.0)  # 2 orders of magnitude away
    mid = investment_fit(100_000, {"max_project_cost": 1_000_000}, None)[0]
    assert mid == pytest.approx(0.5)


def test_investment_fit_unknown_when_no_limit_or_no_investment():
    assert investment_fit(1000, {}, None) == (None, None)
    assert investment_fit(None, {"max_project_cost": 10}, None) == (None, None)


def test_investment_fit_zero_investment_does_not_crash():
    fit, _ = investment_fit(0, {"max_project_cost": 100_000}, None)
    assert 0.0 <= fit <= 1.0


def test_benefit_no_benefits_is_zero_not_none():
    assert benefit_magnitude(None)[0] == 0.0
    assert benefit_magnitude({})[0] == 0.0


def test_benefit_bigger_is_higher_and_bounded():
    small = benefit_magnitude({"subsidy_percent": 10, "max_subsidy": 10_000})[0]
    big = benefit_magnitude({"subsidy_percent": 35, "max_subsidy": 1_750_000})[0]
    assert 0 <= small < big <= 1
    assert benefit_magnitude({"subsidy_percent": 900, "max_subsidy": 1e15})[0] == 1.0


def test_loan_counts_for_less_than_grant():
    assert benefit_magnitude({"loan_amount": 1_000_000})[0] < benefit_magnitude({"max_subsidy": 1_000_000})[0]


def test_specificity_components():
    s, reasons = specificity(BASE, _scheme(location="tamil_nadu", rules={"states": ["tamil_nadu"], "business_categories": ["manufacturing"]}), {"states": ["tamil_nadu"], "business_categories": ["manufacturing"]})
    assert s == pytest.approx(0.7)
    assert any("Tamil Nadu" in r for r in reasons)
    assert specificity(BASE, _scheme(), {})[0] == 0.0


def test_age_fit_edges():
    assert age_fit(31.5, {"min_age": 18, "max_age": 45})[0] == pytest.approx(1.0)
    assert age_fit(45, {"min_age": 18, "max_age": 45})[0] == pytest.approx(0.0)
    assert age_fit(60, {"min_age": 18, "max_age": 45})[0] == 0.0  # beyond range (relaxed groups) clipped, not negative
    assert age_fit(30, {"min_age": 18}) == (None, None)  # no upper bound


def test_missing_signals_are_renormalised_not_zeroed():
    # only benefit available -> score equals the benefit value, not benefit * its weight
    assert combine({"text": None, "investment": None, "benefit": 0.8, "specificity": None, "age": None}, "eligible") == pytest.approx(0.8)
    assert combine({}, "eligible") == 0.0


def test_possibly_eligible_is_penalised():
    c = {"investment": 1.0, "benefit": 1.0}
    assert combine(c, "possibly_eligible") == pytest.approx(0.9 * combine(c, "eligible"))


def test_scores_in_unit_interval_and_reasons_nonempty():
    for name, profile, scheme in CASES:
        score, reasons = score_scheme(profile, scheme)
        assert 0.0 <= score <= 1.0, name
        assert reasons and all(isinstance(r, str) and r for r in reasons), name


def test_deterministic():
    for _, profile, scheme in CASES:
        assert score_scheme(profile, scheme) == score_scheme(profile, scheme)


def test_text_signal_changes_score_and_adds_reason():
    scheme = _scheme(rules={"max_project_cost": 600000})
    without, _ = score_scheme(BASE, scheme)
    with_text, reasons = score_scheme(BASE, scheme, text=(0.4, ["pickle", "food"]))
    assert with_text != without
    assert any("keywords: pickle, food" in r for r in reasons)
    low, _ = score_scheme(BASE, scheme, text=(0.0, []))
    assert low < without  # zero similarity drags the score down
