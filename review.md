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

## Fixes after review

Pushed to `fix/crm-audit-refunds` (head `0a495afb`, with current main `b3e9f9ce` merged in, no conflicts).

1. **CI static-checks: circular dependency `env.ts` -> `zoho-crm-config.ts` -> `env.ts`** (commit `681da135`). The pure allowlist rules now live in a new module with no env import, `apps/worker/src/integrations/zoho/zoho-crm-allowlist-rules.ts`: `zohoCrmAllowlistIssues` is at `:60`, along with `isZohoEventTypeEnabled`, `parseZohoEnabledEventTypes`, `hasZohoPersonSyncEnabled` and the type constants, all typed structurally. `apps/worker/src/env.ts:12` imports the rules from there. `apps/worker/src/integrations/zoho/zoho-crm-config.ts:6` re-exports them, so callers and `zoho-crm-config.test.ts` are unchanged. `circular-deps-allowlist.json` is not touched. `pnpm lint:deps` failed on the PR head and passes now: 46 allowlisted cycles, freeze 47/47.
2. **Observations 1 and 2: note-in-flight and `deal_link_missing` retries used up attempts** (commit `3d4658cc`).
   - `apps/worker/src/integrations/crm/crm-gateway-error.ts:73` (`crmDealNotLinkedError`) and `:90` (`crmNoteInFlightError`) are now waiting errors: `waiting: true` (field at `:12`) and `retryAfterMs` 60 s (`CRM_WAITING_RETRY_AFTER_MS`, `:43`). A wait therefore costs no attempt and polls once a minute rather than about once a second, which matters because the note path calls Zoho `findNoteIds` on each try.
   - **Cap:** the runner had no cap on waiting errors. `isWaitingDeliveryError` (`apps/worker/src/lib/delivery-retry.ts:110`) now honours an optional `maxWaitMs` on the error, measured from the delivery's `createdAt`. The runner passes the delivery in at `apps/worker/src/projectors/lib/domain-event-delivery-runner.ts:90`.
   - The CRM errors set `CRM_WAITING_MAX_MS` = 24 h (`crm-gateway-error.ts:50`). After that, each retry counts as an attempt again, and the delivery dead-letters (replayable) after the usual 12.
   - Accounting waiting errors set no `maxWaitMs`, so their behaviour is unchanged.
   - The natural ends still apply first: the claimant records or refuses the note, or the 10-minute grace lets this delivery take the claim over; and for a refund, the paid delivery links the deal or ends, after which the refund is skipped.
   - **Tests:**
     - `apps/worker/src/projectors/lib/domain-event-delivery-runner.test.ts:296` simulates the claim/retry loop. A note in flight at attempt 12 is rescheduled at least 60 s out and not dead-lettered. A note in flight waits out the whole 10-minute grace and then succeeds, in at most 12 tries. A refund waits through a 6-hour outage while the paid delivery is retryable and then succeeds. Both waits still end: past 24 h they dead-letter within 12 attempts.
     - `apps/worker/src/integrations/crm/crm-shop-order-sync.test.ts:187` and `:322` assert `waiting: true` and `retryAfterMs: 60000` on the handler's errors.
     - With the error change reverted, all 5 runner tests fail.
   - `docs/integrations/zoho.md:101-102` documents the one-minute retry and the 24 h cap.
3. **Observation 6: `upsertLink` cleared `erasedAt`** (commit `0a495afb`). This is a minimal, opt-in fix.
   - `UpsertCrmRecordLinkInput.keepErased` is declared at `packages/persistence/src/interfaces/crm-record-link.repository.ts:30`.
   - The Drizzle upsert adds `setWhere: erased_at IS NULL` when it is set (`packages/persistence/src/repositories/drizzle-crm-record-link.repository.ts:76`).
   - The in-memory double mirrors it (`apps/worker/src/integrations/crm/crm-test-doubles.ts:28`).
   - The note paths that run after a send pass it: `refused()` at `apps/worker/src/integrations/crm/handlers/crm-deal-sync-handler.ts:281` and `recordNote` at `:321`.
   - Every other `upsertLink` caller is unchanged.
   - **Tests:**
     - `crm-shop-order-sync.test.ts:272`: an erasure that lands mid-send stays erased when Zoho adds the note and when it refuses it, and a redelivery is then skipped as `subject_erased`. Both cases fail without the handler change.
     - `drizzle-crm-record-link.repository.integration.test.ts:233` checks against Postgres that `keepErased` leaves an erased row alone, still inserts a new row, and that a plain upsert still clears `erasedAt`.
4. **Observations 3, 4 and 5** are left as documented above. No change.

### Test runs after the fixes
- Database: throwaway Postgres 16 on 55432, migrated, with role probes seeded and `db:roles` applied. Redis was on 6379. All role URLs were set (`DATABASE_URL_WORKER`, `_API`, `_SHOP`, `_AUTH`). Suites ran with `--maxWorkers=2`.
- worker, full suite: 2930 passed, 3 skipped. One file errors at suite level: `crm-deal-naming-reader.integration.test.ts`. It is the same `shop_order_line_target_xor` fixture failure that occurs on main, in a file this PR does not touch.
- shop-api, full suite: 3749 out of 3749 pass.
- persistence `drizzle-crm-record-link.repository.integration.test.ts`: 9 out of 9 pass.
- `tsc --noEmit`: worker, shop-api and persistence are all clean.
- `biome check .`: clean (3 warnings that are already on main, none in changed files).
- `pnpm lint:deps`: passes.

## Final recheck

Rechecked head `0a495afb` (`fix/crm-audit-refunds`). It has current `origin/main` `b3e9f9ce` merged in, plus the fix commits `681da135`, `3d4658cc` and `0a495afb`. The PR branch was not changed. Pairwise trial merges with #1570 and with #1571 are clean.

**Verdict: SHIP.**

### Import cycle: removed, not allowlisted (confirmed)

- `zoho-crm-allowlist-rules.ts` imports only `@auction/types`.
- `env.ts:12` imports the rules from it, and `zoho-crm-config.ts` re-exports them.
- `scripts/circular-deps-allowlist.json` and `scripts/ci/circular-deps-allowlist.baseline.json` are byte-identical to `origin/main`.
- `pnpm lint:deps` passes: `check-circular-deps: ok (46 allowlisted cycles)`, freeze `ok (47/47 cycles)`, undeclared-imports tests ok. On GitHub, `static-checks` and `ci-result` are `success` on `0a495afb`.

### Waiting retries do not use up attempts, and are bounded (confirmed)

- `crmDealNotLinkedError` and `crmNoteInFlightError` now carry `waiting: true`, `retryAfterMs` 60 s and `maxWaitMs` 24 h. The runner (`domain-event-delivery-runner.ts:90-123`) passes the delivery's `createdAt`. A wait is never dead-lettered for attempts and is scheduled with `undoAttemptIncrement`, so it costs no attempt.
- `isWaitingDeliveryError` returns false once `now - createdAt >= maxWaitMs`. From then on each retry counts, and the delivery dead-letters (replayable) within the usual 12 attempts. The wait is bounded.
- Accounting waiting errors set no `maxWaitMs`, so they are unchanged.
- One thing to know, not blocking: the bound is measured from `createdAt`, which a replay does not reset. A replayed delivery older than 24 h that hits a wait therefore counts attempts at once. It is still bounded and still replayable.
- The runner tests (`domain-event-delivery-runner.test.ts:296`) and the handler tests (`crm-shop-order-sync.test.ts:187`, `:322`) pass.

### `erasedAt` cannot be cleared by the note paths (confirmed)

- With `keepErased`, the Drizzle upsert adds `setWhere: erased_at IS NULL`, so an erased row is left exactly as it is; a new row still inserts. The in-memory double mirrors this.
- Both writes that finish a note send, `refused()` (`crm-deal-sync-handler.ts:281`) and `recordNote` (`:321`), pass it.
- `claimLink`'s takeover already requires `erased_at IS NULL`, so an erased note row cannot be claimed and re-sent.
- The tests at `crm-shop-order-sync.test.ts:272` and `drizzle-crm-record-link.repository.integration.test.ts:233` pass.
- **Follow-up, not blocking and existing before this PR:** the other `upsertLink` writers still clear `erasedAt` (deal create and update at `crm-deal-sync-handler.ts:159/391/443`, person sync, paid buyer, lead conversion, `backfill-crm-users`). An erasure that lands while one of those sends is in flight can still be undone in the ledger, which is the same race class observation 6 named. Passing `keepErased: true` on the post-send writes would close it.

### Canary allowlist unchanged (confirmed)

`git diff origin/main..0a495afb` touches no `.github/`, terraform or infra file. In `env.ts` the only change is the import and the issue loop. `ZOHO_CRM_ENABLED_EVENT_TYPES` and its defaults are untouched.

### Runs (Postgres 16 on :55432 and Redis, every role URL set, `vitest run --maxWorkers=2`)

| Check | Result |
|---|---|
| @auction/worker | 2930 passed, 3 skipped. 1 file fails at suite level: `crm-deal-naming-reader.integration.test.ts`, the `shop_order_line_target_xor` fixture failure. It fails the same way on the #1570 and #1571 trees, is untouched, and predates this PR. The worker role contract passes, and so does GitHub `worker-role-contract`. |
| @auction/persistence | 1162 passed, 8 skipped (185 files) |
| Targeted: runner, crm-shop-order-sync, zoho-crm-config, env tests | 75 of 75 pass |
| `tsc --noEmit` (worker, persistence) | clean |
| `pnpm lint:deps` | passes |
| GitHub checks on `0a495afb` | all success (`ci-result` success) |
