Verdict: SHIP

# Final recheck of PR #1535: clear the saleroom's current lot only when the resolved lot is still on the block (PERF-7F2)

Reviewed head: `83a29b56` (fix commit on top of `8fdf9eaf` plus a merge of `main`). The PR branch was not changed.

## F1 (previous blocker): fixed at the root

The fix covers both the server and every client.

- **Shared reducer.** `apps/web/src/lib/saleroom/apply-saleroom-event.ts:23-31` adds `isOutcomeForCurrentLot`. A hammer or no_sale clears `currentLotId` only when `event.lotId === prev.currentLotId` and `clearedFromBlock !== false`. The call site is `:65-71`.
- **All four consumers use that reducer**, so they keep the live lot:
  - staff console: `use-staff-saleroom-live.ts:116`
  - hub: `use-saleroom-hub-live.ts:131`
  - display: `use-display-socket.ts:77`
  - bidder live provider: `saleroom-live-provider.tsx:138`

  The hub's `completedBumps` (`use-saleroom-hub-live.ts:116`) and the clerk roster patch (`use-clerk-lot-roster-sync.ts:53`) work per lot by `event.lotId`, so a late outcome is correct for them.
- **Display.**
  - The sold or passed flash and its 4s timer are gated on `outcomeOnDisplay` (`use-display-socket.ts:87`, `:93`, `:109`, `:130`).
  - `lastHammer` is filled only from a snapshot lot whose id equals `event.lotId`. Otherwise it is `null` (`:97-107`).
  - A late outcome no longer changes `lotChanged`, so bid state is not reset and the live lot's price is never shown as a hammer.
- **Server.**
  - `saleroom-session-control.service.ts:258-261` reads the real post-commit current lot when the clear was a no-op.
  - It passes that lot as the run-order anchor to `appendEventAndPublish` (`:297`), so `nextLotId` is computed from the lot actually on the block.
  - `clearedFromBlock` is in both payloads (`:269`, `:281`).
- **Schema and compatibility.**
  - `clearedFromBlock?: boolean` is added to `SaleroomRealtimePayload` (`packages/types/src/socket.ts:75-79`). The field is optional and additive.
  - The persisted event payload is an untyped record, so nothing needs migrating.
  - Old clients ignore the field. New clients still compare lot ids when the field is missing from an old server's events, and payloads with no `lotId` keep the old behaviour.

## Mutation runs

I ran each mutation locally and reverted it afterwards.

| Mutation | Result |
|---|---|
| Reducer always clears on hammer/no_sale | 8 fail: 5 in `apply-saleroom-event.test.ts:85` and 3 in `use-saleroom-display-live.test.ts:690` |
| Display flash not gated (`outcomeOnDisplay` = any outcome) | 3 display tests fail |
| Reducer ignores `clearedFromBlock === false` | 1 fails |
| Server anchors `nextLotId` on the resolved lot again | 1 fails: `saleroom.service.test.ts:521` |
| Server drops `clearedFromBlock` from the payloads | 2 fail |
| DB clear made unconditional (drop `current_lot_id = lotId`) | Postgres integration test: 2 of 4 fail |
| Display `lastHammer` id check removed | No test fails. See N1. |

## Independent pass

- **DB compare-and-clear: correct, and unchanged since the first review.**
  - `drizzle-saleroom-session.repository.ts:103-117` is a single conditional `UPDATE … WHERE id AND current_lot_id = lot RETURNING`.
  - It runs through `inOutcomeTransaction`, after `findByIdForUpdate` and the status write (`clerk-lot-outcome.service.ts:68`, `:199`).
  - The integration test passes 4/4 on Postgres 16.
- **Bid acceptance rules and timing: unchanged.** The PR does not touch `packages/bidding-runtime` or any bid-placement code. The settlement logic in `runFinalizeLotTransaction` is unchanged apart from the hook call.
- **Idempotency: unchanged.**
  - A repeat hammer or no_sale returns `400 No current lot`, or `409 lot_not_on_block` when it names the lot (`saleroom-session-control.service.ts:225-240`).
  - A lot that is already closed returns before the hook runs.
  - The extra `findBySaleId` read runs only after a successful outcome and is read-only.
- **SOLID:** fine.
  - The persistence port owns the conditional write.
  - lot-lifecycle-app exposes a generic transaction hook (`ports.ts:61-68`).
  - The api service composes the two.
  - All clients share one exported predicate.

## Suites (on the PR head)

- **`apps/web`** (`src/lib/saleroom`, `src/features/saleroom`, `src/lib/context`, `src/components/admin`): 205 files, 1586 passed. `tsc --noEmit` is clean.
- **`apps/api`:** 731 files, 7659 passed. 51 Postgres integration files were skipped because no `DATABASE_URL` was set for this run. `tsc --noEmit` is clean.
- **`packages/bidding-runtime`:** 18 files, 109 passed.
- **`packages/persistence`:** `drizzle-saleroom-session.current-lot.integration.test.ts` passes 4/4 against a local Postgres 16 with migrations applied.

## Non-blocking

- **N1.** The `lot.id === event.lotId` guard on `lastHammer` (`use-display-socket.ts:97`) is defence in depth. When `outcomeOnDisplay` is true, the snapshot's lot already matches the event's lot, so no test reaches the guard. It is fine to keep.
- **N2.** When the clear succeeded but a later advance's event reaches clients before the hammer event (the two publish independently), `nextLotId` on the hammer is computed from the resolved lot and can name the lot now on the block. Clients keep the right current lot, and only the next-lot hint is briefly stale until the next event. Old servers behaved the same way. The PR body already notes the old-server variant of this.
- **N3 (pre-existing, carried over).** `advanceToLot` still checks the lot status and then writes as two separate steps (`saleroom-session-control.service.ts:125-149`). A follow-up should make `setCurrentLot` conditional.
