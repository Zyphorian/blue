import express from 'express';
import { protect } from '../middleware/authMiddleware.js';
import { getProfile } from '../controllers/profile.controller.js';

const router = express.Router();

// Mounted at /api/profile in server.js, so this is the /api/profile endpoint.
router.get('/', protect, getProfile);

export default router;