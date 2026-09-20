# LAX Account portal — contract v1

Neutral cross-product account surface (not an extension of Bid settings). Implementation
is product-owned at the portal BFF; **types** live in `@auction/lax-ecosystem` as
`LaxAccountPortalSummaryV1`.

## Scope

| In portal v1 | Out of scope (product APIs) |
|--------------|----------------------------|
| Profile display name, email, locale | Paddle/KYC, org staff roles |
| Security summary (MFA on/off, last sign-in) | Auction alert preferences |
| Global marketing / product-update consent | Bag, checkout, edition holds |
| Connected products list with deep links | Identity credential storage |

## Versioning

- `version: 1` on `LaxAccountPortalSummaryV1` — bump only with a migration note and
  parallel reader period.
- Canonical subject is Identity `sub`; portal never mints identifiers.

## Product onboarding

Register new products in `@auction/identity-contracts` clients/resources first, then add
`LaxProductId` and directory env URLs per [11-lax-ecosystem-boundary](../architecture/11-lax-ecosystem-boundary.md).
