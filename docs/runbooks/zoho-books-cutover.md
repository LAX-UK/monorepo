# Zoho Books cutover (Shop history import, backfill, switching over)

Status: **rehearsal only**. The worker builds the Books dry run adapter alone
(`createBooksAccountingAdapters`), and both commands below refuse a product whose switch is on
Books `live`. Nothing in this runbook touches a live Books organisation until a later change wires
the test and live organisations and lifts that refusal.

Steps 4d and 4e of the Order (the backfill and the live import) cannot run until that later
change lifts the refusal.

Before that later change lifts the refusal, it must also keep imported history out of the "Your
invoice" email: the email goes once for each Shop invoice Books issues live, and an imported
invoice (source `shop_history_import:<order>`) is one. In rehearsal no email is ever sent.

Decisions this follows:

- **F18 History and cutover.** Xero becomes a read-only archive from the first day of a VAT
  quarter. Unpaid Xero invoices are settled in Xero until a fixed date agreed with the accountant.
  Past **Shop** invoices are imported into Books **with their numbers** (`LAX-INV-…`, sent with
  Books' automatic numbering switched off). **Bid** starts a new series in its new organisation:
  no Bid history is imported, ever.
- **F19 Switching over.** One switch per product, four positions. The database refuses two live
  sources for one product. Order: dry run for a week, then one Bid sale and one Shop day in the
  test organisation, then live.
- **F20.** No new Xero work. Nothing here changes Xero.

## The switch positions

The switch is the `accounting_source_setting` row of each product (`bid`, `shop`). It is changed
by an operator with the admin database role; the `accounting_source_setting_one_live_ck`
constraint refuses a row with Xero and Books both `live`, and the projector and sender read it
afresh every tick.

| Position | `xero_mode` | `books_mode` | Where new documents are aimed |
| --- | --- | --- | --- |
| 1. Xero | `live` (Bid) / `off` (Shop) | `off` | Nowhere in Books: the accounting projector moves its cursor past every event. |
| 2. Dry run | `off` | `dry_run` | Books dry run: LAX builds every Books document and logs it, sends nothing. |
| 3. Test organisation | `off` | `test_org` | The Books test organisation. |
| 4. Books | `off` | `live` | Books is the books; Xero is the read-only archive. |

A document is aimed at the live source if there is one, otherwise at the only provider that is not
`off` (`documentTarget`). So Books receives nothing while `xero_mode` is `live`, and nothing while
both columns are a rehearsal. `xero_mode` does not stop LAX's existing Xero path: that path keeps
writing to Xero until `XERO_API_WRITES_DISABLED=true` is set for the API and the worker (F20:
Xero becomes read-only). Positions 2 and 3 therefore run alongside Xero unchanged.

**`XERO_API_WRITES_DISABLED` is one global flag, so both products cross to position 4 in one
window.** It is read by the API and the worker and stops every Xero write (Bid and Shop invoices,
payments, payout bills, the settlement cron), not one product's. Shop and Bid therefore cannot be
split across it: set when Shop goes live alone, it stops Bid's Xero writes while Bid is not yet in
Books (Bid sales booked nowhere); set only when Bid goes live, the Xero path and Books `live`
both book Shop sales. Making it per product would touch every Xero writer in both apps, which is
a larger change than the cutover needs, so it is not done: **there is one cutover window, the flag
is set at a fixed step of it (Order, step 4), and neither product is at position 4 before it.**

```sql
-- Example: Shop to position 2 (dry run). One product per statement, inside a transaction.
BEGIN;
UPDATE accounting_source_setting
   SET xero_mode = 'off', books_mode = 'dry_run', updated_at = now(), updated_by = '<operator>'
 WHERE product = 'shop';
SELECT product, xero_mode, books_mode, live_source FROM accounting_source_setting;
COMMIT;
```

## Preconditions (all of them, written down, before position 4)

1. **Accountant sign-off** in writing on: the cutover date, the import of past Shop invoices with
   their numbers, and how the imported invoices' payments are shown (they were paid and banked in
   the Xero period; the import books the invoice and its contact only, never a payment, so the
   accountant decides how Books shows them as settled).
2. **The cutover date is the first day of a VAT quarter** (00:00 London). Xero's last VAT return
   covers everything before it; Books' first covers everything from it. Imported invoices keep
   their own dates, all before the cutover, so they fall in no Books VAT return.
3. **The fixed date** until which unpaid Xero invoices are settled in Xero is agreed and in the
   finance calendar.
4. **Switch positions** are as the order below says, and `SELECT … FROM accounting_source_setting`
   shows exactly one `live_source` per product.
5. **Counts and totals agree with Xero** (see "Verify against Xero").
6. Finance › Accounting shows nothing in "Needs a person" for the product, and the accounting
   alerts are quiet for 24 hours.
7. **Refunded orders**: the accountant has decided in writing how the Shop orders refunded before
   the cutover are shown in Books. The import books each as a full invoice and no credit note
   (Xero holds the invoice and a credit note), and its report counts them apart (`refunded`,
   with count and pence for fully and partially refunded orders). The Books history sales and
   receivables differ from Xero's by those amounts until the decision is carried out.
8. **The window is fixed**: one date and time for step 4 below, both products together, with the
   person who sets `XERO_API_WRITES_DISABLED` and the person who moves the switches named.
9. **The "Your invoice" email change has been deployed** (imported history is never emailed): it
   must land before Books `live` is allowed, and so before the live import.

## Order (F19)

1. **Dry run for a week** (both products at position 2). Each day: Finance › Accounting has no
   unexplained "Needs a person", `accounting_*` alerts are quiet, the daily reconciliation report
   shows no mismatch.
2. **Shop history import, dry run then for real (into the dry run target).** Run
   `books:import-shop-history --before <cutover> --dry-run`, check the report against Xero, then run
   it without `--dry-run` until it reports nothing left (it stops each day at its share of the Books
   call budget; run it again the next day). This proves the numbers, counts and totals only:
   documents queued for the dry run target are never sent to another target.
3. **Test organisation**: both products at position 3. One Bid sale and one Shop day are booked
   there; check every document in the Books test organisation against LAX and Xero by hand. The
   test organisation gets **no full history**: it gets one small window of Shop history, to prove
   the import end to end against real Books (`books:import-shop-history --since <day> --before
   <day after> --max-documents 20`), checked by hand against Xero. Use a window of a few orders;
   the full history is imported once, into live (step 4e).
4. **Cutover window** (one window, both products, in this order; write the time of each step down):
   a. **Check**: preconditions 1 to 9 are met, the daily reconciliation report is clean, and the
      accounting alerts are quiet.
   b. **Stop Xero writes**: set `XERO_API_WRITES_DISABLED=true` for the API and the worker and
      deploy both. Wait until every instance runs the new value, and write down that time as
      **T, the cutover instant**. From T LAX writes nothing to Xero; Books is still not live, so
      no sale is booked twice. A sale made between T and step 4c is booked nowhere yet; step 4d
      books it.
   c. **Switch**: move both products to position 4 in one transaction (the statement above, once
      for each product, then the `SELECT`): exactly one `live_source` per product.
   d. **Backfill the gap**: for each product, `books:backfill --product <p> --not-before T
      --from T --to <now>` until `next` is `null` (a dry run first). Only windows from T are ever
      backfilled (see `books:backfill`). Check the Xero sales invoices after T: none.
   e. **Import the Shop history into live**: only after the "Your invoice" email change is
      deployed (precondition 9), with the Shop at position 4 so its target is Books live, run
      `books:import-shop-history --before <cutover day> --dry-run` and check the report against
      Xero again (the counts and totals must agree, for the target actually used), then without
      `--dry-run` once a day until it reports nothing left. It takes at most a quarter of the Books
      daily call budget a day (125 documents at the default budget of 1,000 calls; a contact and an
      invoice each count one), so plan `documents ÷ 125` days, from the dry run's `wouldQueue`.
      Live work keeps the other three quarters. Then check Finance › Accounting as under "Verify
      against Xero".

## Commands

Both run in the worker image (`pnpm --filter @auction/worker <script> -- …`) with the worker's
database role (`DATABASE_URL_WORKER`) and `ZOHO_BOOKS_ORG_CONFIG` set. They only **queue**
documents in LAX's accounting queue; the running worker's sender sends them, through the same
guards as everything else (LAX reference and duplicate checks, read-back, the organisation binding,
the per-organisation rate limit and the daily call budget). Each prints one JSON line.

### `books:import-shop-history`

Queues every past Shop invoice and its buyer's contact for the Books target the Shop switch names.

```
pnpm --filter @auction/worker books:import-shop-history -- --before 2027-01-01 [--dry-run] [--max-documents N]
```

- `--before` (required): the cutover day, `YYYY-MM-DD`; orders paid before 00:00 London that day
  are history.
- Only the Shop: it reads `shop_order` alone and refuses any document that is not a Shop one. Bid
  is never read or imported.
- Keeps the numbers: each invoice is the Shop's own `LAX-INV-…` number.
- Idempotent and resumable: each document is registered under its LAX reference and target, so a
  second run (or a run after a crash part-way through an order) queues only what is missing.
- Budget: it queues at most `--max-documents` new documents a run, by default a quarter of
  `ZOHO_BOOKS_DAILY_CALL_BUDGET` (each document costs about two Books calls: create and read back),
  less what it already queued today (UTC), counted again before each document so two runs at the
  same time share the one allowance. Live work keeps the rest. An invalid
  `ZOHO_BOOKS_DAILY_CALL_BUDGET` stops the command, as it stops the sender.
- Refuses when the Shop switch is not aimed at Books, or is aimed at Books `live`.

Expected output (dry run, nothing written):

```json
{"dryRun":true,"target":{"provider":"books","mode":"dry_run"},"orders":412,"deliveryInvoices":3,"refunded":{"refunded":{"orders":5,"invoiceGrossPence":210000},"partiallyRefunded":{"orders":2,"invoiceGrossPence":88000}},"queued":{"contact":0,"invoice":0},"wouldQueue":{"contact":388,"invoice":412},"alreadyQueued":{"contact":0,"invoice":0},"parked":0,"refused":[],"invoiceGrossPence":10423500,"firstNumber":"LAX-INV-000001","lastNumber":"LAX-INV-000412","stoppedAtBudget":false}
```

`orders` is the number of Shop orders read; `deliveryInvoices` counts the separate `<number>-D`
invoices of deliveries outside the UK (queued parked, in "Needs a person", never sent); `refunded`
counts orders later refunded in full or in part (see precondition 7).

Then for real: the same line with `"dryRun":false` and `queued` counting what it queued now. A
second run shows everything under `alreadyQueued` and nothing queued. `stoppedAtBudget: true` means
run it again tomorrow. Anything in `refused` (an order whose stored rows do not add up, a VAT
treatment LAX has no booking for) is not imported and needs a person.

### `books:backfill`

Projects again the domain events of one product in a window, under the switch as it is now, so a
document LAX should have sent while Books was off or dry run is queued for the current target.

```
pnpm --filter @auction/worker books:backfill -- --product shop --not-before 2027-01-01T00:00:00Z --from 2027-01-01T00:00:00Z --to 2027-01-08T00:00:00Z [--after <event id>] [--limit 200] [--dry-run]
```

- `--not-before` (required) is **T, the cutover instant** (Order, step 4b). A `--from` before it is
  refused (`before_cutover`) and nothing is read. Before T the Xero path was still booking every
  sale: backfilling it would bring Bid history into Books (never, F18) and book Shop sales a second
  time, payment included. So the backfill is only for a window that starts at or after T, while the
  product was meant to book in Books: the gap between T and the switch moving to position 4
  (step 4c), or a later outage of the projector. It is never for a window in which the product was
  in dry run or on Xero.
- At most `--limit` events a run (default 200, never more than 500); `next` in the output is the
  `--after` for the following run, `null` when the window is done.
- Same projection, same guards as the projector: a replay changes nothing, a reference already
  queued for this target stays as it is.
- It stops (`waiting` with reason `queue_full`) while the target already holds as many unsent
  documents as the import's daily share of the Books call budget (125 at the default budget), so
  live documents are never left waiting behind a backlog: run it again once the sender has caught
  up (Finance › Accounting shows the queue), from the printed `--after`.
- `--product bid` backfills only Bid's own events in the window.
- An event that must wait (an invoice still being sent) stops the run: run it again later with the
  printed `--after`. An event refused (`refused`) is listed and the run goes on; it needs a person.
- `--dry-run` writes nothing: it reads each event's facts and checks which of its documents the
  target already holds. `wouldCreate` is the number a real run would queue and `replayed` those
  already held.

Expected output:

```json
{"dryRun":false,"product":"shop","events":37,"projected":37,"created":74,"wouldCreate":0,"replayed":0,"skipped":0,"refused":[],"waiting":null,"next":null}
```

## Verify against Xero

Before position 4, and again a day after it:

1. From Xero, export the Shop sales invoices dated before the cutover: their count, the first and
   last `LAX-INV-` number and the sum of their totals (VAT inclusive).
2. Compare with the import's dry run report: `orders` with the count of Xero invoices numbered
   `LAX-INV-…` without a `-D`, `deliveryInvoices` with the count of `-D` invoices, `firstNumber` and
   `lastNumber`, and `invoiceGrossPence` with the sum (it includes the `-D` invoices). They must
   agree to the penny. A difference is an order whose stored rows differ from Xero's invoice: stop
   and ask the accountant. The report's `refunded` figures are the orders that carry a credit note
   in Xero and none in Books (precondition 7); they explain no other difference.
3. After the import has run, Finance › Accounting filtered to the Shop shows the same number of
   invoices issued (in the dry run target: built and logged) and nothing in "Needs a person".
4. For every product, the daily reconciliation report (`accounting/reconciliation/`) shows no
   mismatch for the first week after position 4.

## Rolling back

Move the product's switch back one position (4 → 3, 3 → 2, 2 → 1) with the statement above.

- **From 4 (Books live) back to Xero**: this is the cutover window run backwards, so both
  products together (the flag is global). In this order:
  1. **Flip the switches first**: set `xero_mode = 'live'`, `books_mode = 'off'` for each product in
     one statement (never two live sources). Books takes no new document from now on; Xero still
     takes nothing, because its writes are off, so write down this time.
  2. **Decide the unsent documents.** Documents queued for Books `live` that were not sent are never
     sent to Xero, and their events were never written to Xero either: those sales are in neither
     ledger. List them (Finance › Accounting, or this query) and decide each one with the accountant:
     ```sql
     SELECT product, kind, lax_reference, state, created_at FROM accounting_document
      WHERE target_provider = 'books' AND target_mode = 'live'
        AND state IN ('pending', 'sending', 'unknown', 'failed', 'needs_review')
      ORDER BY created_at;
     ```
  3. **Unset `XERO_API_WRITES_DISABLED`** (API and worker) and deploy both.
  4. **Reconcile the window** between step 1 and step 3: every sale in it was booked nowhere. Find
     them from LAX's orders and payments, and enter each in Xero as the accountant directs.
     Documents already issued in Books stay there.

  Unsetting the flag before the flip would let the Xero path and Books `live` both book the same
  sales, so the flag is always last. Going to 3 instead (`off`, `test_org`) stops new live Books
  documents but leaves Xero read-only, so it is only for a pause of hours.
- **From 3 or 2 to 1**: documents queued for the old target stay in the queue under that target and
  are never sent to a new one; the projector moves past the events while the product is on Xero.
- The history import needs no rollback in rehearsal (it only queued documents for the dry run or
  test target). Documents already queued are never sent to another target: moving the switch on
  means running the import again for the new target.
