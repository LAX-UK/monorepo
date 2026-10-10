# LAX ecosystem UX and responsibility boundary

Companion to [LAX Identity boundary](./09-lax-identity-boundary.md). Identity governs
authentication; this document governs **cross-product account experience**, wayfinding,
and shared chrome contracts. Code in `@auction/lax-ecosystem` and product adapters override
prose when they diverge.

## Responsibility matrix

| Concern | Owner | Must not |
|---------|--------|----------|
| Credentials, MFA, canonical `sub`, OIDC grants, host-only sessions, logout delivery | LAX Identity (`apps/auth`, product BFFs) | Live in product settings UI or shared “account” monolith tables |
| Profile, security UI copy, connected products list, global locale, communication consent | Shared LAX Account experience (`apps/account`, D34; contracts in `@auction/lax-ecosystem`) | Replace product roles, org memberships, or commerce/auction notification prefs |
| Product roles, entitlements, org context, domain workflows, operational data | Each product (`apps/web` / Bid, `apps/shop`, …) | Query Identity tables or import `@auction/auth/server` from Shop |
| Product discovery URLs, safe cross-origin links, header account chrome view models | `@auction/lax-ecosystem` (pure policy) + per-app composition roots | Hardcode production origins in components |

## Settings classification

| Tier | Examples | Surface |
|------|----------|---------|
| Global | Legal name, email display, password/MFA entry points, global marketing consent, locale | LAX Account portal (linked from each product) |
| Product-local | Bidding limits, paddle/KYC, bag/checkout, edition alerts, artist-growth controls | Product settings routes/APIs only |
| Organization-scoped | Auction house staff roles, seller org memberships | Owning product unless a platform entitlement exists |
| Security policy | "Require two-step verification" for all LAX staff (super admin) or for an organisation's members (owner) | Decided in the owning product (Bid admin, Bid organisation members page), stored and enforced by Identity (D35) |

Personal two-step verification stays a global setting: users turn it on or off from LAX
Account (hosted `/two-factor/manage`) or Bid security settings. When a policy requires it,
both surfaces say who requires it and hide **Turn off**.

## Staff access across platforms

One identity, separate roles per platform. A Bid super admin invites a person once and
chooses, for each platform, whether they get access and which role (D36). Bid applies its
own grant. Other platforms receive `lax.staff_access.granted` / `.revoked` domain events
and apply them with their own roster rules, so no product writes another product's role
tables. Platform names, role labels and summaries come from `LAX_STAFF_PLATFORMS` in
`@auction/types` and must not be redefined in product UI.

| Step | Owner | Surface |
|------|-------|---------|
| Choose platforms and roles | Bid admin | **Admin → People → Invite** |
| Invitation email | Bid API (`access-invite` template) | One email listing every platform and role |
| Accept (new account) | LAX Identity sign-up + Bid registration | `/register?invite=…` |
| Accept (existing account) | Bid web | `/invitations/accept/:token` |
| Apply Shop grant | `apps/shop-api` (`shop_staff_access_inbox`) | Audited like a manual Shop Admin grant |
| Launch each platform | Bid web | `/invitations/welcome` |

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
`authenticated` carries `emailVerified` only when the session ID token states it; absence
means unknown and must not render an unverified warning.

## Sign-up and onboarding ownership

| Step | Owner | Notes |
|------|-------|-------|
| Sign-up, email verification, resend | LAX Identity hosted pages | Products enter via `prompt=create`; resend is `/resend-verification?client_id=…` |
| Unverified-email prompts | Each product + LAX Account | Bid: verify-pending guard and dashboard strip; Shop: account notice via shop-identity `/auth/verify-email`; portal: “Verify email” row action |
| Conditions of Business, persona | Bid (`/onboarding/account`) | Product-local |
| Interests, recommendations, KYC | Bid (`/onboarding/*`, D19/D20) | Skippable except where bidding is server-gated |
| Shop onboarding | None beyond sign-in | Basket merge in `/account/post-sign-in` |

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
