# Scheme rules schema

`schemes.rules` is a JSON object. **Every key is optional; an absent key means "no constraint".**
Money is in rupees (integers). Ages are in years. The allowed keys and slugs are defined in
`Backend/utils/constants.js`; `npm test` fails if the seed data uses anything else.

| Key | Type | Meaning |
|---|---|---|
| `min_age` | number | Applicant must be at least this old |
| `max_age` | number | Applicant must be at most this old (general applicants) |
| `max_age_relaxed` | number | Higher age limit for applicants in any group listed in `relaxed_age_for` |
| `relaxed_age_for` | array | Groups that get `max_age_relaxed`: `women`, `sc_st`, `sc`, `st`, `obc`, `pwd`, `transgender`, `widow`, `bpl_women` |
| `genders` | array | Allowed genders: `male`, `female`, `transgender` |
| `states` | array | Allowed states; `["all_india"]` or absent = anywhere. e.g. `["tamil_nadu"]` |
| `min_project_cost` / `max_project_cost` | number | Allowed range for the user's investment / project cost |
| `max_annual_income` | number | Income cap |
| `min_experience_years` | number | Minimum business experience |
| `min_education` | string | One of `none < 8th < 10th < 12th < diploma < graduation < postgraduation` |
| `business_categories` | array | Allowed business types (`manufacturing`, `service`, `trading`, `agriculture`, `retail`). Absent = any |
| `social_categories` | array | Allowed social categories: `sc`, `st`, `obc`, `general` |
| `special_categories` | array | Applicant must be in at least one: `sc_st`, `transgender`, `pwd`, `widow`, `bpl_women` |
| `max_previous_subsidy` | number | Cap on subsidy already received |
| `is_new_enterprise_only` | boolean | Only for starting a new enterprise |

Other `schemes` columns used by the engine/UI:
- `business_category` - one of the slugs above or `any`. Used by the discovery filter, and by the engine as an implicit `business_categories` rule when the scheme has no explicit list (e.g. a `manufacturing` scheme is only for manufacturing businesses).
- `location` - a state slug or `all_india` (display + discovery filter).
- `max_investment` - display/sort value.
- `beneficiary_categories` - JSON **array** of special-category slugs ("priority for" badges). Display only; eligibility uses `rules.special_categories`.
- `benefits` - free-form object, e.g. `subsidy_percent`, `max_subsidy`, `loan_amount`.
- `verified` (bool) / `official_source` (text) - provenance. All seed rows are `verified = false`.

## Missing-input behaviour (used by the eligibility engine, Phase 2)

For each rule present on a scheme:
- user provided the field and it satisfies the rule -> **passed**
- user provided the field and it violates the rule -> **failed** (scheme is *not eligible*)
- user left the field empty -> **unknown** (scheme is *possibly eligible*; the UI lists the missing inputs)

`0` is a real value, not "missing". Required profile fields (age, gender, business category,
investment, state) are validated before the engine runs.

## Legacy keys

An existing database may hold older rule keys (`max_investment`, `max_project_cost`, `state`, `domicile`,
`max_income`, `max_family_income`, `min_experience`, `prior_subsidy_limit`, `max_age_special`,
`max_age_general`). Phase 2's engine will read these through an alias table so existing rows keep
working; new data must use the keys above.
