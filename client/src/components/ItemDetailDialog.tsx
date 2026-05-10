import { useState, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Item, ItemPhoto } from "@shared/schema";
import { CATEGORIES, FORMALITIES, SEASONS } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Camera, Loader2, Trash2, Sparkles, Pencil } from "lucide-react";
import { cn } from "@/lib/utils";
import { Link } from "wouter";

interface Props {
  item: Item;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const MAX_EDGE = 1568;
const JPEG_QUALITY = 0.85;

async function resizeToJpeg(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file).catch(() => null);
  if (!bitmap) return file;
  const longest = Math.max(bitmap.width, bitmap.height);
  const scale = longest > MAX_EDGE ? MAX_EDGE / longest : 1;
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return file;
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();
  return await new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob ?? file), "image/jpeg", JPEG_QUALITY);
  });
}

export function ItemDetailDialog({ item, open, onOpenChange }: Props) {
  const { toast } = useToast();
  const [draft, setDraft] = useState<Partial<Item>>({});
  const [uploading, setUploading] = useState(false);
  const [retag, setRetag] = useState(true);
  const [kind, setKind] = useState<"stock" | "real">("real");
  const stockInputRef = useRef<HTMLInputElement>(null);

  const { data: photos = [] } = useQuery<ItemPhoto[]>({
    queryKey: [`/api/items/${item.id}/photos`],
    enabled: open,
  });

  const merged = { ...item, ...draft };

  const save = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("PATCH", `/api/items/${item.id}`, draft);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/items"] });
      toast({ title: "Saved", description: "Item details updated." });
      setDraft({});
    },
  });

  const deletePhoto = useMutation({
    mutationFn: async (photoId: number) => {
      await apiRequest("DELETE", `/api/items/${item.id}/photos/${photoId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/items/${item.id}/photos`] });
      queryClient.invalidateQueries({ queryKey: ["/api/items"] });
    },
  });

  async function uploadFile(file: File) {
    try {
      setUploading(true);
      const resized = await resizeToJpeg(file);
      const filename =
        resized === file ? file.name : file.name.replace(/\.[^.]+$/, "") + ".jpg";
      const form = new FormData();
      form.append("photo", resized, filename);
      form.append("kind", kind);
      form.append("retag", retag ? "1" : "0");
      const res = await fetch(`/api/items/${item.id}/photos`, {
        method: "POST",
        body: form,
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`${res.status}: ${text}`);
      }
      const json = await res.json();
      queryClient.invalidateQueries({ queryKey: [`/api/items/${item.id}/photos`] });
      queryClient.invalidateQueries({ queryKey: ["/api/items"] });
      toast({
        title: kind === "real" ? "Real-world photo added" : "Stock photo added",
        description: retag
          ? "Re-ran AI tagging from the new photo."
          : json.aiError ?? "Saved without re-tagging.",
      });
    } catch (e) {
      toast({
        title: "Upload failed",
        description: e instanceof Error ? e.message : "Unknown error",
      });
    } finally {
      setUploading(false);
    }
  }

  function patch<K extends keyof Item>(key: K, value: Item[K]) {
    setDraft((d) => ({ ...d, [key]: value }));
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl flex items-center gap-2">
            <Pencil className="size-5" /> Edit item
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          <section>
            <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground mb-3">
              Photos
            </div>
            {photos.length === 0 && !item.imagePath ? (
              <p className="text-xs text-muted-foreground italic mb-3">No photos yet.</p>
            ) : (
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 mb-3">
                {photos.map((p) => (
                  <div key={p.id} className="relative group">
                    <img
                      src={`/api/images/${p.filename}`}
                      alt={p.kind}
                      className="w-full aspect-square object-cover rounded-md border border-card-border"
                    />
                    <Badge
                      className={cn(
                        "absolute top-1 left-1 text-[10px]",
                        p.kind === "real" ? "bg-emerald-600" : "bg-muted",
                      )}
                    >
                      {p.kind}
                    </Badge>
                    <button
                      onClick={() => deletePhoto.mutate(p.id)}
                      className="absolute top-1 right-1 size-6 rounded bg-black/60 text-white opacity-0 group-hover:opacity-100 flex items-center justify-center"
                      aria-label="Delete photo"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className="rounded-md border border-dashed border-card-border p-3 space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs text-muted-foreground">Kind</span>
                <div className="flex gap-1">
                  <Button
                    size="sm"
                    variant={kind === "real" ? "default" : "outline"}
                    onClick={() => setKind("real")}
                  >
                    Real-world
                  </Button>
                  <Button
                    size="sm"
                    variant={kind === "stock" ? "default" : "outline"}
                    onClick={() => setKind("stock")}
                  >
                    Stock / catalog
                  </Button>
                </div>
                <div className="ml-auto flex items-center gap-2">
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <Sparkles className="size-3" /> Re-tag from this photo
                  </span>
                  <Switch checked={retag} onCheckedChange={setRetag} />
                </div>
              </div>
              <input
                ref={stockInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) uploadFile(f);
                  e.target.value = "";
                }}
              />
              <Button
                onClick={() => stockInputRef.current?.click()}
                disabled={uploading}
                className="w-full"
              >
                {uploading ? (
                  <Loader2 className="size-4 mr-2 animate-spin" />
                ) : (
                  <Camera className="size-4 mr-2" />
                )}
                {uploading
                  ? "Uploading…"
                  : kind === "real"
                  ? "Upload a real-world photo"
                  : "Upload a stock photo"}
              </Button>
              <p className="text-[11px] text-muted-foreground">
                Real-world photos become the primary thumbnail. With re-tag on, the AI re-extracts
                color, formality, and notes from the new photo and overwrites the fields below.
              </p>
            </div>
          </section>

          <section className="space-y-3">
            <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
              Details
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Name</label>
              <Input
                value={merged.name}
                onChange={(e) => patch("name", e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground">Category</label>
                <Select
                  value={merged.category}
                  onValueChange={(v) => patch("category", v as Item["category"])}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Formality</label>
                <Select
                  value={merged.formality}
                  onValueChange={(v) => patch("formality", v as Item["formality"])}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FORMALITIES.map((f) => (
                      <SelectItem key={f} value={f}>
                        {f}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground">Color name</label>
                <Input
                  value={merged.color}
                  onChange={(e) => patch("color", e.target.value)}
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Color hex</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    className="size-9 rounded border border-input cursor-pointer"
                    value={merged.colorHex}
                    onChange={(e) => patch("colorHex", e.target.value)}
                  />
                  <Input
                    value={merged.colorHex}
                    onChange={(e) => patch("colorHex", e.target.value)}
                  />
                </div>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-xs text-muted-foreground">Season</label>
                <Select
                  value={merged.season}
                  onValueChange={(v) => patch("season", v as Item["season"])}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SEASONS.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Min °F</label>
                <Input
                  type="number"
                  value={merged.minTempF}
                  onChange={(e) => patch("minTempF", parseInt(e.target.value || "0", 10))}
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Max °F</label>
                <Input
                  type="number"
                  value={merged.maxTempF}
                  onChange={(e) => patch("maxTempF", parseInt(e.target.value || "0", 10))}
                />
              </div>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Notes (real-world fit, color, fabric)</label>
              <Textarea
                rows={3}
                value={merged.notes}
                onChange={(e) => patch("notes", e.target.value)}
                placeholder="Runs slim. Color is more grey than navy in person. Fabric is too thin for winter."
              />
            </div>
          </section>
        </div>

        <DialogFooter className="mt-4">
          <Button asChild variant="default">
            <Link href={`/?seedItemId=${item.id}`}>
              <Sparkles className="size-4" />
              Build outfit from this
            </Link>
          </Button>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Button
            onClick={() => save.mutate()}
            disabled={save.isPending || Object.keys(draft).length === 0}
          >
            {save.isPending ? "Saving…" : "Save changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
