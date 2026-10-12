// src/utils/upgradeStorage.js
//
// Local persistence for the Skin Upgrader: the attempt history. Preferences
// (animations) are shared with the rest of the game and live in battleStorage.
//
// Everything here is simulated - no real money, no deposits, no withdrawals.

const HISTORY_KEY = "upgradeHistory";
const HISTORY_LIMIT = 50;

const readJson = (key, fallback) => {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return fallback;
    const parsed = JSON.parse(raw);
    return parsed ?? fallback;
  } catch {
    // A malformed value must never break the game.
    return fallback;
  }
};

export const loadUpgradeHistory = () => {
  const list = readJson(HISTORY_KEY, []);
  return Array.isArray(list) ? list.filter((entry) => entry && typeof entry === "object") : [];
};

export const saveUpgrade = (entry) => {
  const next = [entry, ...loadUpgradeHistory()].slice(0, HISTORY_LIMIT);
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
  } catch (err) {
    console.warn("Could not save the upgrade history:", err);
  }
  return next;
};

export const clearUpgradeHistory = () => {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify([]));
  } catch (err) {
    console.warn("Could not clear the upgrade history:", err);
  }
  return [];
};

export const makeUpgradeId = () =>
  `upgrade-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

// The odds the player is shown are exactly the odds the roll uses.
export const successChance = (inputValue, targetValue) => {
  if (!targetValue || targetValue <= 0) return 0;
  return Math.min(100, Math.max(0, (inputValue / targetValue) * 100));
};

export const multiplierOf = (inputValue, targetValue) => {
  if (!inputValue || inputValue <= 0) return 0;
  return targetValue / inputValue;
};
