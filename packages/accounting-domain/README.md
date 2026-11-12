# @auction/accounting-domain

Pure accounting rules for the Xero → Zoho Books move. No I/O, no framework, no database, no
workspace dependencies (enforced by `lint:layers`). Adapters (Xero, Zoho Books) and the runtime that
stores records and calls providers live elsewhere and depend on this package, never the reverse.

## What is in it

| Area | File | Rule |
| --- | --- | --- |
| Money | `money.ts` | Integer pence, GBP only. Per-line VAT rounded half-up. Totals are the exact sum of lines. |
| Documents | `document.ts` | invoice, payment, credit_note, bill, contact; deterministic LAX reference; legal entity per product. |
| Ports | `ports.ts` | One small interface per kind plus `DocumentLookupPort`. Provider-agnostic results. |
| Life cycle | `lifecycle.ts` | Pure state machine with refusals; lease as data; lookup before retry. |
| Payments | `allocation.ts` | One payment across invoices, oldest due first, never over-allocate. |
| Refunds | `refund.ts` | Goods/delivery split; never more than paid. |
| Source switch | `source-switch.ts` | One live source per product; refuses two. |

Every function that can say no returns `Result<T, Code>` (`ok` / `refusal`) instead of throwing.
Time is always passed in (epoch ms for leases, `YYYY-MM-DD` for document dates); nothing reads a clock.

## Rules

**References.** `laxReference(kind, sourceId)` gives `LAX-INV-…`, `LAX-PAY-…`, `LAX-CN-…`,
`LAX-BILL-…`, `LAX-CON-…`. Same input, same text. It is the duplicate guard and the lookup key.

**Legal entity.** Bid → London Auction Xchange LTD. Shop and lax.art → London Art Exchange Ltd.

**VAT.** Treatments: `standard` (20%), `zero`, `exempt`, `margin_scheme`, `outside_scope`. Only
`standard` carries VAT; margin-scheme VAT is never shown. VAT is computed per line, rounded half-up
(`floor((net × bps + 5000) / 10000)`, integers only). Document totals = sum of lines; there is no
document-level rounding. A provider total is compared exactly (`compareWithProviderTotals`); a
difference is reported, never absorbed in an adjustment line.

**Payments.** `allocatePayment` fills invoices oldest due first (ties by reference), never gives an
invoice more than it owes, and reports the unallocated remainder. `buildPayment` refuses allocations
that exceed the payment.

**Refunds.** `planRefund` checks goods and delivery separately against paid minus already refunded.
`splitRefundTotal` takes one amount, goods first, then delivery. Neither can exceed what was paid.

**Source switch.** Per product, each of `xero` and `books` has a mode: `off | dry_run | test_org |
live`. At most one may be `live`. `validateSwitchConfig` refuses two live sources.

## Life cycle

```
                 startSending                completeSending(issued)
   pending ───────────────────► sending ─────────────────────────────► issued (final)
      ▲  │                        │  │
      │  │ cancel                 │  └─ completeSending(rejected) ──► failed ──┐ requeue ─► pending
      │  ▼                        │                                     │      │ cancel ─► cancelled
      │ cancelled                 │                                     └ escalate ┐
      │                           │ completeSending(unknown/timeout)             ▼
      │                           │ expireLease / answer after expiry        needs_review
      │                           ▼                                              ▲   │ requeue (no lookup owed)
      │                        unknown ── applyLookup(found) ─► issued           │   │ cancel (no lookup owed)
      │                           │   ── applyLookup(ambiguous) ────────────────┘   ▼
      │                           │   ── applyLookup(unavailable): stays unknown   pending / cancelled
      │                           └─ applyLookup(not_found): lookup cleared
      └────────── startSending (only after not_found) ◄─────────┘
```

- `sending` carries a `lease` (`token`, `expiresAtMs`). Only the token holder can complete.
- A lease that has expired means the outcome is **unknown**, whether noticed by `expireLease` or by an
  answer arriving late (the answer is not trusted).
- `unknown` sets `lookupRequired`. While it is set, `startSending`, `requeue` and `cancel` are refused
  with `lookup_required`: the next step is `DocumentLookupPort.findByReference`, then `applyLookup`.
- `rejected` is a definite refusal by the provider, so `failed` can be requeued safely.
- `issued` and `cancelled` are final.

## Tests

`pnpm --filter @auction/accounting-domain test`. Property-style tests use the seeded generators in
`src/testing/generate.ts` (fast-check is not a dependency of this repository); a failing run reports
its run number, and every run is reproducible.
