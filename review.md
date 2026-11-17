Verdict: SHIP

# Review of PR #1555: Shop express checkout wallet row on the basket and Details

Branch `gap-49-express-checkout-ui` at `a6472605`. Checked against decision pack 2026-11-17 section 3 (option B, CO1–CO18 changes, Q4/Q5 defaults), #1544 (flag and CSP), #1546 (shop-api express endpoints) and `docs/runbooks/shop-stripe-setup.md`.

## What I ran

- `apps/shop` vitest: express-checkout lib, `src/components/checkout`, runtime flags, env, basket and checkout pages: **15 files, 71 tests passed**.
- `apps/shop-identity` vitest `src/routes/commerce` (includes the new express proxy routes): **2 files, 77 tests passed**.
- `apps/shop` `tsc --noEmit`: clean.
- Browser gate `playwright test -c playwright.express-checkout.config.ts` (next dev, fake Shop Identity, Stripe.js mocked): **14 passed, 4 skipped** (the skipped tests only rewrite screenshots).
- I did not run a full `next build`, as the brief said.

## Blocking

### B1. After a declined payment the wallet row is a dead end, but the message says "Try again"

- `apps/shop/src/lib/checkout/express-checkout/express-checkout-flow.ts:117-120`
- `apps/shop/src/lib/checkout/express-checkout/express-checkout-state.ts:53-56`
- `apps/shop/src/components/checkout/express-checkout-wallet.client.tsx:176`

**What the client does.** When `checkout.confirm` returns an error after the server confirm succeeded, the flow:

- calls `cancelCheckoutOrder(orderId)`;
- shows `EXPRESS_PAYMENT_FAILED_MESSAGE` ("…Try again or check out as usual.");
- puts the row back to `ready` with the **same** session.

**What the cancel does on the server.** The buyer cancel (`cancelShopCheckoutSession` → `expireStripeBeforeLocalTransition`) expires the order's Stripe session (the express session that `bindExpressCheckoutSession` bound to the order), then marks the order `cancelled` and releases its prints.

**What happens on the next try.** Only a reload recovers:

- Stripe now holds an expired session behind the mounted element.
- A second confirm on the server replays idempotency key `express:<sessionId>` against a cancelled order. `assertReplayableCheckoutOrder` returns 409 "Order is no longer checkoutable", and the row shows that raw string (`express-checkout-api.ts:138`).
- The session is created only in the mount effect, keyed on `config.basketId`, which has not changed.

The server comment at `apps/shop-api/src/application/express-checkout/express-checkout.service.ts:197` says the design intends a declined card to be retried on the same session and order. The client contradicts that.

The same dead end follows any server confirm answer that ends the session ("This payment has ended. Start again from your basket.", the bind-mismatch "not charged" path). The row keeps offering buttons that cannot work.

**Fix.** Pick one:

- (a) Do not cancel on decline. Leave the order on its session so a retry in the sheet replays it, which matches shop-api. Rely on session expiry or the reaper to release the hold.
- (b) Keep the cancel, then open a fresh session: bump a mount key, or re-run start, which already opens a new session once the old one has ended.

Either way, add a gate test of "declined, then pay again", and map "session ended" answers to a state that does not offer the dead buttons.

The card path is unaffected and no money is at risk, but this is a payment flow whose retry copy is false. That is why I am blocking.

## Non-blocking

- **N1.** `express-checkout-flow.ts:61`: when the address-change action itself fails (network), the sheet shows "Your payment did not go through…". Nothing has been paid at that point. Use `EXPRESS_UNAVAILABLE_MESSAGE`.
- **N2.** `express-checkout-api.ts:132-143`: `shop.price_changed` (shop-api's "Your basket changed while you were paying") is not mapped. It reaches the user as commerceErrorMessage's "The price changed. Refresh your basket and try again.", without the "you have not been charged" line the brief asks for on every refusal. Map `PRICE_CHANGED` to `not_charged` with the upstream message.
- **N3.** `express-checkout-api.ts:138`: `upstreamMessage(answer)` passes through any 409 CONFLICT text. That includes internal-sounding strings such as "Order is no longer checkoutable", "Order already paid" and "Checkout session expired". Prefer an allow-list of shop-api's three express messages, falling back to `EXPRESS_NOT_CHARGED_MESSAGE`.
- **N4.** `express-checkout-wallet.ts:62` vs shop-identity `phone: min(8)`: the client accepts a 7-character phone. Shop Identity then refuses it with a generic `validation_failed` ("Check your details and try again."). Align the client pattern (`{7,19}`) so the wallet's phone message shows instead.
- **N5.** `express-checkout-wallet.client.tsx:92-95`: the 12 s load timeout is never cleared on success. The reducer's `loading` guard makes this harmless; clearing it on `loaded` would be tidier.

## Checked and fine

**Design.**
- Basket: the row sits under "Checkout", headed "Or pay with" (`basket/page.tsx`).
- Details: "Express checkout" comes first, then "Or continue below" before an unchanged form, for guests (including the email step) and signed-in shoppers.
- The row is hidden on the quote and international paths (`checkout-form.tsx` `hidden={quoting}`).
- Sentence-case copy, and the Shop's established layout and section styles.
- Wallet buttons keep their brand styles, with no Shop accent.
- Q4 (both pages) and Q5 (collection as a £0 rate) defaults are respected.

**Gating.**
- The row renders only when `SHOP_EXPRESS_CHECKOUT` is on *and* a valid `pk_` key is set (`shopExpressCheckoutPublishableKey`).
- The server actions also re-check the flag. shop-api's `feature_disabled` hides the row with no gap.

**Stripe.js.**
- It loads from `js.stripe.com/basil` only inside the lazily imported wallet component, and only once an IntersectionObserver (200px margin) sees the slot. A hidden slot never loads it.
- It is not bundled.
- The gate asserts that no other page loads it or its policy.
- No CSP, middleware or route-budget file changed beyond #1544.

**Endpoint order and money safety.**
- Order: start → shipping-address → confirm (inside `runServerUpdate`) → `checkout.confirm`, then `/checkout/confirmation?orderId=…`.
- No order is created client-side.
- Confirm is impossible before the session exists (the handlers are bound after start).
- The wallet sheet is modal, so a double submit cannot happen.
- Idempotency: `express:<session>` on the server; start reuses the session per window.
- Nothing is paid before confirm (server-set shipping details).
- A buyer cancel cannot cancel a paid session: `assertCheckoutNotAlreadyPaid` guards an ambiguous confirm failure.

**Refusals.**
- Sold out: the message, then `router.refresh()`.
- Bind mismatch or cancelled: "you have not been charged".
- UK-only address: the server's copy.
- Network errors: one plain line.
- The card path stays usable in every case.

**Secrets.** Only the publishable key reaches the client. Made-up test keys are allow-listed narrowly in gitleaks.

**States and accessibility.**
- Loading reserves 48px with `aria-busy`.
- Unavailable renders nothing.
- Error is one line (`role="alert"` for errors, `status` for info).
- The fieldset is labelled by its heading.
- The buttons are Stripe iframes and keyboard-reachable.

**Screenshots.** The light, dark and 375 Details and basket screenshots match the shell code: the "Express checkout" heading, the divider, "Or pay with", and no sideways scroll at 375 (also asserted by the gate).

**Tests and structure.**
- The tests cover the reducer, the API adapter, wallet parsing, the flow, the Stripe loader, the row, the shop-identity proxy, and a browser gate with Stripe mocked.
- The code is split cleanly into pure lib modules with ports, and reuses `cancelCheckoutOrder`, `commerceErrorMessage`, uk-postcode and the shop-commerce request helpers. There is no duplication of the existing checkout code.

## Fixes after review

Commit `c349e0c9` on `gap-49-express-checkout-ui`.

- **B1 (option a).** A client-side `checkout.confirm` decline no longer cancels the order. The order stays bound to its session, so paying again in the sheet replays shop-api's confirm (`express:<sessionId>`); the session's expiry (and the existing reaper) releases the hold. The `cancelOrder` port and the `cancelCheckoutOrder` import are gone.
  - `apps/shop/src/lib/checkout/express-checkout/express-checkout-flow.ts:76-79` (doc), `:124-129` (catch keeps the order; "Try again" copy only here, where retry works)
  - `apps/shop/src/components/checkout/express-checkout-wallet.client.tsx` (no cancel port)
  - Answers that end the session map to a new terminal result `ended`: `express-checkout-api.ts:96-101`, `:156-166` (CONFLICT, BASKET_CONFLICT, PRICE_CHANGED, 404 NOT_FOUND).
  - Flow dispatches `ended`: `express-checkout-flow.ts:105-109`.
  - New row state `ended` (one line, no wallet buttons, no reserved space; nothing brings the buttons back): `express-checkout-state.ts:20`, `:57-60`; rendered as one alert line in `express-checkout-wallet.client.tsx:62`.
  - Gate: `e2e-express-checkout/express-checkout.gate.spec.ts:217` "declined, then pay again succeeds on the same session and order" (two confirms on the same session, no cancel request, lands on the confirmation); `:192` "shows no wallet buttons once the session has ended"; `:178` the bind-mismatch refusal now withdraws the buttons. Stand-ins: `fake-stripe.js:78-81` (`declined_once`), `fake-shop-identity.mjs:115-124` (`ended`, `not_checkoutable`).
  - Unit: `express-checkout-flow.test.ts` (decline then retry pays, ended without paying), `express-checkout-state.test.ts` (ended state).
- **N1.** Address-change network failure shows `EXPRESS_UNAVAILABLE_MESSAGE`: `express-checkout-flow.ts:59-62`; test in `express-checkout-flow.test.ts`.
- **N2.** `shop.price_changed` maps to the not-charged terminal result with shop-api's "Your basket changed while you were paying…" message: `express-checkout-api.ts:162`.
- **N3.** Allow-list of shop-api's three express messages (`EXPRESS_UPSTREAM_MESSAGES`, `express-checkout-api.ts:78-82`); anything else reads as `EXPRESS_NOT_CHARGED_MESSAGE` (`:116-121`). Unit test "never shows other conflict text as it is"; gate `express-checkout.gate.spec.ts:205`.
- **N4.** Phone pattern `{7,19}` (8 to 20 characters, as Shop Identity): `express-checkout-wallet.ts:63`.
- **N5.** Load timeout cleared on `ready`: `express-checkout-wallet.client.tsx:127`.

Run after the fixes:

- `apps/shop` `vitest run`: 129 files, 804 tests passed. `tsc --noEmit` and `biome check` clean.
- Express browser gate (Stripe.js and Shop Identity stand-ins, no keys): 16 passed, 4 skipped (screenshot-only). No full `next build`.
- Screenshots: only `details-not-charged-*` changed (the buttons are now withdrawn); regenerated and the PR body text updated to match.

## Final recheck

PR head `c349e0c9`. Only the items listed in the brief were checked.

**B1 is fixed per option (a).**
- Client: `handleExpressConfirm` (`express-checkout-flow.ts:124-129`) no longer cancels on a Stripe decline. The `cancelOrder` port and the `cancelCheckoutOrder` import are gone. The row goes back to `ready` on the same session, and the "Try again" copy appears only on this path.
- Server, replayed confirm: the second confirm reuses the idempotency key `express:<sessionId>` (`express-checkout.service.ts:197`).
  - `replayCheckoutOrder` → `assertReplayableCheckoutOrder` accepts the order, because it is still `pending_payment` and inside `checkoutExpiresAt`.
  - `bindExpressCheckoutSession` accepts the same session: `snapshot.orderId === orderId`, the status is still `open` after a decline, and the attach `WHERE` allows `stripeCheckoutSessionId = sessionId`.
  - It rebinds under the next `bindRevision`.
- Server, no stuck holds: `reapStaleShopCheckouts` (`shop-checkout-reaper.ts:29-31`) picks up `pending_payment` orders past `checkoutExpiresAt` and expires the bound Stripe session through `expireShopCheckoutSession`. The `checkout.session.expired` webhook releases the order as well. Stripe expires the express session itself at `windowEnd + CHECKOUT_HOLD_MS`.
- Session-ending answers end the row: CONFLICT, BASKET_CONFLICT, PRICE_CHANGED and 404 NOT_FOUND all map to `ended` (`express-checkout-api.ts:157-166`).
  - The reducer makes `ended` terminal, and nothing brings the buttons back.
  - The row shows one `role="alert"` line with no wallet group and no buttons, and "Continue as guest" stays enabled. The gate asserts all of this.

**N1–N5 are correct.**
- N1: an address-change network failure shows `EXPRESS_UNAVAILABLE_MESSAGE`.
- N2: `shop.price_changed` maps to `ended` with shop-api's wording.
- N3: the allow-list (`EXPRESS_UPSTREAM_MESSAGES`) holds exactly shop-api's three express messages (`shop-checkout-express-session.ts:16-21`); anything else shows `EXPRESS_NOT_CHARGED_MESSAGE`.
- N4: the client allows 8–20 characters, the same as Shop Identity's `express-checkout-bodies.ts:35` (`min(8).max(20)`).
- N5: the load timeout is cleared on `ready`.

**No raw server text reaches the shopper on the express path.** Confirm answers either come from the allow-list or go through `commerceErrorMessage`. Every code that the express confirm path in shop-api can throw has a fixed line there. Start always shows a fixed line. Address shows shop-api's VALIDATION copy, which on that route is the UK-only message.

**The gate tests fail on the old code and pass now.** I put the `c349e0c9` gate spec and stand-ins on top of `a6472605` app code and ran four tests. All four failed:
- "declined, then pay again": the request steps were `start, start, confirm, cancel`.
- "shows no wallet buttons once the session has ended": the wallet group count was 1, expected 0.
- "never shows shop-api's internal refusal text": the row showed "Order is no longer checkoutable".
- "withdraws the buttons": the wallet group count was 1, expected 0.

On `c349e0c9` all four pass.

**What I ran on `c349e0c9`:**
- `apps/shop` `vitest run`: **129 files, 804 tests passed**. `tsc --noEmit` is clean.
- Express gate (`PLAYWRIGHT_CHROMIUM_PATH` set to the preinstalled Chromium): **15 passed, 1 failed, 4 skipped** (the skipped tests only rewrite screenshots). I did not run a full `next build`.
  - The failure was the basket test "sits under Checkout as 'Or pay with'…", with `scrollIntoViewIfNeeded: Element is not attached to the DOM`.
  - Run alone it failed 2 times out of 3 on `c349e0c9`, and 3 times out of 3 on `a6472605`. So it is an existing flake, not a regression from the fixes. See Later.

### Later (non-blocking)

- **L1.** The gate test `express-checkout.gate.spec.ts:266` is flaky. It calls `scrollIntoViewIfNeeded()` on the wallet group while the signed-in basket re-renders. Wait for the button first (`await expect(group.getByRole("button").first()).toBeVisible()`) or retry the scroll.
- **L2.** If a shopper is declined and then reloads instead of retrying, `start` opens a new session because the old one is now bound to an order. The old order keeps its hold until `checkoutExpiresAt` or the reaper releases it. For a one-of-a-kind print, the next express or card attempt may get "sold out" until then. This is the accepted cost of option (a); consider releasing the hold when `start` replaces a bound, unpaid session.
- **L3.** Two places could still show shop-api text as it comes. Both are fine today and become risks only if shop-api adds new errors:
  - `expressConfirmResult` falls back to `commerceErrorMessage`, whose `default` branch shows `message` for an unknown code.
  - `expressAddressResult` shows any VALIDATION message.

  Pinning both to allow-lists, as N3 does, would make this hold for good.
