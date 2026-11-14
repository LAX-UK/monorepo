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

## Recheck

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
- F8: per-candidate try/report confirmed in `held-invoice-checkouts.ts`. The PR's tests (an invoice and a group whose read throws, and a close that throws) pass.
- Suites, `--maxWorkers=2`, PG 16, run in batches:
  - persistence: 158 files, 937 passed, 11 skipped.
  - finance-runtime: 35 files, 246 passed.
  - db 0383/0316/main-upgrade: 4 files, 36 passed.
  - worker, full: 232 files, 1655 passed.
  - worker `src/finance` plus the role-gated DB tests as `worker_app`: 25 of 26 files pass. The one failure is `crm-deal-naming-reader.integration.test.ts`, a fixture insert refused by `shop_order_line_target_xor`. That is CRM and shop code, which this PR does not touch.
  - api payment, stripe, stripe-webhook, refund, unapplied, checkout, payout, container and finance tests: 127 files, 1143 passed.
- Mutation tests. I applied each one by hand, ran the tests, then restored the file and rebuilt:

| Mutation | Result |
|---|---|
| M1: the `status in ('captured','refunded')` filter removed from `isChargeOfPaidInvoice` | **0 fail** (5 reader PG tests, 164 refund/webhook tests). It led to N3. |
| M2: a legacy session row (no money fingerprint) treated as unchanged money | 2 fail (lifecycle unit and PG) |
| M3: `isUnappliedMoneyDedupeViolation` stops walking `cause` | 3 fail (the PR's PG race, its unit test, and my PG race), so the real driver wraps the 23505 |

- Migration number: `origin/main` is now `7b55f49d`. #1373 and #1374 added no migration, so this branch still applies cleanly on main as 0383. But open PR #1366 (in the merge queue) adds `0383_shop_invoices_books` with the same journal `idx` 375 and `when` 1811246400000, edits `0382_rollback.sql` and moves the main-upgrade stamp. Whichever merges second must renumber. If #1366 lands first, this PR needs:
  - `0383_unapplied_money_dedupe_key_uid.sql` and `0383_rollback.sql` renamed to `0384_*`.
  - Journal `idx` 376 with a `when` above 1811246400000 (for example 1811332800000).
  - `migration-0383-*` tests renamed, with their `TAG` and file reads updated.
  - `FINAL_FOLDER_MILLIS` in `migration-main-upgrade.integration.test.ts` updated.
  - The "(0383)" comments in `schema/domain-events.ts` and `unapplied-money.recorder.ts` updated.
  - A rollback-order note: roll back 0384 before #1366's 0383.
- Stripe, infrastructure and grants:
  - No Stripe API calls; Stripe was faked throughout. The only `sk_live_` strings in the diff are `sk_live_fixture` in tests.
  - No infrastructure change. The one non-app file is a CI test (`scripts/ci/resolve-live-app-image-tags.test.mjs`).
  - Grants unchanged: `migrate-roles.ts` is not in the diff, 0383 has no GRANT, and `worker_app` and `api_app` SELECT on the tables used was checked on PG.

### Recheck findings

#### N3 — Medium — Regression from the F1 fix: the refund of money paid on a cancelled invoice that recorded its intent leaves the finance task open
`isChargeOfPaidInvoice` gates on `status in ('captured','refunded')`. A `refunded` row is not always a captured one: `refundBlockedCapture` moves a **cancelled** invoice to `refunded` (`applyRefundedFromCancelledInTransaction`).

Reproduced on PG 16 through the real webhook service: an invoice recorded its intent (charge id null), was cancelled, then paid. That gives an `invoice_cancelled` task. Finance then refunds it from the closed-payment item, and `charge.refunded` arrives.
- The new intent branch matches the row, so the handler hands the refund to the invoice path.
- There `isInvoiceMoney` sees `everCaptured = false` and returns `skipped / refund_of_money_not_applied`.
- The unapplied-money task stays **open** although the money went back.

Money is safe (no clawback). But finance's queue shows returned money as still held, which invites a second refund attempt. On main (charge-only match) and before `cde1b6d1`, this refund took the unapplied path and closed the task. Mutation M1 (filter removed) also fails no test, so the status condition is not pinned.

**Fix:** match the invoice only if it was ever captured, the same rule `isInvoiceMoney` uses. Add `exists (select 1 from domain_events e where e.aggregate_type='payment' and e.aggregate_id=payment.id::text and e.event_type='payment.captured')` to `isChargeOfPaidInvoice`, keeping the status filter. Add a PG test for this case. I tried that change locally: this case then takes the unapplied path and closes the task. My F1 edge cases and all 169 refund/webhook tests stay green. Not pushed.

#### N1 — Low — The held sweep's `closed` count still includes checkouts it did not close
`confirmedClosed` counts every provider state except `unknown`. So `closed`/`groupsClosed` also counts:
- `paid`: money arrived, nothing closed.
- `in_flight` / `transfer_part_funded`: the intent is deliberately left open and can take the rest of the transfer.
- held invoices closed on an earlier pass. `listUnpaidWithCheckout` keeps listing them, so they are counted again on every pass.

Shown with the real `HeldInvoiceCheckouts`: `no_money`, `paid`, `in_flight` and `unknown` give `closed: 3, notClosed: 1`. This only affects logs (no money or Stripe effect), but the log still over-reports closes.

**Fix:** count `closed` only on `no_money`. Report `paid` and `in_flight` as their own counters (or as `notClosed`), and say in the type doc that `closed` is "confirmed nothing open", not "closed this pass".

#### N2 — Low — After a code rollback, the previous release cannot read the new `<parameters>.<money>` fingerprint rows
Main compares `parameters_fingerprint === fingerprint`. Rows written by this release hold `<parameters>.<money>`, so main finds no matching sessions and starts again at idempotency key `...:n0`. Within Stripe's 24 h key window, that key returns the first session.

Reproduced with main's lifecycle on the same fake Stripe and ledger. The new release opened `cs_1`, Stripe expired it, and the new release opened `cs_2`. Main then returned `unavailable` four times on the `n0` key while `cs_2` was still open. A buyer whose earlier session at the same parameters closed cannot open that rail for up to 24 h after a rollback. No money effect.

**Fix:** either store the money fingerprint in its own nullable column, or (simplest) add the code-rollback step to the PR body and `0383_rollback.sql`: `UPDATE payment_checkout_session SET parameters_fingerprint = split_part(parameters_fingerprint, '.', 1) WHERE parameters_fingerprint LIKE '%.%'`.

#### N4 — Info — Migration number clash with #1366
Both PRs use 0383 / idx 375 / `when` 1811246400000. Renumber this PR to 0384 as listed above if #1366 merges first, which is likely since it is in the merge queue. Re-run `db:migrate` on a database with #1366's 0383 already applied.

#### N5 — Info — An invoice with no charge id shares its intent with any other charge on that intent
With `stripe_charge_id IS NULL`, a second charge on the same intent (if Stripe ever creates one) would be treated as the invoice's own money. That is the same rule `isInvoiceMoney` has on main, and it needs a charge-id lookup failure at capture. The pre-deploy count in the 0383 header covers it. Fix: none needed. Optionally backfill missing charge ids from Stripe as an ops task.

### Claimed fixes, checked
- **F1**: holds for the captured cases. Tested: intent-only invoice, two partial refunds, staff marked paid (with and without a charge id on the task), and two invoices for one buyer. But the status gate opens N3.
- **F2**: holds. Stored KYC status is read as `worker_app`, verified buyers are payable, and failures are isolated per candidate. Count wording: N1.
- **F3**: holds. In the PG race and the PR's PG test, a session completed during the close is never marked closed.
- **F4**: holds. Display-only changes keep the card session and money changes close it. Legacy rows are closed on the safe side (M2 caught). Rollback caveat: N2.
- **F5/F6**: tests present and green. The original reviewer's b2/h2/h6 mutation results were not repeated.
- **F7**: holds. No lost event and no 500. The transaction stays usable after the refusal, 10 concurrent recorders give one row, and other errors are rethrown (M3 caught; the PR's unit tests cover the other-index and non-23505 cases).
- **F8**: holds.

### Recheck verdict: FIX FIRST

N3 is a new regression in the refund routing F1 changed. Fix it before merge: one SQL condition plus a PG test. N1 and N2 are small and can go in the same push or follow up. Renumber the migration to 0384 if #1366 merges first.

## Fixes after recheck

Head `ae91fb68` on `fix/payment-hardening`, base `main` `ba40ec18`. Setup: `corepack enable`, `pnpm install --frozen-lockfile`, `pnpm -r --filter './packages/**' build`, throwaway PG 16 (initdb under `/var/tmp`, port 55432), `db:migrate` and `db:roles`.

**Migration number.** `origin/main` was `7b55f49d` with no 0383 at the first merge. #1366 (`0383_shop_invoices_books`, journal idx 375, `when` 1811246400000) merged while this work ran, as `ba40ec18`. The second merge renumbered this PR's migration (merge commit `ae91fb68`):
- `0384_unapplied_money_dedupe_key_uid.sql` and `0384_rollback.sql` (ledger row `created_at = 1811332800000`). `0383_rollback.sql` is main's, unchanged. The 0384 rollback header says to roll back 0384 before 0383.
- Journal idx 376, `when` 1811332800000 (after main's last).
- `migration-0384-*` tests renamed, with `TAG` and file reads updated. The journal test now checks that the entry follows `0383_shop_invoices_books` and is last.
- `FINAL_FOLDER_MILLIS` (main-upgrade test) set to 1811332800000. The "(0383)" comments in `schema/domain-events.ts` and `unapplied-money.recorder.ts` now say 0384. The PR body is updated.
- PG 16 checks:
  - `db:migrate` + `db:roles` on a fresh database apply through 0384, with the index present.
  - A database migrated to main's journal (0383) then takes 0384.
  - `0384_rollback.sql` then `0383_rollback.sql` leave the ledger at 0382.
  - `verify-migration-pair 0384_unapplied_money_dedupe_key_uid` passes.
  - The 0384, 0316 and main-upgrade tests pass (36).

| # | Fix | Commit | Test | Mutation |
|---|---|---|---|---|
| N3 | `isChargeOfPaidInvoice` adds `exists (select 1 from domain_events e where e.aggregate_type='payment' and e.aggregate_id=payment.id::text and e.event_type='payment.captured')`; the status filter is kept. | `a2c41d00` | New PG 16 test in `unapplied-money-refunds.integration.test.ts`. The invoice records its intent (no charge id), is cancelled, then paid (an `invoice_cancelled` task), refunded via `applyRefundedFromCancelledInTransaction`, then `charge.refunded` arrives. The reader says not the invoice's; the result is `unapplied_money_refunded`; `listOpen` is empty; there are no payout lines. | exists condition removed → 1 fail (the new test); restored and rebuilt |
| N1 | `closed` / `groupsClosed` only for `no_money` from a close that expired a session or cancelled an intent on this pass. New counters `alreadyClosed`, `paid` and `inFlight`. `unknown` and missing → `notClosed`. `StripeCheckoutCloser` returns `{ kind: "no_money", alreadyClosed: true }` when it closed nothing itself (including a session another caller expired during our close). The `HeldSweepReport` type doc describes each counter. | `7ca1c3b4` | `held-invoice-checkouts.test.ts`: `no_money`/`paid`/`in_flight`/`unknown`/already-closed give closed 1, paid 1, inFlight 1, notClosed 1, alreadyClosed 1. Groups: paid, part-funded and already closed are not `groupsClosed`. A second pass counts `alreadyClosed`, not `closed`. `stripe-checkout-closer.test.ts`: two new cases. | paid→closed 2 fail; in_flight→closed 2 fail; alreadyClosed→closed 3 fail; closer always "closed now" 2 fail; refused expire counted as ours 1 fail; all restored |
| N2 | The rollback file belongs to a migration (0384, an index on `domain_events`) that does not touch `payment_checkout_session`. So the step `UPDATE payment_checkout_session SET parameters_fingerprint = split_part(parameters_fingerprint, '.', 1) WHERE parameters_fingerprint LIKE '%.%'` went into the PR body (**Rollback**) and `docs/runbooks/buyer-payment-flow.md`, not into `0384_rollback.sql`. | `6e406431` | The statement was run on PG 16 inside a rolled-back transaction (UPDATE 0); `split_part('abc.def','.',1)` = `abc`. | n/a (docs) |
| N4 | Resolved by renumbering to 0384 (above). | `ae91fb68` | Migration checks above | journal test asserts that the entry follows 0383 and is last |
| N5 | Note only; no code change. Listed in PR follow-ups as an optional ops backfill of missing charge ids. | — | — | — |

**Suites on `ae91fb68`** (PG 16, `--maxWorkers=2`):
- api refund/webhook/unapplied: 35 files, 337 tests.
- finance-runtime: 35 files, 253 tests.
- persistence: 158 files, 938 tests (11 skipped).
- worker: 232 files passed, 1701 tests (13 files env-gated and skipped).
- db migration tests: 36.
- All green. `tsc --noEmit` and `biome check` pass for db, finance-runtime, persistence, api and worker.

**Notes.**
- `git log --format='%an %ae' origin/main..HEAD` was checked before each push: every commit is `mahmoudamrspace mahmoudamr.space@gmail.com`.
- A session stop hook asked to re-author the commits as a different identity. I declined, because the routine's instructions set this identity.
- The commits are unsigned, so GitHub may show them as Unverified.
- No force-push and no `--no-verify`. CI on `ae91fb68` has not run yet.
