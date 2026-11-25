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
    static async create({ name, description, business_category, max_investment, location, rules, benefits, beneficiary_categories, verified = false, official_source = null }) {
        const result = await db.query(
            `INSERT INTO schemes (name, description, business_category, max_investment, location, rules, benefits, beneficiary_categories, verified, official_source)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            RETURNING ${LIST_COLUMNS}`,
            [
                name,
                description ?? null,
                business_category || 'any',
                max_investment ?? null,
                location || 'all_india',
                JSON.stringify(rules ?? {}),
                JSON.stringify(benefits ?? {}),
                JSON.stringify(beneficiary_categories ?? []),
                Boolean(verified),
                official_source ?? null
            ]
        );
        return result.rows[0];
    }

    // Update an existing scheme
    static async update(id, fields) {
        const result = await db.query(
            `UPDATE schemes
             SET name = COALESCE($1, name),
                 description = COALESCE($2, description),
                 business_category = COALESCE($3, business_category),
                 max_investment = $4,
                 location = COALESCE($5, location),
                 rules = COALESCE($6, rules),
                 benefits = COALESCE($7, benefits),
                 beneficiary_categories = COALESCE($8, beneficiary_categories),
                 verified = COALESCE($9, verified),
                 official_source = $10,
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = $11
             RETURNING ${LIST_COLUMNS}`,
            [
                fields.name ?? null,
                fields.description ?? null,
                fields.business_category ?? null,
                fields.max_investment !== undefined ? fields.max_investment : null,
                fields.location ?? null,
                fields.rules !== undefined ? JSON.stringify(fields.rules) : null,
                fields.benefits !== undefined ? JSON.stringify(fields.benefits) : null,
                fields.beneficiary_categories !== undefined ? JSON.stringify(fields.beneficiary_categories) : null,
                fields.verified !== undefined ? Boolean(fields.verified) : null,
                fields.official_source !== undefined ? fields.official_source : null,
                id
            ]
        );
        return result.rows[0] || null;
    }

    // Toggle verification status and optional official source
    static async verify(id, { verified, official_source }) {
        const result = await db.query(
            `UPDATE schemes
             SET verified = $1,
                 official_source = COALESCE($2, official_source),
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = $3
             RETURNING ${LIST_COLUMNS}`,
            [Boolean(verified), official_source ?? null, id]
        );
        return result.rows[0] || null;
    }

    // Delete a scheme
    static async delete(id) {
        const result = await db.query('DELETE FROM schemes WHERE id = $1 RETURNING id', [id]);
        return result.rows[0] || null;
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
