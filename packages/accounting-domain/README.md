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

Every function that can say no returns `Result<T, Code>` (`ok` / `refusal`) instead of throwing; none of the
exported functions throws.
Time is always passed in (epoch ms for leases, `YYYY-MM-DD` for document dates); nothing reads a clock.

## Rules

**References.** `laxReference(product, kind, sourceId)` gives `LAX-<PRODUCT>-<KIND>-<id>`, e.g.
`LAX-SHOP-INV-123`, `LAX-ART-INV-123`, `LAX-BID-BILL-123` (kinds `INV`, `PAY`, `CN`, `BILL`, `CON`; products
`BID`, `SHOP`, `ART`). It is injective over `(product, kind, sourceId)`, so Shop order 123 and lax.art
order 123 never collide inside one Books organisation. Source ids are lower case (`[a-z0-9_-]`, at most 64):
providers may search references case-insensitively, so `abc` and `ABC` must not be two documents. Builders
take a `sourceId`, never a reference string, and check every other reference they are given
(`parseLaxReference`: contact, invoice) is of the right kind and product. `DocumentLookupPort.findByReference`
takes the product so an adapter can never search the wrong organisation.

**Legal entity.** Bid → London Auction Xchange LTD. Shop and lax.art → London Art Exchange Ltd.

**VAT.** Treatments: `standard` (20%), `zero`, `exempt`, `margin_scheme`, `outside_scope`. Only
`standard` carries VAT; margin-scheme VAT is never shown. VAT is computed per line, rounded half-up
(`floor((net × bps + 5000) / 10000)`, integers only). Document totals = sum of lines; there is no
document-level rounding. Lines are only made by `buildLine` (the `Line` type is branded, and the document
builders take `LineInput[]`), so a hand-made line with a negative net or VAT on a margin-scheme sale cannot
reach a document. Line nets are capped at £1bn and documents at 1000 lines. A document or refund of zero is
refused (zero-priced lines such as free delivery are fine). The provider's own totals come back in every
`issued`/`found` outcome and `completeSending`/`applyLookup` compare them exactly with ours: a difference
goes to `needs_review` with the provider's identity kept, never absorbed in an adjustment line.

**Payments.** `allocatePayment` fills invoices oldest due first (ties by reference), never gives an
invoice more than it owes, and reports the unallocated remainder. `buildPayment` refuses allocations
that exceed the payment. A payment of zero is refused.

**Refunds.** `planRefund` checks goods and delivery separately against paid minus already refunded.
`splitRefundTotal` takes one amount, goods first, then delivery. Neither can exceed what was paid, and
a bucket already refunded more than it was paid is refused (`over_refunded`), not clamped.

**Credit notes.** `buildCreditNoteFor(invoice, …)` is the only way to make one. Its lines come from the
original invoice's goods and delivery lines and keep each VAT treatment (margin scheme stays margin scheme).
The amounts go through `planRefund` (never more than was paid) and must fit in the invoice minus earlier
credit notes. Prior credit notes are replayed onto the invoice's lines in order and rebuilt; one that does not
reproduce exactly is refused (`bad_invoice`).

A credit note says `amountsAre: "tax_inclusive"` and every credit line has `basis: "tax_inclusive"` (invoice lines
are `tax_exclusive`). A credit line's gross is what was credited and its `vatPence` is the VAT inside it, so
`vatPence` is not `vatForLine(net)` for credit lines. **Adapter contract:** send the gross and the stated VAT
(`lineAmounts(line)`), never re-derive VAT from the net. VAT is allocated cumulatively per invoice line,
`round_half_up(lineVat * creditedGross / lineGross)` less what earlier credits took, so any split of a line
credits at most the line's VAT and gross, and the credit that finishes a line takes exactly the rest. A
provider that cannot record an exact VAT amount on a credit line must be refused before the refund moves
money; confirm this in the Zoho Books sandbox before the runtime is built.
`buildCreditNoteFor` rebuilds the invoice it is given and refuses a forged one (`bad_invoice`).

`priorCredits` must be every credit note already issued for the invoice (all states except `cancelled` and
`failed`), in creation order. `buildCreditNoteFor` refuses when they cover less than the refunded buckets say.

Not covered here, and owned by the runtime: payment allocations are compared on amount only, `expected` totals
are not carried on the record, and an `ambiguous` lookup with `count: 0` is accepted.

**Dates.** `YYYY-MM-DD`, validated as real calendar dates (leap years included) with pure arithmetic; every
date is passed in.

**Source switch.** Per product, each of `xero` and `books` has a mode: `off | dry_run | test_org |
live`. At most one may be `live`. `validateSwitchConfig` checks every product in `PRODUCTS` (a missing one is `missing_product`, never a
throw) and refuses two live sources; `parseSwitchConfig` turns unknown input into a `SwitchConfig`.

## Life cycle

```
                 startSending                completeSending(issued, totals match)
   pending ───────────────────► sending ─────────────────────────────► issued (final)
      ▲  │                        │  │  └─ totals differ ──────────────► needs_review (document exists)
      │  │ cancel                 │  └─ completeSending(rejected) ──► failed ──┐ requeue ─► pending
      │  ▼                        │                                     │      │ cancel ─► cancelled
      │ cancelled                 │                                     └ escalate ┐
      │                           │ completeSending(unknown/timeout)             ▼
      │                           │ expireLease / answer after expiry        needs_review
      │                           ▼                                              ▲   │ requeue (nothing owed, no document)
      │                        unknown ── applyLookup(found) ─► issued (or review if totals differ)
      │                           │   ── applyLookup(ambiguous) ────────────────┘
      │                           │   ── applyLookup(unavailable): stays unknown
      │                           └─ applyLookup(not_found), only at or after settlesAtMs ─► pending
      └───────────────── startSending ◄──────────────────────────────┘
```

- `DocumentRecord` is a union on `status`, so each status carries exactly its own fields: `sending` has a
  lease, `issued` has the provider document, `unknown` has `settlesAtMs` (a lookup is always owed),
  `needs_review` says whether a lookup is still owed. `parseRecord(row, nowMs)` is the only way to read a stored
  row back; it refuses any illegal combination, a reference that is not the record's kind, and a lease or
  settle time further out than a lease can be plus `CLOCK_SKEW_MS` (one minute) of allowed clock skew between workers. Provider totals that are missing or not whole pence are
  refused with `bad_outcome` and change nothing.
- `sending` carries a `lease` (`token`, `expiresAtMs`). Only the token holder can complete. Times must be
  whole, finite epoch milliseconds (`bad_time` otherwise) and a lease may last at most `MAX_LEASE_MS`.
- A lease that has expired means the outcome is **unknown**, whether noticed by `expireLease` or by an
  answer arriving late (the answer is not trusted).
- `unknown` keeps `settlesAtMs = lease.expiresAtMs + SETTLE_GRACE_MS`. A lookup that finds nothing is
  trusted only at or after that time; earlier it is refused with `lookup_too_early`, because the first
  request may still land and a second create would duplicate it. **The runtime's HTTP timeout must be
  shorter than the lease**, and the grace covers provider-side work that outlives a client timeout.
  `found` is believed at any time.
- `rejected` is a definite refusal by the provider, so `failed` can be requeued safely.
- A `needs_review` record that holds a provider document (a totals mismatch) can be neither requeued nor
  cancelled: a person resolves it.
- `issued` and `cancelled` are final.

## Out of scope for this phase

- Margin-scheme purchase price and margin: the model prints no VAT on a margin-scheme sale and carries no
  cost, so margin VAT for the return is derived elsewhere. Lines carry no rate: only the standard 20% rate
  is modelled, so a reduced-rate line cannot be represented yet.
- Per-document source of record: a credit note or payment for an invoice issued in Xero must be routed to
  Xero even after Books is live for the product. The runtime PR must carry the source with the document.

## Tests

`pnpm --filter @auction/accounting-domain test`. Property-style tests use the seeded generators in
`src/testing/generate.ts` (fast-check is not a dependency of this repository); a failing run reports
its run number, and every run is reproducible.
