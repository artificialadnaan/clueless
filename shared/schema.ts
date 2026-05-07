import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Wardrobe item categories
export const CATEGORIES = [
  "shirt",
  "pants",
  "shoes",
  "socks",
  "watch",
  "accessory",
] as const;
export type Category = (typeof CATEGORIES)[number];

export const FORMALITIES = ["casual", "smart-casual", "business", "formal"] as const;
export type Formality = (typeof FORMALITIES)[number];

export const SEASONS = ["spring", "summer", "fall", "winter", "all"] as const;
export type Season = (typeof SEASONS)[number];

export const items = sqliteTable("items", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  category: text("category").notNull(), // Category
  color: text("color").notNull(), // human readable e.g. "navy"
  colorHex: text("color_hex").notNull(), // e.g. "#1B2A4E"
  formality: text("formality").notNull(), // Formality
  season: text("season").notNull().default("all"), // Season
  minTempF: integer("min_temp_f").notNull().default(20),
  maxTempF: integer("max_temp_f").notNull().default(100),
  notes: text("notes").notNull().default(""),
  imagePath: text("image_path"),
  wearCount: integer("wear_count").notNull().default(0),
  lastWornAt: integer("last_worn_at"), // unix ms
  createdAt: integer("created_at").notNull(),
});

export const insertItemSchema = createInsertSchema(items)
  .omit({ id: true, wearCount: true, lastWornAt: true, createdAt: true })
  .extend({
    category: z.enum(CATEGORIES),
    formality: z.enum(FORMALITIES),
    season: z.enum(SEASONS),
  });

export type InsertItem = z.infer<typeof insertItemSchema>;
export type Item = typeof items.$inferSelect;

export const PHOTO_KINDS = ["stock", "real"] as const;
export type PhotoKind = (typeof PHOTO_KINDS)[number];

export const itemPhotos = sqliteTable("item_photos", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  itemId: integer("item_id").notNull(),
  filename: text("filename").notNull(),
  kind: text("kind").notNull().default("stock"),
  createdAt: integer("created_at").notNull(),
});

export const insertItemPhotoSchema = createInsertSchema(itemPhotos).omit({
  id: true,
  createdAt: true,
});
export type InsertItemPhoto = z.infer<typeof insertItemPhotoSchema>;
export type ItemPhoto = typeof itemPhotos.$inferSelect;

// Outfits worn — record of a coordinated outfit on a given day
export const wears = sqliteTable("wears", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  itemIds: text("item_ids").notNull(), // JSON array of item ids
  wornAt: integer("worn_at").notNull(), // unix ms
  weatherTempF: integer("weather_temp_f"),
  weatherCondition: text("weather_condition"),
  note: text("note").notNull().default(""),
});

export const insertWearSchema = createInsertSchema(wears).omit({ id: true });
export type InsertWear = z.infer<typeof insertWearSchema>;
export type Wear = typeof wears.$inferSelect;

// Suggestions — every distinct outfit the recommender returns. Lets users
// rate, leave notes, and feed positive/negative examples back to the AI.
export const RATINGS = ["up", "down"] as const;
export type Rating = (typeof RATINGS)[number];

export const suggestions = sqliteTable("suggestions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  createdAt: integer("created_at").notNull(),
  formality: text("formality").notNull(),
  source: text("source").notNull(), // 'ai' | 'rules'
  aiProvider: text("ai_provider"),
  aiModel: text("ai_model"),
  itemIds: text("item_ids").notNull(), // JSON array
  reasons: text("reasons").notNull().default("[]"), // JSON array of strings
  score: integer("score").notNull().default(0), // *100 to keep integer
  variation: integer("variation").notNull().default(0),
  rating: text("rating"), // 'up' | 'down' | null
  notes: text("notes").notNull().default(""),
});

export const insertSuggestionSchema = createInsertSchema(suggestions).omit({
  id: true,
  createdAt: true,
  rating: true,
  notes: true,
});
export type InsertSuggestion = z.infer<typeof insertSuggestionSchema>;
export type Suggestion = typeof suggestions.$inferSelect;

// Weather is stored as a single editable row. It can be synced from live weather
// or manually overridden if the weather service cannot find the desired city.
export const weather = sqliteTable("weather", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  tempF: integer("temp_f").notNull(),
  condition: text("condition").notNull(), // sunny, cloudy, rain, snow
  feelsLikeF: integer("feels_like_f").notNull(),
  city: text("city").notNull().default("Chicago"),
  updatedAt: integer("updated_at").notNull(),
});

export const insertWeatherSchema = createInsertSchema(weather).omit({ id: true });
export type InsertWeather = z.infer<typeof insertWeatherSchema>;
export type Weather = typeof weather.$inferSelect;

// Users (kept for template compatibility but not used)
export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
