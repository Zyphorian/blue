// src/components/SkinList.jsx
import React, { useState } from "react";
import styles from "./SkinList.module.css";

// Updated specialRarityClasses to include all special items rarity classes
export const specialRarityClasses = [
  "covert knife",
  "extraordinary gloves",
  "gold knife",
  "gold gloves",
];

// Helper function to normalize rarity class strings for matching
export const normalizeRarityClass = (rarityClassString) => {
  return rarityClassString.toLowerCase().replace(/-/g, " ").trim();
};

// Extract base rarity for CSS class names
export const getCssRarityClass = (rarityClassString) => {
  const lowerRarity = rarityClassString.toLowerCase();

  if (lowerRarity.includes("covert knife")) return "covert-knife";
  if (lowerRarity.includes("extraordinary gloves")) return "extraordinary-gloves";
  // Sticker rarities use the same colour ramp as weapon skins.
  if (lowerRarity.includes("high grade")) return "mil-spec";
  if (lowerRarity.includes("remarkable")) return "restricted";
  if (lowerRarity.includes("exotic")) return "classified";
  if (lowerRarity.includes("extraordinary")) return "covert";
  if (lowerRarity.includes("industrial grade")) return "industrial-grade";
  if (lowerRarity.includes("consumer grade")) return "consumer-grade";

  if (lowerRarity.includes("mil-spec")) return "mil-spec";
  if (lowerRarity.includes("restricted")) return "restricted";
  if (lowerRarity.includes("classified")) return "classified";
  if (lowerRarity.includes("covert")) return "covert";
  if (lowerRarity.includes("gold")) return "gold";
  return "";
};

// Define rarity order for sorting
const rarityOrder = {
  "covert": 1,
  "covert-knife": 1,
  "classified": 2,
  "restricted": 3,
  "mil-spec": 4,
  "industrial-grade": 5,
  "consumer-grade": 6,
  "gold": 7,
  "extraordinary-gloves": 7,
};

// Component to render a section of skins
const SkinSection = ({ skins, title, collapsible = false, isCollapsed, onToggle }) => {
  const shouldShowContent = !collapsible || !isCollapsed;

  return (
    <div className={styles.skinSection}>
      {title && (
        <h2 className={styles.skinCardsTitle} onClick={collapsible ? onToggle : null}>
          {title}
          {collapsible && (
            <span className={styles.toggleIndicator}>
              {isCollapsed ? "▼" : "▲"}
            </span>
          )}
        </h2>
      )}

      {shouldShowContent && (
        <div className={styles.skinCardsGrid}>
          {skins.map((skin) => {
            const cssRarity = getCssRarityClass(skin.rarityClass);
            const nameParts = skin.name.split(" | ");
            const nameTop = nameParts[0];
            const nameBottom = nameParts[1];

            return (
              <div
                key={skin.id}
                className={`${styles.skinCard} ${styles[cssRarity] || ""}`}
              >
                <div className={styles.skinCardNameTop}>{nameTop}</div>
                {nameBottom && <div className={styles.skinCardNameBottom}>{nameBottom}</div>}
                {/* Sticker capsules can hold hundreds of items, so load lazily. */}
                <img
                  src={skin.img}
                  alt={skin.alt || skin.name}
                  className={styles.skinCardImage}
                  loading="lazy"
                />
                <div
                  className={`${styles.skinCardRarityType} ${styles[cssRarity] || ""}`}
                >
                  {skin.rarityClass.replace(/-/g, " ")}
                </div>
                <div className={styles.skinCardPrice}>
                  {skin.minPrice !== null && skin.maxPrice !== null
                    ? `$${skin.minPrice.toFixed(2)} - $${skin.maxPrice.toFixed(2)}`
                    : "No Price Data"}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

function SkinList({ initialGunSkins = [], initialSpecialSkins = [] }) {
  // Separate special and gun skins properly by filtering in case the user did not do it
  const specialSkins = initialSpecialSkins.length > 0
    ? initialSpecialSkins
    : initialGunSkins.filter((skin) =>
        specialRarityClasses.includes(normalizeRarityClass(skin.rarityClass))
      );

  const gunSkins = initialGunSkins.length > 0
    ? initialGunSkins.filter(
        (skin) => !specialRarityClasses.includes(normalizeRarityClass(skin.rarityClass))
      )
    : [];

  // Sort gun skins based on rarityOrder
  const sortedGunSkins = [...gunSkins].sort((a, b) => {
    const rarityA = getCssRarityClass(a.rarityClass);
    const rarityB = getCssRarityClass(b.rarityClass);
    return (rarityOrder[rarityA] || 99) - (rarityOrder[rarityB] || 99);
  });

  const [showSpecialItems, setShowSpecialItems] = useState(false);

  const handleSpecialItemCardClick = () => {
    setShowSpecialItems(!showSpecialItems);
  };

  // Generic image for special items card
  const genericSpecialItemImage = "/images/gold.png";

  return (
    <div className={styles.caseViewerContainer}>
      {sortedGunSkins.length === 0 && specialSkins.length === 0 && (
        <p className={styles.noSkinsFound}>
          No skins found for this case. Please check the case ID or data.
        </p>
      )}

      <SkinSection skins={sortedGunSkins} title="Skins in this Case" collapsible={false} />

      {specialSkins.length > 0 && (
        <div className={styles.specialItemsWrapper}>
          <div className={styles.specialItemCardContainer} onClick={handleSpecialItemCardClick}>
            <div className={styles.specialItemCard}>
              <img
                src={genericSpecialItemImage}
                alt="Special Items"
                className={styles.specialItemCardImage}
              />
              <div className={styles.specialItemCardTitle}>
                Special Items
                <span className={styles.toggleIndicator}>
                  {showSpecialItems ? "▲" : "▼"}
                </span>
              </div>
            </div>
          </div>

          {showSpecialItems && (
            <SkinSection skins={specialSkins} title="" collapsible={false} />
          )}
        </div>
      )}
    </div>
  );
}

export default SkinList;
