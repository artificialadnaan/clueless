import { useState, useRef, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Upload, Loader2, CheckCircle2, AlertCircle, Sparkles } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import type { Item } from "@shared/schema";

type RowStatus = "queued" | "resizing" | "uploading" | "done" | "error";

interface Row {
  id: string;
  file: File;
  preview: string;
  status: RowStatus;
  error?: string;
  item?: Item;
}

const MAX_EDGE = 1568;
const JPEG_QUALITY = 0.85;

async function resizeToJpeg(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file).catch(() => null);
  if (!bitmap) {
    // HEIC and a few formats can't be decoded by createImageBitmap in browsers.
    // Send the original; server will reject if mime is unsupported.
    return file;
  }
  const { width, height } = bitmap;
  const longest = Math.max(width, height);
  const scale = longest > MAX_EDGE ? MAX_EDGE / longest : 1;
  const w = Math.round(width * scale);
  const h = Math.round(height * scale);
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

export default function Import() {
  const [rows, setRows] = useState<Row[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [running, setRunning] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const addFiles = useCallback((files: FileList | File[]) => {
    const next: Row[] = [];
    for (const file of Array.from(files)) {
      if (!file.type.startsWith("image/")) continue;
      next.push({
        id: `${file.name}-${file.size}-${Math.random().toString(36).slice(2, 8)}`,
        file,
        preview: URL.createObjectURL(file),
        status: "queued",
      });
    }
    setRows((prev) => [...prev, ...next]);
  }, []);

  function updateRow(id: string, patch: Partial<Row>) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }

  async function processRow(row: Row) {
    try {
      updateRow(row.id, { status: "resizing" });
      const resized = await resizeToJpeg(row.file);
      updateRow(row.id, { status: "uploading" });

      const form = new FormData();
      const filename =
        resized === row.file
          ? row.file.name
          : row.file.name.replace(/\.[^.]+$/, "") + ".jpg";
      form.append("photos", resized, filename);

      const res = await fetch("/api/items/import", { method: "POST", body: form });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`${res.status}: ${text}`);
      }
      const json = (await res.json()) as {
        created: Array<{ filename: string; item: Item }>;
        failed: Array<{ filename: string; error: string }>;
      };
      if (json.failed.length > 0) {
        throw new Error(json.failed[0].error);
      }
      const item = json.created[0]?.item;
      if (!item) throw new Error("no item returned");
      updateRow(row.id, { status: "done", item });
    } catch (error) {
      updateRow(row.id, {
        status: "error",
        error: error instanceof Error ? error.message : "unknown error",
      });
    }
  }

  async function runAll() {
    setRunning(true);
    const queue = rows.filter((r) => r.status === "queued" || r.status === "error");
    for (const row of queue) {
      // Re-read latest snapshot in case state changed.
      await processRow(row);
    }
    await queryClient.invalidateQueries({ queryKey: ["/api/items"] });
    setRunning(false);
    const succeeded = rows.filter((r) => r.status === "done").length + queue.length;
    toast({ title: "Import complete", description: `${succeeded} items processed` });
  }

  function clearAll() {
    rows.forEach((r) => URL.revokeObjectURL(r.preview));
    setRows([]);
  }

  const queuedCount = rows.filter((r) => r.status === "queued").length;
  const doneCount = rows.filter((r) => r.status === "done").length;
  const errorCount = rows.filter((r) => r.status === "error").length;

  return (
    <div className="container mx-auto px-4 py-6 max-w-5xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-primary" />
            AI Import
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Drop photos of clothing or accessories. Claude vision tags each one and adds it to your wardrobe.
          </p>
        </div>
        {rows.length > 0 && (
          <div className="flex gap-2">
            <Button variant="outline" onClick={clearAll} disabled={running}>
              Clear
            </Button>
            <Button onClick={runAll} disabled={running || queuedCount + errorCount === 0}>
              {running ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              {running ? "Processing…" : `Process ${queuedCount + errorCount} photo${queuedCount + errorCount === 1 ? "" : "s"}`}
            </Button>
          </div>
        )}
      </div>

      <label
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files);
        }}
        className={cn(
          "block border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors",
          dragOver ? "border-primary bg-primary/5" : "border-border hover:border-primary/50",
        )}
      >
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files?.length) addFiles(e.target.files);
            e.target.value = "";
          }}
        />
        <Upload className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
        <div className="text-base font-medium">Drop photos here or click to browse</div>
        <div className="text-sm text-muted-foreground mt-1">
          JPG, PNG, WebP, HEIC, or GIF · resized to 1568px before upload
        </div>
      </label>

      {rows.length > 0 && (
        <div className="mt-6 space-y-3">
          <div className="flex gap-2 text-sm">
            <Badge variant="secondary">{rows.length} total</Badge>
            {doneCount > 0 && <Badge className="bg-emerald-600">{doneCount} done</Badge>}
            {errorCount > 0 && <Badge variant="destructive">{errorCount} errored</Badge>}
            {queuedCount > 0 && <Badge variant="outline">{queuedCount} queued</Badge>}
          </div>

          <div className="grid gap-2">
            {rows.map((row) => (
              <RowCard key={row.id} row={row} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function RowCard({ row }: { row: Row }) {
  return (
    <div className="flex items-center gap-3 border rounded-lg p-3 bg-card">
      <img
        src={row.preview}
        alt={row.file.name}
        className="w-16 h-16 object-cover rounded-md bg-muted"
      />
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium truncate">
          {row.item?.name ?? row.file.name}
        </div>
        {row.item ? (
          <div className="text-xs text-muted-foreground mt-0.5 flex flex-wrap gap-x-2 gap-y-0.5">
            <span className="capitalize">{row.item.category}</span>
            <span>·</span>
            <span>{row.item.color}</span>
            <span>·</span>
            <span>{row.item.formality}</span>
            <span>·</span>
            <span>{row.item.season}</span>
            <span>·</span>
            <span>
              {row.item.minTempF}–{row.item.maxTempF}°F
            </span>
            {row.item.notes ? <span className="italic">· {row.item.notes}</span> : null}
          </div>
        ) : (
          <div className="text-xs text-muted-foreground mt-0.5">
            {(row.file.size / 1024).toFixed(0)} KB · {row.file.type || "image"}
          </div>
        )}
        {row.error && (
          <div className="text-xs text-destructive mt-1 truncate" title={row.error}>
            {row.error}
          </div>
        )}
      </div>
      <StatusIcon status={row.status} />
    </div>
  );
}

function StatusIcon({ status }: { status: RowStatus }) {
  switch (status) {
    case "queued":
      return <Badge variant="outline" className="text-xs">queued</Badge>;
    case "resizing":
      return (
        <span className="text-xs text-muted-foreground flex items-center gap-1">
          <Loader2 className="h-3 w-3 animate-spin" /> resizing
        </span>
      );
    case "uploading":
      return (
        <span className="text-xs text-muted-foreground flex items-center gap-1">
          <Loader2 className="h-3 w-3 animate-spin" /> AI tagging
        </span>
      );
    case "done":
      return <CheckCircle2 className="h-5 w-5 text-emerald-600" />;
    case "error":
      return <AlertCircle className="h-5 w-5 text-destructive" />;
  }
}
