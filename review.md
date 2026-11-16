Verdict: FIX FIRST

# Final recheck (round 3) of PR #1482 (demo seed: an item in every staff queue)

Rechecked head `05e7262f`. That is two new commits on top of `5030299b`, which the round 2 recheck covered. Base is `main` `a54b584f`. The branch is 4 commits behind current `main` and still merges cleanly. `main` has no migration 0398, so the number does not clash. This file replaces the round 2 recheck.

The CI fix works and everything else still holds. One item blocks: CI and the shared test database get their mark through two different paths (finding 1). The fix is a change to the runbook text only.

## What I ran

- **CI.** I read the check-runs for `05e7262f` through REST. All had finished: 39 success and 1 skipped (`art-browser-gates`). **`account-browser-gates`: success.** `ci-result`: success.
- **Setup.**
  - `corepack enable`, `pnpm install --frozen-lockfile` and `pnpm -r --filter './packages/**' build`: passed.
  - Database: local Postgres 16.
- **CI seed path.** I ran the steps of `account-e2e-pr.yml` "Migrate and seed" in order on a fresh database:
  - `db:migrate`, then `db:seed:dev`.
  - `db:seed:demo-full` without the mark: **refused** before writing anything (exit 1, `not marked as a demo seed target`). The guard was not weakened: `demo-seed-target.ts` and `demo-full-seed.ts` are unchanged since round 2.
  - `db:seed:mark-demo-target local ci`: marked (`local|<db>|ci`).
  - A second mark, `test someone`: "already marked; left as it is". The row was unchanged.
  - Rejected: an environment of `production`. Also rejected: `APP_ENV=production`, `NODE_ENV=production`, and a `prod` host name.
  - `db:seed:demo-full`, `db:seed:check-accounts` and `db:roles`: all passed.
- **Workflows that run the seed.** Only `account-e2e-pr.yml` and `worker-task-test.yml` run it (`grep` over `.github` and `scripts`).
  - `account-e2e-pr.yml` now marks the database before seeding (`:151-152`).
  - `worker-task-test.yml` seeds the shared test database. That database is marked by hand (finding 1).
  - `scripts/ci/start-lax-admin-stack.sh` runs only `db:seed:demo-topup`, which does not check the mark. It is not affected.
- **Shop.**
  - `seed:catalogue`, then `seed:demo-full` twice as `shop_app`. Both runs reported `{"paidOrders":4,"ordersToFulfil":4,"failedRefunds":1,"openDisputes":1}`.
  - The refund is on `composition-1964`: `failed`, with `Order missing stripe_payment_intent_id`, and the order has no intent.
  - The dispute is on a different order, `harbour-at-dusk`: `opened`. The order now has `stripe_payment_intent_id = pi_demo_example_shop_0001`, which matches the dispute.
  - I then did the staff work (refund `succeeded`, dispute `won`) and ran the seed again. A snapshot of refunds, disputes, orders, the audit count, processed events and the `domain_events` count was identical before and after (md5).
- **Bid.**
  - Re-run on the same database: exit 0.
  - The Bid queue seeders are unchanged since round 2, when the full staff-work re-run left every row byte-identical.
  - `queues.integration.test.ts` works every item between runs and passed again.
- **Tests** (`--maxWorkers=2`, with the database URLs laid out as in CI):
  - `@auction/db` `src/seed`, `src/migration-0398*`, `migrate-roles.test.ts` and the `shop_app`/`api_app` role contracts: 19 files, **228 passed**. This includes the new `mark-demo-target-cli.test.ts`.
  - `@auction/shop-api` `infrastructure/seed`, `handlers/webhooks` and `scheduler`: 16 files, 53 passed. I ran it twice in a row on the same database.
  - `@auction/worker` `src/projectors`: 36 files, 199 passed. That includes the `demo-seed` skips in fan-out and in the collection notices, so no email goes to finance or the collector.
- **Static checks.**
  - `tsc --noEmit` for domain, db, persistence, shop-api, worker and api: clean.
  - `biome check` on the changed packages and the workflow: clean (3,526 files).
  - `lint:deps`, `lint:layers` and `lint:datetime`: pass.
- **Attribution.** The 7 commit messages and the PR body contain no Co-Authored-By, Claude-Session or generated-by lines. All commits are by `mahmoudamrspace`.

## Findings

1. **BLOCKING: CI and the test database get their mark by different paths, so CI does not exercise the path test relies on.**
   - Where:
     - `docs/runbooks/demo-seed.md:21-31` and `:41-44` (test);
     - `.github/workflows/account-e2e-pr.yml:152` (CI).
   - **CI** runs the new `db:seed:mark-demo-target local ci`. That script applies the production address checks and leaves an existing mark alone.
   - **Test** (`worker-task-test.yml`, the shared database) is marked by an operator who pastes raw `insert into demo_seed_target ...` SQL, with no address check. The runbook's "marks the database once as above" points to that SQL, not to the script.
   - Result: the script CI tests is never used on test. The step test depends on has no CI coverage and skips the production checks.
   - Fix (text only):
     - In the runbook, make the test step `DATABASE_URL=<test owner address> pnpm --filter @auction/db db:seed:mark-demo-target test <your name>`.
     - Keep the SQL only as a fallback, if at all.
     - Optionally make CI pass `test` too, so both run the same command with the same arguments.
     - Update the PR body's "Changes after recheck" to match.

2. **The Shop dispute's invented payment intent now shows in LAX Admin as a Stripe link (minor, realism).**
   - Where: `apps/shop-api/src/infrastructure/seed/demo-staff-queues-seed.ts:81-87`.
   - The dispute order now carries `pi_demo_example_shop_0001`. Because of that:
     - `apps/shop-admin/src/components/orders/order-actions.client.tsx:78-86` offers "Open in Stripe" (`dashboard.stripe.com/payments/pi_demo_example_shop_0001`), which leads to a page that does not exist.
     - `order-detail-view.tsx:385-390` shows the id.
     - If staff request a refund on that order, the scheduler now calls Stripe with the invented intent. Before this change it failed without calling Stripe. The Stripe error ends in the same Sentry and ops alert, so this happens only after a deliberate staff action.
   - The runbook row `docs/runbooks/demo-seed.md:61` ("the demo orders have no Stripe payment") is now only true of the refund order.
   - Suggestion: add a note to the runbook and the seed docstring. Not required.

3. **Single-order fallback (minor).**
   - `assignOrders` (`demo-staff-queues-seed.ts:52-57`) puts the refund and the dispute on the same order when only one paid order exists.
   - The order would then get the intent, and the refund's stored `last_error` ("Order missing stripe_payment_intent_id") would no longer be true. A Retry would go to Stripe.
   - `seedEditionOrders` always produces 4 paid orders, so this does not happen today. Skipping the intent update when `refund === dispute` would close it.

4. **PR body: the original sections still contradict the current state (non-blocking, text).**
   - The Summary still says "No migrations, no workflow change". Design says clock-bound rows "are refreshed on each run". The persona table still lists Storage, Quarantined replies and a pending refund.
   - "Changes after review" says it supersedes them, but a reader of the top section is misled. Rewrite the top sections, or strike the out-of-date lines.

## Round 2 findings, rechecked

- **1 (BLOCKING, `account-browser-gates`): fixed.**
  - CI is green on `05e7262f`.
  - The CI database is marked by `db:seed:mark-demo-target` after `db:migrate`.
  - The guard is unchanged, and the refusal was reproduced without the mark.
  - Both workflows that run the seed are covered: CI by the script, test by the runbook.
  - The test path is finding 1 above.
- **2 (stale clock-bound items): documented.** See `docs/runbooks/demo-seed.md:67-84`.
  - The three items and how long each stays current are listed.
  - The safe way to show them again is described: a fresh database, or deleting only unworked seed-owned rows, checked first.
  - **No refresh command was added**, so there was nothing to test on Postgres 16 for that.
- **3 (PR text on deleted items): fixed.** It now says a deleted row is written again and a worked item is never changed.
- **4 (doc comment in `migrate-roles.ts`): fixed.** The new constant sits above the "Download my data" JSDoc (`packages/db/src/migrate-roles.ts:632-637`).
- **5 (Shop dispute payment intent): fixed.** The order and the dispute now name the same intent. The side effects are in findings 2 and 3.
- **6 (Shop event producer): noted** in the seed's header comment, as suggested.

## Earlier fixes, still holding

- **Insert-once:** both seeds ran twice with no new rows.
- **No staff work undone:** the Shop re-run after staff work left everything unchanged. The Bid seeders are unchanged, and their staff-work integration test passes.
- **Real recorders and handlers:** the Shop refund goes through `createRequestRefundHandler`, and the dispute through `recordStripeDisputeForOrder`. The Bid builders are unchanged since round 2.
- **No finance email:** fan-out and collection notices skip `producer='demo-seed'`, and the projector tests pass.
