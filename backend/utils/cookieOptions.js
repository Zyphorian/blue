// Cookie settings for the session JWT.
//
// This matters as soon as the frontend and the API are not on the same site. The
// site is published on GitHub Pages (https://<user>.github.io) while the API runs
// on its own host, which makes every request cross-site. Browsers then require
//
//     SameSite=None; Secure
//
// or they silently drop the cookie: login "succeeds", but the session never
// sticks and the wallet/inventory stay empty. None requires HTTPS, so local
// development over plain http must keep using Lax.
//
// Everything is driven by environment variables - do not hardcode an origin or a
// boolean here:
//   NODE_ENV=production      -> Secure cookies
//   COOKIE_SECURE=true|false -> override Secure explicitly
//   COOKIE_SAMESITE=none|lax|strict
const isProduction = process.env.NODE_ENV === 'production';

export const AUTH_COOKIE_NAME = 'jwt';
export const AUTH_COOKIE_MAX_AGE = 30 * 24 * 60 * 60 * 1000; // 30 days

export const cookieOptions = (extra = {}) => ({
  httpOnly: true,
  secure: isProduction || process.env.COOKIE_SECURE === 'true',
  sameSite: process.env.COOKIE_SAMESITE || (isProduction ? 'none' : 'lax'),
  ...extra,
});

export default cookieOptions;
