Verdict: SHIP

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

## Fixes after review

The fixes are on `zi-5-move-dialog-agreements` at `8b3d484a`, in commits `3f853b88`, `42fafb12`, `4bb11eba` and `8b3d484a`. #1552 had not merged when this was pushed, so main was not merged in.

### Blocking 1: lowest price (`3f853b88`)

- **The rule:** `apps/shop-api/src/routes/admin/v1/move-agreement-viewer.ts:19-42`. `moveAgreementForViewer` now takes the move's capabilities. It keeps `lowestPricePence` only when the viewer can read the consignor's agreements (manage, or read plus `requireClientPartyReadAccess`), or holds every capability the matching POST route requires. Anyone else gets null.
- **One list for the GET and the POST:** the capabilities are now shared constants, so the check and the move can't drift apart.
  - `apps/shop-api/src/routes/admin/v1/inventory-moves.routes.ts:33-38` defines `ARTWORK_MOVE` and `REGISTER_MOVE`.
  - `apps/shop-api/src/routes/admin/v1/admin-offer-on-lax-art.routes.ts:29` defines `LAX_ART_MOVE`.
  - The GETs and the POSTs use the same constant.
- **Contract comment:** `packages/shop-contracts/src/admin-move-agreement.ts:10-16` now states the rule.
- **Tests:**
  - Read-only on all three assessment GETs:
    - `apps/shop-api/src/routes/admin/v1/admin-offer-at-auction.routes.test.ts:208` covers both auction-offer GETs.
    - `apps/shop-api/src/routes/admin/v1/admin-offer-on-lax-art.routes.test.ts:164` covers the lax-art-offer GET.
  - Positive case: a mover keeps the price (`admin-offer-at-auction.routes.test.ts:224`).
  - Unit tests in `apps/shop-api/src/routes/admin/v1/move-agreement-viewer.test.ts`:
    - a mover with no agreement read keeps the price;
    - a viewer with only part of the move capabilities gets null;
    - check-only gets null;
    - a reader keeps everything.

### Non-blocking

- **2. Copy** (`42fafb12`):
  - "No agreement covers {place} for {consignor}." no longer has the reason suffix (`apps/shop-admin/src/lib/move-agreement-line.ts:85`), and `reasonOf` is removed.
  - The lowest price shows "£2,000" for whole pounds and keeps pence otherwise (`move-agreement-line.ts:26`).
  - "Signed {date}" uses `startsOn`, because an agreement records no separate signing day. This is commented at `move-agreement-line.ts:74` and explained in the PR body.
- **3. "Set consignor"** is shown only with `consignor_agreement.manage` (`canAddAgreement`, `move-agreement-line.ts:42-43`). Dialog tests cover it hidden without manage, in both dialogs.
  - The `#consignor` anchor is added on #1553's side.
- **6. Duplicated helpers:**
  - Dates use `formatStaffDate` (`move-agreement-line.ts:54,72,77`), the same as #1552's view model. So dates now follow the house style, for example "Tue 3 Mar" this year and "Tue 2 Mar 2027" otherwise.
  - Place names:
    - shop-api uses `CONSIGNMENT_PLACE_LABELS` (`apps/shop-api/src/application/admin/move-agreement.service.ts:2`).
    - shop-admin doesn't depend on artwork-register-contracts, so it uses #1552's `PLACE_LABELS` from `consignor-agreement.vm.ts` (`move-agreement-line.ts:1,39`) rather than adding a dependency. The local copies are gone.
- **7. Tests** (`4bb11eba`):
  - Service: `apps/shop-api/src/application/admin/original-move.service.test.ts:649-714`:
    - A move with no consignor after 31 January 2027 is refused, even with the checkbox, and no lot is made.
    - 2027-01-31T23:30Z still gets the checkbox fallback; 2027-02-01T00:30Z is blocked.
    - Summer time (BST):
      - An agreement ending 2026-10-24 is in force at 22:30Z and expired at 23:30Z.
      - An agreement starting 2026-06-01 is not started at 2026-05-31T22:30Z and in force at 23:30Z.
  - Route: `apps/shop-api/src/routes/admin/v1/admin-offer-at-auction.routes.test.ts:336`, using the real service and a fixed clock:
    - At 2027-01-31T23:30Z the GET reports `checkbox_fallback` and the POST returns 200.
    - At 2027-02-01T00:30Z and T12:00Z the GET reports `blocked` and the POST returns 409, with no lot made.
- **8. Screenshots** (`8b3d484a`):
  - New in `docs/design/screenshots/zi-5-move-dialog-agreements/`, each in light and dark at 1440 and 375 px (12 files):
    - `auction-lax-owns-*`
    - `auction-no-consignor-blocked-*`
    - `auction-one-error-*`
  - Shots whose copy changed (dates, "£2,000", no reason) were re-rendered. The README is updated, and the folder now holds 60 images.
- **Left for a follow-up, as asked:** item 1 (the race between the agreement read and the move) and the duplicate-reads consolidation with #1553. Both are noted in the PR body.
  - Items 4 and 5 (history wording, ids in payloads) are unchanged.

### Tests run after the fixes

Throwaway Postgres 16 on port 55432, migrated with `db:roles` applied, `SHOP_V1_INTEGRATION_REQUIRED=true`, `--maxWorkers=2`. Everything passed:

- **shop-api, 175 tests:**
  - `original-move.service` (44)
  - `offer-on-lax-art.service` (19)
  - `artwork-register-review.service` (29)
  - `drizzle-lax-art-offer.integration` (11)
  - `drizzle-register-overview.integration` (3)
  - `admin-offer-at-auction.routes` (41)
  - `admin-offer-on-lax-art.routes` (24)
  - `move-agreement-viewer` (4)
- **shop-admin, 151 tests:** the offer-at-auction dialog, lax.art dialog and form, `zoho-register.vm`, `move-agreement`, `agreements-section` and `consignor-agreement` suites.
- **Contracts:** artwork-register-contracts 339 passed; shop-contracts 128 passed.
- **Typecheck:** shop-api, shop-admin and shop-contracts pass.
- **Guards:** `lint:datetime`, `ui-guardrails`, `admin-capability-drift`, `client-boundary`, `layers`, `client-copy` and `test-mocks` pass. `biome check` on the changed files is clean.
- **Not run:** a full `next build`.

## Final recheck

Rechecked head `8b3d484a` (unchanged since the fixes). The PR branch was not changed. Verdict: SHIP.

### Blocking 1: resolved

- **The rule:** `moveAgreementForViewer` (`move-agreement-viewer.ts:19-42`) keeps the full view only for manage, or for read plus `requireClientPartyReadAccess` on the consignor.
  - Everyone else gets `consignor: null` and `agreement: null`.
  - They get `lowestPricePence` only when they hold every capability of the matching POST.
- **The capability lists are shared** by each GET and its POST:
  - `ARTWORK_MOVE` = `catalogue.write`;
  - `REGISTER_MOVE` and `LAX_ART_MOVE` = `catalogue.write` + `artwork_register.review`.
  - Read-only holds neither, so it gets null.
- **Tests:** Read-only tests cover all three assessment GETs.
  - The two auction-offer GETs: `admin-offer-at-auction.routes.test.ts:208`, a `test.each` over both.
  - The lax-art-offer GET: `admin-offer-on-lax-art.routes.test.ts:164`.
  - A mover keeps the price (`:224`), and the four `move-agreement-viewer` unit tests pass.

### Copy and the Set consignor link

- **Copy matches decision pack section 1:**
  - "Covered by agreement with {consignor}, signed {date}, {places}, until {date}."
  - "Below the lowest price agreed (£2,000).": whole pounds, with pence only when set.
  - "No agreement covers {place} for {consignor}." with no reason suffix, and "Add agreement".
  - "Set who consigned this work first." with "Set consignor".
  - LAX owns the work: no line.
  - Dates use `formatStaffDate`, the house style, so the current year shows a weekday and no year. This was the agreed follow-through on review item 6.
- **"Set consignor"** is built only when `canAddAgreement` is true, which shop-api sets from `consignor_agreement.manage` (`move-agreement-line.ts:42-43`). It links to `/from-zoho/{id}#consignor`, and #1553 now carries that id. The dialog tests cover the link hidden without manage.

### Merges

- **With current `origin/main` (`bf18b243`):** clean.
- **With #1553:** clean. The combined tree builds, and shop-api and shop-admin typecheck. The shared route suites pass (`admin-artwork-consignor`, `admin-offer-at-auction`, `admin-offer-on-lax-art`, `admin-artwork-register`: 155 tests).

### Tests run

Throwaway Postgres 16 on port 55432, migrated with `db:roles` applied, `SHOP_V1_INTEGRATION_REQUIRED=true`, `--maxWorkers=2`. Everything passed:

- **shop-api, 175 tests (8 files):**
  - `original-move.service`
  - `offer-on-lax-art.service`
  - `artwork-register-review.service`
  - `drizzle-lax-art-offer.integration`
  - `drizzle-register-overview.integration`
  - `admin-offer-at-auction.routes`
  - `admin-offer-on-lax-art.routes`
  - `move-agreement-viewer`
- **shop-admin, 173 tests (8 files):** the offer-at-auction and lax.art dialogs and form, `zoho-register.vm`, `move-agreement`, `agreements-section` and `consignor-agreement`.
- **Contracts:** shop-contracts 128 and artwork-register-contracts 339.
- **Typecheck:** shop-api and shop-admin pass.
- **Not run:** a full `next build`.

### Later (not blocking)

1. The race between reading the agreement and recording the move (review item 1) is still open. Soften the "Read again here" comment when it is picked up.
2. Item 4 (history wording for new entries) and item 5 (ids in raw history payloads) are unchanged.
3. Consolidating the duplicate reads with #1553 is still open, as planned.
