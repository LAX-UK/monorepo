Verdict: FIX FIRST

# Recheck of PR #1481 after the fixes

Reviewed head `e8a3642a` (branch `followups/refund-flags-pdf-fonts-runbooks-books-fairness`, base `a54b584f`). The head had not changed for more than 30 minutes and every CI check on it had finished before this review started.

Findings 1 to 12 from the first review are all fixed. One new problem blocks the merge: this PR makes CI fail in a way it did not before (finding 1 below).

## What I ran

- `corepack enable`, `pnpm install --frozen-lockfile` and `pnpm -r --filter './packages/**' build` all passed.
- `turbo typecheck` for exports, persistence, db, marketing-ui and their dependencies: 17/17 passed. `biome check .`: clean.
- `packages/exports` vitest (`--maxWorkers=2`): 57/57 passed. `backfill-payment-refund-args.test.ts`: 13/13 passed.
- The whole `packages/persistence` suite on a fresh Postgres 16.15 database (migrate + roles, `--maxWorkers=2`): 171 files, 1043 passed, 11 skipped, 0 failed. The accounting persistence file: 62 passed, 6 skipped.
- CI on `e8a3642a` (REST check-runs):
  - `test` passed.
  - `identity-acceptance-preflight` and `browser-gates` failed, so `ci-result` failed.
  - Everything else passed.
- I ran the refund backfill commands through pnpm against a local database (details under finding 2 of the first review below).
- `EXPLAIN (ANALYZE, BUFFERS)` on PG16, comparing the old claim with the new narrowed claim on a seeded backlog.
- I rendered invoice PDFs from the built `dist` and rasterised them with `pdftoppm`.
- I read each font file's copyright string with fontkit.
- Commit messages, the PR title and the PR body contain no `Co-Authored-By`, `Claude-Session` or "Generated with" lines. That check is clean.

## Findings

### Blocking

1. **BLOCKING (new): the added font files push the repository's file list past a 1 MiB buffer, which breaks the identity boundary probe and turns CI red.**
   - Both `identity-acceptance-preflight` (check run 133039390278) and `browser-gates` (133039462286) stop at `Error: unable to enumerate repository files`, thrown at `scripts/ci/verify-identity-boundary.mjs:95`.
   - `trackedText()` (`scripts/ci/verify-identity-boundary.mjs:89-95`) runs `git ls-files --cached --others --exclude-standard -z` through `spawnSync` with no `maxBuffer`. Node's default limit is 1,048,576 bytes.
   - The list is 1,053,825 bytes on this head and 1,047,783 bytes on `main`. The 90 fallback font files push it over the limit. `spawnSync` then returns `error.code = ENOBUFS` with `status = null` (I reproduced this locally), so the probe throws.
   - `ci-result` lists `identity-acceptance-preflight` in its `needs`, so it fails as well.
   - Fix: pass a larger `maxBuffer` to that `spawnSync` (for example 64 MiB, as `scripts/ci/verify-terraform-plan-safe.mjs:11` does). Also report `result.error` in the thrown message, so the cause shows up in the log.
   - Shortening the font file names would not be enough: `main` is only 793 bytes under the limit, so the next PR that adds files would hit the same failure.

### Should fix (not blocking)

2. **The PR body's Summary still describes the first version.** The "Changes after review" section is accurate, but the Summary contradicts it:
   - It says the reminder backfill "is optional".
   - It says fairness orders by "the entity served least recently (any of its documents `sending` or `issued` in the last hour)".
   - It says mixed-script names are shrunk "without wrapping".
   - It gives the fonts as "about 4.8 MB … ~100 slices".

   If the PR is squash-merged, this Summary becomes the commit message. Update it to match the code: about 3.3 MB, 90 slices.

3. **The collection-booking runbook names a counter the dry run does not print.**
   - `docs/runbooks/collection-booking.md:163-164` says to note the dry run's `rewritten` count and to expect "zero rewritten" from a second dry run.
   - The dry run prints `would_rewrite=` (`packages/db/src/scripts/backfill-collection-reminder-keys.ts:105`). Only `--apply` prints `rewritten=`.
   - Say `would_rewrite` for the dry run.

### Minor / notes

4. **A claim can run two queries when the entity whose turn it is has nothing waiting.**
   - Once an entity has been served, `preferredEntity` (`packages/persistence/src/repositories/accounting/drizzle-accounting-document.work-queue.ts:129-142`) keeps choosing the other entity, even while that entity has had nothing waiting for days. Every claim then runs the narrowed query, finds nothing, and runs the plain query.
   - The extra query costs 1 ms at 2,100 pending, 2.7 ms at 10,100 and 43 ms at 50,000, against 740 ms for the plain query at 50,000. That is acceptable, but a short negative cache would remove it if it ever matters.
   - Also: the narrowed query only sees the preferred entity's lapsed `sending` rows. A lapsed lease of the other entity is demoted to `unknown` one claim later than before. That is harmless.

5. **The fallback fonts make the API and worker Docker images bigger.** `fonts/fallback` holds 3,309,071 bytes (92 files: 90 `.woff`, the licence file and `manifest.json`). `apps/api/Dockerfile` and `apps/worker/Dockerfile` copy all of `packages/` into the image, so each image grows by about 3.3 MB. This is fine; noted only for the record.

6. **Right-to-left names are left-aligned in the value column.** A name whose paragraph direction is RTL starts at x = 190 like every other value, and its wrapped lines are left-aligned too. The word order within each line is correct. This is consistent with the column layout and does not need changing.

## First-review findings, rechecked

- **1. Fixed.** CI `test` passes on the head.
  - The fairness cases now run at `T0` with their own queue instance (`accounting-persistence.integration.test.ts:481-534`).
  - The whole persistence suite passes on a fresh database.
  - "counts today's issued documents…" passes.
- **2. Fixed.** `collectFlags` skips a bare `--` (`packages/db/src/scripts/backfill-payment-refund-args.ts:44`). The resume line comes from `resumeCommand()` and `APPLY_COMMAND` (`:95-107`). I ran these through pnpm against a migrated local database:

  | Command | Result |
  |---|---|
  | `pnpm --filter @auction/db db:backfill-payment-refund` | Dry run, exit 0 |
  | The runbook command, `… -- --apply` | Applied, exit 0 |
  | A resume command, `… -- --apply --batch-size=200 --lock-timeout=5000ms --resume-after=<uuid>` | Applied, exit 0 |
  | A typo, `… -- --aply` | `Unknown argument "--aply"`, exit 1 |

- **3 and 9. Fixed.** The `ORDER BY` subquery is gone. The queue remembers in memory which entity it served last, keyed by provider. The worker builds the queue once (`apps/worker/src/container/create-accounting-runtime.ts:68`), so that record lasts for the life of the process.

  `EXPLAIN (ANALYZE, BUFFERS)` on PG16. I captured the exact statements from `log_statement` while the fairness test ran. The seeded backlog is Books `test_org` pending invoices, 80% Bid and 20% Shop, each waiting on an issued contact, plus issued history. All of it runs in a transaction that is rolled back. Figures are medians of 5 runs after one warm-up run:

  | Pending / recent sends / history | Old claim (`main`; also the fallback) | Bid's turn | Shop's turn | Turn of an entity with nothing waiting (extra query, then the old one) |
  |---|---|---|---|---|
  | 2,100 / 150 / 20,000 | 15.2 ms | 12.1 ms | 3.6 ms | 1.0 ms + 11.2 ms |
  | 10,100 / 150 / 50,000 | 97.1 ms | 93.2 ms | 16.8 ms | 2.7 ms + 94.9 ms |
  | 50,000 / 2,000 / 100,000 | 786.6 ms | 755.7 ms | 109.0 ms | 42.6 ms + 740.5 ms |

  The claim is no slower than on `main`. The worst case adds about 5%. The 50,000-row Bid figure is higher than the PR body's 294 ms, but it is still below the old query's time here.

  Concurrency is unchanged: both queries keep `FOR UPDATE SKIP LOCKED` on the base-table row. Only this queue's own claims count as a turn, so activity elsewhere (Xero sends, copy-email bookkeeping) no longer affects the order.
- **4. Fixed.** `packages/exports/fonts/fallback/OFL-noto-fallbacks.txt:1-8` carries one copyright line per family. I read each line back from the bundled files' name table (nameID 0) and they match exactly:
  - Arabic: Copyright 2022 The Noto Project Authors.
  - Hebrew: Copyright 2024 The Noto Project Authors.
  - SC: (c) 2014-2021 Adobe, with Reserved Font Name 'Source'.
- **5. Fixed.** There are 90 `.woff` files on disk, and `manifest.json` references all 90, so nothing unused remains. The total under `fonts/fallback` is 3,309,071 bytes, down from about 4.97 MB.
- **6. Fixed.** I rendered and checked these names; each run is on one shared baseline:

  | Name | Rendered as | Note |
  |---|---|---|
  | `Ahmed أحمد Ltd` | `Ahmed أحمد Ltd` | |
  | `شركة 123` | `123 شركة` | Space kept |
  | `David דוד Cohen & Co` | `David דוד Cohen & Co` | |
  | `شركة ABC للتجارة` | Correct RTL order with the Latin run inside | |
  | `김민수 Gallery` | Hangul blank | One `[pdf-fonts]` warning naming only the code points |
- **7 and 8. Fixed.** The runbooks now match the code:
  - The parked line is `drizzle-stripe-books.ts:490-493`.
  - The sweep re-sends because it always calls `enqueue` (`apps/worker/src/jobs/collection-reminders.ts:39-46`).
- **10 and 11. Fixed.**
  - The `step()` docstring (`drizzle-accounting-document.work-queue.ts:155-160`) describes taking turns.
  - The `fallback-fonts.ts:4-15` module doc says only SC is bundled for CJK, uses Simplified Chinese glyph forms, and calls the files @fontsource slices.
- **12. Fixed.** I checked wrapping with three long names:
  - Mixed Latin and Arabic, about 170 characters: 3 lines.
  - Pure Arabic ending in digits: 2 lines.
  - A 74-character CJK name: 3 lines, broken between characters.

  Every line is laid out with bidi on its own. `pdftotext -bbox` puts the largest `xMax` at exactly 545.0, the right edge of the column. The next row starts below the last line. Names that fit are shrunk, down to 7 pt at most, rather than wrapped.
