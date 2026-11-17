Verdict: SHIP

# Review of PR #1531: Bid admin Deliveries, part 2b (send and change a delivery quote)

Reviewed head `ce4582b3` against the approved design `docs/design/staff-gaps-delivery-zoho-alerts.md`
(GAP-47, D1 to D9; this PR is D9 step 2b: "Send quote and Change quote in the queue panel, and the
`/admin/deliveries` visual baseline"). I read the API route, domain table of moves, idempotency
middleware and buyer notifier the PR relies on, plus the open part 3 PR (#1528, decline) to check the
two work together.

## What was run

On the PR head in a separate worktree (`pnpm install --frozen-lockfile`, then the workspace
dependencies of `@auction/web` built):

- `vitest run` over `src/components/admin/deliveries`, `src/lib/admin/deliveries` and
  `src/lib/actions/admin/admin-deliveries.test.ts`: 8 files, 124 tests, all pass.
- `tsc --noEmit -p apps/web`: clean.
- `biome check` on the 16 changed TS/TSX files: clean.
- `lint:ui-guardrails`, `lint:web-guardrails`, `lint:admin-capability-drift`,
  `lint:client-boundary`: all pass.
- Not run: the Playwright journey `apps/web/e2e/admin-deliveries-quote.spec.ts` and
  `admin-pages-visual.spec.ts`. They need the full API, database and seeded stack, which this run
  did not have. I checked the committed baselines and the PR-evidence screenshots by eye instead
  (see below).

## Against the design

| Design point | Result |
| --- | --- |
| D5 Send quote while `requested`, Change quote while `quoted`, nothing after | Met. `quoteActionFor` (`apps/web/src/lib/admin/deliveries/delivery-quote-form.ts:24`) follows the domain's `quote` step (`requested`/`quoted` → `quoted`). Row menu puts the action first (`deliveries-list.tsx`, `quoteRowAction`). Panel footer is the primary action (`delivery-panel.tsx:189`). |
| D5 permissions, server-side | Met. The server action checks `DELIVERIES_ACCESS` (= `operations.fulfilment` or `platform.admin.full`) before anything else (`apps/web/src/lib/actions/admin/admin-deliveries.ts:68`). The API route still checks `requireOperationsFulfilment` and step-up. Read-only staff get no footer, no row action, no dialog (`canWork` gates all three). |
| D5 confirm copy (money to a customer) | Met word for word for both send and change (`deliveries-copy.ts:238-241`). |
| D5 price above zero, note 500 chars, no ceiling (Q2) | Met. Only the route's own format limit is enforced (`MAX_PRICE_PENCE`). One failure focuses the price with "Enter an amount above zero"; summary only when two fields fail, as the design's accessibility note says. |
| D6 errors stay in the dialog, stale notice, toast "Quote sent for Lot 42" (5 s) | Met (`delivery-quote-dialog.tsx:152-164`, `delivery-panel.tsx:175-181`). `quote_changed`, `quote_step_not_allowed` and `purchase_not_found` all map to the design's stale wording. |
| D7 Idempotency-Key so a double submit sends one email | Met. One key per dialog opening (`delivery-quote-dialog.tsx:89`), sent as `Idempotency-Key`; the route's `guards.idempotent("fulfilment.delivery-quote")` stores only 2xx answers, and the action's pre-read turns a retry after a lost answer into success without a second PUT (`admin-deliveries.ts:90`). |
| D9 2b `/admin/deliveries` visual baseline | Met. Case added to `apps/web/e2e/admin-visual-cases.ts`, four baselines committed (desktop/mobile × light/dark). |

## Correctness

- **State machine.** No new states or moves; the web only offers what the domain table allows and
  the route's compare-and-set on status remains the final check. A buyer withdraw or accept, or a
  part 3 decline (which also ends at `withdrawn` through the same `transition(id, status, …)`
  compare-and-set in #1528), makes the PUT fail with `quote_changed`/`quote_step_not_allowed`,
  shown as the stale notice. No lost update.
- **Money.** Whole pence end to end in the web (`MoneyInput` → `number` → zod `int().positive()`),
  converted once to the route's decimal pounds string with the domain's
  `minorUnitsToMoneyString(BigInt(pence))` (`delivery-quote-form.ts:73`). No floats.
- **VAT.** The design says nothing about VAT for delivery quotes, and the route, table and buyer
  page carry a single gross amount. The PR adds no VAT handling and none was designed, so nothing to
  check against. The hint "insurance included" matches the buyer page ("Insured delivery to …").
- **Concurrency between staff.** The pre-read in the action catches a colleague's price
  (`already_quoted`) instead of silently overwriting it; the code comment is honest that read and
  write are not one transaction, so two simultaneous senders can still both succeed (last write
  wins, both emails go). The design asks for no more than that.

## Security

- Server-side capability check on the action and on the route (above). The lot id is validated as a
  UUID and URL-encoded.
- Only the buyer is notified: the existing `DeliveryQuoteReadyNotifier` sends to
  `quote.requestedByUserId` for that quote's account only. The PR does not touch it.

## Findings

None block shipping. In order of importance:

1. **Medium (existing API behaviour the new UI now exposes): "The buyer is emailed the new price"
   is not always true.** The notifier's key is `delivery-quote:${quote.id}:${quote.amount}`
   (`apps/api/src/services/organisation-buying/delivery-quote-ready-notifier.ts:29`), used as both
   the in-app dedupe key and the email provider's idempotency key. So (a) a Change quote that only
   edits the note sends no notice, and (b) changing £180 → £210 → £180 within the dedupe window
   does not tell the buyer about the return to £180, though the change confirmation
   (`apps/web/src/lib/admin/deliveries/deliveries-copy.ts:241`) says they are emailed. The buyer's
   purchase page always shows the right price, so nobody can accept a wrong amount, which is why
   this does not block. Follow-up: key on the quote revision (for example `quotedAt`) rather than the
   amount, or refuse a change that leaves the price unchanged in `checkQuoteForm`.
2. **Low: the stale notice always blames the buyer.** `quote_changed` is reported as
   `{ kind: "moved", by: "buyer" }` with "The buyer changed this request…"
   (`apps/web/src/components/admin/deliveries/delivery-quote-dialog.tsx:152-154`). Once #1528 lands,
   a colleague's "Can't deliver" produces the same code and the same words. Worth a wording or code
   tweak in part 3.
3. **Low: a lost answer on Change quote followed by a re-price is reported as a colleague's
   price.** If the first PUT succeeded but its answer was lost, and the person goes Back and enters
   a different amount, `quoteDrift` returns `already_quoted` and the dialog says "Someone at LAX
   quoted this delivery" (`apps/web/src/lib/actions/admin/admin-deliveries.ts:90-102`). Safe (no
   overwrite), just misattributed.
4. **Nit: currency hard-coded in three places.** `formatStaffMoney(…, "GBP")` at
   `delivery-quote-dialog.tsx:150`, `:227` and `:242`, while `:300` uses `row.quote.currency`. The
   route only takes pounds and the column defaults to GBP, so harmless today; use one source.
5. **Nit: the visual baseline is the empty state only.** The demo seed has no delivery requests
   (`apps/web/e2e/admin-visual-cases.ts`, new case comment), so the committed `/admin/deliveries`
   baselines never show a row, badge or price. The populated states are covered by the journey's
   PR-evidence screenshots, which are not regression-checked.

## States, layout, themes

Checked the committed baselines and the 28 PR-evidence screenshots
(`docs/pr-evidence/bid-admin-deliveries-quote/`): send form, send error, send confirm, sent, change
form, change confirm and stale, each at 1440 and 375 px in light and dark. Kit tokens only, no new
colours; long buyer/address text wraps in the dialog description; at 375 px the dialog's footer
buttons stack full width and the panel footer button fills the row (`max-sm:flex-1`). Loading is
`loading`/`aria-busy` on the submit with Back disabled and the dialog unclosable while sending. The
empty, no-results, error and not-found states are unchanged from #1520.

## Clean code and kit reuse

Uses the shared staff-ui kit throughout (`StaffDialog`, `Field`, `MoneyInput`, `TextArea`,
`FormErrorSummary`, `Notice`, `StaffButton`, `useStaffStepUp`, `formatStaffMoney`), with no local
re-implementations. Rules live in a pure module (`delivery-quote-form.ts`) with its own tests; the
server action is injectable into the dialog and panel for tests; every word is in
`deliveries-copy.ts`. The panel's footer leaves a marked seam for part 3's secondary action.
