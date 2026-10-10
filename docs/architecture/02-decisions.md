# Architectural decisions

Every non-trivial architectural decision has a number that never changes. When a decision is revised, the new revision gets a new number with a "supersedes" reference — the original entry stays so we have history. Decisions are referenced by their D-number throughout the rest of the documentation and in code comments.

This document is the source of truth for *why* the system is built the way it is. If you find yourself disagreeing with one of these decisions, do not change the implementation without first proposing a new D-number with the alternative weighed against the chosen approach. Drift between this document and the code is a worse failure than a controversial decision documented honestly.

> **Convention.** Each decision below ends with a **Status** line: *Implemented*, *Partially implemented*, or *Planned*, plus a one-line citation pointing at the file path that proves it. The "Chosen / Alternatives / Why" sections describe the *target* shape; the Status line is what is true today (last reviewed 2026-05-05).

## D1. Webhook code lives in apps/api, projection logic in apps/worker

**Chosen.** Inbound HTTP handlers for external providers live in `apps/api`. Handlers authenticate the provider, persist the provider event when asynchronous processing is required, enqueue work, and return promptly. Outbound projection logic — calling Zoho's API, calling Xero's API, and transforming domain events into each external contract — lives in `apps/worker/src/projectors/`.

**Alternatives considered.** A standalone `packages/webhooks` workspace package was rejected as premature; one HTTP handler and one outbound integration do not justify the overhead of a separate package boundary. A dedicated webhook microservice was rejected as over-engineered at our scale — receiving webhooks is HTTP request handling, which `apps/api` already does well.

**Why this wins.** The HTTP request boundary is where authentication, rate limiting, and origin verification already happen — adding webhook ingest there means it inherits all of that. Splitting outbound into the worker means we can scale Zoho throughput without scaling the API, and a Zoho outage doesn't backpressure into HTTP request handlers.

**Status.** *Implemented.* Xero ingress is handled by [apps/api/src/routes/xero-webhook.ts](../../apps/api/src/routes/xero-webhook.ts), while Postmark, Brevo, Stripe, and Veriff use their provider-specific routes. Generic `webhook_event` persistence and the `webhook-events` worker remain available for asynchronous provider processing. Zoho and Xero projectors perform outbound work in `apps/worker` and default to disabled modes.

## D2. JWKS keys live in Postgres, scoped to the auth_app role

**Chosen.** A `jwks_key` table holds the active and rotating keys: `kid` as primary key, `algorithm`, `public_jwk` (jsonb), `private_jwk` (jsonb), `status` (`active` / `rotating` / `retired`), `created_at`, `rotated_at`. The `auth_app` Postgres role is the only role with read access to the `private_jwk` column. The `api_app` role has no access to this table at all.

A retired key remains in the published JWKS for thirty minutes before deletion. The math: discovery and JWKS endpoints have a 60-second cache TTL at Cloudflare, access tokens have a 15-minute lifetime, plus a 15-minute safety margin for in-flight requests. Total `max(60s, 15min) + 15min = 30 minutes`. This constant is encoded in the rotation script and referenced from the rotation runbook — both must reference the value here, never duplicate it.

**Alternatives considered.** Storing the signing key in an environment variable was rejected because rotation requires a redeploy. Storing it in a file was rejected because DigitalOcean App Platform's filesystem is ephemeral. Using a managed KMS was rejected because DigitalOcean does not offer one and the alternatives (HashiCorp Vault, AWS KMS) introduce infrastructure we do not need at this scale.

**Why this wins.** The role split is a security boundary that matters. If `apps/api` is compromised by a SQL injection or a leaked credential, the attacker cannot read the signing key — the database role they hold does not permit it. This is the cheapest, most reliable way to bound the blast radius of a single-app compromise. The pattern matches how we already store Xero OAuth refresh tokens, so it adds zero cognitive load. Rotation is zero-downtime because new and retired keys coexist in JWKS during the transition window.

**Status.** *Implemented.* Schema in [packages/identity-db/src/schema/jwks-key.ts](../../packages/identity-db/src/schema/jwks-key.ts); role-scoped grants in [packages/db/src/migrate-roles.ts](../../packages/db/src/migrate-roles.ts) (`auth_app` ALL on `jwks_key`; `api_app` denied; `worker_app` denied). The 30-minute retirement helper and schedule live in [packages/identity-db/src/adapters/drizzle-jwks-retirement.ts](../../packages/identity-db/src/adapters/drizzle-jwks-retirement.ts), run inside `apps/auth` under `auth_app`, and use a Postgres advisory lock so only one auth replica performs each retirement tick while preserving the `worker_app` deny boundary. JWKS state is snapshotted to DigitalOcean Spaces (`secrets-backup/jwks/<env>/`) using the env-scoped encryption key documented in the private `LAX-UK/auction-infra` repository's `terraform/BOOTSTRAP.md`.

## D3. Account linking happens at sign-in, gated on email verification

**Status.** *Amended by D17.* This decision applies to authentication methods
managed by Identity. It does not describe a commerce-platform identity bridge.

**Chosen.** When a user authenticates on any of our domains, the auth service looks up an existing user record by `email` where `email_verified = true`. If a match is found, the new authentication is recorded as a row in `external_accounts` linked to that existing user. If no match is found, a new user record is created. The verified-email gate is non-negotiable — an unverified email cannot be used to claim ownership of an existing account.

**Alternatives considered.** Lazy linking on first cross-domain visit was rejected because it delays profile projection and CRM enrichment. An explicit account-linking UX remains an option for identities that cannot prove a verified-email match.

**Why this wins.** A verified email is the common identifier across credential and social sign-in methods. The possession check prevents an unverified address from claiming an existing account.

The Apple "Hide My Email" relay flow is a deliberate exception — see D11 for details.

Social account policy is enforced by Better Auth's
account-linking configuration in [packages/auth/src/server.ts](../../packages/auth/src/server.ts).
The generic `external_accounts` repository remains available for future trusted
identity providers; no commerce webhook writes to it.

## D4. The custom Shop uses the canonical Identity issuer

**Status.** *Retired and superseded by D17.* This entry is retained as decision
history. The current Shop and estate decision is D17.

**Chosen.** The customer storefront is a first-party Shop at `shop.lax.art`. It delegates authentication to the canonical issuer at `auth.lax.bid` using authorization-code OIDC and stores only Shop-owned profile data in `shop_user_profile`. Identity lifecycle events project the minimum profile fields Shop needs; Bid authorization remains isolated.

**Alternatives considered.** An outsourced commerce stack with a separate
customer identity was rejected because it would duplicate authentication,
lifecycle, and deletion boundaries. Reusing Bid's local authorization model was
rejected because Shop and Bid own different product profiles.

**Why this wins.** One issuer gives users a consistent sign-in while preserving product isolation. The Shop can evolve independently without copying credentials or widening database grants.

The isolated implementation in [apps/shop-identity/](../../apps/shop-identity/)
is the current executable Shop BFF boundary; the customer-facing Shop remains a
later delivery.

## D5. Zoho writes are async via BullMQ, sourced from domain_events

**Chosen.** Application code never calls Zoho directly. Instead, every action that should reach Zoho is recorded as a row in `domain_events` in the same DB transaction as the entity write — this is the outbox pattern. A projector in `apps/worker` polls `domain_events`, dispatches each row to the Zoho projector (and to other projectors like Xero), and the projector handles the actual API call to Zoho with retries, rate limiting, and circuit breaking.

**Alternatives considered.** Synchronous HTTP calls from the request handler were rejected because they add latency to every signup and bid, and any Zoho outage would cause user-facing failures. Fire-and-forget queue jobs (without an outbox table) were rejected because they create a window where the entity write commits but the queue job is lost on crash. CDC tail of the Postgres write-ahead log was rejected as over-engineered for our scale and as introducing operational complexity (Debezium, Kafka Connect) we don't want.

**Why this wins.** Single source of truth for integrations. The `domain_events` table is the audit log of everything that ever happened. Every projector is replayable independently — rewind a cursor, restart the worker, and the missing data flows into the external system. Adding a new integration tomorrow (MailChimp, Slack notifications, internal analytics) means writing one new projector class — no application code changes, no fan-out logic in the bid service, no risk of forgetting to wire up the new integration.

This is the single highest-leverage decision in the architecture. Every other decision pays its rent because of this one.

**Status.** *Implemented behind cutover flags.* Live producers exist across
API/auth/worker, the typed catalog is in `@auction/types`, and each consumer uses
the durable `domain_event_delivery` ledger. External Zoho/Xero writes remain
off by default; see [04-domain-events.md](./04-domain-events.md).

**2026-09 CRM refresh.** Zoho outbound code uses a `CrmGateway` port, pure event mappers, `crm_record_link`, catalog-filtered projector cursor, explicit delivery `skipped` status, separate `ZOHO_CRM_API_HOST` for sandbox, and GDPR erasure via Recycle Bin purge. Details: [integrations/zoho.md](../integrations/zoho.md).

## D6. Webhook authenticity verified per source, with replay window

**Status.** *Amended by D17.* This decision covers active external webhook
providers only. Shop identity and lifecycle synchronization use OIDC,
back-channel logout, SSF, and internal domain events rather than commerce
webhooks.

**Chosen.** Each inbound webhook source has its own verification mechanism. Stripe and Xero bind signatures to the raw request body. Postmark uses a dedicated Basic Auth credential, Brevo uses its configured webhook secret, and Veriff verifies its provider signature.

All sources reject any payload whose timestamp is more than five minutes old, comparing against the `Date` header or a source-specific `X-*-Triggered-At` header. This bounds replay-attack windows to five minutes.

**Alternatives considered.** Mutual TLS was rejected for webhook sources that cannot terminate it cleanly at the edge — the operational cost is high relative to HMAC verification. A naive shared secret in the request body without HMAC was rejected as replay-vulnerable.

**Why this wins.** Each source uses the verification primitive its platform mandates or recommends, which means we benefit from their existing tooling. The replay window is short enough to defeat practical attacks but long enough to absorb clock skew and webhook retry latency.

Provider-specific verification lives beside each active ingress route. Persisted
provider events use unique event keys for idempotency; timestamp/replay policy
follows each provider contract.

## D7. apps/auth is the canonical OIDC issuer

**Status.** *Amended by D15 and D17.* `apps/auth` remains the sole issuer.
Products are OIDC relying parties/BFFs; `apps/api` does not resolve browser
cookies or publish issuer routes.

**Chosen.** OIDC discovery, JWKS, and `/api/auth/*` live in `apps/auth` only.
`apps/api` verifies resource access tokens and does not accept browser session
cookies. The issuer URL `https://auth.lax.bid` is canonical; Cloudflare routes
that host to `apps/auth`.

**Alternatives considered.** Keeping OIDC inside `apps/api` indefinitely was rejected because it co-locates auth burst traffic with auction API queries and widens blast radius. Extracting upfront in Phase 1 was rejected as premature before the identity boundary (D13) proved the split.

**Why this wins.** A dedicated auth deployable isolates JWKS private-key access
(D2), auth rate limits, and deploy cadence from product traffic. Products keep a
stable trust anchor while auth infrastructure changes behind the hostname.

[apps/auth/](../../apps/auth/) is the sole issuer. `apps/api` no longer serves
`/.well-known/*` or `/api/auth/*`.

## D8. domain_events outbox uses same-transaction writes and SKIP LOCKED polling

**Chosen.** Every domain event is written in the same database transaction as the entity it describes. Application code calls `DomainEventPublisher.publish(tx, event)` inside an existing `db.transaction(...)` block — never outside it. If the transaction rolls back, the event row rolls back too. There is no scenario where the entity commits but the event is lost.

The worker reads from `domain_events` using `SELECT ... FOR UPDATE SKIP LOCKED` so multiple worker instances cannot double-process the same row. Each projector tracks its own cursor in `projector_state` (one row per projector name). The polling loop sleeps 1.5 seconds when no events are returned.

**Alternatives considered.** Post-commit publishing (write entity, commit, then publish event) was rejected because the worker process can crash between commit and publish, losing the event silently. Postgres `LISTEN/NOTIFY` was deferred — it would lower projection latency but adds reconnect-handling complexity we don't need today. We'll switch when projector lag exceeds 5 minutes or we cross 1M events/day.

**Why this wins.** Strong consistency by default. Operationally simple — there's nothing to debug except SQL. Replayable — rewind the cursor, restart the worker, and the projector recomputes everything since that point. SKIP LOCKED costs nothing on a single worker instance and makes horizontal scaling safe the moment we need it.

**Status.** *Implemented behind cutover flags.* Worker consumers use durable
per-consumer leases, retries, dead-letter state, and replay. Producers append
events through the outbox boundary; external modes default to `off`.

## D9. The OIDC issuer URL is auth.lax.bid from day one

**Status.** *Amended by D15.* The issuer remains `https://auth.lax.bid`; every
product now consumes it through its own OIDC client and BFF boundary.

**Chosen.** OIDC discovery returns `"issuer": "https://auth.lax.bid"` from the
canonical `apps/auth` issuer. Cloudflare CNAMEs the `auth` subdomain to that
deployment, and the issuer URL remains stable across infrastructure changes.

**Alternatives considered.** Issuing from a product API and renaming later was
rejected because issuer changes require every OIDC client and verifier to change
trust configuration.

**Why this wins.** Stability from day one is free if planned for. Renaming the issuer is the kind of decision that looks small at the time and becomes the single most regretted choice when you realize it forces every external integration to redo their config.

`apps/auth` is the sole issuer and returns
`OIDC_ISSUER_URL` from discovery. `apps/api` reads the same value only to verify
tokens and call the canonical service; it does not serve issuer routes.

## D10. Historical cookie-then-Bearer API authentication

**Status.** *Superseded by D15.* The historical composite and remote-session
implementations have been removed. Bid API authentication is Bearer-only; the
Bid BFF owns its host-only browser session.

**Chosen (historical).** The Bid API once tried a remotely resolved browser
session before local Bearer verification, then enriched the global subject from
`bid_user_profile`.

The websocket app (`apps/ws`) uses JWT-only verification on the Socket.IO
handshake and resolves Bid authorization through `apps/api/users/me`.

**Alternatives considered (historical).** Bearer-only required a Bid BFF cutover;
cookie-only blocked mobile and cross-product clients.

**Why it was chosen.** It preserved the route-level `IAuthenticator` boundary
during migration. D15 removed the transitional runtime without changing route
handlers.

The surviving adapter is `JwtAuthenticator`, wrapped by
`BidContextEnrichedAuthenticator` to load product-local authorization. WS also
rejects cookie-only handshakes.

## D11. Social login via better-auth's Google and Apple plugins, account linking enabled

**Chosen.** `packages/auth/src/server.ts` registers better-auth's `socialProviders.google` and `socialProviders.apple`. Email/password remains as a fallback credential. The `accountLinking` config is `{ enabled: true, trustedProviders: [] }`. With an empty trusted-provider list, Better Auth does not auto-link social accounts without a verified email match — Google sign-ins link when the provider returns a verified email; Apple relay emails link by `sub` via the `account` table. Email/password credential users link to social signups via the email-verification gate from D3.

**Apple "Hide My Email" handling.** Apple's privacy relay returns email addresses
ending in `@privaterelay.appleid.com`. Better Auth keys the social account by
Apple's stable provider account ID and stores the relay address on the Identity
user. Because that address does not match the user's real email, a later
email/password signup remains a different subject until an explicit,
proof-of-control merge. We do not infer a relationship from the relay address.

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

## D13. LAX Identity boundary separates authentication from product authorization

**Chosen.** `apps/auth` is the sole credentials/session/OIDC issuer. Products
consume Identity through OIDC/JWKS and versioned domain events—not by importing
`@auction/auth/server` or reading auth tables. Bid-owned state lives in
`bid_user_profile`, keyed by the unchanged Identity subject. Tokens carry
verification-essential claims only; Bid loads authorization locally.

**Alternatives considered.** Embedding Bid roles in JWT claims was rejected because revocation must take effect immediately. Sharing the monolithic `user` row across products was rejected because it couples auction compliance to global Identity extraction. SCIM for internal sync was rejected — event-driven projection with idempotent consumers matches the existing `domain_events` model.

**Why this wins.** Matches industry pattern: central issuance, edge verification, stateful governance. Preserves immutable `user.id` for existing FK references while enabling future Shop and other LAX products without auth DB access. `@auction/identity-contracts` gives consumers a dependency-light boundary.

**Status.** *Implemented in code; production cutover evidence pending.* SSOT:
[09-lax-identity-boundary.md](./09-lax-identity-boundary.md). Schema:
`bid_user_profile`, `shop_user_profile`. Package:
`@auction/identity-contracts`. `apps/auth` is canonical; promotion still follows
the staged cutover runbook.

## D14. Resource indicators, audiences, scopes, and token exchange are explicit

**Chosen.** Identity maintains exact client and resource registries. RFC 8707
resource indicators map one-to-one to access-token audiences:
`https://api.lax.bid` → `lax-bid-api`, `https://ws.lax.bid` → `lax-ws`, and
`https://shop.lax.art/api` → `lax-shop-api`. Product scopes are namespaced:
`bid.read`, `bid.write`, `shop.read`, and `shop.write`. Confidential clients use
RFC 8693 token exchange to turn a client-bound Identity token into a 15-minute,
single-resource access token.

**Alternatives considered.** One estate-wide audience was rejected because it
lets a token minted for one product be replayed at another. Unnamespaced scopes
were rejected because their owner is ambiguous. Sending ID tokens directly to
resource servers was rejected because ID tokens are client assertions, not API
capabilities.

**Why this wins.** Each verifier can enforce one issuer, one audience, and its
required scopes. The exchange endpoint rejects arbitrary or multiple resources,
disabled or merged subjects, and scopes outside both client and resource policy.

**Status.** *Implemented.* Registries live in
`packages/identity-contracts/src/clients.ts` and `resources.ts`; exchange policy
lives in `apps/auth/src/services/token-exchange.service.ts`.

## D15. Every product is an OIDC RP/BFF with a host-only session

**Supersedes D10 and amends D7/D9.**

**Chosen.** Browser-facing products are confidential OIDC relying parties backed
by a BFF. The BFF performs authorization code + PKCE, stores Identity and
resource tokens server-side, and sends the browser only an opaque, Secure,
HttpOnly, SameSite=Lax, host-only session cookie. No authentication cookie is
shared across subdomains. Product APIs accept Bearer resource tokens, not
Identity or product browser cookies. `auth.lax.bid` remains the issuer because
issuer stability is a security contract and must not follow product hosting.

**Alternatives considered.** Parent-domain cookies were rejected because they
widen credential exposure to every subdomain. Remote session lookup from the API
was rejected because it couples resource availability to Identity and confuses
browser sessions with API credentials.

**Why this wins.** A compromise of one product host cannot steal another
product's browser session, APIs verify locally during an Identity outage, and
each BFF can revoke its own session independently.

**Status.** *Implemented in code; environment promotion evidence pending.* Bid
BFF code is in `apps/web/src/lib/bff/`; the Shop reference BFF is
`apps/shop-identity/`.

## D16. OIDC back-channel logout and SSF are separate mechanisms

**Chosen.** OIDC Back-Channel Logout terminates RP sessions using a signed
`logout+jwt` addressed to the client. SSF carries signed `secevent+jwt` CAEP,
RISC, and first-party lifecycle signals to an API receiver. Logout is immediate
session invalidation; SSF is durable security-state synchronization. A failure
in one does not silently count as success in the other.

**Alternatives considered.** Using only browser front-channel logout was
rejected because other RP sessions remain active. Encoding every lifecycle event
as a logout token was rejected because logout tokens do not provide stream
configuration, replay controls, or event semantics.

**Why this wins.** Receivers have narrow validation and idempotency contracts.
Logout can remain enabled while SSF streams are disabled or paused.

**Status.** *Implemented; SSF delivery defaults disabled.* See
`apps/auth/src/services/backchannel-logout.service.ts`,
`apps/auth/src/services/ssf.service.ts`, and D16 operations runbooks.

## D17. LAX owns the Shop at shop.lax.art

**Retires D4 and amends D3/D6/D7/D9.**

**Chosen.** The custom Shop is a first-party product at `shop.lax.art`; there is
no hosted commerce identity or storefront provider. Marketing at `lax.art` is
initially static. Shop uses client `lax-shop-web`, resource `lax-shop-api`, a
host-only BFF session, `shop_user_profile`, OIDC logout, and SSF.

**Alternatives considered.** An outsourced commerce stack and separate customer
identity were rejected because they duplicate identity lifecycle, deletion, and
incident response. Reusing Bid authorization was rejected because Shop owns a
separate profile and policy boundary.

**Why this wins.** The estate has one issuer without making products share
sessions or authorization data, and Shop can be deployed independently.

**Status.** *Boundary implemented; customer-facing Shop not yet delivered.*

## D18. OIDC subjects are public until pairwise separation is required

**Chosen.** Discovery advertises `subject_types_supported: ["public"]`.
`sub` is the immutable canonical Identity subject across first-party products.
Move to pairwise subjects only when an external or independently controlled
client must not correlate a person across relying parties; that change requires
sector identifiers, a subject-mapping store, migration contracts, and a new
decision.

**Alternatives considered.** Pairwise subjects for all current first-party
clients were rejected because they add mapping and merge complexity without a
privacy boundary between independent controllers.

**Why this wins.** Product profiles and lifecycle events can key directly by
immutable `sub` today, while the condition for a privacy-driven change is
explicit.

**Status.** *Implemented.* Discovery contracts in `packages/auth/src/contracts.ts`
and `packages/identity-contracts/src/discovery.ts` advertise public subjects.

## D19. Buyer onboarding UX: policy, narrow persistence commands, contextual KYC entry

**Chosen.** Post-auth routing resolves safe destinations only. Full interests onboarding runs once for newly verified individuals (`categoryInterestsOnboardingCompletedAt === null`). Settings edits use a separate `replace` repository command and `PUT /users/me/category-interests/preferences`; onboarding completion keeps the existing atomic `replaceAndComplete` command. User-facing KYC entry links target `/onboarding/identity` with typed `source` and safe `next`; when `KYC_ONBOARDING_ENABLED=false`, the identity layout redirects to the legacy `/dashboard/verify-identity` page. Restricted actions remain server-enforced (`402 kyc_required`); client links are anticipatory UX only. When unset, `KYC_ONBOARDING_ENABLED` and `FULL_BUYER_ONBOARDING_ENABLED` default on outside production deployments (`APP_ENV` other than `production`, matching D20) and off in production.

**Alternatives considered.** Forcing KYC on every login was rejected (poor UX, repeated interruption). A `complete=true` flag on the existing PUT endpoint was rejected (ambiguous contract during mixed-version deploys).

**Why this wins.** Clear separation between one-time onboarding completion and editable preferences; pure policy modules; additive API compatibility; contextual return intent preserved for bid, registration, telephone, and condition-report gates.

**Status.** *Implemented.* Policy in [apps/web/src/lib/kyc/](../../apps/web/src/lib/kyc/), persistence in [packages/persistence/src/interfaces/category-interests.repository.ts](../../packages/persistence/src/interfaces/category-interests.repository.ts), HTTP in [apps/api/src/routes/users/category-interests.routes.ts](../../apps/api/src/routes/users/category-interests.routes.ts).

## D20. Strict self-service bid identity eligibility

**Chosen.** When `STRICT_BID_ELIGIBILITY_ENABLED=true`, every self-service web,
auto, proxy, or absentee bid requires the acting user's email to be verified and
personal KYC status to be `approved`. The bidding runtime is authoritative and
returns `403 email_not_verified` before `402 kyc_required`. UI policies mirror
the rule but are not trusted for enforcement. Buyer sale-registration requests
and telephone-line booking requests run the same self-service gate before any
write, so a blocked user cannot queue work for staff approval. Validated
telephone and saleroom operator placements retain threshold KYC behavior.

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

**Status.** *Implemented.* Domain policy in [packages/domain/src/self-service-actor-identity-eligibility.ts](../../packages/domain/src/self-service-actor-identity-eligibility.ts) (shared by bidding and condition-report flows), strict bid gate in [packages/bidding-runtime/src/bid/identity-bid-eligibility.gate.ts](../../packages/bidding-runtime/src/bid/identity-bid-eligibility.gate.ts), always-strict condition-report gate via [packages/bidding-runtime/src/bid/self-service-identity-eligibility.gate.ts](../../packages/bidding-runtime/src/bid/self-service-identity-eligibility.gate.ts), persistence in [packages/persistence/src/interfaces/bid-actor-eligibility.reader.ts](../../packages/persistence/src/interfaces/bid-actor-eligibility.reader.ts), UI policy in [apps/web/src/lib/bid/policies/strict-eligibility.policy.ts](../../apps/web/src/lib/bid/policies/strict-eligibility.policy.ts).

## D21. Bid policy decisions carry presentation, not a render closure

**Chosen.** `BidPolicyDecision` block variants are `{ kind: "block"; viewId; presentation }`. Consumers render `BidBlockerNotice`. Unsupported catalogue modes and live connection loss are ordinary policies in `defaultBidPolicies`, not a second `resolveRuntimeBidBlocker` wrapper. `IBidActorEligibilityReader` stays in `@auction/persistence` because `bidding-runtime` already depends on that package; moving the port would create a cycle.

**Alternatives considered.** Release’s dual `presentation` + `render` closure was rejected because it forces every policy to be `.tsx` and keeps two representations of one fact. A runtime wrapper on top of the policy array was rejected because adding a blocker then means choosing which pipeline to extend.

**Why this wins.** Policies stay data-only except sale-registration `content`. Precedence stays in one ordered array. Hard blockers omit `preview` and hide the inert form and position summary.

**Status.** *Implemented.* Types in [apps/web/src/lib/bid/bid-blocker-presentation.ts](../../apps/web/src/lib/bid/bid-blocker-presentation.ts), factory in [apps/web/src/lib/bid/policies/block-decision.ts](../../apps/web/src/lib/bid/policies/block-decision.ts), order in [apps/web/src/lib/bid/policies/index.ts](../../apps/web/src/lib/bid/policies/index.ts).

## D22. Marketing prompts use a prioritised rule table and a shared flag parser

**Chosen.** Route allowlisting, selling-intent detection, and prompt decisioning are separate modules. `resolveMarketingPrompt` walks `PROMPT_RULES` (selling, then signup) after universal blockers. Rollout flags share `parseBooleanFlag` / `resolveRolloutFlag`. Prompt suppression keys use `SUPPRESSION_STORAGE_PREFIX` so Gitleaks does not treat them as secrets.

**Alternatives considered.** Release’s if-chain in one `policy.ts` was rejected because a third variant would edit the same function. Copying `parseEnabled` into each rollout module was rejected as a four-way change point.

**Why this wins.** Adding a variant is appending a rule. Flag parsing has one test surface. Strict bid eligibility still falls back on `APP_ENV`, matching the API.

**Status.** *Implemented.* Rules in [apps/web/src/lib/marketing/prompts/policy.ts](../../apps/web/src/lib/marketing/prompts/policy.ts), parser in [apps/web/src/lib/rollout/parse-boolean-flag.ts](../../apps/web/src/lib/rollout/parse-boolean-flag.ts).

## D23. Identity source extracts before its database

**Chosen.** Extract the six-path Identity issuer closure to the private
`LAX-UK/lax-identity` repository and make that repository authoritative only
after standalone CI, staging integration, measured soak, and rollback evidence
pass. During this transition, staging runs the standalone image at the existing
issuer host while production retains the frozen monorepo image. The monorepo
continues to own the shared migration journal, application-role grants, OIDC
client provisioning, product projectors, and the single staging deployment
orchestrator.

Public Identity contracts and database schema are frozen for this phase.
Schema compatibility is represented by a pinned monorepo migration-image
digest, commit, and journal hash in the standalone repository. Identity never
runs an independent migration journal. Emergency production-fallback fixes
require an explicit hotfix label and synchronization record across repositories.

**Alternatives considered.** Moving Identity migrations with the source was
rejected because product tables, foreign keys, projectors, and grants still
share one journal. Letting both repositories deploy the App Platform
application directly was rejected because mutable image tags and the shared
PRE_DEPLOY migration job create a release-order race. A second staging issuer
hostname was rejected because it would not exercise the registered issuer,
redirect URI, cookie, or relying-party contracts.

**Why this wins.** Source and image portability become independently provable
without pretending the database is already separated. One deployment authority
serializes migration, role, client-registry, image, and rollback operations,
while the unchanged issuer URL provides a real staging contract test.

**Status.** *Accepted for staged implementation.* Production traffic, package
publication, independent Identity migrations, and physical database separation
remain deferred.

## D24. Shop commerce API is a separate Fastify deployable with Shop-owned catalogue schema

**Supersedes none; extends D17.**

**Chosen.** Shop catalogue, artwork, editions, and future commerce commands live in
`apps/shop-api` (Fastify v5, Node 22). Pure artwork/edition policies live in
`packages/shop-domain`. Transport-neutral request/response shapes live in
`packages/shop-contracts` (TypeBox). PostgreSQL tables
(`shop_party`, `shop_artist`, `shop_artwork`, `shop_edition`) are owned by the
`shop_app` role. `apps/shop-identity` remains auth-only (OIDC BFF); it does not
serve catalogue HTTP. The foundation slice uses seed/import writes only — no admin
dashboard in this decision (hosted checkout arrived in later Shop commerce work).

**Alternatives considered.** Extending `apps/shop-identity` with catalogue routes was
rejected because it mixes auth burst traffic with commerce queries and widens session
blast radius. NestJS was rejected as heavier than needed for a focused API surface.
Putting Shop policies in `@auction/domain` was rejected because Shop is an independent
product boundary with its own extraction path.

**Why this wins.** Shop can deploy and scale commerce independently while keeping
Identity and auth cookies isolated. Fastify matches the need for typed OpenAPI,
structured logging, and a thin composition root without adopting a second full-stack
framework inside the monorepo.

## D25. Shop commerce persistence is split by command and query ports

**Supersedes none; extends D24.**

**Chosen.** `apps/shop-api` commerce I/O is split into basket, checkout, order, and
payment-event adapters (`drizzle-basket.repository.ts`, `drizzle-checkout.repository.ts`,
`drizzle-order.repository.ts`, `drizzle-payment-event.processor.ts`) with shared
`shop-basket.persistence.ts`, `shop-edition-availability.ts`, and `shop-party.ts`.
Application handlers depend on segregated ports (`BasketRepository`, `CheckoutWriter`,
`OrderReader`) composed at the Fastify root. `OrderReader.listOrders` accepts bounded
`limit`/`cursor` input; artwork interest persistence returns domain result unions mapped
to HTTP in handlers rather than throwing transport errors from adapters.

**Why this wins.** Checkout and webhook paths keep transaction boundaries without a
750-line god module, and handlers only import the port surface they need.

**Status.** *Implemented.* Boundary doc
[10-shop-commerce-boundary.md](./10-shop-commerce-boundary.md); executable API in
[apps/shop-api/](../../apps/shop-api/).

## D26. Cross-product placeholders and semantic status tones

**Chosen.** Missing catalogue media uses `@auction/ui` `MediaPlaceholder` (Bid hatch pattern)
and `@auction/marketing-ui` `MediaImage` with an injectable `MediaSrcResolver`. Shop keeps
thin wrappers and label SSOT; Bid retains CDN resolution via `resolveMediaSrc`. Entity status
colours use the existing Tag-Review tone set in `@auction/ui` (`DotStatusPill`); Shop owns a
small typed registry in `apps/shop/src/lib/presenters/shop-status-presentation.ts`. Distinct
statuses that share a semantic colour differ by **glyph + label** (WCAG 1.4.1), not one-off hex
values.

**Deferred.** Moving Bid’s full admin status registry out of `apps/web` into a shared package
(Option B) and deduping legal-entity / lot / payment presenter drift remain follow-up work.

**Status.** *Implemented.*

## D27. Bid primary authentication uses issuer-hosted credentials (BFF redirect)

**Chosen.** Primary Bid sign-in, sign-up, password reset, two-factor, magic link, and
verify-pending entry points are thin server redirects to `/api/auth/login` (or issuer-hosted
recovery URLs). Passwords and magic-link requests are entered only on `auth.lax.bid` /
`test-auth.lax.bid`. The Bid BFF stores PKCE state, exchanges codes server-side, and sets the
HttpOnly session cookie (RFC 10017 BFF pattern). Sign-up uses OIDC `prompt=create` (Prompt
Create 1.0). Sensitive in-app actions use OIDC step-up (`prompt=login` + Bid BFF `auth_time`
check) instead of embedded password re-entry. Bid-specific registration data (terms, persona,
invite) is collected on `/onboarding/account` after the first OIDC login (`POST /users/me/onboarding`).
Signed-in account management (2FA enrollment, connected accounts, optional set-password after magic link)
may still call issuer JSON routes from the Bid browser.

**Alternatives considered.** Embedded credential forms on `lax.bid` were rejected: RFC 9700
§2.4, cross-origin credential posting, and split WebAuthn/passkey origins.

**Why this wins.** One login origin for Shop and Bid, shared hosted chrome and rate limits,
and the same security model Auth0 and OWASP recommend for browser apps.

**References.** [RFC 9700](https://www.rfc-editor.org/rfc/rfc9700.html) §2.4;
[RFC 10017](https://www.rfc-editor.org/info/rfc10017/);
[OIDC Prompt Create 1.0](https://openid.net/specs/openid-connect-prompt-create-1_0.html);
[09-lax-identity-boundary.md](./09-lax-identity-boundary.md) (Hosted credential chrome).

**Status.** *Implemented.* Bid BFF modules under `apps/web/src/lib/bff/`; guardrail in
`scripts/check-web-guardrails.mjs`; issuer `prompt=create` in
`packages/auth/src/hosted-auth/flow-context.ts`; discovery advertises
`prompt_values_supported` including `create`.

## D28. Shop V1 uses Stripe as the sole payment provider

**Supersedes none; extends D24 / D17.**

**Chosen.** Shop checkout, refunds, disputes, fund-availability tracking, and original-art
invoicing use Stripe only. Square is out of scope for Shop V1.

**Why this wins.** The existing `apps/shop-api` Stripe Checkout integration, webhook
deduplication, and payout ledger are already in production on staging; extending one provider
reduces PCI scope and operational surface area.

**Status.** *Planned (Shop V1).* Runbook: [shop-stripe-setup.md](../runbooks/shop-stripe-setup.md).

## D29. Shop V1 ships in four releasable phases

**Supersedes none; extends D24.**

**Chosen.** Shop V1 is delivered in four phases, each with its own exit criteria and feature
flags: (1) client ownership foundation — editions, sale authority, minimal staff admin, client
portal reads, Zoho catalogue sync; (2) sell, deliver, get paid — production, fulfilment,
refunds, disputes, manual payouts; (3) operations dashboard, brokers, third-party sales, full
Zoho money sync and reconciliation; (4) original-art sales and merchandise. Phase 1 fixes the
database shapes later phases depend on; later phases add tables and behaviour without redesigning
live columns.

**Why this wins.** Money flows and broker stock need proof on top of a working edition model;
outside inputs (VAT, legal cancellation rules) block Phase 2 go-live but not Phase 1 build.

**Status.** *Planned.* SSOT: [12-shop-v1-brief-validation.md](./12-shop-v1-brief-validation.md).

## D30. Shop staff administration is a separate Next.js app with Shop-owned RBAC

**Supersedes the “no admin dashboard” deferral in D24 for Shop V1.**

**Chosen.** Staff workflows live in `apps/shop-admin` on `admin.shop.lax.art`, a confidential
OIDC client (`lax-shop-admin`) that server-side exchanges ID tokens for `lax-shop-api` access
tokens carrying the `shop.admin` scope only on that client. Roles and capabilities
(`shop_staff_member`, capability matrix) live in Shop Postgres; Identity tokens carry no roles
(D13). Sale limits are recorded by account managers in admin with evidence notes; the client
portal shows limits read-only and accepts change requests.

**Alternatives considered.** Reusing Bid admin authorization (rejected — D17). Putting admin
routes on the storefront BFF only (rejected — widens session blast radius and mixes shopper and
staff traffic).

**Why this wins.** Least-privilege staff access, MFA-enforced finance actions, and an audit trail
without coupling Shop operations to Bid’s saleroom model.

**Status.** *Phase 1:* staff API + RBAC + ops CLI (`staff:grant`, `sale-authority`); `lax-shop-admin`
OIDC client and `apps/shop-admin` UI deferred until BFF login ships. Boundary:
[10-shop-commerce-boundary.md](./10-shop-commerce-boundary.md).

## D31. RFC 8693 exchanged access tokens may carry `acr` and `auth_time` for Shop admin MFA

**Supersedes none; extends D13 / [09-lax-identity-boundary.md](./09-lax-identity-boundary.md).**

**Chosen.** When the subject token in token exchange is an OIDC ID token, the issuer copies
`acr` and `auth_time` into the issued `lax-shop-api` access token. `apps/shop-admin` rejects
non-silver ID tokens; `apps/shop-api` `/admin/v1/*` requires `shop.admin`, `acr` silver, and
(for finance mutations) recent `auth_time`. *(Silver requirement superseded by D35; recent
`auth_time` for finance mutations remains.)* This is not a role claim — capabilities remain in
Shop Postgres.

**Alternatives considered.** Trusting ID-token checks only in the admin BFF without API
enforcement (rejected). Adding roles to JWTs (rejected — D13).

**Why this wins.** Defense in depth: a leaked storefront token cannot call admin routes even if
scopes were misconfigured; finance actions require fresh step-up.

**Status.** *Planned (Shop V1 Phase 1).*

## D32. Shop V1 online checkout excludes international delivery; quotation stays enquiry-only

**Supersedes none; extends Shop fulfilment policy.**

**Chosen.** V1 purchasable fulfilment is UK insured delivery, collection (New Cavendish,
Brunswick), and LAX storage. The existing `international_quotation` option remains
non-checkout (email enquiry). UK delivery orders reject non-UK delivery countries at checkout.

**Note.** The Oliver/Felix business brief listed international delivery by quotation as a
product option; this decision narrows V1 **online payment** scope. Confirm with product owners
before production go-live.

**Status.** *Planned (Shop V1).* Domain gate already exists:
`packages/shop-domain/src/basket-totals.ts` (`International quotation fulfilment cannot be checked out online`).

## D33. Shop artist portal login is staff-linked, audited, and merge-aware

**Supersedes none; extends D17 / Shop portal ownership.**

**Chosen.** A `shop_artist` row may reference at most one `identity_subject_id` (partial unique index). Staff with `catalogue.write` link or unlink a login by verified shop profile email via `/admin/v1/artists/:artistId/identity-link`. Mutations run inside the Shop unit of work with admin idempotency, `FOR UPDATE` on the artist row, and audit append (before/after subject). Conflicts return 409 when the artist or login is already linked elsewhere. Email lookup excludes disabled or merged profiles; ambiguous email matches return 409. Identity merge inbox processing remaps or clears artist links when subjects merge. The linked subject is separate from buyer `shop_party` ownership used for editions and sale authority.

**Alternatives considered.** Auto-linking artists on first sign-in by email (rejected — no staff control, weak audit). Reusing buyer party as artist identity (rejected — conflates collector and artist roles).

**Why this wins.** Artist portal routes (`/v1/me/artist/*`) need a deliberate, reversible binding with the same admin safety model as finance mutations, without breaking multi-party ownership.

**Status.** *Implemented.* Handler: [apps/shop-api/src/infrastructure/handlers/admin/link-artist-identity.handler.ts](../../apps/shop-api/src/infrastructure/handlers/admin/link-artist-identity.handler.ts); merge remap: [apps/shop-api/src/infrastructure/scheduler/process-identity-merge-inbox.runner.ts](../../apps/shop-api/src/infrastructure/scheduler/process-identity-merge-inbox.runner.ts); migration **0203** `shop_artist.identity_subject_id`.

## D34. LAX Account app, phone-as-contact-only, and disabled SMS password reset

**Supersedes none; extends D13 / D7.**

**Chosen.** Cross-product identity settings live in `apps/account` (`account.lax.bid`) as an OIDC RP/BFF (`lax-account-web`). Phone numbers are verified contact data only: hosted `/phone` sign-in is retired and Better Auth phone SMS password-reset paths are disabled. Shop checkout may request OIDC `phone` scope to prefill `shop_order.delivery_phone`. Staff shop-admin sign-in uses silver ACR with hosted MFA setup when no authenticator exists *(superseded by D35: staff two-step verification follows the staff policy)*.

**Portal scope (v1).** `/account` shows profile claims read-only (edits link to Bid via `LAX_BID_PUBLIC_URL`) and security actions that hand off to issuer-hosted pages: password change via `/forgot-password`, authenticator enrolment via `/two-factor/setup`. The hosted setup page requires an issuer session and refuses to re-enrol an account that already has an authenticator, because Better Auth's enable call replaces the working secret immediately. Authenticator status is shown from the session ACR (silver means this sign-in used a second factor); the portal does not claim "not enrolled" from a bronze sign-in. Bid web keeps `LAX_ACCOUNT_ORIGIN` unset until the portal owns profile editing.

**Rollout.** Test: build `lax-test-account:<sha>` with `app-deploy-test`, then run `terraform-test-up` with `account_sha` set (the workflow verifies the image exists before apply); later runs resolve the live tag. Production has no account component, DNS or OIDC client secrets in Terraform yet; those land with the production rollout.

**Status.** *Implemented (foundation).* Runbooks: [docs/runbooks/mfa-staff-reset.md](../runbooks/mfa-staff-reset.md), [docs/runbooks/shop-admin-staff-grant.md](../runbooks/shop-admin-staff-grant.md).

## D35. Two-step verification is optional per user, with staff and organisation policies enforced by Identity

**Supersedes the hard silver-ACR staff requirement in D31 and D34; extends D13.**

**Chosen.** Two-step verification (TOTP) is optional by default: each user turns it on or off in their own security settings. Two policies can make it mandatory:

- **Staff policy** — a Bid super admin (`platform.admin.full`) requires it for everyone with a staff role on any LAX platform (Bid staff role, active Shop staff grant). Seeded **on**.
- **Organisation policy** — an organisation owner requires it for that organisation's members. Default **off**.

Identity enforces the result at `/oauth2/authorize` for every relying party. Products still own roles (D13): SECURITY DEFINER triggers on `bid_user_profile`, `shop_staff_member` and `legal_entity_member` (organisations only) maintain `identity_access_marker`, a role-free "this subject is staff / belongs to org X" table that `auth_app` can read. Policies live in `identity_mfa_policy`. Both tables are denied to `api_app`; Bid reads and writes policy through Identity machine endpoints (`/internal/identity/two-factor-policies/*`, `/internal/identity/subjects/:id/two-factor-requirement`), and every change is audited as `auth.two_factor_policy_changed`.

When a policy applies, a session satisfies it if it completed TOTP or signed in with Google or Apple (`session.social_auth_at`). Otherwise the gate sends enrolled users to `/two-factor` and unenrolled users to `/two-factor/setup?required_by=staff|org` (forced setup at next sign-in); `prompt=none` returns `interaction_required`. While a policy applies, `/two-factor/disable` returns 403 `TWO_FACTOR_REQUIRED_BY_POLICY`. Clients that explicitly request silver ACR still get the strict TOTP step. `apps/shop-admin` and `apps/shop-api` no longer demand silver; recent `auth_time` for finance mutations (D31) stays.

Users manage two-step verification on the hosted `/two-factor/manage` page (linked from LAX Account) or Bid's security settings; both show "Required by …" and hide **Turn off** while a policy applies.

**Alternatives considered.** Keeping silver mandatory for all staff (rejected — product owners want it configurable). Putting roles or a `lax_2fa_required` claim in tokens (rejected — D13 and the governed cross-platform claim set). Granting `auth_app` read access to product role tables (rejected — couples Identity to product schemas).

**Why this wins.** One enforcement point covers every LAX product, product role models stay private, and admins can tighten or relax policy without a deploy.

**Status.** *Implemented.* Migration **0205** `identity_access_policy`; gate: [apps/auth/src/infrastructure/two-factor-authorize-gate.middleware.ts](../../apps/auth/src/infrastructure/two-factor-authorize-gate.middleware.ts); policy routes: [apps/auth/src/routes/internal-two-factor-policy.routes.ts](../../apps/auth/src/routes/internal-two-factor-policy.routes.ts); Bid service: [apps/api/src/services/security/two-factor-policy.service.ts](../../apps/api/src/services/security/two-factor-policy.service.ts).
