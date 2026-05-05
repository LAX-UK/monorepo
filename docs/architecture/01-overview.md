# Architecture overview

TheAlx is a UK-based art auction platform operating at three internet-facing properties: a marketing landing page (lax.art), the auction itself (lax.bid), and a Shopify-hosted commerce storefront (lax.shop). Behind those three domains is a single source of truth for user identity, a single CRM for customer data, and a single accounting system for finances. This document explains how those pieces fit together and why each one exists.

> **Implementation status (last reviewed 2026-05-05)**
>
> - **Implemented today:** five Hono/Next apps (`apps/web`, `apps/api`, `apps/auth`, `apps/ws`, `apps/worker`) build and deploy from this monorepo. Postgres role separation (`auth_app`, `api_app`, `worker_app`) is wired in [packages/db/src/migrate-roles.ts](../../packages/db/src/migrate-roles.ts). The `domain_events`, `projector_state`, `webhook_event`, `jwks_key`, `external_accounts`, and `oauth_*` tables exist with their indexes. Better-auth issues OIDC + JWT, social providers Google + Apple register conditionally on env, the `CompositeAuthenticator` is bound, and Shopify/WordPress webhook ingest writes to `webhook_event`. The email pipeline (Postmark for transactional/notification mail, Zoho Campaigns for one-way newsletter push) is wired through `@auction/email`, the `email` and `marketing-sync` BullMQ queues, the `/webhooks/postmark` ingest, and HMAC-signed List-Unsubscribe tokens — see [04-domain-events.md → "Email pipeline"](./04-domain-events.md#email-pipeline).
> - **Dual-stack today, single-stack later:** `apps/auth` exists as its own deployable, but `apps/api` still serves `/.well-known/openid-configuration`, `/.well-known/jwks.json`, and `/api/auth/*` in parallel. WordPress and other relying parties can target either today; D7's "extract on friction" is partly done.
> - **Scaffolded but not exercised:** `DomainEventPublisher` is wired into the container but no service calls `publish(tx, …)` yet. The Zoho/Xero domain-event projectors map and skip events but do not perform outbound HTTP. The Xero `projector_state` row is created but the runner only advances the `zoho` cursor. The `webhook-events` BullMQ queue has a consumer in `apps/worker` but no producer enqueues into it from `apps/api`. The WhatsApp notification channel is a stub that throws `NotImplementedError`.
> - **JWKS retirement is now scheduled** by [packages/auth/src/jwks-retirement.ts](../../packages/auth/src/jwks-retirement.ts) running inside `apps/auth` under `auth_app`, with a Postgres advisory lock so only one auth replica performs each tick.
> - **Infrastructure:** Terraform now lives in [infra/terraform/](../../infra/terraform/) and manages DigitalOcean (Postgres, Redis, App Platform, Spaces, project, monitoring) and Cloudflare (DNS, WAF, rate limits) per environment via the `persistent/` and `ephemeral/` layers. Applies run through GitHub Actions (state in DigitalOcean Spaces; no native locking).
> - **Planned:** quarterly JWKS rotation cron (the helper exists but the cron job binding is not declared), CSP/security-headers middleware, MFA, the v2 explicit account-link UX, and any Customer Account API integration with Shopify.

The rest of this document describes the target shape. Where a section reads as if a feature is in production but it isn't, an inline **(Phase 2)** or **(planned)** badge marks the gap. The status block above is the canonical summary; treat it as the truth if it disagrees with prose below.

## What the system does at a high level

A user encounters TheAlx through one of the three domains. They sign in once — via email/password, Google, or Apple — and that authentication is recognized everywhere. They place bids on lax.bid, browse art on lax.art, buy products on lax.shop, and from their perspective it is one experience. Behind the scenes, every meaningful action they take is captured as a domain event, projected into Zoho CRM as a unified customer record, and where money changes hands, into Xero as a financial transaction.

The architecture is deliberately simple. We could have built this with a separate identity-as-a-service vendor, an event bus, multiple databases per service, and a service mesh. We chose not to. The medium-grade tier we operate at is sized for our current traffic and the next 50× of growth without architectural changes — the things we'd need to build at hyperscale (KMS, separate databases, real event bus) are operational migrations, not rewrites of the application code.

## The five apps

Five deployable units run on DigitalOcean App Platform. Each owns one concern. The boundary between the three database-backed backends (`apps/auth`, `apps/api`, `apps/worker`) is enforced by what they're allowed to read from the database — the Postgres role split is the architectural firewall. `apps/ws` and `apps/web` carry no privileged role of their own.

### apps/auth

The OIDC issuer. It owns user identity, sessions, social provider integrations (Google, Apple), and the JWKS signing keys. The intent is that nothing else in the system talks directly to the `user`, `session`, `account`, or `jwks_key` tables — they all go through the auth app's HTTP surface. This separation matters because if `apps/api` is compromised by a SQL injection, the attacker cannot read the JWT signing key — it does not hold a Postgres role with permission to read it.

The directory exists today at [apps/auth/](../../apps/auth/) with its own Dockerfile, env, health checks, Prometheus metrics, JWKS retirement scheduler, and OIDC discovery + JWKS endpoints. **`apps/api` still serves the same OIDC routes in parallel today** — Better-auth is mounted at `/api/auth/*` and `createWellKnownRoutes` mounts the discovery and JWKS endpoints (see [apps/api/src/app.ts](../../apps/api/src/app.ts)). Per D7, this dual-stack is intentional through the WordPress relying-party round-trip test; once that passes, Cloudflare flips `auth.lax.bid` from `apps/api` to `apps/auth` and the duplicate routes on `apps/api` are removed. The issuer URL `https://auth.lax.bid` is canonical from day one regardless — Cloudflare CNAMEs the subdomain to whichever component currently serves OIDC, so the eventual cutover is DNS-only and no client (WordPress, Shopify, future mobile) breaks.

### apps/api

The HTTP backend for the auction. Bid placement, lot retrieval, payment intent creation, user profile reads, and the inbound webhook surface for external systems (Shopify, WordPress, Xero, Zoho) all live here. The longer-term split is that webhook *projection* moves out to `apps/worker` while `apps/api` retains only HTTP request handling.

Today `apps/api` also runs lot-lifecycle jobs in-process: [apps/api/src/jobs/lot-job-scheduler.ts](../../apps/api/src/jobs/lot-job-scheduler.ts) constructs the `lot-lifecycle` BullMQ queue, and [apps/api/src/index.ts](../../apps/api/src/index.ts) starts both a producer (the scheduler) and a worker for that queue. Migrating `LotJobScheduler` into `apps/worker` is **(Phase 2)**. Until that move, `apps/api` is the only producer for `lot-lifecycle`, and a Zoho/Xero outage cannot backpressure into it because outbound integrations live entirely in `apps/worker`.

The composite authenticator pattern (D10) lets `apps/api` accept either cookie sessions (for users coming through the same-origin web app) or `Authorization: Bearer` JWTs (for cross-domain consumers like the WordPress plugin). Route handlers don't know which one was used — they depend on the `IAuthenticator` interface and let the composition root pick the implementation.

### apps/worker

The async work engine. The intent is that every BullMQ consumer runs here: lot lifecycle, webhook processing, the Zoho and Xero projectors that read from `domain_events`, scheduled JWKS rotation, transactional email sending, newsletter push to Zoho Campaigns, and image processing.

Today the directory exists at [apps/worker/](../../apps/worker/) with its own Dockerfile, env, Pino logger, Prometheus metrics, and graceful shutdown. It runs six BullMQ workers — `webhook-events`, `validate-upload`, `image-cleanup`, `gc-pending-uploads`, `email` (with the `outbox-drain` repeatable job), and `marketing-sync` — plus the `domain-events` poller via [apps/worker/src/projectors/runner.ts](../../apps/worker/src/projectors/runner.ts). The email + newsletter pipeline ships behind `@auction/email`'s `IEmailService` / `IEmailSender` seams; the Postmark sender lives in `apps/worker/src/infrastructure/postmark-email.sender.ts`. What is **(Phase 2)** today: lot lifecycle still runs in `apps/api` (see above), and the domain-event projectors are stubs — `mapDomainEventToZoho` returns labels and `ZohoClient.upsert` deliberately returns `{ ok: true }` without making outbound HTTP calls. Wiring those projectors to the real Zoho/Xero CRM/accounting APIs is the next concrete work item. JWKS retirement is now scheduled inside `apps/auth` (under an advisory lock) rather than the worker, which keeps `worker_app` denied on signing keys.

The worker is the only app that horizontally scales. When Zoho is rate-limiting us during a hot auction, the operational lever is to scale `apps/worker` from 1 instance to N to drain the queue faster, without touching `apps/api` and without affecting the user-facing site. When Zoho recovers, scale back down. The same lever applies to Postmark on a hot send day. This is the single biggest operational lever the medium-grade tier gives us over the simple version, even though the outbound CRM/accounting projection surface itself is **(Phase 2)**.

### apps/ws

The real-time event gateway. Socket.IO over a Redis-backed pub/sub layer. It receives bid events from `apps/api` (placed via Redis pub/sub, not a direct call) and fans them out to subscribed clients so the auction page updates live for every viewer.

`apps/ws` already verifies JWTs locally on the Socket.IO handshake using `jose` against the JWKS endpoint (see [apps/ws/src/services/jwt-verifier.ts](../../apps/ws/src/services/jwt-verifier.ts)). It still falls back to a cookie relay against `apps/api/users/me` when `LEGACY_WS_COOKIE_RELAY` is set — see [apps/ws/src/handlers/socket-handler-registry.ts](../../apps/ws/src/handlers/socket-handler-registry.ts). Removing the relay is a flag flip plus a deploy and is **(Phase 2)** until web traffic has been observed to no longer hit it.

### apps/web

The Next.js frontend served at lax.bid. It uses better-auth's client library configured to point at `OIDC_ISSUER_URL` (the canonical auth domain), and its session cookie is scoped to `.lax.bid` so both the web origin and the auth subdomain see it. It has no special privileges — every API call it makes goes through the same authentication path as a third-party client.

## The three external domains

Each external domain plays a different role and interacts with our backend differently.

### lax.art (WordPress on Hostgator)

Pure marketing landing. WordPress with the OpenID Connect Generic plugin acts as a relying party — when a user clicks "sign in" on this domain, WordPress redirects them to `auth.lax.bid`, our OIDC server completes the auth flow (using whatever provider the user has linked), and WordPress receives an id_token signed with our key. There is no application data on this domain that the bid backend cares about. WordPress is read-only consumer of identity.

### lax.bid (apps/web)

The auction itself. This is the domain where most of the user activity happens — bids, payments, account management, art browsing for inventory we own directly. Same-origin with the auth subdomain (both share the `.lax.bid` parent), which means cookie-based sessions work normally here. JWTs are issued for cross-domain consumption only.

### lax.shop (Shopify hosted)

E-commerce for products that aren't auction lots — gallery merchandise, prints, books, gift cards. Hosted on Shopify (non-Plus assumption per Q17), so we don't control the storefront UX. Identity is stitched via webhooks: when a Shopify customer signs up on lax.shop, Shopify fires a `customers/create` webhook, our worker processes it, and we create or link an `external_accounts` row matching by email. Customers may have to sign in twice initially (once on lax.shop's Shopify-managed login, once on the bid auth flow), but their CRM record is unified.

## How data flows: the domain events outbox

The single most important pattern in this architecture is the domain events outbox (D5, D8). Every meaningful business action in the application — a user registering, a bid being placed, a payment captured, a lot won — is recorded as a row in the `domain_events` table in the same database transaction as the entity write. This is non-negotiable. If the entity write commits, the event row commits with it. If the event row fails to write, the entity write rolls back. There is no scenario where the user is registered but the registration event was lost.

The worker app polls this table with `FOR UPDATE SKIP LOCKED` (F4) and dispatches each event to every projector that subscribes to it. The Zoho projector turns `user.registered` into a Zoho Contact, `bid.lot_won` into a Zoho Deal, and so on. The Xero projector turns `payment.captured` into a Xero invoice line. Each projector tracks its own cursor in `projector_state`, so they're independent: if the Zoho projector falls behind, it doesn't block Xero. If we add a third projector tomorrow (MailChimp, Slack notifications, internal analytics), it consumes from the same events table — no application-code change required, no fan-out logic in the bid service, no risk of forgetting to wire up a new integration.

This pattern gives us four properties: a complete audit log of everything that ever happened in the system, replayability per integration (rewind one projector's cursor and replay), zero coupling between business logic and external services, and a foundation for any future event consumer we haven't thought of yet.

> **Outbox status today.** The `domain_events` and `projector_state` tables exist with the schema described in [03-data-model.md](./03-data-model.md). [apps/api/src/services/domain-event.publisher.ts](../../apps/api/src/services/domain-event.publisher.ts) implements `publish(tx, event)`. The container constructs the publisher but **no service currently calls it** — registration, bid, and payment paths emit no domain events yet. The projector runner advances only the `zoho` cursor; the `xero` row is created but not advanced. Wiring services to publish, and turning the Zoho/Xero projector stubs into real outbound calls, is the **(Phase 2)** delivery for D5/D8. Until then, treat this section as the contract this codebase is being built towards rather than a description of live behaviour. See [04-domain-events.md](./04-domain-events.md) for the catalog and the implementation guide.

## What the system explicitly is not

We are deliberately not building several things that look like they belong here. They are out of scope by design and adding them prematurely would slow us down without commensurate benefit:

- A separate event bus (Kafka, NATS, SQS). The Postgres outbox table plays this role until we exceed 1M events/day, at which point we'll switch the projector polling to `LISTEN/NOTIFY` — a single-file change.
- Separate databases per service. One Postgres cluster, three roles (`auth_app`, `api_app`, `worker_app`), least-privilege grants. Splits to per-service databases at ~50k DAU.
- KMS for key storage. Keys live in Postgres, encrypted at rest by DO, readable only by the `auth_app` role. KMS-via-Vault is a future hardening step.
- Multi-region deployment. One London-region DO deployment plus Cloudflare in front for global edge cache. Multi-region only when measurable user latency from a non-EU continent justifies it.
- A service mesh, dedicated API gateway, or Kubernetes. App Platform absorbs all of this for our scale.
- More than the current five apps. The discipline is "no sixth app without written justification." Most "I want a new microservice" instincts are better solved as a new module inside `apps/worker`.

The threshold for revisiting any of these is documented in [the deployment doc](./06-deployment.md) under "defer triggers."

## Where to go next

If you want to understand *why* each piece is built this way, read [decisions](./02-decisions.md). If you want to understand *how the data is laid out*, read [data model](./03-data-model.md). If you want to understand *what happens when a user clicks something*, read [identity flow](./05-identity-flow.md). If you're trying to deploy or operate the system, read [deployment](./06-deployment.md) and the [runbooks](../runbooks/).
