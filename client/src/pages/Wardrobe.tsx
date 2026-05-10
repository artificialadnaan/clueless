import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Item } from "@shared/schema";
import { CATEGORIES, FORMALITIES, SEASONS, insertItemSchema } from "@shared/schema";
import { ItemThumb } from "@/components/ItemThumb";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, Trash2, Pencil, Sparkles } from "lucide-react";
import { ItemDetailDialog } from "@/components/ItemDetailDialog";
import { Link } from "wouter";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const CATEGORY_LABELS: Record<string, string> = {
  shirt: "Shirts & tops",
  pants: "Pants",
  shoes: "Shoes",
  socks: "Socks",
  watch: "Watches",
  accessory: "Accessories",
};

function timeAgo(ts: number | null) {
  if (!ts) return "Never worn";
  const days = Math.floor((Date.now() - ts) / (24 * 60 * 60 * 1000));
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

export default function Wardrobe() {
  const [filter, setFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);

  const { data: items = [], isLoading } = useQuery<Item[]>({
    queryKey: ["/api/items"],
  });

  const filtered = items
    .filter((i) => (filter === "all" ? true : i.category === filter))
    .filter((i) =>
      search
        ? (i.name + i.color + i.notes)
            .toLowerCase()
            .includes(search.toLowerCase())
        : true
    );

  const counts = items.reduce<Record<string, number>>((acc, i) => {
    acc[i.category] = (acc[i.category] || 0) + 1;
    return acc;
  }, {});

  return (
    <div className="px-5 sm:px-8 lg:px-12 py-8 max-w-6xl mx-auto">
      <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
        <div>
          <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground mb-2">
            Inventory
          </div>
          <h1 className="font-display text-4xl tracking-tight">Wardrobe</h1>
          <p className="text-muted-foreground mt-1">
            {items.length} pieces, organised by category.
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-add-item">
              <Plus className="size-4" /> Add item
            </Button>
          </DialogTrigger>
          <AddItemForm onClose={() => setOpen(false)} />
        </Dialog>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2 mb-6">
        <Button
          variant={filter === "all" ? "default" : "outline"}
          size="sm"
          onClick={() => setFilter("all")}
          data-testid="filter-all"
        >
          All <span className="ml-1.5 opacity-70">{items.length}</span>
        </Button>
        {CATEGORIES.map((c) => (
          <Button
            key={c}
            variant={filter === c ? "default" : "outline"}
            size="sm"
            onClick={() => setFilter(c)}
            data-testid={`filter-${c}`}
          >
            {CATEGORY_LABELS[c]}{" "}
            <span className="ml-1.5 opacity-70">{counts[c] || 0}</span>
          </Button>
        ))}
        <div className="relative ml-auto">
          <Search className="size-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search…"
            className="pl-8 w-56"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            data-testid="input-search"
          />
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="aspect-[3/4] bg-muted rounded-md animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-12 text-center text-muted-foreground" data-testid="empty-state">
          No items match. Try a different filter, or add a new piece.
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3" data-testid="grid-items">
          {filtered.map((item) => (
            <ItemCard key={item.id} item={item} />
          ))}
        </div>
      )}
    </div>
  );
}

function ItemCard({ item }: { item: Item }) {
  const { toast } = useToast();
  const [editorOpen, setEditorOpen] = useState(false);
  const del = useMutation({
    mutationFn: async () => {
      await apiRequest("DELETE", `/api/items/${item.id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/items"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
      toast({ title: "Item removed" });
    },
  });
  return (
    <div
      className="group rounded-md border border-card-border bg-card p-3 hover-elevate"
      data-testid={`card-item-${item.id}`}
    >
      <button
        type="button"
        onClick={() => setEditorOpen(true)}
        className="block w-full aspect-square flex items-center justify-center rounded-sm bg-background/60 cursor-pointer"
        aria-label="Open item details"
      >
        <ItemThumb item={item} />
      </button>
      <div className="mt-2.5 flex items-start justify-between gap-1">
        <div className="min-w-0">
          <div className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
            {item.category}
          </div>
          <div className="text-sm font-medium leading-tight truncate">
            {item.name}
          </div>
          <div className="text-xs text-muted-foreground capitalize truncate">
            {item.color}
          </div>
        </div>
        <div className="shrink-0 flex flex-col gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100">
          <Button
            asChild
            variant="ghost"
            size="icon"
            className="size-7 rounded text-muted-foreground"
          >
            <Link
              href={`/from/${item.id}`}
              aria-label="Build outfit from this item"
              data-testid={`button-build-outfit-${item.id}`}
            >
              <Sparkles className="size-3.5" />
            </Link>
          </Button>
          <button
            aria-label="Edit item"
            className="size-7 rounded text-muted-foreground hover-elevate flex items-center justify-center"
            onClick={() => setEditorOpen(true)}
            data-testid={`button-edit-${item.id}`}
          >
            <Pencil className="size-3.5" />
          </button>
          <button
            aria-label="Delete item"
            className="size-7 rounded text-muted-foreground hover-elevate flex items-center justify-center"
            onClick={() => del.mutate()}
            data-testid={`button-delete-${item.id}`}
          >
            <Trash2 className="size-3.5" />
          </button>
        </div>
      </div>
      <ItemDetailDialog item={item} open={editorOpen} onOpenChange={setEditorOpen} />
      <div className="mt-2 flex flex-wrap gap-1">
        <Badge variant="secondary" className="text-[10px] capitalize">
          {item.formality}
        </Badge>
        <Badge variant="outline" className="text-[10px] capitalize">
          {item.season}
        </Badge>
      </div>
      <div className="mt-2 flex items-center justify-between text-[11px] text-muted-foreground">
        <span data-testid={`text-worn-${item.id}`}>
          {timeAgo(item.lastWornAt)}
        </span>
        <span>{item.wearCount}× worn</span>
      </div>
    </div>
  );
}

const formSchema = insertItemSchema.extend({
  name: z.string().min(1, "Name is required"),
  color: z.string().min(1, "Color is required"),
  colorHex: z.string().regex(/^#[0-9a-fA-F]{6}$/i, "Hex like #1B2A4E"),
});

function AddItemForm({ onClose }: { onClose: () => void }) {
  const { toast } = useToast();
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      category: "shirt",
      color: "",
      colorHex: "#1B2A4E",
      formality: "business",
      season: "all",
      minTempF: 30,
      maxTempF: 90,
      notes: "",
    },
  });

  const create = useMutation({
    mutationFn: async (values: z.infer<typeof formSchema>) => {
      const res = await apiRequest("POST", "/api/items", values);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/items"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
      toast({ title: "Item added", description: "Available in your rotation." });
      onClose();
      form.reset();
    },
  });

  return (
    <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle className="font-display text-2xl">Add wardrobe item</DialogTitle>
      </DialogHeader>
      <Form {...form}>
        <form
          onSubmit={form.handleSubmit((v) => create.mutate(v))}
          className="space-y-4"
        >
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Name</FormLabel>
                <FormControl>
                  <Input placeholder="Crisp white oxford" {...field} data-testid="input-name" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <div className="grid grid-cols-2 gap-3">
            <FormField
              control={form.control}
              name="category"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Category</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger data-testid="select-category">
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {CATEGORIES.map((c) => (
                        <SelectItem key={c} value={c}>
                          {CATEGORY_LABELS[c]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="formality"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Formality</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger data-testid="select-formality-form">
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {FORMALITIES.map((f) => (
                        <SelectItem key={f} value={f}>
                          {f}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <FormField
              control={form.control}
              name="color"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Color name</FormLabel>
                  <FormControl>
                    <Input placeholder="navy" {...field} data-testid="input-color" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="colorHex"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Color hex</FormLabel>
                  <FormControl>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        className="size-9 rounded border border-input cursor-pointer"
                        value={field.value}
                        onChange={(e) => field.onChange(e.target.value)}
                        data-testid="input-color-hex-picker"
                      />
                      <Input {...field} data-testid="input-color-hex" />
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <FormField
              control={form.control}
              name="season"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Season</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger data-testid="select-season">
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {SEASONS.map((s) => (
                        <SelectItem key={s} value={s}>
                          {s}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="minTempF"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Min °F</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      {...field}
                      onChange={(e) => field.onChange(parseInt(e.target.value || "0", 10))}
                      data-testid="input-min-temp"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="maxTempF"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Max °F</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      {...field}
                      onChange={(e) => field.onChange(parseInt(e.target.value || "0", 10))}
                      data-testid="input-max-temp"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
          <FormField
            control={form.control}
            name="notes"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Notes</FormLabel>
                <FormControl>
                  <Textarea
                    rows={2}
                    placeholder="Pairs well with charcoal trousers."
                    {...field}
                    data-testid="input-notes"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose} data-testid="button-cancel">
              Cancel
            </Button>
            <Button type="submit" disabled={create.isPending} data-testid="button-submit">
              {create.isPending ? "Adding…" : "Add to wardrobe"}
            </Button>
          </DialogFooter>
        </form>
      </Form>
    </DialogContent>
  );
}
