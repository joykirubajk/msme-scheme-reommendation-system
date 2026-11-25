"""Analyse the user-study CSV (docs/user-study/results-template.csv format).

Usage:
    python docs/user-study/analysis/sus_analysis.py docs/user-study/results.csv

Prints Markdown tables ready to paste into docs/REPORT_SECTIONS.md:
  - participants per group
  - SUS score per participant, mean, SD, median, min, max
  - task success (S / P / F) and time on task (mean, SD, median) per task
  - recommendation ratings R1-R3

Standard library only. SUS scoring (Brooke, 1996): odd items contribute (score - 1),
even items contribute (5 - score); the sum is multiplied by 2.5 to give 0-100.
Rows with a missing or out-of-range SUS answer are reported and left out of the SUS stats.
"""
import csv
import statistics
import sys
from collections import Counter

TASKS = ["t1", "t2", "t3", "t4", "t5"]
TASK_NAMES = {
    "t1": "T1 Create an account",
    "t2": "T2 Get recommendations",
    "t3": "T3 Explain the top result",
    "t4": "T4 Browse with filters",
    "t5": "T5 Save and remove",
}
RATINGS = {"r1_relevant": "R1 Recommendations relevant", "r2_understood": "R2 Understood why", "r3_trust": "R3 Would trust as a starting point"}


def sus_score(row):
    """Return the 0-100 SUS score, or None if any answer is missing or not 1-5."""
    total = 0
    for i in range(1, 11):
        raw = (row.get(f"sus{i}") or "").strip()
        if not raw.isdigit() or not 1 <= int(raw) <= 5:
            return None
        v = int(raw)
        total += (v - 1) if i % 2 == 1 else (5 - v)
    return total * 2.5


def describe(values):
    """n, mean, SD, median, min, max as a dict (SD needs n >= 2)."""
    n = len(values)
    if n == 0:
        return None
    return {
        "n": n,
        "mean": statistics.mean(values),
        "sd": statistics.stdev(values) if n >= 2 else float("nan"),
        "median": statistics.median(values),
        "min": min(values),
        "max": max(values),
    }


def fmt(x, digits=1):
    return "n/a" if x is None or x != x else f"{x:.{digits}f}"


def load(path):
    with open(path, newline="", encoding="utf-8-sig") as f:
        rows = [r for r in csv.DictReader(f) if (r.get("participant") or "").strip()]
    if not rows:
        sys.exit(f"No participant rows in {path}")
    return rows


def main(path):
    rows = load(path)
    n = len(rows)
    out = []

    groups = Counter((r.get("group") or "unspecified").strip() or "unspecified" for r in rows)
    out.append(f"## Participants (n = {n})\n")
    out.append("| Group | n |\n|---|---|")
    out += [f"| {g} | {c} |" for g, c in sorted(groups.items())]
    down = [r["participant"] for r in rows if (r.get("ranking_up") or "").strip().lower() in ("no", "n", "false", "0")]
    if down:
        out.append(f"\nRanking service was down (fallback ranking) for: {', '.join(down)}")

    scores, invalid = [], []
    out.append("\n## SUS per participant\n")
    out.append("| Participant | SUS |\n|---|---|")
    for r in rows:
        s = sus_score(r)
        out.append(f"| {r['participant']} | {fmt(s)} |")
        if s is None:
            invalid.append(r["participant"])
        else:
            scores.append(s)
    d = describe(scores)
    out.append("\n## SUS summary\n")
    if d:
        out.append("| n | Mean | SD | Median | Min | Max |\n|---|---|---|---|---|---|")
        out.append(f"| {d['n']} | {fmt(d['mean'])} | {fmt(d['sd'])} | {fmt(d['median'])} | {fmt(d['min'])} | {fmt(d['max'])} |")
        position = "above" if d["mean"] > 68 else "below" if d["mean"] < 68 else "at"
        out.append(f"\nMean SUS is {position} the commonly cited average of 68 (Sauro, 2011). Indicative only with n = {d['n']}.")
    if invalid:
        out.append(f"\nExcluded from SUS (incomplete answers): {', '.join(invalid)}")

    out.append("\n## Tasks\n")
    out.append("| Task | Success (S) | With help (P) | Failed (F) | Time mean s (SD) | Time median s |\n|---|---|---|---|---|---|")
    for t in TASKS:
        results = Counter((r.get(f"{t}_result") or "").strip().upper() for r in rows)
        answered = sum(results[k] for k in ("S", "P", "F"))
        times = []
        for r in rows:
            raw = (r.get(f"{t}_seconds") or "").strip()
            try:
                times.append(float(raw))
            except ValueError:
                pass
        td = describe(times)
        pct = lambda k: f"{results[k]} ({100 * results[k] / answered:.0f}%)" if answered else "0"
        out.append(
            f"| {TASK_NAMES[t]} | {pct('S')} | {pct('P')} | {pct('F')} | "
            f"{fmt(td['mean']) if td else 'n/a'} ({fmt(td['sd']) if td else 'n/a'}) | {fmt(td['median']) if td else 'n/a'} |"
        )

    out.append("\n## Recommendation ratings (1-5)\n")
    out.append("| Question | n | Mean | SD | Median |\n|---|---|---|---|---|")
    for key, label in RATINGS.items():
        vals = []
        for r in rows:
            raw = (r.get(key) or "").strip()
            if raw.isdigit() and 1 <= int(raw) <= 5:
                vals.append(int(raw))
        d = describe(vals)
        out.append(f"| {label} | {d['n'] if d else 0} | {fmt(d['mean']) if d else 'n/a'} | {fmt(d['sd']) if d else 'n/a'} | {fmt(d['median']) if d else 'n/a'} |")

    print("\n".join(out))


if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit("Usage: python sus_analysis.py <results.csv>")
    main(sys.argv[1])
