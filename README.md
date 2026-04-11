# Auction monorepo

Turborepo + pnpm. **API** (`apps/api`, Hono), **WebSocket gateway** (`apps/ws`, Socket.IO + Redis), **Web** (`apps/web`, Next.js placeholder). Shared: `packages/db`, `packages/auth`, `packages/types`, `packages/validators`.

## Local setup (Node on host)

1. **Infra only:** `docker compose up -d postgres redis`  
   **Or full stack:** `docker compose up -d` (builds API + WS images — run DB migrations before traffic).
2. `cp .env.example .env` and set `BETTER_AUTH_SECRET` (≥16 characters).
3. `pnpm install`
4. `export DATABASE_URL=postgresql://postgres:postgres@localhost:5432/auction` then `pnpm db:migrate` (runs `packages/db/src/migrate.ts`). For Drizzle Kit’s CLI instead, use `pnpm --filter @auction/db db:migrate:kit`.
5. `pnpm turbo run dev --parallel`

| Service | URL | Notes |
|--------|-----|--------|
| API | http://localhost:3001 | `/health`, `/auctions`, `/bids`, `/users/me`, `/api/auth/*` |
| WS | http://localhost:3002 | Rooms + Redis fan-out |
| Web | http://localhost:3000 | Minimal shell; UI later |

**Typed client:** `apps/web/src/lib/hc.ts` uses Hono `hc<AppType>` with `AppType` from `@auction/api/app`.

**Real-time:** API publishes to Redis `auction:{id}:events`; `apps/ws` bridges to Socket.IO (`bidUpdate`, `auctionExtended`).

**SOLID:** Auction strategies, `IRepositoryFactory`, repository interfaces, `IAuthenticator`, `NotificationService`, composition roots (`apps/api/src/container.ts`, `apps/ws/src/container.ts`).

## Docker

- `apps/api/Dockerfile` and `apps/ws/Dockerfile` — run with `tsx` against workspace sources.
- `.dockerignore` excludes `node_modules` and build artifacts.

## Scripts

`pnpm build` · `pnpm typecheck` · `pnpm db:generate` · `pnpm db:migrate`
