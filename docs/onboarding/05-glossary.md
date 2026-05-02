# Glossary

The vocabulary that appears in this codebase. If a term shows up frequently, it's probably here.

**Aggregate.** In the context of `domain_events`, a logical entity that an event is "about". `aggregate_type` says what kind (`user`, `lot`, `payment`); `aggregate_id` is its primary key. Borrowed from DDD, but used loosely — you don't need an aggregate-root pattern in the application code.

**App.** A deployable unit. The repo has five: `apps/web`, `apps/api`, `apps/auth`, `apps/ws`, `apps/worker`. "Service" is sometimes used as a synonym at the deployment layer; in code, "service" means a class in `src/services/`.

**better-auth.** The authentication framework we use ([packages/auth/](../../packages/auth/)). Provides email/password, OAuth, OIDC, sessions, and JWTs. Configured in `packages/auth/src/server.ts`.

**BullMQ.** The Redis-backed job queue library we use for asynchronous work. Lives in `apps/worker` (target) and `apps/api` (today, for `lot-lifecycle`).

**CompositeAuthenticator.** The chain-of-responsibility implementation of `IAuthenticator` that tries cookie session first, then Bearer JWT (D10). Lives at [apps/api/src/infrastructure/composite-authenticator.ts](../../apps/api/src/infrastructure/composite-authenticator.ts).

**Cursor.** Two unrelated meanings.
1. The IDE most engineers on this team use.
2. The `last_processed_event_id` value in `projector_state` — each projector has its own cursor that walks forward through `domain_events`.

**D1, D2, …, D11.** Architectural decisions, listed in [docs/architecture/02-decisions.md](../architecture/02-decisions.md). Numbers never change. Reference them in code comments and PR descriptions.

**Domain event.** A row in `domain_events`, written in the same transaction as the entity it describes. The outbox pattern (D5, D8). See [docs/architecture/04-domain-events.md](../architecture/04-domain-events.md).

**Drizzle.** The TypeScript ORM we use ([packages/db/](../../packages/db/)). Schema-first; migrations are generated from `src/schema/` into `drizzle/`.

**External account.** A row in the `external_accounts` table, linking our canonical `user` to an identity in another system (Shopify customer, WordPress user, Apple `sub`, Google `sub`). See D3 and D11.

**F1, F2, …, F10.** Implementation revisions made during the planning phase. Referenced in some doc paragraphs. The numbers are stable; if you don't recognize one, check the planning conversation transcript.

**G1, G2, G3, G4.** Entry-gate decisions made before Phase 1 implementation began. Stable references.

**Hide My Email.** Apple's privacy-relay feature. When a user signs in with Apple and chooses "hide my email", Apple gives us a `@privaterelay.appleid.com` address. We persist it as-is in `external_accounts.email` and link by Apple `sub`, never by email — see D11 and [apps/api/src/services/account-linking.service.ts](../../apps/api/src/services/account-linking.service.ts).

**IAuthenticator.** The interface in `apps/api` that route handlers depend on for "tell me who the requester is, or null". Implementations: `BetterAuthAuthenticator`, `JwtAuthenticator`, `CompositeAuthenticator`.

**JWKS.** JSON Web Key Set — the public keys that consumers fetch from `/.well-known/jwks.json` to verify our JWTs. We store keys in the `jwks_key` table per D2.

**Outbox.** The pattern where a row in `domain_events` is written in the same DB transaction as the entity it describes, and a separate process projects those rows to external systems. D5/D8.

**Projector.** A class in `apps/worker/src/projectors/` that consumes from `domain_events` and writes to one external system. The Zoho projector and Xero projector are the two that exist today (as stubs).

**Q-numbers (Q1, Q2, …, Q51).** Open-questions answered during planning. The numbers are stable; some prose paragraphs reference specific Qs to point at where a value comes from.

**R1, R2, R3, R4, R5.** Risks identified during planning. Referenced in security and ops docs.

**Relying party.** In OIDC terminology, the application that delegates authentication to an OIDC issuer. WordPress, in our case, is a relying party against `apps/auth` (or `apps/api` while D7 is dual-stack).

**Role split.** The Postgres least-privilege setup with three application roles (`auth_app`, `api_app`, `worker_app`) plus a privileged owner. D2.

**SKIP LOCKED.** Postgres feature used by the projector runner to safely poll `domain_events` from multiple worker instances without coordination. D8.

**Webhook event.** A row in `webhook_event`, written by the inbound webhook handler before the worker processes it. Distinct from a domain event — webhook events are external-to-internal; domain events are internal-to-external.
