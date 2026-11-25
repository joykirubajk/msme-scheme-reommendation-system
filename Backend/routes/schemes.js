import express from 'express';
import {
    recommendSchemes,
    getAllSchemes,
    getFilterOptions,
    getSchemeById,
    createScheme,
    updateScheme,
    verifyScheme,
    deleteScheme
} from '../controllers/schemeController.js';
import authMiddleware from '../middleware/auth.js';
import requireAdmin from '../middleware/requireAdmin.js';

const router = express.Router();

router.post('/recommend', authMiddleware, recommendSchemes);

// Admin scheme management endpoints
router.post('/', authMiddleware, requireAdmin, createScheme);
router.put('/:id', authMiddleware, requireAdmin, updateScheme);
router.patch('/:id/verify', authMiddleware, requireAdmin, verifyScheme);
router.delete('/:id', authMiddleware, requireAdmin, deleteScheme);

// Public discovery endpoints. "/filters" must be declared before "/:id".
router.get('/', getAllSchemes);
router.get('/filters', getFilterOptions);
router.get('/:id', getSchemeById);

export default router;
