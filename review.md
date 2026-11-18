Verdict: SHIP

# Review: PR #1563 — Zoho write-backs: catch up what a dry run skipped after going live

Head `a514d3f2`, base `122b816a` (main). Reviewed against `docs/integrations/zoho.md` and `apps/worker/src/integrations/zoho`.

## Was the problem real? Yes.

- All three write-backs mark a dry-run delivery `skipped` with reason `dry_run`: `zoho-artwork-writeback-service.ts:127`, `artwork/listing/zoho-listing-writeback.ts:52`, `fulfilment/print-group-mirror.ts:100`, `fulfilment/order-mirror.ts:142`. The reason is stored in `last_error` (`drizzle-domain-event-delivery.repository.ts` `markSkipped`, main:147-164).
- A skipped row is never claimed again, and nothing put these rows back. `replay:crm-skipped` covers only the `zoho` CRM consumer. The new integration test shows that a `dry_run` skip is not claimed on main.
- The nightly passes repair only the listing and the Status. The stock code, print groups and orders had no repair.

## Checklist

| Check | Result |
|---|---|
| Sends the current state, not stale events | OK. Each handler reads LAX and Zoho when it handles the event: the artwork writeback through `register.findById` and `ZohoStatusSync`, the listing through `registerIdsFor` plus a sync, and the order mirror through `facts.read(orderId)`. Each writes only what differs. Replaying an old event sends today's state. |
| Idempotent | OK. Only `skipped` + `last_error = 'dry_run'` rows for that consumer and its event types are touched (`skippedFilter`). Once the live worker handles a row, it is no longer in that set. A second run requeues 0, and the unit test covers this. |
| Batched | OK. Pages of 500 (`CATCH_UP_PAGE_SIZE`). The loop is bounded by the count taken at the start (`zoho-go-live-catch-up.ts:88`), so rows skipped while it runs are left alone. `--limit` is supported. |
| Rate-limited | OK. The task only flips rows to `pending`. Sending goes through the existing drain (`projectors/lib/zoho-product-deliveries.ts`): batch size 1, 2 s tick budget, shared limiter, circuit breaker, retry and dead-letter ledger. |
| Dry-run preview and summary | OK. `--dry-run` / `catch-up-preview` only counts. A JSON summary prints `dryRunSkipped`, `requeued` and `remaining`. |
| Refuses in off/dry_run | OK, as far as the task can see (`zoho-go-live-catch-up.ts:72`). The check reads the script's own env, not the running worker's mode; see finding 1. |
| Cannot overwrite Zoho-owned fields or staff edits | OK. The catch-up only re-runs the normal handlers. The Status still goes through `ZohoStatusSync` (re-read, `decideStatusWrite`, conflicts). Rows skipped `status_conflict_raised` are not touched because the reason filter is exact. The stock code only goes through `planStockCodeUpdate`, and the order mirror only moves statuses forward. |
| Large registers | OK. One indexed `COUNT`, then `UPDATE … WHERE id IN (SELECT … ORDER BY id LIMIT n)` per page, with no long lock. A large backlog queues ahead of newer events for that consumer; this is documented, and `--limit` is the mitigation. |
| Runbook steps | Mostly correct; see findings 1 and 2. |

## Findings (none block)

1. **The fulfilment mode the workflow gates on does not reach the test worker.** `.github/workflows/zoho-crm-maintenance-test.yml:51` reads `vars.ZOHO_FULFILMENT_MIRROR_MODE`, and the comment at :47-48 says these are "the write-back modes, as the deployed test worker gets them". In the repo, only `ZOHO_ARTWORK_WRITEBACK_MODE` and `ZOHO_ARTWORK_LISTING_MODE` are passed to Terraform (`terraform-apply-test.yml:126,160`, `terraform-test-up.yml:159,193`, `terraform-apply-test-dispatch.yml:95,129`). Nothing passes `ZOHO_FULFILMENT_MIRROR_MODE`. So for `zoho_fulfilment`, runbook step 2 (`docs/integrations/zoho.md:331`, "switch that write-back's mode variable … deploy") does not switch the worker, and the "refuses unless live" gate can pass while the worker is still `dry_run` or `off`.
   - No data is lost: in `dry_run` the rows are re-skipped as `dry_run` and can be caught up again, and in `off` the fulfilment projector is disabled, so the rows wait as `pending`.
   - Fix: wire the variable through to the worker, or say in the doc that for fulfilment the operator must confirm the worker's real mode, for example from the `zoho_fulfilment` dry-run log lines stopping.
2. **"In `off` it would mark them `writeback_off`" applies only to `zoho_artwork_writeback`** (`docs/integrations/zoho.md:332`, and the JSDoc in `zoho-go-live-catch-up.ts`). The listing and fulfilment projectors are disabled when `off` (`zoho-fulfilment-projector.ts:21-22`, and the same pattern in `zoho-artwork-listing-projector.ts`), so their requeued rows just stay `pending`. The wording is harmless but inaccurate.
3. **The mode gate is advisory.** It checks the env of the process running the task, not the live worker (finding 1 is one case of this). The doc already says to run it only once the worker is really live, and a mistake can be recovered. Noted for information only.
4. **Interaction with #1565.** After both merge, each caught-up `artwork_register.offer_changed` that results in a write costs 3 COQL reads + 1 update instead of 2 + 1. This is still paced by the drain, but worth stating in the runbook's large-backlog advice.

## Verification

- `vitest run --maxWorkers=2 src/integrations/zoho src/scripts src/projectors` (worker, `DATABASE_URL` set to a throwaway Postgres 16 on 55432, migrated): 99 files, 766 passed, 7 skipped.
- `drizzle-domain-event-delivery.repository.integration.test.ts` (persistence, same DB): 2 passed.
- Merged with #1565 locally: auto-merge succeeded (only `docs/integrations/zoho.md` overlaps, in different sections), worker `tsc --noEmit` is clean, and `src/integrations/zoho` gives 539 passed. The two PRs do not conflict.
- Not run: the worker role contract test as `worker_app`, because that role was not provisioned on the throwaway DB.
