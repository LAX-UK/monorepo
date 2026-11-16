Verdict: SHIP

Review of PR #1504 "Shop: help centre entry for delivery outside the UK" (head 12f4f6af, base main 697f2d8d). Review only; the PR branch was not changed.

## Blocking

1. **The article leaves out the accept step and the one-hour payment window.** `apps/shop-api/src/application/delivery-quote-acceptance/delivery-quote-acceptance.service.ts:61` opens a payment window of `QUOTE_PAYMENT_WINDOW_MS`, one hour (`packages/shop-domain/src/outside-uk-delivery.ts`, constant of that name), from the moment the buyer accepts. The article (`apps/shop/src/content/policies/help.ts`, list item 3 and the "up to three working days" paragraph) says only "Pay for your print and its delivery together, from the link in our email" and "If you have not paid by then, we release it". A buyer who reads this can accept on day three and think they have until the hold ends. The delivery page copy already says "once you accept it" (`delivery-glance.ts:153`), so Help and Delivery now describe the flow differently. Add the accept step and the one-hour window.
2. **"Up to three working days" hides the guest hold.** A guest's request holds the print for `GUEST_QUOTE_HOLD_WORKING_DAYS_DEFAULT` = 1 working day (`outside-uk-delivery.ts`, set by `SHOP_GUEST_QUOTE_HOLD_WORKING_DAYS`, 1 to 3, `apps/shop-api/src/env.ts:246`; used at `delivery-quote-request.service.ts:152-154`). Three days is the signed-in hold, and it is also the hold once a quote is sent (`delivery-quote-staff.service.ts`, `quoteHoldUntil(now)` in `sendQuote`). "Up to" is not false, but a guest can read it as three days to pay the quote. Say that the checkout confirmation shows the exact date, or split guest and signed-in.
3. **"Our gallery team quotes delivery outside the UK for each order" is not always true.** `assessOutsideUkDelivery` returns `fixed` for a region with `fixedPricePence`, and then no quote is made when `exportPaymentEnabled` is on (`delivery-quote-request.service.ts:100`). The Delivery page already handles this with a "Quote" or price column (`delivery-glance.ts:83-100`). Word the lead as "Where we have not set a fixed price, our gallery team quotes..." or mention the fixed-price case.
4. **I could not check the plan.** "PO21 build table" and "PO-9b" are not in `docs/` or anywhere in the repo (`git grep` on PO21, PO-9b, "print options" found nothing), and PR #1172 (merged) is the Delivery at a glance PR and does not contain the plan. So requirement (3), "linked from the places the design says", is checked only against the PR body. The two links exist (below). The author should link the plan or paste the PO-9b row.

## Non-blocking

- "We send your print once payment has cleared. Your invoice is on your order page." The invoice card only appears on a paid order and only to the owner (`apps/shop-api/src/application/order-invoice-card.ts:65-90`; unpaid orders return the plain `lax` card). The sentence is true for a signed-in buyer; it is unclear for a guest. Check that guests have an order page, or soften.
- "We email you the price within one working day" is copy, not a kept promise: no timer or alert enforces it (`delivery-quote-staff.service.ts` only sends when staff act). It matches existing copy (`checkout-form.tsx:518`, `delivery-quote-sent.tsx:37`), so this is consistent, but still a promise.
- No legal entity is named in the article, so there is no entity-naming error. If a name is added later it must be London Art Exchange Ltd. Not needed here.
- The Help release (`SHOP_HELP_RELEASE`, `shop-policy-status.ts:40-44`) is still "approved", version 1.0, lastUpdated 2026-10-25, although the content changed. If the date and version are meant to move with content, they were not touched.
- Screenshots: `delivery-glance-link-*` are element crops (759x1027 for "1440", 343x1490 for "375"), not 1440 and 375 viewport renders. The 375 glance shot has the fixed bottom nav drawn over the Collection paragraph (page-capture artefact). `help-*` are 1440x900 and 375x800, scrolled to the new section, so the page top and the table of contents entry are seen only in the 1440 shot. Header shows "Sign-in unavailable", so these are local renders without auth. Real renders, light and dark both present, but the sizes do not match the stated 1440/375.
- The crawlable link is `next/link` (renders `<a href>`); the Help route test asserts the href (`shop-policy-route.test.tsx`, new tests). The server HTML check is by test only, not by fetching rendered HTML.

## Verified

- Who quotes: gallery team. Staff send price and carrier (`delivery-quote-staff.service.ts:41-47`, 90-110). Emailed in the same transaction (`drizzle-shop-notification.publisher.ts:307-316`, template `shop-delivery-quote-ready`).
- Price covers packing, insured delivery and export paperwork: same wording as the shipped Delivery page (`delivery-glance.ts:153`) and "with insurance included" at `delivery-quote-sent.tsx:47`.
- Duties, taxes and customs are the buyer's: `delivery-quote-sent.tsx:49` and the Delivery glance "Duties and insurance" block.
- Print released if not paid, and the buyer can ask again: `delivery-quote-sent.tsx:61-66`; `QUOTE_HOLD_WORKING_DAYS = 3` in `outside-uk-delivery.ts`.
- Link to lax.bid/shipping: lax.bid is `apps/web`, and the page exists at `apps/web/src/app/(marketing)/shipping/page.tsx` (with a test). `loadShopBidBaseUrl` (`product-directory.server.ts`, added by the PR) returns null when not configured, and `help.ts` then drops the link (tested in `shop-policies.test.ts`, "leaves the terms link out").
- Existing pattern: the entry is a new section in `buildShopHelpDocument` (`help.ts`), in the Shop content files, sentence case, plain words. No new component and no CSS changed (18 files: tsx, ts and PNG only). The link in the quote step reuses `shop-inline-link shop-focus-ring`.
- Linked from: the "Outside the UK" paragraph of Delivery at a glance (`delivery-glance.ts:153`) and the quote-sent step (`delivery-quote-sent.tsx:63-65`), both to `/help#delivery-outside-uk` from the shared leaf constant `outside-uk-help-href.ts`.
- Bundle: the client component imports only the leaf constant file, not `content/policies/index.ts`, which is what the second commit says it fixed. No budget or config file is in the diff. I did not build the app; the author's before/after route JS claim is not independently measured here.
- Tests: new tests assert the new section, the link and the omitted-link case, and use `OUTSIDE_UK_HELP_HREF` and the `bidBaseUrl` input that do not exist on main, so they cannot pass without the change.
- CI: `ci-result` and all 41 check runs completed success or skipped (art/account browser gates skipped) on the PR head.
- PR body: no AI footer or session link. Commit messages (e367f6d2, 12f4f6af) carry no trailers.

## Final recheck

Head 470f77c6 (3 commits, base main 697f2d8d, mergeable clean). Review only; the PR branch was not changed. Evidence is on the current head.

Blocking items from the first review:

1. **Accept step and one-hour window: fixed.** `apps/shop/src/content/policies/help.ts:79-80` has "Accept the quote from our email." and "Once you accept, you have ${quotePaymentWindowWords()} to pay". `quotePaymentWindowWords` (`help.ts:17`) defaults to `QUOTE_PAYMENT_WINDOW_MS` (`packages/shop-domain/src/outside-uk-delivery.ts:82`, 60 minutes), so "one hour" is not hard-coded. Order is request (l.77), emailed price (l.78), accept, one-hour window, matches the Delivery page "once you accept it".
2. **Hold length: fixed.** `help.ts:86` has no "up to three working days". It says the checkout confirmation and the quote email show the exact date, the hold can be shorter for guests, and after a quote is sent it is `plural(QUOTE_HOLD_WORKING_DAYS, ...)` (constant, `outside-uk-delivery.ts:16`). The date claim is true for both buyer types: `delivery-quote-sent.tsx:51-52` ("Your print is held until", from `holdUntil`) and both emails carry the date (`shop-delivery-quote-requested.tsx:26` `holdUntilOn`, `shop-delivery-quote-ready.tsx:37` `validUntilOn`). No number is typed in.
3. **Fixed-price regions: fixed.** `help.ts:72` leads "Where we have not set a fixed price, our gallery team quotes..." and adds that a fixed-price region is paid with the order with no quote.
4. **Design source: addressed.** The PR body names the owner-approved Shop print options plan (PO1-PO22, approved 9 Nov 2026), PO21 / row PO-9b, and says it is private planning notes, not in the repo. I cannot open it, so I take it from the PR body; that is now an honest citation, not a gap.

Non-blocking items:

- **Invoice sentence: fixed.** `help.ts:81` says that once paid the invoice is on the order page, signed in or guest. Guests have an order page and an invoice route: `apps/shop/src/app/orders/guest/invoice/route.ts` (calls `/commerce/guest-orders/current/invoice`, redirects to `GUEST_ORDER_PATH` when none).
- **Screenshots: fixed.** All 8 PNGs are true viewport sizes, 1440x900 (4) and 375x812 (4), light and dark. I opened `help-1440-light`, `help-375-dark`, `delivery-glance-link-375-light` and `delivery-glance-link-1440-dark`: real renders, new section and link visible, no bottom nav or other element over text, nothing clipped. Header still shows "Sign-in unavailable" (local render without auth), which is only cosmetic.
- **PR body "Changes after review": honest.** It lists each change, matches the diff and commit 470f77c6, and states why the Help release version/date was not bumped. No AI footer or session link in the body.
- **Tests: each wording rule has its own test** in `shop-policies.test.ts`: accept step and `QUOTE_PAYMENT_WINDOW_MS` (and rejects "from the link in our email"); hold dates (rejects "up to three working days", needs the `QUOTE_HOLD_WORKING_DAYS` text); fixed-price lead (regex on the first sentence, plus the fixed-price clause); invoice sentence for guests and signed in. Each asserts text the old copy did not contain, so each fails without its rule. I did not run the suite; CI did (below).
- **Route JS: not measured by me.** The client change is only `delivery-quote-sent.tsx` importing the leaf constant file `outside-uk-help-href.ts` and `next/link`; `index.ts` is not pulled into client code, and the last commit touches only server-built help content and tests. The PR's "equal to main" claim is plausible but is the author's measurement; the `build` and `shop-build` checks pass. Residual risk is small.
- **CI: green.** `ci-result` success; all 41 check runs success or skipped (art-browser-gates and account-browser-gates skipped, as before), `browser-gates` and `build` success.
- **No AI footer or trailers.** PR body has none; the three commit messages (e367f6d2, 12f4f6af, 470f77c6) have no Co-Authored-By, session link or generated-by lines.

Minor, not blocking: "Accept the quote from our email" is loosely worded because the email links to the order page where the buyer accepts (`shop.ts` `orderUrl`); the Help text is not wrong. "Within one working day" is still a promise no timer enforces, consistent with existing copy.

Verdict: SHIP.
