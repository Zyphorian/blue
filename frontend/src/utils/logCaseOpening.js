// utils/logCaseOpening.js
import axios from 'axios';
import { apiUrl, hasBackend } from './apiBase.js';

// Guests have no account, so their wins are kept in this browser. A local copy is
// always written, which means a guest sees their skins survive a refresh even
// though nothing was sent to the server.
const LOCAL_INVENTORY_KEY = 'guestInventory';
const LOCAL_INVENTORY_LIMIT = 200;

const saveToLocalInventory = (item) => {
  try {
    const raw = localStorage.getItem(LOCAL_INVENTORY_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    const list = Array.isArray(parsed) ? parsed : [];
    list.unshift(item);
    localStorage.setItem(
      LOCAL_INVENTORY_KEY,
      JSON.stringify(list.slice(0, LOCAL_INVENTORY_LIMIT))
    );
  } catch (error) {
    console.warn('Could not save the local inventory item:', error);
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
