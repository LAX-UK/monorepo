Verdict: FIX FIRST

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
