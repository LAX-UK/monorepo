# Review of PR #1376: Zoho Books, Stripe fees and payouts, daily reconciliation (rehearsal)

Branch `bk13-stripe-fees-reconciliation` at `689772db`, compared with `origin/main` at `3c911293`.
This is an independent security and money review. The branch was not changed.

## Verdict: FIX FIRST

The money core is sound. Amounts are integer pence exactly as Stripe reported them, with no VAT,
and the signs are right for every fee, fee refund and payout case. Nothing double-books a charge,
refund or dispute. The references are unique and the id encoding is injective. Attribution comes
only from stored rows. The definer function and the grants are least privilege. Stripe is only
read, and paging is restart-safe and idempotent under real concurrent transactions.

Four things must change before merge:

- **F1:** the migration number collides with #1375.
- **F2:** a wrong or missing Stripe key turns the whole job into a silent no-op.
- **F3:** one unexpected Stripe value stops an account for good.
- **F4:** the Bid clearing check can never agree, so the new alert becomes noise.

None of these books wrong money in the rehearsal: Books is in dry run and Stripe is read-only. F1
blocks the merge. F2 to F4 defeat the purpose of the reconciliation.

## How this was checked

- **Setup.** `pnpm install --frozen-lockfile` and the package builds. Throwaway Postgres 16
  (initdb under `/var/tmp`, port 55432), then `db:migrate` and `db:roles`. No `next build`.
- **Tests run (`--maxWorkers=2`), all passing:**
  - accounting-domain: 303
  - accounting-zoho-books: 318
  - worker `src/finance/accounting` and `register-accounting-workers`: 183. This includes
    `stripe-books.integration.test.ts` against real Postgres as `worker_app`, not skipped.
  - persistence accounting and lib: 198
  - db: 0384 and 0385 migration tests, the worker, api and shop role contracts, and the
    main-upgrade integration test (`WORKER_ROLE_CONTRACT_REQUIRED=1`).
  - The 0385 integration test is skipped unless `MIGRATION_TEST_DATABASE_URL` points at a
    *migrated* database. Against an empty one it fails with "accounting_document_event does not
    exist". Against a migrated one it passes.
- **Rollback.** `0385_rollback.sql`, then forward, then rollback and forward again, on a database
  holding about 630 expense and transfer rows. Every step was clean. What stays behind is in F5.
- **Grants, probed by connecting as each real role:**
  - `api_app`, `shop_app` and `auth_app`: permission denied on all four new tables and on
    `accounting_stripe_shop_order`.
  - `worker_app`:
    - It can read the account rows but cannot insert or update them.
    - It can insert balance transaction rows. It cannot update or delete them; the owner's delete
      is refused by the trigger.
    - It can insert the cursor but cannot update `stripe_account_id` or delete it.
    - It cannot delete report rows.
    - It still cannot read `shop_order.stripe_payment_intent_id`, but it can execute the function.
  - The function is `SECURITY DEFINER` with `search_path=pg_catalog, public` and an owner-only
    ACL plus `worker_app`. It queries the schema-qualified table `public.shop_order` and returns
    only the order uuid. No application role has `CREATE` on `public`.
- **Stripe write calls.** The diff contains no Stripe write call. The reader uses only
  `accounts.retrieve`, `balanceTransactions.list` and `balance.retrieve`.
- **Mutation checks.** Each guard was broken in turn and the relevant tests were run:

| # | Mutation | Result |
|---|---|---|
| M1 | `record` books even when its insert lost the race | killed (worker integration) |
| M2 | Stripe ids lower-cased instead of encoded | killed (4 domain tests) |
| M3 | no stored row falls back to the account's product | killed (2) |
| M4 | cross-company check removed | killed (2) |
| M5 | cursor moved before the window is recorded | killed (2) |
| M6 | only the first page of a window read | killed (4) |
| M7 | 10-minute settle removed | killed (1) |
| M8 | GBP check removed | killed (1) |
| M9 | payout sign check removed | killed (1) |
| M10 | dispute amount booked as a fee | killed (1) |
| M11 | credit of Stripe's own fee booked | killed (1) |
| M12 | `payout_failure`/`payout_cancel` not parked | killed (1) |
| M13 | negative fee not parked | killed (1) |
| M14 | parked transactions not counted as mismatches | killed (1) |
| M15 | in-flight documents not subtracted in clearing | killed (1) |
| M17 | append-only trigger removed | killed (static SQL test) |
| M18 | VAT allowed on expense and transfer | killed (static SQL test) |
| M19 | `REVOKE ... FROM PUBLIC` on the function removed | killed (static SQL test) |
| M21 | `SECURITY DEFINER` removed (fresh database, migrated with the mutant) | killed (4 worker integration tests) |
| M16 | `SET search_path` removed from the function | **survived** (see F9) |
| M20 | function returns the PaymentIntent instead of the order id | **survived** (see F9) |

### Confirmed correct (no finding)

- **Amounts and signs** (`packages/accounting-domain/src/projection/stripe-balance.ts:81-100`):
  - **A charge's fee** is booked as `fee`. The charge amount itself is never booked here.
  - **`stripe_fee`, `stripe_fx_fee` and `tax_fee`** are booked as `-amount`. A positive amount
    is parked as `fee_refund`.
  - **An instant payout** gives an expense for `fee` and a transfer for `-amount`. Together that
    is exactly `-net`.
  - **Parked:** `payout_failure`/`payout_cancel` (`payout_reversed`), and a payout with a
    positive amount or no payout id (`bad_amounts`).
  - **A negative fee** is parked as `fee_refund`.
  - **A refund with no fee, a Connect transfer, or a dispute amount** gives `nothing`.
  - **Integers are checked** with `Number.isSafeInteger` and `isPence`. The value travels as
    integer pence to `penceToPounds`.
- **No VAT.** The domain sends none, the adapter sends no `tax_id`, and the DB totals CHECK
  enforces it. The read-back compares `total`/`amount`, so if Books adds VAT, the document reads
  back as `differs`.
- **No double-booking of other flows.** The job registers only `EXP` and `TRF` documents. Payments,
  refunds and disputes keep their own references (`PAY`/`CN`). The balance transaction's primary
  key plus `ON CONFLICT DO NOTHING` decides once. The registry's per-target reference uniqueness
  is a second guard (M1 shows the first guard is the one the tests pin).
- **References.** `LAX-<P>-EXP-<txn>` and `LAX-<P>-TRF-<po>`. Balance transaction and payout ids
  are globally unique in Stripe, and the product prefix separates companies. The encoding maps a
  capital to `-` plus the lower-case letter, and Stripe ids never contain `-`, so it is
  injective. `stripeIdFromSourceId` refuses a `-` that is not followed by a lower-case letter.
  An id too long for the 64-character source id is refused, never truncated.
- **Attribution** (`apps/worker/src/finance/accounting/stripe-books-sync.service.ts:216-238`):
  - Payouts and Stripe's own fees take the account row's product.
  - Anything else takes stored `payment`, `payment_group` or Shop order rows only.
  - No row gives `unattributable`.
  - Two products, or a different legal entity from the account's, gives
    `attribution_conflict`.
- **Paging and cursor.**
  - Windows are `[from, to)` and contiguous, with the upper bound at now minus 10 minutes.
  - `starting_after` walks each window to the end, then the items are sorted oldest first.
  - The cursor moves only after the window is recorded, through `greatest(...)`, so it never
    moves back.
  - Two concurrent runs book each item once (integration test with two pools).
- **The dry-run gate.** The job only writes database rows. The target is chosen inside
  `register()` from `accounting_source_setting`, and sending goes through the existing sender,
  dispatch and dry-run adapter. No new path reaches a Books organisation.
- **Report contents.** Only ids, types, amounts and counts. The key is under
  `accounting/reconciliation/<entity>/<day>/`, and a DB CHECK pins it. It is a `.json` file, so
  the email-attachment rule (`accounting/` and `.pdf` only) can never send it.

## Findings

### F1 (Medium, blocks merge): migration 0385 collides with #1375 and #1377. This PR must renumber.

- **Where:**
  - `packages/db/drizzle/0385_stripe_fees_payouts_books.sql`
  - `packages/db/drizzle/0385_rollback.sql:51`
  - `packages/db/drizzle/meta/_journal.json` (idx 377, `when` 1811419200000)
  - `packages/db/src/migration-main-upgrade.integration.test.ts` (`FINAL_FOLDER_MILLIS`)
- **Scenario:** #1375 (`0385_accounting_credit_note_refunds`) and #1377
  (`0385_accounting_books_status`) use the **same** idx 377, the same `when` 1811419200000 and
  the same file name `0385_rollback.sql`. #1375 holds 0385, so **this PR renumbers**. If it
  merges second it takes 0386, and #1377 then takes 0387. It does not fail silently: the runner
  refuses ("Migration history diverged at 1811419200000"). But any database that already ran this
  branch, including the rehearsal test database, needs `0385_rollback.sql` from this branch run
  first. Otherwise it cannot migrate to main once #1375 is in.
- **Fix:** rename this migration and its rollback to the next free number. Bump the idx and
  `when`, the rollback's `DELETE ... WHERE created_at`, `FINAL_FOLDER_MILLIS`, the 0385 test file
  names and contents, and the "migration 0385" mentions in `migrate-roles.ts`, the runbook and the
  PR body. Add a runbook note to roll back the branch's 0385 on any database that ran it.

### F2 (Medium): a missing or wrong Stripe key silently turns the job and the reconciliation into a no-op

- **Where:**
  - `apps/worker/src/finance/accounting/stripe-books-sync.service.ts:115-127`: an unregistered
    account, or one with no opening, is only `log.warn`.
  - `apps/worker/src/finance/accounting/stripe-reconciliation.service.ts:171-184`: a registered
    account with no balance read gives `stripeBalancePence = null`, so `unexplainedPence` is
    null and that is not a mismatch.
  - `apps/worker/src/container/create-accounting-runtime.ts:149`: when the key setting is unset,
    no readers are built.
- **Scenario:** `accounting_stripe_account` names `acct_A`, but `STRIPE_BOOKS_READ_KEYS` is unset,
  holds a key for another account, or holds a revoked key. A revoked key at least fails the job.
  In the other cases:
  - nothing is read for `acct_A`;
  - the job succeeds, so the cron monitor stays green;
  - the report shows zero on both sides with clearing null, so there are zero mismatches and no
    alert.

  Finance believes fees and payouts are reconciled while nothing is.
- **Fix:** count it as a mismatch, and raise the alert, when any registered account was not read
  that run or its balance could not be read. Also count it when a key reads an unregistered
  account. Put an `accountsNotRead` list in the report. Mutation-test it.

### F3 (Medium): one unexpected Stripe value stops an account permanently, with no report

- **Where:**
  - `packages/persistence/src/repositories/accounting/drizzle-stripe-books.ts:153`, where
    `StripeLedgerRefusedError` is thrown inside the record transaction.
  - The DB CHECKs at `packages/db/drizzle/0385_stripe_fees_payouts_books.sql:97-104`
    (`txn_`, `^[a-z]{1,8}_...` source, `po_` payout).
  - `stripe-books-sync.service.ts:156-171`, which has no per-item error handling.
- **Scenario:** a balance transaction arrives that the row CHECKs or the registry refuse. For
  example:
  - a source id whose prefix is longer than 8 letters or holds a digit;
  - a type that does not match `^[a-z_]{1,64}$`;
  - a `reference_in_use` refusal.

  `record` throws, and the window is never finished, so the cursor never moves. The job fails
  before the report, then again on all 3 attempts, and again every day after. Every later fee and
  payout of that account waits behind it, and no reconciliation report is produced for any
  company: the report runs after the sync in the same job. Only the cron monitor says anything,
  and nothing names the transaction.
- **Fix:**
  - Record such a transaction as `parked` with a new reason, `unrecognised`, in its own
    transaction, without documents, and carry on.
  - Loosen the source CHECK to Stripe's general id shape, or drop it, since only `payout_id` is
    used.
  - Let the reconciliation run, for the days it can, even if one account's read failed. Mark the
    report "incomplete" and raise the alert.
  - Add a test with one poison item in the middle of a page.

### F4 (Medium): the Bid clearing comparison can never agree, so the mismatch alert becomes daily noise

- **Where:** `apps/worker/src/finance/accounting/stripe-reconciliation.service.ts:179-184`, and
  the PR's "Residual risk".
- **Scenario:** Bid pays sellers through Stripe Connect transfers from the platform balance
  (`payout.stripe_transfer_id`). Each one is a `transfer` balance transaction, which this job
  records as `nothing`, and no other Books flow takes it out of clearing. From the first seller
  payout onwards:
  - Stripe's balance is lower than "opening + payments − fees − payouts" by every transfer made;
  - refunds and dispute amounts widen the gap further;
  - so `unexplainedPence ≠ 0` every day, and `accounting_reconciliation_mismatch` fires daily.

  The residual-risk list names refunds and disputes but not seller transfers. `heldTransferPence`
  is reported but is not part of the comparison. A real difference, such as a missed payout or a
  wrong fee, is then hidden in a number that is never zero.
- **Fix:** the ledger already stores every balance transaction, including `nothing` rows with
  their amounts. In the clearing section, show "movements no Books flow books yet" by type
  (transfer, transfer reversal, refund, dispute adjustment) from the ledger since the opening.
  Compare `stripe − books − inFlight − knownUnbooked`. Alert only on what remains, and still show
  the known part. Add a test with one seller transfer that expects no clearing mismatch.

### F5 (Medium): rollback, then re-apply, loses every Stripe document that was waiting, while the new ledger says "booked"

- **Where:** `packages/db/drizzle/0385_rollback.sql:14-23` cancels `pending`/`failed` and drops
  the ledger. The replay branch is in
  `packages/persistence/src/repositories/accounting/drizzle-accounting-document.registry.ts:128`.
- **Scenario:** roll back, then apply again. The job reads Stripe again from the opening day.
  `register()` finds the *cancelled* document under the same reference, target and payload, and
  returns it as a replay (`created: false`). The new ledger row says `booked`, but the document
  stays cancelled and is never sent. Per the runbook, a cancelled document is never sent and has
  no Release. Re-applying after a rollback, as the rehearsal does, therefore permanently drops
  those fees and payouts. The report only shows a count difference.

  `needs_review`, `unknown` and `issued` rows also survive the rollback with a kind the earlier
  release does not know. Low on its own.
- **Fix:** either:
  - stop the rollback cancelling these documents (keep their kinds valid, `NOT VALID` is
    already used); or
  - on re-apply, let `record` see a cancelled replay and park the transaction (`was_cancelled`)
    instead of reporting it `booked`.

  State the consequence in the rollback header and the runbook. Add a rollback, forward, sync
  test.

### F6 (Medium): one Books document per charge fee, queued in a block at 05:30, competes with invoices for the daily budget

- **Where:**
  - `stripe-books-sync.service.ts:156-171`
  - the sender's FIFO by `created_at`
    (`packages/persistence/src/repositories/accounting/drizzle-accounting-document.work-queue.ts:79`)
  - the default `ZOHO_BOOKS_DAILY_CALL_BUDGET` of 1,000
- **Scenario:** in the test organisation or live, every card payment adds an expense (one create
  plus any lookups), and every payout adds a transfer. The daily job registers a whole day at
  once. A first run from an old `opening_on` registers weeks at once. Those documents are older
  than the invoices made later that day, so they go first. A busy day or a catch-up can spend most
  of the budget before buyer invoices go out. That raises `accounting_bid_invoice_delayed`, and
  then the budget stops everything. The hard budget is respected, but the fee flow takes priority
  over buyer-facing documents.
- **Fix:** for the live phase, either:
  - book one expense per payout or per day (Stripe's payout reconciliation grouping), with the
    balance transaction ids kept in the ledger; or
  - give expenses and transfers a lower send priority and a per-run cap.

  At minimum, document the expected calls per day against the budget before the test
  organisation step.

### F7 (Low): the ledger decides each transaction once for whatever target was set, so moving from dry run to the test org or live never re-books earlier fees

- **Where:** `stripe-books-sync.service.ts:272`, and `drizzle-stripe-books.ts:146` (insert
  once).
- **Scenario:** other flows queue the same reference again for a new target when the switch moves
  on (registry comment). Here the row is final, so every fee and payout read during the dry-run
  rehearsal is never registered for the test org or live. Clearing in the new mode starts from
  the old opening without those movements, so it differs for good. This is deliberate ("books
  what happens from then on"), but the runbook does not tell the engineer to restate
  `opening_balance_pence`/`opening_on` at each mode switch. It also does not say to add an
  account row only once its product is aimed: otherwise everything up to then is recorded
  `not_aimed` for good.
- **Fix:** add both steps to the runbook set-up and switch checklist. Optionally, show the target
  mode on each ledger row and in the report.

### F8 (Low): Books field length for the reference is not confirmed

- **Where:** `packages/accounting-zoho-books/src/adapter/mappers/movement.ts:64,84`
  (`reference_number`) and the custom field.
- **Scenario:** each capital doubles in length.
  - A typical `txn_` plus 24 characters becomes about 50 characters in `LAX-SHOP-EXP-...`.
  - A 24-character id that is all capitals gives 65 characters.
  - The format allows up to 77.

  Earlier kinds stay under about 45. If Books caps `reference_number` or the unique custom field
  below that, every expense is refused (rejected, so the document goes to `failed`). Nothing is
  mis-booked, but nothing books either.
- **Fix:** confirm both limits in the test organisation (add this to the PR's "to confirm"
  list). Add a mapper test that the longest legal reference fits.

### F9 (Low): no test pins the definer function's safety properties

- **Where:** `packages/db/drizzle/0385_stripe_fees_payouts_books.sql:155-165` and
  `packages/db/src/migration-0385-*.test.ts`.
- **Scenario:** removing `SET search_path` (M16), or returning the PaymentIntent instead of the
  order id (M20), passes every test. The function is correct today, but a later edit could widen
  what `worker_app` learns about Shop orders unnoticed.
- **Fix:** in the 0385 integration test, assert three things: `prosecdef`, the exact
  `proconfig` (`search_path=pg_catalog, public`), and that the return type is `uuid`. Add a
  `worker_app` contract assertion that the function returns the order id and that
  `shop_order.stripe_payment_intent_id` stays unreadable.

### F10 (Low): read-only is enforced only by the key's permissions

- **Where:**
  - `apps/worker/src/env.ts:293`: only checks the `rk_` prefix, and accepts `rk_test_` anywhere.
  - `apps/worker/src/container/create-accounting-runtime.ts:149-155`: builds a full SDK client
    and casts it to `StripeReadClient`.
  - `apps/worker/src/finance/accounting/stripe-balance-reader.ts:102,116`.
- **Scenario:**
  - **Write access.** An `rk_` key can carry write permissions, and nothing in code can tell.
    The code makes no write call today.
  - **Account read.** `accounts.retrieve()` (GET `/v1/account`) may need a permission beyond
    the three in the runbook. If it does, the job fails every day.
  - **Charge data.** `expand: ["data.source"]` loads full charge objects, with billing
    name/email and card brand/last4, into worker memory. They are discarded at once by
    `sourceOf` and not logged, but this is more than the job needs.
- **Fix:**
  - Pass the narrow interface rather than casting a full client.
  - Refuse `rk_test_` when `NODE_ENV=production`.
  - Confirm in the rehearsal that `/v1/account` works with the stated permissions, or take the
    account id from configuration.
  - Consider `expand: ["data.source"]` only for the types that need a charge or PaymentIntent.

### F11 (Low): attribution lookups scan `payment` and `shop_order` once per fee

- **Where:** `drizzle-stripe-books.ts:103-116` and the function at
  `0385_stripe_fees_payouts_books.sql:161`.
- **Scenario:**
  - `payment.stripe_payment_intent_id` and `shop_order.stripe_payment_intent_id` have no index.
  - The OR over two columns cannot use `payment_stripe_charge_id_uidx`, which is partial on
    `payment_group_id IS NULL`.
  - EXPLAIN shows sequential scans of both tables for every balance transaction with a fee.

  This is fine at today's volume. It grows as payments × fees per day, and with the catch-up.
- **Fix:** add indexes on those two columns, or split the query into separate equality lookups.

### F12 (Low): the report's `byType` counts documents that are still on their way as mismatches

- **Where:** `stripe-reconciliation.service.ts:131-134`.
- **Scenario:** a payment registered late yesterday and not yet issued at 05:30 counts as a
  difference, even though the PR says in-flight documents are not a difference. That is true
  for clearing only. In the test organisation every day with a late payment raises the alert.
  Also, when a run fails, that day is never reported, because the job reports only "yesterday".
- **Fix:** compare `laxCount` against `booksCount + notIssuedCount` and show the pending part
  separately. On each run, report every day since the last stored report.

### Not a finding: report storage

The report is written to the same bucket as the stored invoice copies (`uploadStorage`, no ACL
set), as the PR says. That bucket also has a public base URL for uploads. Its privacy depends on
the bucket policy not exposing `accounting/`. That is a pre-existing condition shared with the
invoice copies. Please confirm it once for both.

## Must-fix summary

1. **F1:** renumber to the next free migration number after #1375.
2. **F2:** alert when a registered account was not read or its balance was not read.
3. **F3:** park, never stall, a transaction that cannot be recorded. Do not block the report.
4. **F4:** take known unbooked movements (seller transfers, refunds, dispute amounts) out of the
   clearing difference.

F5 and F6 should be settled before the test-organisation step. F7 to F12 can follow.

## Fixes after review

All fixes are on `bk13-stripe-fees-reconciliation`, on top of `689772db`, now at `7ad341da`. Each was
pushed once its tests passed. "Mutation" means the guard was reverted, a named test failed, and the
guard was put back.

| Finding | Fix | Commit | Test | Mutation |
|---|---|---|---|---|
| F1 | #1375 merged (`0385_accounting_credit_note_refunds` is on main), so origin/main was merged in and this migration is now `0386_stripe_fees_payouts_books`. It has its own journal entry (idx 378, `when` 1811505600000). `0386_rollback.sql` deletes that ledger row. The test files, the "migration 0385" comments and `FINAL_FOLDER_MILLIS` were updated to match. #1375's 0385 test no longer expects to be last. The runbook explains how to bring a database that ran the branch's old 0385 onto main, and says to roll back 0386 before 0385. #1377 also uses 0385 and must renumber to 0387. | `7ad341da` | `migration-0386-*.test.ts` (static and database), `migration-main-upgrade.integration` (23 pass) | Rollback deleting the old `created_at`: killed. Journal `when` set back to 0385's: killed (2 tests). |
| F2 | The report now has `accountsNotRead` (`no_opening`, `balance_not_read`, `not_read_through` against the end of the reported day, and `not_registered` for a key whose account has no row, shown in every report) and `complete`. Each entry counts as a mismatch and raises the alert. A key whose balance read fails is left out, so its account is reported, and the report still runs. | `4dcbb5c6` | `stripe-reconciliation.service.test.ts`: no key, a key for another account, a stopped read, a failed key, no opening | Not counted, read-through check removed, balance check removed, unregistered keys dropped, catch removed, `no_opening` removed: all killed. |
| F3 | `record` catches a refusal from the registry or a CHECK violation (23514), rolls back, and records the row parked `unrecognised` in its own transaction with no documents. Any other error is still thrown. The source CHECK now accepts any Stripe id shape (`^[A-Za-z0-9_]{1,255}$`). One key failing no longer stops the other keys. The job writes the report first, then fails (`accounting_stripe_accounts_failed:<n>`), so the queue retries it. Only a failure of the whole run (switch or ledger unreadable) skips the report. | `738bd136` | Integration: a poison payout in the middle of a page is parked and the rest are booked, and the cursor moves on. Unit: the next key is read. Worker: still reports, then fails. Static: the source CHECK. | Ledger rethrows: killed. Per-key catch removed: killed (2). Job does not fail: killed. Old source CHECK: killed. |
| F4 | New `knownUnbooked(entity)` reads the ledger from each account's opening day: amount minus fee, plus what this job booked, minus a charge's amount (the payments flow books that), for `booked` and `nothing` rows, grouped by type. Parked and not-aimed rows are left out because they are differences. Clearing shows `knownUnbooked` and `knownUnbookedPence` and alerts on `stripe − books − inFlight − knownUnbooked` only. | `c3d687ea` | Unit: one seller transfer gives no clearing mismatch. Integration against the store: a transfer of −80.00 is counted, and a charge with a fee and a payout are not. | Not subtracted, charges not left out, booked payout not added back, `nothing` rows left out: all killed. |
| F5 | Of the two options, the simpler one: the rollback is unchanged, and `record` detects a replay of a *cancelled* document (`created: false`, status `cancelled`), rolls back, and records the transaction parked `was_cancelled`. The rollback header, the runbook table and the rollback paragraph state the consequence: book those by hand. | `9385a064` | Integration: a fee is booked, its document is cancelled as the rollback would, and the same transaction is read again with no ledger row. It is parked `was_cancelled` and the document stays cancelled. | Cancelled-replay check disabled: killed. |
| F6 | The sender's claim now hands out `expense` and `transfer` after every other waiting document. The sync reads no further window once a run has booked 200 transactions (`maxBookedPerRun`), and the next run continues. The runbook states the expected calls per day against the 1,000 budget. | `ea23f469` | Persistence integration: an older fee is claimed after a newer invoice. Unit: the cap stops at a window edge and the next run finishes. | Priority removed: killed. Cap removed: killed. |
| F8 | `BOOKS_REFERENCE_MAX_LENGTH = 100` in the movement mapper. A longer reference is refused as `zoho_books_mapping_reference_too_long`, never cut short. The test pins that the longest reference LAX makes (77 characters) fits. The README's "to confirm" list now includes both fields' limits. | `86673ebb` | `movement.test.ts` | Limit set to 76: killed. Guard removed: killed. |
| F9 | The migration's database test checks `prosecdef`, the exact `proconfig` (`search_path=pg_catalog, public`), the return type `uuid`, that the function returns the order's id, and null when there is none. The `worker_app` contract checks that the answer is a uuid, that PUBLIC cannot execute the function, and that `shop_order.stripe_payment_intent_id` stays unreadable. | `cf30f824` | `migration-0386-*.integration.test.ts`, `worker-app-role.contract.test.ts` | M16 (no `SET search_path`): killed. M20 (`RETURNS text` with the PaymentIntent): killed. M20b (uuid made from the PaymentIntent): killed. M21 (not definer): killed. Execute granted to PUBLIC on the live database: contract killed. |
| F12 | `DayKindTotals` gains `notIssuedPence`. `differencePence` is LAX − Books − on its way, and a count mismatch is `laxCount ≠ booksCount + notIssuedCount`. The pending part is shown per type. | `917920c5` | Unit: a payment not yet issued shows as pending, with no mismatch and no alert | Pence not netted: killed. Count not netted: killed. |

**Re-run after all fixes** (throwaway Postgres 16, port 55432, as `worker_app`, `--maxWorkers=2`):

- accounting-domain: 334 pass
- accounting-zoho-books: 329 pass
- worker `src/finance/accounting` and `register-accounting-workers`: 222 pass, including
  `stripe-books.integration` (10) against the database
- persistence accounting and lib: 207 pass with `--no-file-parallelism`
- db: the 0384, 0385 and 0386 migration tests and the worker, api and shop contracts pass (100),
  and `migration-main-upgrade.integration` passes (23), with `WORKER_ROLE_CONTRACT_REQUIRED=1`

On the database that had run the branch's old 0385, the runbook's renumber procedure worked:
`0386_rollback.sql`, then delete the old ledger row, then `db:migrate`, which applied 0385 and 0386.
Then rollback and forward twice, with `db:migrate` and `db:roles`. Each step was clean, and #1375's
0385 was untouched.

Notes:

- With two files in parallel, `accounting-credit-notes.integration` (from #1375, on main) fails 6–8
  cases, because it and `accounting-persistence.integration` both switch the shared source-setting
  modes. Each file passes alone, and all 207 pass in one process. Neither file is changed by this
  PR's logic (only a new claim-order case was added to the second). This was not re-checked on
  main itself.
- `WORKER_ROLE_CONTRACT_REQUIRED=true` (not `1`) also makes "cannot delete bid rows" demand a
  `bid` row, which an empty test database does not have. That is fixture only.

### Follow-ups not built

- **F7:** add to the runbook's set-up and switch checklist: restate `opening_balance_pence` and
  `opening_on` at each mode switch, and add an account row only once its product is aimed.
  Optionally show the target mode on each ledger row and in the report.
- **F10:** pass a narrow read interface instead of casting the SDK client, refuse `rk_test_` in
  production, confirm `/v1/account` works with the runbook's three permissions (or configure the
  account id), and expand `data.source` only for the types that need it.
- **F11:** index `payment.stripe_payment_intent_id` and `shop_order.stripe_payment_intent_id`,
  or split the attribution query into equality lookups.
- **F12, second half:** report every day since the last stored report, so a failed run's day is not
  skipped. Only the by-type netting was built.
- **F5:** a real rollback, forward and sync test. The integration test simulates it (cancelled
  document, no ledger row). The real cycle was only run by hand.
- **F6:** the alternative of one expense per payout or per day was not built. Check the cap (200)
  and the budget figures against real volumes before the test organisation step.
- **After #1375:** Bid refunds are now refunded from clearing in Books (`refund_credit_note`), but
  the clearing figure counts only payments, expenses and transfers, so `refund` stays in
  `knownUnbooked`. The arithmetic is consistent, but a refund missing from Books is not caught by
  clearing. Count issued credit-note refunds in the clearing figure and take `refund` out of the
  known list in the same change.
- **Persistence tests:** the two accounting integration files above should take the accounting
  tables lock (as the worker's integration tests do), or run in one file group.

### PR body changes

Replace the migration lines with:

> Migration `0386_stripe_fees_payouts_books` (rollback `0386_rollback.sql`), after #1375's 0385.
> A database that ran this branch before the renumber must run `0386_rollback.sql` and
> `DELETE FROM drizzle.__drizzle_migrations WHERE created_at = 1811419200000;` before it migrates to
> main (see the runbook). Roll back 0386 before 0385.

Replace the residual-risk list with:

> - Clearing leaves out, as known and shown by type, the Stripe movements its figure does not take
>   from Books: Bid seller transfers, refunds (Bid refunds are refunded from clearing by #1375 but
>   not yet counted in this figure), and dispute amounts. A difference that remains is real.
> - Fees and payouts read in dry run are never booked again for the test organisation or live:
>   restate the opening at each mode switch (F7, follow-up).
> - A transaction whose document a rollback of 0386 cancelled is parked `was_cancelled` when the
>   migration is applied again, and is booked by hand.
> - Books' limits on `reference_number` and the unique field (references up to 77 characters;
>   anything over 100 is refused) are to be confirmed in the test organisation.

Replace the alert behaviour with:

> `accounting_reconciliation_mismatch` fires when a type's totals or counts differ (documents on
> their way are shown, not counted), a transaction is parked (including `unrecognised` and
> `was_cancelled`), an account was not read (`accountsNotRead`: no opening, no balance read, not
> read through the day, or a key with no account row; the report says `complete: false`), or
> clearing differs after in-flight documents and known unbooked movements. A transaction the
> ledger refuses is parked, never stalls its account. If one account's read fails, the report is
> still made and the job then fails, so the queue retries it and Sentry reports it.

Add to "To confirm in the test organisation":

> - The length limits of `reference_number` and the unique LAX reference field on expenses and
>   bank transactions (77 characters must fit).
> - The expected Books calls per day for fees and payouts against `ZOHO_BOOKS_DAILY_CALL_BUDGET`,
>   and the per-run cap of 200.

## Final recheck

Branch `bk13-stripe-fees-reconciliation` at `7ad341da`, with `origin/main` at `e5c65039` (#1375
merged) as an ancestor. The PR branch was not changed. Throwaway Postgres 16 on port 55432
(`db:migrate` to 378, `db:roles`), integration suites as `worker_app` and `api_app`,
`--maxWorkers=2` (1 for database suites). No `next build`.

### Verdict: FIX FIRST

Every finding in scope is fixed correctly, with no regression in the touched code, and every
listed guard is pinned by a test that fails without it. One Medium remains, and it blocks: the two
persistence accounting integration files share state and fail whenever they run at the same time
(M1 below). It is a test-isolation fault, not a product fault, and the fix is a few lines. Once it
lands this is SHIP. Everything else is a follow-up.

### Suites

| Suite | Result |
|---|---|
| accounting-domain | 334 pass |
| accounting-zoho-books | 329 pass |
| worker `src/finance/accounting` and `register-accounting-workers` (database) | 224 pass |
| db: 0384, 0385, 0386 migration tests, worker, api and shop role contracts, `migration-main-upgrade` (`WORKER_ROLE_CONTRACT_REQUIRED=1`) | 123 pass |
| persistence `repositories/accounting` and `lib`, `--no-file-parallelism` | 207 pass |
| the same, files in parallel (2 or 4 workers), 4 runs | **6 to 8 fail every run** (M1) |

On GitHub, CI for this head (`test` job, run 43599845621) is green, and both files passed there.

### Per finding

| Finding | Correct | Regression | Mutations re-run |
|---|---|---|---|
| F1 | Yes. Journal idx 378, `when` 1811505600000: no duplicate idx or `when`, and `when` is strictly increasing. The idx gaps are older than this PR. `0386_rollback.sql` deletes only `created_at = 1811505600000`; after a rollback the ledger has 377 rows ending at 0385's stamp. #1375's `0385_*.sql` and `0385_rollback.sql` are byte for byte as on main; only its journal test was relaxed from "last" to "right after 0384". | None. A schema dump after the rollback matches a database migrated at main, except that the three `accounting_document` CHECKs come back `NOT VALID`, as the rollback header says. Rollback then forward, twice, with `db:migrate` and `db:roles`: each forward dump and each rollback dump is identical to the first one. | Journal `when` set to 0385's: killed (5 tests, including main-upgrade). Rollback deleting 0385's row: killed. |
| F2 | Yes. Each `accountsNotRead` entry adds to `mismatches`, `complete` is false, and the alert fires. | None. | Not counted: killed (2). |
| F3 | Yes. A CHECK violation or registry refusal rolls back, and the row is recorded parked `unrecognised` in its own transaction with no documents. Other errors still throw. The cursor moves past the item. A failing key is caught per key, so other keys still run. The job writes the report, then throws `accounting_stripe_accounts_failed:<n>`. | None. | Ledger rethrows: killed (integration, with `@auction/persistence` rebuilt, because the worker resolves it from its build). Per-key catch removed: killed (2). Job does not fail: killed. |
| F4 | Yes. `knownUnbooked` adds back exactly what this job booked and what the payments flow books. A booked charge, fee or payout nets to zero. A seller transfer is shown and not alerted. | None. See the negative case below. | Not subtracted: killed. Charges not left out: killed. Booked payout not added back: killed (both integration, rebuilt). |
| F5 | Yes. A replay that returns a cancelled document rolls back and is recorded parked `was_cancelled`, and the document stays cancelled. | None. | Check disabled: killed (rebuilt). |
| F6 | Yes. The claim orders `kind in ('expense','transfer')` last, then by age. The sync stops reading new windows once 200 are booked. | None in the touched code. See L3 and L4. | Priority removed: killed. Cap removed: killed. |
| F8 | Yes. A reference over 100 characters is refused, never cut, and 77 characters fit. | None. | Limit 76: killed. Guard removed: killed. |
| F9 | Yes. `prosecdef`, exact `proconfig`, the `uuid` return type and the returned value are pinned. The `worker_app` contract pins that PUBLIC cannot execute it. | None. | Not definer (M21): killed. No `search_path` (M16): killed. `EXECUTE` granted to PUBLIC on the live database: contract killed. Passes again once revoked. |
| F12 | Yes. `differencePence` and the count are both net of documents not yet issued. | None. See L2. | Pence not netted: killed. Count not netted: killed. |

**F4 negative case (checked with scratch tests that are not on any branch):**

- A seller transfer of −80.00 known, plus a booked payout of 40.00 whose transfer never reached
  Books, gives `unexplainedPence` −4,000 and the alert.
- A seller transfer known, plus Books holding a fee 5p short, gives −5 and the alert.
- Against the real store, a booked payout and a booked charge fee leave `knownUnbooked` unchanged,
  even after the payout's transfer document is cancelled. So a missed payout stays a clearing
  difference, and it is also a `byType` transfer difference.
- The PR's own tests cover the parts: the penny test, and the integration test that a charge and a
  payout are not counted. No single test combines a known transfer with a missed payout. Adding
  the first scratch test above to `stripe-reconciliation.service.test.ts` is a follow-up (L1).
- One gap: a ledger row whose `booked_fee_pence` differs from Stripe's `fee_pence` (only possible
  through a bug in the policy) is absorbed. It shows as a `charge` residue in `knownUnbooked` and
  does not raise the alert (L1).

### M1 (Medium, blocks): the persistence accounting integration files fail when they run in parallel

**What happens.** `accounting-credit-notes.integration.test.ts` (from #1375, on main) and
`accounting-persistence.integration.test.ts` (which this PR extends) both:

- rewrite the shared `accounting_source_setting` modes, and
- cancel or claim from the shared `accounting_document` queue.

Run at the same time, they undo each other. Both D4b cases fail, along with the dry-run-to-test_org
reference case and three to four credit-note cases. This happened in 4 of 4 runs with 2 or 4 workers
over `repositories/accounting` and `lib`.

**Does CI run them in parallel?** Yes.

- The `test` job runs `turbo run test --affected --concurrency=1`. That serialises packages, not
  files.
- `@auction/persistence` runs plain `vitest run`.
- `packages/persistence/vitest.config.ts` sets no `fileParallelism`, `pool`, `poolOptions` or
  `sequence` option.
- `DATABASE_URL` is set, so both files run (only the `worker_app` and `api_app` cases skip).

So the files run in parallel workers. They passed in CI for #1375 (`aea57b45`) and for this head
only because, among 159 files on a runner's few workers, they did not overlap. Any change to
timing or file order can make them overlap, and then they fail every time. That makes CI flaky for
every PR that touches persistence. This is on main already, but this PR extends one of the two
files and depends on a green persistence run.

**Fix (verified locally).** Give both files the same advisory lock the worker's accounting
integration files use: `holdAccountingTablesLock`, which runs `pg_advisory_lock(hashtext(...))` on
a dedicated connection for the whole file.

- Copy `apps/worker/src/testing/accounting-tables-lock.ts` into persistence, or move it to a shared
  testing module.
- Call `holdAccountingTablesLock({ beforeAll, afterAll })` at the top of both files.
- Use the same lock name as the worker's files. Turbo serialises packages today, so this is
  defence in depth.

With that change, the parallel run passed 207 of 207 three times in a row.

An alternative is to put the two files in one non-parallel group in `packages/persistence/vitest.config.ts`.

### Follow-ups (not blocking)

- **L1 (F4).** Add a test that combines a known seller transfer with a payout missing from Books,
  and asserts the alert. Restrict `knownUnbooked` to the types it documents (transfer, refund,
  dispute and adjustment types), or leave out `charge`, `payment`, `payout` and the fee types.
  Then a residue on a type this job or the payments flow books stays unexplained, and a policy bug
  cannot hide inside "known". Today the CHECK only requires `booked_fee_pence` to be ≥ 0, not equal
  to the fee.
- **L2 (F12).** "Not issued" includes `needs_review` and `failed`, so a fee or payout document Books
  refuses for good is shown as on its way, both by type and in clearing, and never counted as a
  reconciliation mismatch. `accounting_needs_person_overdue` still covers it. Consider netting only
  `pending`, `sending` and `unknown`.
- **L3 (F6).** The cap is shared across keys in one run. If the first key books 200, the second key
  is not read that run. It is then reported `not_read_through` (an alert, and caught up next run),
  but sustained volume on one account would starve the other. Consider a cap per account. The cap is
  also checked only at a window's edge, so one busy day can go past 200.
- **L4 (F6).** The claim now sorts on an expression ahead of `created_at`, so the partial index on
  `(created_at, id) WHERE state IN ('pending','sending')` no longer gives the order directly. This
  is fine at today's queue sizes. Check `EXPLAIN` if the queue grows.
- **L5 (F3).** The fallback row reuses Stripe's `id`, `type` and `currency`. If one of those is what
  breaks a CHECK (the id, type and currency patterns), the parked insert fails too and that key
  stalls. The job then fails visibly and the account is reported not read, so nothing is silent,
  but the cursor does not move on. Stripe's current shapes fit.
- The earlier follow-ups (F7, F10, F11, the second half of F12, the F5 real-cycle test, the F6
  volumes, and refunds in the clearing figure after #1375) stand as written above.
