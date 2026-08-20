# LAX Identity boundary

This is the system of record for authentication across LAX products. It
implements [D13–D18](./02-decisions.md). Code registries override prose if this
document is not updated in the same change.

## Estate and ownership

| Property | Runtime | Identity posture |
|---|---|---|
| `auth.lax.bid` | `apps/auth` | Sole OIDC issuer, credentials, Identity sessions, token and security-event signing |
| `lax.bid` | `apps/web` BFF | Confidential RP `lax-bid-web`; opaque host-only Bid session |
| `api.lax.bid` | `apps/api` | Resource server `lax-bid-api`; Bearer tokens only |
| `ws.lax.bid` | `apps/ws` | Resource server `lax-ws`; Bearer token in Socket.IO handshake |
| `lax.art` | static marketing initially | No client, resource, API token, or login session |
| `shop.lax.art` | custom Shop; reference boundary in `apps/shop-identity` | Confidential RP `lax-shop-web`; opaque host-only Shop session; resource `lax-shop-api` |

Identity (`apps/auth`, `auth_app`) owns `user`, credentials, Better Auth
`account` and `verification`, Identity `session`, MFA evidence, OAuth/OIDC
grants, refresh-token families, signing keys, RP-session registration, logout
delivery, and SSF streams. Bid (`apps/api`, `api_app`) owns
`bid_user_profile`, legal entities, roles, KYC/AML, paddles, suspensions, bids,
and payments. Shop (`shop_app`) owns `shop_user_profile` and Shop sessions.
Workers may project lifecycle data through explicitly granted tables; they do
not become owners.

No product may query Identity tables directly, import `@auction/auth/server`,
or depend on Better Auth internals. It may use OIDC/JWKS, narrow internal
Identity operations with machine credentials, `@auction/identity-contracts`,
and versioned events. A database role grant is not permission to bypass this
boundary.

## RP/BFF flow and host-only sessions

1. The browser asks its product BFF to sign in.
2. The BFF creates state, nonce, and an S256 PKCE verifier, then redirects to
   `auth.lax.bid`.
3. The BFF exchanges the authorization code as its confidential client and
   verifies the ID token's RS256 signature, `iss`, client `aud`, expiry, nonce,
   `sub`, and `sid`.
4. Tokens remain server-side. The browser receives an opaque, Secure, HttpOnly,
   SameSite=Lax cookie with no `Domain` attribute.
5. Before calling an API, the BFF uses RFC 8693 token exchange for exactly one
   resource and forwards the resulting Bearer token.

There are no shared authentication cookies across `lax.bid`,
`auth.lax.bid`, or `shop.lax.art`. Preference or analytics cookies may use a
parent domain, but they are not credentials. The host-only cutover intentionally
logs users out once because old parent-domain sessions cannot safely be adopted.
APIs never fall back to a browser cookie or an Identity session lookup.

## Exact registries

The executable registries are
`packages/identity-contracts/src/clients.ts`, `resources.ts`, and `ssf.ts`.

| Client | Kind | Redirects | Post-logout redirects | Resources | Scopes |
|---|---|---|---|---|---|
| `lax-bid-web` | confidential | `http://localhost:3000/api/auth/callback/lax-bid-web`; `https://lax.bid/api/auth/callback/lax-bid-web`; `https://test.lax.bid/api/auth/callback/lax-bid-web` | corresponding origin `/` | `lax-bid-api`, `lax-ws` | `openid profile email offline_access bid.read bid.write` |
| `lax-shop-web` | confidential | `http://localhost:3010/auth/callback`; `https://shop.lax.art/auth/callback` | corresponding origin `/` | `lax-shop-api` | `openid profile email offline_access shop.read shop.write` |
| `ws-mobile` | public | `com.lax.bid:/oauth/callback` | none | `lax-ws` | `openid profile email offline_access bid.read` |

All interactive clients require S256 PKCE. Redirect and post-logout URIs are
separate exact allowlists with no wildcards.

| Resource id / access-token `aud` | RFC 8707 resource | Allowed product scopes |
|---|---|---|
| `lax-bid-api` | `https://api.lax.bid` | `bid.read`, `bid.write` |
| `lax-ws` | `https://ws.lax.bid` | `bid.read` |
| `lax-shop-api` | `https://shop.lax.art/api` | `shop.read`, `shop.write` |

`lax.art` is absent because static marketing has no protected API. Resource
access tokens are RS256 JWTs with a 15-minute lifetime and exactly one audience.
The RFC 8693 endpoint accepts a client-bound subject token and rejects arbitrary
or multiple resources, unregistered client/resource combinations, scopes
outside both registries, and disabled or merged subjects.

## Token classes and verifier obligations

- Identity session cookie: host-only to `auth.lax.bid`; usable only by Identity.
- Product BFF cookie: opaque local session id; host-only to that product.
- ID token: assertion to one OIDC client; never sent as an API credential.
- Refresh token: server-side, client-bound, rotating family; reuse revokes the
  family and related sessions outside the encrypted retry grace.
- Resource access token: Bearer JWT for one resource audience and namespaced
  scopes.
- Logout token: `typ=logout+jwt`, audience is the OIDC client.
- Security Event Token: `typ=secevent+jwt`, audience is the receiver resource.
- Machine credential: confidential client credentials for narrow internal
  Identity operations; never a browser credential.

The verifier contract requires RS256, normalized issuer
`https://auth.lax.bid`, exact audience, expiry/issued-at policy, token class,
and required scopes before product authorization is loaded locally by immutable
`sub`. Shared API and WS verification explicitly pins `algorithms: ["RS256"]`
in `jose`, rejects multi-resource and cross-resource audiences, and denies
missing required scopes. Bid's centralized scope policy requires `bid.read` for
protected `GET`, `HEAD`, and `OPTIONS` requests and `bid.write` for protected
mutations before capability or entity authorization runs. Public routes remain
public because the scope policy is composed only with required authentication.
The WS direct-resource and one-time BFF ticket paths both require audience
`lax-ws` and `bid.read`. Unknown `kid` triggers a JWKS refresh and failure is
deny-by-default. ID tokens are not API credentials.

The retired `lax-api` audience is denied by default. The temporary
`ALLOW_LEGACY_LAX_API_AUDIENCE=true` migration flag accepts it only while
emitting `identity_legacy_audience_accepted` telemetry; remove the flag and
compatibility branch after zero acceptances for 30 consecutive days.

OIDC advertises public subjects. `sub` is the canonical immutable Identity id.
Pairwise subjects require a new decision only when an external or independently
controlled RP needs cross-client unlinkability.

## Session and assurance claims

`sid` identifies the Identity session that authorized the RP and is stored in
the RP's local session for targeted logout. `auth_time` is the Identity session
creation time as NumericDate seconds. `acr` is:

- `urn:mace:incommon:iap:bronze` for ordinary password, passwordless, or social
  authentication;
- `urn:mace:incommon:iap:silver` only when that session completed MFA or has a
  successful recent password step-up.

MFA enrollment alone does not raise assurance. `amr` is emitted only from
evidence: `pwd` for password, and `pwd otp` after TOTP/backup-code completion.
It is omitted when the method is not reliably known.

## Logout, revocation, and introspection

RP-initiated logout uses `/api/auth/oauth2/endsession` with an ID-token hint and
an exactly registered post-logout redirect. Confidential clients may use
`/api/auth/oauth2/revoke` and `/api/auth/oauth2/introspect`. Revocation can
invalidate refresh families and enqueue client-targeted logout.

Back-channel endpoints are:

- Bid: `https://lax.bid/api/auth/backchannel-logout`
- Shop: `https://shop.lax.art/api/auth/backchannel-logout`

Identity records RP sessions and durably delivers RS256 logout tokens. A
session-targeted token carries `sid`; a subject-wide token may carry `sub`.
Delivery uses four-way concurrency, a five-second timeout, eight attempts, and
exponential backoff beginning at 15 seconds and capped at one hour.

A receiver must require form content type and exactly one `logout_token`;
verify RS256, `typ=logout+jwt`, issuer, its client audience, `iat` age, `jti`,
the single back-channel event, absence of `nonce`, and at least one usable `sid`
or `sub`; atomically reserve `jti`; invalidate every matching local session; and
return success only after durable invalidation. Replays and malformed tokens are
4xx. Bid stores replay JTIs in Redis for five minutes; Shop uses
`shop_logout_token_replay`.

## SSF / CAEP / RISC

SSF is not logout. Auth exposes `/.well-known/ssf-configuration`,
`/ssf/stream`, `/ssf/status`, and `/ssf/verification`. Stream operations require
the registered confidential client's Basic authentication and an exact endpoint:

- `lax-bid-web`: `https://api.lax.bid/ssf/events`, audience `lax-bid-api`
- `lax-shop-web`: `https://shop.lax.art/api/ssf/events`, audience `lax-shop-api`

Local development endpoints are `http://localhost:3001/ssf/events` and
`http://localhost:3010/api/ssf/events`. Streams are provisioned disabled and
delivery runs only when `SSF_DELIVERY_ENABLED=true`.

Supported signals are CAEP session-revoked and credential-change; RISC
account-disabled, account-enabled, and account-purged; and the first-party
account-merged event. A verification SET is separate. Each SET has one event,
opaque `sub_id`, unique `jti`, optional transaction correlation `txn`, current
signing `kid`, and the exact receiver audience.

All Identity lifecycle changes are written transactionally to
`identity_lifecycle_outbox`. SSF maps signals directly from that outbox, while
the worker relays the same rows to `domain_events` for product projectors.
Migration `0152_ssf_reset_outbox_checkpoint` must run before deploying an Auth
build that publishes the final credential, session, and deletion events through
the outbox; it moves existing stream checkpoints to the outbox id space without
replaying historical signals.

Receivers require `application/secevent+jwt`, RS256, `typ=secevent+jwt`, issuer,
audience, known event schema, one event, `iat` no older than 300 seconds and no
more than 30 seconds in the future. JTI reservation and event application must
commit atomically. Replays, stale/future SETs, invalid signatures, and
unsupported events return 4xx. Delivery is durable with `pending`,
`delivering`, `delivered`, and `failed` states; stale claims are recovered,
retries use exponential backoff capped at one hour, and operators replay failed
rows only after the receiver is fixed.

## Availability and failure behavior

- Existing product sessions and resource-token verification do not require a
  live Identity request. A cached valid JWKS permits local verification.
- A new login, refresh, token exchange, revocation, introspection, or stream
  configuration fails closed when Identity is unavailable.
- A BFF that cannot refresh or exchange redirects to sign-in; it never forwards
  an ID token or substitutes its cookie at the API.
- A missing product profile denies protected product activity until
  reconciliation repairs the projection.
- Logout and SSF delivery failures are durable and observable. They do not block
  the Identity transaction, and neither mechanism is treated as confirmation of
  the other.
- Global disablement revokes Identity/OAuth sessions and is projected to
  products; each product must deny locally even if another receiver is down.

## Per-product database split exit criteria

The current single cluster with role isolation is transitional. A product may
move to its own database only after all of these are true:

1. Migration `0140` compatibility triggers are removed.
2. Bid-owned legacy columns are removed from `user`, with no dual reads or
   writes and reconciliation clean through the agreed soak.
3. Bid foreign keys to Identity `user` are replaced by unconstrained immutable
   subject ids plus application-level existence/lifecycle handling.
4. Shared profile projectors and repositories are split into product-owned
   consumers with replay, dead-letter, and reconciliation procedures.
5. No product query, join, migration, or runtime role reads Identity tables.
6. Backup, deletion, merge, disablement, incident rollback, and event-lag gates
   pass in a disposable and target environment.

`apps/auth` owns its Postgres pool and exposes only the `packages/identity-db`
schema to Identity adapters. Orphan-signup compensation checks Bid profile and
external-link usage through the machine-authenticated product API with a bounded,
fail-closed request; `apps/auth` has no product database package, query, or grant.
This completes the Identity side of criterion 5. Product-side reads and joins of
Identity tables remain open until product-local projections replace them.

The first product-side cut is the worker Identity directory. Migration `0156`
creates and backfills `bid_identity_directory`, a minimal non-authoritative PII
read model with an unconstrained immutable `subject_id`. A dedicated worker
projector consumes registration, profile, email-verification, deletion-request,
merge, and deletion events; deletion hard-removes the directory row. Worker
notification, marketing, finance, and cleanup readers use this directory rather
than joining Identity `user`.

The worker owns projection writes and ordering. `identity_created_at` preserves
the issuer's subject creation time, `replicated_at` records the latest local
projection application time for freshness/lag checks, and `last_event_id`
prevents stale or duplicate events from overwriting newer state. Product readers
must `LEFT JOIN` the directory: a hard-deleted Identity subject intentionally has
no directory row, while durable bids, payments, and audit records remain.

After the directory reconciliation reports no missing, orphaned, mismatched, or
pending rows through the agreed soak, migration `0157` revokes `worker_app`
SELECT on `user`. API and shared persistence readers use the same directory for
contact, display, verification, deletion-request, and merge facts. Authoritative
MFA, phone-verification, pending email-change, and verified-email ownership reads
use the machine-authenticated Identity HTTP boundary instead of widening the
projection. Admin directory filtering is product-local; Identity-only 2FA and
activity filters are intentionally absent, while selected-user security detail is
loaded live. After the same reconciliation soak, migration `0158` revokes
`api_app` SELECT on `user`.

Code and static exit gates for migrations `0156`–`0158` are implemented. Target
environment reconciliation, soak, migration application, and live role probes
remain operational promotion evidence; they are not implied by a green source
check. `migrate-roles` preserves an already-present pre-`0158` API read during
the soak, but treats `user` as migration-controlled and cannot regrant it after
`0158`.

The directory does not contain credentials, MFA state, pending email-change state,
or any other security decision input; those remain authoritative Identity facts
and require a live Identity boundary when needed.

Identity maintenance is also issuer-owned: `apps/auth` performs bounded
verification cleanup and the 30-day deletion/PII scrub. No product process
writes an Identity table. Migration `0153_repair_user_pii_purge` keeps the
deletion function aligned with the Identity-only `user` schema contracted by
`0150`.

Identity email delivery depends only on the `EmailSender` port. The issuer posts
email intents to the machine-authenticated Bid internal API, which snapshots the
Identity-supplied recipient into the existing product email outbox. `apps/auth`
does not import the email or queue packages and `auth_app` has no email-pipeline
table grants. Requests use a bounded timeout and one idempotent retry; accepted
intents retain the existing outbox and BullMQ delivery guarantees.

Until every criterion passes, role isolation is a boundary but not a claim of
physical database separation.

## Deployment gates

Apply migrations `0143`, `0144`, `0145`, then `0146`. Rollback only in reverse:
`0146_rollback.sql`, `0145_rollback.sql`, `0144_rollback.sql`,
`0143_rollback.sql`. Do not enable SSF until each receiver passes verification.
Do not claim production readiness until migrations, role contracts, target-host
OIDC/BFF E2E, logout delivery, SSF verification/delivery, and reconciliation
gates have run.

For the Bid directory cutover, apply `0156`, deploy the projector and
directory-backed readers, reconcile and soak, apply `0157`, deploy/soak all API
and export readers, apply `0158`, and only then run the normal role
reconciliation. Rollback is coupled in reverse: restore the `0158` grant before
rolling API code back, and restore `0157` before rolling worker readers back.
Never use a role-script rerun as a migration rollback.

See [new-platform onboarding](../runbooks/onboard-lax-platform.md),
[SSF operations](../runbooks/ssf-stream-operations.md),
[back-channel logout triage](../runbooks/backchannel-logout-triage.md), and
[identity cutover](../runbooks/identity-boundary-cutover.md).
