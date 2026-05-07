import { ReactNode, useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { Logo } from "./Logo";
import { LayoutDashboard, Shirt, Sparkles, Sun, Moon, Cloud, Upload, History } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import type { Weather } from "@shared/schema";

interface NavItem {
  href: string;
  label: string;
  icon: React.ElementType;
  testId: string;
}

const NAV: NavItem[] = [
  { href: "/", label: "Today", icon: Sparkles, testId: "nav-today" },
  { href: "/wardrobe", label: "Wardrobe", icon: Shirt, testId: "nav-wardrobe" },
  { href: "/import", label: "Import", icon: Upload, testId: "nav-import" },
  { href: "/history", label: "History", icon: History, testId: "nav-history" },
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, testId: "nav-dashboard" },
];

export function AppShell({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const [dark, setDark] = useState(false);

  // Initialize theme from media query (no localStorage in sandbox)
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    setDark(mq.matches);
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
  }, [dark]);

  const { data: weather } = useQuery<Weather | null>({
    queryKey: ["/api/weather"],
  });

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-background text-foreground">
      {/* Sidebar */}
      <aside
        className="md:w-64 md:min-h-screen md:border-r border-b md:border-b-0 border-sidebar-border bg-sidebar text-sidebar-foreground md:flex md:flex-col"
        data-testid="sidebar"
      >
        <div className="px-5 py-5 md:py-7 flex items-center justify-between md:justify-start gap-3">
          <Link href="/" className="flex items-center gap-2.5" data-testid="link-home">
            <span className="text-sidebar-primary"><Logo size={26} /></span>
            <div className="leading-none">
              <div className="font-display text-xl tracking-tight">Closet</div>
              <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground mt-1">
                Office Atelier
              </div>
            </div>
          </Link>
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            onClick={() => setDark((d) => !d)}
            data-testid="button-theme-toggle-mobile"
            aria-label="Toggle theme"
          >
            {dark ? <Sun className="size-4" /> : <Moon className="size-4" />}
          </Button>
        </div>
        <nav className="px-3 pb-4 md:py-2 flex md:flex-col gap-1 overflow-x-auto">
          {NAV.map((item) => {
            const active = location === item.href;
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                data-testid={item.testId}
                className={cn(
                  "flex items-center gap-2.5 px-3 py-2 rounded-md text-sm hover-elevate active-elevate-2 whitespace-nowrap",
                  active
                    ? "bg-sidebar-primary text-sidebar-primary-foreground"
                    : "text-sidebar-foreground"
                )}
              >
                <Icon className="size-4" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
        <div className="hidden md:block mt-auto px-5 pb-6">
          <div className="rounded-md border border-sidebar-border p-3.5 bg-sidebar/40">
            <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground mb-2 flex items-center gap-1.5">
              <Cloud className="size-3" /> Today
            </div>
            {weather ? (
              <div data-testid="text-weather-summary">
                <div className="font-display text-xl">
                  {weather.tempF}°F
                </div>
                <div className="text-xs text-muted-foreground capitalize">
                  {weather.condition} · {weather.city}
                </div>
              </div>
            ) : (
              <div className="text-xs text-muted-foreground">—</div>
            )}
          </div>
          <div className="flex items-center justify-between mt-4 px-1">
            <div className="text-[11px] text-muted-foreground">
              for Adnaan
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setDark((d) => !d)}
              data-testid="button-theme-toggle"
              aria-label="Toggle theme"
              className="size-8"
            >
              {dark ? <Sun className="size-4" /> : <Moon className="size-4" />}
            </Button>
          </div>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 min-w-0">{children}</main>
    </div>
  );
}
