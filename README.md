# Telia Halloween Escaperoom

Next.js (App Router) + TypeScript + Neon (Postgres) + Vercel KV.

## Kör lokalt
1) `cp .env.example .env.local` och fyll variabler.
2) `pnpm i` (eller `npm i`).
3) Init DB:
   - Se till att din Neon har `pgcrypto` aktiv: `CREATE EXTENSION IF NOT EXISTS pgcrypto;`
   - `npm run db:apply`
4) `npm run dev`
5) Öppna `http://localhost:3000`.

## Deploy
- Lägg in envs på Vercel:
  - `NEON_DATABASE_URL`
  - `KV_URL`, `KV_REST_API_URL`, `KV_REST_API_TOKEN`
  - `ADMIN_PASSWORD`
  - `APP_URL` (t.ex. din Vercel domän)
- Deploya via GitHub → Vercel.

## Flöde
- Spelare: `/` → regler + start (skapar team, startar timer).
- Spel: `/play` → ledtråd + siffra → validering, –30s vid fel, 3s cooldown.
- Slut: visar om klart + tid kvar, ej ranking.
- Admin: `/admin/login` → `/admin` för översikt.

## Data
- `teams`, `submissions`, `content_clues` i Postgres.
- Antifusk: KV set `run:codes` för att flagga återanvänd slutkod.

