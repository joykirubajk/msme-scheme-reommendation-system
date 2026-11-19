// Orchestrates: eligibility engine -> ranking (Python service, else deterministic fallback).
import { evaluateAll, normalizeRules } from './eligibilityEngine.js';
import { rankWithService } from './rankingClient.js';
import { scoreScheme } from './fallbackScorer.js';

const parseJson = (v, fallback) => {
  if (typeof v === 'string') {
    try { return JSON.parse(v); } catch { return fallback; }
  }
  return v ?? fallback;
};

const toNumberOrNull = (v) => (v === null || v === undefined || v === '' || !Number.isFinite(Number(v)) ? null : Number(v));

// Shape sent to the ranking service (and used by the fallback scorer).
export function toRankingScheme(scheme, tier) {
  const bc = parseJson(scheme.beneficiary_categories, []);
  return {
    id: scheme.id,
    name: scheme.name || '',
    description: scheme.description ?? null,
    business_category: scheme.business_category ?? null,
    max_investment: toNumberOrNull(scheme.max_investment),
    location: scheme.location ?? null,
    benefits: parseJson(scheme.benefits, {}) || {},
    rules: normalizeRules(scheme),
    beneficiary_categories: Array.isArray(bc) ? bc : bc && typeof bc === 'object' ? Object.keys(bc) : [],
    tier,
  };
}

const profileForRanking = (p) => ({
  age: p.age ?? null,
  gender: p.gender ?? null,
  social_category: p.social_category ?? null,
  special_category: p.special_category ?? null,
  business_category: p.business_category ?? null,
  investment: p.investment ?? null,
  location: p.location ?? null,
  education: p.education ?? null,
  experience: p.experience ?? null,
  business_description: p.business_description ?? null,
});

// `profile` must be normalised (engine.normalizeProfile). `rank` is injectable for tests.
// Returns { ranked_by: 'ml' | 'fallback' | 'none', model_version, results } where results are
// [{ schemeId, tier, eligibility, score, reasons }] sorted by score desc (ties: lower id first).
export async function recommend(profile, schemes, { rank = rankWithService } = {}) {
  const evaluated = evaluateAll(profile, schemes);
  if (evaluated.length === 0) return { ranked_by: 'none', model_version: null, results: [] };

  const byId = new Map(schemes.map((s) => [s.id, s]));
  const payloadSchemes = evaluated.map((r) => toRankingScheme(byId.get(r.schemeId), r.tier));

  let scored; // Map schemeId -> { score, reasons }
  let rankedBy = 'ml';
  let modelVersion = null;
  try {
    const body = await rank({ profile: profileForRanking(profile), schemes: payloadSchemes });
    scored = new Map(body.results.map((r) => [r.scheme_id, { score: r.score, reasons: r.reasons }]));
    modelVersion = body.model_version;
  } catch (err) {
    console.warn(`Ranking service unavailable, using fallback scorer: ${err.message}`);
    rankedBy = 'fallback';
    scored = new Map(payloadSchemes.map((s) => [s.id, scoreScheme(profile, s)]));
  }

  const results = evaluated
    .map((r) => ({
      schemeId: r.schemeId,
      tier: r.tier,
      eligibility: { passedRules: r.passedRules, unknownRules: r.unknownRules, missingInputs: r.missingInputs },
      ...scored.get(r.schemeId),
    }))
    .sort((a, b) => b.score - a.score || a.schemeId - b.schemeId);

  return { ranked_by: rankedBy, model_version: modelVersion, results };
}
