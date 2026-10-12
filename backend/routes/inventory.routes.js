// routes/inventory.routes.js
import express from 'express';
import { protect } from '../middleware/authMiddleware.js';
import { addToInventory } from '../controllers/inventory.controller.js';

const router = express.Router();

router.post('/add', protect, addToInventory);

export default router;