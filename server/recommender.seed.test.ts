import assert from "node:assert/strict";
import type { Item, Weather } from "@shared/schema";
import { OUTFIT_STYLES, recommendOutfit } from "./recommender";

const baseItem = {
  season: "all",
  minTempF: 30,
  maxTempF: 95,
  notes: "",
  imagePath: null,
  wearCount: 0,
  lastWornAt: null,
  createdAt: 1,
} satisfies Omit<Item, "id" | "name" | "category" | "color" | "colorHex" | "formality">;

function item(partial: Pick<Item, "id" | "name" | "category" | "color" | "colorHex" | "formality">): Item {
  return { ...baseItem, ...partial };
}

const weather: Weather = {
  id: 1,
  tempF: 72,
  feelsLikeF: 72,
  condition: "sunny",
  city: "Chicago",
  updatedAt: 1,
};

const seedShirt = item({
  id: 1,
  name: "Red linen camp shirt",
  category: "shirt",
  color: "red",
  colorHex: "#b91c1c",
  formality: "casual",
});

const businessShirt = item({
  id: 2,
  name: "White oxford shirt",
  category: "shirt",
  color: "white",
  colorHex: "#f8fafc",
  formality: "business",
});

const items: Item[] = [
  seedShirt,
  businessShirt,
  item({
    id: 3,
    name: "Navy trousers",
    category: "pants",
    color: "navy",
    colorHex: "#172554",
    formality: "business",
  }),
  item({
    id: 4,
    name: "Black derbies",
    category: "shoes",
    color: "black",
    colorHex: "#111827",
    formality: "business",
  }),
  item({
    id: 5,
    name: "Brown belt",
    category: "accessory",
    color: "brown",
    colorHex: "#7c2d12",
    formality: "business",
  }),
  item({
    id: 6,
    name: "Silver watch",
    category: "watch",
    color: "silver",
    colorHex: "#d1d5db",
    formality: "business",
  }),
];

const seeded = recommendOutfit(items, weather, [], "business", 0, seedShirt.id);

assert.ok(seeded, "expected seeded recommendation");
assert.equal(
  seeded.items.find((candidate) => candidate.category === "shirt")?.id,
  seedShirt.id,
  "seed item should stay locked in its category",
);
assert.ok(
  seeded.items.some((candidate) => candidate.category === "pants"),
  "seeded outfit should include pants",
);
assert.ok(
  seeded.items.some((candidate) => candidate.category === "shoes"),
  "seeded outfit should include shoes",
);
assert.ok(
  seeded.reasons.some((reason) => reason.includes(seedShirt.name)),
  "seeded recommendation should explain the locked item",
);

assert.deepEqual(OUTFIT_STYLES, [
  "casual",
  "smart-casual",
  "business-casual",
  "business",
  "formal",
  "evening",
  "travel",
  "statement",
]);

const travel = recommendOutfit(items, weather, [], "travel", 0);
assert.ok(travel, "expected travel style recommendation");
assert.equal(travel.targetFormality, "travel");
assert.ok(
  travel.reasons.some((reason) => /travel/i.test(reason)),
  "travel recommendations should explain the style intent",
);
