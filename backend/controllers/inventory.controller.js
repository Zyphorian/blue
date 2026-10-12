// controllers/inventory.controller.js
import asyncHandler from 'express-async-handler';
import User from '../models/user.model.js';

const addToInventory = asyncHandler(async (req, res) => {
  const { item } = req.body;

  if (!item || !item.name) {
    res.status(400);
    throw new Error('Invalid item data');
  }

  const user = await User.findById(req.user._id);

  if (!user) {
    res.status(404);
    throw new Error('User not found');
  }

  user.inventory.push(item);
  await user.save();

  res.status(201).json({ message: 'Item added to inventory', inventory: user.inventory });
});

export { addToInventory };
