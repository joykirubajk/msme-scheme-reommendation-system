import Scheme from '../models/scheme.js';
import { normalizeProfile, missingRequiredFields } from '../services/eligibilityEngine.js';
import { recommend } from '../services/recommendationService.js';
import Profile from '../models/profile.js';
import { validateProfile, validateSchemeQuery, parseId, SCHEME_SORTS } from '../utils/validate.js';
import { ok, fail } from '../utils/response.js';

// Controller for recommending schemes. Requires login.
// Body: { profile?: {...}, save_profile?: boolean }. Without `profile`, the user's saved profile is used.
// Returns eligible + possibly-eligible schemes ordered by ranking score (desc); each carries `tier`, `score`,
// `reasons` and `eligibility` (passedRules / unknownRules / missingInputs). `ranked_by` is 'ml' (Python service)
// or 'fallback' (deterministic scorer). Not-eligible schemes are never returned.
const recommendSchemes = async (req, res, next) => {
    try {
        const { profile: provided, save_profile: saveProfile } = req.body || {};
        let profileInput;

        if (provided !== undefined && provided !== null) {
            const { value, errors } = validateProfile(provided);
            if (errors.length > 0) {
                return fail(res, 400, 'Invalid profile', errors);
            }
            profileInput = value;
            if (saveProfile === true) {
                await Profile.upsert(req.user.id, value);
            }
        } else {
            profileInput = await Profile.findByUserId(req.user.id);
            if (!profileInput) {
                return fail(res, 400, 'No profile provided and no saved profile found');
            }
        }

        const profile = normalizeProfile(profileInput);

        const missing = missingRequiredFields(profile);
        if (missing.length > 0) {
            return fail(res, 400, 'Missing or invalid profile fields', missing.map((field) => ({
                field,
                message: `${field} is required`
            })));
        }

        const schemes = await Scheme.findAll();
        const byId = new Map(schemes.map((s) => [s.id, s]));
        const ranked = await recommend(profile, schemes);

        const data = ranked.results.map((r) => ({
            ...byId.get(r.schemeId),
            tier: r.tier,
            score: r.score,
            reasons: r.reasons,
            eligibility: r.eligibility
        }));

        res.json({
            success: true,
            count: data.length,
            eligible_count: ranked.results.filter((r) => r.tier === 'eligible').length,
            possible_count: ranked.results.filter((r) => r.tier === 'possibly_eligible').length,
            ranked_by: ranked.ranked_by,
            model_version: ranked.model_version,
            data
        });
    } catch (error) {
        next(error);
    }
};

// GET /api/schemes?category=&state=&q=&investment=&sort=name|investment|newest&order=asc|desc&page=&limit=
// -> { data: { schemes, pagination: { page, limit, total, totalPages } } }
const getAllSchemes = async (req, res, next) => {
    try {
        const { value, errors } = validateSchemeQuery(req.query);
        if (errors.length > 0) {
            return fail(res, 400, 'Invalid query parameters', errors);
        }
        const { schemes, total } = await Scheme.search(value);
        return ok(res, {
            schemes,
            pagination: {
                page: value.page,
                limit: value.limit,
                total,
                totalPages: Math.max(1, Math.ceil(total / value.limit))
            },
            filters: {
                category: value.category ?? null,
                state: value.state ?? null,
                q: value.q ?? null,
                investment: value.investment ?? null,
                sort: value.sort,
                order: value.order
            }
        });
    } catch (error) {
        next(error);
    }
};

// GET /api/schemes/filters -> { data: { categories:[...], locations:[...], sorts:[...] } }
const getFilterOptions = async (req, res, next) => {
    try {
        const options = await Scheme.filterOptions();
        return ok(res, {
            categories: options.categories || [],
            locations: options.locations || [],
            sorts: SCHEME_SORTS
        });
    } catch (error) {
        next(error);
    }
};

// GET /api/schemes/:id
const getSchemeById = async (req, res, next) => {
    try {
        const id = parseId(req.params.id);
        if (id === null) {
            return fail(res, 400, 'Scheme id must be a positive whole number');
        }
        const scheme = await Scheme.findById(id);
        if (!scheme) {
            return fail(res, 404, 'Scheme not found');
        }
        return ok(res, scheme);
    } catch (error) {
        next(error);
    }
};

// Helper to parse and validate admin scheme payloads.
function parseSchemePayload(body, { requireName = false } = {}) {
    const b = body && typeof body === 'object' ? body : {};
    const errors = [];
    const name = typeof b.name === 'string' ? b.name.trim() : '';
    if (requireName && !name) {
        errors.push({ field: 'name', message: 'Scheme name is required' });
    }
    let maxInvestment = null;
    if (b.max_investment !== undefined && b.max_investment !== null && b.max_investment !== '') {
        const num = Number(b.max_investment);
        if (!Number.isFinite(num) || num < 0) {
            errors.push({ field: 'max_investment', message: 'max_investment must be a non-negative number' });
        } else {
            maxInvestment = num;
        }
    }
    const payload = {
        name: name || undefined,
        description: typeof b.description === 'string' ? b.description.trim() : undefined,
        business_category: typeof b.business_category === 'string' && b.business_category.trim() ? b.business_category.trim() : 'any',
        max_investment: maxInvestment,
        location: typeof b.location === 'string' && b.location.trim() ? b.location.trim() : 'all_india',
        rules: b.rules && typeof b.rules === 'object' && !Array.isArray(b.rules) ? b.rules : {},
        benefits: b.benefits && typeof b.benefits === 'object' && !Array.isArray(b.benefits) ? b.benefits : {},
        beneficiary_categories: Array.isArray(b.beneficiary_categories) ? b.beneficiary_categories : [],
        verified: Boolean(b.verified),
        official_source: typeof b.official_source === 'string' && b.official_source.trim() ? b.official_source.trim() : null,
    };
    return { payload, errors };
}

// POST /api/schemes (admin)
const createScheme = async (req, res, next) => {
    try {
        const { payload, errors } = parseSchemePayload(req.body, { requireName: true });
        if (errors.length > 0) return fail(res, 400, 'Invalid scheme data', errors);
        const created = await Scheme.create(payload);
        return ok(res, created, 'Scheme created', 201);
    } catch (error) {
        next(error);
    }
};

// PUT /api/schemes/:id (admin)
const updateScheme = async (req, res, next) => {
    try {
        const id = parseId(req.params.id);
        if (id === null) return fail(res, 400, 'Scheme id must be a positive whole number');
        const { payload, errors } = parseSchemePayload(req.body, { requireName: true });
        if (errors.length > 0) return fail(res, 400, 'Invalid scheme data', errors);
        const updated = await Scheme.update(id, payload);
        if (!updated) return fail(res, 404, 'Scheme not found');
        return ok(res, updated);
    } catch (error) {
        next(error);
    }
};

// PATCH /api/schemes/:id/verify (admin)
const verifyScheme = async (req, res, next) => {
    try {
        const id = parseId(req.params.id);
        if (id === null) return fail(res, 400, 'Scheme id must be a positive whole number');
        const verified = Boolean(req.body?.verified);
        const official_source = typeof req.body?.official_source === 'string' && req.body.official_source.trim()
            ? req.body.official_source.trim()
            : null;
        const updated = await Scheme.verify(id, { verified, official_source });
        if (!updated) return fail(res, 404, 'Scheme not found');
        return ok(res, updated);
    } catch (error) {
        next(error);
    }
};

// DELETE /api/schemes/:id (admin)
const deleteScheme = async (req, res, next) => {
    try {
        const id = parseId(req.params.id);
        if (id === null) return fail(res, 400, 'Scheme id must be a positive whole number');
        const deleted = await Scheme.delete(id);
        if (!deleted) return fail(res, 404, 'Scheme not found');
        return ok(res, { id: deleted.id });
    } catch (error) {
        next(error);
    }
};

export {
    recommendSchemes,
    getAllSchemes,
    getFilterOptions,
    getSchemeById,
    createScheme,
    updateScheme,
    verifyScheme,
    deleteScheme
};