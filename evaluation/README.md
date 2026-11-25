# Recommendation evaluation

An offline check of the two parts of the recommender:

1. **Eligibility**: does the Node engine include and exclude the right schemes?
2. **Ranking**: once the eligible list is fixed, does the ordering put the most useful schemes first?

## Run it

```bash
# optional: start the ranking service first to fill in the ML column (see ranking-service/README.md)
cd Backend
npm run eval            # = node ../evaluation/run_eval.mjs
```

Output goes to `evaluation/results/results.md` (paste-ready tables) and `results.csv`.
The run is deterministic: scheme ids follow the seed file order, the random baseline uses a fixed seed,
and the output has no timestamps. If the ranking service is not running, the ML row says "not run".
To point at another service: `RANKING_SERVICE_URL=http://host:port npm run eval`.

## What is in here

| File | What it is |
|---|---|
| `personas.json` | 22 synthetic personas (profile + one-line story). Includes edge cases: only required fields filled in (P14), exact boundaries (P15 at Rs 50,000 and age 18, P19 at Rs 10,00,001), age limits one year over (P16, P21), age relaxation with and without SC status (P17 vs P18), transgender and PwD applicants (P09, P22). |
| `personas.json` > `spot_checks` | 153 hand-labelled expectations ("should be recommended" / "must not be recommended"), written by reading each scheme's rules. |
| `personas.json` > `relevance` | Hand-written usefulness grades: 2 = what an adviser would suggest first, 1 = a useful option, missing = 0. |
| `reference.mjs` | A second, independent implementation of `docs/RULES_SCHEMA.md` (it does not import the engine). |
| `run_eval.mjs` | Runs everything and writes the results. |

## Metrics

- **Spot-check accuracy**: share of the 153 labels the engine gets right.
- **Engine vs reference**: over all 22 x 22 persona-scheme pairs, precision / recall / F1 of "recommended or not", and exact tier agreement.
- **Ranking**, on the same recommended list ordered four ways (database order, random (mean of 200 shuffles), rule-based fallback scorer, ML ranking service):
  - **P@k**: share of the top k that has relevance 1 or 2.
  - **NDCG@k**: graded (gain 2^rel - 1, log2 discount), normalised by the best possible order of that list.
  - **MRR**: 1 / rank of the first scheme graded 2.

## Limitations (state these in the report)

- Personas, spot checks and relevance grades are synthetic and written by the developer, not by real users or scheme officials.
- The reference implementation reads the same rules document as the engine. Full agreement shows that the code does what the rules document says. It does not show that the rules match the real schemes, because the seed data is unverified.
- Relevance grades are subjective, and the lists are short (1-9 schemes). Treat the ranking numbers as indicative only.
- The ranking weights were set before this evaluation and were not tuned on it, so the numbers are not inflated by fitting to these personas.
