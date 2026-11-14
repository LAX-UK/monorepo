# Zoho Books cutover (Shop history import, backfill, switching over)

Status: **rehearsal only**. The worker builds the Books dry run adapter alone
(`createBooksAccountingAdapters`), and both commands below refuse a product whose switch is on
Books `live`. Nothing in this runbook touches a live Books organisation until a later change wires
the test and live organisations and lifts that refusal.

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
writing to Xero until `XERO_API_WRITES_DISABLED=true` is set for the API and the worker, which is
part of position 4 (F20: Xero becomes read-only). Positions 2 and 3 therefore run alongside Xero
unchanged.

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

## Order (F19)

1. **Dry run for a week** (both products at position 2). Each day: Finance › Accounting has no
   unexplained "Needs a person", `accounting_*` alerts are quiet, the daily reconciliation report
   shows no mismatch.
2. **Shop history import, dry run then for real (in the dry run target).** Run
   `books:import-shop-history --before <cutover> --dry-run`, check the report against Xero, then run
   it without `--dry-run` until it reports nothing left (it stops each day at its share of the Books
   call budget; run it again the next day).
3. **Test organisation**: one Bid sale and one Shop day at position 3. Check every document in
   the Books test organisation against LAX and Xero by hand.
4. **Live**: position 4 on the cutover date, Shop then Bid. Run the backfill (below) for any window
   in which a product was meant to book but its switch was off or dry run.

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
  less what it already queued today (UTC). Live work keeps the rest.
- Refuses when the Shop switch is not aimed at Books, or is aimed at Books `live`.

Expected output (dry run, nothing written):

```json
{"dryRun":true,"target":{"provider":"books","mode":"dry_run"},"orders":412,"queued":{"contact":0,"invoice":0},"wouldQueue":{"contact":388,"invoice":412},"alreadyQueued":{"contact":0,"invoice":0},"parked":0,"refused":[],"invoiceGrossPence":10423500,"firstNumber":"LAX-INV-000001","lastNumber":"LAX-INV-000412","stoppedAtBudget":false}
```

Then for real: the same line with `"dryRun":false` and `queued` counting what it queued now. A
second run shows everything under `alreadyQueued` and nothing queued. `stoppedAtBudget: true` means
run it again tomorrow. Anything in `refused` (an order whose stored rows do not add up, a VAT
treatment LAX has no booking for) is not imported and needs a person.

### `books:backfill`

Projects again the domain events of one product in a window, under the switch as it is now, so a
document LAX should have sent while Books was off or dry run is queued for the current target.

```
pnpm --filter @auction/worker books:backfill -- --product shop --from 2027-01-01T00:00:00Z --to 2027-01-08T00:00:00Z [--after <event id>] [--limit 200] [--dry-run]
```

- At most `--limit` events a run (default 200, never more than 500); `next` in the output is the
  `--after` for the following run, `null` when the window is done.
- Same projection, same guards as the projector: a replay changes nothing, a reference already
  queued for this target stays as it is.
- `--product bid` backfills only Bid's own events in the window, never Bid history from before
  Bid's start in Books (choose `--from` at or after the day Bid left position 1).
- An event that must wait (an invoice still being sent) stops the run: run it again later with the
  printed `--after`. An event refused (`refused`) is listed and the run goes on; it needs a person.

Expected output:

```json
{"dryRun":false,"product":"shop","events":37,"projected":37,"created":74,"replayed":0,"skipped":0,"refused":[],"next":null}
```

## Verify against Xero

Before position 4, and again a day after it:

1. From Xero, export the Shop sales invoices dated before the cutover: their count, the first and
   last `LAX-INV-` number and the sum of their totals (VAT inclusive).
2. Compare with the import's dry run report (`invoices`, `firstNumber`, `lastNumber`,
   `invoiceGrossPence`). They must agree to the penny. A difference is an order whose stored rows
   differ from Xero's invoice: stop and ask the accountant.
3. After the import has run, Finance › Accounting filtered to the Shop shows the same number of
   invoices issued (in the dry run target: built and logged) and nothing in "Needs a person".
4. For every product, the daily reconciliation report (`accounting/reconciliation/`) shows no
   mismatch for the first week after position 4.

## Rolling back

Move the product's switch back one position (4 → 3, 3 → 2, 2 → 1) with the statement above.

- **From 4 (Books live) back to Xero**: unset `XERO_API_WRITES_DISABLED` (API and worker), then
  set `xero_mode = 'live'`, `books_mode = 'off'` for the product in one statement (never two live
  sources). Documents already issued in Books stay there; the accountant decides how the window
  is shown in Xero. Going to 3 instead (`off`, `test_org`) stops new live Books documents but
  leaves Xero read-only, so it is only for a pause of hours.
- **From 3 or 2 to 1**: documents queued for the old target stay in the queue under that target and
  are never sent to a new one; the projector moves past the events while the product is on Xero.
- The history import needs no rollback in rehearsal (it only queued documents for the dry run or
  test target). Documents already queued are never sent to another target: moving the switch on
  means running the import again for the new target.
