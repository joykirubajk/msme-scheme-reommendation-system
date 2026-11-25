import User from '../models/user.js';

/**
 * Ensures the authenticated user has the 'admin' role in the database.
 */
const requireAdmin = async (req, res, next) => {
    try {
        const user = req.user?.id ? await User.findById(req.user.id) : null;
        if (!user || user.role !== 'admin') {
            return res.status(403).json({
                success: false,
                message: 'Admin access required'
            });
        }
        req.user.role = user.role;
        next();
    } catch (error) {
        next(error);
    }
};

export default requireAdmin;
