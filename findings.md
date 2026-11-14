# Verification of 11-05 re-review findings (PRs #1037, #1038, #1041, #1042)

Read-only check against `origin/main` @ f1ffc6e4 (2026-11-14). No code changed.

| Item | Status | Evidence |
|---|---|---|
| a | FIXED | `apps/api/src/services/payment/unapplied-money-handling.service.ts:69` refuses (409) to close `paid_not_recorded` / `invoice_cancelled` (`packages/domain/src/unapplied-money.ts:80`) unless the invoice is `captured`/`refunded`. Test: `unapplied-money-handling.service.test.ts:73` "refuses to close %s money while its invoice is %s". Residual: the guard is skipped when the task has no `paymentId` or the invoice row is not found (see Still open). |
| b | FIXED | `apps/api/src/services/stripe-webhook/unapplied-money-refund.handler.ts:35-38`: any charge ever reported as unapplied (`wasEverUnapplied`, open or closed) is kept off the invoice path unless a captured/refunded invoice owns it. `checkout-refund-handlers.ts:27-39` (`isInvoiceMoney`): no charge id -> compare payment intent; neither -> not the invoice's money. Tests: `unapplied-money.recorder.test.ts:330`, `unapplied-money-refunds.integration.test.ts:280`. |
| c | FIXED | `packages/finance-runtime/src/unapplied-money.recorder.ts:78-92`: per-customer lock, then earlier open balance tasks of that currency are closed `via: "superseded"`. Test: `unapplied-money.recorder.test.ts:170`. |
| d | FIXED (reworked) | `apps/api/src/services/stripe/stripe-checkout-session-lifecycle.ts:25-41` key = rail + payment + sha256 fingerprint of parameters + count of sessions for that fingerprint; `closeSuperseded` (`:404`) closes earlier same-rail sessions after the new one is settled; mismatch is now reported and opened under a unique key (`:369`). Persisted fingerprint column: migration 0351. Landed in the squash of #1324. Tests: `stripe-checkout-session-lifecycle.test.ts:65,74,83,154,172`. |
| e | FIXED | `packages/persistence/src/repositories/drizzle-stale-payment-canceller.ts:21` `now()` from Postgres, used by `stale-payment-store.ts:51`; single-statement guarded cancel `:56`. Tests: `stale-payment-expiry.test.ts:73` (database clock), `drizzle-stale-payment-canceller.integration.test.ts:93-125` (runs in CI `test --affected` with DATABASE_URL). |
| f | FIXED | `unapplied-money.recorder.ts:75-76`: `pg_advisory_xact_lock(hashtext('unapplied:'+key))` (`drizzle-unapplied-money.reader.ts:89`) then existence check inside the tx. Test: `unapplied-money.recorder.test.ts:160`. No DB unique index (lock-based only). |
| g | FIXED | Guard: `unapplied-money.recorder.test.ts:314` (charge of a paid invoice returns to invoice path though `wasEverUnapplied` is true) + `unapplied-money-refunds.integration.test.ts:215`. Per-event key: `stripe-payment-webhook.service.test.ts:974` asserts `stripeEventId: "evt_cash:gbp"`. Cancel SQL: `drizzle-stale-payment-canceller.integration.test.ts:93-125`. |
| h | FIXED | Hold closes Stripe checkouts: `packages/finance-runtime/src/payment-expiry/held-invoice-checkouts.ts:35` (`close`) called when the hold is seen (`apps/api/src/services/payment/create-pending-for-winner.pipeline.ts:63,123`) and swept on every expiry pass in API and worker (`apps/api/src/container/create-stale-payment-expiry.ts:78`, `apps/worker/src/finance/create-worker-stale-payment-expiry.ts:93`). Capture for a held/closed account goes to `requires_manual_review` (`apps/api/src/services/stripe-webhook/payment-intent-succeeded.handler.ts:43,143-185`); Pay several checks eligibility at settlement (`payment-group-settlement.service.ts:231`). Tests: `payments.organisation-checkout.routes.test.ts:147`, `held-invoice-checkouts.test.ts`, `stripe-payment-webhook.service.test.ts:641` (it.each held/closed), `payment-admin-ops.release.test.ts`. Residuals in Still open. |
| i | FIXED | `packages/finance-runtime/src/payment-eligibility.gate.ts:51` returns `unverified` (held) when no identity provider and `identityRequired`; wired as `NODE_ENV === "production"` in `apps/api/src/container/create-payments-services.ts:343` and `apps/worker/src/finance/create-worker-stale-payment-expiry.ts:59`. Test: `apps/api/src/services/payment/payment-eligibility.gate.test.ts:53`. Holds rather than refusing to start. |
| j | FIXED | `packages/domain/src/payment-reminder.test.ts:53-87`: winter, summer (08:00 UTC), 29 Mar 2026 spring-forward and 25 Oct 2026 fall-back cases. |
| k | checking | |
| l | checking | |
| m | checking | |
| n | checking | |
| o | checking | |
| p | checking | |
| q | checking | |
