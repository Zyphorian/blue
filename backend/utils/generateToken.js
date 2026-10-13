import jwt from 'jsonwebtoken';
import { AUTH_COOKIE_NAME, AUTH_COOKIE_MAX_AGE, cookieOptions } from './cookieOptions.js';

const generateToken = (res, userId) => {
  const token = jwt.sign({ id: userId }, process.env.JWT_SECRET, {
    expiresIn: '30d',
  });

  res.cookie(AUTH_COOKIE_NAME, token, cookieOptions({ maxAge: AUTH_COOKIE_MAX_AGE }));
};

export default generateToken;
