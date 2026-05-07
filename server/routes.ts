import type { Express } from "express";
import { createServer } from "node:http";
import type { Server } from "node:http";
import multer from "multer";
import { storage } from "./storage";
import { seedIfEmpty } from "./seed";
import { recommendOutfit } from "./recommender";
import { getAiStatus, recommendOutfitWithAi } from "./aiRecommender";
import { saveImage, isAllowedMime, streamImage } from "./imageStore";
import { enrichImageWithVision, isVisionConfigured } from "./aiVision";
import {
  insertItemSchema,
  insertWeatherSchema,
  insertSuggestionSchema,
  RATINGS,
} from "@shared/schema";
import { z } from "zod";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024, files: 50 },
});

function mapWeatherCode(code: number): "sunny" | "cloudy" | "partly-cloudy" | "rain" | "snow" {
  if (code === 0) return "sunny";
  if ([1, 2].includes(code)) return "partly-cloudy";
  if ([3, 45, 48].includes(code)) return "cloudy";
  if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82) || (code >= 95 && code <= 99)) {
    return "rain";
  }
  if ((code >= 71 && code <= 77) || (code >= 85 && code <= 86)) return "snow";
  return "cloudy";
}

async function fetchLiveWeather(city: string) {
  const searchCity = (city.split(",")[0] ?? city).trim() || "Chicago";
  const geoUrl = new URL("https://geocoding-api.open-meteo.com/v1/search");
  geoUrl.searchParams.set("name", searchCity);
  geoUrl.searchParams.set("count", "1");
  geoUrl.searchParams.set("language", "en");
  geoUrl.searchParams.set("format", "json");

  const geoResponse = await fetch(geoUrl);
  if (!geoResponse.ok) {
    throw new Error("Could not geocode city");
  }
  const geo = await geoResponse.json();
  const place = geo.results?.[0];
  if (!place) {
    throw new Error(`No weather location found for ${searchCity}`);
  }

  const weatherUrl = new URL("https://api.open-meteo.com/v1/forecast");
  weatherUrl.searchParams.set("latitude", String(place.latitude));
  weatherUrl.searchParams.set("longitude", String(place.longitude));
  weatherUrl.searchParams.set("current", "temperature_2m,apparent_temperature,weather_code");
  weatherUrl.searchParams.set("temperature_unit", "fahrenheit");
  weatherUrl.searchParams.set("timezone", "auto");

  const weatherResponse = await fetch(weatherUrl);
  if (!weatherResponse.ok) {
    throw new Error("Could not fetch live weather");
  }
  const live = await weatherResponse.json();
  const current = live.current;
  if (!current) {
    throw new Error("Live weather response missing current conditions");
  }

  return {
    tempF: Math.round(current.temperature_2m),
    feelsLikeF: Math.round(current.apparent_temperature ?? current.temperature_2m),
    condition: mapWeatherCode(Number(current.weather_code)),
    city: [place.name, place.admin1].filter(Boolean).join(", "),
    updatedAt: Date.now(),
  };
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  await seedIfEmpty();

  app.get("/health", (_req, res) => {
    res.json({ ok: true, service: "closet-office-atelier" });
  });

  app.get("/api/items", async (_req, res) => {
    const items = await storage.getItems();
    res.json(items);
  });

  app.post("/api/items", async (req, res) => {
    const parsed = insertItemSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.flatten() });
    }
    const item = await storage.createItem(parsed.data);
    res.json(item);
  });

  app.post(
    "/api/items/import",
    upload.array("photos", 50),
    async (req, res) => {
      if (!isVisionConfigured()) {
        return res.status(400).json({
          error:
            "ANTHROPIC_API_KEY not configured. Set it in environment to enable AI item import.",
        });
      }
      const files = (req.files as Express.Multer.File[]) || [];
      if (files.length === 0) return res.status(400).json({ error: "no files" });

      const created: Array<{ filename: string; item: any }> = [];
      const failed: Array<{ filename: string; error: string }> = [];

      for (const file of files) {
        try {
          if (!isAllowedMime(file.mimetype)) {
            throw new Error(`unsupported mime type: ${file.mimetype}`);
          }
          const enriched = await enrichImageWithVision(file.buffer, file.mimetype);
          const { filename } = saveImage(file.buffer, file.mimetype);
          const item = await storage.createItem({
            ...enriched.fields,
            imagePath: filename,
          });
          created.push({ filename: file.originalname, item });
        } catch (error) {
          const message = error instanceof Error ? error.message : "unknown error";
          failed.push({ filename: file.originalname, error: message });
        }
      }

      res.json({ created, failed });
    },
  );

  app.get("/api/images/:filename", (req, res) => {
    const result = streamImage(req.params.filename);
    if (!result) return res.status(404).json({ error: "not found" });
    res.setHeader("Content-Type", result.contentType);
    res.setHeader("Content-Length", String(result.size));
    res.setHeader("Cache-Control", "public, max-age=86400");
    result.stream.pipe(res);
  });

  app.delete("/api/items/:id", async (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: "bad id" });
    await storage.deleteItem(id);
    res.json({ ok: true });
  });

  app.get("/api/weather", async (_req, res) => {
    const w = await storage.getWeather();
    res.json(w ?? null);
  });

  app.get("/api/ai/status", (_req, res) => {
    res.json(getAiStatus());
  });

  app.post("/api/weather/live", async (req, res) => {
    const parsed = z.object({ city: z.string().min(1).default("Chicago") }).safeParse(req.body ?? {});
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.flatten() });
    }
    try {
      const liveWeather = await fetchLiveWeather(parsed.data.city);
      const w = await storage.setWeather(liveWeather);
      res.json(w);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to fetch live weather";
      res.status(502).json({ error: message });
    }
  });

  app.post("/api/weather", async (req, res) => {
    const parsed = insertWeatherSchema.safeParse({
      ...req.body,
      updatedAt: Date.now(),
    });
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.flatten() });
    }
    const w = await storage.setWeather(parsed.data);
    res.json(w);
  });

  app.get("/api/wears", async (_req, res) => {
    const wears = await storage.getRecentWears(50);
    res.json(wears);
  });

  app.post("/api/wears", async (req, res) => {
    const parsed = z
      .object({ itemIds: z.array(z.number()), note: z.string().optional() })
      .safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    const wear = await storage.recordWear(parsed.data.itemIds, parsed.data.note ?? "");
    res.json(wear);
  });

  app.get("/api/recommend", async (req, res) => {
    const items = await storage.getItems();
    const weather = await storage.getWeather();
    const recent = await storage.getRecentWears(10);
    if (!weather) return res.status(400).json({ error: "no weather" });
    const formality = (req.query.formality as string) || "business";
    const variation = Math.max(0, parseInt((req.query._ as string) ?? "0", 10) || 0);
    const rec = recommendOutfit(
      items,
      weather,
      recent,
      formality as "smart-casual" | "business" | "formal",
      variation
    );
    if (!rec) return res.status(404).json({ error: "no recommendation" });
    if (req.query.ai === "1" || req.query.ai === "true") {
      const [liked, disliked, recentSuggestions] = await Promise.all([
        storage.getRatedSuggestions("up", 5),
        storage.getRatedSuggestions("down", 5),
        storage.listSuggestions(8),
      ]);
      const aiRec = await recommendOutfitWithAi(
        items,
        weather,
        recent,
        formality as "smart-casual" | "business" | "formal",
        rec,
        variation,
        liked,
        disliked,
        recentSuggestions
      );
      return res.json(aiRec);
    }
    res.json({ ...rec, source: "rules" });
  });

  app.post("/api/suggestions", async (req, res) => {
    const parsed = insertSuggestionSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    const created = await storage.createSuggestion(parsed.data);
    res.json(created);
  });

  app.get("/api/suggestions", async (req, res) => {
    const limit = Math.min(500, Math.max(1, parseInt((req.query.limit as string) ?? "100", 10) || 100));
    const list = await storage.listSuggestions(limit);
    res.json(list);
  });

  app.patch("/api/suggestions/:id/rating", async (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: "bad id" });
    const parsed = z
      .object({ rating: z.enum(RATINGS).nullable() })
      .safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    const updated = await storage.updateSuggestionRating(id, parsed.data.rating);
    if (!updated) return res.status(404).json({ error: "not found" });
    res.json(updated);
  });

  app.patch("/api/suggestions/:id/notes", async (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: "bad id" });
    const parsed = z.object({ notes: z.string().max(500) }).safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    const updated = await storage.updateSuggestionNotes(id, parsed.data.notes);
    if (!updated) return res.status(404).json({ error: "not found" });
    res.json(updated);
  });

  app.delete("/api/suggestions/:id", async (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: "bad id" });
    await storage.deleteSuggestion(id);
    res.json({ ok: true });
  });

  // Stats: closet coverage, underused items, rotation
  app.get("/api/stats", async (_req, res) => {
    const items = await storage.getItems();
    const wears = await storage.getRecentWears(100);
    const byCategory: Record<string, number> = {};
    for (const i of items) byCategory[i.category] = (byCategory[i.category] || 0) + 1;
    const totalWears = wears.length;
    const week = 7 * 24 * 60 * 60 * 1000;
    const recentItemIdSet = new Set<number>();
    for (const w of wears.filter((w) => Date.now() - w.wornAt < week)) {
      try {
        JSON.parse(w.itemIds).forEach((id: number) => recentItemIdSet.add(id));
      } catch {}
    }
    const underused = items
      .filter((i) => i.wearCount === 0 || (i.lastWornAt && Date.now() - i.lastWornAt > 30 * 24 * 60 * 60 * 1000))
      .slice(0, 6);
    const rotation = {
      activeThisWeek: recentItemIdSet.size,
      totalItems: items.length,
      coveragePct:
        items.length > 0 ? Math.round((recentItemIdSet.size / items.length) * 100) : 0,
    };
    res.json({ byCategory, totalWears, underused, rotation });
  });

  return httpServer;
}
