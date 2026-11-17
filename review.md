Verdict: SHIP

# Independent review of PR #1522: Stock location per artwork, part 2 (LAX Admin routes)

Branch `stock-location-pr2-admin-routes`, head `c4693689`. Checked against `docs/design/stock-location.md` (ZI-6), the #1518 "For later PRs" notes, and the repo's clean-code rules.

None of the findings blocks the merge. The routes are authorised per role on the server, every write audits in the same transaction, moves are serialised by row locks, and input is validated before any lock is taken. The findings below are test gaps and small design-level follow-ups.

## What I ran (Postgres 16, local)

- `pnpm db:migrate` to the head (latest migration `0404`, from #1518) and `db:roles` with all four app roles.
- Grants checked as `shop_app`:
  - `artwork_location`: UPDATE yes, DELETE no
  - `artwork_location_move`: INSERT yes, UPDATE no
  - `artwork_register`: UPDATE yes (needed for `FOR NO KEY UPDATE`)
  - `shop_admin_audit`: INSERT yes, UPDATE no
- `api_app` and `worker_app` have no access to the location tables. That is correct for this PR: the worker only needs read access when the PR 4 Zoho mirror lands.
- Results:
  - `admin-stock-location.routes.test.ts`: 73 passed
  - `stock-location.service.integration.test.ts`: 15 passed, run for real as `shop_app` with `SHOP_V1_INTEGRATION_REQUIRED=true`
  - `route-capability.guard.test.ts` and `step-up-paths.guard.test.ts`: 34 passed
  - Total: 122 passed
- The #1518 store suite `packages/persistence/.../stock-location.integration.test.ts`: 20 passed. It includes the lock tests (a second move waits on the artwork row lock; retire and move wait on each other's location lock).
- CI: all 41 checks green. The branch merges cleanly onto the current `origin/main` (`4ab41e66`).

## Mutations (change the code, run the 4 suites, restore)

Caught (at least one test failed):

| Mutation | Test that failed |
| --- | --- |
| Move audit appended in a separate unit of work | "leaves no move, history, event or audit row when the unit of work fails after the audit" |
| No-op retire audited (`if (result.changed)` → `if (true)`) | "audits retiring once; retiring again … writes no audit row" |
| `requireRecentAuthentication` dropped on PATCH | step-up test for rename |
| `/admin/v1/artwork-locations` removed from `SHOP_ADMIN_STEP_UP_PATHS` | 8 step-up tests |
| Move route `bodyLimit` dropped | 100-artwork and repeat-count tests |
| Move needs `artwork_location.read` instead of `.move` | role matrix (catalogue_editor, read_only) |
| Restore needs `.move` instead of `.manage` | role matrix (account_manager, operations) |
| Capability check dropped on GET artwork location | role matrix (4 roles) |
| Move without `requireIdempotencyKey` | "needs an Idempotency-Key" |
| Move body not parsed with `moveArtworksRequestSchema` | 4 validation tests |
| `locationId` dropped from the move idempotency hash | "refuses the same key with a different body" |
| Note text copied into the move audit row | audit-row shape test |
| Wrong audit capability or target type | audit-row shape test |
| `beforeJson` dropped from the rename audit | rename audit test |

Survived (no test failed): see findings 2, 3 and 4.

## Extra probes (temporary test file, deleted afterwards)

- **Two concurrent moves of one artwork to different locations through the service:** both succeed one after the other, giving 2 move rows and 2 audit rows. One audit row starts from `null`, the other from where the first move left the artwork, so the audit before-state is accurate under concurrency.
- **The same key and the same body sent twice at once:** both calls return 200, with 1 move and 1 audit row.
- **The same key with a different note:** 409. **The same key with the ids reordered and repeated:** replays the first result. The behaviour is correct; the PR's tests just don't pin it (finding 4).
- **A rename that changes nothing:** `changed: true`, the version goes 1 → 2, 1 audit row and 1 `location_changed` event per artwork at the location (finding 1).

## Other checks

- **Authorisation:** every route calls `requireShopStaffCapability`. Writes to the list also require a recent sign-in, enforced on the server (`requireRecentAuthentication`) and in the BFF (`admin-proxy-policy.ts`, non-GET only), so movers can still read the list with an old sign-in. Moves sit outside the step-up path, as the PR intends. Account managers and operations still get 403 on the register.
- **Same-transaction audit:** every write runs `withAdminIdempotency`, the store, the history, the events and `tx.audit.append` in one `uow.run`. Refusals throw inside that unit of work, so the idempotency record rolls back too and a retry runs fresh.
- **Concurrency:** moves take the location share lock, then the register rows `FOR NO KEY UPDATE` in id order (no deadlock). List writes use `expectedVersion` and the store's `FOR UPDATE`.
- **Validation and error shapes:** TypeBox on the list routes, zod on moves, and every error goes through `ShopApiErrorBodySchema`: VALIDATION 400, NOT_FOUND 404, CONFLICT 409, IDEMPOTENCY_CONFLICT 409. The batch limit is applied before any lock.
- **Reads:** history is capped at 100 with `moreMoves`. `registerExists` uses `LIMIT 1`.
- **Logs, PII and secrets:** no logging added. The move audit row stores `withNote` and no note text. The tests use placeholder tokens only.
- **Migrations:** none (as expected).
- **Commits:** all 3 are authored and committed by `mahmoudamrspace <mahmoudamr.space@gmail.com>` with no trailers. The PR body has no AI footer.

## Findings

### 1. A rename that changes nothing still writes a version, an audit row and events (low)

- **Where:** `apps/shop-api/src/application/artwork-register/stock-location.service.ts:249-295`, together with `packages/persistence/src/repositories/artwork-register/drizzle-stock-location.store.ts:170-181`.
- **Failure scenario:** an Administrator saves the rename form without editing anything, or a client retries with a new key. The version bumps, which makes stale any other admin's open form. An audit row is written with an identical before and after. One `artwork_register.location_changed` event goes out per artwork at the location (probe: 1 artwork → 1 event; a store room with 300 works → 300 events). From PR 4 on, each event triggers a Zoho writeback check. Retire and restore already answer a no-op with `changed: false`, so this is inconsistent with them.
- **Fix:** in `updateLocation`, after `findLocation`, if the parsed `name` and `note` equal `before`'s and the version matches, return `{ changed: false, location }` without writing or auditing. Better still, do this in the store under its `FOR UPDATE` lock, as `setLocationStatus` does. Add a test for "a rename that changes nothing writes no audit row and no event".

### 2. `moreMoves` and the history cap are untested (low, test gap)

- **Where:** `stock-location.service.ts:78`, `:97` and `:210`.
- **Failure scenario:** both mutations survived all 122 tests:
  - `listMoves(registerId, LOCATION_HISTORY_LIMIT + 1)` changed to `LOCATION_HISTORY_LIMIT`, so `moreMoves` is always false and the panel would never say older moves exist.
  - `moves.slice(0, LOCATION_HISTORY_LIMIT)` removed, so 101 moves are returned.
- **Fix:** add a service test with a fake `reads` returning 101 moves that asserts 100 are shown and `moreMoves: true`, and one with 100 moves that asserts `moreMoves: false`. Also assert the limit passed to `listMoves`.

### 3. The add-location savepoint is untested; the "transaction still usable" claim is not proven (low, test gap and simplicity)

- **Where:** `apps/shop-api/src/infrastructure/drizzle-stock-location.ts:81-86` and `:123-136`; test `stock-location.service.integration.test.ts:351`.
- **Failure scenario:** replacing the savepoint with `return await store.addLocation(input)` passes all 122 tests. The service throws 409 as soon as the store reports `name_taken`, so the aborted outer transaction is rolled back anyway, and nothing ever runs a statement after the refusal. Either the savepoint and the `AddRefused` class are dead weight, or the PR body's claim ("with the transaction still usable") needs a test that would fail without them.
- **Fix:** pick one:
  - Keep the savepoint and add an adapter-level test that runs `addLocation` with a taken name inside `uow.run`, then runs another statement in the same `tx` and expects it to succeed.
  - Drop the savepoint and the `AddRefused` class, and reword the PR text.

### 4. The move idempotency hash's note and id normalisation are not pinned by tests (low, test gap)

- **Where:** `stock-location.service.ts:324`.
- **Failure scenario:** removing `note` from `requestPayload`, or dropping the `[...new Set(...)].sort()` normalisation, passes all 122 tests. The current code is correct (probe: a changed note → 409; reordered or repeated ids → replay). But a refactor could make the same key with a different note silently replay the first move, so the second note is lost without an error. It could also make a re-sent "Move selected" with a different selection order return 409 instead of replaying.
- **Fix:** add two integration tests: the same key with a different note → 409, and the same key with the ids reordered and repeated → equal result, with no second audit row.

### 5. The move route declares no request body schema (nit)

- **Where:** `apps/shop-api/src/routes/admin/v1/admin-stock-location.routes.ts:179-187`.
- **Failure scenario:** every other route here declares `body` in its Fastify schema. This one validates with zod by hand, so the route's own schema doesn't describe the move body. Validation is still enforced and its errors still use the shared error shape. Only the first zod issue is reported.
- **Fix:** add a TypeBox `AdminArtworkLocationMoveBodySchema` with `registerIds: uuid[]` (`minItems: 1`), `locationId: uuid` and `note` to the Fastify schema, so the route documents its body. Keep `moveArtworksRequestSchema.safeParse` for the shared batch rule, as the code comment intends.

### 6. The artwork location read uses two queries outside a snapshot, and repeats logic (nit)

- **Where:** `stock-location.service.ts:206-212`.
- **Failure scenario:** `currentLocation` and `listMoves` run in parallel on separate pool connections. If a move commits between the two reads, the panel can show a "current" location that is newer than the top history row. Also, "current = latest move" is already `moves[0]`, so the separate DISTINCT ON query computes the same thing twice.
- **Fix:** derive `current` from `moves[0]` (its `to`, `movedAt` and `movedBy`), and drop `currentLocation` from the read port for this use.

### 7. The location list read has no bound (nit)

- **Where:** `stock-location.service.ts:198-203` and the store `listLocations` (`drizzle-stock-location.store.ts:59-66`).
- **Failure scenario:** the list is staff-managed and expected to be small, but nothing caps it, which goes against the bounded-reads rule.
- **Fix:** apply a generous `LIMIT` (for example 500) and return `truncated`, or document the expected size and enforce it on add.

### 8. The design doc still reads "proposed, awaiting owner approval … Nothing here is built yet" (nit, docs)

- **Where:** `docs/design/stock-location.md:1-5`.
- **Failure scenario:** the PR calls this "the approved design", and PR 1 and PR 2 now build it. The repository records no Q35 answer, so a reader can't tell what was approved, including the open questions on who may move and the Zoho field.
- **Fix:** in a docs follow-up (or in PR 3), change the header to approved, with the date or decision reference, and note what is built so far.
