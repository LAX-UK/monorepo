Verdict: FIX FIRST

# Review of PR #1482: an item in every staff queue on test (GAP-31)

Reviewed head `0b9d9a81` against `main` `a54b584f`.

## What I ran

- `pnpm install --frozen-lockfile` and `pnpm -r --filter './packages/**' build`: passed.
- Local Postgres 16: `db:migrate`, `db:roles`, `db:seed:dev`. Then `db:seed:demo-full` twice and Shop `seed:demo-full` twice.
  - Both re-runs completed.
  - Table counts did not change on the second run.
  - Shop reported `{"paidOrders":4,"ordersToFulfil":4,"pendingRefunds":1,"openDisputes":1}` on both runs.
- Tests:
  - `@auction/db` `vitest run src/seed --maxWorkers=2`, with `MIGRATION_TEST_DATABASE_URL` set: 13 files, 109 tests passed. The new integration test actually ran.
  - `@auction/shop-api` `vitest run src/infrastructure/seed --maxWorkers=2`: 10 files, 24 tests passed.
- `tsc --noEmit` for `@auction/db` and `@auction/shop-api`: clean.
- Biome (`lint` for both packages): clean.
- `lint:deps`, `lint:layers`, `lint:datetime`: clean.
- CI check-runs on the head (REST API): 38 success, 1 skipped, `browser-gates` still in progress.
- Commit message and PR body: no Co-Authored-By, Claude-Session or generated-by lines.
- No migrations in the diff.
- Simulated staff work on the seeded rows, then ran the seed again:
  - lot 28 fulfilment marked collected;
  - booking cancelled;
  - dispute set to won;
  - deal cancelled;
  - sale 4's venue cleared.

## Findings

1. **BLOCKING: re-running the seed undoes staff work on the collection fulfilment row and leaves it contradicting itself.**
   - Where: `packages/db/src/seed/demo/queues/collection.seeder.ts:96-99`. It upserts `lot_fulfilment` on `lot_id` and sets every field.
   - Reproduced: after a staff-style hand-over (`status='delivered'`, `collected_at` and `collected_by` set), the next run set `status` back to `ready_for_collection` and left `collected_at` / `collected_by='Real Staff'` in place.
   - The row is matched on `lot_id`, not on an id the seed owns. A fulfilment row that the app or a person created for lot 28 (for example a shipping release) would be overwritten too, including its method.
   - Fix: insert with a fixed id and `onConflictDoNothing`. Refresh only `payment_cleared_at` / `release_approved_at`, and only while the row is still the seed's own and still `ready_for_collection` (`where` on id and status).

2. **BLOCKING: re-running the seed brings a cancelled or completed booking back to `booked`, producing an invalid state.**
   - Where: `collection.seeder.ts:125-127` (`set: { ..., status: "booked" }`).
   - Reproduced: a booking cancelled by staff became `booked` again with `cancelled_at` still set.
   - The same rewrite would turn `collected`, `partly_collected` or `not_collected` back to `booked`.
   - Moving `slot_start` while forcing `booked` can also hit `collection_booking_seat_live_uidx` (venue, slot_start, seat 1). That fails the whole demo-full transaction if another live booking at the demo venue holds that seat.
   - Fix: only move the slot `where status = 'booked'`. Never write `status` on conflict. If the demo booking is no longer live, insert a new one with a new id (for example keyed by date).

3. **BLOCKING: the Shop "pending refund" cannot stay pending, and on test it will raise a Sentry error and an ops alert.**
   - Where: `apps/shop-api/src/infrastructure/seed/demo-staff-queues-seed.ts:52-61`.
   - The seeded order has no `stripe_payment_intent_id`; checked locally: order `paid`, intent null.
   - `submit-pending-refunds.runner.ts:66-75` picks up any `pending` refund with no `stripe_refund_id`. On the first scheduler run it treats a missing intent as terminal (`:176-202`): it sets the refund to `failed`, calls `Sentry.captureMessage("shop_refund_submit_terminal_failure")`, and queues the ops alert email.
   - On the real test environment the orders may carry intents from the seeded checkout. In that case the runner would ask Stripe to refund them.
   - No staff list filters on pending refunds anyway. `drizzle-admin-read.repository.ts:76-79` only filters `refund === "failed"`, so the "Refunds" row in the PR table is not met as described.
   - The raw insert also skips what `request-refund.handler.ts` does:
     - the remaining-balance check: the seed always refunds `totalPence`, even on a `partially_refunded` order, which can exceed the refundable amount;
     - the `shop_admin_audit` `request_refund` row;
     - the `shop.refund.requested` event.
   - Fix: create the refund through the request-refund handler, in a state the scheduler will not submit. Otherwise drop the refund item and say which screen shows refunds.

4. **BLOCKING (accuracy of the PR claims): three listed queues or screens do not show the item.**
   - **Storage:** no staff screen reads `collection_storage_terms` or storage overdue. `DrizzleCollectionStorageRepository` is not wired to any API route. Lot 28 shows only in the lot-fulfilment work list.
   - **Quarantined replies:** no route or page lists `enquiry_inbound_quarantine`. The only staff-visible trace in the real path is the `marketing_enquiry.inbound_quarantined` domain event (`enquiry-inbound-reply.service.ts:234-251`), and the seed does not write it (`quarantined-reply.seeder.ts:13`).
   - **Shop pending refund:** see 3.
   - Either fill these the way the screens read them, or remove them from the PR table and the `QUEUE_SEEDERS` names so the log line "staff queues filled" is not misleading.

5. **Erasure hold opens a "not found" page.**
   - Where: `packages/db/src/seed/demo/queues/data-request.seeder.ts:10,51`.
   - `DR-DEMO-0001` has no matching `subject_data_request`. The attention card links to it, and `findRecord` returns null. Re-run and erase actions call `identity.record` first, so they fail too.
   - A real hold exists only for a real manual erasure request. Create the request too, or drop the hold.
   - Also, when staff clear the hold the row is deleted, so every re-run brings it back.

6. **Collection booking is valid only by accident of filters.**
   - The demo venue has no `collection_weekly_hours`, so the 10:00 slot falls outside any opening hours.
   - Lot 25 has no `lot_fulfilment` row, so the desk shows the lot as not released and blocks hand-over.
   - `request_fingerprint` is a literal (`collection.seeder.ts:123`), not `collectionRequestFingerprint(...)`.
   - The desk opens on the first venue by name and on today's tab, so staff have to pick the demo venue and the Upcoming tab to see it.
   - Add opening hours and a released fulfilment row for lot 25, or say this in the PR.

7. **Dispute case is in a state the real recorder never produces.**
   - Where: `dispute.seeder.ts:20,27`.
   - The real recorder allocates automatically when there is exactly one candidate payment. "needs_allocation with one candidate" therefore can't happen for real.
   - `ch_demo_example_0001` also does not match the candidate payment, whose `stripe_charge_id` is null.
   - The `dispute_case.needs_allocation` event is not written.
   - Use two candidates, or go through the recorder.

8. **Raw inserts skip events, audit rows and history across the Bid seeders.** These are valid rows, but timelines will be empty and some side effects fire anyway.
   - **Purchase problem:** no `purchase_problem.reported` event.
   - **Private sale deal:** no `private_sale_deal_stage_history`, `party_history` or `stage_changed` events (`private-sale.seeder.ts:36-39`).
   - **Data export:**
     - no `subject_data_export_audit` row;
     - `deadline_alert_tier=0` with `requested_at` 24 days ago, so the worker's deadline alerts will email compliance staff;
     - an open `delayed` export may be picked up and finished by the export worker, which empties the queue.
   - **Consignment** (`consignment.seeder.ts:24`): no category and no images. The real submit requires both.
   - **Shop dispute:** no `shop.dispute.opened` event and no `shop_processed_payment_event` row.
   - The PR's "Design" section should say these are direct inserts. Alternatively, route the riskier ones (refund, dispute, deal) through the services.

9. **Unapplied-money event differs from what the recorder writes, and it emails finance staff on test.**
   - Where: `unapplied-money.seeder.ts:18,29,34`.
   - `aggregateType: "payment"` with no paymentId. `unappliedMoneyAggregate` gives `payment_group`, so the received and resolved events end up on different aggregates.
   - The dedupe key format is `demo:...`, not `customer_balance_unapplied:cbtxn_demo_example_0001`.
   - `actorUserId` is a finance user instead of null.
   - `notification-fanout.ts:223` will send the "payment-unapplied-money-admin-notice" email to every finance recipient on test. That may be intended, but the PR should say so.
   - Fix: use `unappliedMoneyAggregate` / `unappliedMoneyPayload`.

10. **Production guard: adequate for now, but it is a name heuristic, not a database identity check (non-blocking, existing code).**
    - `assertDemoFullTarget` (`packages/db/src/seed/runners/demo-full-cli.ts:19-27`) and `assertDemoSeedTarget` refuse `NODE_ENV`/`APP_ENV=production|prod` or a hostname containing "prod".
    - The production cluster is `lax-prod-postgres` (docs/runbooks/postgres-backup-restore.md), so its DigitalOcean hostnames contain "prod". The workflow also loads URLs only from the `ephemeral/test` Terraform outputs. So the seed cannot reach production through the shipped entry points.
    - It fails open for an IP address URL or a renamed cluster. The new exported functions (`seedStaffQueues`, `seedDemoStaffQueues`) have no guard of their own.
    - Recommend a follow-up: check identity inside the database (for example `current_database()` plus a marker row or setting that only test has) before writing. Also add a test with an IP-host URL.
    - The new test `queues.test.ts:68-79` only re-tests the existing guard; it does not prove that the new queue entry points refuse production.

11. **Seed changes demo sales it does not own in this PR (minor).**
    - `collection.seeder.ts:64` points sales 4 and 5 at the demo venue on every run. Reproduced: a cleared `venue_id` was set back.
    - Both are online-only sales (`atVenue: false`, no location), so they now have a venue but no location text.
    - Only update `where venue_id is null`, or say this in the PR.

12. **Fictional data: OK (minor note).**
    - All new addresses are `@example.com` / `@example.test`.
    - Stripe-style ids are `*_demo_example_*`.
    - No card, bank or secret values were found in the diff.
    - `EC1A 1AA` (`queue-ids.ts:38`) is a real London postcode, though widely used as an example. Consider a clearly fake one.

13. **Tests (minor).**
    - The integration tests skip without a database (`queues.integration.test.ts:15`), so CI only covers them if it provides one.
    - The idempotence test runs the seed twice on untouched rows. It never mutates rows between runs, so findings 1, 2 and 11 went unnoticed.
    - Add a test that changes the seeded rows (cancel the booking, hand over the lot, change the venue) and asserts that a re-run leaves them alone.

## What is fine

- Dispute and private sale deal upserts only refresh dates. Staff changes (won, cancelled) survived a re-run.
- Purchase problem, consignment, quarantine and Shop dispute use `onConflictDoNothing` with fixed keys.
- Unapplied money dedupes on the existing unique index (`domain_events_unapplied_money_dedupe_key_uid`).
- Money is in pence or minor units throughout, and amounts match the anchored payments (dispute £5,520 = payment 3).
- Paid lots are found from the top-up, and the seed fails loudly if the top-up is missing.
