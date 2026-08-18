# Identity boundary cutover

Staged rollout for the LAX Identity boundary ([architecture/09-lax-identity-boundary.md](../architecture/09-lax-identity-boundary.md)).

## Phase 1 — Schema and contracts (no traffic change)

1. Apply migrations `0137` through `0142`; execute every checked rollback-pair
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
2. Do not enable lifecycle publishers until migration `0142` is present. Confirm
   worker projectors advance cursors for `shop_identity_projection` and
   `bid_profile_provisioning`.
3. Run reconciliation job / backfill for missing `user.registered` rows (existing runbook SQL).
4. Monitor projector lag vs signup rate.

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

1. Apply migrations `0143`, `0144`, `0145`, then `0146`.
2. Verify Bid and Shop back-channel receivers before relying on delivery.
3. Provision SSF streams disabled; send verification SETs to both exact
   receivers.
4. Enable streams, then set `SSF_DELIVERY_ENABLED=true`; monitor delivery
   outcomes and replay/dead-letter behavior.

## Rollback

- Roll back the API and auth deployment images as one tested release unit.
- Do not recreate the issuer inside `apps/api` with a runtime flag.
- Disable SSF delivery before schema rollback. Reverse `0146`, `0145`, `0144`,
  `0143`, then earlier migrations in descending order. Earlier profile
  rollbacks are unsafe while later triggers or columns still exist.
- Bid profile dual-read continues from `user` legacy columns until forward migration is reversed.

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
- [ ] Dashboards and rollback routing documented
