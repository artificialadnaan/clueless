import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Item, Weather } from "@shared/schema";
import { ItemThumb } from "@/components/ItemThumb";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { WeatherEditor } from "@/components/WeatherEditor";
import { Sparkles, Check, RefreshCw, ShieldCheck, WandSparkles, Upload } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { Link, useLocation } from "wouter";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

interface Recommendation {
  items: Item[];
  reasons: string[];
  weather: Weather;
  score: number;
  targetFormality: string;
  source?: "ai" | "rules";
  aiProvider?: "openai" | "anthropic";
  aiModel?: string;
  aiError?: string;
}

const STYLE_OPTIONS = [
  { value: "casual", label: "Casual" },
  { value: "smart-casual", label: "Smart casual" },
  { value: "business-casual", label: "Business casual" },
  { value: "business", label: "Business" },
  { value: "formal", label: "Formal" },
  { value: "evening", label: "Evening" },
  { value: "travel", label: "Travel / comfort" },
  { value: "statement", label: "Statement" },
];

function styleLabel(value: string) {
  return STYLE_OPTIONS.find((option) => option.value === value)?.label ?? value;
}

export default function Today() {
  const [formality, setFormality] = useState<string>("business");
  const [seed, setSeed] = useState(0);
  const [useAi, setUseAi] = useState(true);
  const [location] = useLocation();
  const { toast } = useToast();
  const query = location.includes("?") ? location.split("?")[1] : "";
  const querySeedItemId = new URLSearchParams(query).get("seedItemId");
  const pathSeedItemId = location.match(/^\/from\/(\d+)$/)?.[1];
  const seedItemId = pathSeedItemId ?? querySeedItemId;

  const { data: rec, isLoading, isError, refetch } = useQuery<Recommendation>({
    queryKey: ["/api/recommend", { formality, seed, useAi, seedItemId }],
    retry: false,
    queryFn: async () => {
      const params = new URLSearchParams({
        formality,
        ai: useAi ? "1" : "0",
        _: String(seed),
      });
      if (seedItemId) params.set("seedItemId", seedItemId);
      const res = await apiRequest(
        "GET",
        `/api/recommend?${params.toString()}`
      );
      return res.json();
    },
  });

  const { data: items = [] } = useQuery<Item[]>({
    queryKey: ["/api/items"],
  });

  const REQUIRED = ["shirt", "pants", "shoes"] as const;
  const presentCategories = new Set(items.map((i) => i.category));
  const missingCategories = REQUIRED.filter((c) => !presentCategories.has(c));
  const lockedItem = seedItemId
    ? items.find((item) => item.id === Number(seedItemId))
    : undefined;

  const loggedRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (!rec || isError) return;
    const key = `${formality}|${useAi}|${seed}|${seedItemId ?? ""}`;
    if (loggedRef.current.has(key)) return;
    loggedRef.current.add(key);
    apiRequest("POST", "/api/suggestions", {
      formality,
      source: rec.source ?? "rules",
      aiProvider: rec.aiProvider ?? null,
      aiModel: rec.aiModel ?? null,
      itemIds: JSON.stringify(rec.items.map((i) => i.id)),
      reasons: JSON.stringify(rec.reasons),
      score: Math.round((rec.score ?? 0) * 100),
      variation: seed,
    })
      .then(() => queryClient.invalidateQueries({ queryKey: ["/api/suggestions"] }))
      .catch(() => {
        // Don't surface logging errors to the user.
      });
  }, [rec, isError, formality, useAi, seed, seedItemId]);

  const markWorn = useMutation({
    mutationFn: async () => {
      if (!rec) return;
      const res = await apiRequest("POST", "/api/wears", {
        itemIds: rec.items.map((i) => i.id),
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/items"] });
      queryClient.invalidateQueries({ queryKey: ["/api/wears"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/recommend"] });
      toast({
        title: "Outfit logged",
        description: "Recorded today's wear and refreshed your rotation.",
      });
    },
  });

  const today = new Date();
  const dateLabel = today.toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="px-5 sm:px-8 lg:px-12 py-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4 mb-8">
        <div>
          <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground mb-2">
            {dateLabel}
          </div>
          <h1 className="font-display text-4xl sm:text-5xl tracking-tight">
            Good morning, Adnaan.
          </h1>
          <p className="text-muted-foreground mt-2 max-w-xl">
            {lockedItem
              ? `Starting with ${lockedItem.name}, then completing the rest around today's weather and your rotation.`
              : "A coordinated outfit, built for today's weather and rotated against your recent wears."}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={useAi ? "default" : "outline"}
            onClick={() => setUseAi((value) => !value)}
            data-testid="button-toggle-ai-stylist"
          >
            <WandSparkles className="size-4" />
            {useAi ? "AI stylist on" : "Rules engine"}
          </Button>
          <Select value={formality} onValueChange={setFormality}>
            <SelectTrigger className="w-48" data-testid="select-formality">
              <SelectValue placeholder="Style" />
            </SelectTrigger>
            <SelectContent>
              {STYLE_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            onClick={() => {
              setSeed((s) => s + 1);
              refetch();
            }}
            data-testid="button-reshuffle"
          >
            <RefreshCw className="size-4" />
            Reshuffle
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
        {/* Outfit */}
        <div
          className="rounded-lg border border-card-border bg-card p-6 sm:p-8"
          data-testid="card-outfit"
        >
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <span className="text-primary">
                <Sparkles className="size-4" />
              </span>
              <span className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                Today's recommended outfit
              </span>
            </div>
            {rec && (
              <div className="flex items-center gap-2">
                {lockedItem && (
                  <Badge variant="outline" className="capitalize" data-testid="badge-locked-item">
                    Locked: {lockedItem.category}
                  </Badge>
                )}
                <Badge variant="outline" className="capitalize" data-testid="badge-recommendation-source">
                  {rec.source === "ai"
                    ? `${rec.aiProvider ?? "AI"} stylist`
                    : useAi
                    ? "Rules fallback"
                    : "Rules engine"}
                </Badge>
                <Badge variant="outline" className="capitalize" data-testid="badge-formality">
                  {styleLabel(rec.targetFormality)}
                </Badge>
              </div>
            )}
          </div>

          {isLoading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3" data-testid="loading-outfit">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="aspect-square rounded-md bg-muted animate-pulse" />
              ))}
            </div>
          ) : isError || !rec ? (
            <div className="rounded-md border border-dashed border-card-border p-8 text-center" data-testid="empty-recommendation">
              <Sparkles className="size-6 mx-auto text-muted-foreground mb-3" />
              <div className="font-medium text-base mb-1">No outfit yet</div>
              {missingCategories.length > 0 ? (
                <p className="text-sm text-muted-foreground max-w-md mx-auto">
                  Your wardrobe is missing{" "}
                  <span className="font-medium text-foreground">
                    {missingCategories.join(", ")}
                  </span>
                  . Import or add at least one of each before the stylist can build a full outfit.
                </p>
              ) : (
                <p className="text-sm text-muted-foreground max-w-md mx-auto">
                  Couldn't build an outfit for {styleLabel(formality)} at today's weather. Try a different style or reshuffle.
                </p>
              )}
              <div className="mt-4 flex flex-wrap gap-2 justify-center">
                <Link href="/import">
                  <Button variant="default">
                    <Upload className="size-4" /> Import photos
                  </Button>
                </Link>
                <Button variant="outline" onClick={() => refetch()}>
                  <RefreshCw className="size-4" /> Try again
                </Button>
              </div>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {rec.items.map((item) => (
                  <div
                    key={item.id}
                    className="rounded-md border border-card-border bg-background/60 p-3 hover-elevate"
                    data-testid={`outfit-item-${item.id}`}
                  >
                    <div className="aspect-square flex items-center justify-center">
                      <ItemThumb item={item} />
                    </div>
                    <div className="mt-2">
                      <div className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                        {item.category}
                      </div>
                      <div className="text-sm font-medium leading-tight mt-0.5">
                        {item.name}
                      </div>
                      <div className="text-xs text-muted-foreground capitalize">
                        {item.color}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-7 border-t border-card-border pt-5">
                <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground mb-3 flex items-center gap-1.5">
                  <ShieldCheck className="size-3" /> Why this works
                </div>
                <ul className="space-y-2.5" data-testid="list-reasons">
                  {rec.aiError && (
                    <li className="flex gap-3 text-sm text-muted-foreground" data-testid="text-ai-fallback">
                      <span className="mt-1.5 size-1 rounded-full bg-muted-foreground shrink-0" />
                      <span>
                        AI stylist is not configured or returned an invalid response, so the rules engine made this pick.
                      </span>
                    </li>
                  )}
                  {rec.reasons.map((r, i) => (
                    <li key={i} className="flex gap-3 text-sm text-foreground/85">
                      <span className="mt-1.5 size-1 rounded-full bg-primary shrink-0" />
                      <span>{r}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="mt-6 flex flex-col sm:flex-row gap-2">
                <Button
                  size="lg"
                  onClick={() => markWorn.mutate()}
                  disabled={markWorn.isPending}
                  className="flex-1"
                  data-testid="button-mark-worn"
                >
                  <Check className="size-4" />
                  {markWorn.isPending ? "Logging…" : "Mark as worn today"}
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  onClick={() => {
                    setSeed((s) => s + 1);
                    refetch();
                  }}
                  data-testid="button-try-again"
                >
                  <RefreshCw className="size-4" />
                  Suggest another
                </Button>
              </div>
            </>
          )}
        </div>

        {/* Sidebar widgets */}
        <div className="space-y-6">
          <WeatherEditor />
          <div className="rounded-lg border border-card-border bg-card p-5">
            <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground mb-2">
              How the assistant decides
            </div>
            <ul className="text-sm text-foreground/85 space-y-2">
              <li>· Color harmony scored across the outfit (HSL distance, neutrals act as anchors).</li>
              <li>· Each piece must fit today's temperature range.</li>
              <li>· Recently worn pieces are penalised — last 3-7 days.</li>
              <li>· Suede is skipped on rain or snow days.</li>
              <li>· Pieces matching your dress-code register score higher.</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
