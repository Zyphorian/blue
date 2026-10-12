// src/utils/skinUtils.js



// Same FLOAT_RANGES, interpolation factors, etc.
export const getSkinPriceForExterior = (skin, exterior) => {
  if (!skin) return null;

  if (skin.prices && Array.isArray(skin.prices)) {
    const priceEntry = skin.prices.find(p => p.wear_category === exterior);
    if (priceEntry) {
      const priceValue = priceEntry.price?.steam_last_24h ||
                         priceEntry.price?.steam_last_7d ||
                         priceEntry.price?.steam_last_30d ||
                         priceEntry.price?.steam_last_90d ||
                         priceEntry.price?.steam_last_ever;
      if (typeof priceValue === 'number' && !isNaN(priceValue)) {
        return  (priceValue);
      }
    }
  }

  if (typeof skin.minPrice !== 'undefined' && typeof skin.maxPrice !== 'undefined') {
    const min = skin.minPrice;
    const max = skin.maxPrice;

    const exteriorInterpolationFactors = {
      "Factory New": 1.0,
      "Minimal Wear": 0.85,
      "Field-Tested": 0.5,
      "Well-Worn": 0.25,
      "Battle-Scarred": 0.0
    };

    const factor = exteriorInterpolationFactors[exterior];
    return (typeof factor !== 'undefined' ? min + factor * (max - min) : (min + max) / 2);
  }

  return null;
};