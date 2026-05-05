# Auction monorepo

Turborepo + pnpm. Five deployable apps and seven shared packages.

| App | Stack | Role |
|---|---|---|
| `apps/web` | Next.js 15 + React 19 | Marketing + dashboard frontend (lax.bid) |
| `apps/api` | Hono on Node | HTTP backend: auctions, bids, payments, webhooks |
| `apps/auth` | Hono + Better Auth | OIDC issuer (auth.lax.bid), JWKS, social providers |
| `apps/ws` | Socket.IO + Redis | Real-time bid/lot fan-out |
| `apps/worker` | BullMQ + Hono | Async jobs: email outbox, image validation, projectors, GC, marketing-sync |

Shared workspaces: `packages/db` (Drizzle schema + migrations + role grants), `packages/auth` (better-auth wrapper), `packages/email` (templates + outbox service), `packages/types`, `packages/validators` (Zod), `packages/ui` (React + Tailwind primitives), `packages/config-ts`, `packages/config-biome`.

## Local setup (Node on host)

1. **Infra only:** `docker compose up -d postgres redis`
   **Or full stack:** `docker compose up -d` (builds API + WS images — run DB migrations before traffic).
2. `cp .env.example .env` and set `BETTER_AUTH_SECRET` (≥16 characters).
3. `pnpm install`
4. Put `DATABASE_URL` in the repo root `.env` (see `.env.example`). Migrate and seed **do not** read `.env` by themselves — export it first, e.g. `set -a && source .env && set +a`, then `pnpm db:migrate`. For Drizzle Kit's CLI instead, use `pnpm --filter @auction/db db:migrate:kit`.

   **On a server with Docker**, prefer migrations inside the API container so `DATABASE_URL` matches Compose (`postgres:5432`): `docker compose up -d postgres redis api`, then `pnpm db:migrate:docker` (runs `packages/db/dist/migrate.js`). Seed the same way: `docker compose exec -T api node packages/db/dist/seed.js`.
5. `pnpm turbo run dev --parallel`

See `docs/development.md` for OAuth callback testing with ngrok, least-privilege DB role checks, and social-provider test users.

| Service | URL | Notes |
|--------|-----|--------|
| Web | http://localhost:3000 | Next.js frontend |
| API | http://localhost:3001 | `/health`, `/lots`, `/sales`, `/bids`, `/payments`, `/users/me`, `/api/auth/*`, `/.well-known/*`, `/webhooks/*` |
| WS | http://localhost:3002 | Socket.IO rooms + Redis fan-out |
| Auth | http://localhost:3003 | OIDC issuer, JWKS, `/api/auth/*` (parallel to API today; D7 dual-stack) |
| Worker | http://localhost:3004 | `/health/live`, `/health/ready`, `/metrics` only — BullMQ consumers and projector runner |

**Typed client:** `apps/web/src/lib/hc.ts` uses Hono `hc<AppType>` with `AppType` from `@auction/api/app`.

**Real-time:** API publishes to Redis `lot:{lotId}:events` and `user:{userId}:notifications`; `apps/ws` bridges to Socket.IO (`bidUpdate`, `lotExtended`, `lotEnded`, `userNotification`).

**SOLID:** Auction strategies, `IRepositoryFactory`, repository interfaces, `IAuthenticator` + `CompositeAuthenticator`, `NotificationService`, `IEmailService` / `IEmailSender` seams, composition roots (`apps/api/src/container.ts`).

## Docker

- `apps/api/Dockerfile` and `apps/ws/Dockerfile` — run with `tsx` against workspace sources.
- `.dockerignore` excludes `node_modules` and build artifacts.

**Migrations: `password authentication failed` on the host, but `docker compose exec postgres psql …` works:** the volume may have been initialized with a different password than `docker-compose.yml`, or another Postgres is on host `5432`. Align password inside the DB with `ALTER USER`, or use `POSTGRES_PUBLISH_PORT=5433` and `DATABASE_URL=…@localhost:5433/auction`, recreate Postgres, export `DATABASE_URL`, then `pnpm db:migrate` — or skip the host and use `pnpm db:migrate:docker`.

## Scripts

`pnpm build` · `pnpm typecheck` · `pnpm db:generate` · `pnpm db:migrate` · `pnpm db:migrate:prod` · `pnpm db:migrate:docker` · `pnpm db:seed:docker`
