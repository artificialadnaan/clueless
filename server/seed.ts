import { storage } from "./storage";
import type { InsertItem } from "@shared/schema";

const SEED: InsertItem[] = [
  // Shirts / tops
  { name: "Crisp White Oxford", category: "shirt", color: "white", colorHex: "#F5F4EE", formality: "business", season: "all", minTempF: 30, maxTempF: 95, notes: "Slim fit, button-down collar — versatile staple." },
  { name: "Light Blue Poplin", category: "shirt", color: "light blue", colorHex: "#B7D2E8", formality: "business", season: "all", minTempF: 30, maxTempF: 95, notes: "Pairs with charcoal and navy." },
  { name: "Charcoal Knit Polo", category: "shirt", color: "charcoal", colorHex: "#2E3033", formality: "smart-casual", season: "all", minTempF: 35, maxTempF: 85, notes: "Friday-ready, layers under blazer." },
  { name: "Pale Pink Twill", category: "shirt", color: "blush", colorHex: "#E8C7C2", formality: "business", season: "spring", minTempF: 40, maxTempF: 85, notes: "Looks sharp with grey wool." },
  { name: "Pinstripe Dress Shirt", category: "shirt", color: "navy stripe", colorHex: "#1F2C44", formality: "formal", season: "all", minTempF: 30, maxTempF: 90, notes: "For client meetings." },
  { name: "Olive Linen", category: "shirt", color: "olive", colorHex: "#6B6E45", formality: "smart-casual", season: "summer", minTempF: 60, maxTempF: 100, notes: "Breathable, beach-day Friday." },
  // Pants
  { name: "Charcoal Wool Trousers", category: "pants", color: "charcoal", colorHex: "#3A3D42", formality: "business", season: "all", minTempF: 30, maxTempF: 80, notes: "Italian wool, flat front." },
  { name: "Navy Wool Trousers", category: "pants", color: "navy", colorHex: "#1B2A4E", formality: "business", season: "all", minTempF: 30, maxTempF: 80, notes: "Goes with everything." },
  { name: "Stone Chinos", category: "pants", color: "stone", colorHex: "#C2B49A", formality: "smart-casual", season: "all", minTempF: 35, maxTempF: 95, notes: "Casual Friday workhorse." },
  { name: "Beige Linen Trousers", category: "pants", color: "beige", colorHex: "#D6C7A8", formality: "smart-casual", season: "summer", minTempF: 65, maxTempF: 100, notes: "Hot summer days only." },
  { name: "Black Dress Trousers", category: "pants", color: "black", colorHex: "#15171A", formality: "formal", season: "all", minTempF: 30, maxTempF: 85, notes: "Evening events, board reviews." },
  // Shoes
  { name: "Brown Leather Oxfords", category: "shoes", color: "tan brown", colorHex: "#8B5E3C", formality: "business", season: "all", minTempF: 25, maxTempF: 95, notes: "Daily driver, broken in well." },
  { name: "Black Cap-Toe Oxfords", category: "shoes", color: "black", colorHex: "#1A1A1C", formality: "formal", season: "all", minTempF: 25, maxTempF: 95, notes: "Polished — keep for formal days." },
  { name: "Suede Chukka Boots", category: "shoes", color: "tobacco", colorHex: "#7A4A2F", formality: "smart-casual", season: "fall", minTempF: 30, maxTempF: 70, notes: "Avoid in rain." },
  { name: "Penny Loafers", category: "shoes", color: "burgundy", colorHex: "#5E2228", formality: "smart-casual", season: "all", minTempF: 40, maxTempF: 95, notes: "Sockless in summer." },
  // Socks
  { name: "Charcoal Merino Crew", category: "socks", color: "charcoal", colorHex: "#3A3D42", formality: "business", season: "all", minTempF: 30, maxTempF: 90, notes: "Pack of 5, everyday." },
  { name: "Navy Cotton Crew", category: "socks", color: "navy", colorHex: "#1B2A4E", formality: "business", season: "all", minTempF: 30, maxTempF: 90, notes: "" },
  { name: "Burgundy Patterned", category: "socks", color: "burgundy", colorHex: "#5E2228", formality: "smart-casual", season: "fall", minTempF: 30, maxTempF: 80, notes: "A small flourish." },
  { name: "Tan Linen Blend", category: "socks", color: "tan", colorHex: "#B89673", formality: "smart-casual", season: "summer", minTempF: 60, maxTempF: 100, notes: "" },
  // Watches
  { name: "Steel Field Watch", category: "watch", color: "steel", colorHex: "#9CA0A6", formality: "smart-casual", season: "all", minTempF: 0, maxTempF: 110, notes: "Black NATO strap." },
  { name: "Brown Leather Dress Watch", category: "watch", color: "brown", colorHex: "#7A4A2F", formality: "formal", season: "all", minTempF: 0, maxTempF: 110, notes: "White dial, gold case." },
  // Accessories
  { name: "Navy Silk Tie", category: "accessory", color: "navy", colorHex: "#1B2A4E", formality: "business", season: "all", minTempF: 0, maxTempF: 110, notes: "Subtle micro-dot." },
  { name: "Burgundy Knit Tie", category: "accessory", color: "burgundy", colorHex: "#5E2228", formality: "smart-casual", season: "all", minTempF: 0, maxTempF: 110, notes: "Adds texture." },
  { name: "Tan Leather Belt", category: "accessory", color: "tan", colorHex: "#8B5E3C", formality: "business", season: "all", minTempF: 0, maxTempF: 110, notes: "Match with brown shoes." },
  { name: "Black Leather Belt", category: "accessory", color: "black", colorHex: "#15171A", formality: "formal", season: "all", minTempF: 0, maxTempF: 110, notes: "Match with black shoes." },
  { name: "Charcoal Wool Blazer", category: "accessory", color: "charcoal", colorHex: "#3A3D42", formality: "business", season: "all", minTempF: 30, maxTempF: 75, notes: "Layer for cool offices." },
];

export async function seedIfEmpty() {
  const existing = await storage.getItems();
  if (existing.length === 0) {
    for (const item of SEED) {
      await storage.createItem(item);
    }
    console.log(`[seed] Inserted ${SEED.length} wardrobe items`);
  }
  const w = await storage.getWeather();
  if (!w) {
    await storage.setWeather({
      tempF: 62,
      feelsLikeF: 60,
      condition: "cloudy",
      city: "Chicago",
      updatedAt: Date.now(),
    });
    console.log("[seed] Inserted initial weather");
  }

  // Seed a couple of recent wears so the dashboard isn't empty
  const recents = await storage.getRecentWears(1);
  if (recents.length === 0) {
    const all = await storage.getItems();
    const findIds = (names: string[]) =>
      names
        .map((n) => all.find((i) => i.name === n)?.id)
        .filter((x): x is number => typeof x === "number");
    const day = 24 * 60 * 60 * 1000;
    const recentSets: { names: string[]; daysAgo: number }[] = [
      {
        names: ["Crisp White Oxford", "Charcoal Wool Trousers", "Brown Leather Oxfords", "Charcoal Merino Crew", "Steel Field Watch", "Tan Leather Belt"],
        daysAgo: 1,
      },
      {
        names: ["Light Blue Poplin", "Navy Wool Trousers", "Brown Leather Oxfords", "Navy Cotton Crew", "Steel Field Watch", "Navy Silk Tie"],
        daysAgo: 3,
      },
    ];
    for (const r of recentSets) {
      const ids = findIds(r.names);
      if (ids.length) {
        const wear = await storage.recordWear(ids, "");
        // Backdate
        const sqlite3 = (await import("better-sqlite3")).default;
        const dbConn = new sqlite3("data.db");
        const wornAt = Date.now() - r.daysAgo * day;
        dbConn.prepare("UPDATE wears SET worn_at = ? WHERE id = ?").run(wornAt, wear.id);
        for (const id of ids) {
          dbConn.prepare("UPDATE items SET last_worn_at = ? WHERE id = ?").run(wornAt, id);
        }
        dbConn.close();
      }
    }
    console.log("[seed] Inserted recent wears");
  }
}
