import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Item, Suggestion } from "@shared/schema";
import { ItemThumb } from "@/components/ItemThumb";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { ThumbsUp, ThumbsDown, Trash2, Check, History as HistoryIcon, Pencil } from "lucide-react";
import { cn } from "@/lib/utils";

function fmtDay(ts: number) {
  const d = new Date(ts);
  return d.toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

function fmtTime(ts: number) {
  return new Date(ts).toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}

function parseIds(s: string): number[] {
  try {
    const v = JSON.parse(s);
    return Array.isArray(v) ? v.filter((x) => typeof x === "number") : [];
  } catch {
    return [];
  }
}

function parseReasons(s: string): string[] {
  try {
    const v = JSON.parse(s);
    return Array.isArray(v) ? v.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

export default function History() {
  const { toast } = useToast();
  const { data: suggestions = [], isLoading } = useQuery<Suggestion[]>({
    queryKey: ["/api/suggestions"],
  });
  const { data: items = [] } = useQuery<Item[]>({ queryKey: ["/api/items"] });
  const itemsById = new Map(items.map((i) => [i.id, i]));

  const grouped = groupByDay(suggestions);

  return (
    <div className="px-5 sm:px-8 lg:px-12 py-8 max-w-5xl mx-auto">
      <div className="flex items-center gap-2 mb-6">
        <HistoryIcon className="size-6 text-primary" />
        <h1 className="font-display text-3xl tracking-tight">Suggestion history</h1>
      </div>
      <p className="text-sm text-muted-foreground mb-6 max-w-2xl">
        Every outfit the stylist has produced for you, with options to rate, take notes,
        re-wear, or delete. Up/down ratings train the AI for future picks.
      </p>

      {isLoading ? (
        <div className="text-sm text-muted-foreground">Loading…</div>
      ) : suggestions.length === 0 ? (
        <div className="rounded-md border border-dashed border-card-border p-8 text-center">
          <div className="font-medium text-base mb-1">No suggestions yet</div>
          <p className="text-sm text-muted-foreground">
            Open the Today page; each outfit you see here will be logged automatically.
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {grouped.map(([day, group]) => (
            <section key={day}>
              <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground mb-3">
                {day} · {group.length} suggestion{group.length === 1 ? "" : "s"}
              </div>
              <div className="space-y-3">
                {group.map((s) => (
                  <SuggestionCard
                    key={s.id}
                    suggestion={s}
                    itemsById={itemsById}
                    onWear={() => toast({ title: "Outfit logged", description: "Recorded as today's wear." })}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

function groupByDay(list: Suggestion[]): Array<[string, Suggestion[]]> {
  const map = new Map<string, Suggestion[]>();
  for (const s of list) {
    const day = fmtDay(s.createdAt);
    if (!map.has(day)) map.set(day, []);
    map.get(day)!.push(s);
  }
  return Array.from(map.entries());
}

function SuggestionCard({
  suggestion,
  itemsById,
  onWear,
}: {
  suggestion: Suggestion;
  itemsById: Map<number, Item>;
  onWear: () => void;
}) {
  const [editingNotes, setEditingNotes] = useState(false);
  const [notesDraft, setNotesDraft] = useState(suggestion.notes);
  const ids = parseIds(suggestion.itemIds);
  const reasons = parseReasons(suggestion.reasons);
  const itemList = ids.map((id) => itemsById.get(id)).filter((i): i is Item => Boolean(i));

  const rate = useMutation({
    mutationFn: async (rating: "up" | "down" | null) => {
      const res = await apiRequest("PATCH", `/api/suggestions/${suggestion.id}/rating`, {
        rating,
      });
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/suggestions"] }),
  });

  const saveNotes = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("PATCH", `/api/suggestions/${suggestion.id}/notes`, {
        notes: notesDraft,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/suggestions"] });
      setEditingNotes(false);
    },
  });

  const wearAgain = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/wears", { itemIds: ids });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/wears"] });
      queryClient.invalidateQueries({ queryKey: ["/api/items"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
      onWear();
    },
  });

  const remove = useMutation({
    mutationFn: async () => apiRequest("DELETE", `/api/suggestions/${suggestion.id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/suggestions"] }),
  });

  return (
    <div className="rounded-lg border border-card-border bg-card p-4">
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <span className="text-xs text-muted-foreground">{fmtTime(suggestion.createdAt)}</span>
        <Badge variant="outline" className="capitalize">
          {suggestion.formality.replace("-", " ")}
        </Badge>
        <Badge variant="outline" className="capitalize">
          {suggestion.source === "ai" ? `${suggestion.aiProvider ?? "ai"} stylist` : "rules"}
        </Badge>
        {suggestion.variation > 0 && (
          <Badge variant="outline">reshuffle #{suggestion.variation}</Badge>
        )}
        {suggestion.rating === "up" && (
          <Badge className="bg-emerald-600">
            <ThumbsUp className="size-3 mr-1" /> liked
          </Badge>
        )}
        {suggestion.rating === "down" && (
          <Badge variant="destructive">
            <ThumbsDown className="size-3 mr-1" /> disliked
          </Badge>
        )}
      </div>

      {itemList.length === 0 ? (
        <p className="text-xs text-muted-foreground italic">
          Some items in this suggestion have been deleted.
        </p>
      ) : (
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
          {itemList.map((it) => (
            <div key={it.id} className="rounded-md border border-card-border bg-background/60 p-2">
              <div className="aspect-square flex items-center justify-center">
                <ItemThumb item={it} />
              </div>
              <div className="mt-1.5">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  {it.category}
                </div>
                <div className="text-xs font-medium leading-tight truncate">{it.name}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {reasons.length > 0 && (
        <ul className="mt-3 space-y-1.5 text-xs text-foreground/75">
          {reasons.map((r, i) => (
            <li key={i} className="flex gap-2">
              <span className="mt-1.5 size-1 rounded-full bg-primary shrink-0" />
              <span>{r}</span>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          variant={suggestion.rating === "up" ? "default" : "outline"}
          onClick={() => rate.mutate(suggestion.rating === "up" ? null : "up")}
          disabled={rate.isPending}
        >
          <ThumbsUp className="size-4" /> Like
        </Button>
        <Button
          size="sm"
          variant={suggestion.rating === "down" ? "destructive" : "outline"}
          onClick={() => rate.mutate(suggestion.rating === "down" ? null : "down")}
          disabled={rate.isPending}
        >
          <ThumbsDown className="size-4" /> Dislike
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => wearAgain.mutate()}
          disabled={wearAgain.isPending || itemList.length === 0}
        >
          <Check className="size-4" /> Wear today
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            setEditingNotes((v) => !v);
            setNotesDraft(suggestion.notes);
          }}
        >
          <Pencil className="size-4" /> {suggestion.notes ? "Edit note" : "Add note"}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="ml-auto text-destructive"
          onClick={() => remove.mutate()}
          disabled={remove.isPending}
        >
          <Trash2 className="size-4" /> Delete
        </Button>
      </div>

      {(editingNotes || suggestion.notes) && (
        <div className={cn("mt-3", editingNotes ? "" : "text-xs text-muted-foreground italic")}>
          {editingNotes ? (
            <>
              <Textarea
                value={notesDraft}
                onChange={(e) => setNotesDraft(e.target.value)}
                placeholder="Why did this work / not work?"
                rows={2}
                maxLength={500}
              />
              <div className="mt-2 flex gap-2">
                <Button
                  size="sm"
                  onClick={() => saveNotes.mutate()}
                  disabled={saveNotes.isPending}
                >
                  Save
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setEditingNotes(false)}>
                  Cancel
                </Button>
              </div>
            </>
          ) : (
            <>"{suggestion.notes}"</>
          )}
        </div>
      )}
    </div>
  );
}
