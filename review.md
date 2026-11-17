Verdict: FIX FIRST

# Review: PR #1546, shop-api: express checkout on Checkout Sessions in Elements mode

Reviewed against `docs/design/decision-pack-2026-11-17.md` section 3, option B (approved; Q4 basket
and Details; Q5 collection as a zero-price rate), PR plan step 2. Head reviewed: `e5dea586f`, on top of
#1544 (`cf2b3a28c`).

## What was checked

| Requirement | Result |
|---|---|
| Same Checkout Sessions API, Elements mode | Pass. `stripe.checkout.sessions.create` with `ui_mode: "custom"`, `mode: "payment"` (`stripe-shop-express-checkout.gateway.ts:659-676`). |
| Same `checkout.session.completed` path and order reference | Pass. On confirm, `metadata.orderId`/`orderReference` are written to the session (`gateway.ts:708-715`). The webhook DTO and `completeShopCheckoutSession` are unchanged, and the integration test settles an express order through them. `shop-payment-verdict.ts:55` still rejects a payment whose amount differs from the order total. |
| No second order path skipping checks | Pass. Signed-in confirm goes through `deps.checkoutOrder` and guest confirm through `guest.service.placeOrder`, into the same `createCheckoutOrder`. That covers the basket load (owner, price, stock, limits, framing), money pause, VAT columns, edition reservation, basket retirement and the order idempotency key. Webhook signature verification is untouched. The hosted `/v1/orders/checkout` route builds its input field by field, so a client cannot inject `express`. |
| Integer minor units, server-side, never from the client | Pass. Lines and subtotal come from `loadCheckoutBasket` (`shop-express-checkout-basket.ts:89-95`). The client sends only `basketId`, `sessionId` (pattern-checked) and a rate id (enum). Rate prices are constants. Before payment the bind checks the session subtotal against the order and the session total against the order total (`shop-checkout-express-session.ts:89-94,119-123`). |
| `allowed_countries` GB only | Pass (`gateway.ts:573,666-668`). Confirm also refuses non-GB (`express-checkout.service.ts:93-96`). |
| Two rates at the existing UK price source; collection 0 | Pass. `FULFILMENT_SURCHARGE_PENCE.uk_insured_delivery` (1500) and `.collect_new_cavendish` (0), the same table the Details form prices from (`express-shipping-rates.ts:13-24`). The bind cross-checks the order's surcharge against the rate (`shop-checkout-express-session.ts:64-71`). |
| Address change can't change prices except via the rates | Pass. The handler only returns the constant rates for a GB country and never writes to Stripe. `permissions.update_shipping_details: "server_only"` means the browser can't set shipping either. |
| Order and print hold only on confirm | Pass. `start` reads the basket and opens a session; it writes nothing (integration test "orders and holds nothing"). Because only the server can set shipping, the session can't be paid before confirm has bound it to an order. |
| Sold-out print rejects confirm with the exact message; releases nothing it doesn't own | Pass. `OUT_OF_STOCK` is mapped to `EXPRESS_CHECKOUT_SOLD_OUT_MESSAGE` (`express-checkout.service.ts:205-214`). The reservation transaction rolls back, so no order exists, nothing is released and the basket stays open (integration test). `release` only cancels the caller's own order, which was found by `express:<sessionId>` and passed `assertReplayableCheckoutOrder`. |
| Idempotency keys on every Stripe write | Partly. Create and update both carry keys, but the update key can replay a stale response (finding 1). Expire on release reuses the existing hosted `expireHostedCheckout` (`stripe-shop-checkout.gateway.ts:245`), which has no key but reads before it writes. That code is pre-existing and not changed here. |
| Hosted flow unchanged | Pass. The changes to `replayCheckoutOrder` only apply under `keepOpenSession` (set only for `express`). The gateway refactor only extracts the client constructor. The integration test "leaves the hosted page flow as it was" covers it. |
| Contract and webhook tests that fail without the code | Pass. New contract schemas, route tests, service tests, gateway tests, DTO tests and a 10-case Postgres integration suite, all in new files or new `describe` blocks. |
| Flag | Pass. `SHOP_EXPRESS_CHECKOUT` defaults to off and is validated. It was added to `STRIPE_DEPENDENT_FLAGS`. Routes return 404 and the writer refuses `express` with 503 while it is off. |
| No secrets | Pass. The diff has no keys or webhook secrets; the client secret is only returned, never logged. |

## Findings

### 1. Blocking: the bind's Stripe idempotency key can replay a stale update, so the session charges a different amount from the order

`apps/shop-api/src/infrastructure/shop-checkout-express-session.ts:117` builds the key
`checkout:shop-express-bind:<orderId>`. `stripe-shop-express-checkout.gateway.ts:178-179` appends
`digest(params)`. For the same order, the same rate and the same address, the key is therefore
identical every time. Stripe caches an idempotent response for 24 hours and returns it **without
applying the request again**.

The repo explicitly supports a repeated confirm with a different rate on the same session
(`drizzle-checkout.repository.ts:311-329`, `keepOpenSession`). Here is how that goes wrong:

1. Confirm with insured delivery (A). The order is goods + 1500. The bind sets the shipping option to
   A, and Stripe answers with total goods + 1500.
2. Confirm with collection (B), for example after a decline. The order is repriced to goods. The bind
   has new parameters, so a new key, and the session is updated to option B with total goods.
3. Confirm with delivery (A) again. The order is repriced to goods + 1500. The bind sends exactly
   step 1's parameters under step 1's key. Stripe returns step 1's cached response (total goods + 1500)
   and **does not update the session**, which still has option B at total goods.
   `bound.amountTotalPence === input.totalPence` passes (`shop-checkout-express-session.ts:119`).
4. The wallet pays the session's real total (goods). The webhook's amount check
   (`shop-payment-verdict.ts:55`) rejects it. The shopper has been charged, but the order isn't
   confirmed and stays held until staff notice and refund.

The same thing happens with no price change if the address goes addr1 → addr2 → addr1. The session
keeps addr2's shipping details while the order has addr1, which is wrong data for Radar and for staff
reading Stripe.

The integration fake (`shop-checkout-express.integration.test.ts`) applies every update and never
replays, so the existing "reprices it on the same session" test can't catch this.

Fix (either):
- (a) Make the key unique per bind attempt that changes state. For example, include a revision that
  changes whenever the order's fulfilment or delivery columns change (the order's `updatedAt` after
  replay, or a counter), so going back to an earlier state is a new request.
- (b) After the update, `retrieve` the session and check `amount_total`, the single shipping option's
  amount and the shipping details. Don't trust the update response.

Then add a test whose fake Stripe replays responses per idempotency key and runs A → B → A.

## Non-blocking notes

- **Resume on an express order fails.** `resumeCheckoutOrder` → `resolveHostedCheckout`
  (`stripe-shop-checkout.gateway.ts:188-201`) relies on `session.url`, which is null for
  `ui_mode: "custom"`. "Continue to payment" on a pending express order therefore returns 409 while its
  print stays held (up to about 31 minutes) and the basket is retired. This is safe for money, but the
  UI PR should either hide resume for express orders, cancel the order when the sheet is dismissed, or
  fall back to a hosted session.
- **A reused session can already be dead.** `start` reuses one session per basket and content for each
  10-minute window (`express-checkout.service.ts:131`). If a bind succeeds and then fails the total
  check, `release` expires that session and puts the basket back. Another `start` in the same window
  with the same content gets Stripe's cached (now expired) session, and the sheet fails until the
  window rolls over. Consider adding a release counter or the order id to the key, or checking the
  status after create.
- **The PaymentIntent doesn't carry the order reference.** On create, `payment_intent_data.metadata`
  (`gateway.ts:672-675`) has no `orderId`/`orderReference` and no `description`, and the bind can only
  update session metadata. Refunds and disputes find the order by `stripePaymentIntentId` first, so
  they still work. But staff looking at the payment in Stripe won't see "LAX Shop order LAX-S-…" the
  way they do for hosted orders. Consider copying them onto the PaymentIntent in the webhook path.
- **Collection still asks for an address.** The sheet asks for a full UK address even for collection,
  because `shipping_address_collection` is on for both rates. This matches the design ("UK only") and
  the order drops the address for collection; just noting it for the UI copy.

## Test runs (local, Postgres 16 + Redis, CI env, `SHOP_V1_INTEGRATION_REQUIRED=true`)

- `apps/shop-api` `tsc --noEmit`: pass.
- Express-related files (routes, service, gateway, webhook DTO, env, Postgres integration): 6 files,
  99 tests, all pass.
- Full `apps/shop-api` `vitest run`: 340 files, 3526 tests, all pass.
- `apps/shop` `vitest run` (includes #1544): 122 files, 750 tests, all pass.
