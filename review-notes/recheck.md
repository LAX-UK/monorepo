# Re-check: PR #1349 — money and security, after the F1–F13 fixes

- Branch checked: `sc3-staff-screens` at `ddb25c95`. Because #1352 (payout lock order, group refunds, disputes) landed on `main` (`f920064b`) after the branch last merged `main`, everything below was run on a **local merge of `ddb25c95` with `main` `f920064b`** (not pushed), so the lock order is checked against the code that will actually run together.
- Date: 2026-11-13. No product code was changed or pushed; extra tests were written locally only and are described here.
- The fix table was not taken on trust: each claim below was checked against the code, and the key guards were mutation-tested (reverted, a test seen to fail, restored).

## What was run

| Check | Result |
|---|---|
| `pnpm install --frozen-lockfile`, `pnpm -r --filter './packages/**' build` | pass (after resolving the merge, see N3) |
| Throwaway Postgres 16 (port 55432), `db:migrate`, `db:roles` | pass |
| Role contracts with real role connections: api_app 20, worker_app 38, auth_app 6, shop_app 13 | pass |
| `lint:layers`, `lint:deps`, `lint:seller-commission`, `lint:admin-capability-drift`, `biome check .` | pass |
| `tsc --noEmit` api, persistence | pass |
| finance-runtime `src/payout` (9 files, 66 tests) | pass |
| API seller-proceeds services + routes; payout service + payout routes; payout services + dangerous-action registry; disputes + payment-group (#1352) | pass (87 / 123 / 107 / 154 tests) |
| Postgres integration: record-agreement concurrency (4), record-agreement (1), reprice guard (3), staff reader (1), #1352 payout lock order (3), payment lock order (1), cross-seller lock (1), negative clawback (3) | pass |
| Web: seller-proceeds VMs, finance actions, settlement workspace (28 files, 223 tests) | pass |
| Tests run in batches with `--maxWorkers=2` | — |

### Extra tests written for this re-check (local only)

On committed Postgres transactions, with the services connected **as `api_app`** (fixtures seeded as the owner), so every new lock and table use was exercised under the real grants:

1. **Lock-order stress, 12 rounds:** at once — recording an agreement on seller A's held sale; a confirmed payout run for A; a transaction taking the #1352 group-refund/dispute lock sequence over payments of A and B (payments in id order, then `lockOpenPayoutsForEntities` for both sellers); a run for B; a second run for A. Order of start alternated each round. Result: no deadlock, no error, every sale has exactly one sale line, every payout's stored gross equals its lines.
2. Preview, then a held sale is released by recording, then confirm with the old figures → `figures_changed`, no payout. A fresh preview then confirms and the payout's net equals the confirmed net.
3. Three confirms of the same preview at once → one payout; the other two `figures_changed`; each sale paid once.
4. Confirm with a subset of the sales, a net off by 1p, a duplicated id, or an unknown deal → each refused, nothing stored.
5. An Administrator replaces a priced, unpaid sale's agreement (15% → 30%) → outcome `already_priced`; the run pays the snapshot net, unchanged.
6. Three simultaneous "settled outside LAX" marks on one sale → one audit event, two 409 `already_settled_outside`.
7. A part-refunded sale (three ledger states): preview, then a confirmed run accepts the preview and pays exactly its net.
8. A run with no `confirmed` still pays what is ready (see N1).

### Mutation testing

| Mutation | Killed? |
|---|---|
| Recording takes the seller's settlement lock **after** the payment / seller-terms locks | killed — the stress test hits real deadlocks (SQLSTATE 40P01, 10 errors); also the PR's order unit test and its "recording goes first" race test |
| Drop the confirmed-figures check in `createSettlementCore` | killed (3 PR unit tests, 2 of the re-check tests) |
| Drop only the net comparison in `matchesConfirmed` | killed (1 unit test) |
| `figures_changed` → `no_pending_payments` when everything confirmed was already paid | killed |
| Drop only the **payment-ids** comparison in `matchesConfirmed` | **survived** in the PR's tests — see N2 |
| Drop only the **deal-ids** comparison in `matchesConfirmed` | **survived** in the PR's tests — see N2 |
| Drop `basis = 'held'` in `repriceHeld` (persistence rebuilt) | killed (2 of 3 reprice-guard tests) |
| Drop the in-transaction "already on record" check / Administrator check / document claim | killed (3 / 2 / 3 tests) |
| Signed PDF route: drop `requireSellerAgreementRecord` / drop `no-store` / sign a non-active upload / 1-hour link | killed (2 / 3 / 1 / 1) |
| Remove `signed_consignment_agreement` from `MALWARE_SCAN_KINDS` | killed |
| Settled outside: drop the payment lock / drop the re-read under the lock | killed (PR unit test and the re-check Postgres race) |

## Original findings, checked again

| # | Claim | Verified? |
|---|---|---|
| F1 | `lint:layers` green | Yes, on the merged tree. |
| F2 | Preview equals the run; confirm bound to `{ netPence, paymentIds, dealIds }`; 409 `figures_changed` with nothing stored | **Mostly.** The preview reads deals through the run's own store and charges part refunds with the run's own `refundBeforePayout`; totals are integer pence; the binding is checked under the run's locks before any payout row is written; refusal returns before `create`. Idempotency only caches 2xx and fingerprints the body, so a retry after `figures_changed` with a new key is not answered from the refusal, and a double submit of a success is answered from the cache. Gaps: **N1** (binding is optional), **N2** (two of the three comparisons untested), **N4** (a refused run still commits snapshot writes). |
| F3 | Lock order advisory → lot → payment + seller terms → agreement, same as the run and #1352 | **Yes.** The payout run is advisory → payments (id order) → seller-terms writes → new payout and lines. Group refunds, refund repair and disputes (#1352) take payments in id order, then open payouts by legal entity and id; they never take the advisory lock, the seller-terms row, the agreement row or the upload row. Recording takes one payment after the advisory lock and never touches payouts. Settled-outside takes one payment row only. Seller acceptance and proposal update the agreement row in one statement, guarded by `accepted_at is null`. No path takes these rows in the opposite order, and the stress test plus mutation confirm it on real transactions. The unique-index race maps to 409. |
| F4 | Snapshot rate never recomputed from a corrected agreement | **Yes.** A priced snapshot is returned as stored by `SettlementSellerTerms.plan`, the store only updates `basis = 'held'` rows, and the re-check test shows a 15% → 30% correction leaves the payout at the snapshot net. The "earlier version" flag compares the snapshot with the row. Versioning is deferred, as stated. |
| F5 | Store guard tested directly | Yes (mutation killed). |
| F6 | Signed PDF: permission, `no-store`, the agreement's own active PDF only, 60 s link, malware scan, one PDF per agreement | **Yes.** `requireSellerAgreementRecord` on the route, `Cache-Control: no-store`, the service signs only `agreement.signedDocumentId` and only when it is the agreement kind and `active` (which, for this kind, now comes after the malware scan when a scanner is configured), 60 s TTL, web redirect with `no-referrer` and `no-store`. The upload row is locked and a PDF already used by another consignment's agreement is refused. All mutations killed. |
| F7–F11, F13 | Toast wording, single totals source, export, cookie, axe, `signedOn` bounds | Spot-checked in code and tests; tests pass. |
| F12 | Double "settled outside" refused under lock | **Yes**, on real transactions (re-check test 6, mutations killed). See N5 for a separate gap. |

## New findings

### N1 — Medium — The confirmed-figures binding is optional on the server
`runSettlementSchema.confirmed` is `.optional()` and `createSettlementCore` only checks figures when `confirmed` is present. The web action builds it with `confirmedFrom(formData)`, which returns `undefined` for an empty or unreadable field instead of refusing, and the request is then sent without it. Any request to `POST /admin/payouts/run-settlement` without `confirmed` pays whatever is ready at that moment, unbound — the behaviour F2 was meant to remove ("no way to confirm stale figures"). Re-check test 8 shows an unbound run paying. The shipped dialog does send `confirmed` whenever the button is enabled, so this is not reachable through the normal screen today, but the server does not enforce it. The route is staff-only with step-up, and the nightly bulk run calls `createSettlement` directly, not this route.
Fix: make `confirmed` required in `runSettlementSchema` (or in the route), add a route test that a body without it is a 400, and have `runPayoutSettlementAction` refuse without calling the API when the field is missing or not valid JSON.

### N2 — Low — Two of the three confirmed-figures comparisons are untested
Removing the `paymentIds` comparison, or the `dealIds` comparison, from `matchesConfirmed` leaves every test green; only the net comparison is pinned. Those comparisons are what stop the run paying a different set of sales or deals that happens to add up to the same net (for example, one sale paid elsewhere while another of equal net became ready).
Fix: unit tests in `settlement-confirmed.test.ts` where the net is the same but one payment id, or one deal id, differs, each expecting `figures_changed`.

### N3 — Low — The branch conflicts with `main` after #1352
Merging `main` (`f920064b`) into `ddb25c95` conflicts in `packages/persistence/src/repositories/drizzle-payout.repository.ts` (this PR's `settlementLockSql` and #1352's `payoutTakesLinesSql` are inserted at the same place) and in `packages/validators/src/index.ts`. Keeping both sides in each file builds, passes the lints and every test above. Merge `main` into the branch and re-run the lock-order integration tests on the result before merging.

### N4 — Low — A refused confirmed run still commits snapshot writes
`createSettlementCore` calls `sellerTerms.forRun` for every pending sale (which stores a snapshot for a pre-snapshot payment and re-prices a held sale whose facts are now in place), and `lockPendingPayments` runs the refund backfill, before the figures check. On `figures_changed` the function returns rather than throws, so the transaction commits those writes. No payout, line or event is stored and no money moves; the stored pricing is what the next run would store anyway (and the backfill makes the next preview agree). But "nothing stored" is not literally true, and a sale re-priced this way has no audit event until it is paid.
Fix: either say so in the comment and PR, or check the figures from `forPreview` before calling `forRun`, or throw a typed error inside the transaction on `figures_changed` so it rolls back, and map it to the same 409.

### N5 — Low — "Settled outside LAX" and the payout run do not know about each other
The mark is only offered for an ATG-sold lot that has a LAX payment row (`facts.sale`), but the payout run's `awaitingSettlement()` has no ATG or "settled outside" exclusion, and the mark does not refuse a sale that is already on a LAX payout. The ATG runbook says ATG winners never get a LAX checkout, so this needs a captured LAX payment on an ATG lot to matter; if one ever exists, the seller could be paid by hand and by the run.
Fix: refuse the mark when the sale is already on a payout or is captured and waiting for a run, or exclude marked (or ATG-sold) lots from `awaitingSettlement()`; add a test either way.

### N6 — Nit — A confirmed run can still pay less than it confirmed if a sale line is skipped
After the figures check, `tryInsertSaleLine` may skip a sale that "another run paid first", and the payout totals are then lowered rather than the run refused. Under the per-seller advisory lock this cannot happen, so it is not a live bug, but with `confirmed` set the run would no longer pay "exactly this or nothing". Throwing (and rolling back) when `confirmed` is set and fewer lines were inserted than expected would keep the promise.

## Grants

Every lock and table the new code uses was exercised as `api_app` on real transactions: the per-seller advisory lock, `payment` FOR UPDATE, `sale_seller_terms` FOR UPDATE and update (column-level UPDATE on the priced columns covers both), `consignment_agreement` FOR UPDATE / insert / update, `upload_object` FOR UPDATE, `domain_events` insert and read (settled-outside check), payout and payout-line writes. `worker_app` already has `upload_object` for the malware-scan change and runs nothing else new. `shop_app` and `auth_app` gain no new uses. No migration was added.

## Severity

| # | Severity | Area | Blocking? |
|---|---|---|---|
| N1 | Medium | Settlement confirm binding is optional server-side | Yes — small change, and it is the F2 promise |
| N2 | Low | Tests for the payment/deal id comparisons | No, but cheap with N1 |
| N3 | Low | Merge conflict with `main` (#1352) | Must be resolved to merge |
| N4 | Low | Refused run commits snapshot writes | No |
| N5 | Low | Settled-outside not excluded from the run | No |
| N6 | Nit | Skipped line under a confirmed run | No |

F1–F13: verified as fixed (F2 subject to N1/N2/N4). Lock order is consistent across the payout run, recording, settled-outside and #1352's group-refund, refund-repair and dispute paths; no deadlock was found under real concurrent transactions, and reordering the recording's locks does produce deadlocks, so the test would catch a regression.

### Verdict: FIX FIRST

## Fixes after re-check

- Branch `sc3-staff-screens`, pushed as a fast-forward from `3a3c01a3` to `5f4f7eb5` (no force-push, no rebase). `3a3c01a3` is `ddb25c95` plus one test-only commit.
- Everything was run on the pushed tree: `pnpm install --frozen-lockfile`, `pnpm -r --filter './packages/**' build`, throwaway Postgres 16 on port 55432 with `db:migrate` and `db:roles`. Tests were run in small batches with `--maxWorkers=2`.
- No migration and no grant change. UI is unchanged: the web action reuses the dialog's existing "figures changed" outcome.

| # | Commit | Change | Test evidence | Mutation |
|---|---|---|---|---|
| N3 | `b89911bb` Merge origin/main into sc3-staff-screens | Both conflicts resolved by keeping both sides: `settlementLockSql` (exported) and `payoutTakesLinesSql` in `drizzle-payout.repository.ts`, and both `signed-agreement.js` and `buyer-premium-wording.js` exports in `validators/src/index.ts`. | On the merged tree: #1352 payout lock order (3), payment lock order (1), cross-seller lock (1), negative clawback (3); #1349 record-agreement concurrency and record-agreement, payout seller terms, reprice guard (3), staff reader (1). All pass: api 28 tests, persistence 8 tests. | n/a (merge) |
| N1 | `7276d6da` Require confirmed figures for a staff settlement run | `runSettlementSchema.confirmed` is now required, so `POST /admin/payouts/run-settlement` answers 400 `validation_failed` without it, and the route always passes it on. `runPayoutSettlementAction` returns `{ error: "figures_changed" }` and does not call the API when the field is missing, empty, not JSON, or not a JSON object. The nightly run calls `createSettlement` / `runBulkSettlement[WithTransfers]` directly and is not affected. | Route: 4 new cases (no `confirmed`, `confirmed` without `dealIds`, a fractional net, `null`), each 400 with `createSettlement` never called. The existing route tests now send `confirmed` and assert it is passed on (73 pass). Web: 5 new cases (missing, empty, not JSON, `42`, `null`), each refused with no fetch (17 pass). Nightly: `settlement-confirmed-rollback.test.ts` has `runBulkSettlement` with no `confirmed` creating and committing a payout, and still paying the rest when a line is skipped. | Schema back to `.optional()`: **killed** (route test "without confirmed figures"). Web guard removed: **killed** (5 tests). |
| N2 | `97a01891` Test the payment-id and deal-id comparisons of a confirmed run | Tests only. | `settlement-confirmed.test.ts`: same net with one payment id different (p2 swapped for p3 with identical amounts; the test asserts the nets are equal) → `figures_changed`, nothing created. Same net with one deal id different → `figures_changed`. A direct `matchesConfirmed` test checks net, payment ids and deal ids one at a time. | Drop the payment-ids comparison: **killed** (2 tests). Drop the deal-ids comparison: **killed** (2 tests). |
| N4 | `bb47eb1b` Roll back a refused confirmed payout run | New `SettlementFiguresChangedError`. `createSettlement` throws it inside the transaction on any `figures_changed`, so the transaction rolls back, then catches it outside and returns the same `{ ok: false, reason: "figures_changed" }`, which is still a 409. Other errors are rethrown. | New Postgres test `payout-confirmed-rollback.integration.test.ts`: a pre-snapshot sale and a held sale whose agreement was then recorded; a stale confirm is refused, and afterwards there is no snapshot row for the old payment, the held row is still `held`/`no_agreement`, and there is no payout and no event. A fresh confirm then pays, and only then is the snapshot stored. Unit test: the runner sees `rolled_back`, `create` is never called, nothing is published. | Throw replaced with `return result`: **killed** (integration test: snapshot row present). |
| N6 | `bb47eb1b` (same commit) | In `createSettlementCore`, when `confirmed` is set and fewer lines are inserted than expected, it throws `SettlementFiguresChangedError`, which rolls back and becomes the same 409. Unconfirmed runs still lower their totals as before. | `settlement-confirmed.test.ts`: a confirmed run whose p2 line is skipped rejects with the typed error and never calls `updateTotals`; an unconfirmed run still lowers its totals. `settlement-confirmed-rollback.test.ts`: through `createSettlement`, the runner sees `rolled_back` and the result is `figures_changed` with nothing published. | Throw removed: **killed** (1 test). |
| N5 | `5f4f7eb5` Keep settled-outside sales and payout runs apart | `MarkSettledOutsideService` refuses with 409 `sale_on_lax_payout` when the sale is on a LAX payout, and with `sale_awaiting_lax_payout` when it is captured and waiting for a run (LAX's own stock excepted). The check runs before the lock and again under the payment row lock. `awaitingSettlement()` now also excludes a payment whose lot has a `lot.seller_settled_outside_lax` event, so the run does not list, lock or pay it. The web action already shows the API's message. | Service unit tests: on a scheduled payout and on a paid payout → `sale_on_lax_payout`; captured and waiting → `sale_awaiting_lax_payout`; captured during the lock wait → refused under the lock; LAX-owned captured, pending, authorized and refunded → marked (14 pass). New Postgres test `drizzle-payout.settled-outside.integration.test.ts`: `findUnlinkedCapturedPayments` and `lockPendingPayments` return only the unmarked sale, and a seller with only marked sales is left out of `listLegalEntityIdsWithUnlinkedCapturedPayments`. The new predicate was run with `FOR UPDATE` as `api_app` and as `worker_app`, and both have SELECT on `domain_events`. | Exclusion SQL removed: **killed** (integration test). Payout check removed: **killed** (2). Captured check removed: **killed** (2). Re-check under the lock removed: **killed** (1). |

### Checks on the pushed tree

| Check | Result |
|---|---|
| `lint:layers`, `lint:deps`, `lint:seller-commission`, `lint:admin-capability-drift` | pass |
| `biome check .` | pass |
| `tsc --noEmit`: api, web, worker, finance-runtime, persistence, validators | pass |
| finance-runtime `src/payout` | 10 files, 76 tests, pass |
| API payout services and integration (13 files, 91), payout routes (4 files, 99), seller-proceeds services and routes, including the record-agreement concurrency integration (7 files, 88), admin payout application and dangerous actions (3 files, 11), disputes and payment group from #1352 (13 files, 154) | pass |
| Persistence integration: payout lock order, payment lock order, reprice guard, staff reader, settled-outside exclusion | 5 files, 9 tests, pass |
| Web finance, seller proceeds and settlement workspace | 28 files, 228 tests, pass |
| Worker finance; worker role contracts run as `worker_app` | pass (446 role-contract tests) |
| `git log --format='%an %ae' origin/main..HEAD` | only `mahmoudamrspace` |
