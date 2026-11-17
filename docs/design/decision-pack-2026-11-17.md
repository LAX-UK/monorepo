# Decision pack, 17 November 2026: stock agreements, Zoho price, wallets, Shop filters, workspace extras (proposed, awaiting owner approval)

Register items ZI-5, LA-4, GAP-49, GAP-51 and GAP-53. The register is not in the repository, so
each item is taken as worded in the request. Nothing here is built. There is no code and no
migration in this change.

Rules applied throughout: one LAX identity (one sign-in, one set of tokens), sentence case, each
product keeps its own accent (Shop aubergine, Bid navy; status colours never take an accent),
staff screens use the staff kit (`@auction/staff-ui`) and are checked against
`docs/design/staff-design-standard.md` (rule IDs such as `TBL-12` refer to it). Every screen is
designed for light and dark and 375 px. A static review page with option mockups mirrors this
file: `docs/design/decision-pack-2026-11-17.html`. Names in it are made up.

**Approved 2026-11-17: all five as recommended.** ZI-5 B, LA-4 A, GAP-49 B, GAP-51 A, GAP-53 A ("Sell another like this" and "Delete draft"). Open questions take their defaults: Q1 both places, lax.art not blocking in the first release; Q2 checkbox fallback until 31 January 2027; Q3 consignor set in LAX Admin; Q4 wallets on basket and Details; Q5 collection as a zero-price rate; Q6 square tolerance 5 %; Q7 no photos copied; Q8 the second action is Delete draft.

How to approve: reply "approve as recommended", or name the item and the option (for example
"GAP-49: B"). Open questions go ahead on their stated default unless answered.

| Item | Recommendation | PRs |
| --- | --- | --- |
| ZI-5 Consignor agreements for stock moves | B: agreements recorded per consignor in LAX Admin; the move dialog reads them instead of a checkbox | 4 (S, M, M, S) |
| LA-4 Zoho price in From Zoho | A: show Zoho's price as information, never a warning or a price state | 1 (S) |
| GAP-49 Wallets at basket and checkout | B: Express Checkout Element on basket and Details, on Checkout Sessions, hosted page kept for cards | 4 (S, M, M, S) |
| GAP-51 Shop filters | A: add Orientation and Framing; Size already ships | 2 (M, S) |
| GAP-53 Client workspace extras | A: "Sell another like this" from a consignment; "Delete draft" | 3 (S, M, S) |

---

## 1. ZI-5: Per-consignor agreement data for stock moves

### What staff see today

- "Offer at auction" (LAX Admin, from an original's lax.art page or its From Zoho record) asks for
  a sale and a starting price and a **required checkbox** "The consignor agreed to sell at
  auction", with "Your name is recorded with this confirmation."
  (`apps/shop-admin/src/components/artworks/offer-at-auction-dialog.client.tsx:290`, rule in
  `apps/shop-admin/src/lib/offer-at-auction-form.ts:36`, error "Confirm the consignor agreed").
- The API only accepts `consignorAgreed: true` (`packages/shop-contracts/src/admin-auction-offer.ts:54`).
  The move is recorded in the register history as `consignorAgreed: true, confirmedBy`
  (`packages/artwork-register-contracts/src/move-originals.ts:258`,
  `apps/shop-api/src/application/admin/original-move.service.ts:278`), shown as "Consignor
  agreement confirmed" (`apps/shop-admin/src/server/domain/zoho-register.vm.ts:539`).
- "Offer on lax.art" asks nothing about the consignor.
- **LAX has no record of who consigned a Zoho original, or on what terms.** The Zoho Product read
  has title, stock code, artist, medium, size, status, year and price only
  (`apps/worker/src/integrations/zoho/artwork/catalogue-product.ts`). Bid's
  `consignment_agreement` (estimate, reserve, commission, signed PDF, versioned) exists only for
  works a client submitted on LAX Bid (`packages/db/src/schema/consignment-agreements.ts`).
- The nearest pattern in LAX Admin is "Grant sale authority" on a client's page: owner, artwork,
  count and a required evidence note, audited, recent sign-in
  (`apps/shop-admin/src/components/clients/grant-sale-authority-dialog.client.tsx`).

### The problem

The checkbox proves only that someone clicked it. Nobody can answer "what did this consignor agree
to, until when, at what minimum?" and the same question is asked again on every move. A move to
lax.art is not covered at all.

### Options

**A. Keep the checkbox, add a required evidence note** ("What the agreement is based on, such as a
signed letter of 3 March"), as sale authority does. One small PR, no new data. Still per move,
still free text, still nothing for lax.art.

**B. Agreements recorded per consignor, read by the move.** *Recommended.*
- A consignor is a client in LAX Admin (the existing client record, `clients/[partyId]`). Their
  page gains an **Agreements** section: places covered (LAX Bid, lax.art, private sale), start and
  end dates, optional lowest price and commission, the signed file, and a note. Replaced, never
  edited in place, like Bid's agreements. Recent sign-in to add or retire.
- Each original in the register gets a **Consignor** field on its From Zoho record: a client, or
  "LAX owns this work". Set once, changed with a reason, kept in history.
- The move dialog replaces the checkbox with a line that reads the data:
  - Covered: "Covered by agreement with {consignor}, signed 3 Mar 2026, LAX Bid and lax.art, until
    2 Mar 2027." (Info notice.) If a lowest price is set and the starting price is below it, a
    warning: "Below the lowest price agreed (£2,000)."
  - Not covered: "No agreement covers LAX Bid for {consignor}." with "Add agreement" (opens the
    client page) and the move button disabled.
  - No consignor set: "Set who consigned this work first." with "Set consignor".
  - LAX owns the work: no agreement line.
- History records the agreement's id and version instead of `consignorAgreed`. Past entries keep
  reading "Consignor agreement confirmed".
- Trade-off: one migration and a few screens; staff must enter agreements before moving works
  after go-live. Mitigation: Q2 (a transition period with the checkbox as fallback).

**C. Reuse Bid's `consignment_agreement`.** Same table for both. Rejected: it is keyed to a Bid
submission and a legal entity with a seller-conditions version; Zoho originals have neither, and
mixing them would make Bid's seller-facing agreement carry staff-only gallery terms.

### PR plan (B)

1. **S.** Migration (two tables: consignor agreement, artwork consignor link with history), with
   rollback and test; contracts. No UI.
2. **M.** Agreements section on the client page: list, add (dialog, file upload), retire;
   capabilities `consignor_agreement.read` / `.manage`; audit rows.
3. **M.** Consignor field on the From Zoho record and an optional Consignor column and filter on
   the register list (`TBL-12`, hidden by default).
4. **S.** Move dialogs read the agreement (auction and lax.art); history payload; the checkbox
   removed after the Q2 transition.

### Owner-only questions (default in brackets)

- Q1. Do lax.art offers need a covering agreement too, or only auction? [Both, as places on the
  agreement; lax.art shows the line but does not block in the first release.]
- Q2. Transition: keep the checkbox as a fallback for works with no consignor set, for how long?
  [Until 31 January 2027, then blocking.]
- Q3. Is the consignor held in Zoho (a Products or Vendors field) that LAX should read instead of
  staff setting it? [No; set in LAX Admin. Can be read from Zoho later.]

---

## 2. LA-4: From Zoho "missing price" not surfaced

### What staff see today

- Zoho's Unit Price is read into the register as `zohoPrice`, "shown beside the LAX price, never
  the price itself" (`packages/db/src/schema/artwork-register.ts:53`). Zero or empty reads as none
  (`apps/worker/src/integrations/zoho/artwork/assess-product.ts:55`).
- It is shown only inside the move dialogs: "Zoho price: Not set in Zoho"
  (`apps/shop-admin/src/components/from-zoho/offer-on-lax-art-dialog.client.tsx:93`) and "Zoho's
  price is £4,800.00" with a notice when the starting price differs
  (`offer-at-auction-dialog.client.tsx:264-286`).
- The record's "What Zoho says" list has no price row
  (`apps/shop-admin/src/components/from-zoho/from-zoho-record.client.tsx:271-283`).
- Register gaps ("Still missing", the Missing filter) are image, size and medium only
  (`apps/shop-admin/src/server/domain/zoho-register.vm.ts:68`), by design: the LAX price is set
  when a work is offered. The sync's own "missing price" gap reaches staff only in Last check, as
  "No price" against new artworks (`zoho-register.vm.ts:316`).

### The problem

Staff find out Zoho has no price only when they open a move dialog. They cannot see it on the
record, or list the works Zoho has not priced.

### Options

**A. Show Zoho's price as information.** *Recommended.* A "Price in Zoho" row in "What Zoho says"
(`StaffMoney`, or "Not set in Zoho" in muted text, no tone), and an optional "Price in Zoho"
column on the All list, hidden by default (`TBL-12`), sortable so unpriced works can be grouped.
Not counted in "Still missing". Matches the design rule that the register does not own price.

**B. A "Price on request" state.** When Zoho has no price, the register shows "Price on request"
and "Offer on lax.art" preselects "Enquire". Rejected: it makes a Zoho omission decide what
buyers see. "Enquire" already exists as a staff choice in the lax.art dialog, made on purpose.

**C. A warning.** Add Price to the gaps: "Still missing: price", a Missing filter option and a
warning badge. Rejected: it tells staff to fix Zoho before offering, which is not required, and
turns a common, harmless state into wallpaper.

### PR plan (A)

1. **S.** Record row, optional list column, sort; the API already returns `zohoPrice` on the
   detail (`artwork-register-review.service.ts:316`), the list item needs it added. Tests and
   light/dark/375 screenshots.

No owner-only questions.

---

## 3. GAP-49: Apple Pay, Google Pay and Link at basket and checkout

### What shoppers see today

- Basket → "Checkout" (`apps/shop/src/app/basket/page.tsx:98`) → Details (your details, delivery:
  UK insured delivery, collect from the gallery, or ask for an international quote) → the submit
  button opens Stripe's hosted page with "You pay on our secure payment page, then come back
  here." (`apps/shop/src/components/checkout/checkout-form.tsx`). Steps: Basket, Details, Payment,
  Confirmation (`shop-checkout-steps.tsx`).
- The session is a hosted Checkout Session with no fixed payment method list
  (`apps/shop-api/src/infrastructure/stripe-shop-checkout.gateway.ts:126`), so Stripe already
  offers Apple Pay, Google Pay and Link **on its own page** when they are on in the Dashboard.
  Orders complete from `checkout.session.completed` webhooks.
- The Shop loads no Stripe.js, and its security headers do not allow it.

### The problem

A wallet user still types their details and delivery on our form, then meets the wallet button on
a second site. The fastest path is hidden behind the slowest. Baymard lists a long or complicated
checkout among the top reasons for abandonment, and recommends express options early, beside (not
instead of) guest checkout.

### Options

**A. Do nothing in the Shop; make sure wallets are on for the hosted page.** No code. Wallets stay
one step late.

**B. Express Checkout Element on basket and Details, on Checkout Sessions.** *Recommended.*
Stripe's Express Checkout Element shows the wallet buttons the device supports (Apple Pay,
Google Pay, Link) in one row, and the wallet sheet supplies email, name, address and payment.
Built on Checkout Sessions with Elements (the Elements mode of the same Checkout Sessions API,
not hosted), so orders keep finishing from the same webhook and the same order reference.
- Basket: the row sits under "Checkout", with "Or pay with" above it.
- Details: the row sits at the top, "Express checkout", above "Your details", with "Or continue
  below" dividing it from the form.
- Delivery in the sheet: UK only (`allowedShippingCountries: ['GB']`); two rates, "Insured UK
  delivery" and "Collect from our London gallery". International quotes stay on the form.
- The order and its print hold are made when the shopper confirms in the sheet; if a print sold
  out meanwhile, the sheet fails with "This print has just sold out" and the basket reloads.
- The hosted page stays for cards and everything else; nothing is removed.
- Needs: the Shop domain(s) registered as payment method domains in Stripe (Apple Pay requires
  it; Stripe also asks it for Google Pay and Link in Elements), Stripe.js allowed in the Shop's
  script, frame and connect sources, and wallet testing on real devices.
- Trade-off: Stripe.js on two Shop pages, and a second way to start an order to test.

**C. Move all payment into an embedded Payment Element on our Payment step.** One page, all
methods. Larger change (cards, 3-D Secure, errors all ours to design), and the hosted page's
proven flow is lost. Not needed to get wallets early.

### What changes in the checkout design (CO1–CO18)

The numbered checkout design is not in the repository, so changes are listed by place:
- Basket summary: wallet row under the primary button (primary stays ink, wallet buttons keep
  their own brand styles as Stripe requires; no Shop accent on them).
- Details: express row first; the form unchanged below. Guest and signed-in paths both see it.
- Steps: a wallet payment goes Basket or Details → Confirmation; the stepper marks Payment done.
- Confirmation: unchanged; receipt to the wallet's email.
- International and quote paths: no wallet row (nothing to pay yet).
- Copy: "Express checkout", "Or pay with", "Or continue below". Sentence case.

### PR plan (B)

1. **S.** Stripe Dashboard and API: register payment method domains for each Shop host
   (production and preview); allow Stripe.js in the Shop security headers; config flag
   `SHOP_EXPRESS_CHECKOUT` off by default.
2. **M.** shop-api: create an Elements-mode Checkout Session for a basket, shipping rates for the
   two UK options, address change handler, hold on confirm; webhook path reused; contract tests.
3. **M.** Shop UI: wallet row on basket and Details, loading/unavailable/error states (the row
   simply does not show where no wallet is available), light/dark/375, e2e with Stripe test mode.
4. **S.** Turn on in production after device checks; dashboard of wallet share.

### Owner-only questions (default in brackets)

- Q4. Show wallets on the basket too, or only on Details? [Both.]
- Q5. Allow collection in the wallet sheet? [Yes, as a zero-price rate.]

---

## 4. GAP-51: Shop catalogue filters (orientation, size, framed)

### What shoppers see today

- Filters on Editions: Available only (switch), Artist, Price, **Size** and Technique, with counts;
  a group shows only with two or more options with works
  (`apps/shop/src/lib/catalogue/artwork-catalogue-filter-config.ts:5`, `MIN_FILTER_GROUP_OPTIONS`).
- **Size S/M/L already ships**: "Small, under 50 cm", "Medium, 50 to 100 cm", "Large, 100 cm and
  over", by the longest side of the image (`packages/shop-domain/src/catalogue-bands.ts:26`).

### Data available today vs needed

| Facet | Data today | Needed |
| --- | --- | --- |
| Size (S/M/L) | `shop_artwork.height_cm`, `width_cm`; shipped | Nothing. Editions without both are left out of the facet, as today. |
| Orientation | Same two columns | A rule only: portrait (height > width × 1.05), landscape (width > height × 1.05), square otherwise. No migration; a generated column if the query plan asks for it. |
| Framed / unframed | `shop_edition_framing.mode`: `unframed_or_framed`, `framed_only`, `framed_by_artist`; no row means unframed only (`packages/db/src/schema/shop-framing.ts:115`) | A rule only (below). Framing options must be active for "framing available" to count. |

### Options

**A. Add Orientation and Framing groups.** *Recommended.*
- Orientation: "Portrait", "Landscape", "Square".
- Framing: "Available framed" (framed only, framed by the artist, or framing to choose) and
  "Available unframed" (no framing row, or framing to choose). A work that can be both appears
  under both, which is what shoppers mean. Baymard's filtering research favours filters on the
  attributes people shop by in the category (size, orientation and framing for wall art) and
  showing counts.
- Order in the rail: Artist, Price, Size, Orientation, Framing, Technique. Selected chips take
  the Shop accent; nothing else does.

**B. Framing as "Framed" / "Unframed" by mode.** Exact to the data, but a shopper choosing
"Framed" would not see works they can have framed.

**C. Size by framed size.** Bands from outer frame size where framed. Needs frame sizes per band
we do not hold; S/M/L by image size stays, the product page gives framed sizes.

### PR plan (A)

1. **M.** shop-api facets and filter params (`orientation`, `framing`) with counts; read model
   tests; URL state.
2. **S.** Rail groups, chips, mobile sheet, e2e and light/dark/375 screenshots.

### Owner-only questions (default in brackets)

- Q6. Square tolerance 5 %? [Yes.]

---

## 5. GAP-53: Client workspace extras

### What clients see today

- After sending a work: "Sell another work", which opens a blank wizard
  (`apps/web/src/components/dashboard/seller/submission-sent-panel.tsx:87`,
  `apps/web/src/app/(client)/selling/consignments/[id]/sent/page.tsx:40`).
- Each work is its own submission; there is no group object in the data. The wizard can already
  start from an earlier work for a bought lot or a returned unsold work (`fromLot`,
  `fromSubmission`, `apps/web/src/app/(client)/selling/new/page.tsx`): facts and photos come
  across, prices do not.
- The consignment row menu has View consignment, Download agreement (PDF), View lot, Copy
  reference (`apps/web/src/components/dashboard/seller/consignment-row.tsx:41`). There is a Draft
  stage, but **no way to delete a draft**: no menu item and no `DELETE /submissions/:id` route
  (`apps/api/src/routes/submissions/seller.routes.ts`).

The register's second missing action is not in the repository. This pack takes it to be
"Delete draft", the only workspace action with a stage and no way out (Q8 to confirm).

### Options: adding another work ("Duplicate last")

**A. "Sell another like this".** *Recommended.* On the sent panel (beside "Sell another work")
and in every consignment's row menu. Opens the wizard pre-filled from that work: artist,
category, medium, edition, signed, provenance. Not copied: title, photos, size, prices,
condition and notes, which differ per work. A notice at the top: "Started from {title}. Check
every step before you send it." Reuses the existing pre-fill path with a new `copyFrom` source.

**B. Multi-work consignment groups.** One submission holding many works with one agreement.
Closest to the word "group", but changes the submission, agreement, lot and payout models.
Revisit only if sellers bring collections often.

**C. "Add another work" on the review step**, saving this draft and opening a pre-filled one.
Faster for a batch, but mid-wizard branching is easy to lose; A covers the same need after
sending.

### Options: delete draft

**A. "Delete draft" in the draft's row menu and on the draft's page.** *Recommended.* Confirm
dialog "Delete this draft? Its photos and answers are removed. This cannot be undone." with
"Delete draft" (destructive). Owners, admins and the consignor who made it, as for withdraw.
Soft delete with a 30-day purge so support can restore.

**B. Drafts expire after 90 days untouched.** No action needed from clients, but work disappears
without warning.

### PR plan

1. **S.** "Sell another like this": `copyFrom` source in the wizard loader, field list, sent
   panel button and row menu item; tests.
2. **M.** Delete draft: soft-delete column (migration with rollback), `DELETE /submissions/:id`
   for drafts only, policy, purge job.
3. **S.** Delete draft UI: menu item, page action, confirm dialog, toast "Draft deleted",
   light/dark/375.

### Owner-only questions (default in brackets)

- Q7. Should photos come across in "like this" when the works are a series? [No.]
- Q8. Is "Delete draft" the second action the register names? [Yes; if not, name it and this
  part is redone.]

---

## References

- Baymard Institute, checkout usability and cart abandonment research (express checkout
  placement, guest checkout, checkout length): https://baymard.com/research/checkout-usability
- Baymard Institute, product list and filtering research:
  https://baymard.com/research/ecommerce-product-lists
- Stripe, Express Checkout Element: https://docs.stripe.com/elements/express-checkout-element
- Stripe, register payment method domains: https://docs.stripe.com/payments/payment-methods/pmd-registration
- Stripe, Checkout Sessions with Elements: https://docs.stripe.com/checkout/custom/quickstart
