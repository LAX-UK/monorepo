# Auction monorepo

Turborepo + pnpm. **API** (`apps/api`, Hono), **WebSocket gateway** (`apps/ws`, Socket.IO + Redis), **Web** (`apps/web`, Next.js placeholder). Shared: `packages/db`, `packages/auth`, `packages/types`, `packages/validators`.

## Local setup (Node on host)

1. **Infra only:** `docker compose up -d postgres redis`  
   **Or full stack:** `docker compose up -d` (builds API + WS images — run DB migrations before traffic).
2. `cp .env.example .env` and set `BETTER_AUTH_SECRET` (≥16 characters).
3. `pnpm install`
4. Put `DATABASE_URL` in the repo root `.env` (see `.env.example`). Migrate and seed **do not** read `.env` by themselves — export it first, e.g. `set -a && source .env && set +a`, then `pnpm db:migrate`. For Drizzle Kit’s CLI instead, use `pnpm --filter @auction/db db:migrate:kit`.

   **On a server with Docker**, prefer migrations inside the API container so `DATABASE_URL` matches Compose (`postgres:5432`): `docker compose up -d postgres redis api`, then `pnpm db:migrate:docker` (runs `packages/db/dist/migrate.js`). Seed the same way: `docker compose exec -T api node packages/db/dist/seed.js`.
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

**Migrations: `password authentication failed` on the host, but `docker compose exec postgres psql …` works:** the volume may have been initialized with a different password than `docker-compose.yml`, or another Postgres is on host `5432`. Align password inside the DB with `ALTER USER`, or use `POSTGRES_PUBLISH_PORT=5433` and `DATABASE_URL=…@localhost:5433/auction`, recreate Postgres, export `DATABASE_URL`, then `pnpm db:migrate` — or skip the host and use `pnpm db:migrate:docker`.

## Scripts

`pnpm build` · `pnpm typecheck` · `pnpm db:generate` · `pnpm db:migrate` · `pnpm db:migrate:docker` · `pnpm db:seed:docker`
