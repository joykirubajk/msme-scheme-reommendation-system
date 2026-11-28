import Scheme from '../models/scheme.js';
import { normalizeProfile } from './eligibilityEngine.js';
import { recommend } from './recommendationService.js';

const STATE_ALIASES = [
  ['tamil nadu', 'tamil_nadu'],
  ['tamilnadu', 'tamil_nadu'],
  ['tn', 'tamil_nadu'],
  ['maharashtra', 'maharashtra'],
  ['delhi', 'delhi'],
  ['uttar pradesh', 'uttar_pradesh'],
  ['karnataka', 'karnataka'],
  ['kerala', 'kerala'],
  ['andhra pradesh', 'andhra_pradesh'],
  ['telangana', 'telangana'],
  ['gujarat', 'gujarat'],
  ['rajasthan', 'rajasthan'],
  ['west bengal', 'west_bengal'],
];

const CATEGORY_KEYWORDS = [
  ['manufacturing', ['manufacturing', 'factory', 'unit', 'pickle', 'garment', 'spice', 'food', 'making', 'production', 'craft', 'wood', 'brass']],
  ['service', ['service', 'repair', 'salon', 'tailor', 'consult', 'it', 'software', 'clinic', 'workshop']],
  ['retail', ['retail', 'shop', 'store', 'cart', 'vendor', 'tea', 'trading', 'kirana']],
  ['agriculture', ['agriculture', 'agri', 'farm', 'dairy', 'poultry', 'cold storage']],
];

function extractInvestment(text) {
  const cr = text.match(/(\d+(?:\.\d+)?)\s*(?:cr|crore|crores)\b/i);
  if (cr) return Math.round(Number(cr[1]) * 1e7);
  const lakh = text.match(/(\d+(?:\.\d+)?)\s*(?:l|lac|lacs|lakh|lakhs)\b/i);
  if (lakh) return Math.round(Number(lakh[1]) * 1e5);
  const k = text.match(/(\d+(?:\.\d+)?)\s*k\b/i);
  if (k) return Math.round(Number(k[1]) * 1e3);
  const raw = text.match(/\b(\d{5,9})\b/);
  if (raw) return Number(raw[1]);
  return undefined;
}

function extractAge(text) {
  const m = text.match(/\b(?:age|aged|yrs|years)\s*[:=-]?\s*(\d{2})\b/i)
    || text.match(/\b(\d{2})\s*(?:yrs|years?\s*old)\b/i);
  if (!m) return undefined;
  const age = Number(m[1]);
  return age >= 18 && age <= 100 ? age : undefined;
}

export function extractProfileFromMessage(message) {
  const lower = message.toLowerCase();
  const raw = { business_description: message.trim() };

  const inv = extractInvestment(lower);
  if (inv !== undefined) raw.investment = inv;

  const age = extractAge(lower);
  if (age !== undefined) raw.age = age;

  for (const [alias, slug] of STATE_ALIASES) {
    if (new RegExp(`\\b${alias}\\b`, 'i').test(lower)) {
      raw.location = slug;
      break;
    }
  }

  for (const [cat, words] of CATEGORY_KEYWORDS) {
    if (words.some((w) => new RegExp(`\\b${w}\\b`, 'i').test(lower))) {
      raw.business_category = cat;
      break;
    }
  }

  if (/\b(women|woman|female|girl|mahila|widow)\b/i.test(lower)) {
    raw.gender = 'female';
  } else if (/\b(male|man|men)\b/i.test(lower)) {
    raw.gender = 'male';
  }

  if (/\bsc\b/i.test(lower)) raw.social_category = 'sc';
  else if (/\bst\b/i.test(lower)) raw.social_category = 'st';
  else if (/\bobc\b/i.test(lower)) raw.social_category = 'obc';

  if (/\b(pwd|disabled|handicap)\b/i.test(lower)) raw.special_category = 'pwd';
  else if (/\bwidow\b/i.test(lower)) raw.special_category = 'widow';

  return normalizeProfile(raw);
}

const fmtInr = (x) => {
  const n = Number(x);
  if (!Number.isFinite(n) || n <= 0) return null;
  if (n >= 1e7) return `₹${(n / 1e7).toFixed(1)} Cr`;
  if (n >= 1e5) return `₹${(n / 1e5).toFixed(1)}L`;
  return `₹${Math.round(n).toLocaleString('en-IN')}`;
};

function formatSchemeBrief(scheme) {
  const parts = [];
  const b = scheme.benefits && typeof scheme.benefits === 'object' && !Array.isArray(scheme.benefits) ? scheme.benefits : {};
  if (b.subsidy_percent) parts.push(`${b.subsidy_percent}% subsidy`);
  if (b.max_subsidy) parts.push(`max subsidy ${fmtInr(b.max_subsidy)}`);
  if (b.loan_amount) parts.push(`loan up to ${fmtInr(b.loan_amount)}`);
  if (scheme.max_investment) parts.push(`max project cost ${fmtInr(scheme.max_investment)}`);
  return parts.join(' • ');
}

function findDirectSchemeMatch(message, schemes) {
  const q = message.toLowerCase();
  const scored = schemes
    .map((s) => {
      const name = (s.name || '').toLowerCase();
      const short = name.split(/[\s-]+/)[0];
      let hit = 0;
      if (short.length >= 3 && new RegExp(`\\b${short}\\b`, 'i').test(q)) hit += 3;
      if (q.includes(name)) hit += 5;
      return { scheme: s, hit };
    })
    .filter((x) => x.hit > 0)
    .sort((a, b) => b.hit - a.hit);
  return scored[0]?.scheme || null;
}

export async function handleChatMessage(message, lang = 'en') {
  const text = (message || '').trim();
  const isTamil = lang === 'ta';

  if (!text) {
    return {
      reply: isTamil
        ? 'உங்கள் தொழில், முதலீடு அல்லது மாநிலத்தைப் பற்றி கேளுங்கள் — ஏற்ற திட்டங்களைக் காட்டுகிறேன்.'
        : 'Ask me about your business, investment, state, or a specific scheme name!',
      schemes: [],
      ranked_by: null,
    };
  }

  if (/^(hi|hello|hey|vanakkam|வணக்கம்)\b/i.test(text) && text.split(/\s+/).length <= 3) {
    return {
      reply: isTamil
        ? 'வணக்கம்! உங்கள் தொழில் வகை, முதலீடு (எ.கா. "5 lakh"), மற்றும் மாநிலத்தைச் சொல்லுங்கள். உங்களுக்கு ஏற்ற MSME திட்டங்களைத் தேடித் தருகிறேன்.'
        : 'Hello! Tell me your business idea, planned investment (e.g. "5 lakh"), and state — or ask about any scheme like PMEGP, MUDRA, or PMFME.',
      schemes: [],
      ranked_by: null,
    };
  }

  const allSchemes = await Scheme.findAll();
  const direct = findDirectSchemeMatch(text, allSchemes);
  if (direct && /\b(what|about|detail|subsidy|evlo|info|tell|explain|eligibility|loan)\b/i.test(text)) {
    const brief = formatSchemeBrief(direct);
    const reply = isTamil
      ? `${direct.name}: ${direct.description || ''}${brief ? `\n\nமுக்கிய விவரம்: ${brief}` : ''}`
      : `${direct.name}: ${direct.description || ''}${brief ? `\n\nKey highlights: ${brief}` : ''}`;
    return {
      reply: reply.trim(),
      schemes: [{ ...direct, score: 1, tier: 'eligible', reasons: ['Direct scheme match'] }],
      ranked_by: 'direct',
    };
  }

  const profile = extractProfileFromMessage(text);
  const ranked = await recommend(profile, allSchemes);
  const byId = new Map(allSchemes.map((s) => [s.id, s]));
  const top = ranked.results.slice(0, 4).map((r) => ({
    ...byId.get(r.schemeId),
    tier: r.tier,
    score: r.score,
    reasons: r.reasons,
  }));

  if (top.length === 0) {
    return {
      reply: isTamil
        ? 'உங்கள் விவரங்களுக்கு நேரடி பொருத்தம் கிடைக்கவில்லை. முதலீடு, மாநிலம் அல்லது தொழில் வகையைச் சேர்த்து முயற்சிக்கவும்.'
        : 'I could not find an exact match for those details. Try including your state, investment amount, or business type (e.g., "Tamil Nadu 5 lakh manufacturing").',
      schemes: [],
      ranked_by: ranked.ranked_by,
    };
  }

  const reply = isTamil
    ? `உங்கள் கேள்விக்கு ஏற்ற ${top.length} சிறந்த திட்டங்கள் கீழே உள்ளன:`
    : `Here are the top ${top.length} matching MSME scheme(s) for your query:`;

  return {
    reply,
    schemes: top,
    ranked_by: ranked.ranked_by,
  };
}
