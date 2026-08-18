# Debugging — common gotchas

The list below is the curated set of things that have actually surprised people. Add to it whenever you spend more than 30 minutes on a problem that someone else could have warned you about.

## Local dev

**`pnpm install` fails on macOS with an `EPERM` error.** Usually a stale `.pnpm-store/` from another version. `rm -rf node_modules .pnpm-store` and re-run.

**`pnpm dev` starts but `apps/api` immediately exits.** Check that Postgres and Redis are up (`docker compose ps`). The API fails fast on missing connections.

**OIDC discovery returns `localhost:3001` (or `:3003`) even when I want `auth.lax.bid`.** The `OIDC_ISSUER_URL` env var defaults to localhost — set it explicitly in `.env` if you're testing cross-domain flows via `cloudflared tunnel` or `ngrok`.

**Login works in `apps/web` but `apps/api` says I'm unauthenticated.** Cookie scope mismatch. In dev, the cookie is host-only on `localhost`. If you tunnel `apps/web` to a public URL but leave `apps/api` on `localhost:3001`, the cookie won't reach the API. Tunnel both, or run both behind a single reverse proxy.

**Apple Sign-In errors at startup.** If `APPLE_CLIENT_ID` is set but `APPLE_CLIENT_SECRET` is empty (or vice versa), better-auth still tries to register the provider. Either set both or unset both — see [packages/auth/src/server.ts](../../packages/auth/src/server.ts) for the conditional registration.

## Postgres roles

**`permission denied for relation jwks_key`.** You've connected as `api_app` (or `worker_app`). That's correct — the role split denies them on purpose (D2). Use `auth_app` for code that needs JWKS, or `auction_owner` for migration-time access.

**`permission denied for table <new_table>`.** You added a table without updating [packages/db/src/migrate-roles.ts](../../packages/db/src/migrate-roles.ts). Add it to the appropriate constant and rerun `pnpm db:roles`.

**Migration fails halfway through.** Drizzle does not wrap the whole batch in a transaction by default. Inspect the journal at `packages/db/drizzle/meta/_journal.json` to see what was applied, and write a compensating migration rather than editing the failed one.

## Webhooks

**A provider signature rejects every request.** Signature schemes such as Stripe and Xero hash the raw body, not parsed JSON. Ensure the handler reads the raw request before any middleware consumes or rewrites it.

**The `webhook_event` row is created but the worker never processes it.** Check `WEBHOOK_EVENTS_ENQUEUE`, `WEBHOOK_EVENTS_PROCESS`, the `webhook-events` queue heartbeat, and the stored row's source/routing fields. The generic worker currently dispatches Xero invoice events.

## Domain events

**My service emits a `user.registered` event but Zoho doesn't see anything.** The Zoho projector is a stub today — it returns `{ ok: true }` without making outbound HTTP calls. See [docs/architecture/04-domain-events.md](../architecture/04-domain-events.md) for the implementation status. The `domain_events` row is being written; the projector just doesn't have outbound logic yet.

**Two worker instances both process the same event.** They shouldn't — the runner uses `FOR UPDATE SKIP LOCKED`. If you see this, you've added a code path that reads `domain_events` outside the runner's transaction. Don't.

## Auth

**Why does `apps/web` use a cookie while API requires JWT?** Web is the Bid
BFF. It validates an opaque host-only Bid session, keeps OIDC tokens
server-side, exchanges for `lax-bid-api` or `lax-ws`, and sends the resulting
Bearer token to the resource server. API never receives the browser session
cookie. See [Identity flow](../architecture/05-identity-flow.md).

**`apps/ws` rejects a cookie-only connection.** This is expected. Obtain the
short-lived Identity JWT and pass it as `handshake.auth.token`; WS no longer
relays browser cookies.
