// utils/logCaseOpening.js
import axios from 'axios';
import { apiUrl, hasBackend } from './apiBase.js';

// Guests have no account, so their wins are kept in this browser. A local copy is
// always written, which means a guest sees their skins survive a refresh even
// though nothing was sent to the server.
const LOCAL_INVENTORY_KEY = 'guestInventory';
// A ceiling so a runaway loop cannot fill localStorage, but high enough that a
// normal player never reaches it. At 200 it was being hit by active players, and
// every new win silently discarded the oldest skin - which looked like the skin
// you had just staked vanishing, with no way to refresh it back.
const LOCAL_INVENTORY_LIMIT = 1000;

const saveToLocalInventory = (item) => {
  try {
    const raw = localStorage.getItem(LOCAL_INVENTORY_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    const list = Array.isArray(parsed) ? parsed : [];
    list.unshift(item);
    if (list.length > LOCAL_INVENTORY_LIMIT) {
      // Never drop an item quietly - say which one went.
      const dropped = list[LOCAL_INVENTORY_LIMIT];
      console.warn(
        `Inventory is at its ${LOCAL_INVENTORY_LIMIT} item limit; the oldest entry was dropped:`,
        dropped?.name
      );
    }
    localStorage.setItem(
      LOCAL_INVENTORY_KEY,
      JSON.stringify(list.slice(0, LOCAL_INVENTORY_LIMIT))
    );
  } catch (error) {
    console.warn('Could not save the local inventory item:', error);
  }
};

/**
 * Consume items from the local inventory: each entry in `targets` removes one
 * matching item. Used when an upgrade stakes skins - they are gone whether the
 * upgrade wins or loses.
 */
export const removeFromLocalInventory = (targets = []) => {
  if (!Array.isArray(targets) || targets.length === 0) return;

  try {
    const raw = localStorage.getItem(LOCAL_INVENTORY_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    const remaining = Array.isArray(parsed) ? [...parsed] : [];

    targets.forEach((target) => {
      if (!target) return;
      const index = remaining.findIndex(
        (item) =>
          item &&
          item.name === target.name &&
          (item.obtainedAt || "") === (target.obtainedAt || "") &&
          (item.value ?? 0) === (target.value ?? 0)
      );
      if (index !== -1) remaining.splice(index, 1);
    });

    localStorage.setItem(LOCAL_INVENTORY_KEY, JSON.stringify(remaining));

    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("dsh-inventory-updated"));
    }
  } catch (error) {
    console.warn("Could not remove the staked skins from the inventory:", error);
  }
};

export const logCaseOpeningToBackend = async (caseName, winningSkin, options = {}) => {
  const { isGuest = false } = options;

  const item = {
    name: winningSkin.name,
    value: winningSkin.computedPrice || 0,
    image: winningSkin.img,
    rarityClass: winningSkin.rarityClass || "unknown",
    wear: winningSkin.float || "unknown",
    exterior: winningSkin.wear_category || "unknown",
    gunClass: winningSkin.rarity?.split(" ").pop() || "Unknown",
  };

  saveToLocalInventory({ ...item, caseName, obtainedAt: new Date().toISOString() });

  // Let anything showing the inventory (the panel in the header) refresh itself
  // without needing a page reload.
  try {
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("dsh-inventory-updated"));
    }
  } catch (error) {
    console.warn("Could not announce the inventory update:", error);
  }

  // Nothing to send when playing without an account - the win is already saved
  // locally above, and the API would only answer 401. The same applies when no
  // backend is configured at all (static hosting).
  if (isGuest || !hasBackend()) return;

  try {
    const response = await axios.post(
      apiUrl('/api/inventory/add'),
      { item },
      { withCredentials: true }
    );

    console.log('Inventory updated:', response.data);
  } catch (error) {
    console.error('Failed to add item to inventory:', error);
  }
};
