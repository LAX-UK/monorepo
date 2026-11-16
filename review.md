Verdict: SHIP

# Final recheck (round 3) of PR #1481

Reviewed head `d882ec96` (branch `followups/refund-flags-pdf-fonts-runbooks-books-fairness`, base `a54b584f`). Three commits since the last recheck (`e8a3642a`):

- `65b7cb04` Identity boundary guard: read the git file listing into a 64 MiB buffer
- `68f995a4` Collection booking runbook: name the counters the dry run prints
- `d882ec96` Accounting work queue: skip the turn of an entity with nothing waiting

All four findings from the last recheck are resolved, and nothing blocks the merge. Every CI check on the head had finished, and passed, before this review was written.

## What I ran

- `corepack enable`, `pnpm install --frozen-lockfile` and `pnpm -r --filter './packages/**' build` all passed.
- `turbo typecheck` for persistence, exports, db and their dependencies: 25/25 passed. `biome check .`: clean (17,295 files).
- `packages/persistence` accounting tests on a fresh Postgres 16 database (migrate + roles, `--maxWorkers=2`): 4 files, 81 passed, 6 skipped.
- `packages/exports` vitest (`--maxWorkers=2`): 57/57 passed. `backfill-payment-refund-args.test.ts`: 13/13 passed.
- `node --test scripts/ci/verify-identity-boundary.test.mjs`: 5/5 passed. `node scripts/ci/verify-identity-boundary.mjs`: exit 0 with a 1,053,825-byte listing, the same size that overflowed last round.
- `git merge-tree` of this head with `origin/enquiry-inbound-replies-part-b` (PR #1479): merges with no conflicts.
- I ran the collection reminder key backfill dry run against the migrated database and the refund backfill commands through pnpm.
- CI on `d882ec96` (REST check-runs): all four workflow runs for this head finished with success: CI (run 43792781921, which includes `test`, `build`, `static-checks`, `identity-acceptance-preflight`, `identity boundary conformance` and `ci-result`), Web PR browser gates (43792781914, which includes `browser-gates`), Art PR browser gates (43792781926) and Account PR browser gates (43792781922). Nothing failed.
- Commit messages (all 12 commits since `a54b584f`), the PR title and the PR body contain no `Co-Authored-By`, `Claude-Session` or "Generated with/by" lines. That check is clean.

## Findings

### Blocking

None.

### Minor / notes (none block the merge)

1. **The PR body's Testing section still describes the first version.** The Summary now matches the code, and so do "Changes after review" and "Changes after recheck". The Testing section, though, still says:
   - `exports (42)`; the suite now has 57 tests.
   - "counts today's issued documents… fails on `main` too … and is unrelated". It passes now, and the cause was this PR's fixtures, which were fixed in round 1.

   The fairness bullet in the Summary also does not mention the 5-second skip of an entity with nothing waiting; only "Changes after recheck" describes it.

   If the PR is squash-merged, the body becomes the commit message, so trim or update the Testing section first. This does not block the merge.
2. **`emptyUntil` is not cleared when the skipped entity's work is claimed by the plain pick** (`packages/persistence/src/repositories/accounting/drizzle-accounting-document.work-queue.ts:232-241`).
   - If a document for the skipped entity arrives during the pause, the queue can claim it through the plain pick, oldest first. The entity still stays out of the turn order until the 5 seconds (`EMPTY_TURN_MS`, `:27`) are up.
   - This delays fairness by at most 5 seconds and never delays the work itself, which matches the docstring at `:49-55`. Nothing needs changing.
3. **The new guard test checks the headroom, not the overflow message** (`scripts/ci/verify-identity-boundary.test.mjs:15-25`).
   - The test checks that the listing is under a quarter of `GIT_LISTING_MAX_BUFFER`, which catches growth long before it overflows.
   - The loud-failure path (`scripts/ci/verify-identity-boundary.mjs:99-103`) has no test. I checked it by hand: `spawnSync` with a small `maxBuffer` sets `status = null` and `error.message = "spawnSync git ENOBUFS"`. The new condition, `result.error || result.status !== 0`, catches that and puts the message in the thrown error.
   - Good enough as it is.

## Last recheck's findings, rechecked

- **1 (BLOCKING). Fixed.**
  - `trackedText()` now passes `maxBuffer: GIT_LISTING_MAX_BUFFER`, which is 64 MiB (`scripts/ci/verify-identity-boundary.mjs:89-97`).
  - It throws when `result.error` is set or the status is non-zero, and the message includes `result.error.message` (`:98-103`). Before, an `ENOBUFS` failure surfaced only as a generic "unable to enumerate repository files".
  - A test pins at least 4x headroom over the real listing (`verify-identity-boundary.test.mjs:15-25`).
  - `scripts/ci/verify-identity-boundary.mjs` and its test file are byte-identical to the ones on `origin/enquiry-inbound-replies-part-b` (PR #1479): `git diff` between the two branches shows nothing under `scripts/ci/`. The two branches merge cleanly.
  - `identity-acceptance-preflight` and `browser-gates`, the two checks that failed last round, now pass on CI.
- **2. Fixed.** The Summary now matches the code:
  - The reminder backfill must run before the deploy.
  - Fairness uses an in-process record of whose turn it is.
  - Mixed-script names get bidi layout, are shrunk down to 7 pt, and then wrap.
  - The fonts are about 3.3 MB in 90 slices; on disk there are 90 `.woff` files and 3,309,071 bytes.
  - The Testing section is still stale (minor finding 1).
- **3. Fixed.**
  - `docs/runbooks/collection-booking.md:163-165` now tells you to note `would_rewrite`, says `--apply` prints `rewritten=`, and expects `would_rewrite=0` from a second dry run.
  - This matches `packages/db/src/scripts/backfill-collection-reminder-keys.ts:105`. Running the dry run printed: `dry run (nothing written; pass --apply): scanned=0 would_rewrite=0 skipped_existing=0 skipped_unparsable=0`.
- **4. Fixed.**
  - When the narrowed pick for the entity whose turn it is finds nothing, that entity is left out of the turn order for `EMPTY_TURN_MS` (5,000 ms; `drizzle-accounting-document.work-queue.ts:27, 55, 229-243`). Later claims in that window run the plain query only.
  - The key is `provider/entity`, so Books and Xero do not affect each other.
  - The time comes from the queue's injected clock.
  - New test "leaves an entity with nothing waiting out of the turn order for a short while" (`accounting-persistence.integration.test.ts:534-547`). It passes.
  - **The test fails without the fix.** I disabled the `emptyUntil.set` line locally and ran it again. It failed, because Shop's document was claimed before `bid[2]`. So the test proves the second query is skipped during the pause. It also proves the skipped entity gets its turn back afterwards and is not starved.
  - The claim statements themselves are unchanged since the last recheck, so the `EXPLAIN` figures there still hold. The empty-turn cost (up to 43 ms at 50,000 pending) is now paid at most once every 5 s per entity, rather than on every claim.
- **5, 6.** No change was needed, and none was made.

## Earlier fixes, still in place

- **Refund CLI.** I ran these through pnpm against the migrated local database:

  | Command | Result |
  |---|---|
  | `pnpm --filter @auction/db db:backfill-payment-refund` | Dry run, exit 0 |
  | The runbook command, `… -- --apply` | Applied, exit 0 |
  | A resume command, `… -- --apply --batch-size=200 --lock-timeout=5000ms --resume-after=<uuid>` | Applied, exit 0 |
  | A typo, `… -- --aply` | `Unknown argument "--aply"`, exit 1 |

  The args tests pass 13/13.
- **Claim query performance.** The narrowed and plain claim statements are unchanged since `e8a3642a`. Both keep `FOR UPDATE SKIP LOCKED` and have no per-row subquery. The only addition is the in-memory skip described above.
- **OFL notices.** `packages/exports/fonts/fallback/OFL-noto-fallbacks.txt:1-8` still opens with the three family copyright lines: Arabic 2022, Hebrew 2024, and SC (c) 2014-2021 Adobe with Reserved Font Name 'Source'.
- **Fonts used.** All 90 `.woff` files are on disk, and the exports test that matches files to the manifest and checks every slice is reachable passes. `fonts/fallback` holds 3,309,071 bytes.
- **Bidi.** `packages/exports` is unchanged since the last recheck, and its 57 tests pass, including the content-stream position tests: shared baseline, contiguous x positions, correct fonts, and nothing past the column edge.
