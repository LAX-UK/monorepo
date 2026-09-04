# PR #321 component review inventory

Backup ref: tag `backup/identity-boundary-321` on merge SHA.

## packages/identity-contracts

- Client, resource, scope, SSF, and logout registries
- Contract tests and semver fixtures for future independent consumers

## packages/identity-db

- Identity schema, outbox, JWKS, OAuth tables
- Role adapters and migration-facing schema (journal still orchestrated via `@auction/db`)

## packages/auth

- Better Auth issuer plugins (OIDC, JWT, MFA enforcement, magic link)
- Ports: `EmailSender`, `ProductSubjectUsageProbe`, lifecycle publishers
- Hosted login and two-factor HTML for Identity-issuer UI

## apps/auth

- Standalone Hono issuer (`:3003`)
- Token exchange, SSF streams, back-channel logout workers
- Internal identity lifecycle routes and machine-auth adapters

## apps/web/src/lib/bff

- OIDC code + PKCE, encrypted Redis sessions, canonical public-origin redirects
- Opaque `lax-bid-session` cookie and allowlisted API proxy

## apps/api

- Bearer-only resource verifier for `lax-bid-api`
- Internal identity email and subject-usage endpoints for neutral adapters

## apps/shop-identity

- Shop confidential RP/BFF reference implementation (`:3010`)
- OIDC roundtrip, SSF receiver, back-channel logout handler

## packages/db migrations 0140–0161

- Identity boundary clients, lifecycle outbox, SSF transport
- FK expansion, directory cutover (`bid_identity_directory`), role revokes

## CI scripts and workflows

- `verify-identity-boundary.mjs`, `verify-shop-oidc-roundtrip.mjs`, `verify-bid-web-bff-roundtrip.mjs`
- `run-pr-browser-gates.mjs`, `require-node-version.mjs`, `e2e-pr.yml` browser gates
- Migration matrix job and extraction rehearsal gate

## Docs and runbooks

- `docs/architecture/09-lax-identity-boundary.md`
- `docs/runbooks/identity-boundary-cutover.md`
- `docs/runbooks/onboard-lax-platform.md`

## Not claimed by this merge

- Physical database extraction or FK removal completion
- Production cutover promotion (flags remain default-off)
- Shop production API resource server beyond reference BFF
