import asyncHandler from 'express-async-handler';
import User from '../models/user.model.js';

export const getProfile = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id).select('-password');
  if (!user) {
    res.status(404);
    throw new Error('User not found');
  }

  res.json({
    name: user.name,
    avatar: user.avatar || '/images/user-avatar.png',
    walletBalance: user.wallet || 0, // ✅ FIXED HERE
    inventory: user.inventory || [],
  });
});

