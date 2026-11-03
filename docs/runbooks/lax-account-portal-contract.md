# LAX Account portal contract v1 (legacy)

> **Legacy.** This page describes a single "portal summary" that no service produces or reads today. The type `LaxAccountPortalSummaryV1` still exists in [`packages/lax-ecosystem`](../../packages/lax-ecosystem/src/lax-account-contract.v1.ts) but nothing builds or consumes it, and nothing here should be used to plan new work.

## What LAX Account does instead

`apps/account` shows each person's data by reading it from the products, not from one summary:

- **Portfolio and money.** Each product implements the versioned `LaxPortfolioItemV1` and `LaxMoneyEntryV1` read contract. Account exchanges one token per product (`lax.portfolio.read`), reads them in parallel and validates each answer. See [Portfolio contracts and Account routes](../architecture/11-lax-ecosystem-boundary.md#portfolio-contracts-and-account-routes).
- **Profile, security and sign-in.** Identity owns credentials, sessions and two-step verification; Account calls Identity for them. See [05-identity-flow.md](../architecture/05-identity-flow.md) and [09-lax-identity-boundary.md](../architecture/09-lax-identity-boundary.md).
- **Product links and settings.** Products keep their own detailed settings; Account links to them through the product directory. See [11-lax-ecosystem-boundary.md](../architecture/11-lax-ecosystem-boundary.md).
- **Gateway.** How the apps are exposed and routed is in [06-deployment.md](../architecture/06-deployment.md).

To onboard a new product, register it in `@auction/identity-contracts` (clients and resources), add its `LaxProductId` and directory URL, and implement the portfolio contract.
