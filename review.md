# Review of #1372 — Payments: close the small gaps from the re-review check

Independent money and security review. Head reviewed: `61630cc5` (`fix/payment-hardening`), base `main` `f1ffc6e4`. I checked everything on the branch head and did not rely on the PR body. Nothing was pushed to the PR branch and nothing was posted on the PR. I made no Stripe API calls; Stripe was faked in tests. Infra was read only (`auction-infra` at `4516a63`).

## What was run
- `corepack enable && pnpm install --frozen-lockfile && pnpm -r --filter './packages/**' build`: OK.
- Throwaway PG 16.15 (initdb under `/var/tmp`, port 55432): `db:migrate` and `db:roles` OK. 0383 applied. The ledger's max `created_at` is 1811246400000 (0383). In the journal, idx 375 / `when` 1811246400000 comes straight after main's last entry, 0382 (idx 374, 1811160000000). No numbering clash with main.
- Tests, `--maxWorkers=2`, against PG 16:
  - db 0383/0316 (13 tests) and main-upgrade (23).
  - persistence canceller and unapplied reader integration tests (12).
  - finance-runtime, full (242).
  - worker `src/finance` (111).
  - api payment, stripe, stripe-webhook, payment-group, container and payments-route suites (316 + 715).
  - All green. Note: the 0383 PG test needs `MIGRATION_TEST_DATABASE_URL` to point at an already-migrated database. Pointed at an empty one, it fails in `beforeAll` and its tests are reported as skipped.
- Real concurrent transactions (two `pg` clients) on the 0383 index:
  - Two raw writers with the same key: the second blocks until the first commits, then gets 23505.
  - Two recorder-style writers (advisory lock plus exists check): one row is written and the second skips.
  - First writer rolls back: the second inserts, so no event is lost.
  - `payment.unapplied_money_resolved` rows can still share a key.
- Migration operations on PG 16:
  - The duplicate pre-check refuses with its message.
  - Behind an open writer on `domain_events`, the build stops after 5.04 s on `lock_timeout`.
  - `0383_rollback.sql` drops the index and the ledger row, and a re-run of `db:migrate` reapplies it.
- Session close race on PG 16: a scratch integration test (deleted afterwards) used the real `DrizzlePaymentCheckoutSessionRepository`, a fake Stripe whose expire mirrors the real gateway, and concurrent tabs. 10 rounds of card(new) and bank(new) opened at the same time: each kept its session and the old-amount card session was expired. A buyer completing the old card session during the close: see F3.
- Mutation tests. I reverted each guard myself, ran the tests, then restored it:

| Mutation | Result |
|---|---|
| a1 missing-invoice guard off | 4 fail |
| a2 guard applied to every reason | 1 fail ("still closes other reasons") |
| b1 no-ids branch returns true | 1 fail |
| **b2 `if (!row.everCaptured) return false` removed** | **0 fail in 782 refund/webhook/payment tests** (F5) |
| b3 handler drops the payment intent | 1 fail |
| d1 stale-card rule off | 3 fail |
| d2 bank-with-intent exception off | 1 fail |
| d3 no stop at the kept session | 1 fail |
| d4 rail fingerprint instead of invoice fingerprint | 2 fail |
| d5 closes complete sessions | 1 fail |
| f1 pre-check removed | 4 fail |
| f2 non-unique index | 3 fail |
| f3 lock_timeout removed | 1 fail |
| f4 wrong event in predicate | 3 fail |
| h1 webhook captures with no gate | 1 fail |
| **h2 container wires `paymentEligibilityRequired: false`** | **0 fail** (F6) |
| h3 members ignored | 1 fail |
| h4 unknown payer kept | 1 fail |
| h5 `processing` groups listed | 1 fail (PG) |
| **h6 member list not filtered to unpaid** | **0 fail** (F6) |
| i1 APP_ENV ignored | 2 fail |
| i2 live key ignored | 3 fail |
| i3 `test` treated as live | 2 fail |

## Item-by-item verification
- **(a)** OK. `CLOSED_BY_SETTLEMENT` is exactly `paid_not_recorded` and `invoice_cancelled` (`packages/domain/src/unapplied-money.ts:80`). A missing id or an unreadable invoice now returns 409. Other reasons are unchanged (mutation a2 is caught).
- **(b)** `isInvoiceMoney` is fail-safe. A staff-marked invoice with no ids owns no charge, and a never-captured invoice owns none either. The new intent match in `wasEverUnapplied` opens one routing regression (F1). Old rows: `everCaptured` is always computed by SQL from a `payment.captured` event, so production never saw `undefined` and nothing changes for old rows in this PR (see F9).
- **(d)** OK as designed:
  - Only sessions recorded before the settled one are touched. `listSessions` orders by `(created_at, stripe_session_id)`, so tabs agree on the order. Under a commit-order race, the failure is leaving a session open, never closing a live one.
  - A bank session with instructions is never closed.
  - A session that completes after Stripe's own read is refused by Stripe and reported, not closed.
  - Residual: F3 (ledger) and F4 (fingerprint stability).
- **(f)** OK. Partial unique index, duplicate DO-block, `SET LOCAL lock_timeout`, rollback in `BEGIN/COMMIT`, journal and stamp all checked. Grants unchanged. The recorder's lock key and the index key are the same `dedupeKey`, so recorders cannot collide (shown above). The shop-api writer locks `shop-session:<id>`, but its reasons are shop-only and the key is prefixed with the reason, so its keys cannot equal the recorder's. A 23505 from a writer outside the lock aborts the webhook transaction, including its processed-event claim. Stripe then retries once, and the retry finds the row and skips. That is not a retry storm and no event is lost (F7).
- **(h)**
  - The group sweep lists only `status = 'open'`, so `processing` is never listed (mutation h5 caught).
  - Closing expires the session or cancels an unfunded intent. `GroupPaymentReleasedHandler` (session expired / intent cancelled) releases the group. A part-funded or processing intent is left alone.
  - The webhook returns `finance_release_required` when no gate is wired and the flag is set.
  - Residuals: F2, F6, F8.
- **(i)** `paymentsAreLive` cannot be false in prod:
  - `auction-infra/terraform/ephemeral/prod/main.tf:85-86` (`common_secret_env`, used by api) and `:411-412` (worker) set both `NODE_ENV=production` and `APP_ENV=production`. `docker-compose.prod.yml` sets them for api and worker too.
  - Local and test runs (`NODE_ENV` development/test, `sk_test_`) stay not-live (i3 caught), so dev flows are unchanged.
  - The ephemeral test stack (`NODE_ENV=production`, `APP_ENV=test`) counts as live, the same as on main.
  - Prod worker env: see F2.

## Findings

### F1 — Medium — An invoice's own refund can be routed to the unapplied path (regression from the intent match)
`UnappliedMoneyRefundHandler.handle` first asks `isChargeOfPaidInvoice(charge.id)`, which matches `payment.stripe_charge_id` only (`drizzle-unapplied-money.reader.ts:99-111`). It then asks `wasEverUnapplied({ chargeId, paymentIntentId })`, which now also matches on the intent.

Failure case: a captured invoice row records the intent but no charge id, and an earlier `paid_not_recorded` / `invoice_cancelled` task carries that intent but no charge id. `PaymentCaptureService.resolveStripeChargeId` can return null when the Stripe lookups fail, because it swallows those errors.

In that case a refund of the invoice's own charge is handled as unapplied money. The invoice is not marked refunded and the seller's payout is not clawed back. On main this case went to the invoice path, where `isInvoiceMoney` matches by intent and claws back correctly.

Confirmed on PG 16 with the real reader: `isChargeOfPaidInvoice(ch)` returns false while `wasEverUnapplied({ch, pi})` returns true. The same call with `paymentIntentId: null` (main's behaviour) returns false.

**Fix:** make `isChargeOfPaidInvoice` take `{ chargeId, paymentIntentId }` and match `status in ('captured','refunded') AND (stripe_charge_id = $ch OR (stripe_charge_id IS NULL AND stripe_payment_intent_id = $pi))`, the same rule as `isInvoiceMoney`. Add a PG test for this case. Before deploying, check that `SELECT count(*) FROM payment WHERE status IN ('captured','refunded') AND stripe_charge_id IS NULL AND stripe_payment_intent_id IS NOT NULL` is 0 or understood.

### F2 — Medium (latent) — The prod worker has no identity provider, so its gate holds every personal buyer
`apps/worker/src/finance/create-worker-stale-payment-expiry.ts` builds the identity reader only when `VERIFF_API_KEY` is set. The prod worker env (`auction-infra/terraform/ephemeral/prod/main.tf:405-455`) sets neither `VERIFF_API_KEY` nor `STRIPE_SECRET_KEY`. Only the api gets Veriff (`:270`).

With `paymentsAreLive` true, the worker's gate marks every individual-account payer `unverified`, which counts as held. Today the closer has no Stripe client and does nothing (`stripe_not_configured`). But each expiry pass logs `held_invoice_checkouts_closed` counting every personal-account invoice and, with this PR, every personal-account Pay several group, as "closed".

If a Stripe key is ever added to the worker, each pass would expire every personal buyer's single and group checkout. On main, the same trap already existed for single invoices. This PR widens it to groups and adds the `sk_live_` trigger.

**Fix:** `DrizzleBidActorEligibilityReader` is a database read. Wire it in the worker whenever payments are live, not only when `VERIFF_API_KEY` is set, so the worker reads stored KYC status like the API does. Alternatively, do not run the held sweep in a process that cannot verify. Count `closed` only when the closer reports it actually closed something.

### F3 — Low — A session the buyer pays during the close is marked closed in the ledger
In `closeIfSuperseded`, the lifecycle reads the session as `open` and calls `gateway.expireCheckoutSession`. The real gateway (`stripe-payment-gateway.ts:293-301`) reads the session again and returns quietly if it is no longer open. The lifecycle then calls `markClosed`.

Reproduced on PG 16: Stripe says `complete`, while the ledger has `closed_at` set. `anyPaid` and `closeAfterCapture` skip closed rows, so this paid session no longer counts as "already complete". Money stays safe: an old-amount payment goes to unapplied money, and a correct-amount payment is captured by the webhook. The ledger is wrong, though, and the buyer can be offered a new checkout.

This existed on main for same-rail sessions. The PR extends it to card sessions closed for any rail.

**Fix:** have `expireCheckoutSession` return the final status, or read the session again after expiring. Call `markClosed` only when the session is `expired`.

### F4 — Low — The "stale card" check compares display parameters, not just the amount
The fingerprint covers all checkout parameters, including the lot title and the hero `imageUrl`. With `STORAGE_READ_MODE=signed`, the catalogue resolver re-signs that URL every UTC midnight (`StableSigningPolicy`). So a card page opened before midnight is closed as "old amount" when the buyer opens bank transfer after midnight, or after a cosmetic lot edit, even though the amount has not changed. This is a UX and support issue, not money.

**Fix:** compare a money fingerprint for the cross-rail rule: `paymentId`, `amountCents`, `currency` and the invoice line amounts. Keep the full fingerprint for the session idempotency key.

### F5 — Low — The `everCaptured === false` guard has no test
Removing `if (!row.everCaptured) return false;` (`checkout-refund-handlers.ts:35`) fails none of 782 refund, webhook and payment tests. That guard is what stops a refund of money on a never-captured (cancelled) invoice that recorded the same charge or intent from clawing back the seller.

**Fix:** add a unit test and a PG test: the invoice row has a matching `stripeChargeId` (or intent), `everCaptured` is false, and the expected result is `refund_of_money_not_applied` with no payout lines.

### F6 — Low — Two new rules are untested
- The container wiring `{ paymentEligibilityRequired: paymentsAreLive(env) }` (`create-payments-services.ts:528-529`): setting it to `false` fails nothing.
- `listOpenGroupsWithCheckout` limiting members to `pending`/`authorized`: dropping that filter fails nothing.

**Fix:** add a container test that builds the webhook service with a live env and no gate, and expects manual review. Add a PG case where a captured (or cancelled) member is left out of `members`.

### F7 — Info — The recorder does not handle 23505 itself
This is safe today, as shown above. If a second writer outside the advisory-lock discipline is ever added, every collision costs one Stripe retry.

**Optional:** insert the received event with `ON CONFLICT DO NOTHING` (on the partial index, `ON CONFLICT ((payload->>'dedupeKey')) WHERE event_type = 'payment.unapplied_money_received'`), or catch 23505 in `record` and treat it as "already recorded".

### F8 — Info — The group sweep is stricter than settlement, and one error stops it
- The sweep holds a group when any unpaid member's `buyerId` is held. Settlement (`payment-group-settlement.service.ts:227-236`) checks only the group's payer. So the sweep can close a group that settlement would accept. That is fail-safe, but the two rules differ.
- An eligibility read that throws, for example a missing account, stops the whole sweep, including the group pass that runs after the invoice loop. This is the same pattern as main.

**Fix:** document the stricter member rule, or align it with settlement. Wrap each candidate in try/report so one bad row cannot block the rest.

### F9 — Info — `everCaptured` depends on a `payment.captured` event
A captured invoice with no such event (for example a legacy import) has its refunds skipped as `refund_of_money_not_applied`. This PR does not change that, because production always computed the flag.

**Check:** `SELECT count(*) FROM payment p WHERE p.status IN ('captured','refunded') AND NOT EXISTS (SELECT 1 FROM domain_events e WHERE e.aggregate_type='payment' AND e.aggregate_id=p.id::text AND e.event_type='payment.captured')` should be 0.

### F10 — Info — 0383 operations
- The drizzle runner applies pending migrations in one transaction, so `SET LOCAL lock_timeout = '5s'` also covers any later migration in the same run. This is the same as 0316 and harmless.
- While it builds, the index blocks every `domain_events` insert, so all event writers wait, not only payments. Run the header's size and duplicate queries first, as the PR says.

## Severity table

| # | Severity | Area | Summary |
|---|---|---|---|
| F1 | Medium | (b) | Intent match can route a captured invoice's own refund to the unapplied path when the invoice row has no charge id |
| F2 | Medium (latent) | (h)/(i) | Prod worker has no identity reader, so every personal buyer counts as held; harmless only because the worker has no Stripe key |
| F3 | Low | (d) | A session paid during the close is marked closed in the ledger |
| F4 | Low | (d) | Stale-card rule compares display parameters (daily re-signed image URL, titles), not just the amount |
| F5 | Low | (b) tests | `everCaptured` guard untested (mutation survives) |
| F6 | Low | (h) tests | Webhook flag wiring and unpaid-member filter untested |
| F7 | Info | (f) | Recorder does not absorb 23505 (safe today) |
| F8 | Info | (h) | Group sweep stricter than settlement; one error stops the sweep |
| F9 | Info | (b) | `everCaptured` relies on a `payment.captured` event existing |
| F10 | Info | (f) | Lock timeout scope and insert blocking during the build |

F1 is a small change to one SQL condition plus a test. It is the only finding where this PR makes money handling worse than main. F2 is a configuration trap rather than a live fault, and the fix is one line in the worker wiring.

### Verdict: FIX FIRST

## Fixes after review

Fixed on `fix/payment-hardening`, which is still based on `main` `f1ffc6e4`. Main has not moved past 0382, so the migration stays 0383. I made no Stripe API calls and changed nothing in production or infrastructure. Tests ran with `--maxWorkers=2` against a throwaway PG 16.15.

| # | Fix | Commit | Test | Mutation result |
|---|---|---|---|---|
| F1 | `isChargeOfPaidInvoice({ chargeId, paymentIntentId })`: `status in ('captured','refunded') AND (stripe_charge_id = ch OR (stripe_charge_id IS NULL AND stripe_payment_intent_id = pi))`. The pre-deploy count query is in the 0383 header and the PR body. | `cde1b6d1` | PG 16 `unapplied-money-refunds.integration.test.ts`: the reviewer's case, a captured invoice with an intent and no charge id plus an earlier task with that intent. The refund is `refund_received`, the invoice is refunded and the seller side counts it. A handler unit test is added. | Intent branch off: 1 fail. `IS NULL` dropped: 1 fail. Handler passes null intent: 2 fail. |
| F2 | The worker reads `DrizzleBidActorEligibilityReader` whenever payments are live or Veriff is set (`workerPaymentIdentityReader`). The sweep counts `closed`/`groupsClosed` only on a confirmed close; anything else counts as `notClosed`. No infrastructure change. | `6dfa72f4` | `create-worker-stale-payment-expiry.test.ts`: prod env with no Veriff (verified payer is payable, unverified is held). `held-invoice-checkouts.test.ts`: with no Stripe client, closed is 0 and notClosed is 2. | Veriff-only wiring: 2 fail. Closed counted always: 4 fail (invoice) and 4 fail (group). `unknown` treated as closed: 1 fail. |
| F3 | `expireCheckoutSession` returns the final status. `markClosed` runs only on `expired`, both in the superseded close and after capture. | `357c2d33` | Lifecycle unit tests: a session completed during the close, on another rail, on the same rail, and after capture. Gateway unit test. PG 16 lifecycle test against the real ledger. | Any status treated as expired: 3 fail. Superseded close ignores the status: 2 fail plus 1 PG. After-capture close ignores it: 1 fail. Gateway says expired: 1 fail. |
| F4 | The stale-card rule compares a money fingerprint (paymentId, amountCents, currency, line amounts). The full fingerprint still keys the idempotency key and reuse. Both are stored as `<parameters>.<money>` in the existing column; a legacy row counts as stale. | `6798cd1e` | Same amount with a changed image URL or title keeps the card session. Changed line amounts at the same total, a changed total, or a changed currency each close it. PG 16 test with the real ledger. | Full fingerprint used: 4 fail plus 1 PG. Lines dropped: 1 fail. Parameters part compared: 4 fail. Whole value compared on reuse: 2 fail. Amount dropped: 1 fail and currency dropped: 1 fail (both survived at first; tests added). |
| F5 | Tests added. | `bc035494` | Unit tests: matching charge and matching intent with `everCaptured: false`. PG 16: refunded and cancelled invoice with the charge and intent recorded and no `payment.captured`, giving `refund_of_money_not_applied` with no lines. | b2 guard removed: 4 fail (was 0). |
| F6 | Tests added. | `bc035494` | `create-payments-services.webhook.test.ts` builds the real container per env: production build, production deploy and live key make the check required; a local run does not. PG 16: captured and cancelled members are left out of `members`. | h2 wires `false`: 3 fail. Wires `true`: 1 fail (was 0). h6 filter dropped: 1 fail (was 0). |
| F7 | The recorder inserts in a savepoint and absorbs a 23505 on `domain_events_unapplied_money_dedupe_key_uid` as already recorded. Other errors are still raised. | `ca7588c6` | PG 16 test with two real concurrent transactions. It waits for the lock wait in `pg_stat_activity`. When the other writer commits, there is one row and the recorder's transaction and its claim commit. When the other writer rolls back, the recorder's row is kept. Unit tests: other index and other errors are rethrown. | Not absorbed: 1 fail. No savepoint: 1 fail. Any 23505 absorbed: 1 fail. |
| F8 | Each sweep candidate is try/reported (`failed`, `held_checkout_sweep_failed`), so one error does not stop the run. The stricter member rule is documented on purpose: it only closes a checkout. | `6dfa72f4` | One invoice and one group whose eligibility read throws, with the rest still closed. A close that throws. | Invoice error stops the sweep: 2 fail. Group error stops it: 1 fail. |
| F9 | Note only. The check query is in the PR body's pre-deploy checks. | — | — | — |
| F10 | Note only. Lock-timeout scope and insert blocking are noted in the PR body. | — | — | — |

Full suites after the fixes, all green:
- packages/db: 196 files, 1065 tests.
- persistence: 158 files, 937 tests.
- finance-runtime: 35 files, 246 tests.
- worker: 230 files, 1653 tests.
- api: 738 files, 7419 tests.

`biome`, the lint scripts and `tsc --noEmit` (db, persistence, finance-runtime, worker, api, shop-api) are clean.

## Recheck — in progress

Head rechecked: `ca7588c6` (`fix/payment-hardening`), base `f1ffc6e4`. Throwaway PG 16 (initdb under `/var/tmp`, port 55432). `pnpm install --frozen-lockfile`, package build, `db:migrate` and `db:roles` all OK.

### Progress
- F1: scratch PG test (deleted afterwards) through the real webhook service and reader. All pass:
  - Invoice with no charge id plus a task carrying its intent: a 40.00 partial refund and then a full refund both take the invoice path. 100.00 is recorded and the seller side counts it.
  - Staff marked paid (no ids) plus a duplicate card payment: a partial refund stays unapplied and keeps the task open; a full refund closes it. The invoice stays `captured`, with no payout lines. The same holds when the task has only the intent.
  - Two invoices, same buyer: A is captured with no charge id; money paid on cancelled B is unapplied. B's refund takes the unapplied path and leaves A alone. A's refund takes A's invoice path. B has no lines.
- F2: on PG as `worker_app` (production env, no Veriff, no Stripe key), the worker's gate, built the way the worker builds it, returns approved → payable; unverified, pending and no-profile → held. `worker_app` already has SELECT on `bid_identity_directory` and `bid_user_profile`. Sweep counting: see N1.
- F3/F4: a scratch PG race (deleted afterwards) ran 12 rounds. Each round opened an old-amount card session, then a new-amount card tab and a bank tab at once on two separate pools. The buyer completed the old card session during the close in alternate rounds. A completed session was never marked closed. Otherwise the old one was expired and closed, and both new sessions stayed open. The PR's own lifecycle PG tests also pass.
- F7: scratch PG tests with real concurrent connections, each run 3 times, all green:
  - A raw writer holds the same key and commits first. The recorder absorbs the refusal, and a later statement in the same transaction still runs and commits.
  - Ten recorders on ten pools plus a raw writer at once: one event, and every recorder transaction commits.
