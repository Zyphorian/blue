import express from 'express';
import { registerUser, loginUser, logoutUser } from '../controllers/auth.controller.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

router.post('/register', registerUser);
router.post('/login', loginUser);
router.post('/logout', logoutUser); // ✅ added logout route
router.get('/profile', protect, (req, res) => {
  res.json(req.user);
});

export default router;
