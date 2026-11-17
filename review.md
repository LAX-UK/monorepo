Verdict: SHIP

# Independent review: PR #1536, "Let catalogue editors move artworks"

Reviewed head `daea74cf` against `main`, with the owner decision of 17 Nov 2026 in mind: only `catalogue_editor` and `shop_admin` may move artworks (`artwork_location.move`) and read the artwork register they need. No other LAX Admin role may move.

## Checks

| Check | Result |
| --- | --- |
| Role/capability table changed at its single source | Yes. `packages/shop-domain/src/staff-capabilities.ts:210-216` adds `artwork_location.move` (and the already-implied `artwork_register.read`) to `catalogue_editor`. It also removes the capability from `account_manager` and `operations`. `rolesGranting("artwork_location.move")` is now exactly `["shop_admin", "catalogue_editor"]`. `packages/types/src/lax-staff-platforms.ts` holds only the role labels and summaries, not capabilities, so it needed no change for enforcement. |
| No scattered checks | Yes. The API (`admin-stock-location.routes.ts:197`), the Location panel (`location-panel.client.tsx:65`) and All artworks (`all-from-zoho-list.client.tsx:103`) all test the capability, never role names. |
| API enforces server-side, 403 per role, tested | Yes. The role × route matrix in `admin-stock-location.routes.test.ts` covers all 8 roles: 200 for the two movers, and 403 `FORBIDDEN` with the service not called for the other six. There are also explicit 403 tests for `account_manager` and `operations`. |
| Move hidden for others, visible for catalogue editors | Yes. `location-panel.client.test.tsx` renders the panel once per role with that role's real capabilities. The e2e test in `stock-location.spec.ts` checks the catalogue editor (record plus Move selected) against the account manager (no From Zoho, no Move). |
| Minimum read for catalogue_editor | Yes. `artwork_register.read` and `artwork_location.read` were already implied through `artwork_register.review` (see `CAPABILITIES_BEFORE` and `READ_IMPLIED_BY_WRITE`). The only new grant is the move. `account_manager` and `operations` also lose `artwork_location.read`, which they held only through the move. |
| No privilege escalation | Yes. `artwork_location.manage` (add, rename, retire or restore locations) stays `shop_admin`-only, as `docs/design/stock-location.md` intends. The route matrix confirms `catalogue_editor` gets 403 on all four list-management routes. |
| staff-roles and stock-location e2e specs | `stock-location.spec.ts` has a new role test. `staff-roles.spec.ts` derives the expected nav from `capabilitiesForRole`, so it follows the table without an edit. That is acceptable. |
| docs/design/stock-location.md roles section | Updated: a new **Roles (decided 17 Nov 2026)** table at `docs/design/stock-location.md:52`, and the owner question is struck through as decided. |
| Screenshots light/dark/375 | Present on branch `catalogue-editor-moves-screenshots`, `docs/pr-screenshots/catalogue-editor-moves/`: 3 states × light/dark/375. I spot-checked the dark record (Move… visible), the 375 list (Move selected… visible) and the light account-manager record ("Your role cannot open this page", no Move). |
| Migration report | `staff-role-migration.ts` `CAPABILITIES_BEFORE` gains `artwork_location.move`. This matches that file's rule that capabilities added since the split are listed, so the report shows only the split's own changes. |

## Test runs (this review, on the PR head)

- `packages/shop-domain` `vitest run`: 48 files, 1,334 tests passed.
- `apps/shop-admin` `vitest run`: 174 files, 1,821 tests passed.
- `apps/shop-api` `vitest run`: 243 files passed (93 skipped, the DB integration suites), 2,855 tests passed, 592 skipped.
- `packages/types` `vitest run`: 337 tests passed.
- I did not run the browser e2e here because there was no running stack. The PR reports `stock-location.spec.ts` plus `staff-roles.spec.ts` at 13/13 and a green `browser-gates` CI.

## Findings

None of these block.

1. **Nit:** `packages/types/src/lax-staff-platforms.ts:79-81`. The Catalogue editor summary in the role picker still reads "Artworks, edition runs, artists and artist applications." It does not mention moving artworks, so whoever grants the role cannot see the new power. Consider adding "and moves artworks".
2. **Nit:** `apps/shop-api/src/routes/admin/v1/admin-stock-location.routes.test.ts:196`. The test only asserts `not.toBe(403)` for the catalogue editor's From Zoho record read, so a 500 would also pass. Asserting the expected status, or mocking the register read and asserting 200, would make it stronger.
3. **Nit:** `packages/shop-domain/src/staff-capabilities.ts:214`. `artwork_register.read` is already implied by `artwork_register.review`, so listing it again is redundant. The comment states it is intentional and it is harmless.
