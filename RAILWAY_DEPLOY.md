# Railway Deployment Handoff

This app is a fullstack Express + Vite + React wardrobe planner. Express serves both the API and the built client in production.

## Recommended Railway setup

1. Create a GitHub repo and push this project folder.
2. In Railway, create a new project and choose **Deploy from GitHub repo**.
3. Configure the service:
   - Build command: `npm run build`
   - Start command: `npm run start`
   - Healthcheck path: `/health`
4. Add variables:
   - `NODE_ENV=production`
   - `DATABASE_PATH=/data/data.db`
   - Optional AI stylist:
     - `AI_PROVIDER=auto`
     - `OPENAI_API_KEY=...` and optionally `OPENAI_MODEL=...`
     - or `ANTHROPIC_API_KEY=...` and optionally `ANTHROPIC_MODEL=...`
5. Add a Railway volume:
   - Mount path: `/data`
   - This keeps the SQLite database persistent across deploys and restarts.
6. Generate a Railway domain from the service Networking settings.

## AI recommender behavior

The app always has a deterministic rules engine in `server/recommender.ts`. The optional AI stylist is in `server/aiRecommender.ts`.

When the Today page has **AI stylist on**, it calls:

```txt
GET /api/recommend?formality=business&ai=1
```

The server:

1. Builds a safe baseline outfit with the rules engine.
2. If `OPENAI_API_KEY` or `ANTHROPIC_API_KEY` is configured, sends compact wardrobe, weather, recent-wear, and baseline context to the selected model.
3. Requires the model to return JSON with valid existing item IDs.
4. Validates required categories before using the AI result.
5. Falls back to the rules engine if no key is present, the API call fails, or the model returns invalid data.

Status endpoint:

```txt
GET /api/ai/status
```

Healthcheck endpoint:

```txt
GET /health
```

## Local commands

```bash
npm install
npm run dev
npm run build
npm run start
```

## Important files

- `server/recommender.ts` — deterministic rules engine.
- `server/aiRecommender.ts` — OpenAI/Anthropic adapter and validation layer.
- `server/routes.ts` — API routes, weather lookup, AI status, recommendation endpoint, healthcheck.
- `server/storage.ts` — SQLite storage. Uses `DATABASE_PATH` when provided.
- `client/src/pages/Today.tsx` — Today page, AI stylist toggle, recommendation display.
- `client/src/pages/Wardrobe.tsx` — add/manage wardrobe items.
- `.env.example` — variables for local and Railway setup.
