# Onboard a LAX product to Identity

Use this procedure for every browser-facing LAX product. The concrete example is
the custom Shop at `shop.lax.art`. The canonical contract is
[the Identity boundary](../architecture/09-lax-identity-boundary.md).

## 1. Register the client and resource

Add a confidential client to
`packages/identity-contracts/src/clients.ts`; for Shop the exact registration is:

- client id: `lax-shop-web`
- redirects: `http://localhost:3010/auth/callback`,
  `https://shop.lax.art/auth/callback`
- post-logout redirects: `http://localhost:3010/`,
  `https://shop.lax.art/`
- back-channel logout: `https://shop.lax.art/api/auth/backchannel-logout`,
  `sid` required
- scopes: `openid profile email offline_access shop.read shop.write`
- resource: `lax-shop-api`

Add the resource to `packages/identity-contracts/src/resources.ts`; Shop uses
resource indicator `https://shop.lax.art/api`, access-token audience
`lax-shop-api`, and scopes `shop.read`, `shop.write`. Add the SSF receiver to
`packages/identity-contracts/src/ssf.ts`; Shop uses
`https://shop.lax.art/api/ssf/events`.

Review all exact URIs. Wildcards and redirects through another product are not
allowed. Provision the registry with
`pnpm --filter @auction/db db:configure-oidc-clients`. Supply
`OIDC_CLIENT_SECRET_LAX_SHOP_WEB` only to the provisioning operation and Shop
secret manager; never commit or expose it to the browser.

## 2. Provision runtime configuration

For the current Shop BFF, set the names required by
`apps/shop-identity/src/env.ts`:

- `OIDC_ISSUER_URL=https://auth.lax.bid`
- optional private `OIDC_INTERNAL_BASE_URL`
- `OIDC_CLIENT_ID=lax-shop-web`
- `OIDC_CLIENT_SECRET`
- `OIDC_REDIRECT_URI=https://shop.lax.art/auth/callback`
- `OIDC_POST_LOGOUT_REDIRECT_URI=https://shop.lax.art/`
- `SESSION_SECRET` with at least 32 characters
- `DATABASE_URL_SHOP` using the Shop-local role

The Bid BFF equivalently requires `OIDC_CLIENT_SECRET_LAX_BID_WEB`,
`BID_BFF_SESSION_ENCRYPTION_KEY`, `OIDC_ISSUER_URL`, optional
`OIDC_INTERNAL_BASE_URL`, and `REDIS_URL`; see
`apps/web/src/lib/bff/config.server.ts`. Do not invent aliases for these names.

## 3. Implement the BFF

Use authorization code + S256 PKCE. Bind state and nonce to a short-lived local
pending session. Exchange the code from the server with the confidential secret.
Verify RS256, issuer, client audience, expiry, nonce, `sub`, and `sid`.

Keep ID, refresh, and access tokens server-side. Give the browser an opaque,
Secure, HttpOnly, SameSite=Lax cookie with no `Domain` attribute. Store a local
profile keyed only by immutable `sub`; email and name are mutable attributes,
not identifiers. Never copy Bid roles or read Identity tables.

For API calls, exchange the client-bound ID token with RFC 8693 for
`https://shop.lax.art/api` and requested `shop.*` scopes. The Shop API must pin
issuer `https://auth.lax.bid`, audience `lax-shop-api`, RS256, token lifetime,
and required scope before loading local authorization.

## 4. Implement lifecycle receivers

Expose the exact back-channel logout URI. Validate the logout token and
atomically reserve `jti` while invalidating local sessions by `sid` or `sub`.

Expose the exact SSF endpoint. Validate SET signature, issuer, audience, type,
time window, event schema, and one-event rule. Reserve `jti` and apply the event
in one transaction. Support verification before enabling the stream. Streams
remain disabled until the [SSF runbook](./ssf-stream-operations.md) passes.

## 5. Test and promote

- [ ] Registry unit tests pass and no unregistered live client is disabled by accident.
- [ ] Cold login, existing Identity SSO, state mismatch, nonce mismatch, and PKCE failure pass.
- [ ] Browser receives only a host-only opaque product cookie.
- [ ] ID tokens are rejected by the product API.
- [ ] Correct resource token succeeds; wrong issuer, audience, scope, signature, expiry, and `kid` fail.
- [ ] Local profile is keyed by immutable `sub`; profile change and disable projections reconcile.
- [ ] RP-initiated logout and back-channel logout invalidate the intended sessions.
- [ ] Logout-token replay is rejected without duplicate side effects.
- [ ] SSF verification succeeds while the stream is disabled; stale, future, replayed, and unsupported SETs fail.
- [ ] Receiver outage produces durable retries and observable failures.
- [ ] Product remains able to verify an already issued resource token during an Identity outage.
- [ ] Target-environment E2E, role-contract, migration, rollback-pair, and reconciliation evidence is recorded.

Do not call the product production-ready while any target-environment gate is
unrun.
