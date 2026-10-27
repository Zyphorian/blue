// src/utils/theme.js
//
// Dark / light theme. The whole palette lives in index.css as CSS tokens, so
// switching is just an attribute on <html> - no component needs to know.
// The choice is stored in localStorage and applied by a tiny inline script in
// index.html before the first paint, so a light-mode user never sees a dark flash.
export const THEME_KEY = "uiTheme";

/** Fired after the theme changes, for anything that cannot use CSS (the canvas). */
export const THEME_EVENT = "dsh-theme-changed";

const read = () => {
  try {
    return localStorage.getItem(THEME_KEY) === "light" ? "light" : "dark";
  } catch {
    // Storage unavailable (private mode) - dark is the house default.
    return "dark";
  }
};

export const getStoredTheme = read;

export const currentTheme = () => {
  if (typeof document === "undefined") return "dark";
  return document.documentElement.dataset.theme === "light" ? "light" : "dark";
};

export const applyTheme = (theme) => {
  const next = theme === "light" ? "light" : "dark";
  try {
    document.documentElement.dataset.theme = next;
    localStorage.setItem(THEME_KEY, next);
  } catch {
    // Applying is best-effort; the attribute still changes for this session.
    document.documentElement.dataset.theme = next;
  }
  try {
    window.dispatchEvent(new CustomEvent(THEME_EVENT, { detail: next }));
  } catch {
    // CustomEvent is always available in the browser; ignore in odd environments.
  }
  return next;
};

export const toggleTheme = () => applyTheme(read() === "light" ? "dark" : "light");

export default applyTheme;
