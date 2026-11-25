// HTTP client for the Python ranking service (ranking-service/). Throws on ANY problem
// (not configured, timeout, non-200, bad JSON, bad shape) so the caller can fall back.
import http from 'http';
import https from 'https';

// Fallback HTTP POST for Node < 18 where globalThis.fetch is unavailable.
function postJsonNode(endpoint, body, signal) {
  return new Promise((resolve, reject) => {
    const target = new URL(endpoint);
    const transport = target.protocol === 'https:' ? https : http;
    const data = Buffer.from(body, 'utf8');

    const req = transport.request(
      target,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': data.length,
        },
      },
      (res) => {
        const chunks = [];
        res.on('data', (chunk) => chunks.push(chunk));
        res.on('end', () => {
          const text = Buffer.concat(chunks).toString('utf8');
          resolve({
            ok: res.statusCode >= 200 && res.statusCode < 300,
            status: res.statusCode,
            json: async () => JSON.parse(text),
          });
        });
      }
    );

    const onAbort = () => {
      req.destroy(new Error('The operation was aborted'));
    };
    if (signal) {
      if (signal.aborted) return onAbort();
      signal.addEventListener('abort', onAbort, { once: true });
    }

    req.on('error', (err) => {
      if (signal) signal.removeEventListener('abort', onAbort);
      reject(err);
    });
    req.on('close', () => {
      if (signal) signal.removeEventListener('abort', onAbort);
    });

    req.write(data);
    req.end();
  });
}

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
    const endpoint = `${url.replace(/\/+$/, '')}/rank`;
    const bodyText = JSON.stringify(payload);
    const res = typeof fetchImpl === 'function'
      ? await fetchImpl(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: bodyText,
          signal: controller.signal,
        })
      : await postJsonNode(endpoint, bodyText, controller.signal);
    if (!res.ok) {
      let detail = '';
      try {
        const errBody = typeof res.text === 'function' ? await res.text() : JSON.stringify(await res.json());
        if (errBody) detail = `: ${errBody.slice(0, 300)}`;
      } catch { /* ignore */ }
      throw new Error(`ranking service responded ${res.status}${detail}`);
    }
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
