Verdict: FIX FIRST

Independent money review of PR #1455 ("Courier delivery in payment: staff courier refund, invoice-refund finance task, paid-with-invoice marker"), head `eeaee18c`, against `origin/main` `70ceb4c4`. Background read: #1118 (delivery in the payment, flag off) and #1265 (refund attribution by `metadata.deliveryQuoteId`, per-invoice and per-quote caps).

One blocking finding (1). The rest are non-blocking.

## Findings

1. **BLOCKING: two concurrent courier refunds with different amounts can both go through and refund more than the courier charge.** `apps/api/src/services/payment-group/payment-group-delivery-refund.service.ts:82-134`. The remaining amount is worked out under the group lock (`:82`) and from Stripe's refund list (`:100`), but the lock is released before Stripe is called, and nothing is reserved in between. The Stripe idempotency key (`apps/api/src/services/stripe/stripe-payment-gateway.ts:137`) includes the amount, and the web action sends a new `Idempotency-Key` on every submit (`apps/web/src/lib/actions/admin/admin-group-delivery-refund.ts:68`). So two requests at the same time with different amounts (for example one "rest of the charge" and one partial) get different keys and both reach Stripe. A local probe against the service with a £180.00 courier charge gave two refunds and £230.00 refunded. Identical requests (a double click with the same values) are safe because they share a Stripe key. The seller ledger is still safe in that case: #1265's webhook caps the quote and reports the excess as unattributed. But the money still goes back to the buyer, and the PR description says two staff members cannot refund the courier twice. Suggested fix (either is enough): (a) build the delivery-refund Stripe key from the quote and `sequence` only, without the amount, so concurrent requests at the same refunded level collide and Stripe rejects the second because its parameters differ; or (b) record a pending refund row or take an advisory lock per quote that is held across the Stripe call. Add a test where two calls run at once with different amounts.

2. Non-blocking: the audit event is written only after Stripe succeeds, outside any transaction (`payment-group-delivery-refund.service.ts:150`). If that write fails, the refund has gone out but the request returns an error and there is no `payment_group.delivery_refund_requested` row. A retry will not refund twice (Stripe lists the refund, so the remaining amount is 0), but the staff reason is lost. A refused attempt (`:143`) is not audited either. Consider writing the request event before calling Stripe and its result after, or recording both outcomes.

3. Non-blocking: after Stripe returns a `failed` or `canceled` refund, retrying the same amount within Stripe's idempotency window replays the same failed refund, because the key and `sequence` have not changed (`:134`). Staff get a 502 until they change the amount. Recovery stays safe, but the error should say what to do, or `sequence` should take the failed refund into account.

4. Non-blocking: F2 task lifecycle. The task is recorded on the group charge (`payment-group-charge-events.ts:202`). If the whole charge is later refunded, `unapplied-money-refund.handler.ts:59-60` closes every open task on that charge. Whether the F2 task is open at that moment depends on which webhook handler runs first for the same event. That outcome is acceptable (everything went back), but it is not covered by a test, and the go-live runbook should mention it.

5. Non-blocking: F2 opens one task for each increase in an invoice's refunded total (key `<paymentId>:<pence>`), not one per Stripe refund object. Two partial refunds of one invoice open two tasks, and a replayed or unrelated event (such as a courier refund) opens none. This matches the PR description and the integration test, but finance should know that the amount on each task is the running total, not the increase.

## Checklist results

- **Flag default stays OFF:** yes. `DELIVERY_IN_PAYMENT_ENABLED` is `default(false)` in `apps/api/src/env.ts:174` and is not touched by the diff. The refund action is intentionally not gated on the flag.
- **Courier refund never touches the seller ledger or the invoice cap:** yes, on the path this PR takes. The Stripe refund carries `metadata.deliveryQuoteId` and never `paymentId`. The integration test checks that the seller payout lines are unchanged, that both invoices' refunded totals are 0 and still `captured`, and that the quote's refunded total is raised.
  - Mutation 1: removing `deliveryQuoteId` from the `createRefund` call fails the unit test and the integration test.
  - Mutation 2: same change, with the test's call-shape assertion also removed. The integration test still fails, on the quote's refunded total (0 instead of 18000).
  - With no attribution, the seller-ledger assertions still passed, because #1265's webhook treats an unattributed refund on a delivery group as unattributed and never spreads it to invoices. That is defence in depth, not a gap.
- **Refund cannot exceed the delivery amount paid:** holds for a single request. The limit is the charged amount minus max(webhook total, Stripe succeeded and pending refunds), and the amount must be a positive whole number of pence. It does not hold for concurrent requests (finding 1).
- **Idempotency on retry or double click:** safe for identical requests through the deterministic Stripe key (quote, amount, sequence) and the `Idempotency-Key` route guard. Not safe across different amounts (finding 1).
- **Step-up, permission, audit:** the route uses `requirePaymentManualReviewWrite`, `guards.requireStepUp` and `guards.idempotent`, and is listed in `DANGEROUS_STAFF_ACTIONS` (the drift test passes). The service also checks `finance.platform.write`, the same way the blocked-capture refund does. A reason is required and kept on the audit event, and the PII allowlist is updated. See finding 2 for a gap in the audit trail.
- **F2 task exactly once per invoice-refund increase:** yes. It is deduplicated by `unappliedMoneyDedupeKey` under a key lock and a unique index, and a replayed event opens none (integration test). See findings 4 and 5.
- **F3 marker cannot be spoofed:** yes. It is read on the server from `payment_group_delivery` joined to a `paid` `payment_group` (`DrizzleDeliveryPaidWithInvoiceReader`), and no client input feeds it. The refund action re-checks group, quote and status on the server.
- **Concurrency (two staff at once):** not safe. See finding 1.
- **Migration:** none in this PR, so no journal or rollback changes are needed.
- **Unrelated payment paths:** the only change in a shared path is the F2 block in `PaymentGroupChargeEvents`, which runs only when the group has deliveries. The gateway key logic is unchanged (it came in #1265). Buyer and invoice refund paths are untouched.

## Verification run

Run on a clean worktree of the PR head.

- Setup: `pnpm install --frozen-lockfile`, then `pnpm -r --filter './packages/**' build`. Throwaway Postgres 16 on port 55432, with `db:migrate` and `db:roles` applied.
- Tests (vitest, `--maxWorkers=2`), all passing:
  - api, affected areas (payment-group, payment, stripe-webhook, admin routes and drift, lot fulfilment, webhook duplicate delivery): 52 files, 984 tests. The DB-backed integration tests ran rather than being skipped.
  - web, admin and lot fulfilment: 1729 tests.
  - domain, unapplied-money: 17 tests.
  - persistence, payment-group repository integration: 26 tests.
  - worker, notification fanout: 42 tests.
  - types: 332 tests.
- Typecheck: `tsc --noEmit` passes for api, worker, persistence, domain, types and validators. apps/web passes once the api package is built (its types import `@auction/api/app`).
- Biome: `biome check` on the changed files is clean.
- CI (REST check-runs on `eeaee18c`): 39 succeeded, 1 skipped (`art-browser-gates`), none failed.
- The PR branch was not modified. The mutation and concurrency probes were local and were reverted.
