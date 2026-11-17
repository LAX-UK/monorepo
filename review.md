Verdict: SHIP

# Independent review of PR #1526: Stock location per artwork, part 3 (LAX Admin screens)

Branch `stock-location-pr3-admin-screens`. I reviewed `5880ba36`, then re-checked head `760618c0`, which only merges `origin/main` (the one conflict is the `test:e2e:a11y` line in `apps/shop-admin/package.json`, and it is resolved correctly). I checked it against `docs/design/stock-location.md` (ZI-6) and the six follow-ups from the #1522 review (`review-notes-pr1522-review`).

The backend follow-ups are done well, and a mutation proves each one. The screens follow the staff-ui kit and the design. One gap blocks the merge: the main journey of this PR, moving an artwork, never runs in a browser in CI. Main already has a pattern for a fixture seed that fixes this (#1521).

## What I ran (Postgres 16, local, migrated to head, `db:roles` applied, `SHOP_V1_INTEGRATION_REQUIRED=true`, as `shop_app`)

- persistence `stock-location.integration.test.ts`: 22 passed
- shop-api `stock-location.service.test.ts`, `stock-location.service.integration.test.ts`, `admin-stock-location.routes.test.ts` and `drizzle-register-overview.integration.test.ts`: 100 passed
- shop-admin `components/stock-location/*`, `all-from-zoho-list.client.test.tsx`, `stock-location.vm.test.ts` and `zoho-register.vm.test.ts`: 85 passed
- `turbo typecheck` for shop-admin and shop-api: passed
- `biome check` on the changed files: clean
- These lints pass: `lint:deps` (circular deps and the freeze, so no new cycles), `lint:layers`, `lint:ui-guardrails`, `lint:client-boundary`, `lint:admin-capability-drift`, `lint:datetime`, `lint:staff-list-template`, `lint:staff-route-composition`, `lint:client-copy`, `lint:e2e-tags` and `lint:route-js-budget`.
- No budget, baseline or allowance file changed, and `pnpm-lock.yaml` is unchanged.
- CI on `760618c0` was still running when I wrote this (CI, Web and Account gates in progress; Art gates green). The previous CI run, on `8e406ebc`, failed. The PR explains that failure as a starved runner, but no green CI run exists yet for the current code.

## The six #1522 follow-ups, each verified by a mutation

I made one change at a time, ran the four suites above, then restored the code.

| # | Follow-up | Mutation | Result |
| --- | --- | --- | --- |
| 1 | No-op rename writes nothing | store no-op check `if (… name/note equal)` → `if (false)` (`drizzle-stock-location.store.ts:180`) | caught: store "changes nothing when … saved with the name and note it has" and service "no version, audit or event" |
| 1 | | service `if (result.changed)` audit guard → `if (true)` (`stock-location.service.ts`, updateLocation) | caught: service integration no-op test |
| 2 | moreMoves cap 100/101 | `listMoves(…, LIMIT + 1)` → `LIMIT` | caught: both the 100 and the 101 unit tests |
| 2 | | `moves.slice(0, LIMIT)` removed | caught: the 101 test |
| 3 | Add savepoint proven | store `addLocation` without its own `db.transaction` | caught: "keeps a caller's transaction usable after refusing a taken name". The adapter savepoint and `AddRefused` are gone, so one savepoint remains and a test proves it. |
| 4 | Idempotency hash | `note` dropped from `requestPayload` | caught: "refuses the same key with a different note" |
| 4 | | `[...new Set(ids)].sort()` dropped | caught: "replays the same key with the ids reordered and repeated" |
| 5 | TypeBox body on move | `body: AdminArtworkLocationMoveBodySchema` removed | caught: "refuses more ids than the route's body schema allows" |
| 6 | One consistent read | `latest = shown[0]` → oldest shown | caught by 3 tests. `currentLocation` is gone from the read port, and "now" is derived from the same `listMoves` result as the history. |

All six are done.

## Other checks

- **Roles:**
  - The panel's Move button is `requires="artwork_location.move"`.
  - On the Locations tab, Add, row actions and row click (`onRowOpen`) are given only to holders of `artwork_location.manage`. Other roles get "View only" from `editRequires`.
  - The server still enforces every capability (#1522).
- **Forms:**
  - Add/rename (2 fields) and Move (2 fields) show `FormErrorSummary` and an inline `Field` error, with focus moved to the summary on each failed submit.
  - The confirm dialogs for retire and restore have no fields.
  - No one-field form was added.
- **Stale version:** a 409 with `currentVersion` shows a warning `Notice` with **Reload** (`router.refresh()`), keeps what was typed, and saves again against the new version. A 409 for a taken name shows inline.
- **States:**
  - The panel has a `Suspense` skeleton, `ErrorState` with Try again, "Not recorded", the 101-moves note, and Move disabled with a reason when the location list failed.
  - The Locations tab has an empty state with different copy for managers and readers.
  - On the All tab, a failed location read hides only the filter and Move selected, not the list.
- **Copy and dates:** copy is in sentence case. Dates use `StaffDate`/`Timeline` (for example "Sun 15 Nov, 06:25 GMT"), in LAX date style.
- **Kit:** the screens use `ListPage`, `StaffFormDialog`, `ConfirmActionDialog`, `Section`, `KeyValueList`, `Timeline`, `EnumSelect`, `MappedStatusBadge` and the shared `useAdminAction`. No new colours are added.
- **Screenshots:** I opened them from `pr-1526-screenshots`: the record panel in light, stale edit in light, move errors in dark, and All artworks at 375 px. They render and look finished:
  - the panel sits under "Where it is" with matching rhythm.
  - the arrow and "(retired)" read clearly.
  - the error summary and inline error match in dark mode.
  - 375 px has no sideways scroll.
- **Commits:** all 4 PR commits and the merge commit are by `mahmoudamrspace <mahmoudamr.space@gmail.com>` with no trailers. The PR body has no AI footer.

## Findings

### 1. The e2e never moves an artwork, so the move flow has no browser coverage in CI (blocking)

- **Where:**
  - `apps/shop-admin/e2e/stock-location.spec.ts:16-17` (the comment "Moving artworks needs artworks on the register, which the CI seed does not have")
  - `apps/shop-admin/package.json:16`
  - `.github/workflows/e2e-pr.yml:348-356`
- **Failure scenario:** the core feature of ZI-6 is "Move" on a record and "Move selected" on All artworks. Today the browser gate covers only the Locations tab. Nothing in CI opens a From Zoho record, so nothing renders the panel or runs axe on it, in either theme. Nothing selects rows or submits the move dialog through the real BFF and shop-api. These would all pass the gate:
  - a broken Suspense boundary or server fetch in `LocationPanelSection`
  - a BFF/proxy path mistake for `artwork-location-moves`
  - a regression in the CSRF or idempotency header on the move action
  - an axe failure in the panel or the selection checkboxes

  The component tests mock the server actions, so they cannot catch these. The axe run on `/from-zoho?tab=all` also sees an empty table in CI, so it never checks the Location column, the checkboxes or the "Move selected" bar.
- **Fix:** follow the precedent main set in #1521 (`seed:zoho-mirror-badge`, run in `e2e-pr.yml:348` before `test:e2e:a11y`, with the spec failing rather than skipping in CI when the fixture is missing):
  1. Add `apps/shop-api/src/scripts/seed-stock-location-e2e.ts` (`seed:stock-location`). It should upsert 2 or 3 `artwork_register` originals, keyed on a fixed `zoho_product_id` and `stock_code` (only `zoho_product_id`, `stock_code`, `kind`, `title`, `artist_name` and `artist_code` are required), plus one active location. Run it in `e2e-pr.yml` next to the badge seed.
  2. In the spec, as an Administrator:
     - open a seeded record and check the panel shows "Not recorded".
     - Move to the seeded location with a note, and check the toast, "Now at", and the history row with its note.
     - run axe on the record page in light and dark.
     - on All artworks, select 2 rows and use Move selected. Check the toast ("… already there" for the one already moved) and the Location column.
  3. Keep the read-only role check, and add that the record shows no Move for it.

  Location names in the fixture should be unique per run, or the seed should be idempotent, so reruns do not trip the unique name rule.

### 2. Any 409 without `currentVersion` is shown as "Another location already has this name" (low)

- **Where:** `apps/shop-admin/src/components/stock-location/use-location-write.client.tsx:39`
- **Failure scenario:** `with-admin-idempotency` answers `IDEMPOTENCY_CONFLICT` with 409 when a key is reused with a different body. Example: an add or rename commits, but the response is lost (timeout or tab sleep). The person edits the name and saves again with the same dialog's key. shop-api answers 409 idempotency conflict, and the dialog puts "Another location already has this name." beside the Name field. That is false, and the person has no way forward. The same applies to retire or restore: their `write.error` notice is suppressed because `refusal === "name_taken"`.
- **Fix:** tell the refusals apart by the error `code`. Either give name-taken its own code or `reason` in the 409 body, or read `code === CONFLICT` versus `IDEMPOTENCY_CONFLICT`. Only call the refusal `name_taken` for the name conflict, and let any other 409 fall through to `action.error`. Add a component test for an idempotency 409.

### 3. Move is still out of reach for Gallery staff and Fulfilment (owner decision, not a code fix)

- **Where:** the PR body's "Decisions" section; `docs/design/stock-location.md` §3 and §4 and its open question "Who may move artworks"; `admin-stock-location-actions.server.ts:13`.
- **Failure scenario:** the design gives `artwork_location.move` to Fulfilment, Gallery staff and Admin, and puts Move on the From Zoho record and list. #1518 keeps From Zoho closed to `account_manager` and `operations`. So after this PR only Administrators can move anything, and the two roles the feature is for cannot. The PR states this openly, and the server is correct. But the server action's comment says these roles move artworks, which no screen allows yet.
- **Fix:** raise it with the owner before PR 4. Either grant those roles register read, or add a stock screen. Until then, reword the comment at `admin-stock-location-actions.server.ts:13` to say what is reachable today.

### 4. A stale no-op rename answers `changed: false` instead of "someone else changed it" (nit)

- **Where:** `packages/persistence/src/repositories/artwork-register/drizzle-stock-location.store.ts:180`
- **Failure scenario:** A opens Edit at version 1. B renames X → Y (version 2), then back to X (version 3). A saves X unchanged with `expectedVersion: 1`. The store returns `changed: false` without checking the version, and A sees "X saved". The outcome is harmless, since the stored value equals what A typed, which is why this is a nit. The #1522 review suggested the no-op path should apply only "if the version matches".
- **Fix:** either check `current.version === input.expectedVersion` before the no-op return, or document that a matching value wins over a stale version. Add a one-line test either way.

### 5. On a phone, the All list's Location meta says only "Not recorded" (nit, copy)

- **Where:** `apps/shop-admin/src/components/from-zoho/all-from-zoho-list.client.tsx:52`; screenshot `13-all-artworks-location-375`.
- **Failure scenario:** at 375 px the column header is gone. A row's meta reads "Not recorded  Tue 17 Nov", which does not say what was not recorded. It sits next to the "Not offered" chip, so it is easy to misread.
- **Fix:** use the existing `LOCATION_NOT_RECORDED` ("Location not recorded") in the cell, or at least in the mobile meta. That also matches the filter's wording.

### 6. `IStockLocationStore.currentLocation` is now used only by tests (nit)

- **Where:**
  - `packages/persistence/src/interfaces/artwork-location.ts:18`
  - `drizzle-stock-location.store.ts:73`
- **Failure scenario:** after follow-up 6, nothing in production calls the single-artwork `currentLocation` (only the store's integration tests do). It is a second way to compute the current location, which is what follow-up 6 set out to remove.
- **Fix:** remove it and point the store tests at `listMoves(…)[0]`, or keep it with a comment naming its planned PR 4 caller.

### 7. The screenshot record shows "History: Nothing has happened yet." next to three moves (nit, evidence)

- **Where:** screenshot `06-record-location-panel-*`.
- **Failure scenario:** a real move writes a `location_moved` register event, which this PR renders as "Location changed". The seeded screenshot data skipped the events, so the evidence shows the two panels disagreeing.
- **Fix:** none needed in code. Make the fixture seed from finding 1 move through the store, so later screenshots and the e2e show "Location changed" in History.

## To ship

Fix finding 1, and preferably finding 2. Get CI green on the new head. Then this is ready to ship. Findings 3 to 7 can go in follow-ups.

## Final recheck

I rechecked head `f9cbd619`, which adds `fae7aaf8` (the review fixes), merge `a331e288` (`origin/main`) and `f9cbd619` (one sign-in for the move and axe checks). I ran the stores and suites on local Postgres 16, migrated to head, with `db:roles` and `SHOP_V1_INTEGRATION_REQUIRED=true`. I ran the browser checks on a local CI stack: auth, `start-lax-admin-stack.sh`, `CI=true`, and the CI job's env from `e2e-pr.yml`. Each mutation was one change at a time, then restored.

**Verdict: SHIP.** All seven findings are handled, finding 1 is proved in CI and by a mutation, and CI is green on the head.

### Finding 1: the browser gate moves artworks (fixed)

- **Seed in CI:** `e2e-pr.yml` runs "Seed the stock location fixture artworks" (`pnpm --filter @auction/shop-api seed:stock-location`) after the Zoho badge seed and before "Run LAX Admin accessibility and role checks".
  - The `browser-gates` log for this head (job 133965070997) shows `seed-stock-location-e2e.ts` printing `"ok": true` with `created: [artwork:firstMove, artwork:toMove, artwork:alreadyThere, location, move:alreadyThere]`.
  - Then `test:e2e:a11y` ran with `e2e/stock-location.spec.ts`. The result was 87 passed and 1 flaky: the dark axe check failed once at `openLocations` and passed on retry, as the PR body says.
  - The move test ("moves an artwork from its record, then a selection from All artworks") passed on its first try.
- **Idempotent, through the stores:**
  - Locally, the first run created the three artworks, the location and the seeded move. The second run printed `created: []`.
  - The fixture records hold 3 `created` and 1 `location_moved` register events, all written through `DrizzleArtworkRegisterRepository` and `DrizzleStockLocationStore`.
  - The new `stock-location-e2e-seed.integration.test.ts` passes. `seed-scripts-guard.test.ts` covers the hermetic-only guard.
- **The spec, as an Administrator:**
  - On the record, it checks "Location not recorded" and "No moves recorded yet" (first try), and the empty-submit error.
  - It moves to "E2E stock room" with a note and checks the toast "Moved to E2E stock room", "Now at", the move history row (`First recorded at …`) with its note, and "Location changed" in the record's History.
  - On All artworks, it uses Move selected on two rows and checks the toast "1 artwork moved to E2E stock room; 1 artwork already there" and the Location column of both rows.
  - It runs axe in light and dark on the Locations tab, on All artworks with the fixture rows, and on a fixture record with its panel.
  - As the read-only role, it checks the record has no Move… and All artworks has no checkboxes.
- **Fails, not skips, without the fixture:** I ran the spec on the local stack with `CI=true` before seeding. The four fixture tests failed with "The stock location fixture artworks are missing: the CI stack must run seed:stock-location first.", and none were skipped.
- **Mutation:** I changed the move action's `bffPath` from `artwork-location-moves` to `artwork-location-movez`, rebuilt LAX Admin and ran the spec on fresh fixtures.
  - The move test failed: the dialog never closed (`toBeHidden`), and no move was written. The other 5 tests passed.
  - After restoring and rebuilding, the move test passed.
- **Note (non-blocking):** on my local stack, the "Now at" check right after the record move failed its first try 3 times in 9 runs.
  - With a 30 s wait in a temporary copy of the spec (not committed), "Now at" always updated. It took about 10 ms usually and about 5.9 s on the slow run, just past Playwright's 5 s default.
  - So the panel does refresh, and this is timing on my machine. CI passed it on the first try, and the spec's retry path covers it.
  - Consider a longer timeout on that one assertion if it shows up in CI.

### Finding 2: 409s told apart by code (fixed)

- `mapAdminMutationErrorBody` now carries the API `code`. `refusalOf` returns `stale` for a 409 with `currentVersion` and `name_taken` only for `shop.conflict`, which is what `conflict("Another location already has this name.")` sends.
- `shop.idempotency_conflict` (`with-admin-idempotency`) and any other 409 fall through to `action.error`.
- **Mutation:** making `refusalOf` return `name_taken` for every non-stale 409 failed "shows a reused key's 409 as the action's error, not as a name in use" (`locations-list.client.test.tsx`).
- **Mutation:** dropping `code` from the mapped 409 failed `admin-mutation-result.test.ts` ("carries the error code…").

### Finding 3: roles (owner decision; comment reworded only)

- The comment in `admin-stock-location-actions.server.ts` now says that only Administrators can reach Move today.
- No role, capability or route-access file is in the diff, and `lint:admin-capability-drift` passes.

### Finding 4: stale no-op rename (fixed)

- `updateLocation` locks the row, returns `stale` when `current.version !== expectedVersion`, and only then makes the no-op check.
- **Mutation:** removing the version check failed "refuses a save from an older version as stale, even when the values match again".

### Findings 5 to 7 (fixed)

- **5:** the Location cell, which is also the phone meta, renders `LOCATION_NOT_RECORDED` ("Location not recorded"), and the component test asserts it.
- **6:** `currentLocation` is gone from `IStockLocationReader` and the store. Nothing in `apps` or `packages` calls it now.
- **7:** I opened `06-record-location-panel-light` on `pr-1526-screenshots` (`cc289d48`). It is the seeded "Location fixture: already there", and History reads "Location changed" in step with the panel's move. The image URL from the PR body returns 200 `image/png`.

### The six #1522 follow-ups still hold

Each was re-mutated on this head:

- **No-op rename:** the store's no-op check → `if (false)` was caught ("changes nothing when a location is saved with the name and note it has").
- **History cap:** `listMoves(…, LIMIT + 1)` → `LIMIT` was caught (2 tests).
- **Add savepoint:** `addLocation` run without its own `db.transaction` was caught ("keeps a caller's transaction usable after refusing a taken name").
- **Idempotency hash:** dropping `note` from the move `requestPayload` was caught (1 test).
- **TypeBox body:** dropping `AdminArtworkLocationMoveBodySchema` from the route was caught (1 test).
- **One read:** the panel's "now" is still `shown[0]` of the one `listMoves` read.

### Suites, lints and hygiene

- **Suites:**
  - persistence `stock-location.integration.test.ts`: 23 passed.
  - shop-api: stock-location service unit and integration, routes, `drizzle-register-overview`, `seed-scripts-guard` and the new seed integration test: 130 passed.
  - shop-admin: `components/stock-location/*` and `admin-mutation-result.test.ts` passed.
- **Lints:** `lint:deps` (no new cycles), `lint:route-js-budget`, `lint:layers`, `lint:client-boundary` and `lint:admin-capability-drift` all pass.
- **No raised budgets:** no budget, baseline, allowance, lockfile, `.env` or `dump.rdb` file is in the PR diff (51 files, all source, tests, the workflow and `package.json` scripts).
- **CI on `f9cbd619`:** all checks succeed. `art-browser-gates` was skipped by its path filter.
- **Commits:** every PR commit and merge is by `mahmoudamrspace <mahmoudamr.space@gmail.com>`, with no trailers.
- **PR body:** no AI footer.
