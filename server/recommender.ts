import type { Item, Weather, Wear } from "@shared/schema";

export const OUTFIT_STYLES = [
  "casual",
  "smart-casual",
  "business-casual",
  "business",
  "formal",
  "evening",
  "travel",
  "statement",
] as const;

export type OutfitStyle = (typeof OUTFIT_STYLES)[number];

export const OUTFIT_STYLE_LABELS: Record<OutfitStyle, string> = {
  casual: "Casual",
  "smart-casual": "Smart casual",
  "business-casual": "Business casual",
  business: "Business",
  formal: "Formal",
  evening: "Evening",
  travel: "Travel / comfort",
  statement: "Statement",
};

type CoreFormality = "casual" | "smart-casual" | "business" | "formal";

const STYLE_PROFILES: Record<
  OutfitStyle,
  {
    targetFormality: CoreFormality;
    reason: string;
  }
> = {
  casual: {
    targetFormality: "casual",
    reason:
      "Casual mode relaxes the business wardrobe by choosing the least formal workable pieces and keeping the outfit easygoing.",
  },
  "smart-casual": {
    targetFormality: "smart-casual",
    reason:
      "Smart casual keeps the outfit polished without making it feel like a full office uniform.",
  },
  "business-casual": {
    targetFormality: "smart-casual",
    reason:
      "Business casual uses work-ready pieces with a softer register than the standard business outfit.",
  },
  business: {
    targetFormality: "business",
    reason:
      "Business mode prioritizes structured, office-ready pieces with restrained color coordination.",
  },
  formal: {
    targetFormality: "formal",
    reason:
      "Formal mode pulls the most elevated pieces into a sharper, event-ready register.",
  },
  evening: {
    targetFormality: "business",
    reason:
      "Evening mode leans darker and more intentional, using the wardrobe's dressier pieces without feeling daytime-office.",
  },
  travel: {
    targetFormality: "smart-casual",
    reason:
      "Travel mode favors comfort, broader temperature range, and pieces that can move from transit to casual plans.",
  },
  statement: {
    targetFormality: "business",
    reason:
      "Statement mode lets one stronger color or texture lead while the rest of the outfit stays restrained.",
  },
};

// Color theory: simple HSL-distance based "neutrality" + complementary pairing
function hexToHsl(hex: string): { h: number; s: number; l: number } {
  const m = hex.replace("#", "").match(/.{1,2}/g);
  if (!m) return { h: 0, s: 0, l: 0 };
  const [r, g, b] = m.map((x) => parseInt(x, 16) / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      case b:
        h = (r - g) / d + 4;
        break;
    }
    h *= 60;
  }
  return { h, s, l };
}

function isNeutral(hex: string): boolean {
  const { s } = hexToHsl(hex);
  return s < 0.18;
}

function colorHarmony(a: string, b: string): number {
  const A = hexToHsl(a);
  const B = hexToHsl(b);
  if (isNeutral(a) || isNeutral(b)) return 1.0; // neutrals match anything
  const dh = Math.min(Math.abs(A.h - B.h), 360 - Math.abs(A.h - B.h));
  // Same family or complementary score well; awkward 60-120 gaps lower
  if (dh < 30) return 0.9;
  if (dh > 150) return 0.85; // near-complementary
  if (dh < 60) return 0.7;
  return 0.55;
}

function formalityRank(f: string): number {
  return { casual: 0, "smart-casual": 1, business: 2, formal: 3 }[f] ?? 1;
}

function normalizeStyle(style: string): OutfitStyle {
  return OUTFIT_STYLES.includes(style as OutfitStyle)
    ? (style as OutfitStyle)
    : "business";
}

function styleFit(item: Item, style: OutfitStyle): number {
  const rank = formalityRank(item.formality);
  const hsl = hexToHsl(item.colorHex);
  if (style === "casual") {
    return rank === 0 ? 0.3 : rank === 1 ? 0.16 : rank === 2 ? 0.04 : -0.18;
  }
  if (style === "business-casual") {
    return rank === 1 ? 0.18 : rank === 2 ? 0.1 : rank === 0 ? 0.04 : -0.08;
  }
  if (style === "evening") {
    return (hsl.l < 0.42 ? 0.16 : -0.04) + (rank >= 2 ? 0.08 : 0);
  }
  if (style === "travel") {
    const tempRange = item.maxTempF - item.minTempF;
    return Math.min(0.18, tempRange / 500) - (rank === 3 ? 0.12 : 0);
  }
  if (style === "statement") {
    return hsl.s > 0.35 ? 0.18 : 0;
  }
  return 0;
}

function tempFitsItem(temp: number, item: Item): number {
  if (temp >= item.minTempF && temp <= item.maxTempF) return 1.0;
  const overshoot = Math.min(
    Math.abs(temp - item.minTempF),
    Math.abs(temp - item.maxTempF)
  );
  return Math.max(0, 1 - overshoot / 20);
}

function recencyPenalty(item: Item, now: number): number {
  if (!item.lastWornAt) return 0;
  const daysSince = (now - item.lastWornAt) / (24 * 60 * 60 * 1000);
  if (daysSince < 1) return 0.6;
  if (daysSince < 3) return 0.3;
  if (daysSince < 7) return 0.1;
  return 0;
}

export interface OutfitRecommendation {
  items: Item[];
  reasons: string[];
  weather: Weather;
  score: number;
  targetFormality: string;
}

export function recommendOutfit(
  allItems: Item[],
  weather: Weather,
  recentWears: Wear[],
  style: OutfitStyle = "business",
  variation = 0,
  seedItemId?: number
): OutfitRecommendation | null {
  const targetStyle = normalizeStyle(style);
  const profile = STYLE_PROFILES[targetStyle];
  const now = Date.now();
  const targetRank = formalityRank(profile.targetFormality);
  const seedItem = seedItemId ? allItems.find((item) => item.id === seedItemId) : undefined;

  // helper: filter items by category and score them
  const score = (item: Item, partners: Item[] = []): number => {
    let s = 1.0;
    s *= tempFitsItem(weather.tempF, item); // weather fit
    s -= recencyPenalty(item, now); // avoid recently worn
    // Formality match
    const fr = formalityRank(item.formality);
    s -= Math.abs(fr - targetRank) * 0.15;
    s += styleFit(item, targetStyle);
    // Color harmony with partners
    if (partners.length) {
      const harm =
        partners.reduce((acc, p) => acc + colorHarmony(item.colorHex, p.colorHex), 0) /
        partners.length;
      s *= harm;
    }
    // Wet weather = no suede
    if (
      (weather.condition === "rain" || weather.condition === "snow") &&
      /suede/i.test(item.notes + item.name)
    ) {
      s -= 0.5;
    }
    return s;
  };

  const pickAt = (
    cat: string,
    partners: Item[] = [],
    offset = 0
  ): Item | undefined => {
    if (seedItem?.category === cat) return seedItem;
    const candidates = allItems
      .filter((i) => i.category === cat)
      .map((i) => ({ i, s: score(i, partners) }))
      .sort((a, b) => b.s - a.s);
    if (candidates.length === 0) return undefined;
    return candidates[offset % candidates.length].i;
  };

  // Spread variation across shirt/pants/shoes so reshuffle cycles meaningful changes.
  const shirt = pickAt("shirt", [], variation);
  if (!shirt) return null;
  const pants = pickAt("pants", [shirt], Math.floor(variation / 3));
  if (!pants) return null;
  const shoes = pickAt("shoes", [shirt, pants], Math.floor(variation / 7));
  if (!shoes) return null;
  const socks = pickAt("socks", [pants, shoes], variation);
  const watch = pickAt("watch", [shirt], variation);
  const accessory = pickAt("accessory", [shirt, pants, shoes], variation);

  const chosen: Item[] = [];
  const addChosen = (item: Item | undefined) => {
    if (item && !chosen.some((candidate) => candidate.id === item.id)) {
      chosen.push(item);
    }
  };

  addChosen(shirt);
  addChosen(pants);
  addChosen(shoes);
  addChosen(socks);
  addChosen(watch);
  addChosen(accessory);

  // Generate reasons
  const reasons: string[] = [];

  if (seedItem && chosen.some((item) => item.id === seedItem.id)) {
    reasons.push(
      `Locked in ${seedItem.name} and built the remaining pieces around its ${seedItem.color} color and ${seedItem.formality} register.`
    );
  }

  reasons.push(profile.reason);

  // Color harmony reason
  const palette = Array.from(new Set(chosen.map((c) => c.color))).slice(0, 3).join(", ");
  reasons.push(
    `Coordinated palette of ${palette} — neutrals anchor the outfit and the accents stay restrained for the office.`
  );

  // Weather
  const weatherDesc =
    weather.tempF < 50
      ? "cool"
      : weather.tempF < 70
      ? "mild"
      : weather.tempF < 85
      ? "warm"
      : "hot";
  reasons.push(
    `Built for today's ${weatherDesc} ${weather.condition} weather (${weather.tempF}°F): each piece falls inside its comfortable temperature range.`
  );

  // Recency
  const recentItemIds = new Set<number>();
  recentWears.slice(0, 5).forEach((w) => {
    try {
      JSON.parse(w.itemIds).forEach((id: number) => recentItemIds.add(id));
    } catch {}
  });
  const fresh = chosen.filter((c) => !recentItemIds.has(c.id));
  if (fresh.length === chosen.length) {
    reasons.push(`None of these pieces have been worn in your last ${recentWears.length || 0} outfits — a fresh rotation.`);
  } else {
    reasons.push(
      `${fresh.length} of ${chosen.length} pieces are new since your last few outfits, keeping rotation balanced.`
    );
  }

  // Formality
  reasons.push(
    `Aimed at ${OUTFIT_STYLE_LABELS[targetStyle]}: ${shirt.formality} shirt, ${pants.formality} trousers, and ${shoes.formality} shoes work as a coherent register.`
  );

  if (
    (weather.condition === "rain" || weather.condition === "snow") &&
    !chosen.some((c) => /suede/i.test(c.notes + c.name))
  ) {
    reasons.push("Skipped suede given today's wet conditions.");
  }

  const total = chosen.reduce((acc, c) => acc + score(c, chosen), 0) / chosen.length;

  return {
    items: chosen,
    reasons,
    weather,
    score: total,
    targetFormality: targetStyle,
  };
}
