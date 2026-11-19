# User evaluation kit

Everything needed to run a small, honest usability study of the platform.

| File | Use it for |
|---|---|
| [SAMPLE_SIZE.md](SAMPLE_SIZE.md) | How many people to test and how to report the numbers |
| [consent-and-notes.md](consent-and-notes.md) | Read-out consent script and the observer's note sheet (one per participant) |
| [task-script.md](task-script.md) | The five tasks, what counts as success, and the persona cards to hand out |
| [questionnaire.md](questionnaire.md) | Post-test questionnaire: SUS (10 items) + relevance/trust ratings + open questions |
| [results-template.csv](results-template.csv) | One row per participant; fill it from the note sheets and questionnaires |
| [analysis/sus_analysis.py](analysis/sus_analysis.py) | Turns the CSV into the results tables for the report |

## Session plan (about 25 minutes per person)

1. Consent (2 min) - `consent-and-notes.md`
2. Tasks 1-5 (15 min) - `task-script.md`; time each task and mark success / partial / fail
3. Questionnaire (5 min) - `questionnaire.md`
4. Short debrief (3 min) - "What was most confusing?"

## Before the first session

- Start all three services (see the root README) and check the ranking service is up: the results page must **not** say "Smart ranking is temporarily unavailable".
- Use a fresh browser profile or private window for each participant.
- Have the persona cards printed or on a second screen.
- Do a dry run with a friend; fix the script if a task is ambiguous, then do not change it again during the study.

## After the sessions

```powershell
python docs\user-study\analysis\sus_analysis.py docs\user-study\results.csv
```

(Copy `results-template.csv` to `results.csv` and fill it in. `results.csv` holds participant data, so keep it out of public repositories or anonymise it first.) Paste the printed tables into the `[TO BE FILLED]` places in [../REPORT_SECTIONS.md](../REPORT_SECTIONS.md).
