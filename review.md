Verdict: FIX FIRST

# Review of PR #1481: follow-ups (refund backfill flags, invoice PDF fonts, runbooks, Books queue fairness, marketing-ui peer dep)

Reviewed head `60d53a59` (branch `followups/refund-flags-pdf-fonts-runbooks-books-fairness`, based on `a54b584f`).

## What I ran

- `pnpm install --frozen-lockfile` passed. `pnpm -r --filter './packages/**' build` passed.
- `tsc --noEmit` in exports, db, persistence and marketing-ui passed. `biome check` on the changed paths passed.
- `packages/exports` vitest: 42/42 passed. `backfill-payment-refund-args.test.ts`: 9/9 passed.
- Accounting persistence integration suite on a fresh local Postgres 16.15 database (migrate + roles): **1 failed, 58 passed, 6 skipped**. The same suite on `origin/main` against a fresh database: 57 passed, 6 skipped.
- The two new fairness tests fail against the old queue code, so they do test the change.
- CI on the head commit (REST check-runs; GraphQL is blocked here): `test` **failed** with the same test, so `ci-result` failed. `browser-gates` was still running. Everything else passed, including `static-checks`.
- Rendered invoice PDFs from the built `dist` for Arabic, Hebrew, Chinese, Japanese, a long CJK name, mixed Latin+Arabic, Arabic+digits and Korean, then rasterised them with `pdftoppm` and checked them by eye. I also checked them with `pdffonts` and `pdftotext -bbox`.
- Benchmarked the new claim `ORDER BY` against the old one with `EXPLAIN ANALYZE` on Postgres 16 using synthetic rows (rolled back afterwards).
- Commit messages and PR title/body: no `Co-Authored-By`, `Claude-Session` or "Generated with" lines. That check is clean.

## Findings

### Blocking

1. **BLOCKING: the new fairness tests break a later test, and CI `test` is red.**
   `packages/persistence/src/repositories/accounting/accounting-persistence.integration.test.ts:462` and `:489` set `nowMs = T0 + 40 days`. `register()` then writes `issued` contact fixtures dated 2031-04-09, and `retire()` (`:451`) only cancels `sending` rows, so those fixtures stay. The `beforeEach` (`:186`) resets the clock to `T0`. After that, "counts today's issued documents, names the last one sent…" (`:1516`, assertion at `:1527`) reads `lastSent` as the newest issued row by `updated_at` (`drizzle-accounting-document.browser.ts:62-67`). That row is now a future-dated `test_org` contact, not the test's own `dry_run` invoice, so `rehearsal` comes back `false`.
   - This reproduces on every fresh database and in CI job `test` (check run 133015036162).
   - `main` passes on a fresh database.
   - Fix: have `retire()` also delete or cancel the issued fixtures the case created, or run these cases at a clock no later than the rest of the file.

2. **BLOCKING: the refund CLI now rejects the command in the runbook and the command the script tells you to resume with.**
   `collectFlags` (`packages/db/src/scripts/backfill-payment-refund-args.ts:38-58`) throws on any argument it does not know. pnpm 9.15.4 passes the `--` separator through to the script. I ran it:
   - `pnpm --filter @auction/db db:backfill-payment-refund -- --batch-size=abc` runs `tsx … "--" "--batch-size=abc"` and fails with `Unknown argument "--"`.
   - The same command without `--` gets as far as validating the value.

   Two places use the `-- --apply` form:
   - `docs/runbooks/monitoring-alerts.md:87`, the incident procedure: `pnpm --filter @auction/db db:backfill-payment-refund -- --apply`.
   - The resume line the script prints after a lock timeout (`packages/db/src/scripts/backfill-payment-refund.ts:110`).

   Both worked before this PR, because unrecognised arguments were ignored. Both now exit before connecting. Nothing gets written, but the documented recovery path is broken in the middle of an incident.
   - Fix: ignore a leading `--` (or every bare `--`) in `collectFlags`.
   - Add a test for `["--", "--apply"]`.
   - Optionally make the runbook and the resume line consistent.

3. **BLOCKING: the fairness ordering makes the claim query about 100× slower, and the cost grows with backlog × recent sends.**
   The correlated subquery in the `ORDER BY` (`packages/persistence/src/repositories/accounting/drizzle-accounting-document.work-queue.ts:164-169`) runs once for every candidate row before the sort. It scans `accounting_document_state_idx` (state, updated_at) and filters `legal_entity` row by row; no index has `legal_entity` first. Results on PG16 (`EXPLAIN ANALYZE`, `FOR UPDATE SKIP LOCKED LIMIT 1`, same shape as `step()`):

   | Pending rows | Sent in the last hour | New ordering | Old ordering |
   |---|---|---|---|
   | 2,100 | about 150 | 2.36 s | 13 ms |
   | 10,100 | about 150 | 1.30 s | 16 ms |
   | 50,000 | 2,000 | **40.0 s** (SubPlan loops=50000, 0.78 ms each) | 44 ms |

   This query runs inside the claim transaction, once per document claimed. A backlog, which is the case this change exists for, makes every claim slow, and the lapsed-lease sweep (up to `MAX_LAPSED_PER_CLAIM`=100 steps per call) multiplies it.
   - Fix: work out "last served" once per legal entity. There are only two or three, so use a CTE or `LATERAL` over the distinct entities, joined to the candidates. Or pick the oldest candidate per entity through `accounting_document_claim_idx` first, then order those few by last-served.
   - Add an index on `(legal_entity, state, updated_at)` if the subquery stays.
   - Keep `FOR UPDATE SKIP LOCKED` on the base-table row, as it is now.

4. **BLOCKING: the fallback fonts' licence file has no copyright notices.**
   `packages/exports/fonts/fallback/OFL-noto-fallbacks.txt:1` opens with just `Google Inc.`. OFL 1.1 lets you redistribute only if each copy carries the font's copyright notice. The repo is public and redistributes subset (modified) files of three families:
   - Noto Sans Arabic and Noto Sans Hebrew: "Copyright 2022 The Noto Project Authors (https://github.com/notofonts/…)".
   - Noto Sans SC: Adobe/Google notice, from Source Han Sans, with Reserved Font Name "Source".

   The licence itself (OFL) is compatible with how the repo uses the fonts. It is only the notices that are missing.
   - Fix: add the real copyright line for each family, the way `fonts/OFL-noto-sans.txt:1` does.

### Should fix (not blocking)

5. **1.59 MB of font files nothing loads.**
   `manifest.json` references 101 of the 104 `.woff` files. These three are never loaded:
   - `noto-sans-sc-chinese-simplified-400-normal.woff`: 1,564,084 bytes, a full SC face that duplicates the numbered slices.
   - `noto-sans-sc-latin-400-normal.woff`
   - `noto-sans-sc-latin-ext-400-normal.woff`

   They are 32% of the 4.97 MB this PR adds under `packages/exports/fonts/fallback` (the whole `fonts/` directory goes to 6.24 MB). Delete them.

   On size and shipping:
   - Both `apps/api/Dockerfile:38` and `apps/worker/Dockerfile:32` copy all of `packages/` into the runtime image, so each image grows by about 5 MB (about 3.4 MB after the deletion).
   - The files are not shipped to browsers: `apps/web` only uses `import type` from `@auction/exports`, and nothing in a client bundle imports `documents`.
   - Loading on demand is done properly: a slice is read only when a code point needs it, then cached per process. That cache is at most about 3.3 MB if every CJK slice is touched.
   - The rest of the slicing is sensible.

6. **Mixed Latin + Arabic/Hebrew names print with offset baselines and spaces in the wrong place.**
   I rasterised the PDFs to check. Names in a single script look correct: Arabic is shaped and joined, Arabic and Hebrew word order is right-to-left, and CJK and Japanese kana render (`佐藤 ひろし`, a 36-character CJK name). Mixed names do not:
   - `"Ahmed أحمد Ltd"` prints as `Ahmed  أحمدLtd`. The space after the Arabic inherits `rtl` (`fallback-fonts.ts:97`), gets reversed into the group and lands before the Arabic word.
   - `"شركة 123"` prints as `123شركة` with no space, where bidi gives `123 شركة`.
   - In both, the Arabic run sits about 1.5 pt lower than the Latin and digits. `pdftotext -bbox` shows `yMax` 156.9 against 149.4 for the same `y`, because each run is drawn top-aligned and Noto Sans Arabic has a taller ascent.

   Fixes:
   - Pass `baseline: "alphabetic"` (or work out per-font ascent offsets) in `doc.text(run.text, cursor, y, { lineBreak: false })` at `fallback-fonts.ts:205`.
   - Leave whitespace at the edge of an RTL group outside it.
   - The tests only check that each font is embedded, which is why they passed. Add a check on the drawn positions (for example `pdftotext -bbox`-style text order), or at least one mixed-script render test.

7. **The Books runbook says "needs_review and failed … are reported on their own lines", which does not match the code.**
   The daily report's own line is `parked`. That covers only `state = 'needs_review' AND needs_review_reason LIKE 'accounting_parked_%'` (`packages/persistence/src/repositories/accounting/drizzle-stripe-books.ts:490-493`). `failed` documents, and `needs_review` for other reasons, are on no line at all. They show up only as an unexplained `differencePence` or count mismatch (`apps/worker/src/finance/accounting/stripe-reconciliation.service.ts:225-242`).

   The rest of that paragraph is accurate:
   - "Not issued" is `pending`/`sending`/`unknown` (`drizzle-stripe-books.ts:263-264, 381`).
   - The admin view has a "Needs a person" list.

   Fix: in `docs/runbooks/monitoring-alerts.md:822-830`, reword to say that parked documents have their own line, and that failed and other needs-review documents show up as a difference.

8. **The collection-booking runbook gets the consequence of skipping the backfill backwards.**
   `docs/runbooks/collection-booking.md:158-163` says "an old-format reminder simply goes unsent". The sweep (`apps/worker/src/jobs/collection-reminders.ts:39-46`) uses the new-format key only to check what has already been sent, and always calls `emailService.enqueue(email)`. A visit whose reminder already went out under an old-format key is therefore not recognised, so the buyer gets the email again, plus a second inbox notice (`remindedNow`). Skipping the backfill means duplicate reminders, not missed ones.

   The advice to run it before the deploy is still right. The reason given, and the "nothing breaks" framing, are wrong. Fix: reword so on-call staff do not treat it as optional.

### Minor / notes

9. **Fairness can be skewed by unrelated activity.**
   The "last served" subquery (`drizzle-accounting-document.work-queue.ts:164-169`) counts every `sending` or `issued` row of the entity:
   - for any provider (Xero activity included), and
   - for any update to an issued row (for example copy-email bookkeeping bumps `updated_at`).

   An entity can look recently served without a Books send. This does not cause starvation: after each claim the served entity becomes the most recent, so entities take turns. But the order is not purely "least recently served by Books". If you want that, filter on `target_provider` and use a dedicated served-at timestamp.

   Concurrency is still correct:
   - `FOR UPDATE SKIP LOCKED` is still on the outer row.
   - The state change happens in the same transaction, so nothing is claimed twice.
   - Two concurrent workers can both pick the same entity, because neither sees the other's uncommitted `sending` row. That only weakens fairness, not correctness.

10. **The `step()` docstring is out of date.**
    `drizzle-accounting-document.work-queue.ts:106-107` still says it locks "the oldest document". The ordering now goes by entity first.

11. **The fallback-fonts module doc is inaccurate.**
    `fallback-fonts.ts:4-9`:
    - It says "Noto Sans SC and JP", but only SC is bundled. Kana comes from the SC slices, and kanji take the Simplified Chinese glyph forms, which is acceptable for names but worth stating.
    - It calls the files "Google Fonts slices". They are the @fontsource WOFF slices.

    Korean (hangul) prints as empty boxes, as it did before this PR. That is documented, but a log line or metric when `needsFallback` finds no font would make it visible.

12. **Long non-Latin names have no wrapping.**
    `textWithFallback` draws on a single line and shrinks the text down to 6 pt. Anything still too long runs past `width: 355` without being clipped. This is fine for typical names; I tested a 36-character CJK name and it fit without shrinking.

13. **PDF time and memory are acceptable.**
    Warm render time per invoice:

    | Name | Time per invoice |
    |---|---|
    | Latin | about 80 ms |
    | Arabic | about 210 ms |
    | Long CJK name (6+ slices) | about 220 ms |

    RSS stayed flat at about 250 MB and heap at about 25 MB over 100 renders, so there is no leak; the per-file buffer cache is bounded. The Latin path reads no fallback file, as intended. The `_fontFamilies` alias workaround (`fallback-fonts.ts:153-163`) does what it claims: `pdffonts` shows one embedded `NotoSansSC-Regular` subset per slice used. It relies on PDFKit internals, though, so pin `pdfkit` (already `0.15.0`) and keep the test at `fallback-fonts.test.ts:76-79`.

14. **Refund CLI otherwise looks good.**
    - Unknown flags, values on `--apply`, bare value flags and repeated flags (`--apply` and each value flag) are all rejected with clear messages.
    - The tests cover typos (`--aply`, `--batchsize=5`), stray positionals and repeats.
    - Only the `--` regression in finding 2 needs fixing.

15. **marketing-ui peer dependency is fine.**
    `next >=15.3.0` (`packages/marketing-ui/package.json:352`) is met by every consumer (15.5.9 / ^15.5.21), and the frozen install passed.
