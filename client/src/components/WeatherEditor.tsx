import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Weather } from "@shared/schema";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Cloud, CloudRain, Snowflake, Sun, CloudSun, RefreshCw, Wifi } from "lucide-react";

const CONDITIONS = [
  { value: "sunny", label: "Sunny", icon: Sun },
  { value: "cloudy", label: "Cloudy", icon: Cloud },
  { value: "partly-cloudy", label: "Partly cloudy", icon: CloudSun },
  { value: "rain", label: "Rain", icon: CloudRain },
  { value: "snow", label: "Snow", icon: Snowflake },
];

export function WeatherEditor() {
  const { data: weather } = useQuery<Weather | null>({
    queryKey: ["/api/weather"],
  });
  const [temp, setTemp] = useState<number>(62);
  const [condition, setCondition] = useState<string>("cloudy");
  const [city, setCity] = useState<string>("Chicago");
  const [hasAutoSynced, setHasAutoSynced] = useState(false);

  useEffect(() => {
    if (weather) {
      setTemp(weather.tempF);
      setCondition(weather.condition);
      setCity(weather.city);
    }
  }, [weather]);

  const save = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/weather", {
        tempF: temp,
        feelsLikeF: temp,
        condition,
        city,
        updatedAt: Date.now(),
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/weather"] });
      queryClient.invalidateQueries({ queryKey: ["/api/recommend"] });
    },
  });

  const refreshLive = useMutation({
    mutationFn: async (targetCity?: string) => {
      const res = await apiRequest("POST", "/api/weather/live", {
        city: targetCity || city || "Chicago",
      });
      return res.json();
    },
    onSuccess: (updated: Weather) => {
      setTemp(updated.tempF);
      setCondition(updated.condition);
      setCity(updated.city);
      queryClient.invalidateQueries({ queryKey: ["/api/weather"] });
      queryClient.invalidateQueries({ queryKey: ["/api/recommend"] });
    },
  });

  useEffect(() => {
    if (hasAutoSynced) return;
    const currentCity = weather?.city || "Chicago";
    const isStale = !weather || Date.now() - weather.updatedAt > 60 * 60 * 1000;
    if (isStale || weather?.city === "New York") {
      setHasAutoSynced(true);
      refreshLive.mutate(currentCity === "New York" ? "Chicago" : currentCity);
    }
  }, [hasAutoSynced, refreshLive, weather]);

  const Icon = CONDITIONS.find((c) => c.value === condition)?.icon ?? Cloud;

  return (
    <div className="rounded-lg border border-card-border bg-card p-5" data-testid="card-weather-editor">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground mb-2">
            Today's weather
          </div>
          <div className="flex items-center gap-3">
            <Icon className="size-7 text-primary" />
            <div className="font-display text-3xl leading-none">{temp}°F</div>
          </div>
          <div className="text-sm text-muted-foreground mt-2 capitalize">
            {condition.replace("-", " ")} · {city}
          </div>
          <div className="mt-2 flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <Wifi className="size-3" />
            <span data-testid="text-weather-source">
              {refreshLive.isPending ? "Pulling live weather…" : "Live weather with manual fallback"}
            </span>
          </div>
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-4">
        <div>
          <label className="text-xs text-muted-foreground">Temp °F</label>
          <Input
            type="number"
            value={temp}
            onChange={(e) => setTemp(parseInt(e.target.value || "0", 10))}
            data-testid="input-weather-temp"
          />
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Condition</label>
          <Select value={condition} onValueChange={setCondition}>
            <SelectTrigger data-testid="select-weather-condition">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CONDITIONS.map((c) => (
                <SelectItem key={c.value} value={c.value}>
                  {c.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-xs text-muted-foreground">City</label>
          <Input
            value={city}
            onChange={(e) => setCity(e.target.value)}
            data-testid="input-weather-city"
          />
        </div>
      </div>
      <Button
        className="mt-3 w-full"
        onClick={() => save.mutate()}
        disabled={save.isPending}
        data-testid="button-save-weather"
      >
        {save.isPending ? "Saving…" : "Update weather"}
      </Button>
      <Button
        className="mt-2 w-full"
        variant="outline"
        onClick={() => refreshLive.mutate(city)}
        disabled={refreshLive.isPending}
        data-testid="button-refresh-live-weather"
      >
        <RefreshCw className={`size-4 ${refreshLive.isPending ? "animate-spin" : ""}`} />
        {refreshLive.isPending ? "Refreshing live weather…" : "Refresh live weather"}
      </Button>
      {refreshLive.isError && (
        <p className="mt-2 text-xs text-destructive" data-testid="text-weather-error">
          Live weather could not be pulled for that city. You can still enter it manually.
        </p>
      )}
    </div>
  );
}
