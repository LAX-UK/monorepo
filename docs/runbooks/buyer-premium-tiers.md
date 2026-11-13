# Buyer's premium — implementation reference

> Status: **shipped**. Standard clause 11 bands, slice-by-slice charging, half-up rounding, one
> resolver on every surface, admin premium editor on draft sales, and a pre-deploy check.
> Owner: catalogue + payments squad.

## Motivation

LAX's Conditions of Sale (clause 11) set a banded buyer's premium: **15% up to £500,000, then 10%
on the part above**. A single flat rate always under- or over-charged one segment. The premium is
now charged band by band (slice by slice) so each part of the hammer pays its own band's rate, and
every surface — invoice, checkout, lot page, results — reads it from one resolver.

## Precedence: which premium a lot charges

`resolveBuyerPremium({ lotRate, sale })` decides, in order:

1. **the lot's own premium** — `lot.buyer_premium_rate`, set only when staff override the sale on
   that lot. `source: "lot"`, charged as a flat rate on the whole hammer.
2. **the sale's bands** — `sale.buyer_premium_tiers`, when non-empty. `source: "sale_bands"`.
3. **the sale's flat rate** — `sale.buyer_premium_rate`, when the sale has no bands.
   `source: "sale_flat"`.
4. **the published standard** — the clause 11 bands, for a lot outside any sale.
   `source: "standard"`.

> **This reverses the old precedence.** Before migration 0380 a sale's bands always won and the
> lot rate was read only in a sale without bands. Now the lot rate is an **override** that wins.
> `lot.buyer_premium_rate` is nullable: `NULL` means "use the sale's premium". A new sale is
> created with the standard bands unless staff pick a flat rate.

## What is shipped

| Layer | Location | Notes |
|---|---|---|
| Maths (no floats) | `packages/domain/src/buyer-premium-maths.ts` | Slice sums in ten-thousandths of a penny, rounded once |
| Wording | `packages/domain/src/buyer-premium-wording.ts` | `describeBuyerPremium`, `describeBuyerPremiumBreakdown` |
| Resolver + policies | `packages/validators/src/buyer-premium.ts` | `resolveBuyerPremium`, `buildBuyerPremiumPolicy`, `FlatRateBuyerPremiumPolicy`, `BandedBuyerPremiumPolicy` |
| Types | `packages/types/src/buyer-premium.ts` | `BuyerPremiumTier`, `BuyerPremiumSchedule`, `BuyerPremiumSource`, `BuyerPremiumPolicy` |
| Invoice lines | `packages/validators/src/invoice-lines.ts` | `buildInvoiceLines` — the one money path |
| Checkout pricing | `packages/validators/src/lot-checkout-pricing.ts` | `computeLotCheckoutPricing` emits `checkoutPricing` on the lot DTO |
| Invoiced prices | `apps/api/src/lib/invoiced-sale-prices.ts`, `stored-checkout-pricing.ts` | Sold lots show what their live invoice charged, batched |
| DB migration | `packages/db/drizzle/0380_lot_premium_uses_sale.sql` | Lot rate nullable; clears it for every lot in a banded sale (kept for an exact rollback) |
| DB schema | `packages/db/src/schema/{sales,lots}.ts` | `buyer_premium_tiers jsonb`, nullable `buyer_premium_rate` |
| Pre-deploy check | `apps/api/scripts/verify-buyer-premium-config.ts` | Read-only; `--pre-deploy` gates the 0380 release |
| Admin sale/lot premium | `apps/web/src/components/admin/sale-form/...`, `.../lot-form/...` | Bands or flat on the sale; per-lot override |
| Tests | `packages/validators/src/buyer-premium*.test.ts`, `apps/api/src/services/buyer-premium-invoice.integration.test.ts`, `apps/api/src/services/reoffer/reoffer-legacy-premium.integration.test.ts` | Maths, precedence, invoice, bulk reset, buyer default after 0380 |

## Data model

`sale.buyer_premium_tiers` (JSONB, nullable) — the sale's bands, ascending from threshold 0:

```json
[
  { "hammerThresholdMinor": 0,        "rate": "0.1500" },
  { "hammerThresholdMinor": 50000000, "rate": "0.1000" }
]
```

`hammerThresholdMinor` is in minor units (pence). `NULL` means the sale charges its flat
`buyer_premium_rate`.

`lot.buyer_premium_rate` (`numeric(5,4)`, nullable) — the lot's own premium, a staff override.
`NULL` means "use the sale's premium". Migration 0380 dropped its old `NOT NULL DEFAULT 0.25`.

Detailed validation (first threshold 0, ascending, rate bounds) is enforced by
`buyerPremiumTiersSchema` (Zod) before any write.

## Band semantics: slice by slice (marginal), not whole-hammer

Each band's rate applies **only to the part of the hammer between its threshold and the next
band's**. The slices are summed exactly (in ten-thousandths of a penny) and the total is rounded
**once, half up** (not banker's), so the premium is the same however the hammer is split and never
drops at a band edge.

| Hammer | Premium | How |
|---|---|---|
| £499,999.99 | £74,999.99 | 15% of the whole |
| £500,000.00 | £75,000.00 | 15% of £500,000 |
| £600,000.00 | £85,000.00 | 15% of £500,000 + 10% of £100,000 |

A lot's own rate (`source: "lot"`) is flat: one rate on the whole hammer.

## The resolver (SOLID)

```ts
// packages/validators/src/buyer-premium.ts
export function resolveBuyerPremium(ctx: { lotRate; sale }): {
  source: BuyerPremiumSource;      // "lot" | "sale_bands" | "sale_flat" | "standard"
  schedule: BuyerPremiumSchedule;  // { kind: "flat", rate } | { kind: "bands", bands }
  policy: BuyerPremiumPolicy;      // charges the schedule, reports its slices
};

export function buildBuyerPremiumPolicy(schedule: BuyerPremiumSchedule): BuyerPremiumPolicy;
```

- `FlatRateBuyerPremiumPolicy` — one rate on the whole hammer (a sale's flat rate, or a lot's own).
- `BandedBuyerPremiumPolicy` — bands charged slice by slice; input sorted, first band must start
  at 0, thresholds strictly ascending.

Every caller (invoice lines, checkout pricing, lot page, results, hang labels, copy, the verify
script) depends on `resolveBuyerPremium` / the policy interface, never on the JSONB shape.

## Sold lots show what they were charged

For a sold lot with a live invoice, the public surfaces price from the stored invoice lines, not
from today's rules: `apps/api/src/lib/invoiced-sale-prices.ts` (`withInvoicedSalePrices`) overlays
`checkoutPricing` from `IInvoicedSalePriceReader.findInvoicedSalePrices` (one batched read for a
list). Historical invoices, receipts and sold lines keep the figure the buyer actually paid.

## Migration 0380 and the pre-deploy check

Migration `0380_lot_premium_uses_sale.sql`:

- drops `lot.buyer_premium_rate`'s `NOT NULL DEFAULT 0.25` (NULL now means "use the sale's");
- defaults `sale.buyer_premium_rate` to `0.15`;
- **clears `lot.buyer_premium_rate` for every lot in a sale with non-empty bands, invoiced or
  not.** The old code never read those rates (a banded sale's bands always won), so clearing them
  keeps behaviour exactly and stops the stored 25% default becoming an override that reprices
  live lots, sold-but-not-invoiced lots, and invoiced lots once their invoice is voided (a buyer
  default voids it; the re-offer, the re-raised invoice and the shortfall claim are then priced
  afresh). Raised invoices are frozen and every surface reads them, so nothing visible changes.
  Lots in flat-rate sales are untouched;
- keeps every cleared rate in `drizzle.lot_premium_rate_before_0380` (outside the application
  roles' reach) for the rollback.

**Before deploying the release**, run the pre-deploy check against production:

```sh
pnpm --filter @auction/api exec tsx scripts/verify-buyer-premium-config.ts --pre-deploy
```

It is read-only (SELECTs only). With `--pre-deploy` it applies 0380's lot-rate change first, then
flags:

- every lot open for bidding, or sold but not yet invoiced, whose premium would still change —
  lots staff cannot fix;
- every lot in a sale with bands, invoiced lots included, that would still hold a rate differing
  from the bands (a voided invoice would re-price it at that rate).

**Any flagged lot (exit code 1) blocks the deploy.** Unopened lots whose own premium differs from
their sale's (⚠, after the migration's change) are listed for staff and do not block it; on normal
data the check exits 0. The exit status is decided by `premiumCheckExitCode` in
`apps/api/src/lib/buyer-premium-deploy-check.ts` (unit-tested). Without the flag it reports the
premium each lot in a draft/scheduled/active/ended sale would be charged and also fails on ⚠ lots,
so staff see them.

Each sale without bands gets an `ⓘ no bands: charges a flat N% on the whole hammer` line: such a
sale charges one rate on the whole hammer (a sale row written outside the app gets 15%, which is
£90,000 on £600,000 against £85,000 under the standard bands). A lot with no rate of its own in such
a sale is marked `ⓘ no legacy rate`: the old release never priced it, so it is not "changed".

`0380_rollback.sql` first gives every lot the migration cleared its exact previous rate back (from
`drizzle.lot_premium_rate_before_0380`, unless staff have since set one), then refills the remaining
NULLs (lots written by the new release) with the sale's flat rate (or 15% outside a sale) before
restoring `NOT NULL DEFAULT 0.25`, so it cannot fail on NULL rows. It drops the kept rates. Run it in
a quiet window (`lock_timeout = 5s`).

## Putting lots back on the sale's premium (bulk reset)

`useSalePremiumForLots` (`apps/api/src/services/sale/sale-lot-premium.ts`) clears the own-rate of
chosen lots in one locking statement
(`clearOwnPremiumOfUnopenedLots`): only lots still draft or scheduled, with no winner and a rate of
their own, change — re-checked under their row lock inside the transaction, so a lot that opens for
bidding mid-reset is left as it is and reported skipped. The change and its audit entry
(`sale.lot_premiums_reset`, with each changed lot's previous rate) are written together.

## Follow-ups (optional / future)

1. **Progressive within a band** — not needed today; the slice model already covers clause 11.
2. **Multi-currency rounding** — switch to a `Money` value object when multi-currency lands.
3. **Seller commission tiers** — parallel design, tracked separately.
