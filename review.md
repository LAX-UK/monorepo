Verdict: SHIP

# Independent review: PR #1573 (CRM audit fixes F2, F3, F13, F14, F23)

Reviewed head `c15f4f79` (based on main `33ca431d`) against `findings.md` on `review-notes-systems-final-audit`. I did not change the PR branch. Nothing below blocks: no finding produces a wrong CRM state, a duplicate write, a lost erasure or a broken start-up.

## Per finding

**F2: met.** `crm-event-mappers.ts:462` moves the stage only when `refundedTotalPence >= orderTotalPence`. Otherwise it returns a `deal_note` with the amount (`:468`) and sends no `Amount` and no `Stage`. The amounts are integer pence: `crm-readers.ts:174` sums with `coalesce(sum(amount_pence),0)::int` over `status = 'succeeded'`. That is the same sum the Shop uses to mark the order refunded (`apps/shop-api/src/infrastructure/refund-settlement.ts:101-104`).
- Multiple partial refunds that add up to the total count as full (mapper test "treats the refund that completes earlier partial ones as full"). The reader integration test sums 500 + 1500 succeeded and ignores the 9000 failed refund.
- After a reversal the refund stays `succeeded` with `reversed_at` set (`complete-refund.handler.ts:158-178`). The sum still counts it, as the Shop's order status does. So a refund after a reversal is judged the way the order shows it, and the deal stays refunded, as zoho.md documents for `shop.refund.reversed`.
- The note ledger id is per refund (`shop-refund:<id>`) and the title carries the refund-id prefix, so each partial refund gets its own note, once.

**F3: met.** `crm-deal-sync-handler.ts:182` and `:230` lead to `dealMissing` (`:324`). It retries only while `isDeliveryInFlight` finds the `zoho` delivery of `shop.order.paid` for that order in `pending`, `processing` or `retryable` (`crm-readers.ts:199`; the statuses match `domainEventDeliveryStatuses`). Otherwise it skips `deal_link_missing`. `replay:crm-skipped` resets both skipped rows to `pending`, and if the refund is claimed first it sees the paid delivery pending and waits. A paid delivery that is dead-lettered or skipped ends the retries, so the retry is bounded.

**F13: met.**
- (c) `claimLink` (`drizzle-crm-record-link.repository.ts:97`) is `INSERT … ON CONFLICT DO NOTHING RETURNING`. The takeover is a single conditional `UPDATE … RETURNING` on the expected prior state (refused, or pending and older than the grace period). The integration test with two parallel claims gives `[false, true]`.
- (a) The row is reset only on `isDefiniteCrmRefusal` (`crm-deal-sync-handler.ts:293`: 4xx other than 408, or `circuit_open`) or on a record `status:error`. A timeout, a 5xx or a failure of `upsertLink` after the send leaves the row pending. The next attempt looks the note up by Parent_Id and title (`:263`) and records it rather than sending it again. Titles are unique on a deal: there is one fulfilment per order (`shop_fulfilment_order_uid`), the milestones are distinct, and refund titles carry the refund id.
- (b) Erasure resolves pending rows through `findNoteIds` and deletes them (`crm-subject-lifecycle-handler.ts:207-213`). Notes are deleted before the deal cascade, and `addDealNote` on an erased row skips `subject_erased`.

**F14: met, and the current configuration still starts.** `zoho-crm-config.ts:58` rejects types the `zoho` consumer does not receive. It requires the pipeline and stage for the five types that set a stage, and requires `user.identity_deleted` (directly, or through the always-on rule) whenever a deal or Shop type is enabled. It runs only when the mode is not `off`.

Results of calling the function directly:
- The canary list `user.registered,user.email_verified,user.profile_updated,bid.first_for_user` passes.
- The workflow defaults (`user.registered`, `''` with `off` in prod) pass.
- `shop.fulfilment.status_changed` alone, `shop.order.paid,user.identity_deleted` with no stage, and a misspelt type are each rejected.

**F23: met.** `crm-deal-sync-handler.ts:87` drops `Stage` from the update path, so `Stage` is sent only on create.

## Scope checks
- No event was added to any canary or rollout list or workflow default. The diff touches no `.github/` or terraform file, and its only allowlist change is a validation test.
- Overlap with other PRs:
  - #1571 shares only `docs/integrations/zoho.md`.
  - #1570 also touches `apps/worker/src/env.ts`, in a different hunk (artwork writeback OAuth, around line 600, against the CRM allowlist around line 717).
  - Merging #1570, then #1571, then #1573 onto main has no conflicts.
- The zoho.md edits are confined to the env table rows, the Shop paragraph and the `shop.order.paid`, `shop.refund.completed` and `shop.fulfilment.status_changed` rows.

## Non-blocking observations
1. **A note whose send timed out can dead-letter instead of being resent** (`crm-deal-sync-handler.ts:37`, `:273`; `crm-gateway-error.ts:55`). After a non-definite failure where Zoho did not in fact create the note, the same delivery has to wait out `CRM_NOTE_PENDING_GRACE_MS` (10 min). Each `deal_note_in_flight` retry uses up one of the 12 attempts. With the runner's full-jitter backoff, about 14% of such deliveries run out of attempts before 10 minutes (simulated 200k runs) and dead-letter with an admin email. Nothing is ever sent twice, and the dead letter can be replayed. A follow-up could mark `crmNoteInFlightError` as `waiting: true`, so it does not use up attempts, as `isWaitingDeliveryError` allows.
2. **`deal_link_missing` retries also use up attempts** (`crm-gateway-error.ts:45`). During a long Zoho outage the paid delivery's circuit-open retries do not count against its attempts, but the refund's retries do. The refund could dead-letter while the paid event is still `retryable`. This was the same before the PR, and `waiting: true` would fix it too.
3. **The refund state is read when the event is handled, not as it was when the event was raised** (`crm-readers.ts:156-181`). If two partial refunds that add up to the total are both handled after the second succeeds, both events move the stage and no "partly refunded" note is written for the first. The final CRM state is correct; zoho.md documents this ("judged on the order's refund state when the event is handled").
4. **The note's "refunded in total" figure counts reversed refunds** (`crm-event-mappers.ts:468`). This matches the Shop order status, by design.
5. **Pending rows written before this PR are not erased from Zoho** (`crm-subject-lifecycle-handler.ts:207`). Those rows have no `heldPayload`, so erasure cannot find their notes. In practice there are none, because no Shop or deal type has been enabled on the canary.
6. **`upsertLink` clears `erasedAt`** (`drizzle-crm-record-link.repository.ts:73`), so an erasure that lands while a note is mid-send can be undone by `recordNote` or `refused()`. This existed before the PR and the window is narrow.

## Test runs
- Database: throwaway Postgres 16 on 55432, migrated, with the `worker_app`, `api_app`, `auth_app` and `shop_app` roles and a CI-style environment. Suites ran with `--maxWorkers=2`.
- `tsc --noEmit`: worker and persistence both clean (exit 0).
- persistence `drizzle-crm-record-link.repository.integration.test.ts`: 8 out of 8 pass, including the parallel claim.
- worker, full suite: 2749 pass, 167 fail, in 14 files that the PR does not touch. The failures come from test files sharing one database without the per-file isolation CI uses, plus no Redis on 6379.
  - Rerunning those 14 files on their own on the PR: 170 pass, and one file fails, `crm-deal-naming-reader.integration.test.ts` (fixture breaks the `shop_order_line_target_xor` check).
  - The same 14 files on main: the same naming-reader failure, plus one failure in `stripe-books`.
  - The PR's own CRM integration tests (`crm-readers`, `crm-shop-order-sync`) pass as `worker_app`.
- shop-api: 3746 pass, 3 fail, all in `framing.integration.test.ts`, which also fails on main ("has no price for up_to_40x50").
