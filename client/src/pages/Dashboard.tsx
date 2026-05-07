import { useQuery } from "@tanstack/react-query";
import type { Item, Wear } from "@shared/schema";
import { ItemThumb } from "@/components/ItemThumb";
import { Badge } from "@/components/ui/badge";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
  PieChart,
  Pie,
} from "recharts";

interface Stats {
  byCategory: Record<string, number>;
  totalWears: number;
  underused: Item[];
  rotation: { activeThisWeek: number; totalItems: number; coveragePct: number };
}

const CATEGORY_LABELS: Record<string, string> = {
  shirt: "Shirts",
  pants: "Pants",
  shoes: "Shoes",
  socks: "Socks",
  watch: "Watches",
  accessory: "Accessories",
};

const COLORS = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
  "hsl(var(--primary))",
];

function timeAgo(ts: number) {
  const days = Math.floor((Date.now() - ts) / (24 * 60 * 60 * 1000));
  if (days === 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 7) return `${days}d ago`;
  return `${Math.floor(days / 7)}w ago`;
}

export default function Dashboard() {
  const { data: stats } = useQuery<Stats>({ queryKey: ["/api/stats"] });
  const { data: items = [] } = useQuery<Item[]>({ queryKey: ["/api/items"] });
  const { data: wears = [] } = useQuery<Wear[]>({ queryKey: ["/api/wears"] });

  const itemsById = Object.fromEntries(items.map((i) => [i.id, i]));

  const categoryData = stats
    ? Object.entries(stats.byCategory).map(([k, v]) => ({
        name: CATEGORY_LABELS[k] || k,
        value: v,
      }))
    : [];

  // Wears per day (last 14)
  const wearsByDay: { day: string; count: number }[] = [];
  const now = new Date();
  for (let i = 13; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    d.setHours(0, 0, 0, 0);
    const start = d.getTime();
    const end = start + 24 * 60 * 60 * 1000;
    const count = wears.filter((w) => w.wornAt >= start && w.wornAt < end).length;
    wearsByDay.push({
      day: d.toLocaleDateString(undefined, { weekday: "short" }).slice(0, 1),
      count,
    });
  }

  const recentWears = wears.slice(0, 4).map((w) => {
    let ids: number[] = [];
    try {
      ids = JSON.parse(w.itemIds);
    } catch {}
    return { wear: w, items: ids.map((id) => itemsById[id]).filter(Boolean) };
  });

  return (
    <div className="px-5 sm:px-8 lg:px-12 py-8 max-w-6xl mx-auto">
      <div className="mb-8">
        <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground mb-2">
          Overview
        </div>
        <h1 className="font-display text-4xl tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground mt-1">
          Closet coverage, recent wears, and pieces overdue for rotation.
        </p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <Kpi
          label="Total pieces"
          value={items.length}
          testId="kpi-total"
          hint="Across all categories"
        />
        <Kpi
          label="Active this week"
          value={stats?.rotation.activeThisWeek ?? 0}
          testId="kpi-active"
          hint={`${stats?.rotation.coveragePct ?? 0}% closet coverage`}
        />
        <Kpi
          label="Outfits logged"
          value={stats?.totalWears ?? 0}
          testId="kpi-outfits"
          hint="All-time wear records"
        />
        <Kpi
          label="Needs rotation"
          value={stats?.underused.length ?? 0}
          testId="kpi-underused"
          hint="Unworn or stale 30+ days"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-6">
        <div className="rounded-lg border border-card-border bg-card p-5">
          <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground mb-4">
            Wears — last 14 days
          </div>
          <div className="h-44">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={wearsByDay} margin={{ top: 4, right: 4, bottom: 0, left: -28 }}>
                <XAxis
                  dataKey="day"
                  tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  allowDecimals={false}
                />
                <Tooltip
                  cursor={{ fill: "hsl(var(--accent))" }}
                  contentStyle={{
                    background: "hsl(var(--popover))",
                    border: "1px solid hsl(var(--popover-border))",
                    borderRadius: 6,
                    fontSize: 12,
                  }}
                />
                <Bar dataKey="count" fill="hsl(var(--primary))" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-lg border border-card-border bg-card p-5">
          <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground mb-4">
            Closet by category
          </div>
          <div className="flex flex-col sm:flex-row items-center gap-4">
            <div className="h-44 w-44 shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={categoryData}
                    dataKey="value"
                    innerRadius={36}
                    outerRadius={70}
                    paddingAngle={2}
                    stroke="none"
                  >
                    {categoryData.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex-1 space-y-1.5 text-sm">
              {categoryData.map((d, i) => (
                <div key={d.name} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span
                      className="size-2 rounded-full"
                      style={{ background: COLORS[i % COLORS.length] }}
                    />
                    <span className="text-foreground/85">{d.name}</span>
                  </div>
                  <span className="text-muted-foreground tabular-nums">
                    {d.value}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Recent + underused */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
        <div className="rounded-lg border border-card-border bg-card p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
              Recent outfits
            </div>
          </div>
          {recentWears.length === 0 ? (
            <div className="text-sm text-muted-foreground" data-testid="empty-recent">
              No outfits logged yet — head to Today and mark one as worn.
            </div>
          ) : (
            <ul className="space-y-3" data-testid="list-recent-wears">
              {recentWears.map(({ wear, items }) => (
                <li
                  key={wear.id}
                  className="flex items-start gap-3 border-b border-card-border last:border-0 pb-3 last:pb-0"
                  data-testid={`recent-wear-${wear.id}`}
                >
                  <div className="flex -space-x-2">
                    {items.slice(0, 4).map((it) => (
                      <div
                        key={it.id}
                        className="size-10 rounded-full border-2 border-card bg-background flex items-center justify-center overflow-hidden"
                        title={it.name}
                      >
                        <ItemThumb item={it} />
                      </div>
                    ))}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium">
                      {items.length} pieces
                      {wear.weatherTempF != null && (
                        <span className="text-muted-foreground font-normal">
                          {" "}
                          · {wear.weatherTempF}°F {wear.weatherCondition}
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground truncate">
                      {items.map((i) => i.name).join(" · ")}
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground whitespace-nowrap">
                    {timeAgo(wear.wornAt)}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-lg border border-card-border bg-card p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
              Underused — give these a turn
            </div>
            <Badge variant="outline" data-testid="badge-underused-count">
              {stats?.underused.length ?? 0}
            </Badge>
          </div>
          {stats?.underused.length === 0 ? (
            <div className="text-sm text-muted-foreground">
              Nice rotation — every piece has been worn recently.
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-3" data-testid="grid-underused">
              {stats?.underused.map((item) => (
                <div
                  key={item.id}
                  className="rounded-md border border-card-border p-2"
                  data-testid={`underused-${item.id}`}
                >
                  <div className="aspect-square flex items-center justify-center bg-background/60 rounded-sm">
                    <ItemThumb item={item} />
                  </div>
                  <div className="text-[11px] text-foreground mt-1.5 leading-tight truncate">
                    {item.name}
                  </div>
                  <div className="text-[10px] text-muted-foreground capitalize">
                    {item.category}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Kpi({
  label,
  value,
  hint,
  testId,
}: {
  label: string;
  value: number | string;
  hint?: string;
  testId: string;
}) {
  return (
    <div
      className="rounded-lg border border-card-border bg-card p-4"
      data-testid={testId}
    >
      <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
        {label}
      </div>
      <div className="font-display text-3xl mt-1.5 tabular-nums">{value}</div>
      {hint && <div className="text-xs text-muted-foreground mt-0.5">{hint}</div>}
    </div>
  );
}
