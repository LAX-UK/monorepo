Verdict: SHIP

Independent review of #1518 "Stock location per artwork, part 1: locations, moves and permissions" at head `5d72277a`, checked against `docs/design/stock-location.md` on `origin/main`. The owner approved the recommended option, including a new read-only Zoho field `LAX_Location` kept separate from `LAX_Listing`.

What holds up:
- **Scope.** The design has no PR split. This PR is the foundation: design §6 (the migration and grants), §2 (the move model) and §4 (capabilities). Screens, routes, audit rows, recent sign-in and the Zoho mirror are deferred to PRs 2–4, and the PR body says so.
- **Migration.** 0404 is additive and re-runnable. It indexes the current-location lookup with `(register_id, moved_at)`, which is unique, and indexes `location_id`. The `location_moved` CHECK is rebuilt `NOT VALID`, there is a rollback, and the rollback refuses while any moves exist. Main's journal ends at 0403 (idx 395), so 0404/idx 396 does not collide today. It will be renumbered at ship.
- **Append-only history.** A trigger blocks UPDATE and DELETE. The current location is derived from the latest move, so no copy can drift.
- **Permissions.** Move goes to Admin, account managers and operations. Manage is Admin-only and is in `ADMINISTRATOR_ONLY_CAPABILITIES`. Read comes with `artwork_register.read`. Movers still cannot open the register.
- **Zoho.** No Zoho call or write anywhere. "Needs owner" names `LAX_Location`, keeps `LAX_Listing` separate and spells out the writeback-mode rollout.
- **No UI.** No route JS, budget or baseline changes.
- **History and trailers.** Commits are by mahmoudamrspace with no AI trailers. The PR body has no AI footer.
- **CI.** Green on the head commit, including `test`, `worker-role-contract`, `auth-role-contract` and shop-v1 integration.

Verified locally against Postgres 16, migrated to head with roles applied:
- **PR tests pass:** db 0404 unit and integration, `migrate-roles`, `shop-app-role.contract` (as `shop_app`), persistence `stock-location.integration` (13/13), and the contracts, shop-domain and types packages.
- **Reverted all non-test files to `origin/main`** (fresh database): every new test fails. That covers the 0404 unit and integration tests, the `shop_app` contract, `migrate-roles`, the persistence store, contracts, `staff-capabilities`, the catalog and `get-staff-session`.
- **Targeted mutations:**
  - Dropping `nextMoveTime` fails 2 tests.
  - Dropping the register row lock passes 3 runs out of 3 (finding 2).
  - Dropping the location share lock passes (finding 2).

## Must fix before ship

1. **`api_app` (the Bid API) gets full DML, including DELETE and TRUNCATE, on both new tables, so the "append-only" move history can be wiped.**
   - **Where:** `packages/db/src/migrate-roles.ts:175` (`API_DENY_TABLES`) and the catch-all api_app grant loop near `:1588`.
   - **What happens:** neither table is listed, so the default loop grants `api_app` everything. Measured with `has_table_privilege`: `api_app` has `t|t|t|t|t` (SELECT, INSERT, UPDATE, DELETE, TRUNCATE) on `artwork_location` and `artwork_location_move`.
   - **Reproduced:** as `SET ROLE api_app`, `TRUNCATE artwork_location_move` succeeds and leaves 0 rows. TRUNCATE skips the row-level append-only trigger at `packages/db/drizzle/0404_artwork_stock_location.sql:64`.
   - **Why it matters:** the PR itself calls these moves "the only record of where artworks are". The Bid API neither reads nor writes locations (design §4/§5), and the repo already narrows `api_app` on append-only history (`API_PRIVATE_SALE_ARTWORK_HISTORY_TABLES`, `:249`).
   - **Fix:**
     - Add `artwork_location` and `artwork_location_move` to `API_DENY_TABLES`, with a comment that only LAX Admin keeps locations.
     - Add a `migrate-roles.test.ts` invariant for this.
     - Add an `api-app-role.contract.test.ts` case asserting no privileges on both tables.
     - Optionally, as defence in depth, add a `BEFORE TRUNCATE ... FOR EACH STATEMENT` trigger on `artwork_location_move`. The repo already does this with `accounting_document_event_no_truncate`.

2. **The concurrency test does not prove the locks it claims to cover.**
   - **Where:** `packages/persistence/src/repositories/artwork-register/stock-location.integration.test.ts:351`.
   - **What happens:** with `.for("no key update")` removed from `drizzle-stock-location.store.ts:209`, the test passed 3 runs out of 3. The two `Promise.all` transactions don't reliably overlap. With `.for("share")` removed from `:191`, which guards retire-vs-move, every test still passes: nothing covers it.
   - **Why it matters:** these locks are the "one current location / no forked chain" and "no move into a just-retired location" invariants.
   - **Fix:** make the overlap deterministic with two connections.
     - **Register lock:** connection A runs `BEGIN; SELECT ... FROM artwork_register WHERE id=$1 FOR NO KEY UPDATE`. Start `moveArtworks` on the pool and assert it is still pending, for example by checking `pg_stat_activity.wait_event_type = 'Lock'` or `pg_locks`. Then have A insert a move and COMMIT. Assert the second move's `fromLocationId` in the event payload equals A's location.
     - **Location lock:** the same pattern. Hold `FOR SHARE` on the location in A, call `setLocationStatus(retired)`, and assert it waits. Also cover the reverse: hold the retire `UPDATE` open, start `moveArtworks`, commit the retire, and assert the move returns `location_retired`.
     - **Check:** each test must fail when its lock is removed.

3. **Design §4 says "every move and list change ... publishes `artwork_register.location_changed`", but `updateLocation` and `setLocationStatus` publish nothing.**
   - **Where:** `packages/persistence/src/repositories/artwork-register/drizzle-stock-location.store.ts:162` and `:175`.
   - **Why it matters:** Zoho `LAX_Location` holds the location's *name* (design §5). After a rename, every artwork at that location shows the old name in Zoho, and PR 4's projector has no event to react to. The v1 payload has one artwork and from/to ids, so it can't describe a rename. This has to be settled now, while the event contract is being introduced.
   - **Fix (recommended):** in the same transaction as a rename, or as a retire or restore if the Zoho value shows "(retired)", publish one event per artwork currently at the location.
     - Either use `artwork_register.location_changed` with `fromLocationId = toLocationId` and a `reason: "location_renamed"` field (schema v1 plus an optional field, or v2),
     - or add `artwork_location.renamed { locationId }` that PR 4 fans out from.
   - **Also:** add an integration test showing a rename emits it. If you'd rather defer, say so explicitly in the PR body's plan for PR 4 and record it in the design doc so it is not lost.

## Should fix (small, can land in this PR)

4. **`MOVE_BATCH_MAX` (100) is declared "so one transaction stays short" but nothing enforces it.**
   - **Where:** `packages/artwork-register-contracts/src/stock-location.ts:14`, with `moveArtworks` at `drizzle-stock-location.store.ts:183`.
   - **Fix:** in `moveArtworks`, return `{ ok: false, reason: "too_many" }` (add it to `LocationMoveRefusal`) when `new Set(registerIds).size > MOVE_BATCH_MAX`, before opening the transaction. Add a unit test for the plan rule and an integration test.

5. **Re-retiring an already-retired location overwrites `retired_at` and bumps the version.**
   - **Where:** `drizzle-stock-location.store.ts:175-181`.
   - **Fix:** in `writeVersioned` for status, add `ne(location.status, input.status)` to the WHERE clause. Alternatively, read first and return the unchanged location when the status already matches, so the original retire time stays true. Add a test.

6. **The domain-event payload is built untyped.**
   - **Where:** `drizzle-stock-location.store.ts:263-277`.
   - **Fix:** declare the payload as `const payload = { ... } satisfies ArtworkRegisterLocationChangedPayloadV1` (from `@auction/types`). Schema drift then fails typecheck rather than the runtime catalog gate.

7. **The Drizzle schema leaves out some of 0404's constraints.**
   - **Where:** `packages/db/src/schema/artwork-location.ts:33-37` and `:59-62`.
   - **What's missing:** the name and note checks, `artwork_location_retired_check` and `artwork_location_move_note_check`. The file comment says they are "repeated here where drizzle-kit needs them".
   - **Fix:** mirror all five checks, so a future `drizzle-kit generate` does not propose dropping them.

## Carry into the follow-up PRs (no change needed here)

8. **PR 2: write the audit row in the same transaction as the move or list change.** That is the existing pattern: `apps/shop-api/src/infrastructure/drizzle-zoho-link.ts:510` calls `tx.audit.append` inside the unit of work. Construct `DrizzleStockLocationStore` on the UoW transaction (its `db.transaction` then nests as a savepoint), or add an audit hook to `MoveArtworksInput`. Also enforce recent sign-in for `artwork_location.manage` on the server, not only in the UI.

9. **PR 4: the `LAX_Location` projector runs as `worker_app`, which today has no privileges on either table.** Add `SELECT`-only grants for `worker_app` (a new `WORKER_ARTWORK_LOCATION_READ_TABLES`). Add matching `worker-app-role.contract.test.ts` and `worker-role-contract` cases, and register the consumer on `artwork_register.location_changed` (currently `consumers: []`).

10. **Owner question stays open.** The design names "Gallery staff" and "Fulfilment" roles, which don't exist. The PR maps them to `account_manager` and `operations`, and it correctly raises this under "Needs owner". Keep the PR 2 Location panel reachable for these roles without `artwork_register.read`, as the third capability test asserts.

11. **Ship-time renumbering.** When 0404 is renumbered, update the `created_at` literal in `0404_rollback.sql:36` together with the journal `when`. `migration-0404-artwork-stock-location.test.ts` pins the pair, so CI will catch a mismatch. Also rename both test files and the `TAG` constant.

## Final recheck

Rechecked at head `ff1d05d2` after the fixer's commits `a94ffff0` and `d35d9778`. I ran everything locally against Postgres 16, migrated to the head with roles applied. **Findings 1–7 are fixed, and each fix is pinned by a test that fails without it. Findings 8–11 are carried in the PR body. Verdict: SHIP.**

**1. `api_app` least privilege: fixed.**
- `artwork_location` and `artwork_location_move` are in `API_DENY_TABLES` (`migrate-roles.ts:175`). The grant loop revokes everything on them.
- `has_table_privilege` for SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES and TRIGGER:
  - `api_app`, `worker_app` and `auth_app`: all false on both tables.
  - `shop_app`: SELECT, INSERT and UPDATE on `artwork_location`; SELECT and INSERT on `artwork_location_move`.
- `TRUNCATE artwork_location_move` fails as `api_app` and as `shop_app` with "permission denied". As the owner, the new `artwork_location_move_no_truncate` statement trigger refuses it ("append-only (TRUNCATE refused)").
- Mutation: I took the two tables out of `API_DENY_TABLES` and reapplied the roles. Both the `migrate-roles` invariant and the `api_app` grants probe failed, so the probe really runs (`DATABASE_URL_API` is set in CI's role-contract job).

**Move history is append-only: fixed.**
- A row trigger refuses UPDATE and DELETE, and a statement trigger refuses TRUNCATE.
- Mutation: I dropped the TRUNCATE trigger in the database. The 0404 integration test failed. I then restored the trigger and the test passed again.

**2. Concurrency tests now prove the locks: fixed.** There are four deterministic tests. Each holds a lock on its own connection and uses `pg_blocking_pids` to confirm the store is waiting before it releases.
- Removing `.for("no key update")` fails 2 tests: "second move waits" and "waiting move records nothing".
- Removing `.for("share")` fails 1 test: "move into a location being retired waits, then is refused".
- Removing the status events fails the "retiring waits for a move" test, along with 2 others.
- Unmutated, the suite passed 20/20 in 3 runs out of 3.
- Note (no change needed): removing the explicit `.for("update")` in `setLocationStatus` still passes. The versioned `UPDATE` takes the same conflicting row lock, so the guarantee holds either way.

**3. `location_changed` on list changes: fixed.**
- `updateLocation` publishes `location_updated` for every artwork currently at the location, in the same transaction.
- `setLocationStatus` publishes `location_retired` or `location_restored` the same way.
- Mutations: removing the rename publish fails 1 test, and removing the status publish fails 3.
- The payload schema has a `reason` enum, and a refine rule: a move changes location, a list change names the same location twice.

**6. Typed payloads: fixed.** Every event goes through `insertLocationChanged(payloads: readonly ArtworkRegisterLocationChangedPayloadV1[])`. Mutations: a bad `reason` value and a renamed key (`stock_code`) both fail `tsc`.

**4. `MOVE_BATCH_MAX`: fixed.**
- `planMoveBatch` runs before the transaction opens, and `moveArtworksRequestSchema` applies the same limit.
- `LocationMoveRefusal` includes `too_many`.
- Mutation: removing the store check fails the integration test. Contract unit tests cover the plan rule and the schema.

**5. Retiring again is a no-op: fixed.** It reads the row under lock and returns `changed: false` without bumping the version, overwriting `retired_at` or publishing an event. Mutation: disabling the check fails 1 test.

**7. Drizzle schema matches the migration: fixed.**
- All five `artwork_location` checks and the note check on `artwork_location_move` are mirrored.
- Index names, the RESTRICT foreign keys, column types and defaults match.
- The 0404 unit test compares each check's name and normalised body. Mutation: dropping `artwork_location_version_check` from the schema fails it.

**Migration, rollback and numbering: consistent.**
- The rollback's `created_at` is `1813147200000`, which equals the journal `when`.
- The integration test passes 8/8: the rollback runs twice, the migration reapplies, and the rollback refuses while moves exist.
- `scripts/ci/verify-migration-pairs.mjs` exits 0.
- `origin/main` (now `59b3411d`, which was force-updated) still ends at `0403_notification_outbox_retry_backoff`, idx 395. So 0404 / idx 396 does not collide, and the PR merges cleanly into current main.
- 11 still applies: renumber at ship. Change the rollback `created_at`, the journal `when`, both test file names and `TAG` together.

**PR body:**
- "For later PRs" (8: the audit row in the same transaction and a server-side recent sign-in; 9: SELECT for `worker_app` and the consumer) is present.
- "Needs owner" (`LAX_Location` field creation and rollout; the "Gallery staff" and "Fulfilment" mapping, 10) is present.
- There is no AI footer.

**Zoho:** nothing in the diff calls or writes to Zoho. The event has `consumers: []`.

**Route JS, budgets and baselines:**
- No budget, baseline or allowance file changed.
- The only `apps/web` change is one label line in `domain-event-labels.ts`. It came in the original commit `136e1c80`, not from the fixer, and an existing test requires a label for every event type.

**Commits:** all are by mahmoudamrspace, with no Co-Authored-By or Claude trailers.

**CI:** 41 check runs on `ff1d05d2`. All succeeded, apart from `art-browser-gates`, which was skipped as not affected. They include `ci-result`, `test`, `build`, `static-checks`, `browser-gates`, the auth and worker role contracts, the shop-api and web shards, and shop-v1 integration.

**Also passing locally:**
- db: the 0404 unit and integration tests, `migrate-roles`, and the `shop_app` and `api_app` contracts (126 tests).
- persistence `stock-location.integration` (20).
- The artwork-register-contracts and shop-domain test suites, and the types domain-event catalog tests.
- `turbo typecheck` for db, types, contracts, persistence and shop-domain (15/15 tasks).

**Polish for PR 2 (not blocking):**
- `updateLocation` bumps the version and publishes even when the name and note are unchanged. The route can skip a no-op edit.
- The audit label "Artwork moved to another location" now also covers renames and retirements. Word it by `reason` when the Location panel lands.
