Verdict: FIX FIRST

# Final recheck of PR #1530: Tell the clerk which limit refused a staff-placed bid

I rechecked head `c647fecd` (6 commits, all by mahmoudamrspace, no trailers) against `origin/main` `310c9417`. The merge base is `2646590a`. The previous review is in the git history of this branch (`2fdd1d1a`).

The decided rule is privacy-first: the clerk sees only the room left on this lot. They never see the bidder's other limits, totals or exposure on other lots.

## Previous FIX FIRST findings

| # | Finding | Status |
|---|---|---|
| 1 | Registration limit not reported or audited | **Fixed.** `registration` kind added in `packages/domain/src/staff-bid-limit-refusal.ts:15,73`, the event schema, the web reader and the copy. Tested through `placeTelephoneBid` with no booking (`admin-live-bidding-application.service.test.ts:345`). `available` is dropped, so it reads as a per-bid cap. |
| 2 | Surviving mutants M2–M4 and W2–W8 | **Fixed.** Replay and success paths now assert `publish` is not called (`…service.test.ts:75,99,127`). The `maxAutoBidAmount` refusal is covered (`:414`). Hook tests cover line change, quick amount, a new bid and channel (`use-clerk-bid-entry.test.ts:323–382`). The copy is pinned. |
| 3 | Audit best-effort, duplicates | **Fixed at the root, as far as this codebase allows.** `request_key` is required in the schema. Failures are counted on `staff_bid_refusal_audit_failed`, with a PromQL alert and a runbook entry. A throwing counter is swallowed. The decision against a unique index is recorded with reasons. |
| 4 | Notice below the form (FBK-1) | **Fixed.** The notice is under the group title and above the inputs (`lot-on-block-panel.tsx:237,322`). |
| 5 | A repeat refusal is not announced again | **Fixed.** `setLimitRefusal(null)` runs before each placement (`use-clerk-bid-entry.ts:267,314`). |
| 6 | Organisation limit exposed | **Fixed for `organisation`.** The domain, the web reader and the schema all refuse the total. **Not fixed for `authorisation_total`**, which breaks the same rule (see F1 below). |
| 7 | Copy, e2e, PR body | **Fixed.** The copy is in `clerk-command-copy.ts`. The `@journey` Playwright case was added (compiled, not run against a stack). The broken image rows are gone. |

## Findings

### F1. The clerk is told a buyer agent's total authorisation, which reveals their exposure on other lots (FIX FIRST, privacy)
- **Where:**
  - `packages/domain/src/staff-bid-limit-refusal.ts:90` passes `limit` (the total) through for `authorisation_total`.
  - `apps/api/src/services/admin/clerk-bid-error-body.ts:19` sends it to the console.
  - `apps/web/src/features/saleroom/lib/clerk-bid-refusal.ts:82-83` shows it, using `apps/web/src/features/saleroom/lib/clerk-command-copy.ts:29-30`.
  - `apps/api/src/services/admin/staff-bid-limit-refusal.recorder.ts:67` writes it to the audit row, which is shown in Bid admin's audit log.
- **Failure scenario:**
  - A telephone bid of £2,000 is placed for a buyer agent with a £30,000 total authorisation and £28,500 already committed on other lots.
  - The clerk reads: "It would take them past the £30,000.00 their buyer agent authorisation allows in total. They can bid up to £1,500.00 on this lot."
  - That gives the clerk the bidder's total limit and their £28,500 exposure across other lots and sales. The PR's own test pins this text (`clerk-bid-refusal.test.ts:32`).
  - This is the same leak the PR closed for `organisation`. The decided rule ("never the bidder's other limits, totals or exposure on other lots") covers both.
- **Fix at the root:** treat `authorisation_total` like `organisation`, a shared limit shown only as room on this lot.
  - **Domain:** widen the `limit: null` branch of `StaffBidLimitRefusal` to `kind: "organisation" | "authorisation_total"`, and drop `limit` at `staff-bid-limit-refusal.ts:87-90`.
  - **Schema:** extend the `superRefine` in `packages/types/src/domain-event-catalog/payload-schemas.ts` so it refuses `limit` and requires `available` for that kind too.
  - **Web reader and copy:**
    - Mirror the change in `readClerkBidLimitRefusal`.
    - Change the reason copy to name no amount, for example: "It's above what their buyer agent authorisation allows in total."
    - Follow it with the room ("They can bid up to £1,500.00 on this lot.") or with `noRoom`.
  - **Tests:** update the pinned copy, and add the D2, T1 and W9 mutation tests for this kind.
- **Kinds that are fine:**
  - `per_lot` is acceptable as it is: it is the cap on this lot, and `available` equals `limit`.
  - The paddle, telephone booking and registration caps are per-bid caps that apply to this bid. Showing them is the room on this lot.

### F2. The audit-failure log line can carry payload values (low, not blocking)
- **Where:** `apps/api/src/services/admin/staff-bid-limit-refusal.recorder.ts:80` logs the raw `err`.
- **Why it matters:** a Zod or Postgres error from the sink can echo payload fields such as `limit`, `available` or `request_key`.
- **Fix:** log `err.name` / `err.message` only, or the error code. This is minor once F1 has removed the totals from the payload.

### F3. A long header idempotency key silently loses the audit row (nit)
- **Where:** `request_key` is capped at 256 (`payload-schemas.ts`). The body key is validated 8–128 (`packages/validators/src/paddle.ts:30`, `lot/lifecycle.ts:59`). The `Idempotency-Key` header used at `apps/api/src/routes/admin/saleroom.routes.ts:110-113,144-147` is not length-checked on these routes.
- **Failure scenario:** an API client sends a key over 256 characters. The schema rejects the row and it is only counted. The console always sends short keys.
- **Fix:** apply the same 8–128 check to the header, or truncate or hash the key into `request_key`.

## Independent pass

- **Bid acceptance rules and timing are unchanged.**
  - The engine diff only attaches `details` to the operator-cap `BidError`. The codes, statuses and messages are the same.
  - The telephone `idempotencyKey` derivation moved above the booking check, which is a pure computation with the same value.
  - The audit is awaited only on `err`, never on success or replay. The recorder returns before any I/O when the refusal is not a limit.
- **Security.**
  - Both routes are still behind `requireSaleroomOperate`.
  - No new endpoints, capabilities or migrations.
  - The `error` message strings carry no amounts.
  - `refusal` is only computed from the engine's own `details`.
  - The web reader validates kind and money format.
- **SOLID and clean code.**
  - The dependency direction is right: the domain parses the refusal, the API records it through `IDomainEventSink` behind the narrow `IStaffBidLimitRefusalRecorder`, and the web only draws it.
  - The copy is centralised. The metric is injectable and tested.
- **States and design.** I checked the committed screenshots:
  - widths 1440 and 375, light and dark
  - paddle, account-limit and registration cases
  - a long body wraps cleanly at 375
  - kit `Notice`, danger tone with `role="alert"`
  - placed above the form per FBK-1
  - sentence case, staff money formatter
  - the unnamed telephone bidder falls back to "The telephone bidder"
- **Suites on the PR head (all green):**
  - bidding-runtime: 110 passed
  - domain: 3938 passed, 1 skipped
  - types: 339 passed
  - api (`src/services/admin`, `src/routes`, telephone booking): 2913 passed, 13 skipped
  - web clerk console and admin (`src/features/saleroom`, `src/lib/admin`): 2054 passed
- **Not run:** the Playwright `@journey` case (no seeded stack here).

Only F1 blocks shipping. Once `authorisation_total` follows the room-only rule, this is ready to ship.
