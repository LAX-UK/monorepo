# Auction monorepo

Turborepo + pnpm. Five Node.js apps, a ClamAV malware-scan service, and seventeen shared packages.

| App | Stack | Role |
|---|---|---|
| `apps/web` | Next.js 15 + React 19 | Marketing + dashboard frontend (lax.bid) |
| `apps/api` | Hono on Node | HTTP backend: auctions, bids, payments, webhooks |
| `apps/auth` | Hono + Better Auth | OIDC issuer (auth.lax.bid), JWKS, social providers |
| `apps/ws` | Socket.IO + Redis | Real-time bid/lot fan-out |
| `apps/worker` | BullMQ + Hono | Async jobs: email outbox, image validation, projectors, GC, marketing-sync |
| `apps/clamav` | ClamAV REST (`ajilaag/clamav-rest`) | Internal malware scanning for Source-of-Funds document uploads (`/v2/scan` on port 9000); worker-only, prod App Platform |

Shared workspaces (`packages/`):

| Package | Role |
|---|---|
| `auth` | Better Auth wrapper (server/client/permissions) |
| `branding` | Design tokens |
| `config-biome` | Shared Biome config |
| `config-ts` | Shared TypeScript config |
| `connect` | Stripe Connect shared types/helpers |
| `db` | Drizzle schema, migrations, role grants, seed |
| `domain` | Pure business rules (transitions, reserve, money compare) |
| `email` | React Email templates + outbox service |
| `exports` | CSV/export utilities |
| `http-headers` | Shared HTTP header constants |
| `marketing-events` | Meta CAPI / marketing event publishing |
| `observability` | Sentry/metrics shared setup |
| `queues` | BullMQ queue registry, producers, mutation policy |
| `sms` | Twilio Verify SMS service |
| `types` | Shared TypeScript types |
| `ui` | Canonical shadcn/Radix primitives |
| `validators` | Zod schemas, request DTO parsers, policy helpers |

## Local setup (Node on host)

1. **Infra only:** `docker compose up -d postgres redis`
   **Or full stack:** `docker compose up -d` (builds images; the `migrate` service runs SQL migrations against the compose Postgres **before** `api` starts).
2. `cp .env.example .env` and set `BETTER_AUTH_SECRET` (≥16 characters).
3. `pnpm install`
4. Put `DATABASE_URL` in the repo root `.env` (see `.env.example`). Migrate and seed **do not** read `.env` by themselves — export it first, e.g. `set -a && source .env && set +a`, then `pnpm db:migrate`. For Drizzle Kit's CLI instead, use `pnpm --filter @auction/db db:migrate:kit`.

   **On a server with Docker**, `DATABASE_URL` for the API is `postgres:5432` inside the network. Starting `api` already waits on a successful `migrate` run. To apply migrations again by hand (e.g. after `git pull`): `pnpm db:migrate:docker` (`docker compose run --rm migrate`). Seed: `docker compose exec -T api node packages/db/dist/seed.js`.
5. `pnpm turbo run dev --parallel`

See `docs/development.md` for OAuth callback testing with ngrok, least-privilege DB role checks, and social-provider test users.

| Service | URL | Notes |
|--------|-----|--------|
| Web | http://localhost:3000 | Next.js frontend |
| API | http://localhost:3001 | `/health`, `/lots`, `/sales`, `/bids`, `/payments`, `/users/me`, `/api/auth/*`, `/.well-known/*`, `/webhooks/*` |
| WS | http://localhost:3002 | Socket.IO rooms + Redis fan-out |
| Auth | http://localhost:3003 | OIDC issuer, JWKS, `/api/auth/*` (parallel to API today; D7 dual-stack) |
| Worker | http://localhost:3004 | `/health/live`, `/health/ready`, `/metrics` only — BullMQ consumers and projector runner |

**ClamAV (optional locally):** production worker sets `CLAMAV_URL=http://clamav:9000` through the private `LAX-UK/auction-infra` configuration. For local dev, leave `CLAMAV_HOST` / `CLAMAV_URL` unset and SoF uploads skip scanning (no-op). To exercise scanning, run the image from `apps/clamav/Dockerfile` and point the worker at `CLAMAV_URL=http://127.0.0.1:9000` or `CLAMAV_HOST=127.0.0.1` + `CLAMAV_PORT=3310`.

**Typed client:** `apps/web/src/lib/hc.ts` uses Hono `hc<AppType>` with `AppType` from `@auction/api/app`.

**Real-time:** API publishes to Redis `lot:{lotId}:events` and `user:{userId}:notifications`; `apps/ws` bridges to Socket.IO (`bidUpdate`, `lotExtended`, `lotEnded`, `userNotification`).

**SOLID:** Auction strategies, `IRepositoryFactory`, repository interfaces, `IAuthenticator` + `CompositeAuthenticator`, `NotificationService`, `IEmailService` / `IEmailSender` seams, composition roots (`apps/api/src/container.ts`).

## Docker

- `apps/api/Dockerfile`, `apps/ws/Dockerfile`, and `apps/clamav/Dockerfile` — API/WS run with `tsx` against workspace sources; ClamAV wraps `ajilaag/clamav-rest` with a pre-seeded signature DB for faster cold starts on App Platform.
- `.dockerignore` excludes `node_modules` and build artifacts.

**Migrations: `password authentication failed` on the host, but `docker compose exec postgres psql …` works:** the volume may have been initialized with a different password than `docker-compose.yml`, or another Postgres is on host `5432`. Align password inside the DB with `ALTER USER`, or use `POSTGRES_PUBLISH_PORT=5433` and `DATABASE_URL=…@localhost:5433/auction`, recreate Postgres, export `DATABASE_URL`, then `pnpm db:migrate` — or skip the host and use `pnpm db:migrate:docker`.

## Scripts

`pnpm build` · `pnpm typecheck` · `pnpm db:generate` · `pnpm db:migrate` · `pnpm db:migrate:prod` · `pnpm db:migrate:docker` · `pnpm db:seed:docker`
