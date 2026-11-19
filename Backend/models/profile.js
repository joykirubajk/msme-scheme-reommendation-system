import db from '../config/db.js';

const toNum = (v) => (v === null || v === undefined ? null : Number(v));

// DB row -> API shape (DECIMAL columns come back from pg as strings)
const toApi = (row) =>
  row && {
    age: row.age,
    gender: row.gender,
    social_category: row.social_category,
    special_category: row.special_category,
    business_category: row.business_category,
    investment: toNum(row.investment),
    state: row.state,
    annual_income: toNum(row.annual_income),
    education: row.education,
    experience_years: row.experience_years,
    is_new_enterprise: row.is_new_enterprise,
    business_description: row.business_description,
    updated_at: row.updated_at,
  };

class Profile {
  static async findByUserId(userId) {
    const result = await db.query('SELECT * FROM user_profiles WHERE user_id = $1', [userId]);
    return toApi(result.rows[0]) || null;
  }

  // `p` must already be validated (see utils/validate.js)
  static async upsert(userId, p) {
    const result = await db.query(
      `INSERT INTO user_profiles
         (user_id, age, gender, social_category, special_category, business_category, investment,
          state, annual_income, education, experience_years, is_new_enterprise, business_description, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13, NOW())
       ON CONFLICT (user_id) DO UPDATE SET
         age = EXCLUDED.age, gender = EXCLUDED.gender, social_category = EXCLUDED.social_category,
         special_category = EXCLUDED.special_category, business_category = EXCLUDED.business_category,
         investment = EXCLUDED.investment, state = EXCLUDED.state, annual_income = EXCLUDED.annual_income,
         education = EXCLUDED.education, experience_years = EXCLUDED.experience_years,
         is_new_enterprise = EXCLUDED.is_new_enterprise, business_description = EXCLUDED.business_description,
         updated_at = NOW()
       RETURNING *`,
      [
        userId, p.age, p.gender, p.social_category, p.special_category, p.business_category, p.investment,
        p.state, p.annual_income, p.education, p.experience_years, p.is_new_enterprise, p.business_description,
      ]
    );
    return toApi(result.rows[0]);
  }
}

export default Profile;
