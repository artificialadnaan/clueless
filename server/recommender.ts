import type { Item, Weather, Wear } from "@shared/schema";

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
  targetFormality: "smart-casual" | "business" | "formal" = "business"
): OutfitRecommendation | null {
  const now = Date.now();
  const targetRank = formalityRank(targetFormality);

  // helper: filter items by category and score them
  const score = (item: Item, partners: Item[] = []): number => {
    let s = 1.0;
    s *= tempFitsItem(weather.tempF, item); // weather fit
    s -= recencyPenalty(item, now); // avoid recently worn
    // Formality match
    const fr = formalityRank(item.formality);
    s -= Math.abs(fr - targetRank) * 0.15;
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

  const pickBest = (
    cat: string,
    partners: Item[] = [],
    count = 1
  ): Item[] => {
    const candidates = allItems
      .filter((i) => i.category === cat)
      .map((i) => ({ i, s: score(i, partners) }))
      .sort((a, b) => b.s - a.s);
    return candidates.slice(0, count).map((c) => c.i);
  };

  const shirt = pickBest("shirt")[0];
  if (!shirt) return null;
  const pants = pickBest("pants", [shirt])[0];
  if (!pants) return null;
  const shoes = pickBest("shoes", [shirt, pants])[0];
  if (!shoes) return null;
  const socks = pickBest("socks", [pants, shoes])[0];
  const watch = pickBest("watch", [shirt])[0];

  // Choose ONE accessory that complements (belt or tie)
  const accessory = pickBest("accessory", [shirt, pants, shoes])[0];

  const chosen: Item[] = [shirt, pants, shoes];
  if (socks) chosen.push(socks);
  if (watch) chosen.push(watch);
  if (accessory) chosen.push(accessory);

  // Generate reasons
  const reasons: string[] = [];

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
    `Aimed at a ${targetFormality} dress code: ${shirt.formality} shirt, ${pants.formality} trousers, and ${shoes.formality} shoes work as a coherent register.`
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
    targetFormality,
  };
}
