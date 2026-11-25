# Scheme data - verification TODO

`Backend/db/seed/schemes.data.json` holds 22 **placeholder** schemes. 19 were written from general knowledge
by an AI assistant; 3 (TWEES, AABCS, KKT) were normalised from the original project database dump
(`msme_09112026.sql`), which was entered by hand by the developer. **None of the numbers or rules are confirmed.** Every row is stored with
`verified = false` and an `official_source` hint (a domain, not a confirmed page).

**Do not present any figure to users, examiners or in the report as official until it is checked.**

## How to verify a scheme
1. Open the scheme's official portal / latest guidelines (see `official_source`, find the exact page).
2. Compare each field below. Fix the JSON (or the DB row) to match the guideline.
3. Fill in the exact URL and the guideline date in `official_source`.
4. Set `"verified": true` in the JSON (and re-seed on a fresh DB) or `UPDATE schemes SET verified = TRUE WHERE id = ...`.

## Checklist (tick when confirmed)

Fields to confirm for every scheme: max project cost / loan size, subsidy %, max subsidy, age limits
(and relaxations), minimum education, category/state restrictions, whether it is for new units only,
and whether the scheme is still open.

- [ ] PMEGP - project cost cap (manufacturing vs service differ), subsidy % by category/area, 8th-pass condition
- [ ] MUDRA Shishu / Kishor / Tarun - current loan slab limits (check whether Tarun Plus exists)
- [ ] CGTMSE - guarantee cover %, maximum guaranteed loan (changes between budgets)
- [ ] Stand-Up India - loan range, greenfield condition, whether the scheme is still active
- [ ] PMFME - subsidy %, per-unit cap, whether only existing food units qualify
- [ ] PM Vishwakarma - loan stages/amounts, eligible trades, age
- [ ] CLCSS - subsidy %, cap, experience condition (I invented `min_experience_years: 1`; likely wrong)
- [ ] PM SVANidhi - loan stages, who qualifies as a street vendor
- [ ] Udyogini - age 18-45, family income cap, subsidy %, which lenders offer it
- [ ] Mahila Udyam Nidhi - age limit and loan cap (I guessed 55 and 10L)
- [ ] National SC-ST Hub - is it a scheme with eligibility rules or just a support programme
- [ ] ZED Certification - subsidy % by enterprise size, rupee caps (I guessed 80% / 80,000)
- [ ] Agriculture Infrastructure Fund - loan cap, subvention %, who qualifies
- [ ] Tamil Nadu NEEDS - age limits, education, project cost cap, subsidy
- [ ] Tamil Nadu UYEGP - age limits, project cost cap, subsidy
- [ ] Maharashtra CMEGP - age limits, education, project cost cap, subsidy
- [ ] Uttar Pradesh ODOP Margin Money - age limit (I guessed 55), cap, subsidy %
- [ ] TWEES (from the original dump) - age 18-55, women/transgender only, project cost cap 10L, 25% subsidy up to 2L. The original row also mentioned ration card, one member per family, 5% promoter contribution - not modelled as rules
- [ ] AABCS (from the original dump) - 100% SC/ST-owned, max age 55, 35% capital subsidy up to 1.5 crore, 6% interest subvention; which business types are allowed (data says manufacturing only - probably too narrow)
- [ ] KKT (from the original dump) - min age 35, 5 years in one of 25 listed trades, prior subsidy limit 1.5L; subsidy 25% up to 50,000. The trade list is not modelled

## Gaps
- No Karnataka or Delhi scheme is included although the form offers them. Add real ones.
- The form does not ask about previous subsidies, so KKT's prior-subsidy limit always shows as "possibly eligible".
- The `max_investment` column is a display/sort value; for some schemes it is the loan cap, not a project-cost cap.
- Existing rows in the live database (if any) were not touched by the seed script.
