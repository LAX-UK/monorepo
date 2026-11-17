Verdict: FIX FIRST

# Review of PR #1554: Consignor agreements, part 4 (ZI-5): move dialogs read the agreement

- **What was reviewed:** head `ee1159a1`, only this PR's own changes (`origin/zi-5-consignor-agreements-admin...ee1159a1`). #1552 has not merged yet.
- **Checked against:**
  - `docs/design/decision-pack-2026-11-17.md` section 1: option B, PR plan step 4, approved with the defaults Q1 (lax.art shows the line and never blocks) and Q2 (checkbox fallback until 31 January 2027).
  - Part 1 on main (#1545, migration 0407).
- The PR branch was not changed.

## Blocking

1. **The lowest price agreed is sent to people who may not read the consignor's agreements, including the Read-only role.**
   - **Where:** `apps/shop-api/src/routes/admin/v1/move-agreement-viewer.ts:27-28` blanks only `consignor` and `agreement`. `lowestPricePence`, set in `move-agreement.service.ts:76`, is always returned.
   - **Who can call it:** the assessment GETs check only read capabilities.
     - `GET /artworks/:id/auction-offer` needs `catalogue.read` (`inventory-moves.routes.ts:51`).
     - `GET /artwork-register/:registerId/auction-offer` needs `artwork_register.read` (`inventory-moves.routes.ts:81`).
     - `GET /artwork-register/:registerId/lax-art-offer` needs `artwork_register.read` (`admin-offer-on-lax-art.routes.ts:46`).
     - Read-only holds both of these capabilities (`READ_ONLY_CAPABILITIES`, `packages/shop-domain/src/staff-capabilities.ts:126-133`).
   - **Why the stated reason doesn't hold:** the contract comment (`packages/shop-contracts/src/admin-move-agreement.ts:10-12`) says the lowest price is "for everyone who can move the work". These routes never check the move capabilities.
   - **Failure scenario:** a Read-only user, who has no `consignor_agreement.read`, calls `GET /admin/v1/artwork-register/{id}/auction-offer`. The response includes `lowestPricePence: 200000`, a commercial term of a client's agreement.
   - **Fix:** in `moveAgreementForViewer`, keep `lowestPricePence` only when `canRead` is true or the request holds the move capabilities. The dialog compares the price live, so a server-computed boolean won't do.
   - **Test:** add a route test for the Read-only role.

## Non-blocking

1. **Race between the agreement read and recording the move.**
   - `original-move.service.ts:246-249` reads the agreement outside any transaction. Then `createDraftLot` (a call to LAX Bid), `withdrawFromLaxArt` and `recordMoveConfirmed` (`:285`) run.
   - An agreement retired in that window still lets the move go ahead and is recorded as `in_force`. The window is short, and a single transaction can't span the call to LAX Bid, so this is acceptable.
   - The "Read again here" comment overstates the guarantee.
   - A retry that crosses London midnight after an expiry is refused at `:249`, leaving the LAX Bid draft lot with no history entry.
   - `offer-on-lax-art.service.ts:82` has the same pattern, but there it only affects how accurate the history is.
2. **Copy differs from the approved text.**
   - Not covered: the design reads "No agreement covers LAX Bid for {consignor}." The code adds a reason, such as ": the last one ended on 31 Oct 2026." (`apps/shop-admin/src/lib/move-agreement-line.ts:89`, `reasonOf` at `:99-110`).
   - Lowest price: the design shows "£2,000", the code shows "£2,000.00" (`:33`).
   - "Signed {date}" shows `startsOn` (`:81`), because agreements have no signed date. That is a reasonable reading, but the PR should say so.
   - None of these changes the meaning.
3. **"Set consignor" link.**
   - It points to `/from-zoho/{id}#consignor` (`move-agreement-line.ts:49`). #1553's Consignor section has no `id="consignor"`, so the link lands at the top of the record. Add the id in whichever PR lands second.
   - The link is also shown to people without `consignor_agreement.manage`, who can't set a consignor. The type comment at `:16` promises it only "when this person can act on it". Gate it the way `canAddAgreement` is gated.
4. **New history entries say nothing about the agreement.**
   - `apps/shop-admin/src/server/domain/zoho-register.vm.ts:593` still words only `consignorAgreed`. Old entries correctly keep "Consignor agreement confirmed" (design satisfied).
   - New entries record `consignorAgreement` but show no line for it. Consider "Covered by agreement v{n}" in a follow-up.
5. **Raw history payloads now carry `consignorPartyId`, `agreementId` and `agreementVersionId`.** Anyone with `artwork_register.read` can see them (`packages/shop-contracts/src/admin-artwork-register.ts:223`, `Type.Record(… Unknown)`). These are opaque ids, so this is minor.
6. **Duplicated logic.**
   - `agreementDayText` (`move-agreement-line.ts:26-29`) uses `resolveWallClock` + `formatDate`. #1552's view model uses `formatStaffDate`, so the same agreement shows different date styles on the two screens.
   - `PLACE_NAMES` is defined twice (`move-agreement.service.ts:18`, `move-agreement-line.ts:20`), although `CONSIGNMENT_PLACE_LABELS` already exists in contracts.
   - The state rules in `readMoveAgreement` match #1552's `agreementState` but are not shared.
   - `createDrizzleMoveAgreementReads` overlaps #1553's `drizzle-artwork-consignor.ts` reads.
   - No conflict with any of these; consolidate them in a follow-up.
7. **Test gaps.**
   - No service or route test refuses a no-consignor move after 31 January 2027. Only the pure rule is tested (`move-agreement.test.ts:110-131`).
   - No test covers a UTC instant near London midnight.
   - No test covers an assigned broker seeing the name: the route tests only stub `brokerCanAccessClientParty` → false.
   - No test covers an agreement retired while the dialog is open.
8. **Screenshots.** The README matches the 48 files. Missing shots:
   - LAX owns the work (no line);
   - the blocked no-consignor state after the cutoff;
   - a single error shown inline only.

## Checked and fine

- **Q1:** `BLOCKING_PLACES = ["lax_bid"]`. lax.art shows the line and never blocks (`consignor-agreement.ts:326-338`), and the lax.art service can't throw on it.
- **Q2:**
  - The cutoff is one shared constant, `CONSIGNOR_CHECKBOX_FALLBACK_LAST_DAY = "2027-01-31"`. It is inclusive and compared against today's London day.
  - The server enforces it in `assertAllowed`, and the UI takes `checkboxFallbackUntil` from the server.
  - The checkbox is shown and required only for `checkbox_fallback` (`offer-at-auction-dialog.client.tsx:328`, `offer-at-auction-form.ts:43`). It is never shown when an agreement covers the work or LAX owns it.
- **Covering agreement:** checked for the right place (`lax_bid` or `lax_art`), ignoring replaced versions and other clients.
- **Move-time checks:** shop-api re-reads the agreement when the move is made, rather than trusting the client. It refuses an uncovered LAX Bid move before any lot is created. The move button is disabled while blocked, and the line refreshes after a refused submit.
- **History:** `move_confirmed` and `lax_art_draft_created` keep `consignorAgreement`. `consignorAgreed` is recorded only when the checkbox fallback was ticked (`original-move.service.ts:295-297`). The contract changes are additive and back-compatible, and old entries still read "Consignor agreement confirmed".
- **Who sees what:**
  - The name, dates and places go only to holders of manage, or of read plus `requireClientPartyReadAccess`. Brokers see assigned clients only, the same rule as #1552.
  - "Add agreement" needs manage.
  - The move routes keep their existing move capabilities.
- **States:** loading, check failed with Try again, not connected, blocked, no sales and done.
- **Form errors:** one error appears inline only; two or more also appear in `FormErrorSummary`.
- **Staff kit:** only kit components are used (`Notice`, `StaffButtonLink`, `FormErrorSummary`), with no restyling. `lint:datetime` passes.
- **Migrations and budgets:** no migration. `budgets.json` and `scripts/route-js*` are untouched.
- **Conflicts with #1553:** `git merge-tree` of the two branches is clean. They share four files, and the hunks don't overlap.
- **Screenshots spot-checked** against the code's copy, the disabled button and the actions: `auction-in-force-1440-light`, `auction-expired-375-dark`, `auction-no-consignor-1440-light` and `auction-errors-1440-light`.

## Tests run

Throwaway Postgres 16 on port 55432, migrated with `db:roles` applied, `SHOP_V1_INTEGRATION_REQUIRED=true`, shop suites run as `shop_app`, `--maxWorkers=2`. Everything passed:

- **shop-api, 157 tests:**
  - `original-move.service` (37)
  - `offer-on-lax-art.service` (19)
  - `artwork-register-review.service` (29)
  - `drizzle-lax-art-offer.integration` (11)
  - `drizzle-register-overview.integration` (3)
  - `admin-offer-at-auction.routes` (35)
  - `admin-offer-on-lax-art.routes` (23)
- **shop-admin, 111 tests:**
  - `offer-at-auction-dialog.client` (33)
  - `offer-on-lax-art-dialog.client` (17)
  - `offer-at-auction-form` (13)
  - `zoho-register.vm` (48)
- **artwork-register-contracts:** 339 tests.
- **persistence:** the artwork-register Postgres suites, each file on a fresh database, all pass (artwork-register 54, stock-location 22, gallery-sale 13 and others).
  - Run in sequence on one shared database, they fail in cleanup: the append-only `artwork_consignor_link` rows left by earlier suites block `DELETE FROM artwork_register`.
  - This comes from 0407/#1552 and is not new here (the PR notes it). It is worth fixing in the test cleanup.
- **Typecheck and guards:** shop-api and shop-admin typecheck. `lint:datetime`, `ui-guardrails`, `admin-capability-drift`, `client-boundary`, `layers` and `route-js-budget` pass.
- **Not run:** a full `next build`.
