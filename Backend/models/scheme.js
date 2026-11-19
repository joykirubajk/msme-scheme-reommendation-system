import db from '../config/db.js';

// Columns sent to list views (rules are included because the UI shows eligibility details).
const LIST_COLUMNS = `id, name, description, business_category, max_investment, location,
  rules, benefits, beneficiary_categories, verified, official_source, created_at`;

// Whitelisted ORDER BY clauses - user input never reaches SQL text.
const SORT_SQL = {
    name: { asc: 'LOWER(name) ASC, id ASC', desc: 'LOWER(name) DESC, id DESC' },
    investment: { asc: 'max_investment ASC NULLS LAST, id ASC', desc: 'max_investment DESC NULLS LAST, id DESC' },
    newest: { asc: 'created_at ASC, id ASC', desc: 'created_at DESC, id DESC' },
};

// Escapes LIKE wildcards so a search for "50%" matches the literal text.
const likeEscape = (s) => s.replace(/[\\%_]/g, (c) => `\\${c}`);

class Scheme {
    // Create new scheme
    static async create({ name, description, business_category, max_investment, location, rules, benefits, beneficiary_categories }) {
        const result = await db.query(
            `INSERT INTO schemes (name, description, business_category, max_investment, location, rules, benefits, beneficiary_categories)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            RETURNING *`,
            [name, description, business_category, max_investment, location, JSON.stringify(rules), JSON.stringify(benefits), JSON.stringify(beneficiary_categories)]
        );
        return result.rows[0];
    }

    // Get all schemes (used by the recommendation engine)
    static async findAll() {
        const result = await db.query('SELECT * FROM schemes ORDER BY id');
        return result.rows;
    }

    static async findById(id) {
        const result = await db.query(`SELECT ${LIST_COLUMNS} FROM schemes WHERE id = $1`, [id]);
        return result.rows[0] || null;
    }

    // Filtered, paginated listing. All filters are optional.
    //  category   - schemes for that business type, plus "any"-category schemes that do not
    //               restrict business type in their rules (or list this type)
    //  state      - schemes for that state plus all-India schemes
    //  q          - case-insensitive substring of name or description
    //  investment - user's project cost fits the scheme's max (and min, if any)
    static async search({ category, state, q, investment, sort = 'name', order = 'asc', page = 1, limit = 12 } = {}) {
        const where = [];
        const params = [];
        const p = (v) => { params.push(v); return `$${params.length}`; };

        if (category) {
            const c = p(category);
            where.push(`(business_category = ${c} OR (business_category = 'any' AND
                (rules IS NULL OR (rules::jsonb) -> 'business_categories' IS NULL
                 OR (rules::jsonb) -> 'business_categories' ? ${c})))`);
        }
        if (state) {
            where.push(`(location = ${p(state)} OR location = 'all_india')`);
        }
        if (q) {
            const like = p(`%${likeEscape(q)}%`);
            where.push(`(name ILIKE ${like} ESCAPE '\\' OR description ILIKE ${like} ESCAPE '\\')`);
        }
        if (investment !== undefined) {
            const inv = p(investment);
            where.push(`(max_investment IS NULL OR max_investment >= ${inv})`);
            // No (numeric) minimum means no lower bound. COALESCE avoids NULL ~ regex -> NULL dropping the row.
            where.push(`(COALESCE((rules::jsonb) ->> 'min_project_cost', '') !~ '^[0-9]+(\\.[0-9]+)?$'
                OR ((rules::jsonb) ->> 'min_project_cost')::numeric <= ${inv})`);
        }

        const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
        const orderSql = (SORT_SQL[sort] || SORT_SQL.name)[order === 'desc' ? 'desc' : 'asc'];

        const countRes = await db.query(`SELECT COUNT(*)::int AS total FROM schemes ${whereSql}`, params);
        const total = countRes.rows[0].total;

        const offset = (page - 1) * limit;
        const rowsRes = await db.query(
            `SELECT ${LIST_COLUMNS} FROM schemes ${whereSql} ORDER BY ${orderSql}
             LIMIT ${p(limit)} OFFSET ${p(offset)}`,
            params
        );
        return { schemes: rowsRes.rows, total };
    }

    // Distinct values for filter dropdowns, taken from the data itself.
    static async filterOptions() {
        const result = await db.query(
            `SELECT
               ARRAY(SELECT c FROM (
                       SELECT business_category AS c FROM schemes
                       UNION
                       SELECT jsonb_array_elements_text((rules::jsonb) -> 'business_categories') FROM schemes
                       WHERE jsonb_typeof((rules::jsonb) -> 'business_categories') = 'array'
                     ) cats WHERE c IS NOT NULL AND c <> 'any' ORDER BY c) AS categories,
               ARRAY(SELECT DISTINCT location FROM schemes
                     WHERE location IS NOT NULL AND location <> 'all_india'
                     ORDER BY location) AS locations`
        );
        return result.rows[0];
    }
}

export default Scheme;
