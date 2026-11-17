Verdict: SHIP

# Review of PR #1551: stock location, follow-ups to the #1522 review

Head `9f370812` (one commit, by mahmoudamrspace, no trailers). The review on `review-notes-pr1522-review` listed four low findings and two nits that this follow-up was asked to handle:

- no-op rename
- `moreMoves` cap
- add-location savepoint
- move idempotency hash inputs
- TypeBox move body
- single-snapshot read

The PR body says #1526 (already on `main` as `200216f1`) handled every one except the single-snapshot read, and that this PR does the last. I checked each one on the PR head, including the ones that landed in #1526. Each is handled correctly. This PR changes nothing beyond the snapshot read, and nothing blocks the merge.

## What I ran (Postgres 16, local; migrations + `db:roles`, shop suites as `shop_app` with `SHOP_V1_INTEGRATION_REQUIRED=true`)

| Suite | Result |
| --- | --- |
| `apps/shop-api` `stock-location.service.test.ts`, `stock-location.service.integration.test.ts`, `admin-stock-location.routes.test.ts` | 102 passed |
| `packages/persistence` `stock-location.integration.test.ts` | 23 passed |

`tsc --noEmit` and `biome check` are clean for shop-api.

## Each finding, with a mutation to prove the test catches it

Each mutation was made to the code, the suites were run, and the code was restored.

| #1522 finding | Where it is handled | Mutation → test that failed |
| --- | --- | --- |
| 1. A no-op rename bumps the version, audits and emits | `packages/persistence/src/repositories/artwork-register/drizzle-stock-location.store.ts:179-181`: under the `FOR UPDATE` lock, the same name and note at the current version returns `changed: false` before `writeVersioned` or `publishListChange`. The service skips the audit when `!changed` (`stock-location.service.ts:320`). A stale version with matching values still returns `stale` (correct). | Check replaced with `if (false)` → store test "changes nothing when a location is saved with the name and note it has". The service integration test `stock-location.service.integration.test.ts:497` asserts the version is unchanged, there are 0 audit rows and no new events. |
| 2. The `moreMoves` cap is untested (100/101) | `stock-location.service.test.ts`: 100 moves → `moreMoves: false`; 101 → 100 shown and `moreMoves: true`; asserts the limit passed is `LIMIT + 1`. | `LIMIT + 1` → `LIMIT` → 2 tests fail. Removing `slice(0, LIMIT)` (`stock-location.service.ts:82`) → "shows the newest 100 and flags older moves" fails. |
| 3. The add-location savepoint is unproven | Kept and moved into the store: `addLocation` runs in `this.db.transaction` (a savepoint when nested), `drizzle-stock-location.store.ts:145-167`. The shop-api adapter's savepoint and `AddRefused` are gone. | Savepoint removed → `stock-location.integration.test.ts:580` "keeps a caller's transaction usable after refusing a taken name" fails, because a second insert in the same tx runs after the refusal. Proven. |
| 4. The move idempotency hash inputs are unpinned | `stock-location.service.ts:368`: `{ registerIds: [...new Set(ids)].sort(), locationId, note }` | `note` dropped → "refuses the same key with a different note" (`integration.test.ts:295`) fails. Normalisation dropped → "replays the same key with the ids reordered and repeated, auditing once" (`:315`) fails. |
| 5. No TypeBox body on the move route | `admin-stock-location.routes.ts:191`: `body: AdminArtworkLocationMoveBodySchema`. `moveArtworksRequestSchema.safeParse` is still applied (`:199`) for the shared batch rule, as recommended. | (schema declaration; the route suite still passes 73 validation and role cases) |
| 6. The location read is not a single snapshot | **This PR.** The `registerExists` and `listMoves` ports are replaced by `artworkMoves`, which runs both selects in one `repeatable read, read only` transaction (`apps/shop-api/src/infrastructure/drizzle-stock-location.ts:22-35`) and returns null for an unknown artwork. `current` was already derived from `moves[0]` by #1526. | `isolationLevel` removed (read committed) → the new test "reads the artwork and its moves in one snapshot" fails. The test commits a real move on another connection between the two selects, so it exercises the real anomaly. |

## No behaviour change beyond these

- The only non-test change is the read port and adapter, plus two lines in `artworkLocation` (`stock-location.service.ts:246-249`).
- The result for a known artwork is unchanged, and an unknown id still returns null (route 404). A new unit test checks that the null case does not call `namesFor`.
- No other callers of `registerExists`, `listMoves` or the reads port exist; I grepped the repo.
- The transaction is read-only and takes no row locks, so it can't block moves. It adds a BEGIN/COMMIT round trip on one pooled connection, which is negligible for a panel read.
- No migration, route, schema or grant change.

## Findings

None blocking.

- **Nit:** the new integration test's `movingBetweenReads` builds a stub with `Object.assign(Object.create(store), …)`. It is clear enough with the comment above it, so no change is needed.
- **Carried over, outside this PR's brief:** #1522 findings 7 (no bound on the location list) and 8 (the design doc header still says "proposed") were nits that were not in the asked-for list. Check them separately if they still matter.
