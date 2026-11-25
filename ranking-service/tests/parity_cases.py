"""Inputs shared by the Python tests, the fixture generator and (via parity.json) the Node tests.
None of the profiles has a business_description, so the text signal is absent - the same
situation as the Node fallback scorer."""

BASE = {"age": 30, "gender": "male", "social_category": "general", "special_category": None,
        "business_category": "manufacturing", "investment": 500000, "location": "tamil_nadu"}


def _scheme(**kw):
    s = {"id": 1, "name": "S", "description": None, "business_category": "any", "max_investment": None,
         "location": "all_india", "benefits": {}, "rules": {}, "beneficiary_categories": [], "tier": "eligible"}
    s.update(kw)
    return s


CASES = [
    ("empty scheme", BASE, _scheme()),
    ("investment near ceiling", BASE, _scheme(rules={"max_project_cost": 600000})),
    ("investment far below ceiling", {**BASE, "investment": 10000}, _scheme(rules={"max_project_cost": 10000000})),
    ("investment from max_investment column", BASE, _scheme(max_investment=1000000)),
    ("range uses geometric centre", BASE, _scheme(rules={"min_project_cost": 100000, "max_project_cost": 2500000})),
    ("zero investment", {**BASE, "investment": 0}, _scheme(rules={"max_project_cost": 100000})),
    ("benefit: subsidy and cap", BASE, _scheme(benefits={"subsidy_percent": 35, "max_subsidy": 1750000})),
    ("benefit: loan only", BASE, _scheme(benefits={"loan_amount": 5000000})),
    ("state specific", BASE, _scheme(location="tamil_nadu", rules={"states": ["tamil_nadu"]})),
    ("state mismatch is not specific", {**BASE, "location": "karnataka"}, _scheme(location="tamil_nadu", rules={"states": ["tamil_nadu"]})),
    ("business category target", BASE, _scheme(rules={"business_categories": ["manufacturing"]})),
    ("category from column", BASE, _scheme(business_category="manufacturing")),
    ("women priority", {**BASE, "gender": "female"}, _scheme(rules={"genders": ["female"]}, beneficiary_categories=["bpl_women"])),
    ("sc/st priority via object-shaped categories", {**BASE, "social_category": "sc"}, _scheme(beneficiary_categories={"sc_st": True})),
    ("age near middle of range", BASE, _scheme(rules={"min_age": 18, "max_age": 45})),
    ("age at range edge", {**BASE, "age": 45}, _scheme(rules={"min_age": 18, "max_age": 45})),
    ("everything", {**BASE, "gender": "female", "age": 32},
     _scheme(location="tamil_nadu", max_investment=700000,
             rules={"states": ["tamil_nadu"], "min_age": 21, "max_age": 45, "business_categories": ["manufacturing", "service"],
                    "genders": ["female"], "max_project_cost": 800000},
             benefits={"subsidy_percent": 25, "max_subsidy": 250000}, beneficiary_categories=["bpl_women"])),
    ("possibly eligible is penalised", BASE, _scheme(rules={"max_project_cost": 600000}, benefits={"subsidy_percent": 25}, tier="possibly_eligible")),
]
