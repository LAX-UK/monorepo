# Tiered buyer's premium — implementation reference

> Status: **shipped** (migration, validators, API, admin tier editor on draft sales, dev-seed demo
> sale, checkout DTOs). Optional polish and future pricing models listed under follow-ups.
> Owner: catalogue + payments squad.

## Motivation

The original schema stored a single flat rate per sale (`sale.buyer_premium_rate`). LAX sales have
two-tier pricing (e.g. 15% under £500 k, 10% at or above), so a single rate always under- or
over-charged one segment. A tiered strategy with band-based application fixes the invoice math
faithfully.

## What is shipped

| Layer | Location | Notes |
|---|---|---|
| Type definitions | `packages/types/src/buyer-premium.ts` | `BuyerPremiumTier`, `BuyerPremiumPolicy` interface |
| Zod validation | `packages/validators/src/buyer-premium.ts` | `buyerPremiumTiersSchema`, strategy classes, factory |
| DB migration | `packages/db/drizzle/0060_buyer_premium_tiers.sql` | Adds nullable `buyer_premium_tiers jsonb` column + CHECK |
| DB schema | `packages/db/src/schema/sales.ts` | Drizzle column typed as `BuyerPremiumTier[] \| null` |
| API: payment total | `apps/api/src/services/payment.service.ts` | `totalDue()` calls `buildBuyerPremiumPolicy` |
| API: checkout pricing | `apps/api/src/lib/lot-checkout-pricing.ts` | Emits `checkoutPricing.kind` on lot DTO |
| Web: checkout VM | `apps/web/src/lib/data/view-models/dashboard-checkout.vm.ts` | Uses `kind` discriminant, no string-sniffing |
| Web: admin tier bands | `apps/web/src/components/admin/admin-sale-form.tsx` | Draft-only **Create / Edit sale** at `/admin/sales/new` and `/admin/sales/:id/edit`; `useFieldArray`, major-unit thresholds → minor in mapper |
| Web: admin sale form schema | `apps/web/src/lib/forms/schemas/admin-sale-form.ts` | `normalizeAdminFormTiersToApi` + `safeParseCreateSaleFromForm` / `safeParseUpdateSaleFromForm` |
| Web: sale form defaults | `apps/web/src/lib/forms/schemas/admin-sale-defaults.ts` | Edit loads `buyerPremiumTiers` from `Sale`; create starts with empty bands (flat rate only) |
| Dev seed | `packages/db/src/seed/dev/legacy-demo-seed.ts` | **Spring Contemporary Evening Sale** seeds two-tier bands (15% / 10% at £500k) for local testing |
| Tests | `packages/validators/src/buyer-premium.test.ts` | Rounding, tier boundaries, factory, schema |

## Data model

```sql
ALTER TABLE "sale" ADD COLUMN IF NOT EXISTS "buyer_premium_tiers" jsonb;
```

The column is **nullable**. `NULL` means "no tier override; use `lot.buyer_premium_rate`" (existing
flat-rate behaviour preserved).

When set, it is a JSON array of tier objects sorted ascending by `hammerThresholdMinor`:

```json
[
  { "hammerThresholdMinor": 0,        "rate": "0.1500" },
  { "hammerThresholdMinor": 50000000, "rate": "0.1000" }
]
```

`hammerThresholdMinor` is in **minor units** (pence for GBP). The example above represents 15%
under £500 000 and 10% at or above £500 000.

### DB-level guard

A `CHECK` constraint enforces that when the column is not NULL, it is a non-empty JSON array:

```sql
CHECK (
  "buyer_premium_tiers" IS NULL
  OR (
    jsonb_typeof("buyer_premium_tiers") = 'array'
    AND jsonb_array_length("buyer_premium_tiers") >= 1
  )
)
```

Detailed field validation (ascending thresholds, first threshold = 0, rate bounds) is enforced in
the Zod layer (`buyerPremiumTiersSchema`) before any write reaches the DB.

## Tier semantics: band-based, not progressive

The rate applied to the **whole hammer** is the one whose `hammerThresholdMinor` is the highest
value ≤ hammer. This is **not** a progressive/slab model.

| Hammer | Selected tier | Premium |
|---|---|---|
| £499,999.99 | 15% (threshold 0) | £74,999.99 |
| £500,000.00 | 10% (threshold £500 k) | £50,000.00 |

Rounding is **banker's rounding** (round-half-to-even) to whole pence.

## Strategy pattern (SOLID)

### Interface — `packages/types/src/buyer-premium.ts`

```ts
export interface BuyerPremiumPolicy {
  computePremiumMinor(hammerMinor: number): number;
  computePremiumMajor(hammerMajor: string): string;
  readonly id: string; // e.g. "flat:0.1500" | "tiered:[{0,0.15},{50000000,0.10}]"
}
```

### Concrete strategies — `packages/validators/src/buyer-premium.ts`

| Class | When used |
|---|---|
| `FlatRateBuyerPremiumPolicy` | `sale.buyer_premium_tiers` is NULL or empty |
| `TieredBuyerPremiumPolicy` | `sale.buyer_premium_tiers` is a non-empty array |

Both live in `@auction/validators` — pure value objects, no DB client, usable server and client.

### Factory

```ts
export function buildBuyerPremiumPolicy(ctx: BuyerPremiumContext): BuyerPremiumPolicy {
  if (ctx.saleTiers && ctx.saleTiers.length > 0) {
    return new TieredBuyerPremiumPolicy(ctx.saleTiers);
  }
  return new FlatRateBuyerPremiumPolicy(ctx.lotRate);
}
```

`ctx.saleTiers` comes from `sale.buyerPremiumTiers`; `ctx.lotRate` from `lot.buyerPremiumRate`.
Callers depend only on `BuyerPremiumPolicy` — Dependency Inversion.

## Lot DTO enrichment

`computeLotCheckoutPricing(lot, sale)` in `apps/api/src/lib/lot-checkout-pricing.ts` emits a
`checkoutPricing` field on every lot response consumed by the dashboard:

```ts
{
  hammerMajor: string;
  premiumMajor: string;
  totalMajor: string;
  policyId: string;           // "flat:0.1500" | "tiered:[…]"
  kind: "flat" | "tiered";    // discriminant — no string-sniffing on clients
}
```

The web checkout VM (`dashboard-checkout.vm.ts`) branches on `kind`, never on `policyId` text.

## Validation — `packages/validators/src/buyer-premium.ts`

`buyerPremiumTiersSchema` (Zod) enforces:

- Non-empty, maximum 16 tiers.
- `hammerThresholdMinor`: non-negative integer.
- First tier must start at `hammerThresholdMinor: 0` (guarantees full coverage).
- Thresholds strictly ascending and unique.
- `rate`: decimal string, 0–1 with up to 4 d.p.

Use this schema to validate any write (API `PATCH /sales/:id`, admin sale form mapper) before
persisting.

## SOLID summary

- **S** — Each strategy owns exactly one pricing rule.
- **O** — New rules (progressive slabs, charity 0%, estate-only) add a new class; no edits to
  existing strategies or callers.
- **L** — Both strategies satisfy `BuyerPremiumPolicy`; callers never need to downcast.
- **I** — Callers depend on `BuyerPremiumPolicy`, not on schema or strategy internals.
- **D** — `payment.service.ts` and `lot-checkout-pricing.ts` depend on the interface + factory,
  not on the JSONB shape or concrete classes.

## Follow-ups (optional / future)

1. **Read-only “resolved premium” in buyer-facing UI** — e.g. saleroom or lot drawer: show the
   effective band and sample premium at current hammer without duplicating math (reuse
   `buildBuyerPremiumPolicy` + sale/lot context).
2. **Catalogue CSV → tiers** — if a bulk import pipeline returns two-column under/over rates,
   map into `buyer_premium_tiers` at import time (no CSV path in repo seed today; dev demo is
   hardcoded in `legacy-demo-seed.ts`).
3. **Progressive (slab) variant** — new `BuyerPremiumPolicy` implementation if a sale ever needs
   slab pricing; callers stay on the factory interface.
4. **Multi-currency rounding** — switch to a `Money` value object when multi-currency support lands.
5. **Seller commission tiers** — parallel design; tracked separately from buyer premium.
