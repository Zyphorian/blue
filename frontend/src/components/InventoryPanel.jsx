// src/components/InventoryPanel.jsx
import React, { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import styles from "./InventoryPanel.module.css";
import { getCssRarityClass } from "./SkinList.jsx";

// Same key logCaseOpening.js writes to: a JSON array, newest first, capped at 200.
const LOCAL_INVENTORY_KEY = "guestInventory";

// Rarity colours, keyed by the CSS class name getCssRarityClass() returns.
const RARITY_COLORS = {
  covert: "#eb4b4b",
  classified: "#d22fe6",
  restricted: "#8846fe",
  "mil-spec": "#4b68fe",
  "industrial-grade": "#5e98d9",
  "consumer-grade": "#b0c3d9",
  gold: "#fed600",
  "covert-knife": "#fed600",
  "extraordinary-gloves": "#fed600",
};

// Maps that class name onto the stylesheet rule, with a dim fallback.
const RARITY_CLASS_STYLES = {
  covert: "rarityCovert",
  classified: "rarityClassified",
  restricted: "rarityRestricted",
  "mil-spec": "rarityMilSpec",
  "industrial-grade": "rarityIndustrial",
  "consumer-grade": "rarityConsumer",
  gold: "rarityGold",
  "covert-knife": "rarityGold",
  "extraordinary-gloves": "rarityGold",
};

// "mil-spec" -> "mil spec", matching how SkinList.jsx labels rarities.
const formatRarityLabel = (rarityClassString) => {
  const label = String(rarityClassString || "").replace(/-/g, " ").trim();
  if (!label || label === "unknown") return "Unknown";
  return label;
};

const CURRENCY_FORMATTER = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

const formatCurrency = (value) => {
  const amount = Number(value);
  return CURRENCY_FORMATTER.format(Number.isFinite(amount) ? amount : 0);
};

// "2 min ago", "3 h ago", "2 d ago"; older entries / missing stamps fall back.
const formatRelativeTime = (isoString) => {
  const timestamp = Date.parse(isoString);
  if (!isoString || Number.isNaN(timestamp)) return "";

  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)} min ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} h ago`;
  if (seconds < 2592000) return `${Math.floor(seconds / 86400)} d ago`;
  return new Date(timestamp).toLocaleDateString("en-US");
};

// Never let a malformed stored value crash the drawer: parse defensively and
// drop entries that are not objects (older saves could be missing fields).
const loadInventory = () => {
  try {
    const raw = localStorage.getItem(LOCAL_INVENTORY_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item) => item && typeof item === "object");
  } catch (error) {
    console.warn("Could not read the local inventory:", error);
    return [];
  }
};

function InventoryPanel({ isOpen, onClose }) {
  const [items, setItems] = useState([]);

  // Re-read on mount and after every save (the logger dispatches the event).
  const refreshItems = useCallback(() => {
    setItems(loadInventory());
  }, []);

  useEffect(() => {
    refreshItems();

    window.addEventListener("dsh-inventory-updated", refreshItems);
    return () => window.removeEventListener("dsh-inventory-updated", refreshItems);
  }, [refreshItems]);

  // The header badge listens for this instead of taking a callback prop, which
  // would re-subscribe the effect above on every header render.
  useEffect(() => {
    window.dispatchEvent(
      new CustomEvent("dsh-inventory-count", { detail: items.length })
    );
  }, [items]);

  // Escape closes the drawer; only listen while it is actually open.
  useEffect(() => {
    if (!isOpen) return undefined;

    const handleKeyDown = (event) => {
      if (event.key === "Escape") onClose();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  const handleClear = () => {
    try {
      localStorage.removeItem(LOCAL_INVENTORY_KEY);
    } catch (error) {
      console.warn("Could not clear the local inventory:", error);
    }
    setItems([]);
  };

  // document.body can briefly be unavailable during a hot reload; skip rendering
  // rather than letting createPortal throw.
  if (!isOpen || typeof document === "undefined" || !document.body) {
    return null;
  }

  const totalValue = items.reduce((sum, item) => sum + (Number(item.value) || 0), 0);

  // Rendered into <body>: the header's backdrop-filter makes it the containing
  // block for position:fixed children, which would trap this drawer.
  return createPortal(
    <div className={styles.inventoryOverlay} onClick={onClose}>
      {/* stopPropagation so clicks inside the drawer do not close it. */}
      <aside
        className={styles.panel}
        aria-label="Temporary inventory"
        onClick={(event) => event.stopPropagation()}
      >
        <div className={styles.panelHeader}>
          <div className={styles.headerTopRow}>
            <h2 className={styles.title}>Inventory</h2>
            <div className={styles.headerActions}>
              <button type="button" className={styles.headerButton} onClick={handleClear}>
                Clear
              </button>
              <button
                type="button"
                className={`${styles.headerButton} ${styles.clearButton}`}
                onClick={onClose}
              >
                Close
              </button>
            </div>
          </div>
          <div className={styles.headerStats}>
            <span>
              {items.length} {items.length === 1 ? "item" : "items"}
            </span>
            <span className={styles.totalValue}>{formatCurrency(totalValue)}</span>
          </div>
        </div>

        {items.length === 0 ? (
          <p className={styles.emptyState}>
            Nothing opened yet - open a case and your wins show up here.
          </p>
        ) : (
          <div className={styles.itemList}>
            <ul className={styles.list}>
              {items.map((item, index) => {
                // guard: value can be 0 and caseName/obtainedAt can be missing
                const value = Number(item.value) || 0;
                const rarityClass = getCssRarityClass(String(item.rarityClass || ""));
                const rarityLabel = formatRarityLabel(item.rarityClass);
                const rarityColor =
                  RARITY_COLORS[rarityClass] || "var(--cs-text-dim)";
                const rarityTextClass =
                  styles[RARITY_CLASS_STYLES[rarityClass]] || styles.rarityDefault;
                const relativeTime = formatRelativeTime(item.obtainedAt);

                return (
                  <li
                    key={`${item.name || "item"}-${item.obtainedAt || index}`}
                    className={styles.itemRow}
                  >
                    {item.image ? (
                      <img
                        src={item.image}
                        alt={item.name || "Skin"}
                        className={styles.itemImage}
                        loading="lazy"
                        // Hide the browser's broken-image glyph rather than
                        // leaving it in the row when a skin image 404s.
                        onError={(event) => {
                          event.currentTarget.style.visibility = "hidden";
                        }}
                      />
                    ) : null}

                    <div className={styles.itemInfo}>
                      <div className={styles.itemName}>{item.name || "Unknown item"}</div>
                      <div className={styles.metaRow}>
                        <span className={`${styles.rarityTag} ${rarityTextClass}`}>
                          <span
                            className={styles.rarityDot}
                            style={{ background: rarityColor }}
                          />
                          {rarityLabel}
                        </span>
                        {(item.caseName || relativeTime) && (
                          <span className={styles.metaDot}>•</span>
                        )}
                        {item.caseName && (
                          <span className={styles.metaText}>{item.caseName}</span>
                        )}
                        {relativeTime && (
                          <span className={styles.metaText}>{relativeTime}</span>
                        )}
                      </div>
                    </div>

                    <span className={styles.itemValue}>{formatCurrency(value)}</span>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </aside>
    </div>,
    document.body
  );
}

export default InventoryPanel;
