# Auth go-live rollout (phased)

1. **DB**: Run collision report → apply `0057_auth_hardening` during a maintenance window.
2. **JWKS + env**: Deploy `apps/auth` with `pg_try_advisory_xact_lock` retirement and `AUTH_DEK_KEY`; deploy `apps/api` with its separate `CHECK_IN_TOKEN_SECRET`; set `JWT_AUDIENCE`, `WEB_ORIGINS`, and production `superRefine` validations.
3. **Encryption**: Set `AUTH_DEK_KEY`, deploy auth stack with adapter + JWKS envelope writes; run `pnpm --filter @auction/db db:backfill-auth-at-rest` once against the auth DB.
4. **Core + UX**: Deploy web redirect hardening, logout broadcast, reset-password URL strip, session revocation hooks.
5. **Sessions UI + step-up + Turnstile**: Enable after API routes for `/me/sessions` and `POST /auth/reauth` ship.
6. **CSP**: Start `Content-Security-Policy-Report-Only` on marketing surfaces; fix violations; switch to enforce (`CSP_ENFORCE=1` on `apps/web`). Before enforcing, in **Cloudflare** disable **Scrape Shield → Email Address Obfuscation** for each zone (`lax.bid`, `test.lax.bid`, etc.): Cloudflare injects `cdn-cgi/scripts/.../email-decode.min.js`, which violates `script-src 'strict-dynamic'` and cannot be allowlisted by host when enforcing.
7. **GDPR purge**: Apply `0058_user_pii_purge.sql` and
   `0156_repair_user_pii_purge.sql`; the daily `apps/auth` deletion schedule
   calls `SELECT user_pii_purge(id)` in batches for subjects past the 30-day
   cooling-off period.
8. **Retired maintenance queues**: after deploying the auth-owned schedules,
   remove the stale BullMQ repeatable entries `purge-expired-verifications-6h`
   and `purge-soft-deleted-users-weekly` from Redis. The worker no longer
   registers or consumes either queue.
9. **Identity email boundary**: deploy the API
   `/internal/identity/emails` endpoint first, with the same
   `IDENTITY_MACHINE_CLIENT_ID` and `IDENTITY_MACHINE_CLIENT_SECRET` configured
   on API and auth. Set auth's `API_INTERNAL_BASE_URL`, deploy the HTTP sender,
   and verify a password-reset/verification intent reaches `email_outbox`.
   Apply `0157_revoke_auth_email_pipeline` only after that verification; applying
   it while an old auth instance is still serving removes its enqueue access.
10. **Identity product-usage boundary**: deploy the API
    `/internal/identity/subject-usage/:subjectId` endpoint first. Configure
    auth's `IDENTITY_SUBJECT_USAGE_TIMEOUT_MS`, deploy the HTTP probe, and verify
    an orphan-compensation request reaches the API and fails closed when the API
    is unavailable. Apply `0158_revoke_auth_product_reads` only after that
    verification; applying it while an old auth instance is serving removes its
    direct `bid_user_profile` and `external_accounts` access.
11. **Worker Identity directory boundary**: apply `0159` first to create and
    backfill `bid_identity_directory`. Deploy auth with profile-image and
    deletion-request lifecycle publishers, then deploy worker with the dedicated
    directory projector and directory-backed readers. Soak until
    `DATABASE_URL_OWNER=... node scripts/ci/verify-identity-directory-drift.mjs`
    reports no missing, orphaned, mismatched, or pending rows within the configured
    processing-lag threshold (`IDENTITY_DIRECTORY_MAX_PROCESSING_LAG_MS`, default
    60000). A default `pnpm db:migrate:prod` stops at `0159`. Only then apply
    `0160_revoke_worker_user_reads` with
    `PRODUCTION_MIGRATION_THROUGH=0160 pnpm db:migrate:prod`.
    Applying `0160` while an old worker instance is serving breaks its direct
    notification, marketing, finance, and media-cleanup reads from `user`.
12. **Bid API Identity directory boundary**: deploy auth's machine-authenticated
    subject security-status read first, then deploy API, persistence, exports,
    and web admin filtering together. API contact/display reads must use
    `bid_identity_directory`; MFA, phone-verification, pending email-change, and
    verified-email ownership checks must use the live Identity boundary. Soak
    until `verify-identity-directory-drift.mjs` remains clean, then apply
    `0161_revoke_api_user_reads` with
    `PRODUCTION_MIGRATION_THROUGH=0161 pnpm db:migrate:prod` (0160 must already
    be applied). Applying `0161` while an old API instance is
    serving breaks profile, admin, invitation, payment, saleroom, and export
    reads that still join `user`. Normal role reconciliation preserves the
    existing soak grant before `0161` but will not recreate it afterward.
    Confirm the live API role can `SELECT` but cannot write
    `bid_identity_directory`, and has no `user` privilege.
    Directory-backed product records use left joins so Identity hard deletion
    removes copied PII without deleting durable auction history.
13. **Rollback coupling**: before rolling API code back across step 12, apply
    `0161_rollback.sql` and set `PRODUCTION_MIGRATION_THROUGH=0160` (or unset it);
    before rolling worker readers back across step 11, apply
    `0160_rollback.sql` and unset `PRODUCTION_MIGRATION_THROUGH`. Roll
    deployments and grants back as one change. A `db:roles` rerun is not a
    substitute for either rollback migration. Leaving the promotion value set
    re-applies the revoke on the next `pnpm db:migrate:prod`.

See also: [key rotation](../security/key-rotation.md),
[JWKS rotation](./jwks-rotation.md), and
[identity boundary cutover](./identity-boundary-cutover.md).

## Standalone Identity staging release

The D23 source extraction changes staging image ownership without changing the
issuer, database, or migration authority. `LAX-UK/lax-identity` publishes
`lax-test-identity:<sha>` and the rolling `:test` tag only after standalone CI
passes. It then sends an authenticated deployment request to the monorepo.

The monorepo remains the only staging deployment orchestrator. It must serialize
the request with ordinary staging releases, verify the dispatched image digest
and pinned migration contract, ensure the required migrate image is from a
compatible green commit, apply/verify migrations, reconcile roles, and run
`db:configure-oidc-clients` before App Platform deployment.

The staging Auth component keeps `https://test-auth.lax.bid`, the shared
`auth_app` connection, and all existing runtime secrets. It pulls
`lax-test-identity`, admits traffic through `/health/ready`, and obtains
`SENTRY_RELEASE` from the image SHA. Its production env must include non-local
`API_INTERNAL_BASE_URL`, matching Identity machine credentials, a protected
metrics token, and `SSF_DELIVERY_ENABLED=false` until both receivers pass
verification. The staging Shop relying party is
`https://test-shop.lax.art`; its callback, post-logout URI, back-channel logout
receiver, and SSF receiver are test-only registrations. Run the acceptance
workflow once with delivery disabled to prove durable queuing, apply the
reviewed ephemeral layer with `enable_auth_ssf_delivery=true`, then rerun
acceptance with `ssf_delivery_enabled=true` and
`ssf_failure_rehearsal=true` to prove retry, dead-letter, recovery, signed
delivery, and replay rejection.

Do not remove the monorepo production image or transfer source authority until
the signed [Identity staging extraction evidence](./identity-staging-extraction-evidence.md)
contains target-host adversarial gates, live role/reconciliation results,
measured soak thresholds, and both rollback rehearsals.

## Canonical issuer and BFF gate

`apps/auth` is the sole issuer and API issuer routes are retired. Promotion of
the host-only RP/BFF architecture requires all of the following:

- Discovery/JWKS issuer, signing keys, and no-store policy are correct at
  `auth.lax.bid`.
- Bid and Shop code exchange, host-only product sessions, resource exchange,
  password change, lifecycle events, and email verification pass.
- `auth_app` role and schema/grant drift contracts pass after production migrations.
- Dashboards, alerting, rollback routing, and a JWKS/key snapshot are confirmed.
- No API accepts a browser cookie or calls an Identity session endpoint to
  authenticate a resource request.
- Back-channel logout passes for Bid and Shop. SSF streams remain disabled until
  verification and the dedicated operations runbook pass.

The cookie cutover causes one intentional logout. Do not claim production
readiness until target-environment migration and E2E evidence is reviewed.

## Backfill: personal legal entity for users missing provisioning (LAX-PROD-AUTH-2)

After deploying the `user.registered` → worker projector flow, optionally enqueue domain events for users who signed up while `auth_app` lacked `legal_entity` write access. The worker projector provisions entities idempotently on the next tick.

Run once against production (or test) as `DATABASE_URL_OWNER`:

```sql
INSERT INTO domain_events (aggregate_type, aggregate_id, event_type, payload, producer, schema_version)
SELECT 'user', u.id, 'user.registered',
       jsonb_build_object('userId', u.id, 'email', u.email, 'name', u.name, 'source', 'backfill'),
       'ops/backfill', 1
FROM "user" u
LEFT JOIN legal_entity le ON le.created_by_user_id = u.id AND le.kind = 'individual'
WHERE le.id IS NULL;
```

Do not run automatically in deploy scripts. Users who hit an authenticated API path before the projector runs are still covered by lazy `ensurePersonalEntity` on the API side.
