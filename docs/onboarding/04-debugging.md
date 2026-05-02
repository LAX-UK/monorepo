# Debugging — common gotchas

The list below is the curated set of things that have actually surprised people. Add to it whenever you spend more than 30 minutes on a problem that someone else could have warned you about.

## Local dev

**`pnpm install` fails on macOS with an `EPERM` error.** Usually a stale `.pnpm-store/` from another version. `rm -rf node_modules .pnpm-store` and re-run.

**`pnpm dev` starts but `apps/api` immediately exits.** Check that Postgres and Redis are up (`docker compose ps`). The API fails fast on missing connections.

**OIDC discovery returns `localhost:4000` even when I want `auth.lax.bid`.** The `OIDC_ISSUER_URL` env var defaults to localhost — set it explicitly in `.env` if you're testing cross-domain flows via `cloudflared tunnel`.

**Login works in `apps/web` but `apps/api` says I'm unauthenticated.** Cookie scope mismatch. In dev, the cookie is host-only on `localhost`. If you tunnel `apps/web` to a public URL but leave `apps/api` on `localhost:4000`, the cookie won't reach the API. Tunnel both, or run both behind a single reverse proxy.

**Apple Sign-In errors at startup.** If `APPLE_CLIENT_ID` is set but `APPLE_CLIENT_SECRET` is empty (or vice versa), better-auth still tries to register the provider. Either set both or unset both — see [packages/auth/src/server.ts](../../packages/auth/src/server.ts) for the conditional registration.

## Postgres roles

**`permission denied for relation jwks_key`.** You've connected as `api_app` (or `worker_app`). That's correct — the role split denies them on purpose (D2). Use `auth_app` for code that needs JWKS, or `auction_owner` for migration-time access.

**`permission denied for table <new_table>`.** You added a table without updating [packages/db/src/migrate-roles.ts](../../packages/db/src/migrate-roles.ts). Add it to the appropriate constant and rerun `pnpm db:roles`.

**Migration fails halfway through.** Drizzle does not wrap the whole batch in a transaction by default. Inspect the journal at `packages/db/drizzle/meta/_journal.json` to see what was applied, and write a compensating migration rather than editing the failed one.

## Webhooks

**Shopify HMAC verification rejects every request.** The verifier hashes the raw body, not the parsed JSON. If you've added a JSON body parser middleware ahead of the webhook route, the raw bytes are already consumed. Make sure the webhook handler reads `c.req.raw.text()` (or equivalent) before any parsing.

**The `webhook_event` row is created but the worker never processes it.** Today the API does **not** enqueue a BullMQ job after writing to `webhook_event` — the producer side of the `webhook-events` queue is **(Phase 2)**. The worker's heartbeat for that queue therefore never fires, which can also cause its `/health/ready` to flap. See [docs/architecture/02-decisions.md](../architecture/02-decisions.md) D4 for the status.

## Domain events

**My service emits a `user.registered` event but Zoho doesn't see anything.** The Zoho projector is a stub today — it returns `{ ok: true }` without making outbound HTTP calls. See [docs/architecture/04-domain-events.md](../architecture/04-domain-events.md) for the implementation status. The `domain_events` row is being written; the projector just doesn't have outbound logic yet.

**Two worker instances both process the same event.** They shouldn't — the runner uses `FOR UPDATE SKIP LOCKED`. If you see this, you've added a code path that reads `domain_events` outside the runner's transaction. Don't.

## Auth

**Why is `apps/web` checking the cookie, not the JWT?** `apps/web` is same-origin with `apps/api` and `apps/auth` (all `.lax.bid`), so the cookie is the cheaper credential. JWT verification is for cross-domain consumers (WordPress, future mobile apps, `apps/ws`). See [docs/architecture/05-identity-flow.md](../architecture/05-identity-flow.md) flow 2 for the cross-domain handshake.

**`apps/ws` sometimes accepts a cookie I expected it to reject.** `LEGACY_WS_COOKIE_RELAY` is enabled. That's intentional during the migration to JWT-only handshake (D10). Disable it in your env to test the JWT path in isolation.
