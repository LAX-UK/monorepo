# Architectural decisions

Every non-trivial architectural decision has a number that never changes. When a decision is revised, the new revision gets a new number with a "supersedes" reference — the original entry stays so we have history. Decisions are referenced by their D-number throughout the rest of the documentation and in code comments.

This document is the source of truth for *why* the system is built the way it is. If you find yourself disagreeing with one of these decisions, do not change the implementation without first proposing a new D-number with the alternative weighed against the chosen approach. Drift between this document and the code is a worse failure than a controversial decision documented honestly.

> **Convention.** Each decision below ends with a **Status** line: *Implemented*, *Partially implemented*, or *Planned*, plus a one-line citation pointing at the file path that proves it. The "Chosen / Alternatives / Why" sections describe the *target* shape; the Status line is what is true today (last reviewed 2026-05-05).

## D1. Webhook code lives in apps/api, projection logic in apps/worker

**Chosen.** Inbound HTTP handlers for Shopify, WordPress, Xero, and Zoho webhooks live in `apps/api/src/routes/webhooks/`. The handler's job is narrow: verify the signature, claim the event into `webhook_event`, enqueue a BullMQ job for `apps/worker`, return 200. Outbound projection logic — calling Zoho's API, calling Xero's API, transforming events into the shape each external service expects — lives in `apps/worker/src/projectors/`.

**Alternatives considered.** A standalone `packages/webhooks` workspace package was rejected as premature; one HTTP handler and one outbound integration do not justify the overhead of a separate package boundary. A dedicated webhook microservice was rejected as over-engineered at our scale — receiving webhooks is HTTP request handling, which `apps/api` already does well.

**Why this wins.** The HTTP request boundary is where authentication, rate limiting, and origin verification already happen — adding webhook ingest there means it inherits all of that. Splitting outbound into the worker means we can scale Zoho throughput without scaling the API, and a Zoho outage doesn't backpressure into HTTP request handlers.

**Status.** *Partially implemented.* Inbound: Shopify and WordPress handlers verify HMAC and write `webhook_event` ([apps/api/src/routes/webhooks/](../../apps/api/src/routes/webhooks/)); the Xero handler in [apps/api/src/routes/xero-webhook.ts](../../apps/api/src/routes/xero-webhook.ts) verifies signature but writes through accounting repositories rather than `webhook_event` and is therefore an exception to the unified pattern. Outbound: [apps/worker/src/projectors/zoho.ts](../../apps/worker/src/projectors/zoho.ts) and [apps/worker/src/projectors/xero.ts](../../apps/worker/src/projectors/xero.ts) exist but do not call external APIs (the Zoho client returns synthetic `{ ok: true }` payloads) — outbound projection is **(Phase 2)**.

## D2. JWKS keys live in Postgres, scoped to the auth_app role

**Chosen.** A `jwks_key` table holds the active and rotating keys: `kid` as primary key, `algorithm`, `public_jwk` (jsonb), `private_jwk` (jsonb), `status` (`active` / `rotating` / `retired`), `created_at`, `rotated_at`. The `auth_app` Postgres role is the only role with read access to the `private_jwk` column. The `api_app` role has no access to this table at all.

A retired key remains in the published JWKS for thirty minutes before deletion. The math: discovery and JWKS endpoints have a 60-second cache TTL at Cloudflare, access tokens have a 15-minute lifetime, plus a 15-minute safety margin for in-flight requests. Total `max(60s, 15min) + 15min = 30 minutes`. This constant is encoded in the rotation script and referenced from the rotation runbook — both must reference the value here, never duplicate it.

**Alternatives considered.** Storing the signing key in an environment variable was rejected because rotation requires a redeploy. Storing it in a file was rejected because DigitalOcean App Platform's filesystem is ephemeral. Using a managed KMS was rejected because DigitalOcean does not offer one and the alternatives (HashiCorp Vault, AWS KMS) introduce infrastructure we do not need at this scale.

**Why this wins.** The role split is a security boundary that matters. If `apps/api` is compromised by a SQL injection or a leaked credential, the attacker cannot read the signing key — the database role they hold does not permit it. This is the cheapest, most reliable way to bound the blast radius of a single-app compromise. The pattern matches how we already store Xero OAuth refresh tokens, so it adds zero cognitive load. Rotation is zero-downtime because new and retired keys coexist in JWKS during the transition window.

**Status.** *Implemented.* Schema in [packages/db/src/schema/jwks-key.ts](../../packages/db/src/schema/jwks-key.ts); role-scoped grants in [packages/db/src/migrate-roles.ts](../../packages/db/src/migrate-roles.ts) (`auth_app` ALL on `jwks_key`; `api_app` denied; `worker_app` denied). The 30-minute retirement helper and schedule live in [packages/auth/src/jwks-retirement.ts](../../packages/auth/src/jwks-retirement.ts), run inside `apps/auth` under `auth_app`, and use a Postgres advisory lock so only one auth replica performs each retirement tick while preserving the `worker_app` deny boundary. JWKS state is snapshotted to DigitalOcean Spaces (`secrets-backup/jwks/<env>/`) using the env-scoped encryption key set up in [BOOTSTRAP.md](../../infra/terraform/BOOTSTRAP.md).

## D3. Account linking happens at sign-in, gated on email verification

**Chosen.** When a user authenticates on any of our domains, the auth service looks up an existing user record by `email` where `email_verified = true`. If a match is found, the new authentication is recorded as a row in `external_accounts` linked to that existing user. If no match is found, a new user record is created. The verified-email gate is non-negotiable — an unverified email cannot be used to claim ownership of an existing account.

**Alternatives considered.** Lazy linking on first cross-domain visit was rejected because it delays Zoho enrichment — we want the unified customer view as soon as the second sign-up happens, not later. Explicit "Link my Shopify account" UX was rejected because it converts worse than transparent stitching and most users will never click it.

**Why this wins.** Email is the only universal identifier across WordPress users, Shopify customers, and our auction users. The verification gate is what prevents account takeover via email impersonation: if a malicious actor signs up on Shopify with a victim's email, we don't link those accounts until the victim's email has been verified on our side via a real possession check.

The Apple "Hide My Email" relay flow is a deliberate exception — see D11 for details.

**Status.** *Implemented.* The verified-email lookup and Apple-relay branch live in [apps/api/src/services/account-linking.service.ts](../../apps/api/src/services/account-linking.service.ts) and are exercised through better-auth's account-linking config in [packages/auth/src/server.ts](../../packages/auth/src/server.ts).

## D4. Shopify integration uses the hosted storefront with email-based linking

**Chosen.** Non-Plus Shopify, hosted storefront on `lax.shop` (no headless rebuild). Identity is stitched via Shopify webhooks: `customers/create` and `orders/*` fire to our `/webhooks/shopify` endpoint, which verifies the HMAC, claims the event into `webhook_event`, and enqueues a worker job. The worker's Shopify processor either creates a new user record (with `external_accounts(provider='shopify', external_id=<shopify_customer_id>)`) or links to an existing user matched by verified email per D3.

**Alternatives considered.** Shopify Multipass was rejected because it requires Shopify Plus, which costs $2,000+/month — vastly more than the engineering value it adds at our scale. Headless via the Storefront API was rejected because it forces us to rebuild the entire commerce UX, which is months of work for a feature (the storefront) where Shopify's defaults are perfectly adequate. The newer Customer Account API was deferred because it's less documented and the Multipass-replacement story is still maturing.

**Why this wins.** Cheapest path that gives us CRM-quality data unification. Customers may need to sign in twice in v1 (once on Shopify, once on our auth flow), but their identity is stitched on the backend so the CRM never has duplicate records. v2 can adopt the Customer Account API once that pattern is more proven.

**Status.** *Partially implemented.* Inbound HMAC verification and `webhook_event` ingest exist at [apps/api/src/routes/webhooks/shopify.ts](../../apps/api/src/routes/webhooks/shopify.ts). Worker-side processing of those rows — creating the user, writing the `external_accounts` link, dispatching domain events — is **(Phase 2)**: the `webhook-events` BullMQ queue has a consumer in [apps/worker/src/index.ts](../../apps/worker/src/index.ts) but no producer enqueues into it from the API yet.

## D5. Zoho writes are async via BullMQ, sourced from domain_events

**Chosen.** Application code never calls Zoho directly. Instead, every action that should reach Zoho is recorded as a row in `domain_events` in the same DB transaction as the entity write — this is the outbox pattern. A projector in `apps/worker` polls `domain_events`, dispatches each row to the Zoho projector (and to other projectors like Xero), and the projector handles the actual API call to Zoho with retries, rate limiting, and circuit breaking.

**Alternatives considered.** Synchronous HTTP calls from the request handler were rejected because they add latency to every signup and bid, and any Zoho outage would cause user-facing failures. Fire-and-forget queue jobs (without an outbox table) were rejected because they create a window where the entity write commits but the queue job is lost on crash. CDC tail of the Postgres write-ahead log was rejected as over-engineered for our scale and as introducing operational complexity (Debezium, Kafka Connect) we don't want.

**Why this wins.** Single source of truth for integrations. The `domain_events` table is the audit log of everything that ever happened. Every projector is replayable independently — rewind a cursor, restart the worker, and the missing data flows into the external system. Adding a new integration tomorrow (MailChimp, Slack notifications, internal analytics) means writing one new projector class — no application code changes, no fan-out logic in the bid service, no risk of forgetting to wire up the new integration.

This is the single highest-leverage decision in the architecture. Every other decision pays its rent because of this one.

**Status.** *Partially implemented.* `domain_events` and `projector_state` tables exist with all the columns the contract assumes (`actor_user_id`, `correlation_id`, `schema_version`). [apps/api/src/services/domain-event.publisher.ts](../../apps/api/src/services/domain-event.publisher.ts) implements `publish(tx, event)` and is wired in the container. **No service currently calls it** — registration, bid, and payment paths emit no events yet, and the projector runner only advances the `zoho` cursor. The Zoho client is a no-op stub. Wiring services to publish and turning the projectors into real outbound calls is the **(Phase 2)** delivery for D5.

## D6. Webhook authenticity verified per source, with replay window

**Chosen.** Each inbound webhook source has its own verification mechanism, all binding the signature to the raw request body to prevent tampering or replay:

Shopify uses HMAC SHA-256 of the raw body, transmitted in the `X-Shopify-Hmac-SHA256` header. This is mandated by Shopify and our verifier uses Node's `crypto.timingSafeEqual` to prevent timing-based key extraction.

WordPress uses a shared-secret HMAC of the body in `X-Thealx-Signature`. This applies only if WordPress emits events to us, which is unlikely in v1 (Q22 default treats WordPress as a pure relying party).

Zoho's inbound webhooks (if used in v2 for bidirectional sync) would use Zoho's native notification token mechanism. v1 is one-way push only.

All sources reject any payload whose timestamp is more than five minutes old, comparing against the `Date` header or a source-specific `X-*-Triggered-At` header. This bounds replay-attack windows to five minutes.

**Alternatives considered.** Mutual TLS was rejected because Hostgator (where WordPress lives) cannot terminate it cleanly and the operational cost is high. A naive shared secret in the request body without HMAC was rejected as replay-vulnerable.

**Why this wins.** Each source uses the verification primitive its platform mandates or recommends, which means we benefit from their existing tooling. The replay window is short enough to defeat practical attacks but long enough to absorb clock skew and webhook retry latency.

**Status.** *Partially implemented.* HMAC + timing-safe compare exist for Shopify ([apps/api/src/lib/shopify-hmac.ts](../../apps/api/src/lib/shopify-hmac.ts)) and WordPress ([apps/api/src/lib/wordpress-secret.ts](../../apps/api/src/lib/wordpress-secret.ts)). The 5-minute replay window check is **(planned)** — neither verifier currently enforces a `Date`/`X-*-Triggered-At` skew bound; replay protection today is the dedupe key on `webhook_event`.

## D7. apps/auth extracts only if WordPress relying-party test reveals friction

**Chosen.** OIDC routes ship inside `apps/api` in Phase 1. At the end of Phase 2, a WordPress relying-party round-trip test verifies that the OpenID Connect Generic plugin can authenticate against our endpoints end to end. If that test reveals friction — auth-burst rate limits colliding with API queries, deploy-cadence conflicts, blast-radius concerns about co-locating auth with the rest of the API surface — we extract `apps/auth` as a Phase 2 sub-phase. If the test passes cleanly, extraction is deferred one quarter and revisited.

**Alternatives considered.** Extracting upfront in Phase 1 was rejected because it costs roughly two days of work that is wasted if the friction never materializes — YAGNI applies. Never extracting was rejected because it forfeits the security boundary the medium-grade tier deliberately wants.

**Why this wins.** YAGNI-disciplined with an empirical gate. The issuer URL `https://auth.lax.bid` is canonical from day one — Cloudflare CNAMEs the subdomain to whichever component currently serves OIDC. So the eventual cutover is DNS-only, not a client migration. No OIDC consumer (WordPress plugin, Shopify integration, future mobile app) ever sees a URL change. We get the option value of extraction without paying for it upfront.

**Status.** *Partially implemented.* [apps/auth/](../../apps/auth/) exists with its own Hono server, OIDC discovery, JWKS, `/api/auth/*` proxy, health checks, and metrics. **`apps/api` still serves the same routes in parallel** — see [apps/api/src/app.ts](../../apps/api/src/app.ts) and [apps/api/src/routes/well-known.ts](../../apps/api/src/routes/well-known.ts). The relying-party gate per D7 has not yet been declared cleared, so the Cloudflare flip and removal of duplicate routes from `apps/api` remain **(Phase 2)**.

## D8. domain_events outbox uses same-transaction writes and SKIP LOCKED polling

**Chosen.** Every domain event is written in the same database transaction as the entity it describes. Application code calls `DomainEventPublisher.publish(tx, event)` inside an existing `db.transaction(...)` block — never outside it. If the transaction rolls back, the event row rolls back too. There is no scenario where the entity commits but the event is lost.

The worker reads from `domain_events` using `SELECT ... FOR UPDATE SKIP LOCKED` so multiple worker instances cannot double-process the same row. Each projector tracks its own cursor in `projector_state` (one row per projector name). The polling loop sleeps 1.5 seconds when no events are returned.

**Alternatives considered.** Post-commit publishing (write entity, commit, then publish event) was rejected because the worker process can crash between commit and publish, losing the event silently. Postgres `LISTEN/NOTIFY` was deferred — it would lower projection latency but adds reconnect-handling complexity we don't need today. We'll switch when projector lag exceeds 5 minutes or we cross 1M events/day.

**Why this wins.** Strong consistency by default. Operationally simple — there's nothing to debug except SQL. Replayable — rewind the cursor, restart the worker, and the projector recomputes everything since that point. SKIP LOCKED costs nothing on a single worker instance and makes horizontal scaling safe the moment we need it.

**Status.** *Partially implemented.* The polling SQL with `FOR UPDATE SKIP LOCKED` is in [apps/worker/src/projectors/runner.ts](../../apps/worker/src/projectors/runner.ts) and the `DomainEventPublisher.publish(tx, event)` signature exists in [apps/api/src/services/domain-event.publisher.ts](../../apps/api/src/services/domain-event.publisher.ts). The runner today only advances a single cursor (`zoho`); the `xero` row is created but never updated. No service emits events yet — same gap as D5.

## D9. The OIDC issuer URL is auth.lax.bid from day one

**Chosen.** OIDC discovery returns `"issuer": "https://auth.lax.bid"` even when the routes are physically served by `apps/api` in Phase 1. Cloudflare CNAMEs the `auth` subdomain to whichever app currently runs the OIDC routes. The issuer URL is stable across the eventual extraction (D7).

**Alternatives considered.** Issuing from `https://api.lax.bid` and renaming later was rejected because issuer changes are equivalent to a key rotation event for every consumer — every WordPress plugin, every Shopify integration, every mobile app would need to re-register and re-link. The cost is paid by every consumer, every time we change the URL.

**Why this wins.** Stability from day one is free if planned for. Renaming the issuer is the kind of decision that looks small at the time and becomes the single most regretted choice when you realize it forces every external integration to redo their config.

**Status.** *Implemented in code.* `OIDC_ISSUER_URL` is read in both [apps/api/src/env.ts](../../apps/api/src/env.ts) and [apps/auth/src/env.ts](../../apps/auth/src/env.ts), and the discovery doc returns it as the `issuer` field. The Cloudflare CNAME is **(operational, not in repo)** — no Terraform/IaC commits this in code, so it lives in DNS as configured by ops.

## D10. Authentication uses CompositeAuthenticator (cookie then Bearer)

**Chosen.** A new `CompositeAuthenticator implements IAuthenticator` is bound at the composition root. It tries cookie-based session lookup first (existing `BetterAuthAuthenticator`), and if that returns no user, falls back to verifying an `Authorization: Bearer` JWT against the JWKS endpoint using the `jose` library. Route handlers depend only on the `IAuthenticator` interface — they don't know which path produced the user.

The websocket app (`apps/ws`) migrates to JWT-only verification on the Socket.IO handshake in Phase 2, removing the legacy cookie-relay model. A `LEGACY_WS_COOKIE_RELAY` flag exists during the migration as a sunset switch.

**Alternatives considered.** Bearer-only would break the current web app's cookie-based session flow, which works perfectly for same-origin users. Cookie-only would block any cross-domain consumer (WordPress, mobile app, Shopify integration) from authenticating against our API.

**Why this wins.** Preserves the `IAuthenticator` boundary completely. No route handler changes. The composition root in `apps/api/src/container.ts` swaps a single binding to enable the composite — that's the entire ripple. This is a textbook OCP/LSP win: the same interface, two implementations selected by configuration.

**Status.** *Partially implemented.* [apps/api/src/infrastructure/composite-authenticator.ts](../../apps/api/src/infrastructure/composite-authenticator.ts) is bound in the container with `BetterAuthAuthenticator` first and `JwtAuthenticator` (jose-backed JWKS verification, library-default cache + cooldown) second. `apps/ws` already verifies JWT on the Socket.IO handshake via [apps/ws/src/services/jwt-verifier.ts](../../apps/ws/src/services/jwt-verifier.ts) but still falls back to the cookie relay against `apps/api/users/me` while `LEGACY_WS_COOKIE_RELAY` is set — see [apps/ws/src/handlers/socket-handler-registry.ts](../../apps/ws/src/handlers/socket-handler-registry.ts). Removing the legacy relay is **(Phase 2)** once web traffic has been observed not to need it.

## D11. Social login via better-auth's Google and Apple plugins, account linking enabled

**Chosen.** `packages/auth/src/server.ts` registers better-auth's `socialProviders.google` and `socialProviders.apple`. Email/password remains as a fallback credential. The `accountLinking` config is `{ enabled: true, trustedProviders: [] }`. With an empty trusted-provider list, Better Auth does not auto-link social accounts without a verified email match — Google sign-ins link when the provider returns a verified email; Apple relay emails link by `sub` via the `account` table. Email/password credential users link to social signups via the email-verification gate from D3.

**Apple "Hide My Email" handling.** Apple's privacy relay returns email addresses ending in `@privaterelay.appleid.com`. These are stable per-(app, user) pair but are not the user's real inbox. The account-linking service detects this domain when `provider='apple'` and skips the D3 email-based lookup entirely — instead, the linking happens by Apple's `sub` claim via `external_accounts(provider='apple', external_id=<sub>)`. The relay email is persisted as-is in `external_accounts.email` so we can still send transactional email through Apple's relay. This means a user who later signs in via email/password with their real address will appear as a *different* identity until they explicitly link — which is the correct privacy behavior for the user, even though it produces apparent duplicates in our database.

The same defensive pattern applies if Google ever returns a no-email signup (unusual but possible if the user has revoked email access at the provider level).

**Alternatives considered.** Rolling our own OAuth implementation was rejected — we have no business writing OAuth code. A separate identity-as-a-service (Auth0, Clerk, WorkOS) was rejected as overkill at this stage; better-auth covers our needs and we can migrate later if we outgrow it (and the OIDC issuer URL stability per D9 means that migration would not break consumers).

**Why this wins.** Apple Sign-In unblocks any future iOS App Store distribution, which is mandatory for that channel. Google covers the largest share of consumer auth. Email/password remains for users who don't want to sign in via a social provider. Better-auth's plugin model is designed for exactly this composition pattern.

**Status.** *Implemented (conditional on env).* [packages/auth/src/server.ts](../../packages/auth/src/server.ts) registers Google when both `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are set, and Apple when both `APPLE_CLIENT_ID` and `APPLE_CLIENT_SECRET` are set. `accountLinking` is `{ enabled: true, trustedProviders: [] }`. OAuth rows live in Better Auth's `account` table (not `external_accounts`).

## How to add a new decision

When you face a non-trivial architectural choice that future engineers will need to understand:

Pick the next D-number after the highest currently in this document. Write the decision in the same shape: chosen approach, alternatives considered, why this wins. Keep the alternatives section honest — list options you actually considered, not strawmen. The "why" section should cover both the upside and any meaningful downside you accepted.

If you're revising an existing decision, do not edit it. Add a new D-number with a header like "Supersedes D5 as of 2026-08-15." Link from the old decision to the new one. Both stay in this document. The git history of this file is itself a useful artifact.

Reference D-numbers in code comments where the rationale matters: `// D8: same-transaction publish required` next to a `DomainEventPublisher.publish` call is significantly more useful than reverse-engineering it from blame six months later.

## D12. Worker reuses apps/api repository factory and export providers

**Chosen.** `apps/worker` depends on `@auction/exports/providers` and `@auction/persistence` for export provider wiring and repository access. BullMQ jobs share the same repository implementations as the HTTP API rather than duplicating Drizzle access in the worker.

**Alternatives considered.** A slim `@auction/kernel` package with repositories only was deferred — the factory and provider surface is still evolving with API features, and splitting now would duplicate container wiring. Copy-pasting Drizzle queries into the worker was rejected (drift risk).

**Why this wins.** One implementation of repository contracts for API and async jobs. Worker jobs stay type-aligned with API services. The coupling cost is bounded: worker imports shared packages directly, not the full HTTP route graph.

**Follow-up (accepted debt).** When repository + provider wiring stabilizes, extract a shared `@auction/data-access` (or similar) package and point both `apps/api` and `apps/worker` at it so worker no longer depends on the API app package.

**Status.** *Implemented.* Worker imports in [apps/worker/src/index.ts](../../apps/worker/src/index.ts), [apps/worker/src/jobs/data-export.ts](../../apps/worker/src/jobs/data-export.ts), and [apps/worker/src/jobs/legal-entity-archive-cascade.ts](../../apps/worker/src/jobs/legal-entity-archive-cascade.ts).

## D13. Buyer onboarding UX: policy, narrow persistence commands, contextual KYC entry

**Chosen.** Post-auth routing resolves safe destinations only. Full interests onboarding runs once for newly verified individuals (`categoryInterestsOnboardingCompletedAt === null`). Settings edits use a separate `replace` repository command and `PUT /users/me/category-interests/preferences`; onboarding completion keeps the existing atomic `replaceAndComplete` command. User-facing KYC entry links target `/onboarding/identity` with typed `source` and safe `next`; when `KYC_ONBOARDING_ENABLED=false`, the identity layout redirects to the legacy `/dashboard/verify-identity` page. Restricted actions remain server-enforced (`402 kyc_required`); client links are anticipatory UX only.

**Alternatives considered.** Forcing KYC on every login was rejected (poor UX, repeated interruption). A `complete=true` flag on the existing PUT endpoint was rejected (ambiguous contract during mixed-version deploys).

**Why this wins.** Clear separation between one-time onboarding completion and editable preferences; pure policy modules; additive API compatibility; contextual return intent preserved for bid, registration, telephone, and condition-report gates.

**Status.** *Implemented.* Policy in [apps/web/src/lib/kyc/](../../apps/web/src/lib/kyc/), persistence in [packages/persistence/src/interfaces/category-interests.repository.ts](../../packages/persistence/src/interfaces/category-interests.repository.ts), HTTP in [apps/api/src/routes/users/category-interests.routes.ts](../../apps/api/src/routes/users/category-interests.routes.ts).

## D14. Strict self-service bid identity eligibility

**Chosen.** When `STRICT_BID_ELIGIBILITY_ENABLED=true`, every self-service web,
auto, proxy, or absentee bid requires the acting user's email to be verified and
personal KYC status to be `approved`. The bidding runtime is authoritative and
returns `403 email_not_verified` before `402 kyc_required`. UI policies mirror
the rule but are not trusted for enforcement. Validated telephone and saleroom
operator placements retain threshold KYC behavior.

Organisation bidding evaluates independent dimensions: acting-user identity,
buyer-entity status, active membership, and—when acting as `buyer_agent`—sale
registration and buyer-agent authorisation. The existing buyer entity allowlist
(`connect_pending`, `approved`, `restricted`) remains the SSOT. Stripe Connect
readiness is seller publishing and payout policy and never gates buying.

Standing proxy ceilings are revalidated before settlement and invalid ceilings
are cancelled without aborting another bidder's transaction. Absentee requests
are checked before scheduling and again at replay. The rollout flag defaults
off in production and may be disabled without a code rollback; when enabled,
missing Veriff configuration remains fail-closed against persisted user status
and emits an operational warning.

**Alternatives considered.** Frontend-only blocking was rejected because direct
API and internal replay paths bypass it. Reusing seller Connect readiness was
rejected because payout setup is unrelated to buyer authority. Throwing when an
invalid proxy ceiling is encountered was rejected because it could roll back an
eligible bidder's live transaction.

**Why this wins.** One pure identity rule and narrow read port are reused across
all bid channels, error contracts remain stable, organisation authority stays
separate from seller payouts, and the kill/rollout switch limits operational
risk.

**Status.** *Implemented.* Domain policy in [packages/domain/src/self-service-actor-bid-eligibility.ts](../../packages/domain/src/self-service-actor-bid-eligibility.ts), identity gate in [packages/bidding-runtime/src/bid/identity-bid-eligibility.gate.ts](../../packages/bidding-runtime/src/bid/identity-bid-eligibility.gate.ts), persistence in [packages/persistence/src/interfaces/bid-actor-eligibility.reader.ts](../../packages/persistence/src/interfaces/bid-actor-eligibility.reader.ts), UI policy in [apps/web/src/lib/bid/policies/strict-eligibility.policy.ts](../../apps/web/src/lib/bid/policies/strict-eligibility.policy.ts).

## D15. Bid policy decisions carry presentation, not a render closure

**Chosen.** `BidPolicyDecision` block variants are `{ kind: "block"; viewId; presentation }`. Consumers render `BidBlockerNotice`. Unsupported catalogue modes and live connection loss are ordinary policies in `defaultBidPolicies`, not a second `resolveRuntimeBidBlocker` wrapper. `IBidActorEligibilityReader` stays in `@auction/persistence` because `bidding-runtime` already depends on that package; moving the port would create a cycle.

**Alternatives considered.** Release’s dual `presentation` + `render` closure was rejected because it forces every policy to be `.tsx` and keeps two representations of one fact. A runtime wrapper on top of the policy array was rejected because adding a blocker then means choosing which pipeline to extend.

**Why this wins.** Policies stay data-only except sale-registration `content`. Precedence stays in one ordered array. Hard blockers omit `preview` and hide the inert form and position summary.

**Status.** *Implemented.* Types in [apps/web/src/lib/bid/bid-blocker-presentation.ts](../../apps/web/src/lib/bid/bid-blocker-presentation.ts), factory in [apps/web/src/lib/bid/policies/block-decision.ts](../../apps/web/src/lib/bid/policies/block-decision.ts), order in [apps/web/src/lib/bid/policies/index.ts](../../apps/web/src/lib/bid/policies/index.ts).

## D16. Marketing prompts use a prioritised rule table and a shared flag parser

**Chosen.** Route allowlisting, selling-intent detection, and prompt decisioning are separate modules. `resolveMarketingPrompt` walks `PROMPT_RULES` (selling, then signup) after universal blockers. Rollout flags share `parseBooleanFlag` / `resolveRolloutFlag`. Prompt suppression keys use `SUPPRESSION_STORAGE_PREFIX` so Gitleaks does not treat them as secrets.

**Alternatives considered.** Release’s if-chain in one `policy.ts` was rejected because a third variant would edit the same function. Copying `parseEnabled` into each rollout module was rejected as a four-way change point.

**Why this wins.** Adding a variant is appending a rule. Flag parsing has one test surface. Strict bid eligibility still falls back on `APP_ENV`, matching the API.

**Status.** *Implemented.* Rules in [apps/web/src/lib/marketing/prompts/policy.ts](../../apps/web/src/lib/marketing/prompts/policy.ts), parser in [apps/web/src/lib/rollout/parse-boolean-flag.ts](../../apps/web/src/lib/rollout/parse-boolean-flag.ts).
