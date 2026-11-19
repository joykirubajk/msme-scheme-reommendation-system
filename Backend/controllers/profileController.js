import Profile from '../models/profile.js';
import { validateProfile } from '../utils/validate.js';
import { ok, fail } from '../utils/response.js';

// GET /api/business-profile -> { profile: {...} | null }
export const getBusinessProfile = async (req, res, next) => {
  try {
    const profile = await Profile.findByUserId(req.user.id);
    ok(res, { profile });
  } catch (error) {
    next(error);
  }
};

// PUT /api/business-profile  (full replace; core fields required)
export const saveBusinessProfile = async (req, res, next) => {
  try {
    const { value, errors } = validateProfile(req.body);
    if (errors.length) return fail(res, 400, 'Invalid profile', errors);

    const profile = await Profile.upsert(req.user.id, value);
    ok(res, { profile }, 'Profile saved');
  } catch (error) {
    next(error);
  }
};
