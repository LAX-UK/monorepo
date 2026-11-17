Verdict: FIX FIRST

# Review of PR #1535: clear the saleroom's current lot only when the resolved lot is still on the block (PERF-7F2)

Reviewed head: `8fdf9eaf`, on base `310c9417`. This is the follow-up to the non-blocking note in the #1498 final recheck (`review-notes-pr1498-review/review.md:168`).

## Summary

The database fix is correct. The clear is now a compare-and-clear, and it runs inside the lot outcome transaction after the lot row lock. A real Postgres test covers it, and that test fails without the fix.

The realtime path was not changed, so it still knocks the live lot off the block. When the race happens, every connected client still drops the new lot: the clerk console, the room display and the bidder live room. The display also shows a "sold" flash with the wrong lot's price. That is the user-visible half of PERF-7F2, so the defect is not closed yet.

## Blocking finding

### F1. A hammer or no-sale for an earlier lot still clears the live lot on every client

**Where:**
- `apps/api/src/services/saleroom/saleroom-session-control.service.ts:279-288`. When `clearedFromBlock` is false, the event is published unchanged.
- `apps/web/src/lib/saleroom/apply-saleroom-event.ts:46-51`. On `hammer` or `no_sale`, the client sets `currentLotId: null` without checking `event.lotId`.

**Scenario:** this is the race the PR targets.
1. The clerk hammers lot A.
2. Before the outcome transaction's clear, an advance to lot B commits.
3. The database is correct: the clear is a no-op and `current_lot_id` stays B.
4. The advance publishes `advanced_to_lot {lotId: B}`, and then the hammer publishes `hammer {lotId: A}`. The two run independently, so this order is possible.

**What happens on the clients:**
- Every consumer of `applySaleroomEvent` sets `currentLotId = null`. That covers:
  - the staff console (`use-staff-saleroom-live.ts:116`)
  - the hub (`use-saleroom-hub-live.ts:131`)
  - the display (`use-display-socket.ts:77`)
  - the bidder live provider (`lib/context/saleroom-live-provider.tsx:138`)
- B disappears from the block on those screens until a reload or the next session event.
- The display also takes the `lotChanged` path and resets bid state. At `use-display-socket.ts:91-100` it flashes "sold" and fills `lastHammer` from `prev.snapshot.currentLot`, which is now lot B. The public screen therefore shows B's current price and leader as A's hammer.

**Also:** `nextLotId` is computed from A (`appendEventAndPublish(..., lotId)`, `:281-288`). In this race it can name B, the lot already on the block.

**Tests:** the new service test `saleroom.service.test.ts` "resolving a lot that is no longer current leaves the current lot and its overlay" only checks that the event carries `lotId: "lot-1"`. It does not check that consumers keep `lot-2`.

**Suggested fix (small):**
- **Client:** in `applySaleroomEvent`, clear `currentLotId` on `hammer`/`no_sale` only when `event.lotId === prev.currentLotId`. Otherwise keep `prev.currentLotId`. Gate the display's sold/passed flash and `lastHammer` on the same check.
- **Server:** pass the real post-outcome current lot into `appendEventAndPublish`, so `nextLotId` is computed from what is on the block. Optionally, add `clearedFromBlock` or `currentLotId` to the payload.
- **Tests:**
  - A reducer test: state on B, `hammer {lotId: A}`, and B is kept.
  - A display hook test: no "sold" flash with B's price.

## Checklist results

| Check | Result |
|---|---|
| Clear only when the resolved lot is the current lot, under the same transaction and lock as the outcome write | **Met.** `drizzle-saleroom-session.repository.ts:103-117` is a single `UPDATE … WHERE id = $s AND current_lot_id = $lot RETURNING`. It runs through `options.inOutcomeTransaction(tx)` after `findByIdForUpdate` and the status write (`clerk-lot-outcome.service.ts:68`, `:199`). Postgres re-checks the WHERE after the row lock. There is no read-then-write. |
| Hook runs only when the outcome lands | **Met.** A lot that is already closed returns before the hook runs. Tested. |
| Resolving an earlier lot never knocks the live lot off the block | **DB: met. Realtime clients: not met (F1).** The overlay clear is correctly gated on `clearedFromBlock` (`saleroom-session-control.service.ts:279`). |
| Concurrent resolve and next-lot | **DB: safe in both orders.** If the advance commits first, the clear is a no-op. If the clear goes first, the advance's UPDATE waits for the outcome commit and then wins. Lock order (lot row, then session row) matches `drizzle-sale-soft-delete.side-effects.ts` (lots, then session), so I found no deadlock. |
| Events and ws messages consistent with the DB | **Not met: F1.** |
| Bid acceptance rules and timing | **Unchanged.** The PR touches no bidding-runtime or bid-placement code, and the settlement rules in `runFinalizeLotTransaction` are byte-identical apart from the hook call. |
| Idempotency of the clerk command | **Unchanged.** A repeat hammer or pass after success gets `400 No current lot`, or `409 lot_not_on_block` when it names the lot. A lot closed concurrently gets `400`, and the current lot is left alone. |
| Tests fail without the fix, including real Postgres | **Met for the DB layer.** See the mutation runs below. |
| SOLID and clean code | **Fine.** `ClerkOutcomeOptions.inOutcomeTransaction` is a narrow, generic port (`ports.ts:61-68`), so lot-lifecycle does not learn about saleroom sessions. `clearCurrentLot` is fully replaced, with no stale callers. No migration. |

## Mutation runs

I ran each mutation locally and reverted it afterwards. The PR branch is unchanged.

| Mutation | Result |
|---|---|
| Drop `current_lot_id = lotId` from the clear (unconditional clear) | Postgres integration test: 2 of 4 fail. They are "leaves the current lot when a different lot is resolved" and "an advance committed while the outcome transaction is open survives". |
| Run the hook after the hammer transaction instead of inside it (lot-lifecycle-app rebuilt) | `clerk-lot-outcome.service.test.ts`: 1 fails ("runs inside the hammer's outcome transaction"). |
| Clear the display overlay unconditionally | `saleroom.service.test.ts`: 1 fails ("…leaves the current lot and its overlay"). |

## Suites

These ran on the PR head, against a local Postgres 16 with migrations applied.

- **`packages/persistence`, including the new `drizzle-saleroom-session.current-lot.integration.test.ts`:** the new file is 4/4. The full package is 1114 passed and 2 failed. The 2 failures are in unrelated integration files, `consignment-agreement-versions` and `staff-seller-proceeds`. They fail with `role "api_app" does not exist` because `db:roles` did not run in this sandbox. This is an environment issue, not the PR.
- **`packages/bidding-runtime`:** 18 files, 109 passed.
- **`apps/api`:**
  - `src/services/saleroom`, `saleroom.service.test.ts` and `src/routes`: 161 files, 2484 passed.
  - `src/services/lot-lifecycle`: 21 passed.
  - `tsc --noEmit`: clean.
- **`apps/web` (clerk console, saleroom, admin):** `features/saleroom`, `lib/saleroom` and `components/admin`: 200 files, 1525 passed.

## Non-blocking

- **N1:** The Postgres concurrency tests work at the repository level, with `SELECT … FOR UPDATE` on the lot standing in for the outcome transaction. The full service path, with the real `ClerkLotOutcomeService` transaction racing `advanceToLot`, is only covered by the in-memory state test in `saleroom.service.test.ts`. That is acceptable, but a single end-to-end Postgres case would be stronger.
- **N2 (pre-existing, out of scope):** `advanceToLot` (`saleroom-session-control.service.ts:125-149`) still does read-then-write on the lot status. If a hammer on lot A commits between the advance's `status === "active"` check and its `setCurrentLot(A)`, an ended lot can be put back on the block. This only happens when re-advancing to the lot being hammered. A conditional `setCurrentLot` would close it, as a follow-up.
