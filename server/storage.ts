import { users, items, wears, weather, suggestions } from "@shared/schema";
import type {
  User,
  InsertUser,
  Item,
  InsertItem,
  Wear,
  InsertWear,
  Weather,
  InsertWeather,
  Suggestion,
  InsertSuggestion,
  Rating,
} from "@shared/schema";
import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import { eq, desc } from "drizzle-orm";
import path from "node:path";

const databasePath = process.env.DATABASE_PATH || path.join(process.cwd(), "data.db");
const sqlite = new Database(databasePath);
sqlite.pragma("journal_mode = WAL");

// Bootstrap tables on startup so the prototype works without manual migrations.
sqlite.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  password TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  color TEXT NOT NULL,
  color_hex TEXT NOT NULL,
  formality TEXT NOT NULL,
  season TEXT NOT NULL DEFAULT 'all',
  min_temp_f INTEGER NOT NULL DEFAULT 20,
  max_temp_f INTEGER NOT NULL DEFAULT 100,
  notes TEXT NOT NULL DEFAULT '',
  image_path TEXT,
  wear_count INTEGER NOT NULL DEFAULT 0,
  last_worn_at INTEGER,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS wears (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  item_ids TEXT NOT NULL,
  worn_at INTEGER NOT NULL,
  weather_temp_f INTEGER,
  weather_condition TEXT,
  note TEXT NOT NULL DEFAULT ''
);
CREATE TABLE IF NOT EXISTS weather (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  temp_f INTEGER NOT NULL,
  condition TEXT NOT NULL,
  feels_like_f INTEGER NOT NULL,
  city TEXT NOT NULL DEFAULT 'Chicago',
  updated_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS suggestions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at INTEGER NOT NULL,
  formality TEXT NOT NULL,
  source TEXT NOT NULL,
  ai_provider TEXT,
  ai_model TEXT,
  item_ids TEXT NOT NULL,
  reasons TEXT NOT NULL DEFAULT '[]',
  score INTEGER NOT NULL DEFAULT 0,
  variation INTEGER NOT NULL DEFAULT 0,
  rating TEXT,
  notes TEXT NOT NULL DEFAULT ''
);
`);

try {
  sqlite.exec("ALTER TABLE items ADD COLUMN image_path TEXT");
} catch {
  // column already exists
}

export const db = drizzle(sqlite);

export interface IStorage {
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;

  getItems(): Promise<Item[]>;
  getItem(id: number): Promise<Item | undefined>;
  createItem(item: InsertItem): Promise<Item>;
  deleteItem(id: number): Promise<void>;
  recordWear(itemIds: number[], note?: string): Promise<Wear>;

  getRecentWears(limit?: number): Promise<Wear[]>;

  getWeather(): Promise<Weather | undefined>;
  setWeather(w: InsertWeather): Promise<Weather>;

  createSuggestion(s: InsertSuggestion): Promise<Suggestion>;
  listSuggestions(limit?: number): Promise<Suggestion[]>;
  getSuggestion(id: number): Promise<Suggestion | undefined>;
  updateSuggestionRating(id: number, rating: Rating | null): Promise<Suggestion | undefined>;
  updateSuggestionNotes(id: number, notes: string): Promise<Suggestion | undefined>;
  deleteSuggestion(id: number): Promise<void>;
  getRatedSuggestions(rating: Rating, limit?: number): Promise<Suggestion[]>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: number): Promise<User | undefined> {
    return db.select().from(users).where(eq(users.id, id)).get();
  }
  async getUserByUsername(username: string): Promise<User | undefined> {
    return db.select().from(users).where(eq(users.username, username)).get();
  }
  async createUser(insertUser: InsertUser): Promise<User> {
    return db.insert(users).values(insertUser).returning().get();
  }

  async getItems(): Promise<Item[]> {
    return db.select().from(items).orderBy(desc(items.createdAt)).all();
  }
  async getItem(id: number): Promise<Item | undefined> {
    return db.select().from(items).where(eq(items.id, id)).get();
  }
  async createItem(item: InsertItem): Promise<Item> {
    return db
      .insert(items)
      .values({ ...item, createdAt: Date.now() })
      .returning()
      .get();
  }
  async deleteItem(id: number): Promise<void> {
    db.delete(items).where(eq(items.id, id)).run();
  }
  async recordWear(itemIds: number[], note = ""): Promise<Wear> {
    const now = Date.now();
    const w = await this.getWeather();
    const wear = db
      .insert(wears)
      .values({
        itemIds: JSON.stringify(itemIds),
        wornAt: now,
        weatherTempF: w?.tempF ?? null,
        weatherCondition: w?.condition ?? null,
        note,
      })
      .returning()
      .get();
    // Increment wearCount and update lastWornAt for each item
    for (const id of itemIds) {
      const it = db.select().from(items).where(eq(items.id, id)).get();
      if (it) {
        db
          .update(items)
          .set({ wearCount: it.wearCount + 1, lastWornAt: now })
          .where(eq(items.id, id))
          .run();
      }
    }
    return wear;
  }
  async getRecentWears(limit = 30): Promise<Wear[]> {
    return db.select().from(wears).orderBy(desc(wears.wornAt)).limit(limit).all();
  }

  async getWeather(): Promise<Weather | undefined> {
    return db.select().from(weather).orderBy(desc(weather.id)).limit(1).get();
  }
  async setWeather(w: InsertWeather): Promise<Weather> {
    // Single-row pattern: replace existing
    db.delete(weather).run();
    return db.insert(weather).values(w).returning().get();
  }

  async createSuggestion(s: InsertSuggestion): Promise<Suggestion> {
    return db
      .insert(suggestions)
      .values({ ...s, createdAt: Date.now() })
      .returning()
      .get();
  }
  async listSuggestions(limit = 100): Promise<Suggestion[]> {
    return db
      .select()
      .from(suggestions)
      .orderBy(desc(suggestions.createdAt))
      .limit(limit)
      .all();
  }
  async getSuggestion(id: number): Promise<Suggestion | undefined> {
    return db.select().from(suggestions).where(eq(suggestions.id, id)).get();
  }
  async updateSuggestionRating(id: number, rating: Rating | null): Promise<Suggestion | undefined> {
    return db
      .update(suggestions)
      .set({ rating })
      .where(eq(suggestions.id, id))
      .returning()
      .get();
  }
  async updateSuggestionNotes(id: number, notes: string): Promise<Suggestion | undefined> {
    return db
      .update(suggestions)
      .set({ notes })
      .where(eq(suggestions.id, id))
      .returning()
      .get();
  }
  async deleteSuggestion(id: number): Promise<void> {
    db.delete(suggestions).where(eq(suggestions.id, id)).run();
  }
  async getRatedSuggestions(rating: Rating, limit = 5): Promise<Suggestion[]> {
    return db
      .select()
      .from(suggestions)
      .where(eq(suggestions.rating, rating))
      .orderBy(desc(suggestions.createdAt))
      .limit(limit)
      .all();
  }
}

export const storage = new DatabaseStorage();
