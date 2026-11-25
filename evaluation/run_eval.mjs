// Offline evaluation of the recommendation pipeline.
//   node evaluation/run_eval.mjs            (from the repo root; ML column needs the ranking service)
//   RANKING_SERVICE_URL=http://127.0.0.1:8090 node evaluation/run_eval.mjs
//
// 1. Eligibility: engine vs hand-labelled spot checks, and engine vs an independent reference
//    implementation of docs/RULES_SCHEMA.md (evaluation/reference.mjs).
// 2. Ranking: for each persona, the engine's recommended list is ordered four ways
//    (database order, seeded random, rule-based fallback scorer, Python ML service) and scored
//    against hand-written graded relevance with Precision@k, NDCG@k and MRR.
// Deterministic: fixed scheme ids (seed-file order), fixed random seed, no timestamps in output.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { evaluateAll } from '../Backend/services/eligibilityEngine.js';
import { recommend } from '../Backend/services/recommendationService.js';
import { rankWithService } from '../Backend/services/rankingClient.js';
import { referenceTier } from './reference.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, '..');
const outDir = path.join(here, 'results');
const ML_URL = process.env.RANKING_SERVICE_URL || 'http://127.0.0.1:8090';
const KS = [3, 5];
const RANDOM_RUNS = 200;
const RANDOM_SEED = 42;

// ---------------------------------------------------------------- data
const seed = JSON.parse(fs.readFileSync(path.join(root, 'Backend/db/seed/schemes.data.json'), 'utf8'));
const schemes = seed.map((s, i) => ({ ...s, id: i + 1 }));
const idByName = new Map(schemes.map((s) => [s.name, s.id]));
const { scheme_keys: keys, personas } = JSON.parse(fs.readFileSync(path.join(here, 'personas.json'), 'utf8'));
const idOf = (key) => {
  const id = idByName.get(keys[key]);
  if (!id) throw new Error(`Unknown scheme key ${key}`);
  return id;
};
const keyById = new Map(Object.keys(keys).map((k) => [idOf(k), k]));

// ---------------------------------------------------------------- metrics
const rel = (persona, id) => persona.relevance[keyById.get(id)] || 0;
const precisionAt = (rels, k) => rels.slice(0, k).filter((r) => r > 0).length / k;
const dcg = (rels, k) => rels.slice(0, k).reduce((s, r, i) => s + (2 ** r - 1) / Math.log2(i + 2), 0);
const ndcgAt = (rels, k) => {
  const ideal = dcg([...rels].sort((a, b) => b - a), k);
  return ideal === 0 ? null : dcg(rels, k) / ideal;
};
const mrr = (rels) => {
  const i = rels.findIndex((r) => r === 2);
  return i === -1 ? null : 1 / (i + 1);
};
const mean = (xs) => {
  const v = xs.filter((x) => x !== null && x !== undefined);
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
};
const f3 = (x) => (x === null || x === undefined ? 'n/a' : x.toFixed(3));

function mulberry32(a) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const shuffle = (arr, rand) => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

const scoreOrder = (persona, ids) => {
  const rels = ids.map((id) => rel(persona, id));
  const m = { mrr: mrr(rels) };
  KS.forEach((k) => { m[`p@${k}`] = precisionAt(rels, k); m[`ndcg@${k}`] = ndcgAt(rels, k); });
  return m;
};

// ---------------------------------------------------------------- run
async function mlAvailable() {
  try {
    const res = await fetch(`${ML_URL.replace(/\/+$/, '')}/health`, { signal: AbortSignal.timeout(1500) });
    return res.ok ? (await res.json()).model_version || 'unknown' : null;
  } catch {
    return null;
  }
}

async function main() {
  const quiet = console.warn;
  console.warn = () => {}; // recommend() warns when falling back - expected here
  const mlVersion = await mlAvailable();

  // --- eligibility
  const spot = { engine: { right: 0, total: 0, wrong: [] }, reference: { right: 0, total: 0, wrong: [] } };
  const pair = { tp: 0, fp: 0, fn: 0, tn: 0, tierAgree: 0, total: 0, disagreements: [] };

  // --- ranking
  const strategies = ['database order', 'random (mean of 200)', 'rule-based fallback', 'ML ranking service'];
  const perStrategy = Object.fromEntries(strategies.map((s) => [s, []]));
  const perPersonaRows = [];
  const listSizes = [];

  for (const persona of personas) {
    const engineResults = evaluateAll(persona.profile, schemes);
    const engineTier = new Map(engineResults.map((r) => [r.schemeId, r.tier]));
    const recommended = new Set(engineResults.map((r) => r.schemeId));
    listSizes.push(recommended.size);

    for (const s of schemes) {
      const ref = referenceTier(persona.profile, s);
      const eng = engineTier.get(s.id) || 'not_eligible';
      const refIn = ref !== 'not_eligible';
      const engIn = eng !== 'not_eligible';
      pair.total += 1;
      if (ref === eng) pair.tierAgree += 1;
      else pair.disagreements.push(`${persona.id} ${keyById.get(s.id)}: engine=${eng}, reference=${ref}`);
      if (refIn && engIn) pair.tp += 1;
      else if (!refIn && engIn) pair.fp += 1;
      else if (refIn && !engIn) pair.fn += 1;
      else pair.tn += 1;
    }

    for (const [expectIn, list] of [[true, persona.spot_checks.in], [false, persona.spot_checks.out]]) {
      for (const key of list) {
        const id = idOf(key);
        const engIn = recommended.has(id);
        const refIn = referenceTier(persona.profile, schemes[id - 1]) !== 'not_eligible';
        spot.engine.total += 1; spot.reference.total += 1;
        if (engIn === expectIn) spot.engine.right += 1; else spot.engine.wrong.push(`${persona.id} ${key} expected ${expectIn ? 'in' : 'out'}`);
        if (refIn === expectIn) spot.reference.right += 1; else spot.reference.wrong.push(`${persona.id} ${key} expected ${expectIn ? 'in' : 'out'}`);
      }
    }

    // orderings of the same recommended list
    const ids = engineResults.map((r) => r.schemeId);
    const dbOrder = [...ids].sort((a, b) => a - b);
    const rand = mulberry32(RANDOM_SEED);
    const randomRuns = Array.from({ length: RANDOM_RUNS }, () => scoreOrder(persona, shuffle(ids, rand)));
    const randomMean = Object.fromEntries(Object.keys(randomRuns[0] || {}).map((m) => [m, mean(randomRuns.map((r) => r[m]))]));

    const fallback = await recommend(persona.profile, schemes, { rank: async () => { throw new Error('forced fallback'); } });
    let ml = null;
    if (mlVersion) {
      ml = await recommend(persona.profile, schemes, { rank: (payload) => rankWithService(payload, { url: ML_URL, timeoutMs: 5000 }) });
      if (ml.ranked_by !== 'ml') throw new Error(`ML ranking failed for ${persona.id}`);
    }

    const orders = {
      'database order': scoreOrder(persona, dbOrder),
      'random (mean of 200)': randomMean,
      'rule-based fallback': scoreOrder(persona, fallback.results.map((r) => r.schemeId)),
      'ML ranking service': ml ? scoreOrder(persona, ml.results.map((r) => r.schemeId)) : null,
    };
    for (const s of strategies) if (orders[s]) perStrategy[s].push(orders[s]);

    const top = (res) => res.results.slice(0, 3).map((r) => keyById.get(r.schemeId)).join(' > ');
    perPersonaRows.push({
      persona: persona.id,
      recommended: ids.length,
      relevant: ids.filter((id) => rel(persona, id) > 0).length,
      fallback_top3: top(fallback),
      ml_top3: ml ? top(ml) : 'n/a',
      fallback_ndcg5: f3(orders['rule-based fallback']['ndcg@5']),
      ml_ndcg5: ml ? f3(orders['ML ranking service']['ndcg@5']) : 'n/a',
    });
  }
  console.warn = quiet;

  // ---------------------------------------------------------------- report
  const precision = pair.tp / (pair.tp + pair.fp);
  const recall = pair.tp / (pair.tp + pair.fn);
  const f1 = (2 * precision * recall) / (precision + recall);
  const metricNames = ['p@3', 'p@5', 'ndcg@3', 'ndcg@5', 'mrr'];
  const summary = strategies.map((s) => {
    const rows = perStrategy[s];
    const row = { strategy: s, personas: rows.length };
    metricNames.forEach((m) => { row[m] = rows.length ? mean(rows.map((r) => r[m])) : null; });
    return row;
  });
  const scorable = perStrategy['database order'].filter((r) => r['ndcg@5'] !== null).length;

  const md = [];
  md.push('# Recommendation evaluation results', '');
  md.push('Generated by `node evaluation/run_eval.mjs`. Deterministic: same inputs give the same numbers.', '');
  md.push(`- Personas: ${personas.length} (synthetic, see \`evaluation/personas.json\`)`);
  md.push(`- Schemes: ${schemes.length} (seed file, all unverified placeholders)`);
  md.push(`- Recommended list size per persona: min ${Math.min(...listSizes)}, mean ${mean(listSizes).toFixed(1)}, max ${Math.max(...listSizes)}`);
  md.push(`- ML ranking service: ${mlVersion ? `model ${mlVersion}` : '**not reachable - ML column not run**'}`, '');
  md.push('## 1. Eligibility', '');
  md.push('| Check | Result |', '|---|---|');
  md.push(`| Engine vs hand-labelled spot checks | ${spot.engine.right}/${spot.engine.total} correct (${(100 * spot.engine.right / spot.engine.total).toFixed(1)}%) |`);
  md.push(`| Reference implementation vs spot checks | ${spot.reference.right}/${spot.reference.total} correct |`);
  md.push(`| Engine vs reference, "recommended or not" (${pair.total} persona-scheme pairs) | precision ${f3(precision)}, recall ${f3(recall)}, F1 ${f3(f1)} |`);
  md.push(`| Engine vs reference, exact tier (eligible / possibly / not) | ${pair.tierAgree}/${pair.total} agree |`, '');
  if (spot.engine.wrong.length) md.push('Engine spot-check misses: ' + spot.engine.wrong.join('; '), '');
  if (spot.reference.wrong.length) md.push('Reference spot-check misses: ' + spot.reference.wrong.join('; '), '');
  if (pair.disagreements.length) md.push('Engine/reference disagreements: ' + pair.disagreements.join('; '), '');
  md.push('## 2. Ranking quality (same recommended list, different order)', '');
  md.push(`Mean over personas. NDCG and MRR are averaged over the ${scorable} personas whose recommended list contains at least one scheme judged relevant; P@k uses all personas. Relevance grades are synthetic (developer judgement).`, '');
  md.push('| Ordering | Personas | P@3 | P@5 | NDCG@3 | NDCG@5 | MRR |', '|---|---|---|---|---|---|---|');
  summary.forEach((r) => md.push(`| ${r.strategy} | ${r.personas} | ${f3(r['p@3'])} | ${f3(r['p@5'])} | ${f3(r['ndcg@3'])} | ${f3(r['ndcg@5'])} | ${f3(r.mrr)} |`));
  if (mlVersion) {
    const fb = perStrategy['rule-based fallback'];
    const mlr = perStrategy['ML ranking service'];
    let win = 0; let tie = 0; let loss = 0;
    fb.forEach((f, i) => {
      if (f['ndcg@5'] === null) return;
      const d = mlr[i]['ndcg@5'] - f['ndcg@5'];
      if (Math.abs(d) < 1e-9) tie += 1; else if (d > 0) win += 1; else loss += 1;
    });
    md.push('', `ML vs fallback, per persona on NDCG@5: ML better for ${win}, same for ${tie}, worse for ${loss}.`);
  }
  md.push('', '## 3. Per persona', '');
  md.push('| Persona | Recommended | Relevant in list | Fallback top 3 | ML top 3 | Fallback NDCG@5 | ML NDCG@5 |', '|---|---|---|---|---|---|---|');
  perPersonaRows.forEach((r) => md.push(`| ${r.persona} | ${r.recommended} | ${r.relevant} | ${r.fallback_top3} | ${r.ml_top3} | ${r.fallback_ndcg5} | ${r.ml_ndcg5} |`));
  md.push('', '## How to read this honestly', '');
  md.push('- The personas, spot checks and relevance grades were written by the developer. They are not real users and not official eligibility decisions.');
  md.push('- The reference implementation reads the same rules as the engine, so engine-vs-reference agreement shows the code matches the documented rules; it does not prove the rules match the real schemes.');
  md.push('- The ranking weights were set by hand before this evaluation and were not tuned on these personas.');
  md.push(`- Recommended lists are short (${Math.min(...listSizes)}-${Math.max(...listSizes)} schemes) and there are only ${personas.length} personas, so small differences between orderings are not meaningful. Where the list has 1-2 schemes every ordering scores the same.`);
  md.push('- Low scores usually mean a scheme is eligible by its rules but off-topic for the person (for example a food-processing scheme for a garment unit): the rules allow any manufacturing business, and the text signal is weak on short descriptions.');

  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'results.md'), md.join('\n') + '\n');
  const csv = ['strategy,personas,' + metricNames.join(',')]
    .concat(summary.map((r) => [JSON.stringify(r.strategy), r.personas, ...metricNames.map((m) => (r[m] === null ? '' : r[m].toFixed(4)))].join(',')));
  fs.writeFileSync(path.join(outDir, 'results.csv'), csv.join('\n') + '\n');
  console.log(md.join('\n'));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
