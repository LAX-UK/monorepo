Verdict: SHIP

# Review of PR #1553: Consignor agreements, part 3 (ZI-5), Consignor field on the From Zoho record and register list

Reviewed head `79baa72f`, only this PR's own changes (`origin/zi-5-consignor-agreements-admin...79baa72f`; #1552 has not merged yet).
Checked against `docs/design/decision-pack-2026-11-17.md` section 1 (option B, PR plan step 3, approved with the Q1–Q3 defaults) and part 1 on main (#1545, migration 0407).
The PR branch was not changed.

## Blocking

1. **The new consignor reads skip #1552's client-scope check, so a broker can read clients that aren't assigned to them.**
   - Where:
     - `apps/shop-api/src/routes/admin/v1/admin-artwork-consignor.routes.ts:58-59`: GET `/artwork-register/:registerId/consignor`.
     - `apps/shop-api/src/routes/admin/v1/admin-artwork-register.routes.ts:63-69`: the consignor column, the filter and the filter counts on GET `/artwork-register/all`.
   - What is missing: both check only `consignor_agreement.read`. #1552's rule (`admin-consignor-agreement.routes.ts:74-82`, `requireAccess`) is stricter. Without `consignor_agreement.manage`, it also requires `requireClientPartyReadAccess`, so a broker sees only the clients assigned to them.
   - Why brokers reach this:
     - Brokers get `consignor_agreement.read` through `client.read_assigned` (`packages/shop-domain/src/staff-capabilities.ts:162`).
     - Staff can hold several roles, and `capabilitiesForRoles` unions them (`apps/shop-api/src/plugins/shop-admin-auth.ts:103`).
   - Failure scenario: a staff member holds Broker and Read-only. Read-only supplies `artwork_register.read`. They open any original's record and GET `/consignor` returns:
     - the name and party id of a client not assigned to them;
     - that client's current agreements, with lowest price, commission, signed file key and note (`apps/shop-api/src/application/artwork-register/artwork-consignor.service.ts:120,128`).

     The All list also gives them every client consignor's name, plus every client and their count in the filter (`countConsignors`, `drizzle-register-overview.ts:182`). On the client page, #1552 refuses all of this with a 403.
   - Fix options (either works):
     - Apply the same rule: without manage, check the client scope on `current.partyId`, and use `clientListScope` (all, assigned or none) for the list column and filter.
     - Or limit consignor data on these two paths to `manage` or `client.read_all`.
   - Add a route test for a multi-role broker. The role table in `admin-artwork-consignor.routes.test.ts:77-96` covers single roles only.

## Non-blocking

1. **The record's GET returns more of each agreement than the section shows.** `artwork-consignor.service.ts:128` sends the full agreement, including `lowestPricePence`, `commissionBasisPoints`, `signedFileKey` and `note`. The section only uses state, places and dates (`artwork-consignor.vm.ts`, `consignorAgreementLine`). Trimming the payload would also make blocking item 1 less serious.
2. **"Each original" is enforced only in the UI.**
   - The record shows the section only for `kind === "original"` (`apps/shop-admin/src/app/(staff)/from-zoho/[registerId]/page.tsx:66-73`).
   - But PUT, GET and `setConsignor` (`packages/persistence/.../drizzle-consignor-agreement.store.ts:240-283`) also accept prints.
   - `countConsignors` and the `none` filter count prints too (`drizzle-register-overview.ts:182-210`). So "Not set (N)" includes prints that can never be set from the UI.
   - Fix: refuse prints in the service, and filter `kind = 'original'` for the column, filter and counts.
3. **No-permission state.**
   - Read-only staff get an `AccessDeniedState` on every original's record (`apps/shop-admin/src/components/artwork-consignor/consignor-section.client.tsx:63-73`), after a fetch that always returns 403.
   - PRM-1 ("hide what the role can never do") and #1552's client page (`clients/[partyId]/page.tsx:49-57`) leave the section out instead.
   - Suggest gating the loader on the session's `consignor_agreement.read`. The PR description says the no-permission state is intended, so this is not blocking.
4. **Catalogue editors can now search every client's email.**
   - `admin-read.routes.ts:80-86` adds `consignor_agreement.manage` to the party lookup capabilities. Catalogue editors have no `client.read`, but they now get every person and gallery party's email from `/lookups/parties` (`drizzle-admin-lookup.reader.ts:29,51,62`).
   - Choosing the consignor needs the name, and arguably the email to tell people apart.
   - This is wider client personal data than the role had before. Get the owner's OK, or return a slimmer row (no email) to holders of manage only.
5. **Missing `#consignor` anchor (cross-PR with #1554).**
   - #1554's "Set consignor" link goes to `/from-zoho/{id}#consignor` (`apps/shop-admin/src/lib/move-agreement-line.ts:49` on that branch).
   - This PR's `<Section>` (`consignor-section.client.tsx:105`) has no `id="consignor"`. #1552's section uses `id="agreements"`.
   - Add the id here, or in whichever PR lands second.
6. **Limits disagree on the reason's length.** The contract allows `maxLength: 2000` (`packages/shop-contracts/src/admin-consignor-agreement.ts:171`). The domain, UI and the 0407 check use 500. The service refuses anything over 500 before taking the lock, so this is only misleading.
7. **A crafted `?tab=all&consignor=…` from someone who can't read consignors shows the whole All tab as forbidden.** The 403 itself is correct. Dropping the parameter on the client when `page.consignors` is absent would be friendlier.
8. **Duplicate reads with #1554.** #1554 adds `createDrizzleMoveAgreementReads`, which reads the current consignor, the current agreements and the party name. That overlaps this PR's `drizzle-artwork-consignor.ts` (`listChanges`, `partyNames`, current agreements). There is no conflict, but consolidate them in a follow-up.

## Checked and fine

- **Design:**
  - The consignor is a client or "LAX owns this work". It is set once, and changing it needs a reason, enforced by the UI, by `planConsignorChange` in the store and by the 0407 trigger.
  - History is listed newest first.
  - The column is optional and hidden by default through the shared `ListPage`/`DisplayMenu` `defaultHiddenColumns` (TBL-12). The filter has counts and a removable chip.
- **PUT protections:**
  - It requires `consignor_agreement.manage`, `requireRecentAuthentication` and an `Idempotency-Key`.
  - Its path is in `SHOP_ADMIN_STEP_UP_PATHS` for the BFF.
  - The Set and Change buttons are hidden without manage (`requires=`).
- **List gating:** the column and filter data are sent only with `consignor_agreement.read`. A consignor filter from anyone else gets 403.
- **Atomicity:** each write runs in one unit of work with `withAdminIdempotency`.
  - The register row is locked `FOR NO KEY UPDATE` (`drizzle-consignor-agreement.store.ts:247`).
  - A stale `expectedCurrentId` gives 409 with the current id.
  - A no-op writes nothing.
  - The audit row (`artwork_consignor.set`, with kind, partyId and `withReason`, never the reason's text) is written in the same transaction. The integration tests assert both that the audit holds no reason text and that a failure rolls everything back.
  - It works with 0407's append-only triggers and its unique (register_id, set_at).
- **UI states:** loading (Suspense with `SectionSkeleton`), empty, error with Retry, no permission, and loaded for a client, for LAX and for a client with no agreement.
- **Form errors:** one error appears inline only; two or more also appear in `FormErrorSummary`. Server-named fields are shown inline.
- **Dates:** only `StaffDate`, `londonToday` and #1552's helpers are used, and `lint:datetime` passes.
- **Staff kit only:** no restyling outside scope.
- **Layering:** port, then service, then Drizzle adapter, then route. `useAgreementWrite` is reused, not copied.
- **Migrations and budgets:** none added; `budgets.json` and `scripts/route-js*` are untouched.
- **Conflicts with #1554:** `git merge-tree` of the two branches is clean. They share four files (`container.ts`, `shop-contracts/src/index.ts` and two test files), and the hunks don't overlap.
- **Screenshots:** the README lists 12 views × light/dark × 1440/375, and all 48 files are present. Four were spot-checked against the code's copy and layout, and they match.

## Tests run

All passed, against a throwaway Postgres 16 on port 55432 (migrated, `db:roles` applied, `SHOP_V1_INTEGRATION_REQUIRED=true`, shop suites as `shop_app`) with `--maxWorkers=2`:
- **shop-api**, 152 tests:
  - `artwork-consignor.service.integration` (8)
  - `drizzle-register-overview.integration` (4)
  - `admin-artwork-consignor.routes` (22)
  - `admin-artwork-register.routes` (60)
  - `admin-lookups.routes` (27)
  - `artwork-register-review.service` (31)
- **persistence:** `consignor-agreement.integration` (14).
- **shop-admin**, 96 tests:
  - `consignor-section.client` (14)
  - `all-from-zoho-list.client` (18)
  - `artwork-consignor.vm` (9)
  - `audit-log.vm` (6)
  - `zoho-register.vm` (49)
- **shop-contracts:** 128 tests.
- **Typecheck and guards:** shop-api and shop-admin typecheck. `lint:ui-guardrails`, `client-boundary`, `admin-capability-drift`, `layers`, `lib-admin-boundaries`, `datetime`, `staff-route-composition`, `staff-list-template`, `client-copy`, `test-mocks` and `route-js-budget` pass.
- **Not run:** a full `next build`.

## Fixes after review

The fixes are on `zi-5-consignor-artwork-link` at `cb2f9cee`, in commits `3dc066e9`, `7273924f` and `cb2f9cee`. #1552 had not merged when this was pushed, so main was not merged in.

### Blocking 1: client scope on consignor reads (`7273924f`)

- **Shared rule:** `consignorClientScope(auth)` in `apps/shop-api/src/routes/admin/v1/admin-client-access.ts:37`.
  - Without `consignor_agreement.read` it is `none`.
  - With `consignor_agreement.manage` it is `all`.
  - Otherwise it follows `clientListScope` (`all`, `assigned` or `none`).
- **GET `/artwork-register/:registerId/consignor`** (`apps/shop-api/src/routes/admin/v1/admin-artwork-consignor.routes.ts:62-71`):
  - When the current consignor is a client and the scope is not `all`, the route calls `requireClientPartyReadAccess` on that party.
  - LAX or no consignor needs no party check.
- **GET `/artwork-register/all`** (`apps/shop-api/src/routes/admin/v1/admin-artwork-register.routes.ts:74-93`): the scope goes to `listAll` and `countConsignors`, through `RegisterConsignorScope` (`artwork-register-review.ports.ts:91`).
  - **The reader:** with the `assigned` scope, `partyInScope` limits clients to the broker's assignments (`drizzle-register-overview.ts:153`).
  - **Out-of-scope clients:**
    - The row's consignor is left off (`artwork-register-review.service.ts:123`).
    - The client is left out of the filter choices and counts (`:220`).
  - **`none`:** no consignor data is sent.
  - **Filtering by a client outside scope:** 403, the same as opening that client's page. "Not set" and LAX stay open.
- **Tests for a member who is both Broker and Read-only:**
  - The record GET, `admin-artwork-consignor.routes.test.ts:203`:
    - refused on an unassigned client, allowed on an assigned one;
    - LAX or no consignor needs no check;
    - still cannot PUT;
    - a Catalogue editor who is also a Broker skips the check.
  - The All list, `admin-artwork-register.routes.test.ts:275`:
    - the column and the filter are limited to assigned clients;
    - any other client in the filter gets 403;
    - holders of manage see every client.
  - The assigned scope in SQL: `drizzle-register-overview.integration.test.ts`.

### Non-blocking

1. **The record GET is trimmed to what the section shows:**
   - `AdminArtworkConsignorAgreementSchema` (`packages/shop-contracts/src/admin-consignor-agreement.ts:146`) holds the id, status, places, `startsOn`, `endsOn` and `createdAt`. `createdAt` is kept for the sort order.
   - The service builds it with `presentRecordAgreement` (`apps/shop-api/src/application/artwork-register/artwork-consignor.service.ts:64`).
   - There is no lowest price, commission, signed file key or note.
   - A contract test (`:137`) refuses them.
2. **Originals only:**
   - GET on a print returns 404 (`artwork-consignor.service.ts:133`).
   - PUT on a print returns 409 (`:175`), before the unit of work, so nothing is written.
   - The column, filter and counts are limited to `kind = 'original'` (`drizzle-register-overview.ts:84,101,220`).
   - Tests:
     - service integration `:336`: prints are refused and nothing is written;
     - overview integration: a print is neither shown nor counted.
3. **The section is left out without `consignor_agreement.read`** (`cb2f9cee`):
   - The record page gates the loader on the session's capability (`apps/shop-admin/src/app/(staff)/from-zoho/[registerId]/page.tsx:49,73`).
   - A remaining 403 renders nothing (`consignor-section.tsx:23`). This is a broker looking at a work consigned by an unassigned client.
   - `AccessDeniedState` is removed, along with the no-permission screenshots and their README entries.
   - `page.test.tsx:156` covers this.
4. **Name-only party lookup** (`3dc066e9`):
   - When the client scope is `none` and `consignor_agreement.manage` is the only lookup capability held, `/lookups/parties` neither returns nor matches on email (`admin-read.routes.ts:391-401`, `drizzle-admin-lookup.reader.ts:51,62`).
   - People who can read clients keep the email.
   - Tested at `admin-lookups.routes.test.ts:96,112`.
5. **`id="consignor"`** is on the Consignor Section, both loaded and error (`consignor-section.client.tsx:38,64,92`). The test is at `consignor-section.client.test.tsx:162`.
6. **The contract's reason `maxLength` is 500** (`admin-consignor-agreement.ts:190`), with a test at `:201`. The PUT body limit is lowered to match.

Not changed:

- **Item 7** (dropping a crafted `?consignor=` on the client) is not in this round.
- **Item 8** (consolidating the duplicate reads with #1554) is left for a follow-up and noted in the PR body.
- **History entries** can still name an earlier client consignor outside a broker's scope. The check covers the current consignor, as asked. Redact earlier ones in a follow-up if needed.

### Tests run after the fixes

Throwaway Postgres 16 on port 55432, migrated with `db:roles` applied, `SHOP_V1_INTEGRATION_REQUIRED=true`, shop suites as `shop_app`, `--maxWorkers=2`. Everything passed:

- **shop-api, 165 tests:**
  - `admin-artwork-consignor.routes` (27)
  - `admin-artwork-register.routes` (63)
  - `admin-lookups.routes` (30)
  - `artwork-register-review.service` (32)
  - `artwork-consignor.service.integration` (9)
  - `drizzle-register-overview.integration` (4)
- **persistence:** `consignor-agreement.integration` (14).
- **shop-admin, 145 tests across 8 files:**
  - the five suites listed in the review;
  - the From Zoho record page;
  - `consignor-agreement.vm`;
  - `agreements-section.client`.
- **shop-contracts:** 130 tests.
- **Typecheck:** shop-api, shop-admin and shop-contracts pass.
- **Guards:** `lint:ui-guardrails`, `client-boundary`, `admin-capability-drift`, `layers`, `lib-admin-boundaries`, `datetime`, `staff-route-composition`, `staff-list-template`, `client-copy` and `test-mocks` pass. `biome check` on the changed files is clean.
- **Not run:** a full `next build`.

## Final recheck

Rechecked head `cb2f9cee` (unchanged since the fixes). The PR branch was not changed. Verdict: SHIP.

### Blocking 1: resolved

- **Shared rule:** `consignorClientScope` (`admin-client-access.ts:37`) is `none` without `consignor_agreement.read`, `all` with `consignor_agreement.manage`, and otherwise `clientListScope`. It matches #1552's `requireAccess` rule.
- **GET `/artwork-register/:registerId/consignor`** (`admin-artwork-consignor.routes.ts:62-71`): when the current consignor is a client and the scope is not `all`, `requireClientPartyReadAccess` runs on that party before anything is returned. A scope of `none` with read still gets 403 there. LAX and no consignor need no party check.
- **GET `/artwork-register/all`** (`admin-artwork-register.routes.ts:74-93`):
  - A client filter outside scope gets 403. "Not set" and LAX stay open. Without read, any consignor filter gets 403.
  - In the column, `partyInScope` limits clients to `shop_client_assignment` for the broker. Out-of-scope rows become `not_shown`, and the service leaves `consignor` off them.
  - In the counts, `or(isNull(partyId), partyInScope)` leaves out-of-scope clients out of the choices and counts; they are not folded into "Not set".
- **Tests:** the Broker + Read-only tests are present and pass.
  - Record: `admin-artwork-consignor.routes.test.ts:203`. An unassigned client gets 403 with no name in the body; an assigned client is shown.
  - All list: `admin-artwork-register.routes.test.ts:282,310,337`.

### The other fixes: correct, nothing broken

- **Trimmed payload:** `presentRecordAgreement` sends id, status, places, dates and `createdAt` only. The contract test refuses the terms, and the shop-admin view model and section tests pass on the slimmer shape.
- **Originals only:** a print gives 404 on GET and 409 on PUT, refused before the unit of work. The column, filter and counts use `kind = 'original'`.
- **Name-only lookup:** applies only when the client scope is `none` and manage is the only party-lookup capability held. In that case email is neither matched nor returned; everyone else keeps the email.
- **`id="consignor"`:** on the loaded and error states, so #1554's "Set consignor" link lands on the section.
- **Reason `maxLength`:** 500 in the contract, the domain, the UI and 0407. The body limit is lowered to 4 KiB.

### Merges

- **With #1554:** clean (`git merge-tree`). The combined tree builds, typechecks (shop-api and shop-admin), and the four shared route suites pass (155 tests).
- **With current `origin/main` (`bf18b243`):** one textual conflict, in `packages/shop-contracts/src/index.ts`. #1546's new `express-checkout-public.js` export block sits next to this PR's added `AdminArtworkConsignorAgreementSchema` export.
  - It resolves by keeping both blocks. With that resolution, shop-contracts and shop-api typecheck.
  - #1554 and #1552 merge with main cleanly.

### Tests run

Throwaway Postgres 16 on port 55432, migrated with `db:roles` applied, `SHOP_V1_INTEGRATION_REQUIRED=true`, shop suites as `shop_app`, `--maxWorkers=2`. Everything passed:

- **shop-api, 165 tests (6 files):**
  - `admin-artwork-consignor.routes`
  - `admin-artwork-register.routes`
  - `admin-lookups.routes`
  - `artwork-register-review.service`
  - `artwork-consignor.service.integration`
  - `drizzle-register-overview.integration`
- **persistence:** `consignor-agreement.integration` (14).
- **shop-admin, 145 tests (8 files):** the consignor section, All list, the view models, the From Zoho record page and the agreements section.
- **shop-contracts:** 130 tests.
- **Typecheck:** shop-api and shop-admin pass.
- **Not run:** a full `next build`.

### Later (not blocking)

1. When #1552 lands and this is rebased onto main, resolve the `shop-contracts/src/index.ts` export conflict by keeping both blocks.
2. Consignor history entries can still name an earlier client consignor outside a broker's scope. This is already noted for a follow-up.
3. Item 7 (dropping a crafted `?consignor=` on the client) and item 8 (consolidating the duplicate reads with #1554) are still open, as planned.
