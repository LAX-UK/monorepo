Verdict: FIX FIRST

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
