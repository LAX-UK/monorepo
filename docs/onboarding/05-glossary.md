# Glossary

The vocabulary that appears in this codebase. If a term shows up frequently, it's probably here.

**Aggregate.** In the context of `domain_events`, a logical entity that an event is "about". `aggregate_type` says what kind (`user`, `lot`, `payment`); `aggregate_id` is its primary key. Borrowed from DDD, but used loosely — you don't need an aggregate-root pattern in the application code.

**App.** A deployable unit. The repo has six: `apps/web`, `apps/api`,
`apps/auth`, `apps/ws`, `apps/worker`, and `apps/shop-identity`.
The Shop identity app is the executable RP/BFF boundary for the custom Shop at
`shop.lax.art`; the customer-facing storefront remains to be delivered.

**better-auth.** The authentication framework we use ([packages/auth/](../../packages/auth/)). Provides email/password, OAuth, OIDC, sessions, and JWTs. Configured in `packages/auth/src/server.ts`.

**BullMQ.** The Redis-backed job queue library we use for asynchronous work. Lives in `apps/worker` (target) and `apps/api` (today, for `lot-lifecycle`).

**BFF (backend for frontend).** The server-side component for a browser product.
It performs OIDC, retains tokens, issues an opaque host-only product session,
and exchanges audience-bound resource tokens before API calls (D15).

**Cursor.** Two unrelated meanings.
1. The IDE most engineers on this team use.
2. The `last_processed_event_id` value in `projector_state` — each projector has its own cursor that walks forward through `domain_events`.

**D1, D2, …, D11.** Architectural decisions, listed in [docs/architecture/02-decisions.md](../architecture/02-decisions.md). Numbers never change. Reference them in code comments and PR descriptions.

**Domain event.** A row in `domain_events`, written in the same transaction as the entity it describes. The outbox pattern (D5, D8). See [docs/architecture/04-domain-events.md](../architecture/04-domain-events.md).

**Drizzle.** The TypeScript ORM we use ([packages/db/](../../packages/db/)). Schema-first; migrations are generated from `src/schema/` into `drizzle/`.

**Email outbox.** A row in `email_outbox`. Structurally similar to a domain event but **separate** — it tracks a single transactional/notification email through `pending → sending → sent | failed | suppressed`. Written by `IEmailService.enqueue()`, drained by the `email` BullMQ worker. See [docs/architecture/04-domain-events.md → "Email pipeline"](../architecture/04-domain-events.md#email-pipeline).

**Email category.** Either `auth` (verification, reset, password changed, change email, invite) or `transactional` (everything else). `auth` sends bypass `email_suppression`; `transactional` sends respect it. Carried on the `email_outbox.category` column.

**Email stream.** Postmark concept, surfaced as `email_outbox.stream`. Either `transactional` (per-user mail) or `broadcast` (bulk, e.g. announcements). The Postmark sender picks the right server stream based on this column.

**IEmailService / IEmailSender.** Two seams in `@auction/email`. `IEmailService.enqueue()` is the only entry point callers in `apps/auth` and `apps/api` are allowed to use; it writes the outbox row. `IEmailSender.send()` is what the `send-email` worker job calls; only the worker may import a Postmark SDK.

**Suppression list.** The `email_suppression` table (PK = SHA-256 of the address). Hard bounces, complaints, and global unsubscribes write rows here. Looked up at enqueue time to short-circuit transactional sends.

**List-Unsubscribe (one-click).** RFC 8058 header that Postmark adds when we set the corresponding outbox flag. Carries an HMAC-signed token (`EMAIL_UNSUBSCRIBE_SECRET`); hitting the URL flips the matching `notification_preference.*_email` column or — for global unsubscribe — writes `email_suppression(reason='unsubscribe')`. `auth` and payment templates intentionally omit this header.

**Preference center.** The web page at `/email/unsubscribe` that renders when a user clicks an unsubscribe link, showing per-notification toggles plus a global unsubscribe option. Implemented in `apps/api/src/routes/email.ts`.

**Newsletter signup log.** The `newsletter_signup_log` table — an audit row per `POST /api/newsletter/subscribe` and the result of pushing it to Zoho Campaigns. Subscriber state itself lives in Zoho; we keep this table only for GDPR access/erasure proof.

**External account.** A row in the `external_accounts` table, linking our canonical `user` to a trusted external identity. The table and repository remain generic; social sign-in identities are currently managed through Better Auth's account model. See D3 and D11.

**F1, F2, …, F10.** Implementation revisions made during the planning phase. Referenced in some doc paragraphs. The numbers are stable; if you don't recognize one, check the planning conversation transcript.

**G1, G2, G3, G4.** Entry-gate decisions made before Phase 1 implementation began. Stable references.

**Hide My Email.** Apple's privacy-relay feature. When a user signs in with Apple
and chooses "hide my email", Apple gives Identity a
`@privaterelay.appleid.com` address. Better Auth keys that account by Apple's
provider account ID; it is not heuristically merged with a real-email subject.
See D11.

**IAuthenticator.** The interface in `apps/api` that route handlers depend on for
"tell me who the requester is, or null". Remote cookie-session and local JWT
verification are composed, then `BidContextEnrichedAuthenticator` loads
Bid-owned authorization.

**JWKS.** JSON Web Key Set — the public keys that consumers fetch from `/.well-known/jwks.json` to verify our JWTs. We store keys in the `jwks_key` table per D2.

**Outbox.** The pattern where a row in `domain_events` is written in the same DB transaction as the entity it describes, and a separate process projects those rows to external systems. D5/D8.

**Projector.** A class in `apps/worker/src/projectors/` that consumes from `domain_events` and writes to one external system. The Zoho projector and Xero projector are the two that exist today (as stubs).

**Q-numbers (Q1, Q2, …, Q51).** Open-questions answered during planning. The numbers are stable; some prose paragraphs reference specific Qs to point at where a value comes from.

**R1, R2, R3, R4, R5.** Risks identified during planning. Referenced in security and ops docs.

**Relying party.** An application that delegates authentication to an OIDC
issuer. `lax-bid-web` and `lax-shop-web` are confidential relying parties
against `apps/auth`.

**Role split.** The Postgres least-privilege setup with three application roles (`auth_app`, `api_app`, `worker_app`) plus a privileged owner. D2.

**SKIP LOCKED.** Postgres feature used by the projector runner to safely poll `domain_events` from multiple worker instances without coordination. D8.

**Webhook event.** A row in `webhook_event`, written by the inbound webhook handler before the worker processes it. Distinct from a domain event — webhook events are external-to-internal; domain events are internal-to-external.
