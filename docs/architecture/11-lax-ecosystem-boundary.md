# LAX ecosystem UX and responsibility boundary

Companion to [LAX Identity boundary](./09-lax-identity-boundary.md). Identity governs
authentication; this document governs **cross-product account experience**, wayfinding,
and shared chrome contracts. Code in `@auction/lax-ecosystem` and product adapters override
prose when they diverge.

## Responsibility matrix

| Concern | Owner | Must not |
|---------|--------|----------|
| Credentials, MFA, canonical `sub`, OIDC grants, host-only sessions, logout delivery | LAX Identity (`apps/auth`, product BFFs) | Live in product settings UI or shared “account” monolith tables |
| Profile, security UI copy, connected products list, global locale, communication consent | Shared LAX Account experience (future portal; contracts in `@auction/lax-ecosystem`) | Replace product roles, org memberships, or commerce/auction notification prefs |
| Product roles, entitlements, org context, domain workflows, operational data | Each product (`apps/web` / Bid, `apps/shop`, …) | Query Identity tables or import `@auction/auth/server` from Shop |
| Product discovery URLs, safe cross-origin links, header account chrome view models | `@auction/lax-ecosystem` (pure policy) + per-app composition roots | Hardcode production origins in components |

## Settings classification

| Tier | Examples | Surface |
|------|----------|---------|
| Global | Legal name, email display, password/MFA entry points, global marketing consent, locale | LAX Account portal (linked from each product) |
| Product-local | Bidding limits, paddle/KYC, bag/checkout, edition alerts, artist-growth controls | Product settings routes/APIs only |
| Organization-scoped | Auction house staff roles, seller org memberships | Owning product unless a platform entitlement exists |

## SOLID module map

| Module | Responsibility | Allowed dependencies |
|--------|----------------|-------------------|
| `@auction/lax-ecosystem` | Product directory policy, account chrome discriminated union, safe product URL validation, versioned LAX Account DTOs | None (pure TypeScript) |
| `apps/web/src/lib/ecosystem/*` | Env-backed adapters for Bid | `@auction/lax-ecosystem`, Next server env |
| `apps/shop/src/lib/ecosystem/*` | Shop Identity `/me` → account chrome VM | `@auction/lax-ecosystem`, Shop Identity BFF URLs |
| Layout / header shells | Compose VMs into client islands | Ecosystem adapters only — no fetch in client chrome |

**Forbidden:** `apps/shop` importing `apps/web` or Bid auth internals (enforced in `scripts/check-layers.mjs`).

## Account chrome contract

Adapters must map session lookup to a discriminated union:

- `guest` — show login/register; never treat errors as guest when state is unknown.
- `authenticated` — display name + account + logout destinations.
- `disabled` — identity disabled; link to product disabled route when available.
- `unavailable` — session reader failed; show recovery copy, not guest CTAs.

Shared mapping helpers live in `@auction/lax-ecosystem`; Bid and Shop each provide an adapter that satisfies the same contract tests.

## Product directory contract

Product URLs are supplied at the composition root from environment variables (see
`.env.example`: `LAX_BID_PUBLIC_URL`, `LAX_SHOP_STOREFRONT_URL`). The directory builder
validates HTTPS (or localhost in non-production), normalizes trailing slashes, and marks
the current product. Cross-product links are plain `<a href>` with `rel="noopener"` when
external.

## LAX Account contracts

Version **1** summary types (`LaxAccountPortalSummaryV1`) describe profile/security
summaries, connected products, and global consent flags for a neutral account portal.
Products continue to own detailed settings; the portal links out to product-local routes.

## Conformance gates

- `packages/lax-ecosystem` unit tests (URL safety, directory, account mapping).
- `scripts/ci/verify-lax-ecosystem.test.mjs` (docs, env SSOT, layer imports).
- Shop architecture doc references ecosystem chrome; Bid marketing layout passes validated product links.

See [Design system — ecosystem UX](../DESIGN_SYSTEM.md#lax-ecosystem-ux),
[Multi-product UI stack](../DESIGN_SYSTEM.md#multi-product-ui-stack), and
[Shop storefront architecture](../ui/shop-storefront-architecture.md).
