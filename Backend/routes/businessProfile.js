import express from 'express';
import authMiddleware from '../middleware/auth.js';
import { getBusinessProfile, saveBusinessProfile } from '../controllers/profileController.js';

const router = express.Router();

router.use(authMiddleware);

router.get('/', getBusinessProfile);
router.put('/', saveBusinessProfile);

export default router;
