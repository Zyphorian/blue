// src/utils/assetUrl.js
//
// Static files in `public/` are served from the deployment root, which is NOT the
// domain root on GitHub Pages (this site lives at /blue/). A path like
// "/icons/logo.png" works with `npm run dev` but 404s online. Everything that
// points into public/ goes through asset() so the single `base` setting in
// vite.config.js controls every URL.
//
// BASE_URL always ends with a slash ("/" locally, "/blue/" on GitHub Pages).

export const BASE_URL = import.meta.env.BASE_URL || "/";

// React Router wants the same prefix without the trailing slash.
export const ROUTER_BASENAME = BASE_URL.replace(/\/+$/, "") || "/";

/**
 * Turn a public/ path into a deployment-aware URL.
 * Absolute URLs, data: and blob: values are returned untouched, so remote skin
 * artwork and inline images keep working.
 * Filenames with spaces (there are a few) are encoded so any server accepts them.
 */
export const asset = (path) => {
  if (!path) return path;
  const value = String(path);
  if (/^(https?:)?\/\//i.test(value) || /^(data|blob):/i.test(value)) return value;

  const clean = value.replace(/^\/+/, "");
  // Idempotent on purpose. collectionData already runs its paths through asset(),
  // and CaseCard runs them through it again, which produced
  // "/blue/blue/collection/..." - a 404 that the card's error handler hid, so the
  // collection artwork on the home page was blank.
  const base = BASE_URL.replace(/^\/+/, ""); // "blue/" on Pages, "" locally
  if (base && clean.startsWith(base)) return `/${clean}`;

  return encodeURI(`${BASE_URL}${clean}`);
};

export default asset;
