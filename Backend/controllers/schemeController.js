import Scheme from '../models/scheme.js';
import { rankSchemesWithML } from '../services/mlRankingClient.js';

const EDUCATION_LEVELS = {
    'none': 0,
    '8th': 1,
    '10th': 2,
    '12th': 3,
    'diploma': 4,
    'graduation': 5,
    'postgraduation': 6
};

const parseScheme = (scheme) => {
    const parseField = (f) => {
        if (!f) return {};
        if (typeof f === 'object') return f;
        try { return JSON.parse(f); } catch { return {}; }
    };
    return {
        ...scheme,
        rules: parseField(scheme.rules),
        benefits: parseField(scheme.benefits),
        beneficiary_categories: parseField(scheme.beneficiary_categories)
    };
};

function checkEligibility(user, scheme) {
    const rules = scheme.rules || {};
    const beneficiaryCategories = scheme.beneficiary_categories || {};

    if (rules.min_age !== undefined && user.age < rules.min_age) return false;
    
    if (user.beneficiary_category) {
        if (rules.max_age_special !== undefined && user.age > rules.max_age_special) return false;
    } else {
        if (rules.max_age_special !== undefined && !user.beneficiary_category) {
            if (rules.max_age_general !== undefined && user.age > rules.max_age_general) return false;
        }
    }
    
    if (rules.max_age && user.age > rules.max_age) return false;

    if (rules.gender && Array.isArray(rules.gender)) {
        if (!rules.gender.includes(user.gender)) return false;
    }

    if (rules.state && user.location && user.location !== rules.state) return false;
    if (rules.domicile && user.location && user.location !== rules.domicile) return false;

    if (rules.max_investment && user.investment && user.investment > rules.max_investment) return false;
    if (rules.max_project_cost && user.investment && user.investment > rules.max_project_cost) return false;
    if (rules.min_project_cost && user.investment && user.investment < rules.min_project_cost) return false;

    if (rules.max_income && user.income && user.income > rules.max_income) return false;
    if (rules.max_family_income && user.income && user.income > rules.max_family_income) return false;

    if (rules.min_experience && user.experience !== undefined && user.experience < rules.min_experience) return false;
    if (rules.min_experience_years && user.experience !== undefined && user.experience < rules.min_experience_years) return false;

    if (rules.min_education && user.education) {
        const userEduRank = EDUCATION_LEVELS[user.education] || 0;
        const minEduRank = EDUCATION_LEVELS[rules.min_education] || 0;
        if (userEduRank < minEduRank) return false;
    }

    if (rules.max_previous_subsidy && user.previous_subsidy && user.previous_subsidy > rules.max_previous_subsidy) return false;
    if (rules.prior_subsidy_limit && user.previous_subsidy && user.previous_subsidy > rules.prior_subsidy_limit) return false;

    if (user.beneficiary_category && Object.keys(beneficiaryCategories).length > 0) {
        if (!Object.keys(beneficiaryCategories).includes(user.beneficiary_category)) {
            return false;
        }
    }

    return true;
}

// Controller for recommending schemes (Two-stage: Node.js Eligibility + Python ML Ranking)
const recommendSchemes = async (req, res) => {
    try {
        const user = req.body;

        const rawSchemes = await Scheme.findAll();
        const schemes = rawSchemes.map(parseScheme);

        // Stage 1: Rule-based eligibility check in Node.js
        const eligible = schemes.filter(scheme => checkEligibility(user, scheme));

        if (eligible.length === 0) {
            return res.json({
                success: true,
                count: 0,
                data: [],
                message: 'No matching eligible schemes found for this profile.'
            });
        }

        // Stage 2: Python ML Ranking Service call (Phase 1 + Phase 2 + Phase 3)
        const rankedSchemes = await rankSchemesWithML(user, eligible);

        res.json({
            success: true,
            count: rankedSchemes.length,
            data: rankedSchemes
        });
    } catch (error) {
        console.error('Error recommending schemes:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message
        });
    }
};

// Get all schemes
const getAllSchemes = async (req, res) => {
    try {
        const rawSchemes = await Scheme.findAll();
        const schemes = rawSchemes.map(parseScheme);
        res.json({
            success: true,
            data: schemes
        });
    } catch (error) {
        console.error('Error fetching schemes:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message
        });
    }
};


export { recommendSchemes, getAllSchemes };