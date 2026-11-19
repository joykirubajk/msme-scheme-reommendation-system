import express from 'express';
import { recommendSchemes, getAllSchemes, getFilterOptions, getSchemeById } from '../controllers/schemeController.js';
import authMiddleware from '../middleware/auth.js';

const router = express.Router();

router.post('/recommend', authMiddleware, recommendSchemes);

// Public discovery endpoints. "/filters" must be declared before "/:id".
router.get('/', getAllSchemes);
router.get('/filters', getFilterOptions);
router.get('/:id', getSchemeById);

export default router;
