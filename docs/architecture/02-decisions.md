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

**Status.** *Implemented.* Schema in [packages/db/src/schema/jwks-key.ts](../../packages/db/src/schema/jwks-key.ts); role-scoped grants in [packages/db/src/migrate-roles.ts](../../packages/db/src/migrate-roles.ts) (`auth_app` ALL on `jwks_key`; `api_app` denied; `worker_app` denied). The 30-minute retirement helper and schedule live in [packages/auth/src/jwks-retirement.ts](../../packages/auth/src/jwks-retirement.ts), run inside `apps/auth` under `auth_app`, and use a Postgres advisory lock so only one auth replica performs each retirement tick while preserving the `worker_app` deny boundary. JWKS state is snapshotted to DigitalOcean Spaces (`secrets-backup/jwks/<env>/`) using the env-scoped encryption key set up in [BOOTSTRAP.md](../../infra/terraform/BOOTSTRAP.md).

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

**Chosen.** Post-auth routing resolves safe destinations only. Full interests onboarding runs once for newly verified individuals (`categoryInterestsOnboardingCompletedAt === null`). Settings edits use a separate `replace` repository command and `PUT /users/me/category-interests/preferences`; onboarding completion keeps the existing atomic `replaceAndComplete` command. User-facing KYC entry links target `/onboarding/identity` with typed `source` and safe `next`; when `KYC_ONBOARDING_ENABLED=false`, the identity layout redirects to the legacy `/dashboard/verify-identity` page. Restricted actions remain server-enforced (`402 kyc_required`); client links are anticipatory UX only.

**Alternatives considered.** Forcing KYC on every login was rejected (poor UX, repeated interruption). A `complete=true` flag on the existing PUT endpoint was rejected (ambiguous contract during mixed-version deploys).

**Why this wins.** Clear separation between one-time onboarding completion and editable preferences; pure policy modules; additive API compatibility; contextual return intent preserved for bid, registration, telephone, and condition-report gates.

**Status.** *Implemented.* Policy in [apps/web/src/lib/kyc/](../../apps/web/src/lib/kyc/), persistence in [packages/persistence/src/interfaces/category-interests.repository.ts](../../packages/persistence/src/interfaces/category-interests.repository.ts), HTTP in [apps/api/src/routes/users/category-interests.routes.ts](../../apps/api/src/routes/users/category-interests.routes.ts).

## D20. Strict self-service bid identity eligibility

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
