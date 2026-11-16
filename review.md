Verdict: FIX FIRST

# Recheck of PR #1482 after the fixes (demo seed: an item in every staff queue)

Rechecked head `5030299b`. It has not changed since 01:58 UTC. Base is `main` `a54b584f`; the branch is 3 commits behind current `main` and merges cleanly. This file replaces the first review (which was of `0b9d9a81`).

The fixes for findings 1 to 13 hold up locally. One blocking problem is new: the database guard makes a required CI gate fail (finding 1 below).

## What I ran

- `corepack enable`, `pnpm install --frozen-lockfile`, `pnpm -r --filter './packages/**' build`: passed.
- Local Postgres 16, `db:migrate` (0398 applied), `db:roles`, `db:seed:dev`.
- `db:seed:demo-full` on the unmarked database was refused before writing anything: `[demo-full] refusing to seed: this database is not marked as a demo seed target ...`.
- I marked the database (`'local'`) and ran `db:seed:demo-full` twice. I snapshotted every seeded row (ids `df9…`), all sales' venue and status, and the demo-seed events. The two snapshots were identical.
- Second database, staff work, then a re-run. Changes made:
  - booking cancelled, and its lot row set inactive;
  - lot 1 handed over (`delivered`, `collected_by`);
  - lot 2 released;
  - dispute won;
  - purchase problem resolved;
  - export failed;
  - submission under review;
  - deal cancelled;
  - venue renamed and one opening-hours row deleted;
  - the seed sale's venue cleared, and `venue_id` cleared on every other sale;
  - a `payment.unapplied_money_resolved` event added.

  After `db:seed:demo-full` ran again, every snapshot row was byte-identical. Nothing moved back and nothing new was written.
- Shop: `seed:catalogue`, then `seed:demo-full` twice as `shop_app`. Both runs reported `{"paidOrders":4,"ordersToFulfil":4,"failedRefunds":1,"openDisputes":1}`.
  - Refund: `failed`, `submit_attempts=1`, `last_error='Order missing stripe_payment_intent_id'`, 9,000p, which is a quarter of the 36,000p order.
  - The refund also has a `shop_admin_audit` `request_refund` row and a `shop.refund.requested` event.
  - Dispute: `opened`, with a `shop_processed_payment_event` claim and `shop.dispute.opened`.
  - I settled the refund (`succeeded`) and won the dispute, then re-ran. Refunds, disputes, order statuses, shop events and the audit count were all unchanged.
- Queue claims were checked by calling the real readers against the seeded database (script, read-only). All of them return the seeded item:
  - `DrizzlePurchaseProblemDeskRepository.list` (open);
  - work inbox `listPurchaseProblems`, `listUnappliedMoney`, `listLotFulfilment`, `listSubmissionReviews`;
  - `DrizzleAdminDisputeDeskReader.listPage` (`needs_allocation`, 2 invoices);
  - `DrizzleDataRequestReader.list` (open; delayed; due 23 Nov);
  - `DrizzleCollectionBookingRepository.listInRange` at "LAX Demo Collection Point" (slot 19 Nov 10:00Z, `booked`);
  - `DrizzleLotFulfilmentRepository.listForAdmin` (lot 1 `ready_for_collection`, lots 2 and 3 `awaiting_release`);
  - `DrizzleItemSubmissionRepository.listForAdmin`;
  - `DrizzlePrivateSaleDealQueryRepository.list` (active, `offer`).
  - On the real `DrizzleCollectionLotFactsReader` facts, `collectionEligibility` returns eligible for lot 1 once its own booking is set aside.
  - The stored `request_fingerprint` equals the persistence `collectionRequestFingerprint` for the same request.
- Tests, `--maxWorkers=2`:
  - `@auction/db`: `src/seed`, `src/migration-0398*`, `migrate-roles.test.ts`, `shop-app-role.contract.test.ts` and `api-app-role.contract.test.ts`. Result: 18 files, 220 passed, 4 skipped, 2 failed. The 2 failures were `api_app` contract tests that failed only because `DATABASE_URL_OWNER` was not set in my shell. Re-run with it set, that file passed 26/26.
  - `@auction/shop-api` `src/infrastructure/seed` and `handlers/webhooks`, with the CI layout of URLs (all on one migrated database): 13 files, 44 tests passed.
  - `@auction/worker` `src/projectors`: 36 files, 199 passed.
  - `@auction/domain`: 3,865 passed.
  - `@auction/persistence` `collection-request`: 16 passed.
- `tsc --noEmit` for domain, db, persistence, shop-api, worker and api: clean.
- `biome check` on the five changed packages: clean.
- `lint:deps`, `lint:layers`, `lint:datetime`: pass.
- CI check-runs on `5030299b` (REST): 38 success, 1 skipped (`art-browser-gates`), 1 **failure** (`account-browser-gates`). `ci-result` is success.
- Commit messages (5 commits) and PR body: no Co-Authored-By, Claude-Session or generated-by lines. All commits are by `mahmoudamrspace`.

## Findings

1. **BLOCKING: `account-browser-gates` fails because CI's database is not marked.**
   - Where: `.github/workflows/account-e2e-pr.yml:151` runs `pnpm --filter @auction/db db:seed:demo-full` right after `db:migrate`, on a fresh `auction_ci` database.
   - With this PR, `runDemoFull` now calls `assertDemoSeedDatabase` first (`packages/db/src/seed/demo/demo-full-seed.ts:52`). Nothing in the workflow inserts a `demo_seed_target` row, so the seed is refused.
   - The job failed in the "Migrate and seed" step, after about 2 minutes. No process logs were uploaded, so the stack never started. The same job passes on other PRs and on the merge queue at the same time.
   - I reproduced the same refusal locally on an unmarked, freshly migrated database.
   - Fix: in that step, after `db:migrate`, mark the CI database as the owner:
     ```sh
     psql "$DATABASE_URL" -c "insert into demo_seed_target (environment, database_name, marked_by) values ('local', current_database(), 'ci') on conflict do nothing"
     ```
     The same can be done with a small `db:seed:mark-demo-target` script. Also look for any other runner that calls `db:seed:demo-full`; I found none besides `worker-task-test.yml`, which the runbook covers.

2. **The insert-once design leaves the clock-bound items to go stale on test (non-blocking; say it in the runbook or refresh them safely).**
   - Where:
     - booking slot: `packages/db/src/seed/demo/queues/collection.seeder.ts:56`, first offered slot about 3 days out;
     - offer expiry: `private-sale.seeder.ts:95`, now + 5 days;
     - export: `data-request.seeder.ts:199`, requested 24 days ago, due one month later.
   - Every later run sees the fixed id and writes nothing. The test site gets these items only on the first run. After about 3 days the visit is no longer under "Upcoming", after 5 the offer has lapsed, and after about a week the export is overdue.
   - The runbook says the seed "is safe to run again". It does not say that re-running will not refill these.
   - Options:
     - insert a new booking keyed by date when the seeded one is no longer `booked` in the future, which the first review suggested;
     - or state in `docs/runbooks/demo-seed.md` and the PR table that these three are shown only for a few days after the first run.

3. **The PR text claims "A deleted ... item is never brought back"; that is not true (non-blocking, text).**
   - I deleted the seeded `purchase_problem` and re-ran. It came back as `open`, with a second `purchase_problem.reported` event.
   - Each seeder keys `onConflictDoNothing` on the fixed id, so a row that is gone is written again (for example `purchase-problem.seeder.ts:269-286`).
   - Staff cannot delete these rows in the app, so this is only wording. Change it to "a worked item is never changed".

4. **A doc comment was displaced in `migrate-roles.ts` (minor).**
   - Where: `packages/db/src/migrate-roles.ts:632-638`.
   - The new `SHOP_DEMO_SEED_TARGET_READ_TABLES` and its one-line JSDoc were inserted between the existing "Download my data for LAX Shop reads ..." JSDoc and `SHOP_SUBJECT_EXPORT_READ_TABLES`. That comment now sits on nothing, and hovers lose it.
   - Fix: move the new constant above the old comment.

5. **The Shop dispute names a payment intent its order does not have (minor, realism).**
   - Where: `apps/shop-api/src/infrastructure/seed/demo-staff-queues-seed.ts:81`. The dispute is recorded with `paymentIntentId: "pi_demo_example_shop_0001"`, but the demo orders have `stripe_payment_intent_id` null.
   - The webhook path could never have matched this order. Anything that later joins on the dispute's intent would not find the order.
   - The dispute screen reads it by `order_id`, so it shows correctly. Consider leaving the intent out or noting it in the docstring.

6. **Shop seed events carry producer `shop-api`, not `demo-seed` (note).**
   - `shop.refund.requested` and `shop.dispute.opened` come from the real handlers with the Shop producer.
   - No worker projector or fan-out consumes either today (grep of `apps/worker` and `packages`), so nobody is emailed.
   - If a consumer is added later, it will not see the demo mark. A one-line comment in `demo-staff-queues-seed.ts` would help.
   - If staff press Retry on the failed refund, the scheduler fails it again and reports to Sentry and the ops inbox (`submit-pending-refunds.runner.ts`). The PR body states this; it happens only after a deliberate staff action.

## Findings of the first review, rechecked

- 1, 2, 11, 13 (re-run undoes staff work; tests). **Fixed.** The full staff-work re-run above changed nothing, including other sales' venues. The integration tests now work the items between runs.
- 3 (Shop refund). **Fixed.**
  - The refund goes through `createRequestRefundHandler`, with the balance check, audit row and event.
  - It is set to the scheduler's terminal `failed` state in the same transaction, guarded on `status='pending' and submit_attempts=0`.
  - The scheduler selects only `pending` (`submit-pending-refunds.runner.ts:66-75`), so nothing is submitted and no Sentry or ops alert is raised.
  - It shows under "Failed refunds".
- 4 (claimed queues). **Fixed.** The storage and quarantine claims were removed. Every remaining claim is confirmed with the real readers (see above).
- 5 (erasure hold). **Fixed** by removal. No `DR-DEMO` hold is written, so there is no dead link.
- 6 (collection booking). **Fixed.** Default weekly hours are added, the slot is the first one `collectionSlots` offers, lot 1 is released (`ready_for_collection`), and the fingerprint matches the repository's.
- 7 (dispute). **Fixed.**
  - There are two candidate payments on one "Pay several" charge. `planAutomaticDisputeAllocation` (`packages/domain/src/dispute-case.ts:92-106`) returns null for more than one candidate, so `needs_allocation` is what the recorder would produce.
  - The candidate payments carry the case's `stripe_charge_id`.
  - The claim uses source `stripe_payment_webhook`.
  - The `dispute_case.needs_allocation` payload matches `announceNeedsAllocation` field for field.
- 8 (events and history). **Fixed.**
  - Purchase problem: event written.
  - Deal: party and stage history, plus the created, converted, party named, terms and stage events. These match `enquiry-conversion.service.ts`.
  - Export: audit rows written, `deadline_alert_tier=3`. `claimDeadlineAlerts` takes `< 3` only, so no further alerts are sent.
  - Consignment: category and image, and it passes `evaluateSubmissionQuality`.
  - Shop dispute and refund: written through the real handlers.
- 9 (unapplied money and notifications). **Fixed.**
  - Built with `unappliedMoneyPayload` and `unappliedMoneyAggregate`: key `customer_balance_unapplied:evt_demo_example_unapplied_0001:gbp`, no actor.
  - Fan-out and collection-booking notices skip `producer='demo-seed'` and advance their cursor. Unit tests cover both.
  - Notifications are not disabled anywhere else.
  - No other worker projector consumes the seeded Bid event types (checked the Zoho, accounting and public-cache projectors).
- 10 (production guard). **Fixed.**
  - Migration 0398 adds `demo_seed_target`: one row at most, environment `test` or `local`, and the row names the database it was written in.
  - Rollback is included. `api_app` is denied; `shop_app` gets SELECT only.
  - Refusal tests passed: unmarked database, mark copied from another database, unknown environment, IP-address host, table missing.
  - I confirmed the refusal live as well.
  - It is the cause of finding 1 above.
- 12 (fictional data). **Fixed.**
  - Postcode `ZZ99 9ZZ`.
  - New addresses are all `example.test` / `example.com`.
  - Stripe-style ids are all `*_demo_example_*`.
  - No card, bank or secret values.
  - The demo people (`*@lax.bid`, "Charlotte Hayes", "Northbank Gallery") come from the existing top-up seed and are not new here.

## What is fine

- No demo sale owned by other code is modified. Collection uses the seed's own sale `df950000-…` and venue.
- Migration number 0398 follows `main`'s last journal entry (0397). The branch merges cleanly with current `main`.
