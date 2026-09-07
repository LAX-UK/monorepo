# Identity boundary cutover

Staged rollout for the LAX Identity boundary ([architecture/09-lax-identity-boundary.md](../architecture/09-lax-identity-boundary.md)).

## Standalone staging source transition

This runbook also governs the D23 extraction to `LAX-UK/lax-identity`.
The transition does not move the database or change the issuer:

| Responsibility | Owner during staging extraction |
|---|---|
| Six-path issuer source and `lax-test-identity` image | `LAX-UK/lax-identity` after acceptance |
| Shared migration journal, migrate image, role grants | monorepo |
| OIDC client registry provisioning | monorepo |
| Bid/Shop projectors and relying-party contracts | monorepo |
| App Platform staging deployment orchestration | monorepo |
| Production auth image and rollback source | frozen monorepo closure |

Release order is fail-closed:

1. A green monorepo commit publishes the migrate image required by the
   standalone repository's `schema-contract.json`.
2. The deployment orchestrator verifies migration lineage, applies migrations,
   reconciles roles, and runs the full OIDC client registry command.
3. A green standalone commit publishes immutable and rolling Identity tags,
   creates its Sentry release/source maps, and dispatches its SHA and digest.
4. The monorepo validates the dispatch and image digest, serializes deployment,
   and starts the App Platform release.
5. The target-host acceptance bundle and soak record decide acceptance or
   rollback.

Neither repository may add an Identity schema migration during this phase.
Public contract changes require the later package-publication/consumer cutover.
An emergency change to the frozen production fallback requires the
`identity-fallback-hotfix` label and a recorded synchronization patch.

## Migration-lineage preflight

The only supported production upgrade path is released main through
`0139_complete_buyer_interest_categories`, followed by the renumbered Identity
sequence `0140`–`0161`. Before promotion, inspect
`drizzle.__drizzle_migrations` and verify that the applied hashes match the
current repository. The production runner now rejects a missing, duplicate, or
mismatched applied timestamp.

Stop for manual reconciliation if an environment ever ran the superseded
feature-branch ordering that placed Identity migrations at `0137` onward. Its
timestamps collide with released main while representing different SQL, so
renaming files or rerunning the current migrator cannot repair that database.
At minimum, inventory the migration rows and confirm
`public.user_category_interest`, its completion marker, `bid_user_profile`, and
the final ownership foreign key before designing a compensating procedure.

## Phase 1 — Schema and contracts (no traffic change)

1. Apply the released buyer-interest migrations `0137` through `0139`, then
   Identity migrations `0140` through `0145`; execute every checked rollback-pair
   verifier against a disposable database before promotion.
2. Verify backfill: every active `user` has a matching `bid_user_profile` row (`pnpm --filter @auction/db db:reconcile-identity-profiles`).
3. In the issuer maintenance window, run `db:backfill-auth-at-rest` so existing
   OIDC bearer columns use `h1:` fingerprints before deploying the wrapped
   adapter.
4. Deploy packages with `@auction/identity-contracts` and authoritative Bid
   profile writers.
5. Confirm live `auth_app`, `api_app`, `shop_app`, and `worker_app` role
   contracts plus the Identity field-ownership contract.

## Phase 2 — Event projection and reconciliation

1. Deploy Identity event publishers (`user.profile_updated`, disable/enable, merge).
2. Do not enable lifecycle publishers until migration `0145` is present. Confirm
   worker projectors advance cursors for `shop_identity_projection` and
   `bid_profile_provisioning`.
3. Run reconciliation job / backfill for missing `user.registered` rows (existing runbook SQL).
4. Monitor projector lag vs signup rate.

### Bid Identity directory cutover (implemented code path)

1. Apply through `0159` with a normal production migrate, deploy the
   worker-owned `bid_identity_directory` projector and directory-backed worker
   readers, then reconcile and soak.

   ```sh
   pnpm db:migrate:prod
   ```

2. Apply `0160` only after worker drift and lag remain clean.

   ```sh
   PRODUCTION_MIGRATION_THROUGH=0160 pnpm db:migrate:prod
   ```

3. Deploy and soak directory-backed API, persistence, and export readers. Their
   durable product-record joins must be left joins: Identity hard deletion
   removes copied PII, not bids, payments, or audit history.
4. Apply `0161`, then run role reconciliation. Probe that `api_app` can select
   but cannot write the directory and has no access to `user`.

   ```sh
   PRODUCTION_MIGRATION_THROUGH=0161 pnpm db:migrate:prod
   ```

Do not jump from `0159` to `0161` in one migrate. The production runner
fail-closes unless `0160` is already applied. On App Platform, set
`PRODUCTION_MIGRATION_THROUGH` on the migrate Job to `0160` or `0161` and
rerun the deploy Job (`pnpm db:migrate:prod`). Leave local/CI on
`pnpm db:migrate`, which still applies the full journal.

Role reconciliation is safe during both soak stages: it preserves an existing
worker/API `user` read until `0160`/`0161` respectively removes it, and it does
not recreate a grant after that migration-controlled cutover.

`identity_created_at` is issuer subject creation time; `replicated_at` is the
latest local projection-application time used for freshness checks; neither is
product activity. `last_event_id` is the projector ordering/idempotency cursor.

## Phase 3 — Standalone issuer traffic

1. Set `NEXT_PUBLIC_AUTH_URL` and `OIDC_ISSUER_URL` to `https://auth.lax.bid`.
2. Run `db:configure-oidc-clients` without `OIDC_CLIENT_IDS` so the registry is
   authoritative and orphaned clients are disabled. Secrets come from the
   deployment secret manager, never migrations.
3. Before that full-registry run, inventory live `oauth_application.client_id`
   values and confirm every unregistered client is intentionally retired. If
   any exist, rerun with `OIDC_DISABLE_UNREGISTERED=true` only after that review.
4. Restrict `/internal/*` at the edge to trusted service traffic; keep the
   issuer-side machine-token rate limit enabled.
5. Soak in test; verify Shop OIDC round-trip.

## Phase 4 — Product BFF and Bearer-only API

1. Deploy the Bid confidential BFF with
   `OIDC_CLIENT_SECRET_LAX_BID_WEB` and
   `BID_BFF_SESSION_ENCRYPTION_KEY`; deploy API Bearer-only authentication.
2. Expect one logout when replacing the parent-domain cookie with host-only
   Identity and Bid cookies.
3. Verify callback, host-only session, RFC 8693 exchange, SSR `/users/me`,
   `lax-bid-api`, and `lax-ws` paths.
4. Confirm API `/.well-known/*` and `/api/auth/*` return 404 and browser cookies
   are rejected as API credentials.

## Phase 5 — Shop RP/BFF

1. Deploy the Shop boundary with `DATABASE_URL_SHOP`, client secret, callback,
   post-logout URI, and `SESSION_SECRET`.
2. Run `verify-shop-oidc-roundtrip.mjs`, cold login, SSO, logout isolation, and
   projection-disable tests.
3. Confirm the executable boundary still matches the custom Shop contract for
   `shop.lax.art`.

## Phase 6 — Logout and SSF

1. Apply migrations `0146`, `0147`, `0148`, then `0149`.
2. Verify Bid and Shop back-channel receivers before relying on delivery.
3. Provision SSF streams disabled; send verification SETs to both exact
   receivers.
4. Enable streams, then set `SSF_DELIVERY_ENABLED=true`; monitor delivery
   outcomes and replay/dead-letter behavior.

## Rollback

- Roll back the API and auth deployment images as one tested release unit.
- For a standalone staging regression, first move `lax-test-identity:test` back
  to a previously accepted standalone SHA and redeploy through the monorepo
  orchestrator.
- For extraction rollback, revert the staging Terraform auth image repository
  and Sentry-release env change together, then deploy the recorded
  `lax-test-auth:<sha>`. Do not retag a monorepo image into the standalone
  repository or change DNS.
- Do not recreate the issuer inside `apps/api` with a runtime flag.
- Disable SSF delivery before schema rollback. Reverse `0149`, `0148`, `0147`,
  `0146`, then earlier migrations in descending order. Earlier profile
  rollbacks are unsafe while later triggers or columns still exist.
- Bid profile dual-read continues from `user` legacy columns until forward migration is reversed.
- Reverse `0161` before rolling API readers back, and reverse `0160` before
  rolling worker readers back. The role script preserves each pre-cutover soak
  grant but deliberately cannot recreate it after revocation.
- After `0161_rollback.sql`, set `PRODUCTION_MIGRATION_THROUGH=0160` (or unset
  it to stay at `0159`) before the next `pnpm db:migrate:prod`. After
  `0160_rollback.sql`, unset `PRODUCTION_MIGRATION_THROUGH`. Leaving the
  promotion value in place re-applies the grant revoke on the next Job.

## Evidence checklist

- [x] Code: canonical issuer and retired API-route gate (`scripts/ci/verify-identity-boundary.mjs`)
- [x] Code: `bid_user_profile` dual-write + dual-read with mismatch telemetry
- [x] Code: Identity `user.profile_updated` publisher on auth user updates
- [x] Code: OIDC client metadata + secret-backed provisioning command
- [ ] Canonical single-host discovery/JWKS in target environment
- [ ] Sign-in, host-only Bid BFF session, refresh, and resource exchange
- [ ] Bid authorization unchanged (roles from `bid_user_profile`)
- [ ] Shop OIDC/BFF round-trip and local profile
- [ ] Bid and Shop back-channel logout delivery/replay
- [ ] SSF verification, enablement, retry, dead-letter, and replay
- [ ] All four application role contracts pass against live Postgres
- [ ] Reconciliation job green; no unbounded projector lag
- [x] Code: migrations `0159`–`0161`, directory-backed readers, and static exit gates
- [ ] Target: directory reconciliation soak, `0160`/`0161`, and live API/worker role probes
- [ ] Dashboards and rollback routing documented
- [ ] Standalone CI ran DB integration tests against the pinned migration-image digest
- [ ] Extracted history passed a full-history secret scan
- [ ] `lax-test-identity:<sha>` digest, SBOM, Sentry release, and source maps recorded
- [ ] Staging `/health/ready` admitted traffic with the required production env
- [ ] Machine issue/introspect/revoke, RFC 8693, origin/CSRF, and rate-limit live probes
- [ ] Lifecycle outbox/projector lag and directory drift stayed within signed thresholds
- [ ] Standalone-image rollback and monorepo-fallback rollback both rehearsed
- [ ] Identity staging extraction acceptance record signed by Engineering and Ops
