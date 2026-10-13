// src/utils/apiBase.js
//
// The backend is a separate application (see the repository's `backend` folder)
// and is NOT part of the GitHub Pages deployment, so the site must work with no
// backend at all - every call already has a guest fallback.
//
// The URL is configuration, never hardcoded:
//   * local development  -> http://localhost:5000 by default
//   * production         -> whatever VITE_API_URL is set to at build time
// Set it in a local .env file (git-ignored) or as a repository variable/secret
// used by the deploy workflow. Nothing here is a secret - the API URL is public
// information - but no .env file should ever be committed.

const rawBase = (import.meta.env.VITE_API_URL || "").trim();
const fallback = import.meta.env.DEV ? "http://localhost:5000" : "";

/** Base URL of the API, or an empty string when there is no backend configured. */
export const API_BASE = (rawBase || fallback).replace(/\/+$/, "");

/** True when a backend is configured; screens should fall back to guest mode when false. */
export const hasBackend = () => API_BASE !== "";

/** Build a full API URL: apiUrl("/api/profile"). Returns "" when unconfigured. */
export const apiUrl = (path) => {
  if (!API_BASE) return "";
  return `${API_BASE}${path.startsWith("/") ? path : `/${path}`}`;
};

export default apiUrl;
