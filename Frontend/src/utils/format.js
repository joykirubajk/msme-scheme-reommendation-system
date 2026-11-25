// Small display helpers shared by scheme lists, details and filters.

const SPECIAL_LABELS = {
  all_india: 'All India',
  sc_st: 'SC/ST',
  pwd: 'Persons with Disabilities',
  bpl_women: 'Women from BPL Families',
  widow: 'Widows',
  transgender: 'Transgender Persons',
};

// "tamil_nadu" -> "Tamil Nadu", "manufacturing" -> "Manufacturing"
export function labelFor(slug) {
  if (slug === null || slug === undefined || slug === '') return '';
  const s = String(slug);
  if (SPECIAL_LABELS[s]) return SPECIAL_LABELS[s];
  return s
    .split('_')
    .map((w) => (w ? w.charAt(0).toUpperCase() + w.slice(1) : w))
    .join(' ');
}

// Indian-style rupee formatting: 250000 -> "₹2.5 lakh", 15000000 -> "₹1.5 crore"
export function formatRupees(amount) {
  const n = Number(amount);
  if (amount === null || amount === undefined || amount === '' || !Number.isFinite(n)) return 'N/A';
  const trim = (x) => (Number.isInteger(x) ? String(x) : x.toFixed(2).replace(/\.?0+$/, ''));
  if (n >= 10000000) return `₹${trim(n / 10000000)} crore`;
  if (n >= 100000) return `₹${trim(n / 100000)} lakh`;
  return `₹${n.toLocaleString('en-IN')}`;
}

const parseMaybeJson = (v, fallback) => {
  if (typeof v !== 'string') return v ?? fallback;
  try {
    return JSON.parse(v);
  } catch {
    return fallback;
  }
};

// Older rows may store JSON columns as strings and beneficiary_categories as an object.
export function normalizeScheme(scheme) {
  if (!scheme) return scheme;
  const benef = parseMaybeJson(scheme.beneficiary_categories, []);
  return {
    ...scheme,
    rules: parseMaybeJson(scheme.rules, {}) || {},
    benefits: parseMaybeJson(scheme.benefits, {}) || {},
    beneficiary_categories: Array.isArray(benef) ? benef : benef && typeof benef === 'object' ? Object.keys(benef) : [],
  };
}

// First http(s) URL inside an official_source note, or null.
export function officialUrl(source) {
  if (typeof source !== 'string') return null;
  const m = source.match(/https?:\/\/[^\s)]+/);
  return m ? m[0] : null;
}

// Friendly message from an axios error.
export function errorMessage(err, fallback = 'Something went wrong. Please try again.') {
  return err?.response?.data?.message || (err?.request && !err?.response ? 'Cannot reach the server. Is the backend running?' : fallback);
}
