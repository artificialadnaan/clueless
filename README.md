# Closet Office Atelier

Office wardrobe planner for tracking clothes, shoes, pants, shirts/tops, socks, watches, and accessories, then recommending coordinated daily outfits using live weather, recent-wear rotation, dress-code context, and an optional AI stylist.

## Features

- Wardrobe inventory with category filters, search, add item, and delete.
- Daily outfit recommendation with color, weather, recency, and formality explanations.
- Live weather lookup with manual fallback.
- Optional OpenAI or Anthropic AI stylist with rules-engine fallback.
- Dashboard for closet coverage, recent outfits, underused items, and rotation stats.
- SQLite persistence for prototype deployment.

## Local development

```bash
npm install
npm run dev
```

The app runs on port `5000` by default.

## Production build

```bash
npm run build
npm run start
```

## Environment

Copy `.env.example` to `.env` for local configuration.

For Railway, see `RAILWAY_DEPLOY.md`.

Important variables:

- `DATABASE_PATH`: SQLite path. Use `/data/data.db` with a Railway volume mounted at `/data`.
- `AI_PROVIDER`: `auto`, `openai`, or `anthropic`.
- `OPENAI_API_KEY` / `OPENAI_MODEL`: Optional OpenAI recommender.
- `ANTHROPIC_API_KEY` / `ANTHROPIC_MODEL`: Optional Anthropic recommender.

## Key files

- `server/recommender.ts`: deterministic outfit rules engine.
- `server/aiRecommender.ts`: optional OpenAI/Anthropic integration and validation.
- `server/routes.ts`: API routes, live weather, recommendations, healthcheck.
- `server/storage.ts`: SQLite persistence.
- `client/src/pages/Today.tsx`: daily outfit assistant and AI toggle.
- `client/src/pages/Wardrobe.tsx`: clothing inventory management.
- `client/src/pages/Dashboard.tsx`: stats and rotation dashboard.
