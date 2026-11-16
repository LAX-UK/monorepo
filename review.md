Verdict: FIX FIRST

Independent review of draft PR #1511, "Seed dispatched and returned Shop orders and a reserved lax.art original in the demo" (head `674f1cdc`, branch `claude/gap-31-demo-seed`, base `main` @ `ac9058a7`). Register item: GAP-31.

## What I checked and ran

- I read the full diff: `demo-shop-states-seed.ts` (new), its unit and integration tests, `seed-demo-full.ts` (+3 lines) and `docs/runbooks/demo-seed.md`. I also read the handlers it calls (update-fulfilment, record-possession, cancel-after-possession, advance-return, the original sale writer) and the existing Shop seeds (`edition-orders-seed.ts`, `demo-staff-queues-seed.ts`, `demo-full-seed.ts`).
- On a local Postgres 16 with all migrations and `db:roles` applied, `vitest run src/infrastructure/seed/demo-shop-states-seed*` passes: 2 files, 7 tests.
- On a fresh migrated database, I ran the real script twice in production order: marked the database, ran `seed:catalogue`, then `pnpm --filter @auction/shop-api seed:demo-full` ×2. Both runs printed `{"dispatchedOrders":1,"returnedOrders":1,"reservedOriginals":1}`. Row counts were identical after run 1 and run 2: orders 4, returns 1, refunds 2, original sales 1, parties 12, domain_events 73, admin audit 25, email_outbox 0. **The re-run is idempotent.**
- The resulting rows:
  - `harbour-at-dusk-artists-proof` is in transit (Demo Carrier / `DEMO-TRACK-0001`).
  - `shoreline-estate` is delivered. Its return is `received / back_on_sale` and the print is `authorised` again.
  - The cancellation refund is `failed` with "Order missing stripe_payment_intent_id". No refund is left `pending` for the scheduler, and no `stripe_payment_intent_id` was invented.
  - `quiet-orchard` has a `reserved` original sale for "Demo Original Buyer". The artwork's `sale_state` is still `for_sale`.
- No email is queued. The seed buyer `seed:edition-buyer` has no profile email, so the dispatch and cancellation-confirmed notices resolve to no address and are dropped.
- Mutation check: I made the refund-failure update match nothing. The integration test then fails (`expected 'pending' to be 'failed'`). The tests are not vacuous, and they fail without the change (the new module is what they import).
- Requested states:
  - **Purchase problem, unapplied money, data request:** already seeded on `main` by `packages/db/src/seed/demo/queues/{purchase-problem,unapplied-money,data-request}.seeder.ts`, called from `db:seed:demo-full`. They are listed in the runbook table (lines 61, 62, 64). They were not skipped and this PR does not need to add them. The PR description says so correctly.
  - **Shop dispatched:** seeded.
  - **Shop returned:** seeded (received, not in transit; this is documented).
  - **Reserved lax.art original:** seeded in LAX Admin only (see finding 3).
- Real personal data: none. The buyer and carrier names are invented, the storefront URL is `shop.example.test` and the subjects are `seed:`-prefixed.
- Guard: `seedDemoShopStates` calls `assertDemoSeedDatabase` itself, and the script still runs `assertDemoSeedTarget` and the mark check first. This is the same as the existing seeds. The integration test proves an unmarked database is refused with no writes.

## Findings

1. **The packing confirmation is a raw write, and the stated reason for it is wrong.** `apps/shop-api/src/infrastructure/seed/demo-shop-states-seed.ts:115-119` sets `shop_order_line.pack_confirmed_at/by` directly. That skips everything the real step does in `apps/shop-api/src/application/print-fulfilment/confirm-print.service.ts:194-234`:
   - the `pack_confirmed` print-history event
   - the `shop.print.pack_confirmed` domain event
   - the `confirm_print` audit row
   - the certificate the run's facts call for

   The result is a dispatched and a returned numbered print with no print history, and possibly no certificate. A real order cannot reach that state. The PR (description, file header lines 6-7, runbook line 86) says this is needed "because the packing screen needs a label printer". It does not: `AdminConfirmPrintBody` accepts `{ source: "typed_label", value }` (`packages/shop-contracts/src/print-fulfilment-admin.ts:61-68`), which is the "type what is written on the print" path.

   **Fix:** build `createConfirmPrintService({ uow: createDrizzlePrintFulfilmentUnitOfWork(createDrizzleShopUnitOfWork(db, "enforce")), certificateSettings: { laxCertificatesEnabled: () => false }, clock })` as `container.ts:538-541` does. For each order line, read the expected label, then call `confirm({ orderLineId, scanned: { source: "typed_label", value: label }, actorSubjectId: DEMO_STATES_ACTOR, idempotencyKey: \`${KEY}:${label}:pack:${lineId}\` })`. Use `readRunContext` + `labelOfPrint`, or `getPickAndPack`, to get the expected label. Then remove the "label printer" wording from the header, the PR body and the runbook's "what the demo cannot show" list, which leaves no write outside a domain service.

2. **A later seed run undoes staff work on the reserved original.** The PR invites staff to take "Quiet Orchard" further: the runbook says to use Stripe test mode for a paid or invoiced original. Once staff complete that sale, the writer sets `shop_artwork.sale_state = 'sold'`. The next `seed:demo-full` run calls `seedDemoFull` first. That function unconditionally sets `quiet-orchard` back to `for_sale` at £1,450 (`apps/shop-api/src/infrastructure/seed/demo-full-seed.ts:28-29` and `87-96`). lax.art would then offer a sold original for sale, and the `assigned` sale would no longer match its artwork. This breaks the "never touch / never undo staff work" rule the PR claims (runbook, run section). The `ORIGINAL_STATES` reset was there before, but this PR is what puts a sale on one of those fixed-state artworks.

   **Fix, either of:**
   - (a) in `seedDemoFull`'s `ORIGINAL_STATES` loop, add `and not exists (select 1 from shop_original_sale s where s.artwork_id = shop_artwork.id and s.status <> 'cancelled')`; or
   - (b) reserve an original that is not in `ORIGINAL_STATES`.

   Add an integration case: seed, mark the seeded sale `assigned` and the artwork `sold`, run `seedDemoFull` + `seedDemoShopStates`, then assert the artwork is still `sold`.

3. **The reserved original does not look reserved on lax.art, and the doc does not say so.**
   - `createReservation` (`apps/shop-api/src/infrastructure/phase/drizzle-original-sale.writer.ts:179-212`) only inserts `shop_original_sale`.
   - `shop_sale_state` has no reserved value (`packages/db/src/schema/shop-commerce.ts:32-36`).
   - `apps/art` has no reserved display.

   So lax.art shows Quiet Orchard as "for sale, £1,450". This is the same as a reservation made by staff, so the seed is not wrong. But the GAP-31 aim of showing "one reserved lax.art original" can only be seen in LAX Admin (Original sales list, `drizzle-admin-work-lists.reader.ts:522-557`).

   **Fix:** at `docs/runbooks/demo-seed.md:74`, or in the "What the demo cannot show" list, add: "lax.art has no reserved state; the original still shows as for sale there. The reservation is visible in LAX Admin only." If product expects a public "Reserved" label, open a separate item. The seed cannot provide it.

4. **A run that fails part-way stalls for good, and later runs do not show it.**
   - `dispatchOrder` returns unless the fulfilment is still `pending_production` (`demo-shop-states-seed.ts:101`). If a run dies after `in_production` or `awaiting_dispatch`, every later run skips that order.
   - `returnOrder` returns as soon as any return exists (`:133-145`). If the cancel transaction commits but `advance(in_transit|received)` (`:192-207`) throws, the return stays `requested` forever.

   The counts then print 0, but the script exits 0. Each handler is already replay-safe because of its fixed idempotency key.

   **Fix:** let each step resume. Continue `dispatchOrder` from `in_production`/`awaiting_dispatch` (only when the last fulfilment actor is `DEMO_STATES_ACTOR`, so staff moves stay untouched). In `returnOrder`, when the existing return was created by the seed's cancel (its refund key is `cancellation:seed:demo-shop-states:returned:cancel`) and is `requested`/`in_transit`, run the remaining `advance` calls.

5. **The seed silently does nothing when its preconditions are missing.**
   - With fewer than four paid seed orders, `assignStateOrders` (`:62-68`, `:83-89`) skips the dispatched and returned states.
   - If `quiet-orchard` is missing, sold or on another channel, `reserveOriginal` (`:223`) returns.

   In each case the script still prints counts and exits 0. GAP-31 asked for nothing to be skipped silently.

   **Fix:** in `seed-demo-full.ts`, after `seedDemoShopStates`, `console.warn` a line naming each state whose count is 0, with the reason (not enough paid demo orders / original not available). Alternatively, return a `skipped: string[]` from `seedDemoShopStates` and print it.

6. **Orders are chosen by position, not by key.** `assignStateOrders` takes indices 2 and 3 of the paid seed orders sorted by idempotency key (`:73-83`). Which order gets which state depends on `NUMBERED_RUN_SLUGS` in `edition-orders-seed.ts:10-15` and on which orders are still `paid`/`partially_refunded`. Today, if staff fully refund the queues seed's order, everything shifts by one. That is harmless now: the shifted order is already moved, so it is skipped. But one more numbered slug would silently point the seed at a different order on an existing database, and the runbook's claim that it is "a different order from the refund, dispute and return" would no longer be guaranteed.

   **Fix:** name the two orders by key, e.g. `DISPATCHED_ORDER_KEY = "seed:edition-order:harbour-at-dusk-artists-proof"` and `RETURNED_ORDER_KEY = "seed:edition-order:shoreline-estate"`, and select with `eq(shopOrder.idempotencyKey, …)`. Keep the unit test as an exclusivity check against `assignOrders`.

7. **Some runbook statements are now out of date.**
   - `docs/runbooks/demo-seed.md:69` says "To fulfil" holds "The paid demo print orders". After this PR only two of the four are there.
   - `:70` says "Failed refunds" holds a goodwill part refund. It now also holds the cancellation refund (£280.00 on the seeded data).
   - `:89` says "Events the seeds write carry the producer `demo-seed`". The Shop seed's events, including the new `shop.fulfilment.dispatched`, `shop.fulfilment.status_changed`, `shop.possession.recorded`, `shop.cancellation.requested`, `shop.edition.released` and `shop.original_sale.reserved`, all carry `shop-api`. The file header at `demo-shop-states-seed.ts:19-20` admits this. The worker's Zoho fulfilment mirror subscribes to several of them (`apps/worker/src/integrations/zoho/fulfilment/fulfilment-triggers.ts:17-28`). The existing Shop seed's `shop.order.paid` events already reach it, so this is not new risk, but the doc should not say otherwise.

   **Fix:**
   - Reword `:69` to "The paid demo print orders not dispatched".
   - Add "and the cancellation refund of the returned order" to `:70`.
   - Scope `:89` to the Bid seeds and add: "The Shop seed runs real Shop handlers, so its events carry `shop-api`; no email is sent because the seed buyers have no email address."

8. **Minor code nits.**
   - The file header (`:49`) calls the buyer "an example.test person", but the party has no email at all. Say "an invented person with no contact details".
   - `seed-demo-full.ts` logs `states` before `queues` although queues run first. Print them in run order.

## Conflict with PR #1514 (`fix/gap28-seed-and-env-guards`)

I did a trial merge of #1514 into this branch (`git merge --no-commit origin/fix/gap28-seed-and-env-guards`):

- `apps/shop-api/src/scripts/seed-demo-full.ts` merges cleanly. The result keeps #1514's `seedTargetEnvFromProcess` / `assertSeedTarget` guard and this PR's import and `seedDemoShopStates` call. It is also correct in meaning: `assertDemoSeedDatabase` is still exported and used by `assertSeedTarget`, so the inner guard in `seedDemoShopStates` still works. On a local database, #1514 first marks it `local` and then the inner check passes.
- `docs/runbooks/demo-seed.md` **conflicts** at lines 18-20 (the "which seeds check the mark" paragraph).

**Resolution:** take #1514's paragraph (the full list of guarded seeds plus the "Seeded passwords and staff two-factor" subsection). Change its `the Shop \`seed:demo-full\`` item to `the Shop \`seed:demo-full\` (which also fills the Shop staff queues and the dispatched, returned and reserved states)`. Keep this PR's table rows, the "What the demo cannot show" section and the "Run it" section unchanged. Whichever PR merges second should rebase onto `main`. In #1511's case, re-run `vitest run src/infrastructure/seed` afterwards: on a local, unmarked database, #1514's `assertSeedTarget` changes the guard behaviour of the new integration test's "refuses a database without the demo seed mark" case only if that test goes through the script, and it does not, so it should still pass.

## Bottom line

The states are really seeded through the real handlers, the re-run is idempotent, nothing invents provider ids or real people, and the admin-queue items were already on `main`. Fix finding 1 (the raw packing write is avoidable and leaves print history and the certificate missing) and finding 2 (a re-run resets a sold original to for sale) before merging. Findings 3-7 are small changes to code and docs that should go in the same pass.
