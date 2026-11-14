# @auction/accounting-domain

Pure accounting rules for the Xero → Zoho Books move. No I/O, no framework, no database, no
workspace dependencies (enforced by `lint:layers`). Adapters (Xero, Zoho Books) and the runtime that
stores records and calls providers live elsewhere and depend on this package, never the reverse.

## What is in it

| Area | File | Rule |
| --- | --- | --- |
| Money | `money.ts` | Integer pence, GBP only. Per-line VAT rounded half-up. Totals are the exact sum of lines. |
| Documents | `document.ts` | invoice, payment, credit_note, bill, contact, expense, transfer; deterministic LAX reference; legal entity per product. |
| Ports | `ports.ts` | One small interface per kind plus `DocumentLookupPort`. Provider-agnostic results. |
| Life cycle | `lifecycle.ts` | Pure state machine with refusals; lease as data; lookup before retry. |
| Payments | `allocation.ts` | One payment across invoices, oldest due first, never over-allocate; or stored allocations that equal the payment exactly. |
| Parking | `parking.ts` | A document built and kept in "Needs a person", never sent, until the accountant or a person decides. |
| Ordering | `dependencies.ts` | A payment waits until every invoice it is applied to is in the books. |
| Refunds | `refund.ts` | Goods/delivery split; never more than paid. |
| Credit note refund | `credit-note-refund.ts` | A credit note that gives money back is refunded from Stripe clearing, once, for its whole gross. |
| Source switch | `source-switch.ts` | One live source per product; refuses two. |
| Projection | `projection/` | One pure policy per money flow: facts in, documents out, idempotent by LAX reference. |
| Retries | `retry.ts` | Wait between attempts (30 s doubling to 30 min); 8 attempts, then a person. |
| Parking | `parking.ts` | A document kept from the books until the accountant or a person decides: stored `needs_review` with a reason `accounting_parked_<why>`, never claimed, never requeued, only cancelled. |
| Buyer's invoice | `standing.ts` | Where a buyer's invoice stands for their card: LAX's own (Books off, rehearsing, or at the test organisation), being prepared, late after 30 minutes, issued (only with LAX's stored copy), cancelled. |
| Stored copy | `ports.ts` `DocumentPdfPort` | The provider's PDF of an issued document, fetched once so LAX keeps its own copy; a dry run answers with a page marked as a rehearsal. |

Every function that can say no returns `Result<T, Code>` (`ok` / `refusal`) instead of throwing; none of the
exported functions throws.
Time is always passed in (epoch ms for leases, `YYYY-MM-DD` for document dates); nothing reads a clock.

## Rules

**References.** `laxReference(product, kind, sourceId)` gives `LAX-<PRODUCT>-<KIND>-<id>`, e.g.
`LAX-SHOP-INV-123`, `LAX-ART-INV-123`, `LAX-BID-BILL-123` (kinds `INV`, `PAY`, `CN`, `BILL`, `CON`, `EXP`, `TRF`; products
`BID`, `SHOP`, `ART`). It is injective over `(product, kind, sourceId)`, so Shop order 123 and lax.art
order 123 never collide inside one Books organisation. Source ids are lower case (`[a-z0-9_-]`, at most 64):
providers may search references case-insensitively, so `abc` and `ABC` must not be two documents. Builders
take a `sourceId`, never a reference string, and check every other reference they are given
(`parseLaxReference`: contact, invoice) is of the right kind and product. `DocumentLookupPort.findDocument`
takes the document, so an adapter searches only its product's organisation and reads what it finds back
against it.

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
that exceed the payment. A payment of zero is refused. `checkExactAllocations` is the rule every Bid
payment flow uses: each allocation is a stored amount (the invoice's payment row, a courier quote's
charge), nothing is split or rounded, and together they must equal the payment to the penny
(`allocation_mismatch` otherwise, a penny out either way).

**Parked documents.** A projection may name some of its documents as parked (`Projection.parked`,
reason `vat_on_delivery` or `invoice_cancelled`). The runtime stores them straight into
`needs_review` (`parkedRecord`, reason `accounting_parked_<reason>`), never `pending` first, so no
sender can take one. `requeue` refuses a parked document (`parked`), so it cannot be tried again by
hand. Once its reason is settled a person releases it (`release`, parked to `pending`, attempts
kept): the caller first projects its stored rows again with the policy that parked it, as they
stand now, and `resolveParked` allows the release only if that projection makes the same reference
and no longer parks it. A delivery invoice's draft is then replaced by the rebuilt invoice (same
reference, same gross); anything else must come out exactly as stored. It can also be cancelled.
A queued payment whose invoice was cancelled is parked by the sender (`park`, `invoice_cancelled`)
instead of waiting for ever.

**Ordering.** `documentsAwaited(document)`: a payment waits for each invoice it is applied to, a
credit note waits for the invoice it credits, and an invoice or credit note waits for its contact. The work queue claims a document only once all of
them are `issued` for the same target, so nothing reaches Books before what it refers to, whatever
order the documents were stored in or however many senders run, and a waiting document never holds
up the documents behind it.

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
- A send's writes are tied to its lease (`WriteFence`): immediately before every create or update (and
  every retry of one, after any rate-limit or queue wait) the adapter asks the sender, which asks the store
  whether this lease token still holds the document with `WRITE_MARGIN_MS` (30 s) left. Once the lease was
  swept or is about to run out, no write starts: the call ends `rejected` with a passing reason
  (`zoho_books_fenced_lease_lost`), and whoever holds the document next looks it up before sending. A
  write that did go out before the lease was lost is never repeated: its late answer is refused and the
  lookup decides. The Books request timeout is capped at `WRITE_MARGIN_MS` at start-up.
- `rejected` is a definite refusal by the provider, so `failed` can be requeued safely.
- `differs` means the provider holds a document under our reference (just created, or adopted
  after a duplicate refusal) that does not read back as ours (a payment applied differently, say).
  It exists, so it becomes `needs_review` with the provider's identity kept (and a totals mismatch
  if there is one): like a totals difference, it can be neither requeued nor cancelled. It is never
  `failed`, because a failed record could be requeued and sent blindly. The runtime keeps both the
  provider's totals and ours in the history row. The lookup can answer `differs` too: it reads the
  document it finds back with the same check a send makes, so when the answer to a send never reaches
  its lease (the lease was swept, the reply was lost or came late) `applyLookup` still ends in
  `needs_review` with the provider's identity, never `issued`.
- A `needs_review` record that holds a provider document (a totals mismatch) can be neither requeued nor
  cancelled: a person resolves it.
- `issued` and `cancelled` are final.

## Projection

`projection/` turns a business event's facts into documents, one policy per flow
(`PROJECTION_POLICIES`). Policies are pure: the runtime reads the facts (ids, pence, London calendar
days) and registers what comes back, in order (contact, then invoice, then what refers to it). The
same facts always give the same documents, so a redelivered event is a replay.

| Flow | Documents | Rule |
| --- | --- | --- |
| `bid_invoice_raised` | contact, invoice | Lines from the stored invoice (the `invoice.raised` event names them by id; other lines are refused); `BID_LINE_BOOKINGS` says how each line kind is booked (hammer and premium as margin-scheme goods until the accountant confirms; the premium keeps the label it was raised with). VAT on the premium and the artist's resale right wait for the accountant: a kind in `BID_LINES_AWAITING_ACCOUNTANT` is refused (`line_awaiting_accountant`), an unknown kind too (`unmapped_line`), never guessed. A line of 0p is left out. |
| `bid_payment_captured` | contact, invoice, payment | Card, or a bank transfer once all of it arrived: all of the payment (the stored row's amount, GBP only) applied to its invoice; a payment for more than the invoice is refused (a remainder is never spread). For an invoice cancelled since: contact and the payment, parked `invoice_cancelled`. |
| `bid_payment_group_settled` | contact, each invoice, a delivery invoice per courier quote, ONE payment | "Pay several": one payment (`LAX-BID-PAY-grp-<group>`) applied to each invoice by its payment row's amount and to each delivery invoice (`LAX-BID-INV-dlv-<quote>`) by the quote's charge; the allocations equal the group's total exactly. Delivery invoices and the payment are parked `vat_on_delivery` while `DELIVERY_BOOKING` is unset (the accountant's question); a cancelled invoice parks the payment `invoice_cancelled`. |
| `bid_payment_refunded` | contact, invoice, one credit note per refund | Every refund that went through on the payment (its own, or one lot's of a "Pay several" charge) replayed oldest first through `buildCreditNoteFor`, `LAX-BID-CN-<refund row>`, each refunded from Stripe clearing (`refund`). Each is its refund up to what the payment still has to give back on the invoice: never more than it took (a lot's excess is not this invoice's). A refund's credit note already registered (`registered`) is kept exactly as stored, so a refund taken back never reshapes the others. |
| `bid_payment_refund_reversed` | nothing; a cancel or a hold | A refund taken back after its credit note was made: never sent, `cancel` it; issued, or already held for another reason, `hold` it for a person (`refund_reversed_after_credit`, the Books document kept): no reversing document is defined, so nothing is guessed. Being sent: refused (`credit_in_flight`), tried again; the clearing-refund step also re-checks the refund itself before refunding. |
| `bid_delivery_refunded` | contact, delivery invoice, a credit note per rise | A courier quote's refunded running total: credited after the credit notes already made for it (`priorCredits`, read from the books), never above the charge, `LAX-BID-CN-dlv-<quote>-r<total>`. When the total was lowered (a refund taken back), the newest credit notes never sent are cancelled until the credit fits (`priorStandings`) and the rest credited again; an issued one (or one already held for another reason) is held for a person. Parked with the delivery draft (`vat_on_delivery`) while `DELIVERY_BOOKING` is unset. |
| `bid_buyer_default` | nothing and a cancel, or contact, invoice, full credit note | The invoice never sent: `cancel` it in the books. Issued: a full credit note (`LAX-BID-CN-dft-<invoice>`, no money back), parked (`buyer_default_treatment`) while `BID_DEFAULT_ACCOUNTING_TREATMENT` is unset (the accountant's "credit note or void"); `void` keeps it parked (voiding is not built). In flight: refused, tried again. |
| `shop_order_paid` | contact, invoice, (parked delivery invoice), payment | The order's invoice in London Art Exchange under the Shop's own number (`buildInclusiveInvoice`: lines VAT-inclusive with the VAT stored when sold, never worked out again; a line sold with no VAT recorded is booked with none). Goods, framing (the frame's price as sold) and UK delivery or collection are lines on it; the lines must add up to the order's total. Delivery outside the UK is never on it: it is its own invoice with no VAT stated, parked (`vat_on_outside_uk_delivery`, never sent). The payment books the whole order into clearing, applied to the invoice; the parked delivery's part is left unapplied. |
| Stripe fees and payouts (flow 25, `decideStripeBalanceTransaction`; a daily job, not an event) | expense, transfer | One Stripe balance transaction at a time. Its fee (a charge's, a dispute's, an instant payout's, or one of Stripe's own fees) is an expense paid from Stripe clearing, `LAX-<P>-EXP-<balance transaction>`; a payout is a transfer from clearing to the bank, `LAX-<P>-TRF-<payout>`. Stripe ids keep their case through `stripeSourceId` (a capital is `-` and the letter; Stripe ids never hold `-`, so it is injective, and `stripeIdFromSourceId` reads it back). The company comes from the caller's `StripeAttribution`, made from stored LAX rows only: unattributable or conflicting, a fee given back, a reversed payout, or money not in pounds is parked for a person (`StripeParkReason`), never booked. The charge, refund or dispute amount itself is never booked here. |
| others in `ACCOUNTING_FLOWS` | none yet | Placeholders that project nothing until their own change builds them. |

`whenReferenceHeld(kind)`: a contact already registered with other details is kept (its details are
updated by a contact flow of its own); any other kind must match exactly.

**Vendors.** The domain has no vendor port yet: no policy makes a bill in this phase. A bill must go
to a vendor contact, so when payouts are projected the domain gains `VendorPort` (today only in the
Books package, where the adapter keeps customers and vendors apart) and contact documents say which
party they are, so the sender can route them. Until then the sender sends customers only.

## Retries

`retryDelayMs(attempts)` is the wait after an attempt before the next one: 30 s, doubling, capped at
30 minutes. An unknown outcome is looked up once its first request has settled and that wait has
passed; a refusal the provider says is passing (a rate limit) is requeued after it; any other
refusal waits for a person. After `MAX_SEND_ATTEMPTS` (8) the document is escalated to
`needs_review`.

## Storage

`@auction/persistence` stores these records (tables from migration 0368, reference key from 0374; see
`repositories/accounting`). A row
is one `DocumentRecord` plus the document, and CHECK constraints allow only the combinations `parseRecord`
accepts. Every move calls the functions above and writes the new state and a history row together; the
history table is append-only for every role. The source switch is one row per product (`xero_mode`,
`books_mode`, never both `live`). Dry run: nothing calls a provider.

### One document per reference and target

A reference is held once **per target** (provider and mode), not once overall (migration 0374: unique
`(product, legal_entity, lax_reference, target_provider, target_mode)`, `NULLS NOT DISTINCT`, so the rows
with no target share one slot). `register` looks the reference up under the target the switch names now.
So a document rehearsed in Books `dry_run` (answered `issued` as `DRY-RUN`) keeps its row and history, and
when the switch moves Bid to `test_org` (later `live`) the same reference is registered again, `pending`,
for that target. Every Bid flow registers the contact and invoice again before what refers to them
(contact, invoice, then payment or credit notes), so a payment or refund after the move brings the buyer
and the invoice to the new organisation first; the sender claims oldest first within a target. A
rehearsal row is never reused, never re-aimed and never deleted.

### Switching Books on and off

The accounting projector's cursor starts at the newest event the first time it runs. While no product is
aimed at Books it is moved to the newest event on every tick, and any delivery still queued is settled as
skipped (`books_not_selected`). So turning Books on, the first time or again, projects only what happens
from then on: the events of a time Books was off belong to whatever booked them then (Xero) and are never
replayed under a later switch. A history backfill is its own, explicit command (not built). If the switch
cannot be read, nothing moves.

### Rehearsing Books for Bid beside legacy Xero

`booksTargetMode(product)` is the one rule for both the Books projector and the Books sender: Books takes a
product's documents only when `documentTarget` names Books. With Bid `xero_mode = live` (the seed and the
default) Books takes nothing, whatever `books_mode` says, so nothing is queued and nothing is sent.

Legacy Xero posting does **not** read this switch; it is governed by its own settings (the worker's
`XERO_PROJECTOR_MODE`, `XERO_API_WRITES_DISABLED` and the Xero connection), and stays as it is during a
rehearsal. A rehearsal is therefore run like this, and only like this:

1. Bid: `xero_mode = off`, `books_mode = dry_run` (via the switch writer, which records who changed it).
   Here `xero_mode` means "the new pipeline does not aim Bid at Xero"; legacy Xero keeps booking Bid as
   before. Nothing is posted twice: the only Books adapter the worker builds is the dry run, which holds
   no HTTP client, and the sender only claims `dry_run` documents.
2. End the rehearsal with Bid `xero_mode = live`, `books_mode = off`. The projector then moves its cursor
   past everything that follows, so a later Books step never replays it.
3. `test_org` and `live` are not reachable in this phase (no writing adapter is wired). When they are,
   each is bound to an organisation id, not trusted as a label: `DestinationBinding` (`destination.ts`,
   the Books adapter's `BOOKS_ORGANISATIONS`, the one place those ids are written, checked against the
   organisation settings at start-up) names the one organisation each writing mode may send each product's
   documents to, and the sender asks the adapter where it would call (`DestinationPort`) before every
   send or lookup. Any other organisation, nothing bound, or a `dry_run` adapter that names any
   organisation at all, and the document goes to a person unsent. Before Bid goes
   `live` on Books, legacy Xero posting for Bid must be stopped by its own settings first: the switch
   cannot stop it, so `books_mode = live` with legacy Xero still posting would book the same sale twice.

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
