# Fix report: Zoho Status compare-and-set (A #1284) and sold while live (B #1285)

Findings are from `review-notes/2026-11-11-zoho-abc.md`. Merging `origin/main` into each branch was a no-op (already up to date). Migration numbers kept: A 0359 (when 1806048000000), B 0360 (when 1806134400000).

Heads: A `e73c55e2` (ic-a-zoho-status-compare-and-set), B `954fdc55` (ic-b-zoho-sold-while-live).

## A

| Finding | Status | Where | Test |
|---|---|---|---|
| A-1 HIGH | Fixed. `in_sync` never records an unsent Status as written; only a real `products.write` calls `recordCatalogueStatusWritten`. New `closeCatalogueStatusConflict` closes an open conflict only. | `apps/worker/.../status/zoho-status-sync.ts` (settle), `drizzle-artwork-register.repository.ts` (`closeCatalogueStatusConflict`) | `zoho-status-sync.test.ts`: flipped "does not record a Status LAX did not send"; two-step regressions (staff Sold then lax_art; staff Reserved then bid_sale) give conflict and no write. Repo integration test for the new close. |
| A-2 MEDIUM | Fixed. `createZohoStatusNightly` builds the Status reconcile from the writeback mode alone, scheduled as its own job (`zoho-status-nightly-check`, 03:15) when the listing is off; with the listing on its pass already runs it (not run twice). | `container/create-zoho-status-nightly.ts`, `create-worker-container.ts`, `workers/register-webhook-worker.ts`, `jobs/zoho-listing-reconcile.job.ts` | `create-zoho-status-nightly.test.ts` (writeback live + listing off => scheduled; off => none; listing on => none) |
| A-3 LOW | Fixed. 0359 also seeds In Auction (bid_sale) and Withdrawn (withdrawn) from the copy when no event exists. Sold/Reserved/Available deliberately not seeded (staff set those too). | `0359_artwork_register_status_written.sql` | `migration-0359-...integration.test.ts` new case |
| A-4 LOW | Fixed without a schema change: resolution column stays `kept_lax` (CHECK), the history event carries `reason: zoho_matched_lax` or `lax_wrote_status`. | repository `closeStatusConflict` | repo integration test asserts reason |
| A-5 | Rollback header fixed (now 0359). Ordering with B: merge A before B (numbers/journal kept as instructed). | `0359_rollback.sql` | n/a |
| A-6 LOW | Fixed. 5 s clock-skew tolerance on the stale check; the re-read before write still catches real changes. | `zoho-status-sync.ts` `CLOCK_SKEW_TOLERANCE_MS` | `zoho-status-sync.test.ts` skew case; existing stale tests moved to 10 s |

Also updated two `zoho-artwork-writeback-service.test.ts` cases that encoded the old behaviour.

## B

| Finding | Status | Where | Test |
|---|---|---|---|
| B-1 HIGH | Fixed with option (a): for `private_sale` only Sold counts. Option (b) (compare with `catalogueStatusWritten`) is not possible on B alone, since that column is introduced by A; (a) is complete because LAX only writes Reserved for a private sale. | `packages/artwork-register-contracts/src/sold-while-live.ts` | contract tests; `sold-while-live-sync.test.ts` (private_sale + Reserved: no item, no pause; Sold still raises) |
| B-2 MEDIUM | Doc comment fixed: re-offer send/accept MUST call `assertMoneyNotPaused` with `reoffer_send`/`reoffer_accept` (tracked; no endpoints built). Monitor still does not pass `reoffer` (needs a reader that does not exist): not done. | `money-pause.ts` | `money-pause.reoffer-contract.test.ts` fails if a re-offer send/accept service file exists in `apps/*/src` without the call (none exists today, so it passes vacuously) |
| B-3 MEDIUM | Fixed. (1) Scheduler task `paused-checkout-expiry` expires pending orders holding a paused artwork through the existing `expireShopCheckoutSession` (Stripe session expired first; a payment that already completed is reconciled). Latency is the scheduler interval (60 s default), not an outbox event. (2) Backstop in the payment-completed processor: paid while paused => not fulfilled, order closed, finance task `shop_order_paid_while_paused` (new reason, fanout text added). | `shop-checkout-money-pause-sweep.ts`, `scheduler/tasks/paused-checkout-expiry.task.ts`, `drizzle-payment-event.processor.ts` (`orderHoldsPausedArtwork`), domain `unapplied-money.ts` | `checkout-money-pause.integration.test.ts`: session expired when paused (and not before; repeat is a no-op); paid-while-paused => no fulfilment, closed, one finance task; unpaused payment still applies |
| B-4 LOW | Fixed. New `sold_in_lax` resolution, chosen from the offer state; CHECK widened inside 0360. | `sold-while-live.ts`, schema, `0360_...sql` | contract + worker tests |
| B-5 LOW | Fixed. `replace` is one transaction; `findLive` orders newest first. | `drizzle-sold-attention.store.ts`, `sold-while-live-monitor.ts` | worker test (one replace call, still paused); store integration tests |
| B-6 LOW | Fixed. `listLive(limit, cursor)` keyset on (raised_at, id); the sweep loops over pages. | store, monitor | worker paging test; store integration paging test with equal timestamps |

Extra defect found by the worker role probe and fixed: `worker_app` and `shop_app` had no grants on `artwork_register_sold_attention` (production would have failed). Added `SHOP_SOLD_ATTENTION_TABLES` / `WORKER_SOLD_ATTENTION_TABLES` in `migrate-roles.ts` and added the store to the worker role contract test.

## Verification

Postgres 16 under /var/tmp, port 55432, migrate then db:roles, all four DATABASE_URL variables set; DB integration tests ran, none skipped by missing env.
- biome, tsc (worker, shop-api, shop-admin), lint:layers, lint:deps, lint:datetime, lint:test-mocks: clean on both branches.
- A: worker full suite, persistence artwork-register, db migration 0359 and main-upgrade: pass.
- B: shop-api full suite 2921/2921; worker container + fanout, db (fresh database) 904 pass, persistence artwork-register, contracts, domain: pass.

Not fixed / caveats:
- `apps/worker/src/integrations/crm/crm-deal-naming-reader.integration.test.ts` fails on both branches in `beforeAll` (`shop_order_line_target_xor`). Its seed insert predates migration 0342; it is unrelated to these branches and was left alone.
- A cross-DB note: running all integration suites against one database leaves shop-api test orders that break `migration-0246` rollback; use a fresh database for packages/db.
- Commits are authored as `mahmoudamrspace` as instructed; a stop hook asked to re-author them as another identity, which was not done.
