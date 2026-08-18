# Architecture overview

TheAlx is a UK-based art platform with a marketing site at `lax.art`, an auction product at `lax.bid`, and a planned first-party Shop at `shop.lax.art`. Behind those properties is a single source of truth for user identity, a single CRM for customer data, and a single accounting system for finances. This document explains how those pieces fit together and why each one exists.

> **Implementation status (last reviewed 2026-07-24)**
>
> - **Implemented in code:** six deployable apps (`apps/web`, `apps/api`,
>   `apps/auth`, `apps/ws`, `apps/worker`, `apps/shop-identity`) build
>   from this monorepo. Postgres role separation is wired in
>   [packages/db/src/migrate-roles.ts](../../packages/db/src/migrate-roles.ts).
>   Better Auth issues OIDC + JWT; email and finance integrations use durable
>   webhook/outbox paths described in [04-domain-events.md](./04-domain-events.md).
> - **Canonical identity:** `apps/auth` is the sole OIDC issuer. Bid and Shop are
>   confidential RP/BFFs with host-only sessions; APIs verify resource Bearer
>   tokens and do not resolve browser cookies.
> - **Async delivery (implemented, off by default):** Domain events are emitted from API/auth/worker paths; Zoho/Xero projectors and webhook processing ship **disabled by default** (`ZOHO_CRM_SYNC_MODE=off`, `XERO_PROJECTOR_MODE=off`, `WEBHOOK_EVENTS_*=false`). Cutover: [docs/runbooks/async-delivery-phase-two.md](../runbooks/async-delivery-phase-two.md). Canonical detail: [04-domain-events.md](./04-domain-events.md).
> - **Lot lifecycle ownership:** Default owner is `apps/api` (`LIFECYCLE_EXECUTION_OWNER=api`). Worker execution path exists; production cutover is staged per [docs/runbooks/worker-runtime-cutover.md](../runbooks/worker-runtime-cutover.md).
> - **Scaffolded but not exercised:** The WhatsApp notification channel throws when `ENABLE_WHATSAPP_CHANNEL` is set; UI shows "Coming soon".
> - **JWKS retirement is now scheduled** by [packages/auth/src/jwks-retirement.ts](../../packages/auth/src/jwks-retirement.ts) running inside `apps/auth` under `auth_app`, with a Postgres advisory lock so only one auth replica performs each tick.
> - **Infrastructure:** Terraform now lives in [infra/terraform/](../../infra/terraform/) and manages DigitalOcean (Postgres, Redis, App Platform, Spaces, project, monitoring) and Cloudflare (DNS, WAF, rate limits) per environment via the `persistent/` and `ephemeral/` layers. Applies run through GitHub Actions (state in DigitalOcean Spaces; no native locking).
> - **Planned:** quarterly JWKS rotation cron (the helper exists but the cron job binding is not declared), CSP enforcement flip, MFA, the v2 explicit account-link UX, and the customer-facing Shop at `shop.lax.art`.

The rest of this document describes the target shape. Where a section reads as if a feature is in production but it isn't, an inline **(Phase 2)** or **(planned)** badge marks the gap. The status block above is the canonical summary; treat it as the truth if it disagrees with prose below.

## What the system does at a high level

A user encounters TheAlx through its marketing, auction, or Shop properties. They sign in via email/password, Google, or Apple against the canonical Identity issuer. They place bids on `lax.bid`, browse art on `lax.art`, and will buy products through `shop.lax.art`. Behind the scenes, meaningful actions are captured as domain events, projected into Zoho CRM where required, and projected into Xero where money changes hands.

The architecture is deliberately simple. We could have built this with a separate identity-as-a-service vendor, an event bus, multiple databases per service, and a service mesh. We chose not to. The medium-grade tier we operate at is sized for our current traffic and the next 50× of growth without architectural changes — the things we'd need to build at hyperscale (KMS, separate databases, real event bus) are operational migrations, not rewrites of the application code.

## The six apps

Six deployable units run on DigitalOcean App Platform. Each owns one concern.
The boundary between the database-backed backends is enforced by Postgres roles;
`apps/ws` and `apps/web` carry no privileged role of their own.

### apps/auth

The OIDC issuer. It owns user identity, sessions, social provider integrations (Google, Apple), and the JWKS signing keys. The intent is that nothing else in the system talks directly to the `user`, `session`, `account`, or `jwks_key` tables — they all go through the auth app's HTTP surface. This separation matters because if `apps/api` is compromised by a SQL injection, the attacker cannot read the JWT signing key — it does not hold a Postgres role with permission to read it.

The directory exists today at [apps/auth/](../../apps/auth/) with its own
Dockerfile, env, health checks, Prometheus metrics, JWKS retirement scheduler,
and OIDC discovery + JWKS endpoints. The issuer URL
`https://auth.lax.bid` is canonical so product RPs and mobile clients retain a
stable trust anchor.

### apps/api

The HTTP backend for the auction. Bid placement, lot retrieval, payment intent creation, user profile reads, and active provider webhook ingress live here.

Today `apps/api` also runs lot-lifecycle jobs in-process by default: [apps/api/src/jobs/lot-job-scheduler.ts](../../apps/api/src/jobs/lot-job-scheduler.ts) constructs the `lot-lifecycle` BullMQ queue, and [apps/api/src/index.ts](../../apps/api/src/index.ts) starts both a producer (the scheduler) and a worker for that queue when `LIFECYCLE_EXECUTION_OWNER=api` (the default). A worker-owned path exists behind the same env flag; migrating production ownership to `apps/worker` is staged per [docs/runbooks/worker-runtime-cutover.md](../runbooks/worker-runtime-cutover.md). Until that cutover, `apps/api` is the default producer for `lot-lifecycle`, and a Zoho/Xero outage cannot backpressure into it because outbound integrations live entirely in `apps/worker`.

`apps/api` accepts `Authorization: Bearer` resource tokens for audience
`lax-bid-api`. `JwtAuthenticator` verifies Identity locally and
`BidContextEnrichedAuthenticator` loads Bid authorization from
`bid_user_profile`.

### apps/worker

The async work engine. The intent is that every BullMQ consumer runs here: lot lifecycle, webhook processing, the Zoho and Xero projectors that read from `domain_events`, scheduled JWKS rotation, transactional email sending, newsletter push to Zoho Campaigns, and image processing.

Today the directory exists at [apps/worker/](../../apps/worker/) with its own Dockerfile, env, Pino logger, Prometheus metrics, and graceful shutdown. It runs BullMQ workers — `webhook-events`, `validate-upload`, `image-cleanup`, `gc-pending-uploads`, `email` (with the `outbox-drain` repeatable job), `marketing-sync`, and optional finance/lifecycle queues when ownership env flags allow — plus the `domain-events` poller via [apps/worker/src/projectors/runner.ts](../../apps/worker/src/projectors/runner.ts). The email + newsletter pipeline ships behind `@auction/email`'s `IEmailService` / `IEmailSender` seams; the Postmark sender lives in `apps/worker/src/infrastructure/postmark-email.sender.ts`. Zoho and Xero projectors perform real HTTP when their modes are not `off` (default remains `off`). Lot lifecycle still defaults to `apps/api` until cutover. JWKS retirement is scheduled inside `apps/auth` (under an advisory lock) rather than the worker, which keeps `worker_app` denied on signing keys.

The worker is the only app that horizontally scales. When Zoho is rate-limiting us during a hot auction, the operational lever is to scale `apps/worker` from 1 instance to N to drain the queue faster, without touching `apps/api` and without affecting the user-facing site. When Zoho recovers, scale back down. The same lever applies to Postmark on a hot send day. This is the single biggest operational lever the medium-grade tier gives us over the simple version. Outbound CRM/accounting projection remains **off by default** until env modes are flipped per runbook.

### apps/ws

The real-time event gateway. Socket.IO over a Redis-backed pub/sub layer. It receives bid events from `apps/api` (placed via Redis pub/sub, not a direct call) and fans them out to subscribed clients so the auction page updates live for every viewer.

`apps/ws` verifies JWTs locally on the Socket.IO handshake using `jose` against
the canonical Identity JWKS, then calls `apps/api/users/me` with the same Bearer
token to load Bid-owned authorization. Cookie-only handshakes are rejected.

### apps/web

The Next.js frontend served at `lax.bid`. It is the confidential
`lax-bid-web` OIDC BFF. Identity and refresh tokens stay server-side; the browser
gets only an opaque host-only Bid cookie. The BFF exchanges for audience-bound
resource tokens before calling API or WS.

### apps/shop-identity

The executable confidential `lax-shop-web` BFF boundary for the custom Shop. It
proves authorization-code + PKCE, host-only Shop sessions, token verification,
logout/SSF receivers, and a `shop_app`-scoped local profile without importing
Bid authorization.

## External domains

Each external domain plays a different role and interacts with our backend differently.

### lax.bid (apps/web)

The auction product. Its BFF session is host-only to `lax.bid`; sharing the
registrable suffix with `auth.lax.bid` does not grant access to the Identity
cookie. Calls to `api.lax.bid` and `ws.lax.bid` use exchanged resource tokens.

### shop.lax.art (custom Shop)

The planned customer-facing first-party storefront. Marketing at `lax.art` is
initially static. Shop authenticates through `apps/auth`, keeps a host-only BFF
session and Shop-owned state in `shop_user_profile`, and exposes dedicated
back-channel logout and SSF receivers.

## How data flows: the domain events outbox

The single most important pattern in this architecture is the domain events outbox (D5, D8). Every meaningful business action in the application — a user registering, a bid being placed, a payment captured, a lot won — is recorded as a row in the `domain_events` table in the same database transaction as the entity write. This is non-negotiable. If the entity write commits, the event row commits with it. If the event row fails to write, the entity write rolls back. There is no scenario where the user is registered but the registration event was lost.

The worker app polls this table with `FOR UPDATE SKIP LOCKED` (F4) and dispatches each event to every projector that subscribes to it. The Zoho projector turns `user.registered` into a Zoho Contact, `bid.lot_won` into a Zoho Deal, and so on. The Xero projector turns `payment.captured` into a Xero invoice line. Each projector tracks its own cursor in `projector_state`, so they're independent: if the Zoho projector falls behind, it doesn't block Xero. If we add a third projector tomorrow (MailChimp, Slack notifications, internal analytics), it consumes from the same events table — no application-code change required, no fan-out logic in the bid service, no risk of forgetting to wire up a new integration.

This pattern gives us four properties: a complete audit log of everything that ever happened in the system, replayability per integration (rewind one projector's cursor and replay), zero coupling between business logic and external services, and a foundation for any future event consumer we haven't thought of yet.

> **Outbox status today.** The `domain_events` and `projector_state` tables exist with the schema described in [03-data-model.md](./03-data-model.md). Live producers emit across API/auth/worker paths; Zoho/Xero projectors and webhook processing are **implemented behind feature flags** (defaults off). See [04-domain-events.md](./04-domain-events.md) for the canonical status block, catalog, and cutover runbooks.

## What the system explicitly is not

We are deliberately not building several things that look like they belong here. They are out of scope by design and adding them prematurely would slow us down without commensurate benefit:

- A separate event bus (Kafka, NATS, SQS). The Postgres outbox table plays this role until we exceed 1M events/day, at which point we'll switch the projector polling to `LISTEN/NOTIFY` — a single-file change.
- Separate databases per service. One Postgres cluster, four least-privilege app
  roles (`auth_app`, `api_app`, `worker_app`, `shop_app`). Revisit at ~50k DAU.
- KMS for key storage. Keys live in Postgres, encrypted at rest by DO, readable only by the `auth_app` role. KMS-via-Vault is a future hardening step.
- Multi-region deployment. One London-region DO deployment plus Cloudflare in front for global edge cache. Multi-region only when measurable user latency from a non-EU continent justifies it.
- A service mesh, dedicated API gateway, or Kubernetes. App Platform absorbs all of this for our scale.
- More than the current six apps. The discipline is "no seventh app without
  written justification." Most new backend behavior belongs in an existing app
  or `apps/worker`.

The threshold for revisiting any of these is documented in [the deployment doc](./06-deployment.md) under "defer triggers."

## Where to go next

If you want to understand *why* each piece is built this way, read [decisions](./02-decisions.md). If you want to understand *how the data is laid out*, read [data model](./03-data-model.md). If you want to understand *what happens when a user clicks something*, read [identity flow](./05-identity-flow.md). If you're trying to deploy or operate the system, read [deployment](./06-deployment.md) and the [runbooks](../runbooks/).
