import { CATEGORIES, FORMALITIES, SEASONS } from "@shared/schema";
import type { InsertItem } from "@shared/schema";

export interface VisionEnrichmentResult {
  fields: InsertItem;
  rawDescription?: string;
}

const SYSTEM_PROMPT = `You are a wardrobe cataloging assistant. Given a photo of a single article of clothing or accessory, output a JSON object describing it. Be concise and conservative — if you can't see a detail, default sensibly. Do not invent brand names or materials you can't confirm.`;

const USER_PROMPT = `Analyze this photo and return JSON only (no markdown). The shape:

{
  "name": "short descriptive name, e.g. 'Navy oxford shirt' or 'Brown leather belt'",
  "category": "shirt | pants | shoes | socks | watch | accessory",
  "color": "primary color in plain English, e.g. 'navy', 'charcoal', 'olive'",
  "colorHex": "#RRGGBB hex of the dominant fabric color",
  "formality": "casual | smart-casual | business | formal",
  "season": "spring | summer | fall | winter | all",
  "minTempF": "integer F, lowest comfortable wearing temp",
  "maxTempF": "integer F, highest comfortable wearing temp",
  "notes": "1-2 short phrases on material/pattern/fit if visible. No brand guesses."
}

Category guidance:
- shirt: any top (tee, button-up, polo, sweater, hoodie, blazer if no other top fits — but blazers usually go to "accessory")
- pants: trousers, jeans, shorts, chinos, joggers
- shoes: any footwear
- socks: socks only
- watch: wristwatches only
- accessory: belts, ties, bags, hats, scarves, blazers, jewelry, sunglasses, anything else

Temperature guidance: heavy wool ~20-55F, light cotton ~55-95F, shorts ~70-100F, default 20-100F if unclear.`;

const VISION_MODEL = process.env.ANTHROPIC_VISION_MODEL || "claude-3-5-sonnet-latest";

interface RawVisionFields {
  name?: unknown;
  category?: unknown;
  color?: unknown;
  colorHex?: unknown;
  formality?: unknown;
  season?: unknown;
  minTempF?: unknown;
  maxTempF?: unknown;
  notes?: unknown;
}

function asString(v: unknown, fallback: string): string {
  return typeof v === "string" && v.trim().length > 0 ? v.trim() : fallback;
}

function asInt(v: unknown, fallback: number): number {
  if (typeof v === "number" && Number.isFinite(v)) return Math.round(v);
  if (typeof v === "string") {
    const n = parseInt(v, 10);
    if (Number.isFinite(n)) return n;
  }
  return fallback;
}

function clampToEnum<T extends string>(v: unknown, allowed: readonly T[], fallback: T): T {
  if (typeof v === "string") {
    const lower = v.trim().toLowerCase();
    const match = allowed.find((a) => a.toLowerCase() === lower);
    if (match) return match;
  }
  return fallback;
}

function normalizeHex(v: unknown): string {
  if (typeof v !== "string") return "#888888";
  const trimmed = v.trim();
  if (/^#[0-9a-fA-F]{6}$/.test(trimmed)) return trimmed.toLowerCase();
  if (/^#[0-9a-fA-F]{3}$/.test(trimmed)) {
    const c = trimmed.slice(1);
    return `#${c[0]}${c[0]}${c[1]}${c[1]}${c[2]}${c[2]}`.toLowerCase();
  }
  return "#888888";
}

function parseJsonLoose(text: string): RawVisionFields {
  const cleaned = text
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "");
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("No JSON object in vision response");
  return JSON.parse(cleaned.slice(start, end + 1)) as RawVisionFields;
}

export function isVisionConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

export async function enrichImageWithVision(
  imageBuffer: Buffer,
  mimeType: string,
): Promise<VisionEnrichmentResult> {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY not configured");
  }

  const base64 = imageBuffer.toString("base64");
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: VISION_MODEL,
      max_tokens: 600,
      temperature: 0.2,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: { type: "base64", media_type: mimeType, data: base64 },
            },
            { type: "text", text: USER_PROMPT },
          ],
        },
      ],
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Anthropic vision request failed: ${response.status} ${body.slice(0, 300)}`);
  }

  const json = await response.json();
  const textPart = json.content?.find((part: { type: string }) => part.type === "text")?.text;
  if (!textPart) throw new Error("Vision response had no text content");

  const raw = parseJsonLoose(textPart);

  const fields: InsertItem = {
    name: asString(raw.name, "Untitled item"),
    category: clampToEnum(raw.category, CATEGORIES, "accessory"),
    color: asString(raw.color, "neutral"),
    colorHex: normalizeHex(raw.colorHex),
    formality: clampToEnum(raw.formality, FORMALITIES, "smart-casual"),
    season: clampToEnum(raw.season, SEASONS, "all"),
    minTempF: asInt(raw.minTempF, 20),
    maxTempF: asInt(raw.maxTempF, 100),
    notes: asString(raw.notes, ""),
  };

  return { fields };
}
