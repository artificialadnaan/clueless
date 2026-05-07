# Closet — Office Atelier (Wardrobe App)

A polished fullstack prototype that stores Adnaan's office wardrobe and recommends a coordinated
outfit each day, weighing color harmony, live weather, recency, dress code, and optional AI stylist
judgment.

**Project path:** `/home/user/workspace/wardrobe-app`
**Static dist for deployment:** `/home/user/workspace/wardrobe-app/dist/public`
**Production server command:** `NODE_ENV=production node dist/index.cjs`
**Backend port:** `5000`
**Healthcheck:** `/health`

## Run / build / test

```bash
cd /home/user/workspace/wardrobe-app
npm install            # already done
npm run dev            # dev server on :5000 (Express + Vite)
npm run build          # produces dist/public + dist/index.cjs
npm run start          # runs the production server
```

The dev server already seeds 26 wardrobe items, the current weather row, and 2 historical
"worn" outfits when `data.db` is empty (`server/seed.ts`). To rebuild seed data, delete
`data.db*` files and restart.

Environment variables are documented in `.env.example`. For Railway, set `DATABASE_PATH=/data/data.db`
and mount a volume at `/data`. For the optional AI stylist, set either `OPENAI_API_KEY` or
`ANTHROPIC_API_KEY` plus optional model variables.

## Design decisions

- **Direction:** Editorial tailoring — cream surface (`hsl(36 28% 95%)`), deep ink text, tobacco/camel
  accent (`hsl(24 38% 32%)`). Display: **Fraunces** (serif). Body: **Inter**. The aesthetic
  intentionally avoids the generic SaaS-AI look.
- **Logo:** Custom inline SVG hanger with bar (`client/src/components/Logo.tsx`) and an SVG favicon
  embedded as a data URL in `client/index.html`. Works monochrome at 24-200px, follows
  `currentColor`.
- **Item thumbs:** Custom inline SVG silhouettes for each category (`ItemThumb.tsx`) filled with
  the item's actual hex color — no stock photos, every item rendered consistently.
- **Charts:** Recharts bar + donut on the Dashboard, themed via `--chart-1..5`.
- **Dark mode:** First-class. Theme syncs to `prefers-color-scheme`; toggle button in sidebar.
  No `localStorage` (sandbox-blocked).

## Architecture

```
shared/schema.ts       drizzle tables: items, wears, weather, users
                       enums: CATEGORIES, FORMALITIES, SEASONS
server/storage.ts      DatabaseStorage on better-sqlite3, auto-bootstraps tables
server/seed.ts         seedIfEmpty() runs on registerRoutes
server/recommender.ts  Pure-function rules recommender (color/weather/recency/formality)
server/aiRecommender.ts Optional OpenAI/Anthropic recommender wrapper with validation + fallback
server/routes.ts       /health, /api/items, /api/wears, /api/weather, /api/weather/live,
                       /api/ai/status, /api/recommend, /api/stats
client/src/App.tsx     hash-routed: /, /wardrobe, /dashboard
client/src/pages/
   Today.tsx           outfit assistant + AI toggle + weather editor + reasons
   Wardrobe.tsx        inventory grid + filters + add-item dialog
   Dashboard.tsx       KPIs, charts, recent wears, underused items
client/src/components/
   AppShell.tsx        sidebar + responsive shell + dark-mode toggle
   Logo.tsx            inline SVG logo
   ItemThumb.tsx       per-category SVG silhouettes
   WeatherEditor.tsx   live Open-Meteo weather sync with manual fallback
```

### Recommender heuristics (`server/recommender.ts`)

The assistant picks one item per slot (shirt, pants, shoes, socks, watch, accessory) and ranks
candidates per slot by:

1. **Weather fit** — temp must fall inside `[minTempF, maxTempF]`; out-of-range items decay linearly.
2. **Recency** — last-worn within 1d (-0.6), 3d (-0.3), 7d (-0.1).
3. **Formality** — distance from selected dress code (smart-casual / business / formal).
4. **Color harmony** — HSL-distance score across already-chosen partners; neutrals match anything.
5. **Wet-weather suede penalty** — suede pieces are skipped on rain/snow.

The endpoint emits human-readable `reasons` that are surfaced in the UI's "Why this works" list.

### Optional AI stylist (`server/aiRecommender.ts`)

The Today page can request `GET /api/recommend?formality=business&ai=1`. The server first builds a
safe baseline using the rules engine, then optionally calls OpenAI or Anthropic if API keys are
configured. The AI receives compact wardrobe, weather, recent-wear, and baseline context, must return
JSON item IDs, and is validated before use. If no provider is configured or the model returns an
invalid response, the app falls back to the rules engine and labels the UI as a rules fallback.

Supported variables:

- `AI_PROVIDER=auto|openai|anthropic`
- `OPENAI_API_KEY`, `OPENAI_MODEL` (default: `gpt-4o-mini`)
- `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL` (default: `claude-3-5-sonnet-latest`)

## Key flows (with `data-testid`s)

| Flow                     | Selectors                                                                                            |
| ------------------------ | ---------------------------------------------------------------------------------------------------- |
| Reshuffle outfit         | `select-formality`, `button-reshuffle`, `button-try-again`                                           |
| Toggle AI stylist        | `button-toggle-ai-stylist`, `badge-recommendation-source`, `text-ai-fallback`                         |
| Mark outfit as worn      | `button-mark-worn` → invalidates `/api/items`, `/api/wears`, `/api/stats`, `/api/recommend`           |
| Weather                  | `input-weather-temp`, `select-weather-condition`, `input-weather-city`, `button-save-weather`, `button-refresh-live-weather` |
| Filter wardrobe          | `filter-all`, `filter-shirt`, `filter-pants`, …, `input-search`                                       |
| Add item (dialog)        | `button-add-item` → `input-name`, `select-category`, `select-formality-form`, `input-color-hex`, …    |
| Delete item              | `button-delete-{id}` (visible on card hover)                                                          |
| Dashboard KPIs           | `kpi-total`, `kpi-active`, `kpi-outfits`, `kpi-underused`                                             |

## QA performed

- Type-check: `npx tsc --noEmit` passes after AI recommender additions.
- Production build: `npm run build` succeeds (warning is the standard chunk-size note).
- Playwright (desktop 1280×900, mobile 375):
  - Today, Wardrobe, Dashboard render correctly.
  - Mark-as-worn updates DB (toast + `wear_count` increments).
  - Add-item flow inserts row and refreshes the grid.
  - Weather edit updates the recommendation (different palette at 88°F vs 62°F).
  - Pie chart fixed to stack column→row across breakpoints.
  - Dark mode verified.

QA screenshots saved alongside the project: `qa-today-desktop.png`, `qa-wardrobe-desktop.png`,
`qa-dashboard-desktop.png`, `qa-today-mobile.png`, `qa-wardrobe-mobile.png`,
`qa-dashboard-mobile-2.png`, `qa-today-dark.png`.

## Conventions / follow-ups

- Add new pages in `client/src/pages` and register in `client/src/App.tsx` `<Switch>` (hash routes).
- Add new API routes in `server/routes.ts` and any persistence in `server/storage.ts`.
- Schema changes go in `shared/schema.ts`; the `CREATE TABLE IF NOT EXISTS` in `storage.ts` is a
  prototype convenience — for non-trivial changes, use `npm run db:push`.
- Outfit logic is encapsulated in `server/recommender.ts` and is unit-test friendly (pure functions).
- AI styling logic is isolated in `server/aiRecommender.ts`; it validates model output and falls back
  to the rules engine.
- Railway handoff is in `RAILWAY_DEPLOY.md`.
- No `localStorage` / `sessionStorage` / cookies anywhere — sandbox-safe.

The project is ready for `deploy_website(project_path="/home/user/workspace/wardrobe-app/dist/public", ...)`
with the production server started via `start_server`.
