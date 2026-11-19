// HTTP client for the Python ranking service (ranking-service/). Throws on ANY problem
// (not configured, timeout, non-200, bad JSON, bad shape) so the caller can fall back.

export async function rankWithService(
  payload,
  {
    url = process.env.RANKING_SERVICE_URL,
    timeoutMs = Number(process.env.RANKING_TIMEOUT_MS) || 1500,
    fetchImpl = globalThis.fetch,
  } = {}
) {
  if (!url) throw new Error('RANKING_SERVICE_URL not set');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetchImpl(`${url.replace(/\/+$/, '')}/rank`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`ranking service responded ${res.status}`);
    const body = await res.json();
    return validateRankResponse(body, payload.schemes.map((s) => s.id));
  } finally {
    clearTimeout(timer);
  }
}

// Every requested scheme must come back exactly once with a finite score in [0,1].
export function validateRankResponse(body, expectedIds) {
  if (!body || !Array.isArray(body.results) || typeof body.model_version !== 'string') {
    throw new Error('ranking service returned an unexpected shape');
  }
  const seen = new Set();
  for (const r of body.results) {
    const ok = r && Number.isInteger(r.scheme_id) && typeof r.score === 'number' && Number.isFinite(r.score)
      && r.score >= 0 && r.score <= 1 && Array.isArray(r.reasons) && r.reasons.every((x) => typeof x === 'string');
    if (!ok || seen.has(r.scheme_id)) throw new Error('ranking service returned an invalid result');
    seen.add(r.scheme_id);
  }
  if (seen.size !== expectedIds.length || !expectedIds.every((id) => seen.has(id))) {
    throw new Error('ranking service result does not cover the requested schemes');
  }
  return body;
}
