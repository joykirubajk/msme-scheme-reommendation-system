import User from '../models/user.js';
import db from '../config/db.js';
import { parseId } from '../utils/validate.js';
import { ok, fail } from '../utils/response.js';


// get user profile


export const getProfile = async (req, res, next) => {
    try{
        const user = await User.findById(req.user.id);
        
        res.json({
            success: true,
            data: {
                user
            
            }
        });
    } catch (error) {
        next(error);
    }
};

// Save scheme to collection (idempotent: saving twice is not an error)
export const saveScheme = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const schemeId = parseId(req.body?.scheme_id);

        if (schemeId === null) {
            return fail(res, 400, 'scheme_id must be a positive whole number');
        }

        const schemeCheck = await db.query('SELECT id FROM schemes WHERE id = $1', [schemeId]);
        if (schemeCheck.rows.length === 0) {
            return fail(res, 404, 'Scheme not found');
        }

        const result = await db.query(
            `INSERT INTO user_saved_schemes (user_id, scheme_id)
            VALUES ($1, $2)
            ON CONFLICT (user_id, scheme_id) DO NOTHING
            RETURNING *`,
            [userId, schemeId]
        );

        return ok(res, { saved: true, created: result.rows.length > 0, scheme_id: schemeId }, 'Scheme saved to collection');
    } catch (error) {
        // 23503 = foreign key violation: the token belongs to a user that no longer exists
        if (error.code === '23503') {
            return fail(res, 401, 'Account not found, please sign in again');
        }
        next(error);
    }
};

// Remove scheme from collection (idempotent)
export const unsaveScheme = async (req, res, next) => {
    try {
        const schemeId = parseId(req.params.schemeId);
        if (schemeId === null) {
            return fail(res, 400, 'Scheme id must be a positive whole number');
        }

        const result = await db.query(
            'DELETE FROM user_saved_schemes WHERE user_id = $1 AND scheme_id = $2',
            [req.user.id, schemeId]
        );

        return ok(res, { saved: false, removed: result.rowCount > 0, scheme_id: schemeId }, 'Scheme removed from collection');
    } catch (error) {
        next(error);
    }
};

// Get all saved schemes for user, newest first
export const getSavedSchemes = async (req, res, next) => {
    try {
        const result = await db.query(
            `SELECT s.*, uss.saved_at FROM schemes s
            INNER JOIN user_saved_schemes uss ON s.id = uss.scheme_id
            WHERE uss.user_id = $1
            ORDER BY uss.saved_at DESC, s.id DESC`,
            [req.user.id]
        );

        return ok(res, { schemes: result.rows });
    } catch (error) {
        next(error);
    }
};

// Ids of all saved schemes in one call, so lists can show save state without N+1 requests
export const getSavedSchemeIds = async (req, res, next) => {
    try {
        const result = await db.query(
            'SELECT scheme_id FROM user_saved_schemes WHERE user_id = $1 ORDER BY scheme_id',
            [req.user.id]
        );
        return ok(res, { ids: result.rows.map((r) => r.scheme_id) });
    } catch (error) {
        next(error);
    }
};

// Check if one scheme is saved
export const checkSchemeSaved = async (req, res, next) => {
    try {
        const schemeId = parseId(req.params.schemeId);
        if (schemeId === null) {
            return fail(res, 400, 'Scheme id must be a positive whole number');
        }

        const result = await db.query(
            'SELECT id FROM user_saved_schemes WHERE user_id = $1 AND scheme_id = $2',
            [req.user.id, schemeId]
        );

        return ok(res, { isSaved: result.rows.length > 0 });
    } catch (error) {
        next(error);
    }
};



// update user profile


export const updateProfile = async (req, res, next) => {
    try {
        const {name, email } = req.body;


        const user = await User.update(req.user.id, { name, email });


        res.json({
            success: true,
            message: 'profile updated succesfully',
            data: { user }
        });
    } catch (error) {
        next (error);
    }
};

// change password

export const changepassword = async (req, res, next) => {
    try{
        const {currentPassword, newPassword} = req.body;


        if (!currentPassword || !newPassword) {
            return res.status(400).json({
                success: false,
                message: 'please provide current and new password'
            });
        }


        // verify current Password
        const user = await User.findByEmail(req.user.email);
        const isValid = await User.verifyPassword(currentPassword, user.password_hash);


        if(!isValid) {
            return res.status(401).json({
                success: false,
                message: 'Current password is incorrect'
            });
        }


        // Update password


        await User.updatePassword(req.user.id, newPassword);


        res.json({
            success: true,
            message: 'password changed succesfull'
        });
        
    } catch (error) {
        next(error);
    }
};


// Delete Account


export const deleteAccount = async (req, res, next) => {
    try {
        await User.delete(req.user.id);


        res.json({
            success: true,
            message: 'Account deleted succesfully'
        });


    } catch (error) {
        next(error);
    }
};