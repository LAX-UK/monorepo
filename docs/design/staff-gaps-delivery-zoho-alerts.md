# Bid admin delivery screen, Zoho mirrored badge, release-alert log (design; build status in each section)

Register items GAP-47, GAP-18 and LA-3. The register is not in the repository, so each item is
taken as worded in the request: "Bid admin has no delivery screen", "'Mirrored to Zoho' badge in
LAX Admin" and "release-alert send log". This note proposes a recommended option for each so the
owner can approve or change it before anything is built. It was written before any of it was
built; where a part has since been built, its section says so and records what changed in the
build (for LA-3, "As built" at the end of section 3).

Every staff screen below uses the staff kit (`@auction/staff-ui`) and is audited against
`docs/design/staff-design-standard.md` (rule IDs such as `TBL-11` refer to it). All copy is plain
sentence case. Mockups: `docs/design/mockups/staff-gaps/` (`index.html` with PNGs at 1440 and 375, light and dark:
the Deliveries list with its queue panel, and every status badge proposed below). They are static
and illustrative only; the kit components are the source of truth. Names in them are made up.

How to approve: reply "approve as recommended", or name the recommendation and the alternative
(for example "D4: B"). Open questions go ahead on their stated default unless answered.

---

## 1. GAP-47: Bid admin delivery screen

### What exists today

- **Bid quote model.** `delivery_quote` (`packages/db/src/schema/delivery-quote.ts`, migration
  `0257`): one live quote per lot and buying account, statuses `requested`, `quoted`, `accepted`,
  `withdrawn`, with amount, currency, note and who/when for request, quote and decision. The moves
  are one table in `packages/domain/src/delivery-quote.ts`: the buyer requests, accepts or
  withdraws; staff quote (and can re-quote while `quoted`). An accepted quote is final and its
  price joins what the buyer owes (`payment_group_delivery`, migration `0325`).
- **Buyer side.** Buyers ask, accept and withdraw from their purchase page
  (`apps/web/src/components/dashboard/purchases/delivery-panel.tsx`, routes
  `POST /legal-entities/purchases/:lotId/delivery-quote[/accept|/withdraw]` in
  `apps/api/src/routes/organisation-buying.ts`).
- **Staff API with no screen.** `PUT /admin/lot-fulfilment/:lotId/delivery-quote` (body
  `{amount, note}`, `apps/api/src/routes/admin/lot-fulfilment.routes.ts:163`) prices a quote and
  tells the buyer. It is guarded by `operations.fulfilment` and listed as a dangerous staff action.
  **Nothing in Bid admin calls it, and no staff endpoint lists requested quotes.** A buyer's
  request today waits with nobody shown it. This is the gap.
- **Physical delivery.** After payment, Lot fulfilment (`/admin/lot-fulfilment`) moves a lot
  through `lot_fulfilment_status`: `awaiting_payment`, `awaiting_release`, `released`,
  `ready_for_collection`, `in_transit`, `delivered`, `cancelled`, with method `collection` or
  `shipping`, carrier, tracking and an address snapshot. Its only quote fact is
  `courierPaidWithInvoice`, used for courier refunds.
- **Collection desk.** Collections (`/admin/collections`, tabs Day, Upcoming, Not collected, Hours,
  Storage, Closures) handles bookings for lots collected in person. It is not part of this screen.
- **The model to copy.** LAX Admin › Orders › Delivery quotes (`/orders/delivery-quotes`) already
  does this job for the Shop: tabs "Waiting for a price", "Quoted", "Closed"; a "Send quote"
  dialog (`StaffFormDialog`, `MoneyInput`, `FormErrorSummary`) and a "Can't deliver" decline
  dialog; nav count of waiting quotes; read for `order.read`, write for `order.write`.

### Recommendations

**D1. One "Deliveries" page in Bid admin, Operations group, beside Lot fulfilment and
Collections.** *Recommended.*
Its job: every lot a buyer wants delivered rather than collected, from "asked for a price" to
"delivered", in one list, so no request waits unseen.
- Alternative A: a "Delivery quotes" tab inside Lot fulfilment. Fewer nav items, but Lot
  fulfilment only lists paid lots by fulfilment status, and a quote is usually asked before
  payment, so the tab would mix two lifecycles.
- Alternative B: a quotes-only page (a straight copy of LAX Admin). Fastest, but staff still jump
  to Lot fulfilment to see whether the courier collected. Can be shipped first as PR 2 of D9 and
  grown into D1.

**D2. The list follows one combined "delivery status", worked out from the quote and the lot's
fulfilment, never stored twice.** *Recommended.* View tabs (`TabNav`, URL tabs, counts per
`TBL-6`):

| Tab | Delivery status | Comes from | Badge (tone · shape) |
| --- | --- | --- | --- |
| Waiting for a price | Waiting for a price | quote `requested` | Warning · filled dot |
| Quoted | Quote sent | quote `quoted` | Info · filled dot |
| To dispatch | Booked, not dispatched | quote `accepted`, fulfilment not yet `in_transit` | Info · filled dot |
| On the way | On the way | fulfilment `in_transit`, method `shipping` | Info · filled dot |
| Delivered | Delivered | fulfilment `delivered` | Success · ✓ |
| Closed | Withdrawn by buyer / Cancelled | quote `withdrawn`, or fulfilment `cancelled` | Neutral · hollow ring |

"Waiting for a price" is the default tab and the only one with a nav count (`NAV-3`, attention
tone, ", 3 waiting" for screen readers), the same count as the tab. Status labels come from one
`defineStatusMap(deliveryStatus)` registered in `staffStatus` (`CRF-7`); pages never pick a tone.
A lot that is `accepted` but not yet paid shows "Booked, not dispatched" with a second badge
"Awaiting payment" (Neutral · ring), at most two badges a row.
- Alternative: two separate status columns (quote, fulfilment). More honest to the data, but staff
  have to combine them in their heads on every row.

**D3. List layout (`ListPage` + `DataTable`, 50 rows, newest request first in "Waiting for a
price", oldest-waiting first selectable).** Columns, in order (`TBL-2`):
1. Lot: thumbnail, "Lot 42 · Title", and the sale and its close date on a second line
   (`StackedCell`, `CellThumbnail`); the row is a link (`TBL-8`). The sale shares the cell so the
   price and waiting columns stay in view beside the 480 px panel.
2. Buyer: account name and paddle (`PersonCell`).
3. Destination: country, then town (the quote's `destination`, truncated with full text on focus,
   `TBL-14`).
4. Status: badge (D2).
5. Price: `StaffMoney`, right-aligned, "–" before a quote (`TBL-13`).
6. Waiting: "Asked 2 days ago" (`RelativeTime`, absolute London time in the title) in "Waiting for
   a price"; "Quoted 1 day ago" in "Quoted"; carrier and tracking in "On the way".
7. `…` row menu (persistent): Send quote / Change quote, Open lot fulfilment, Copy lot number.

Toolbar: one search field (lot number, paddle, buyer, destination), filters Sale and Destination
country, removable chips (`TBL-5`). At 375 px the table stacks (`TBL-16`): title "Lot 42 · Title",
status badge on the right, meta "Buyer · Destination · £price".

**D4. A row opens a queue panel, not a new page.** *Recommended.* Pricing quotes is a work queue
(`PRD-7`): staff decide on many rows in turn and the decision fits in a panel. `DetailPanel` with
`useQueuePanel` (480 px, "3 of 12", J/K, URL `?record=<lotId>`, Back closes):
- Header: "Lot 42 · Title", status badge, meta "Buyer", "Sale", "Asked {date}". Header action
  "Open full page" goes to the lot's fulfilment record.
- Summary (`KeyValueList`): Destination (full text, copyable), Buyer's note, Size and weight as
  catalogued, Hammer price, Paid or not, Storage (the collect-by line from storage terms, since a
  quote LAX still owes pauses storage, `ST5`).
- Quote section: current price, note to the buyer, quoted by and when.
- Delivery section (once accepted): method, carrier, tracking (copyable), fulfilment status, with
  the existing Lot fulfilment actions linked, not duplicated.
- Activity (`Timeline`): requested, quoted, re-quoted, accepted, withdrawn, dispatched, delivered,
  each with actor and London time.
- Footer: the primary action for the state (`PRD-2`).
- Alternative: full record page per delivery. Use only if D1 grows beyond quotes later.

**D5. Actions and permissions.**

| Action | When | Who | Pattern |
| --- | --- | --- | --- |
| Send quote | Waiting for a price | `operations.fulfilment`, `platform.admin.full` | Footer primary; dialog with Price (`MoneyInput`, required, above zero as the route already checks; a ceiling is Q2) and "Note to the buyer" (optional, 500 chars). Confirms (money to a customer): "Send a quote of £180.00 to {buyer}? They are emailed and can accept it from their purchase page." |
| Change quote | Quote sent | same | Same dialog, pre-filled; copy "Send the new quote" and "The buyer is emailed the new price. The old one can no longer be accepted." |
| Can't deliver | Waiting for a price or Quote sent | same | **Not built today for Bid.** Needs D8. Dialog with a required reason to the buyer; ends the quote as withdrawn. |
| Open lot fulfilment | any | `LOT_FULFILMENT_ACCESS` | Link. Dispatch, tracking and delivered stay in Lot fulfilment. |
| View only | any | roles that can read Lot fulfilment but not write | Read-only panel (`PRM-3`), no footer, `ViewOnlyBadge`. |

The page is hidden from roles without `LOT_FULFILMENT_ACCESS` (`PRM-1`). Server checks stay on the
routes (`PRM-4`); `PUT …/delivery-quote` is a dangerous staff action already, so it keeps its
audit row and needs no step-up beyond what that list already applies.

**D6. States.**
- First load: `ListPageSkeleton`, 8 rows (`TBL-11`). Refetch: rows at 60 % with `aria-busy`.
- Empty, Waiting for a price: "No buyers are waiting for a delivery price. When a buyer asks for
  delivery on a won lot, it appears here." No action (staff cannot create a request).
- Empty, other tabs: "No deliveries on the way." / "Nothing delivered yet." / "No closed quotes."
- No results: "No deliveries match "Paris"." with "Clear filters".
- Error: "Deliveries could not be loaded. Try again." with Try again, `role="alert"`.
- Panel error on save: in the dialog, never a toast (`FBK-1`). Stale state (buyer withdrew while
  the dialog was open, API `quote_changed` or `quote_step_not_allowed`): Notice "The buyer changed
  this request while you were pricing it. Check it and try again." and the panel reloads.
- Saved: toast "Quote sent for Lot 42" (5 s).

**D7. Data: what exists and what is needed.**

| Need | Exists | Needed |
| --- | --- | --- |
| Price or re-price a quote | `PUT /admin/lot-fulfilment/:lotId/delivery-quote` | Add an `Idempotency-Key` like the Shop routes, so a double submit sends one email. |
| List quotes by view, with search, filters, paging | No | `GET /admin/deliveries?view=waiting\|quoted\|to_dispatch\|on_the_way\|delivered\|closed&q=&saleId=&country=&cursor=` returning lot, sale, buyer, destination, quote, fulfilment summary. Read model joins `delivery_quote` and `lot_fulfilment`; no new table. |
| Nav count | No | `GET /admin/deliveries/summary` → `{waitingCount}`, added to the existing nav counts. |
| One delivery for the panel | Partly (`GET /admin/lot-fulfilment/:lotId`) | Extend it, or add `GET /admin/deliveries/:lotId`, with the quote and its history. |
| Staff decline | No (Shop has `deliveryQuoteDecline`) | `POST /admin/deliveries/:lotId/decline {quoteId, expectedStatus, reason}` and a staff step in the Bid table of moves (D8). The quote id and status name the request staff saw, so a buyer who withdrew and asked again, or a colleague who priced it, gets `quote_changed` (D6) rather than a reason meant for another request. |
| History | Columns on the quote only (requested/quoted/decided at and by) | Enough for the first release; a full event history would read the domain events the service already raises, if any, else show the three stamps. |

**D8. Staff can turn a request down ("Can't deliver").** *Recommended*, matching LAX Admin. Today
only the buyer can withdraw, so a request to somewhere LAX will not ship sits forever. Adds a
staff `decline` step from `requested` or `quoted` to `withdrawn`, with a reason column on
`delivery_quote` (one additive migration in its own PR, with rollback) and a buyer email.
- Alternative: no decline; staff phone or email the buyer and ask them to withdraw. No migration,
  but the list fills with dead requests.

**D9. Build plan (each PR small, kit only, light/dark/375 screenshots per PR).**
1. Read model and API: `GET /admin/deliveries`, `/summary`, `/:lotId`; idempotency key on the
   quote route; contract tests. No UI.
2. Page, split in two (decided at the review of #1520):
   - 2a. Read-only page: list, tabs, nav item and count, states, and the queue panel without
     actions (#1520).
   - 2b. Send quote and Change quote in the queue panel, and the `/admin/deliveries` visual
     baseline added to `apps/web/e2e/admin-pages-visual.spec.ts`.
3. Decline (D8): migration with rollback, domain step, route, dialog, buyer email.
4. Polish and the To dispatch / On the way / Delivered tabs linking to Lot fulfilment actions.

### Open questions (default in brackets)

- Q1. Who prices Bid deliveries: Fulfilment only, or also Sale managers? [Fulfilment and Admin,
  as the route allows today.]
- Q2. A highest price the form accepts, or a second approver above some amount? [Neither in the
  first release; the confirm dialog is enough at today's volume.]
- Q3. Should a quote expire (the Shop has `hold_until` and `expired`)? [No expiry in the first
  release; revisit after D8.]
- Q4. Name in the nav: "Deliveries" or "Delivery quotes"? ["Deliveries", since it covers the
  whole route to the door.]

### Accessibility, themes and phone

- Status is said in words and shape, never colour alone (`CRF-7`); the nav count is announced
  (", 3 waiting").
- The panel takes focus on its title, Esc returns to the row, J/K are announced ("4 of 12").
- The quote dialog uses `FormErrorSummary` only when two fields fail; one failure focuses the
  price field with "Enter an amount above zero" (the route's existing message) (the storage-terms exception to
  `FRM-4`, short dialog, field in view).
- Light and dark from kit tokens only; no new colours.
- 375 px: stacked rows, panel full-screen with the footer kept in view, actions under the title.
  Send quote is one of the `MOB-1` tasks ("approve or reject a queue item") and must work
  one-handed.

---

## 2. GAP-18: "Mirrored to Zoho" badge in LAX Admin

### What exists today

- LAX mirrors to Zoho one way, by background consumers (`docs/integrations/zoho.md`): artwork
  status and stock code (`zoho_artwork_writeback`), the LAX listing fields (`zoho_artwork_listing`),
  and paid Shop orders' prints, framing and dispatch plus print groups (`zoho_fulfilment`, under
  `ZOHO_FULFILMENT_MIRROR_MODE` `off` / `dry_run` / `live`).
- **There is no per-record "mirrored" flag.** The status lives per event and consumer in
  `domain_event_delivery`: `pending`, `processing`, `succeeded`, `skipped`, `retryable`,
  `dead_lettered`, with `attempts`, `next_retry_at`, `provider_reference` and a redacted
  `last_error`. Events point at their record through `domain_event.aggregate_type` /
  `aggregate_id`; the order mirror's events carry `orderId` in the payload.
- LAX Admin shows Zoho state only in From Zoho › Sync health and Last check (artwork register).
  No order, framing job or artwork page says whether it reached Zoho. Dead letters are handled in
  Failed jobs.

### Recommendations

**Z1. Where it appears.** *Recommended:* the order page header (paid Shop orders) and the
artwork's From Zoho record, as one status badge beside the existing ones (max two, `PRD-1`), plus
an optional "Zoho" column on the Orders list hidden by default (`TBL-12`).
- Alternative A: order page only (the fulfilment mirror is the newest and least watched).
- Alternative B: a section "Zoho" in the side column instead of a header badge. Quieter, but a
  failure would sit below the fold.

**Z2. One derived state per record, read from the existing ledger, nothing new stored.**
*Recommended.* For a record, take its events for the relevant consumer and use the latest
delivery's outcome, except that any `dead_lettered` delivery not since superseded by a later
`succeeded` one wins:

| State | Derived from | Badge (tone · shape) | Label |
| --- | --- | --- | --- |
| Mirrored | latest delivery `succeeded` | Success · ✓ | Mirrored to Zoho |
| Pending | `pending`, `processing` or `retryable` | Info · filled dot | Sending to Zoho |
| Failed | `dead_lettered`, not superseded | Danger · ! | Not in Zoho |
| Not applicable | mode `off`, unpaid order, original outside the register, or latest delivery `skipped` for a "nothing to mirror" reason | no badge in the header; "Not mirrored" in the details | — |
| Dry run | mode `dry_run` | Neutral · ring | Zoho dry run |

`skipped` with reason `order_prints_not_mirrored` counts as Failed (the order already failed for
staff, per `docs/integrations/zoho.md`). "Not applicable" shows no badge so it does not become
wallpaper; Mirrored is shown, since staff asked to see it.
- Alternative: store a `zoho_mirror_status` column on each record, updated by the consumer. Faster
  to read, but a second copy that can drift, and one migration per table.

**Z3. Wording and details.** The badge is a button that opens a small popover (and on touch, a
bottom sheet), since a phone has no hover; no hover-only tooltip.
- Mirrored: "Mirrored to Zoho · Last sent {14 Nov 2026, 16:02}. Dispatch record LAX-S-10482."
  with "Copy Zoho record ID" when `provider_reference` holds one.
- Pending: "Sending to Zoho · Waiting to send the latest change. Tries again at 16:10 (attempt 2)."
- Failed: "Not in Zoho · Zoho refused the last change: {redacted last_error}. Staff in Failed jobs
  can fix and replay it." with link "Open in Failed jobs" for those who can (hidden otherwise,
  `PRM-1`).
- Not applicable (details only): "Not mirrored · Zoho mirroring is off." / "Not mirrored · Only
  paid orders are sent to Zoho." / "Not mirrored · This original is not in the artwork register."
- Dry run: "Zoho dry run · LAX worked out what it would send and wrote nothing to Zoho."

**Z4. How it reads the status.** A small read endpoint per surface, using the same
`artwork_register.read` / `order.read` capabilities as the page:
`GET /admin/v1/zoho-mirror/status?entity=order|artwork&id=…` →
`{state, consumer, lastAttemptAt, nextRetryAt, attempts, providerReference, error, mode}`, plus a
batched form for the Orders list column. It reads `domain_event_delivery` joined to
`domain_event` by aggregate or by payload `orderId`; an index on the payload key may be needed
(checked in PR 1 against the query plan). The mode comes from `zoho_sync_health`. `last_error` is
already redacted; no buyer data is shown.

**Z5. Build plan.** 1: read model and endpoint with tests. 2: badge and details on the order page.
3: artwork record and the optional Orders column. Each with light/dark/375 screenshots.

### Open questions (default in brackets)

- Q5. Show "Mirrored" on every record, or only Pending and Failed? [Show all three; the owner asked
  for a "mirrored" badge.]
- Q6. Should Bid admin (invoices to Zoho Books, `accounting_document.state`) get the same badge?
  [Not in this item; the same Z2 states can be reused later.]
- Q7. Who sees the Failed jobs link? [Whoever can open Failed jobs today.]

### Accessibility, themes and phone

- Badge text alone carries the state; shapes differ (✓, dot, !, ring) for grey-scale.
- The badge button has an accessible name "Zoho: Mirrored to Zoho, details"; the popover is a
  dialog with focus moved in and Esc back to the badge.
- Light and dark from kit tones. At 375 px the badge wraps under the title with the other badge;
  details open as a bottom sheet with a 44 px close target.

---

## 3. LA-3: release-alert send log

### What exists today

- Publishing an edition in LAX Admin opens a confirm dialog with the checkbox **"Tell
  subscribers"** ("Emails everyone who asked to hear about new editions. Each person is emailed
  once for this edition.", ticked by default, only for edition releases and staff with write;
  `apps/shop-admin/src/components/artworks/artwork-editor.client.tsx:1528`). The bulk publish on
  the artworks list has the same choice.
- On publish, `ShopAlertPublishRecorder` writes one `shop_alert_announcement` row per work
  (`item_key`, `announced_at`, `announce`, `expanded_at`) and returns how many confirmed
  subscribers will be told. That number is shown once, in a toast: "Release alert queued for N
  subscribers." It is not kept.
- Sends: each subscriber's matches (`shop_alert_match`, by `item_key`) are gathered into one
  digest per person and London day (`shop_alert_digest`, `sent_at` once on the outbox).
- Leads page: two figures, "Release alert subscribers" and "Awaiting confirmation"
  (`GET /admin/v1/release-alerts/summary`, `lead.read`). This is the only staff view: a count of
  people, nothing about sends.

### Recommendations

**L1. A "Release alerts" log on the Leads page, as a second view tab beside the leads list.**
*Recommended.* Staff who look after the list already go there, and the two figures sit above it.
- Alternative A: a section on each artwork's page ("Release alert: sent to 412 people on 14 Nov").
  Good for "did this one go?", useless for "what went out this week?". Recommended as a follow-up
  (L4).
- Alternative B: a page under Settings. Hides it from the people who use it.

**L2. One row per published release, newest first.** Columns: Edition (thumbnail, title, link to
the artwork), Published (London date and time, and by whom), Told subscribers (Yes / No, from
`announce`), People matched (count of `shop_alert_match` rows for the item), Emailed (matches in a
digest with `sent_at`), Waiting (matched, not yet in a sent digest), Not sent (dropped, with the
reason in the details). Status badge per row:

| Status | Rule | Badge |
| --- | --- | --- |
| Not announced | `announce` false | Neutral · ring · "Not announced" |
| Queued | announced, not yet expanded into matches | Info · dot · "Queued" |
| Sending | some matches waiting for a digest | Info · dot · "Sending" |
| Sent | all matches emailed or dropped | Success · ✓ · "Sent" |
| Stuck | a digest unsent for more than a day | Danger · ! · "Not sent yet" |

Row opens a small panel (a record with no page, `PRD-7`): the counts, the dropped reasons as plain
sentences, and "Publisher chose not to tell subscribers." when `announce` is false. No subscriber
names or emails are shown in the log; it is about sends, not people.

**L3. Data.** `GET /admin/v1/release-alerts/sends?cursor=` (`lead.read`) aggregates
`shop_alert_announcement` with counts from `shop_alert_match` and `shop_alert_digest`. Two gaps:
- **Who published** is not on the announcement. *Recommended:* read it from the artwork's audit
  row for the publish (no migration). Alternative: add `announced_by` to the announcement
  (migration).
- **Counts age out** when the match retention prune removes settled matches. *Recommended:* store
  the counts on the announcement once all its matches are settled (`emailed_count`,
  `dropped_count`, one small additive migration), so the log stays true after pruning.
  Alternative: show "Details no longer kept" for older rows.

**L4. Later:** the per-artwork line from L1 alternative A, and the "Release alert queued for N
subscribers" toast kept as the "People matched" figure.

**L5. States.** Empty: "No release alerts yet. When you publish an edition and tick Tell
subscribers, it appears here." Loading: skeleton rows. Error: "Release alerts could not be
loaded. Try again." No results: "No releases match "{search}"." with Clear filters.

**L6. Screenshot plan for the current Leads count and the publish checkbox.** Real components with
fixtures, true viewport captures at 1440 × 1000 and 375 × 812, light and dark, named
`{state}-{width}-{theme}.png` in `docs/design/screenshots/release-alerts/` with a README, as the
storage-tab folders do. Taken in the PR that builds L1 (before and after), and also usable on
their own to record today's state.

| State | Screen | Fixture |
| --- | --- | --- |
| `leads-count` | Leads, Release alerts figures above the list | 412 confirmed, 9 awaiting |
| `leads-count-empty` | Leads, nobody confirmed | 0 and 0: "Nobody has confirmed yet" |
| `publish-tell-subscribers` | Artwork editor, Publish confirm dialog with "Tell subscribers" ticked | an unpublished edition release |
| `publish-not-edition` | Same dialog for an original: no checkbox | an original |
| `publish-toast` | After publish: "Release alert queued for 412 subscribers." | as first |
| `bulk-publish` | Artworks list, bulk publish dialog with the choice | 3 editions selected |
| `send-log` (after L1) | Leads › Release alerts, mixed statuses | one row per status in L2 |

Checks on each capture: no horizontal scroll at 375 px, the checkbox and its description wrap
cleanly, the toast does not cover the dialog's buttons, counts read the same in the figures and
the toast. Captured with Playwright against the shop-admin visual fixtures
(`apps/shop-admin/e2e/support/lax-admin-pages.ts`); no real names or emails in fixtures.

### Open questions (default in brackets)

- Q8. Log on Leads (L1) or on Overview? [Leads.]
- Q9. Show subscriber-level detail (who was emailed)? [No; counts only, to keep personal data out
  of a log many roles read.]
- Q10. Keep the counts after pruning with a small migration (L3)? [Yes.]
- Q11. Should unticking "Tell subscribers" ask "Are you sure?" [No; it is the publisher's choice
  and the log records it.]

### Accessibility, themes and phone

- Counts are digits with labels ("Emailed 398"), right-aligned (`TBL-13`); the status badge says
  the state in words.
- The view tab carries no count (it is history, not a queue, `NAV-3`).
- Light and dark from kit tokens; at 375 px the table stacks to "Edition · status · Emailed 398 of
  412".

### As built (PR 1 #1519, PR 2 #1529)

L1, L2, L3 and L5 are built, and the L6 screenshots are taken. L4 is still a follow-up.

- **L1 / Q8.** A **Release alerts** view tab on Leads, after the lead tabs, at
  `/leads/release-alerts`, shown to roles with `lead.read`. No count on it (`NAV-3`).
- **L2.** The columns and badges are as above, with one more status, **Counts not kept** (neutral
  ✓), for releases from before the counts were kept (L3's alternative, used only for those rows).
  Counts are right-aligned (`TBL-13`). At 375 px a row reads "Edition · status · Emailed 398 of
  412"; a queued release, whose people are not worked out yet, shows only its badge rather than
  "Emailed 0 of 0".
- **The Edition title opens the release's panel, not the artwork.** A release has no page of its
  own, so its panel is the record (`TBL-8`, `PRD-7`): the title links to the panel's URL
  (`?release=`), and the artwork is reached from the panel's "Open artwork" or the row's `…`,
  for roles that can open artworks. This replaces "link to the artwork" in L2.
- **A panel link to a release on another page opens it** (`PRD-7`): the page reads that one
  release (`GET /admin/v1/release-alerts/sends/:artworkId`, `lead.read`) and opens its panel. A
  link naming no release in the log opens a panel that says "Release alert not found".
- **L3.** Who published, and the matched, emailed and dropped counts, are kept on the announcement
  (migration 0405, the alternatives above) rather than read from the audit log; so the log stays
  true after the prune, with no audit lookup.
- **L5.** Empty, loading, error and permission-denied states are built. **There is no "No results"
  state**, because the log has no search or filters; it comes with search, if that is added.
- **L6.** The captures, with the send log's own states, are in
  `docs/design/screenshots/release-alerts/` with a README. The browser gate seeds one release per
  status (`seed:release-alert-sends`, hermetic local databases only, with one long title) and runs
  with `ALERTS_SEND_MODE=off` pinned, so the scheduler's digest task leaves the fixtures as they
  are.

---

## Summary of recommendations

| ID | Recommendation | Main alternative |
| --- | --- | --- |
| D1 | One Deliveries page in Bid admin › Operations | Tab in Lot fulfilment; quotes-only page |
| D2 | One combined delivery status, six tabs, nav count on Waiting for a price | Two status columns |
| D3 | `ListPage` list with lot, sale, buyer, destination, status, price, waiting | — |
| D4 | Queue panel with J/K | Full record page |
| D5 | Send / change quote for Fulfilment and Admin; view-only for readers | — |
| D6 | Kit empty, loading, error, no results and stale states | — |
| D7 | New list, summary and detail reads; idempotency on the quote route | — |
| D8 | Staff "Can't deliver" with a reason (migration) | No decline |
| D9 | Four PRs: API, page (2a read-only, 2b quote actions and baseline), decline, polish | — |
| Z1 | Badge on the order page and the artwork record; optional Orders column | Order page only; side section |
| Z2 | State derived from `domain_event_delivery`, nothing stored | Status column per record |
| Z3 | Clickable badge with details, wording above | Hover tooltip (not on phones) |
| Z4 | One read endpoint, batched for lists | — |
| Z5 | Three PRs | — |
| L1 | Release alerts view tab on Leads | Per-artwork line; Settings page |
| L2 | One row per release with matched, emailed, waiting, not sent | — |
| L3 | Publisher from audit; counts kept on the announcement (migration) | `announced_by` column; "no longer kept" |
| L4 | Per-artwork line later | — |
| L5 | Kit states and copy | — |
| L6 | Screenshot set for Leads count and Tell subscribers | — |
