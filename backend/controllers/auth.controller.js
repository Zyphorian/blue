import asyncHandler from 'express-async-handler';
import User from '../models/user.model.js';
import generateToken from '../utils/generateToken.js';
import { AUTH_COOKIE_NAME, cookieOptions } from '../utils/cookieOptions.js';

// @desc    Register new user
export const registerUser = asyncHandler(async (req, res) => {
  const { name, email, password } = req.body;

  const userExists = await User.findOne({ email });
  if (userExists) {
    res.status(400);
    throw new Error('User already exists');
  }

  const user = await User.create({
    name,
    email,
    password, // let model handle hashing
  });  
  if (user) {
    generateToken(res, user._id);
    res.status(201).json({ id: user._id, name: user.name, email: user.email });
  } else {
    res.status(400);
    throw new Error('Invalid user data');
  }
});

// @desc    Login user
export const loginUser = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  const user = await User.findOne({ email });
  if (user && (await user.matchPassword(password))) {
    generateToken(res, user._id);
    res.json({ id: user._id, name: user.name, email: user.email });
  } else {
    res.status(401);
    throw new Error('Invalid email or password');
  }
});

// @desc    Logout user
export const logoutUser = asyncHandler(async (req, res) => {
  // Same attributes as when the cookie was set, or the browser keeps the old one.
  res.cookie(AUTH_COOKIE_NAME, '', cookieOptions({ expires: new Date(0) }));

  res.status(200).json({ message: 'User logged out' });
});
