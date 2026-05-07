import type { Item, Weather, Wear } from "@shared/schema";
import type { OutfitRecommendation } from "./recommender";

type TargetFormality = "smart-casual" | "business" | "formal";
type AiProvider = "openai" | "anthropic";

interface AiRecommendation extends OutfitRecommendation {
  source: "ai" | "rules";
  aiProvider?: AiProvider;
  aiModel?: string;
  aiError?: string;
}

interface ModelChoice {
  selectedItemIds: number[];
  reasons: string[];
  confidence?: number;
}

function configuredProvider(): AiProvider | null {
  const preferred = process.env.AI_PROVIDER?.toLowerCase();
  if (preferred === "openai" && process.env.OPENAI_API_KEY) return "openai";
  if (preferred === "anthropic" && process.env.ANTHROPIC_API_KEY) return "anthropic";
  if (process.env.ANTHROPIC_API_KEY) return "anthropic";
  if (process.env.OPENAI_API_KEY) return "openai";
  return null;
}

export function getAiStatus() {
  const provider = configuredProvider();
  return {
    enabled: provider !== null,
    provider,
    openaiConfigured: Boolean(process.env.OPENAI_API_KEY),
    anthropicConfigured: Boolean(process.env.ANTHROPIC_API_KEY),
    mode: process.env.AI_PROVIDER || "auto",
  };
}

function recentItemIds(recentWears: Wear[]) {
  const ids = new Set<number>();
  for (const wear of recentWears.slice(0, 10)) {
    try {
      JSON.parse(wear.itemIds).forEach((id: number) => ids.add(id));
    } catch {
      // Ignore malformed prototype rows.
    }
  }
  return Array.from(ids);
}

function buildPrompt(
  items: Item[],
  weather: Weather,
  recentWears: Wear[],
  targetFormality: TargetFormality,
  fallback: OutfitRecommendation
) {
  const compactItems = items.map((item) => ({
    id: item.id,
    name: item.name,
    category: item.category,
    color: item.color,
    formality: item.formality,
    season: item.season,
    minTempF: item.minTempF,
    maxTempF: item.maxTempF,
    notes: item.notes,
    wearCount: item.wearCount,
    lastWornAt: item.lastWornAt,
  }));

  return `You are a practical office wardrobe stylist. Choose exactly one coordinated outfit from the user's wardrobe.

Hard constraints:
- Return JSON only, with no markdown.
- Only use item ids that exist in the wardrobe.
- Include one shirt, one pants item, one shoes item, and preferably one socks item, one watch, and one accessory.
- Avoid items worn recently when reasonable.
- Respect weather suitability using each item's minTempF and maxTempF.
- Avoid suede in rain or snow.
- Match the requested dress code while keeping the outfit realistic for an office.

Context:
${JSON.stringify(
  {
    weather: {
      tempF: weather.tempF,
      feelsLikeF: weather.feelsLikeF,
      condition: weather.condition,
      city: weather.city,
    },
    targetFormality,
    recentItemIds: recentItemIds(recentWears),
    rulesEngineBaselineIds: fallback.items.map((item) => item.id),
    wardrobe: compactItems,
  },
  null,
  2
)}

Return this exact JSON shape:
{
  "selectedItemIds": [1, 2, 3, 4, 5, 6],
  "reasons": [
    "Explain color coordination in one concise sentence.",
    "Explain weather suitability in one concise sentence.",
    "Explain recency/rotation and dress-code fit in one concise sentence."
  ],
  "confidence": 0.85
}`;
}

function parseJsonChoice(text: string): ModelChoice {
  const cleaned = text
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "");
  return JSON.parse(cleaned) as ModelChoice;
}

async function callOpenAi(prompt: string) {
  const model = process.env.OPENAI_MODEL || "gpt-4o-mini";
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "You are a wardrobe inference engine. Return valid JSON only and never invent item ids.",
        },
        { role: "user", content: prompt },
      ],
      temperature: 0.35,
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI request failed: ${response.status} ${await response.text()}`);
  }
  const json = await response.json();
  return {
    model,
    choice: parseJsonChoice(json.choices?.[0]?.message?.content ?? "{}"),
  };
}

async function callAnthropic(prompt: string) {
  const model = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6";
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY || "",
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      max_tokens: 700,
      temperature: 0.35,
      system:
        "You are a wardrobe inference engine. Return valid JSON only and never invent item ids.",
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!response.ok) {
    throw new Error(`Anthropic request failed: ${response.status} ${await response.text()}`);
  }
  const json = await response.json();
  const text = json.content?.find((part: { type: string }) => part.type === "text")?.text ?? "{}";
  return {
    model,
    choice: parseJsonChoice(text),
  };
}

function validateChoice(choice: ModelChoice, items: Item[]) {
  if (!Array.isArray(choice.selectedItemIds) || !Array.isArray(choice.reasons)) {
    throw new Error("AI response missing selectedItemIds or reasons");
  }
  const byId = new Map(items.map((item) => [item.id, item]));
  const selected = choice.selectedItemIds
    .map((id) => byId.get(id))
    .filter((item): item is Item => Boolean(item));
  const unique = Array.from(new Map(selected.map((item) => [item.id, item])).values());

  for (const category of ["shirt", "pants", "shoes"]) {
    if (!unique.some((item) => item.category === category)) {
      throw new Error(`AI response missing required category: ${category}`);
    }
  }

  if (unique.length < 3) {
    throw new Error("AI response did not select enough valid items");
  }

  return {
    items: unique,
    reasons: choice.reasons
      .filter((reason) => typeof reason === "string" && reason.trim().length > 0)
      .slice(0, 5),
    score: typeof choice.confidence === "number" ? choice.confidence : 0.8,
  };
}

export async function recommendOutfitWithAi(
  items: Item[],
  weather: Weather,
  recentWears: Wear[],
  targetFormality: TargetFormality,
  fallback: OutfitRecommendation
): Promise<AiRecommendation> {
  const provider = configuredProvider();
  if (!provider) {
    return { ...fallback, source: "rules", aiError: "No AI provider API key configured." };
  }

  try {
    const prompt = buildPrompt(items, weather, recentWears, targetFormality, fallback);
    const result =
      provider === "anthropic" ? await callAnthropic(prompt) : await callOpenAi(prompt);
    const validated = validateChoice(result.choice, items);
    return {
      ...fallback,
      items: validated.items,
      reasons: validated.reasons.length ? validated.reasons : fallback.reasons,
      score: validated.score,
      source: "ai",
      aiProvider: provider,
      aiModel: result.model,
    };
  } catch (error) {
    return {
      ...fallback,
      source: "rules",
      aiProvider: provider,
      aiError: error instanceof Error ? error.message : "AI recommender failed.",
    };
  }
}
