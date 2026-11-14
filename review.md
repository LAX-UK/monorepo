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
