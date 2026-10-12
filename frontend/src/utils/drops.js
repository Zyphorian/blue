// src/utils/drops.js
//
// Single source of truth for how a virtual "drop" is generated. The single-case
// page and the Case Battle mode both use these helpers, so the player and the bot
// always open containers with identical odds.
//
// Everything here is a simulation: values are virtual points, not money.
import casesData from "../data/casesData.js";
import collectionData from "../data/collectionData.js";
import collectionsData from "../data/collection.js";
import allSkinsData from "../data/AllSkinsData.js";
import { stickerCapsules, stickerCapsuleSkins } from "../data/stickerCapsules.js";
import { getCssRarityClass, specialRarityClasses } from "../components/SkinList.jsx";
import { getSkinPriceForExterior } from "./skinUtils.js";

// Rarer categories have a much smaller chance of dropping.
export const RARITY_PROBABILITIES = [
  { name: "mil-spec", probability: 0.799 },
  { name: "restricted", probability: 0.1598 },
  { name: "classified", probability: 0.032 },
  { name: "covert", probability: 0.0064 },
  { name: "gold", probability: 0.0026 },
];

export const EXTERIOR_PROBABILITIES = [
  { name: "Factory New", probability: 0.05 },
  { name: "Minimal Wear", probability: 0.175 },
  { name: "Field-Tested", probability: 0.375 },
  { name: "Well-Worn", probability: 0.25 },
  { name: "Battle-Scarred", probability: 0.15 },
];

export const FLOAT_RANGES = {
  "Factory New": { min: 0.0, max: 0.07 },
  "Minimal Wear": { min: 0.07, max: 0.15 },
  "Field-Tested": { min: 0.15, max: 0.38 },
  "Well-Worn": { min: 0.38, max: 0.45 },
  "Battle-Scarred": { min: 0.45, max: 1.0 },
};

export const getRandomInt = (min, max) =>
  Math.floor(Math.random() * (max - min + 1)) + min;

export const formatMoney = (value) => {
  if (typeof value !== "number" || !Number.isFinite(value)) return "$0.00";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);
};

export const selectRandomRarity = () => {
  const roll = Math.random();
  let cumulative = 0;
  for (const rarity of RARITY_PROBABILITIES) {
    cumulative += rarity.probability;
    if (roll < cumulative) return rarity.name;
  }
  return RARITY_PROBABILITIES[RARITY_PROBABILITIES.length - 1].name;
};

export const selectRandomExterior = () => {
  const roll = Math.random();
  let cumulative = 0;
  for (const exterior of EXTERIOR_PROBABILITIES) {
    cumulative += exterior.probability;
    if (roll < cumulative) return exterior.name;
  }
  return EXTERIOR_PROBABILITIES[EXTERIOR_PROBABILITIES.length - 1].name;
};

export const generateFloatForExterior = (exterior) => {
  const range = FLOAT_RANGES[exterior];
  if (!range) return Number(Math.random().toFixed(6));
  return Number((Math.random() * (range.max - range.min) + range.min).toFixed(10));
};

// "gold" covers knives and gloves, which live in several rarity classes.
export const getSkinsByRarityCategory = (rarity, pool) => {
  if (!Array.isArray(pool)) return [];
  if (rarity === "gold") {
    return pool.filter((skin) => {
      const css = getCssRarityClass(skin.rarityClass);
      return css === "gold" || css === "covert-knife" || css === "extraordinary-gloves";
    });
  }
  return pool.filter((skin) => getCssRarityClass(skin.rarityClass) === rarity);
};

// Containers = cases, collections and sticker capsules. Their items live in three
// different data files, so lookups go through here.
export const getSkinsForContainer = (containerId) =>
  allSkinsData[containerId] || collectionsData[containerId] || stickerCapsuleSkins[containerId] || [];

// ---------------------------------------------------------------------------
// Battle values
//
// A battle shows one consistent dollar value per skin, so the same skin is worth
// the same amount every time it drops - it never changes between rounds. The wear
// (exterior/float) is still rolled for flavour, but it does not move the price.
// ---------------------------------------------------------------------------
export const battleValueOf = (skin) => {
  const min = typeof skin?.minPrice === "number" ? skin.minPrice : null;
  const max = typeof skin?.maxPrice === "number" ? skin.maxPrice : null;
  if (min === null && max === null) return null;
  const value = min === null ? max : max === null ? min : (min + max) / 2;
  return Math.round(value * 100) / 100;
};

// Only items with a price can take part in a battle - a $0.00 drop would make the
// score meaningless.
export const getBattlePool = (containerId) =>
  getSkinsForContainer(containerId).filter((skin) => battleValueOf(skin) !== null);

const kindOf = (container) => {
  if (container.type === "terminal") return "Terminal";
  if (container.type === "sticker-capsule") return "Sticker Capsule";
  if (collectionData.some((c) => c.id === container.id)) return "Collection";
  return "Case";
};

// Every container that can actually be battled with, with a kind label for filters.
export const getAllContainers = () =>
  [...casesData, ...collectionData, ...stickerCapsules]
    .map((container) => ({
      id: container.id,
      name: container.name,
      image: container.image,
      price: typeof container.price === "number" ? container.price : 0,
      kind: kindOf(container),
    }))
    .filter((container) => getBattlePool(container.id).length > 0);

// One independent random battle drop. The bot and the player each call this
// separately, so both use the same pool and the same odds but get their own result.
export const makeBattleDrop = (containerId) => {
  const pool = getBattlePool(containerId);
  if (!pool.length) return null;

  const rarity = selectRandomRarity();
  const ofRarity = getSkinsByRarityCategory(rarity, pool);
  const skin = ofRarity.length
    ? ofRarity[getRandomInt(0, ofRarity.length - 1)]
    : pool[getRandomInt(0, pool.length - 1)];

  const exterior = selectRandomExterior();
  return {
    ...skin,
    wear_category: exterior,
    float: generateFloatForExterior(exterior),
    value: battleValueOf(skin),
  };
};

// One independent random drop. The bot and the player each call this separately.
export const makeDrop = (containerId) => {
  const pool = getSkinsForContainer(containerId);
  if (!pool.length) return null;

  const rarity = selectRandomRarity();
  const ofRarity = getSkinsByRarityCategory(rarity, pool);
  const skin = ofRarity.length
    ? ofRarity[getRandomInt(0, ofRarity.length - 1)]
    : pool[getRandomInt(0, pool.length - 1)];

  const exterior = selectRandomExterior();
  const float = generateFloatForExterior(exterior);
  const price = getSkinPriceForExterior(skin, exterior);
  const value =
    typeof price === "number" && Number.isFinite(price) ? Math.round(price * 100) / 100 : 0;

  return { ...skin, wear_category: exterior, float, value };
};

export const totalOf = (rounds, side) =>
  Math.round(rounds.reduce((sum, round) => sum + (round[side]?.value || 0), 0) * 100) / 100;

export { getCssRarityClass, specialRarityClasses };
