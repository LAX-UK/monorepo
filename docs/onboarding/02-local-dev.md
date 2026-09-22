# Local development

The full local-dev guide is [docs/development.md](../development.md) at the repo root. This page is the onboarding-flavored summary; it tells you what to do, and the development guide tells you why.

## Quickstart

```bash
nvm use
pnpm install
cp .env.example .env
docker compose up -d postgres redis
pnpm db:migrate
pnpm db:roles
pnpm db:seed
pnpm dev
```

`pnpm dev` runs all six apps under Turbo. The first run takes a couple of minutes because each app builds its TypeScript on first start.

## Hosts and ports

| App | URL | Notes |
|---|---|---|
| `apps/web` | http://localhost:3000 | Next.js |
| `apps/api` | http://localhost:3001 | Hono auction API and inbound webhooks |
| `apps/ws` | http://localhost:3002 | Socket.IO |
| `apps/auth` | http://localhost:3003 | Canonical Hono OIDC issuer and auth routes |
| `apps/worker` | http://localhost:3004 (`/health/live`, `/health/ready`, `/metrics` only) | BullMQ consumer + projector runner |
| `apps/shop-identity` | http://localhost:3010 | Executable Shop OIDC/BFF boundary |
| `apps/shop-api` | http://localhost:3011 | Shop catalogue API |
| `apps/shop` | http://localhost:3020 | Shop storefront (Next.js) |

Each app's port comes from its env file; the defaults above are what's wired in `.env.example` (`PORT`, `WS_PORT`, `WORKER_PORT`; `apps/auth` uses its own `PORT` default of 3003).

## Shop-only stack (storefront + auth)

Browse catalogue without the full Bid stack:

```bash
docker compose up -d postgres redis
pnpm db:migrate
pnpm db:seed
pnpm shop:auth:preflight   # validates secrets + provisions lax-shop-web OIDC client
pnpm dev:shop              # auth :3003, shop-identity :3010, shop-api :3011, shop :3020
```

Automated Shop OIDC round trip (requires `SHOP_OIDC_TEST_EMAIL` / `SHOP_OIDC_TEST_PASSWORD` in `.env`, seeded user works):

```bash
pnpm shop:auth:test
```

Set `OIDC_CLIENT_SECRET`, the canonical Auth app's `SESSION_SECRET` (≥32
chars), `OIDC_POST_LOGOUT_REDIRECT_URI=http://localhost:3020/`, and
`SHOP_STOREFRONT_URL=http://localhost:3020` in `.env` before preflight. Shop
Identity sessions are opaque PostgreSQL records and do not use a separate
session-signing secret.

## Testing OAuth callbacks locally

Google and Apple require HTTPS callback URLs. The simplest way to test these flows is `cloudflared tunnel` against your local `apps/auth`:

```bash
cloudflared tunnel --url http://localhost:3003
```

Use the resulting `*.trycloudflare.com` URL as the callback URL in the Google/Apple developer consoles for a temporary test client. Don't reuse production client credentials — use the dev clients documented in 1Password.

If you don't have Google/Apple test creds set in `.env`, the providers are simply not registered (see [packages/auth/src/server.ts](../../packages/auth/src/server.ts) — registration is conditional on env). You can develop everything else without them.

## Running tests

```bash
pnpm test            # vitest across all workspaces
pnpm typecheck       # tsc -b
pnpm lint            # biome check
```

CI runs all three in parallel; local pre-push should at least run typecheck.

## Troubleshooting

If something doesn't work, [04-debugging.md](./04-debugging.md) has the common gotchas.
