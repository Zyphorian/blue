// src/utils/battleStorage.js
//
// Local persistence for the Case Battle mode: past battles and the player's
// gameplay preferences. Everything stays in the browser - nothing is sent
// anywhere, and nothing here has any real-world value.
import { asset } from "./assetUrl.js";

const HISTORY_KEY = "battleHistory";
const PREFS_KEY = "battlePrefs";
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

const writeJson = (key, value) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (err) {
    console.warn(`Could not save ${key}:`, err);
  }
};

export const DEFAULT_PREFS = {
  // Turned off, a battle resolves instantly instead of revealing round by round.
  animations: true,
};

export const loadPrefs = () => {
  const stored = readJson(PREFS_KEY, {});
  return { ...DEFAULT_PREFS, ...(typeof stored === "object" && stored ? stored : {}) };
};

export const savePrefs = (prefs) => writeJson(PREFS_KEY, prefs);

export const setPref = (key, value) => {
  const next = { ...loadPrefs(), [key]: value };
  savePrefs(next);
  return next;
};

export const loadHistory = () => {
  const list = readJson(HISTORY_KEY, []);
  return Array.isArray(list) ? list.filter((entry) => entry && typeof entry === "object") : [];
};

export const saveBattle = (entry) => {
  const next = [entry, ...loadHistory()].slice(0, HISTORY_LIMIT);
  writeJson(HISTORY_KEY, next);
  return next;
};

export const clearHistory = () => writeJson(HISTORY_KEY, []);

export const makeBattleId = () =>
  `battle-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

// A handful of bot opponents, with CS-style names and a matching avatar.
export const BOTS = [
  { name: "BOT Vitaliy", avatar: asset("/icons/bot-1.svg") },
  { name: "BOT Ivan", avatar: asset("/icons/bot-2.svg") },
  { name: "BOT Sasha", avatar: asset("/icons/bot-3.svg") },
  { name: "BOT Anya", avatar: asset("/icons/bot-4.svg") },
];

export const pickBot = () => BOTS[Math.floor(Math.random() * BOTS.length)];
