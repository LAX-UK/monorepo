# Deployment

This document describes how the system is deployed and operated in production. It covers the DigitalOcean App Platform topology, the Cloudflare edge layer, the relationship between our test and production environments, and the explicit thresholds at which we revisit architectural decisions.

If you're trying to deploy a change, the [deploy checklist runbook](../runbooks/deploy-checklist.md) is the procedure. If you're trying to understand why the deployment is shaped the way it is, this document is the rationale.

> **Implementation status (last reviewed 2026-05-05)**
>
> - **Implemented in code:** five Dockerized apps with their own entrypoints — [apps/web/Dockerfile](../../apps/web/Dockerfile), [apps/api/Dockerfile](../../apps/api/Dockerfile), [apps/auth/Dockerfile](../../apps/auth/Dockerfile), [apps/ws/Dockerfile](../../apps/ws/Dockerfile), [apps/worker/Dockerfile](../../apps/worker/Dockerfile). Production migration runner at [packages/db/src/migrate-prod.ts](../../packages/db/src/migrate-prod.ts) (`pnpm db:migrate:prod`). Email pipeline (Postmark transactional + Zoho Campaigns one-way newsletter push) wired through `apps/auth`, `apps/api`, and `apps/worker` with the `email` and `marketing-sync` BullMQ queues — see [../integrations/email.md](../integrations/email.md).
> - **Implemented in IaC:** the full topology now lives in [infra/terraform/](../../infra/terraform/), split into `bootstrap/` (manual one-time, see [BOOTSTRAP.md](../../infra/terraform/BOOTSTRAP.md)), `persistent/<env>/` (DNS, Cloudflare zone settings, projects, Spaces media bucket, Sentry projects), and `ephemeral/<env>/` (Postgres cluster + RBAC, Redis cluster, App Platform components and pre-deploy Job, monitoring, Sentry alerts, Cloudflare rate limits and WAF rules — including `/webhooks/postmark`, `/api/auth/sign-up`, `/api/auth/send-verification-email`). Applies run through GitHub Actions (state in DigitalOcean Spaces; production apply requires the typed `APPLY-PROD` confirmation).
> - **Operational, not in repo:** the GitHub-side environment secrets (`DIGITALOCEAN_TOKEN`, `BETTER_AUTH_SECRET`, `MEDIA_SPACES_*`, OAuth/webhook secrets, Sentry tokens, JWKS snapshot keys), Apple/Google OAuth client registrations, `mail.lax.bid` SPF/DKIM/DMARC DNS verification on the Postmark side, Postmark sender domain warmup, and the manual deploy promotion gate. The numbers in the *Target instance sizing* table below are recommendations.
> - **Planned:** branch-based gated production deploys (the `main` → test → `release` → prod cadence), pre-deploy smoke tests in CI, automated drift remediation beyond the weekly drift workflow.
>
> Anywhere this document describes "instance counts" or "$ costs" as if they were declarative state, the canonical numbers live in `infra/terraform/ephemeral/<env>/main.tf`. Treat the prose below as the architectural rationale; treat Terraform as the source of truth for what's actually deployed.

## The deployed system at a glance

```mermaid
flowchart TB
  Users(((Users)))
  CF[Cloudflare<br/>DNS, WAF, CDN, TLS]

  subgraph DO[DigitalOcean App Platform · London region]
    direction TB
    Web[apps/web<br/>Next.js<br/>lax.bid]
    Auth[apps/auth<br/>Hono OIDC issuer<br/>auth.lax.bid]
    Api[apps/api<br/>Hono HTTP<br/>lax.bid/api]
    WS[apps/ws<br/>Socket.IO<br/>lax.bid/ws]
    Worker[apps/worker<br/>BullMQ consumer]
    Migrate[migrate Job<br/>pre-deploy]
  end

  PG[(Postgres<br/>3 roles)]
  Redis[(Redis<br/>BullMQ + pub/sub)]
  Spaces[(DigitalOcean Spaces<br/>uploads + CDN)]

  WP[lax.art<br/>WordPress · Hostgator]
  Shop[lax.shop<br/>Shopify · hosted]

  External[Zoho EU · Xero · Sentry · Google · Apple]
  Postmark[Postmark<br/>transactional + broadcast streams]
  ZohoCamp[Zoho Campaigns<br/>EU region, one-way push]

  Users -->|HTTPS| CF
  CF --> Web
  CF --> Auth
  CF --> Api
  CF --> WS

  Web --> Api
  Auth --> PG
  Auth --> Redis
  Api --> PG
  Api --> Redis
  Api --> Spaces
  WS --> Redis
  Worker --> PG
  Worker --> Redis
  Worker --> Spaces
  Worker --> External
  Worker --> Postmark
  Worker --> ZohoCamp
  Migrate --> PG

  WP -.->|OIDC| Auth
  Shop -.->|webhooks| Api
  External -.->|webhooks| Api
  Postmark -.->|delivery webhooks<br/>Basic Auth| Api
```

The system has five long-running components plus one pre-deploy job, all inside one App Platform app. They share a single Postgres cluster (with role separation as the security boundary), a single Redis cluster, and a DigitalOcean Space for browser-direct uploads. External integrations connect via Cloudflare in both directions: outbound calls from the worker, inbound webhooks to the API. The two email-side externals — Postmark (transactional/notification mail) and Zoho Campaigns (newsletter, one-way push) — also live behind this perimeter; Postmark posts delivery callbacks back to `apps/api` at `/webhooks/postmark` (Basic Auth), and `apps/worker` makes outbound calls to both. See [04-domain-events.md → "Email pipeline"](./04-domain-events.md#email-pipeline).

## DigitalOcean App Platform components

Each component is a separate process with its own resources, scaling, and deployment cadence. They share the same Git repo and are built from the same monorepo, but they run independently.

### apps/web

The Next.js frontend served at lax.bid. It's a TypeScript Next.js application using Tailwind for styling and the better-auth client for authentication. It talks to apps/api over HTTP and apps/auth over OIDC discovery. Static assets are served via Next.js's standalone output mode and cached at Cloudflare's edge.

Container starts with `node apps/web/.next/standalone/server.js`. Build command runs the standard Next.js production build inside Turborepo's workspace context. The Next.js app **does not currently expose `/health/live`** — the App Platform health check today is the default TCP probe on the listening port. Adding a dedicated health route is **(planned)**.

### apps/auth

The OIDC issuer per D9. It runs better-auth with the OIDC Provider plugin, the Google and Apple social provider plugins, and a custom JWKS endpoint backed by the `jwks_key` table. It exposes `/.well-known/openid-configuration`, `/.well-known/jwks.json`, `/.well-known/apple-developer-domain-association.txt`, and `/api/auth/*` for sign-in flows and token issuance.

The auth server is the only component with direct read access to the JWKS private keys via the `auth_app` Postgres role. No other component can read those keys — that's the security boundary that the role split enforces (D2). `apps/auth` also runs the JWKS retirement scheduler ([packages/auth/src/jwks-retirement.ts](../../packages/auth/src/jwks-retirement.ts)) under a Postgres advisory lock so only one auth replica retires expired keys per tick.

`apps/auth` also holds a Redis connection so the Better Auth `sendVerificationEmail`, `sendResetPassword`, and `databaseHooks.user.create.after` hooks can call `IEmailService.enqueue()`, which inserts an `email_outbox` row and pushes a job onto the `email` BullMQ queue for `apps/worker` to drain. The role grants required for that path (`auth_app` `INSERT, SELECT` on `email_outbox`, `SELECT` on `email_suppression`) are wired in [packages/db/src/migrate-roles.ts](../../packages/db/src/migrate-roles.ts).

Health checks: `GET /health/live` returns 200 unconditionally; `GET /health/ready` validates DB connectivity and the ability to load JWKS keys ([apps/auth/src/index.ts](../../apps/auth/src/index.ts)).

`apps/auth` is a deployable today, but `apps/api` still serves the same OIDC routes in parallel (D7). The Cloudflare CNAME for `auth.lax.bid` may point to either component without consumers seeing a difference. Removing the duplicate routes from `apps/api` is **(Phase 2)**, gated on the WordPress relying-party round-trip test.

### apps/api

The HTTP backend for the auction. It owns bid placement, lot retrieval, payment intent creation, user profile, and the inbound webhook surface. The intent is that it owns no background work — but **today it also runs the lot lifecycle BullMQ worker in-process** ([apps/api/src/index.ts](../../apps/api/src/index.ts), [apps/api/src/jobs/lot-job-scheduler.ts](../../apps/api/src/jobs/lot-job-scheduler.ts)). Migrating `LotJobScheduler` into `apps/worker` is **(Phase 2)**.

It uses the `api_app` Postgres role, which has full access to most public tables, read-only access to `user`, and no access at all to `jwks_key`, `session.token`, `account`, the `oauth_*` tables, or `verification` (see [packages/db/src/migrate-roles.ts](../../packages/db/src/migrate-roles.ts) — the `API_DENY_TABLES` array). It validates Bearer tokens locally via `jose`'s `createRemoteJWKSet` against the JWKS endpoint, with library-default cache (`cacheMaxAge: 600000`) and cooldown (`cooldownDuration: 30000`).

The `CompositeAuthenticator` (D10) accepts both cookie sessions (for same-origin web app traffic) and Bearer tokens (for cross-domain consumers).

Health checks: `GET /health/live` and `GET /health/ready` ([apps/api/src/app.ts](../../apps/api/src/app.ts)). Pino-formatted logs with request-id propagation, and a `/metrics` endpoint exposing Prometheus default metrics plus HTTP histograms ([apps/api/src/middleware/metrics.ts](../../apps/api/src/middleware/metrics.ts)).

### apps/ws

The Socket.IO real-time gateway. Bid events placed via apps/api are published to a Redis pub/sub channel; ws subscribes to that channel and fans out events to connected clients via Socket.IO. ws verifies JWTs locally on the Socket.IO handshake using JWKS ([apps/ws/src/services/jwt-verifier.ts](../../apps/ws/src/services/jwt-verifier.ts)). It also still falls back to a cookie relay against `apps/api/users/me` when `LEGACY_WS_COOKIE_RELAY` is enabled — removing that fallback is **(Phase 2)**.

The Redis pub/sub bridge means ws and api never call each other directly outside the legacy relay. Their only shared state is Redis. This makes ws horizontally scalable independently of api: more concurrent socket connections means more ws instances, no api impact.

Health checks at `GET /health/live` and `GET /health/ready` ([apps/ws/src/index.ts](../../apps/ws/src/index.ts)). Sticky sessions need to be configured at the App Platform load balancer so a given client stays connected to the same ws instance for the duration of the connection — this is **(operational, not in repo)**.

### apps/worker

BullMQ consumer for asynchronous work. Today it runs six queues plus the `domain_events` polling runner ([apps/worker/src/index.ts](../../apps/worker/src/index.ts), [apps/worker/src/projectors/runner.ts](../../apps/worker/src/projectors/runner.ts)):

- **`webhook-events`** — consumer wired but the `apps/api` producer is **(Phase 2)**, so the queue is idle today.
- **`validate-upload`** ([apps/worker/src/jobs/validate-upload.ts](../../apps/worker/src/jobs/validate-upload.ts)) — HEADs and sniffs Spaces objects before users can attach them.
- **`image-cleanup`** ([apps/worker/src/jobs/image-cleanup.ts](../../apps/worker/src/jobs/image-cleanup.ts)) — deletes orphaned objects when their `upload_object` row is removed.
- **`gc-pending-uploads`** — hourly repeatable job that deletes stale pending rows/objects.
- **`email`** ([apps/worker/src/jobs/send-email.ts](../../apps/worker/src/jobs/send-email.ts)) — claims `email_outbox` rows and dispatches via the configured `IEmailSender` (`PostmarkEmailSender` in production, `ConsoleEmailSender` in dev), plus the `outbox-drain` repeatable job that re-enqueues stale `pending` rows every 60s.
- **`marketing-sync`** ([apps/worker/src/jobs/zoho-campaigns-sync.ts](../../apps/worker/src/jobs/zoho-campaigns-sync.ts)) — pushes one row at a time to Zoho Campaigns.

The `domain_events` runner only advances the `zoho` cursor today; the Zoho/Xero projectors are pure mapping helpers without outbound HTTP — turning them into real CRM/accounting calls is **(Phase 2)**. Migrating `lot-lifecycle` from `apps/api` is also **(Phase 2)**. JWKS retirement intentionally runs in `apps/auth`, not the worker, so `worker_app` remains denied on signing keys.

It uses the `worker_app` Postgres role, which has `SELECT` on `user` and `domain_events`, `SELECT, UPDATE` on `email_outbox` and `newsletter_signup_log` (so it can drain the outbox without polluting the audit trail with new inserts), and full access to `projector_state`, `webhook_event`, and `upload_object`. Identity tables and signing keys are denied. Outbound calls to Zoho, Xero, Postmark, Zoho Campaigns, and Sentry are made from this component only — `apps/api` never calls these directly.

Health checks: `GET /health/live` and `GET /health/ready`. Readiness checks Redis ping plus heartbeat keys per queue (each BullMQ worker writes a heartbeat on job completion, and the `domain_events` runner heartbeats every poll). The check has a 60-second grace period after startup; a long-idle queue can briefly look unready until the first heartbeat lands.

### migrate (pre-deploy Job)

A one-shot DigitalOcean Job that runs before each production deploy. It executes `pnpm db:migrate:prod` using the privileged owner connection URI held in `DATABASE_URL_OWNER` (the `auction_owner` Postgres user), which is never available to any long-running process. This is the only place that DDL grants are exercised per F2. The runner is [packages/db/src/migrate-prod.ts](../../packages/db/src/migrate-prod.ts) and applies migrations followed by [migrate-roles.ts](../../packages/db/src/migrate-roles.ts) so the `auth_app`/`api_app`/`worker_app` grants stay current.

`apps/api`'s container entrypoint **does not run migrations** — only the dedicated job does. If migrations fail, the deploy aborts before any new container starts. App Platform's pre-deploy Job semantics handle this — the live deployment continues serving traffic while we figure out why the migration failed.

The job binding (App Platform's `pre_deploy` configuration, the `DATABASE_URL_OWNER` env binding, etc.) is declared in the `digitalocean-app` module under [infra/terraform/modules/digitalocean-app/](../../infra/terraform/modules/digitalocean-app/).

## The Cloudflare layer

Cloudflare sits in front of everything. It does DNS, WAF, rate limiting, edge caching, and TLS termination. The full-strict TLS posture (D38) means the connection from user to Cloudflare is HTTPS and the connection from Cloudflare to our origin is also HTTPS with origin certificate verification.

Specific Cloudflare configurations that matter architecturally:

**Cache TTL on `/.well-known/*` is 60 seconds** per D2/Q36. Discovery and JWKS endpoints are intentionally cacheable so we're not absorbing 1000 req/s on every key rotation. The 60-second TTL is the lower bound that bounds key-rotation propagation latency.

**Rate limit on `/api/auth/sign-up` and `/api/auth/send-verification-email`** is the single edge rate-limit rule we run today. Both endpoints can be abused to enumerate addresses or burn our Postmark sending reputation, so they share the highest-priority edge slot. They sit in one Cloudflare rule with the most-restrictive per-IP bucket — see [../integrations/cloudflare.md](../integrations/cloudflare.md).

**Why only one edge rule?** `lax.bid` is on the Cloudflare Free plan, which caps the `http_ratelimit` phase at a single rule per zone. Production protection takes that slot; everything else is rate-limited at the app layer.

**Rate limit on `/api/auth/sign-in/*` is 5 attempts per 15 minutes per IP** per Q37. Bounds password-spray attempts. Legitimate users rarely retry sign-in more than two or three times. This runs in the auth app, not at the edge.

**Rate limit on `/webhooks/*` (incl. `/webhooks/postmark`) and `/.well-known/*`** runs at the app layer (`apps/api/src/middleware/rate-limit.ts`) on Free. Shopify, WordPress, Xero, and Postmark each fire from their own IP ranges, so per-source limits are still meaningful from origin. When the zone moves to Cloudflare Pro, the per-path edge rules will be restored — see [../integrations/cloudflare.md](../integrations/cloudflare.md).

**Cache on `/.well-known/*`** still happens at Cloudflare per D2/Q36, so steady-state read traffic is absorbed at the edge regardless of which layer holds the rate-limit rule.

**WAF challenges non-browser User-Agent strings on `/api/auth/authorize`** per Q37. Legitimate OIDC clients sending users through this endpoint always have browsers; bots scraping authorize endpoints don't. Server-to-server endpoints like `/api/auth/token` and `/.well-known/*` skip this check because they're explicitly machine-to-machine.

## Test versus production environments

The medium-grade tier deliberately runs the same security configuration in test as in production. The differences are about size and HA, not posture.

The table below summarises the **target sizing**. The authoritative numbers live in `infra/terraform/ephemeral/<env>/main.tf` — when there's a disagreement, Terraform wins.

| Component | Test (target) | Production (target) |
|---|---|---|
| Postgres | db-s-1vcpu-1gb, 1 node | db-s-2vcpu-4gb, 2 nodes (HA) |
| Redis | db-s-1vcpu-1gb | db-s-1vcpu-2gb |
| App instance size | basic-xxs | professional-xs |
| HTTP service instance count | 1 | 2 (HA) |
| Worker instance count | 1 | 1 (scale by apply during incidents) |
| Domain | test.lax.bid + test.auth.lax.bid | lax.bid + auth.lax.bid |
| Cookie domain | .test.lax.bid | .lax.bid |
| Backup retention | 7 days | 30 days |
| Cloudflare WAF strict rules | enabled | enabled |
| Log level | debug | info |
| Git branch (deploy source) | `main` | `release` |

The principle is: "it works in test" should mean "it works behind the same security posture as production." We don't skimp on TLS, WAF, or rate limits in test. We do skimp on instance count and storage, because test traffic is artificial and small.

**The branch-based deploy gate (`main` → test, `release` → production) is the target.** As of this writing, both deploys come from the same branch and the production gate is manual.

## Deferral triggers

The architectural decisions in this system are sized for the medium-grade tier with explicit thresholds at which we revisit them. None of these triggers are blocking concerns today; they're the operational early-warning system.

| Trigger | What we do when it fires |
|---|---|
| Sustained DAU > 50,000 | Revisit per-app database split (D2 currently uses one cluster with three roles) |
| domain_events > 1M rows/day | Switch projector polling to Postgres LISTEN/NOTIFY (D8 single-file change) |
| Worker queue depth > 1,000 sustained | Add a second worker instance, possibly sharded by job type |
| Postgres CPU > 80% sustained | Add read replica for analytics-style queries; possibly split out a read-only `api_app_read` role |
| Auth incident requiring forensic isolation | Trigger D7 extraction of apps/auth into its own deployment (DNS-only cutover per D9) |
| p95 API latency > 300ms sustained | Profile and optimize hot paths; consider edge caching for read endpoints |
| Multi-region user latency complaints | Add a US-region App Platform deployment with database replication |
| Second backend engineer hired | Reconsider service mesh, distributed tracing, additional observability tooling |
| Zoho rate-limit pressure during normal load | Stop pushing milestone events; reconsider whether Zoho is the right CRM |
| 100 GB+ in domain_events | Implement monthly archive to DigitalOcean Spaces, retain on disk for last 90 days |

The "what we do" column is deliberately specific. Each trigger has a known response, and the response is documented elsewhere — typically in a runbook. Crossing a trigger is not a five-week architecture project; it's a planned operational migration with a documented procedure.

## Deployment cadence

Terraform applies and App Platform deploys both run through GitHub Actions. State lives in the versioned `lax-tf-state` DigitalOcean Space (no native locking, so applies are serialised by the workflow). Production Terraform applies require the typed `APPLY-PROD` confirmation; production app deploys use `doctl apps create-deployment` against the `DO_PROD_APP_ID` secret.

The migration Job runs as part of every deploy. If migrations fail, the deploy aborts and the previous version stays live.

The branch-based gated cadence (`main` → test, `release` → prod with human approval between) is **(planned)** — see the deploy checklist for the manual gate today.

The end-to-end deploy procedure is in [deploy-checklist.md](../runbooks/deploy-checklist.md). Read it before doing your first production deploy.

## Cost shape

Order-of-magnitude cost estimates for steady-state operation, treated as expectations rather than optimization targets — the architecture is sized to be operable by a small team. The line items below are reconstructable from `infra/terraform/ephemeral/<env>/main.tf` (Postgres + Redis cluster sizes, App Platform `instance_size_slug` and `instance_count`).

Production runs roughly $220/month at zero traffic: $60 for Postgres HA, $20 for Redis, $5 per running app component (~$50 for the five components × two instances each), plus Cloudflare ($20 for the Pro plan with WAF), Sentry ($26 team plan), and DigitalOcean Spaces for state and archives ($5).

Test runs roughly $60/month: $15 single-node Postgres, $15 Redis, $25 for App Platform basic-xxs instances (5 × $5), plus a slice of the shared Cloudflare and Sentry plans.

Traffic adds App Platform bandwidth charges ($0.01/GB outbound), Postgres compute under high load (negligible at our scale), and Cloudflare bandwidth (free up to 10TB/month on Pro). Realistic monthly cost at 10k DAU is ~$300/month total across both environments.

## What's deliberately not deployed

Per the medium-grade tier, several things you'd see in a hyperscale deployment do not exist in our setup. They are documented out of scope so engineers do not waste time wondering if they were forgotten:

A separate API gateway (Kong, Traefik) — Cloudflare plays this role. A service mesh (Istio, Linkerd) — five components is below the threshold where mesh value exceeds setup cost. Kubernetes — App Platform absorbs orchestration. A managed event bus (Kafka, NATS, SQS) — the Postgres outbox plays this role until 1M events/day. KMS for key storage — keys live in Postgres encrypted at rest, with role-based access. Multi-region deployment — single London region with Cloudflare edge cache. A separate observability stack (Prometheus + Grafana + Loki) — DO's built-in monitoring plus Sentry is sufficient at this scale. A dedicated build server — App Platform builds in-place from Git.

The defer triggers above are the explicit conditions under which any of these become candidates for the next architectural iteration.

## Where to look in the code

Application Dockerfiles live next to their source: [apps/auth/Dockerfile](../../apps/auth/Dockerfile), [apps/api/Dockerfile](../../apps/api/Dockerfile), [apps/worker/Dockerfile](../../apps/worker/Dockerfile), [apps/ws/Dockerfile](../../apps/ws/Dockerfile), [apps/web/Dockerfile](../../apps/web/Dockerfile).

The production migration runner is [packages/db/src/migrate-prod.ts](../../packages/db/src/migrate-prod.ts), invoked by `pnpm db:migrate:prod`. Role grants are applied by [packages/db/src/migrate-roles.ts](../../packages/db/src/migrate-roles.ts) (`pnpm db:roles`).

Health check endpoints are mounted in each app's main entrypoint: [apps/api/src/app.ts](../../apps/api/src/app.ts), [apps/auth/src/index.ts](../../apps/auth/src/index.ts), [apps/ws/src/index.ts](../../apps/ws/src/index.ts), [apps/worker/src/index.ts](../../apps/worker/src/index.ts).

Env-var inventory: [.env.example](../../.env.example) lists the development variables, [.env.production.example](../../.env.production.example) lists the production-shaped variables (with `DATABASE_URL_OWNER`, the per-role URLs, social provider creds, webhook secrets, Sentry DSNs, and Cloudflare/Cookie domain config).

**Deployment configuration:** [infra/terraform/](../../infra/terraform/) is the source of truth — `bootstrap/` for one-time manual prep ([BOOTSTRAP.md](../../infra/terraform/BOOTSTRAP.md)), `persistent/<env>/` for resources that survive teardown, `ephemeral/<env>/` for the rebuildable application surface, and `modules/` for the reusable components (`cloudflare-domain`, `digitalocean-app`, `digitalocean-project`, `digitalocean-spaces`, `monitoring`, `postgres-cluster`, `postgres-rbac`, `redis-cluster`, `sentry-alerts`, `sentry-projects`).
