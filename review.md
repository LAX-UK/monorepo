Verdict: SHIP

# Final recheck: PR #1546, shop-api: express checkout on Checkout Sessions in Elements mode

Checked against `docs/design/decision-pack-2026-11-17.md` section 3 (option B, PR plan step 2).
Head rechecked: `d812eba5a`. It is the first-review head `e5dea586f` plus #1544's head `a2de27951`,
two merges of main, and the fix commit `b145a3073` ("Key each express bind by its revision and
check the session after it"). Merges cleanly into main `d087a2900`.

## Finding 1 (stale idempotent bind): fixed at the root

| Required | Result |
|---|---|
| Per-state-change idempotency key | Pass. The bind reads the session first, then sends `bindRevision: snapshot.bindRevision + 1` (written to `metadata.bindRevision`) under the key `checkout:shop-express-bind:<orderId>:r<revision read>` (`apps/shop-api/src/infrastructure/shop-checkout-express-session.ts:175-176`). The gateway appends `digest(params)` (`stripe-shop-express-checkout.gateway.ts:193,213`). Every bind that lands moves the revision on, so A→B→A and addr1→addr2→addr1 are three different requests. A bind that never reached Stripe leaves the revision unchanged, so its retry reuses the same key, and the SDK's own `maxNetworkRetries: 2` reuses it too. |
| Retrieve and verify after every bind | Pass. After the update the session is retrieved again (`shop-checkout-express-session.ts:181`). `expressBindMismatch` (`:35-68`) requires all of: status `open`, `metadata.orderId` = this order, currency `gbp`, `amount_total` = order total, exactly one shipping option whose amount = the order's surcharge, and shipping details (name, line1, line2, city, postcode ignoring spaces and case, country) = what was bound. The update response's total is still checked as well (`:178-179`). |
| Safe failure on mismatch | Pass. On mismatch the code logs `shop_express_bind_mismatch` with the reason, then calls `release`. That expires the Stripe session **before** cancelling the order, putting the prints back and restoring the basket (`cancelShopCheckoutSession`, `drizzle-payment-event.processor.ts:1196`). It then answers 409 "We couldn't set up this payment, so you have not been charged. Start again from your basket." (`:193-217`). If the release itself fails, that is logged too (`reason: "release_failed"`, `:211`). In that case the webhook's amount check (`shop-payment-verdict.ts:55`) is still the last line of defence. |
| Shipping details bound are the order's | Pass. For delivery, the bind now sends the address as the order stores it (`expressSessionShipping`, `drizzle-checkout.repository.ts:104-124`), so the read-back compares against what the order holds. Collection keeps no address on the order, so the wallet's address is sent instead. |
| A replaying fake Stripe proves both | Pass. `shop-checkout-express.integration.test.ts:118-260` drives the real gateway over a fake SDK. The fake caches by idempotency key, replays the first response without applying it, rejects a reused key with different params, and can drop updates or fail one. Tests cover A→B→A on rate (`:532`), addr1→addr2→addr1 (`:551`), a retry reusing the key (`:575`), and a dropped update causing release, expiry and a 409 (`:588`). |
| Mutation check: removing either defence fails tests | Pass, run locally. **(a)** Revert the key to the old `checkout:shop-express-bind:<orderId>` and pin `bindRevision` to a constant: the A→B→A rate and address tests fail (2 failing). **(b)** Remove the read-back and trust the update response only: "refuses the confirm and ends the session…" fails. **(c)** Disable each read-back check on its own: dropping `amount_total` → 1 failing, `order_id` → 2, `session_not_open` → 1, shipping option → 2, shipping details → 4. Every check is pinned by at least one test. |
| Amounts server-side, integer minor units | Pass. Unchanged from the first review: lines and subtotal come from `loadCheckoutBasket`, rates are constants in pence from `FULFILMENT_SURCHARGE_PENCE`, and the client sends only ids. The new snapshot fields are Stripe's integer `amount_total` and `shipping_amount`. |
| Same webhook and order path as hosted | Pass. The diff against main leaves `drizzle-payment-event.processor.ts`, the webhook DTO, `completeShopCheckoutSession` and `shop-payment-verdict.ts` untouched. Confirm still goes through `createCheckoutOrder` with key `express:<sessionId>`, and the integration test settles an express order through the webhook path. |
| Hosted flow unchanged | Pass. The hosted gateway changed only by extracting `createShopCheckoutStripeClient` (same options). `expressSessionShipping` and the bind run only under `input.express`. The integration test "leaves the hosted page flow as it was" passes. |

The first review's non-blocking note "a reused session can already be dead" is also mostly
addressed: `start` now reads the session back and opens a new one when Stripe replays an ended or
already-bound session (`express-checkout.service.ts:147-149`).

## Findings

None blocking.

## Non-blocking notes

1. **`start` recovers only one level.** If the replacement session (`<key>:after:<first id>`) also
   ends within the same 10-minute window, a third `start` replays the first key and then the second.
   That returns an ended session (`express-checkout.service.ts:147-149`), so the sheet fails with
   "This payment has ended" until the window rolls over. It's safe for money. A loop, or keying the
   retry on the latest ended id, would close it.
2. **Concurrent confirms on one session.** Two confirms with different rates can read the same
   revision and both write. The loser's read-back sees the winner's state and releases the order,
   which expires the session, so the winner's sheet then fails. That's a safe failure (nobody is
   charged), and rare. Just noting it in case support sees `shop_express_bind_mismatch` with reason
   `session_not_open` or `amount_total` in pairs.
3. **Key text vs. digest.** The `:r<revision>` in the key text is redundant with the revision inside
   `digest(params)`. Removing only the text still passes, because the metadata revision changes the
   digest. Both are kept, which is fine; no change needed.
4. Earlier notes still stand: resume on an express order (no `session.url`), and the PaymentIntent
   lacks `orderReference`/`description`. Both are for the UI PR or a follow-up, and neither is a
   money risk.

## Test runs (local, Postgres 16 + Redis, CI env, `SHOP_V1_INTEGRATION_REQUIRED=true`)

- `apps/shop-api` `tsc --noEmit`: pass. `apps/shop` `tsc --noEmit`: pass.
- Express files (session, gateway, service, Postgres integration): 45 tests pass, and the 9 route
  tests (`express-checkout.routes.test.ts`) also pass. The mutation runs are described above.
- `apps/shop` `vitest run`: 122 files, 750 tests, all pass.
- Full `apps/shop-api` `vitest run`, sharded as in CI (4 shards, each serial on its own freshly
  migrated database): 341 files, 3550 tests, all pass. An earlier attempt where I forced parallel
  workers on one shared database broke the suite's `fileParallelism: false` and failed unrelated
  integration files. Those same files pass when run serially, so that was my harness, not the PR.
