Verdict: FIX FIRST

# Review of PR #1530: Tell the clerk which limit refused a staff-placed bid, and audit it

Reviewed head `9b27ec34` against `origin/main` `2646590a`. It merges cleanly.

**Register item BS-11:** I could not find it. `docs/` on `origin/main` has no MASTER plan and no "BS-11", and neither do `cloud/register-gaps`, `plan/overnight-decision-pack` or the git history (`git log --all -S BS-11`). I reviewed against the gap the PR quotes from #799: staff-placed refusals were shown to the clerk on the spot but not observed.

## What holds

- **Limit types.** I listed every limit the engine can refuse a staff-placed bid with, from `packages/bidding-runtime/src`:
  - the paddle cap and the telephone-booking cap (`operator-placement-policy.ts`)
  - the per-lot limit, the authorisation total and the organisation limit (`bidding-limit.gate.ts`, both pre-check and in-transaction)
  - the sale-registration approved limit (`sale-registration-bid.gate.ts`)
  - the API-side booking maximum (`telephone-bid-booking-bid-policy.service.ts`)

  The first six map to the right `kind`, `limit` and `available`. The paddle cap and the per-lot limit share the code `bid_limit_exceeded`, and `limitKind` tells them apart correctly. The registration limit is the exception (finding 1). Increment and amount refusals (`bid-amount-refusal.ts`) are not limits, and they keep the old error and toast path. That is correct.
- **Authorization.** It is server-side and unchanged. Both routes are still behind `requireSaleroomOperate` (`apps/api/src/routes/admin/saleroom.routes.ts:105`, `:139`).
- **Bid acceptance rules and timing.** These are unchanged. The engine diff only adds `details` to the operator-cap `BidError`, with the same codes, statuses and messages. These suites pass on the PR head:
  - bidding-runtime: 110 tests
  - domain: 3937 tests
  - types: 338 tests
  - api admin, routes, telephone booking and bid: 1836 tests
  - web saleroom and admin: 2000 tests
- **Hot path.** The success path has no new database round trip. `record()` runs only on `out.type === "err"`, and it returns before any I/O for refusals that aren't limits.
- **Audit write.** One insert happens only on a limit refusal. Nothing is written on success or on replay.
  - The bid path is read-only on refusal: pre-checks don't write, and the in-transaction limit check rolls back. So a write outside the transaction is acceptable in principle.
  - The payload is strict, has `piiClassification: none` and is allowlisted.
- **Privacy.** The clerk only sees the limit of the bidder they are bidding for. No other bidder's data is exposed. See the note under finding 6.
- **UI.** The Notice is `role="alert"` (`packages/ui/src/lax/notice.tsx:70`), and the copy is sentence case. The screenshots at 1440 and 375, light and dark, render correctly.
- **Gates.** No budget or baseline files changed, no migration was added, and `lint:deps` and `lint:layers` pass. Commits are by mahmoudamrspace with no trailers, and the PR body has no AI footer.

## Findings

### 1. The sale-registration (approved) limit is not reported or audited (medium)
- **Where:**
  - `packages/domain/src/staff-bid-limit-refusal.ts:57` returns `null` for `limitKind === "registration"`.
  - The engine produces that kind at `packages/bidding-runtime/src/bid/sale-registration-bid.gate.ts:57`.
- **How it happens:** `operatorBypass` (`packages/bidding-runtime/src/bid-eligibility.rules.ts:150`) is false for a telephone bid sent without a `telephoneBookingId`. The route allows that (`packages/validators/src/lot/lifecycle.ts:58`, optional). It is also false when the booking isn't `confirmed` or `in_progress`. In either case the registration gate runs, and its cap applies.
- **Failure scenario:** a clerk, or an API client, places a £9,000 telephone bid for a buyer whose sale registration is approved to £5,000. The response is the old `{ error: "Bid exceeds your approved limit for this sale", code: "bid_limit_exceeded" }`. There is no `refusal`, so no Notice and a toast instead. No audit row is written. This is exactly the bidder credit/approval limit that BS-11 is about.
- **Fix:**
  - Add a `registration` kind to `StaffBidLimitKind`, the payload `limit_kind` enum, the web `KINDS` set and the copy. Suggested copy: "Their approved limit for this sale is £5,000.00." with a next step such as "Take a bid within the limit. To bid higher, their registration limit must be raised first."
  - Or, if the decision is that this path should not exist, reject telephone bids without an active booking at the route, and record that decision.
  - Test it with a registration-limit refusal through `placeTelephoneBid`.

### 2. Tests don't fail without several of the behaviours (medium)
I ran my own mutations. The PR's ten killed mutations are real, but these survived:

| # | Mutation | File |
|---|---|---|
| M2 | Audit a limit refusal on the `replay` branch | `apps/api/src/services/admin/admin-live-bidding-application.service.ts:158` |
| M3 | Audit on a successful paddle bid | same file, after `recordBidPlaced()` |
| M4 | `committedAmount` returns `input.amount`, ignoring `maxAutoBidAmount` | same file `:258`; the paddle validator accepts `maxAutoBidAmount`, `packages/validators/src/paddle.ts:29` |
| W2 | Changing the telephone line doesn't clear the notice | `apps/web/src/features/saleroom/hooks/use-clerk-bid-entry.ts:233` |
| W3 | A quick-amount increment doesn't clear the notice | same file `:246` |
| W5 | A telephone refusal is stored under the `paddle` channel | same file `:322` |
| W6 | The refusal isn't cleared after a later successful bid | same file `:284` / `:332` |
| W8 | The telephone next-step copy is changed | `apps/web/src/features/saleroom/lib/clerk-bid-refusal-copy.ts` |

- **Failure scenario:**
  - A refactor that audits on success, or on replay, would put false "refused" rows in the compliance log, and CI stays green.
  - A paddle bid with a £7,000 maximum refused at a £5,000 paddle cap would be audited as `amount: "6000.00"` with no failing test.
- **Fix:**
  - Assert `publish` is not called on the success and replay tests.
  - Add a refusal test with `maxAutoBidAmount` above `amount`.
  - Add hook tests for clearing on line change, on increment and on success, and for keeping the channel on a telephone refusal.
  - Pin the telephone next-step string.

### 3. The audit is best-effort, not reliable or exactly-once (medium)
- **Where:** `apps/api/src/services/admin/staff-bid-limit-refusal.recorder.ts:64` catches and `console.error`s a failed insert. There is no retry, outbox or metric.
- **Duplicates:** the event carries no request or idempotency key, and `domain_events` has no dedupe index for it.
  - The idempotency executor deletes the key on error (`packages/bidding-runtime/src/bid/idempotent-bid.executor.ts`), so each retry runs the refusal again.
  - A transport retry of the same request (same `Idempotency-Key`) writes a second row. The two rows can't be told apart from two separate clerk attempts.
- **Failure scenario:**
  - A brief database or pool error during a refusal loses the audit row. The only trace is a log line.
  - A proxy retry doubles the row, so "how many times was this bidder refused" is overstated.
- **Fix:**
  - Put the request idempotency key (or a request id) in the payload as `request_key`, so readers can collapse retries. A partial unique index on `(event_type, payload->>'request_key')` would need a migration, numbered after main's latest.
  - On publish failure, increment a counter or alert metric, and enqueue a retry if the codebase has a job queue for this. Otherwise, document in the PR that the audit is best-effort. Keeping the clerk's answer independent of the write is right; only the silent loss is the problem.

### 4. The notice is placed below the form, against FBK-1 (low)
- **Where:** `apps/web/src/features/saleroom/components/clerk-console/lot-on-block-panel.tsx:291`, `:360`.
- **The rule:** `docs/design/staff-design-standard.md` FBK-1 says a Notice goes "above the section it concerns".
- **Today:** the notice sits between the submit button and the quick amounts. In practice it reads well (see screenshots).
- **Fix:** move it above the inputs of its group, or record why this placement is an exception.

### 5. A repeat refusal isn't announced again (low, accessibility)
- **Where:** `apps/web/src/features/saleroom/hooks/use-clerk-bid-entry.ts:269–284`.
- **Failure scenario:** the clerk presses "Place paddle bid" again without changing anything. A second refusal and a second audit row happen. But the `role="alert"` node stays mounted with the same text, so screen readers say nothing. There is no visible change either, and `pending` toggles silently.
- **Fix:** clear `limitRefusal` when a new placement starts (`setLimitRefusal(null)` before the request), so the alert is re-inserted. Alternatively, key the Notice on an attempt counter.

### 6. The organisation limit and room are shown to the clerk (low, needs an owner decision)
- The `organisation` refusal gives the clerk the organisation's private bidding limit. The room left also reveals its open exposure across other lots and sales.
- No staff screen exposes organisation limits today: no admin route reads `organisation_bidding_limits`.
- This is the bidder's own data, and the clerk is speaking for that bidder, so I don't consider it a leak to a third party. It is still a new staff visibility.
- **Fix:** get an owner sign-off in the PR. Alternatively, show the room without the organisation's total ("They can bid up to £5,200.00 on this lot").

### 7. Copy, evidence and PR hygiene (nits)
- The refusal copy is in a new `clerk-bid-refusal-copy.ts`, while the console's copy file is `apps/web/src/features/saleroom/lib/clerk-command-copy.ts`. Consider moving the static strings there, or say why they're separate.
- No e2e test covers the UI change. Unit and render tests cover rendering, but nothing drives the console end to end against a 403 with `refusal`. Add a Playwright case on the clerk console (mock the BFF response) that checks the alert text and that no toast appears.
- In the PR body's screenshot table, the "Account limit" rows are broken markup (`&lt;img src="`` …`` "`). Those four images don't render on GitHub.
