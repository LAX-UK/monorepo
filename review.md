Verdict: FIX FIRST

# Final recheck of PR #1477: Storage terms 3/7, Bid admin staff Storage tab

Head rechecked: `53a272f7` (`storage-terms-staff-tab`). The head did not change from at least 00:31 to 00:48 UTC (last commit 00:24). Judged against the first review (of `c66cc7ba`), the PR body's "Changes after review", `docs/design/storage-terms.md` and `docs/design/staff-design-standard.md`. Line numbers refer to `53a272f7`.

The code is ready: all 19 findings are fixed or recorded as deliberate. The concurrency guard is real, and I proved it against Postgres 16. The verdict is FIX FIRST for one process reason only: **the branch conflicts with `main`, so CI has not run on any commit made after the review.** Resolve the conflict, let CI go green, and this ships. Nothing else blocks.

## Findings

1. **BLOCKING (merge): the branch conflicts with `main`, and CI has not run on the fixes.**
   - GitHub reports `mergeable_state: dirty`.
   - The REST check-runs list is empty (0) for `53a272f7` and for every fixer commit (`e79c4aed`, `983c4a71`, `d6538728`, `43f7db7d`). The reviewed head `c66cc7ba` had 40.
   - The PR's own claim of passing checks applies to the old head only.
   - The conflict is one import block in `packages/staff-ui/src/display/key-value-list.tsx:3-9`. #1473 moved `CopyButton` into `./copy-button.js`, and this PR added `KEY_VALUE_ROW`.
   - Resolution: keep main's `import { CopyButton } from "./copy-button.js"` and add `import { KEY_VALUE_ROW } from "./key-value-row.js"`. Drop the `StaffButton` import. Keep the PR's `cn(KEY_VALUE_ROW, "items-baseline")` row.
   - I tried this locally: staff-ui `tsc` is clean, and all 641 staff-ui tests pass. The one file that fails to load is main's new `copy-button.test.tsx`, because `@testing-library/user-event` comes from main's lockfile and not this branch's. A real merge with a fresh install fixes that.
   - Merge `main` (no force push needed), then read `ci-result` before merging.

2. **Should-fix (craft): uneven card bottoms at 1440.** `storage-panel.tsx:127` uses `grid items-start`, so cards in a row keep their own heights:
   - In `01-charging-off-1440-*` and `11-charging-focus-1440-*`, Charging ends about 185px above In force and leaves a ragged gap before History.
   - In `02-scheduled-1440-*` and `07-read-only-fulfilment-1440-*`, Scheduled ends about 15px short of In force.

   Use `items-stretch` and let `Section` fill the height (`h-full`), so cards that share a row share a bottom edge. The orphan from finding 9 of the first review is gone: Charging now spans the full width when a change is scheduled.

3. **Should-fix (craft, PRM-2 on a phone): the blocked "Schedule a change" gives its reason only in a tooltip.**
   - `storage-cards.tsx:58` passes `disabledReason` to `StaffButton`, which shows the reason on hover or focus. The button is focusable, so it meets the letter of PRM-2.
   - At 375 (`02-scheduled-375-*`) there is no hover, so a Finance user sees a grey button and no reason. The PR body records this as known.
   - The same tab already draws the Charging reason as an inline `DisabledReason` line ("one reason style" in the last commit's title). Use the same line under the In force header when a change waits ("A change is already scheduled. Edit or cancel it first.").

4. **Nit (craft): the Scheduled table still wraps at 375.** The PR body says the short labels stay on one line at 375. In `02-scheduled-375-*`, "Free storage" still breaks onto two lines, and so do both values ("14 calendar / days free"). Shorten the row to "Free" plus "14 calendar days", or let the label column take its content width.

5. **Nit (craft): field widths in the sheet.** Free days (0 to 90, at most 2 characters) and the three money inputs (up to £500.00) are full-width, about 450px at 1440 (`03-sheet-errors-1440-*`, `04-sheet-preview-1440-*`). A 2-digit field drawn as wide as the Reason textarea does not tell staff what it expects. Cap them at a content width, for example `max-w-40` for days and `max-w-56` for money. The standard has no field-width rule, so this is polish, not a breach.

6. **Nit: labels differ between cards that sit side by side.** In force says "Standard works", "Large works" and "Handling fee". The Scheduled table beside it says "Standard", "Large" and "Handling" (`storage-copy.ts:58-63`). The short labels were chosen for 375; use the same short labels in the In force list, or the long ones in the table at `lg`.

7. **Nit (kit): the `DateInput` fallback example is still a fixed past day.** `packages/staff-ui/src/forms/date-input.tsx:71` uses `min ?? "2026-10-24"`. The Storage sheet passes `min`, so this tab is fixed (the sheet reads "e.g. 17 Nov 2026"), but every other date field with no `min` still shows a day in the past. Use today, or no date, as the fallback. This can be a kit follow-up.

8. **Nit (test strength): the concurrency test can miss a removed lock when run alone.** See "Blocking 1 re-verified" below. With the lock removed, the full integration file fails 5 times out of 5. Run alone with `-t "same moment"` on a cold pool, it passed 3 times out of 3, because the four calls happened to serialise. Before the `Promise.all`, warm the pool or open four connections, for example with a `select 1` on each, so the test does not depend on run order.

9. **Known, carried over (not blocking):** in dark mode, the kit `ChangesTable` highlight (amber struck-through values on brown) still has weak contrast (`02-scheduled-1440-dark`). It is kit-wide; it needs a ticket.

## The 19 findings of the first review

| # | Status | Evidence |
|---|---|---|
| 1 Blocking: one change at a time | **Fixed** | See below. Proven under concurrency on Postgres 16, and fails both mutations. |
| 2 History filtered in SQL | Fixed | `listPlaceAudit` with `lot_id IS NULL` (`drizzle-collection-storage.repository.ts:441-446`). The service reads exactly 50. Integration test plus a service test with 250 newer per-lot rows. |
| 3 London date in summer time | Fixed | Service test at `2026-07-01T23:30Z`: 2 Jul refused, 3 Jul accepted. |
| 4 Buyer reach and banner | Fixed (tracked) | Interim notice in `storage-copy.ts`. `docs/design/storage-terms.md` "Until the buyer pages move" lists the PR 4 work: `recordTermsForSale` at sale close, the two buyer reads, and restoring the notice. |
| 5 Stale error banner | Fixed | `saved()` clears `failure` (`storage-panel.tsx:43-46`). Tests cover a failed cancel, a failed switch, and failure then success. |
| 6 Hand-over badge for Finance | Fixed | `badgeRequirement: COLLECTIONS_READ_ACCESS`, removed by `badgeFor` (`staff-nav.ts:105,147`). Has a test. |
| 7 Blocked switch (PRM-2) | Fixed | `aria-disabled`, focusable, described by the reason, and a press does nothing (tested). Reason on its own line with a lock icon; the focus ring is visible (`11-charging-focus-*`). |
| 8 Large field width | Fixed | `FieldRow` removed. Standard and Large are the same width, and the hint is on one line. |
| 9 Charging card alone | Fixed | Charging spans the full width when a change is scheduled. Uneven heights remain: new finding 2. |
| 10 Test gaps | Fixed | New tests for the server action, `loadCollectionsPage` for Finance, switching on through the confirmation, and the real `createAdminRoutes` mount. The `@journey` e2e is still not run and must pass in the stabilisation job. |
| 11 Large £0 and preview wording | Fixed | `pence.min(1).nullable()` at the edge, the form error, and the spec preview updated to the buyer formatter's wording. |
| 12 Start date cap | Fixed | `latestStorageTermsStart` (2 years, 29 Feb becomes 28 Feb). `start_too_late` 422 on schedule and edit. Form hint, error and calendar max. |
| 13 Old fields | Fixed | TODO and removal recorded in the spec. |
| 14 Copy | Fixed | "Shown in History.", "Large band", "Off", and the one-line reason. The spec is updated to match. |
| 15 Preview re-announced | Fixed | `Notice quiet` (`role="note"`), plus an `<output>` that speaks after 800 ms. Tested with fake timers. |
| 16 Skeleton | Fixed | Kit `SectionSkeleton` with `KEY_VALUE_ROW`, a chip placeholder, a header button only on In force, and table rows for History. `09-loading-1440` matches the loaded layout closely. |
| 17 Table alignment | Fixed | "Starts on" row removed, the reason is a line under the table, and the History Change cell has padding. 375 wrapping only partly fixed: new finding 4. |
| 18 Date placeholder | Fixed on this tab | The example comes from `min`. Kit fallback: new finding 7. |
| 19 Summary for one error | Recorded | Deliberate exception to FRM-4 in the spec. |

## Blocking 1 re-verified

- **How it is enforced:** no migration was added. `scheduleTerms` (`drizzle-collection-storage.repository.ts:146-183`) runs in one transaction:
  1. `lockCollectionPlace` takes `pg_advisory_xact_lock(hashtextextended('collection_place:<id>'))`.
  2. It checks `startIsTaken`.
  3. It checks `changeIsWaiting` (a live row with `effective_from > today`, :527-540).
  4. It inserts the row and its audit row.
- **Why it holds:** the default isolation is READ COMMITTED, and each statement after the lock takes a fresh snapshot. So a second transaction that waited on the lock sees the first one's committed row and refuses.
- **No other way in:** `scheduleTerms` is the only insert into `collection_storage_terms`. The edit path also takes the place lock.
- **One rule:** the service's unlocked pre-check was removed, so the rule lives in one place, and the in-memory double has the same rule.
- **Test against real Postgres 16** (local, `db:migrate` + `db:roles`): `drizzle-collection-storage` 23 passed, `drizzle-collection-settings` 14 passed. The new test sends four schedules for one place at once: one is saved, three are refused, and one audit row is written.
- **Mutation A** (the `changeIsWaiting` check disabled): the test fails.
- **Mutation B** (the lock removed from `scheduleTerms`, check kept): the full file fails 5 times out of 5. With an added `pg_sleep(0.05)` between check and insert, the test sees 4 rows saved ("expected length 1 but got 4"). Run alone with `-t`, it passed 3 times out of 3 (finding 8).
- I restored the file after each mutation; the working tree is clean.

## Security (re-checked on the new head)

- **Capability and step-up:** routes, middleware, the step-up registry and the server action are unchanged since `c66cc7ba`; only tests were added. The new `collection-storage.mount.test.ts` exercises the real `createAdminRoutes` order: the role matrix for read and schedule, step-up for Finance, and Finance can list places but not open Hours and rules.
- **Fulfilment read-only:** the server action is still gated on `COLLECTION_STORAGE_ACCESS`. The UI hides "Schedule a change", Edit and Cancel, and shows "Raise storage invoices: Off" with the reason line (`07-read-only-fulfilment-*`).
- **Edge validation:**
  - `largeDailyPence` is 1 to 50,000 or null.
  - The start-date cap needs the London "today", so it is checked in the service (`startProblem`, `collection-storage.service.ts:110-114`) on schedule and edit, and also in the repository for the lower bound.
  - Refusals write no row and no audit (tested).
- **Audit:** every write still writes its audit row in the same transaction. History now reads place-level rows only.

## AI attribution

None. The six commit messages on the PR (author and committer `mahmoudamrspace`) and the PR title and body contain no Co-Authored-By, Claude-Session or generated-by lines.

## UI judgement (44 screenshots at `23e92986`, taken after the last code commit)

I looked at every state at 1440 and 375, in light and dark.

- **Holds up well:**
  - The honest notice.
  - The blocked switch, with its reason on its own line, a lock icon, higher-contrast text and a visible focus ring.
  - The Scheduled card: a before → after table, a reason line, and Cancel change as a secondary button beside Edit.
  - The History cells are now aligned.
  - The sheet: the error summary links to fields, inline errors clear on fix (tested), and the preview reads word for word as buyers will see it.
  - The skeleton is close to the loaded page, with a chip placeholder.
  - No horizontal overflow at 375, and dark mode is clean apart from finding 9.
- **Still short of "perfect":** findings 2 to 6. None of them blocks.

## What I ran (on `53a272f7`, after `pnpm install --frozen-lockfile` and the packages build)

- **Tests (`--maxWorkers=2`), all passing:**
  - domain `storage-terms`: 74.
  - validators `collection-storage`/`collection-settings`: 26.
  - staff-ui (full): 639.
  - ui `notice`: 4.
  - api `collection-storage`, `collection-settings` and `dangerous-staff`: 129, including the mount test.
  - web `components/admin/collections`, `lib/admin`, `lib/navigation`, `components/layout`, `lib/actions/admin`, `hooks/use-settled-value`: 2721 in 391 files.
  - persistence `drizzle-collection*` integration on Postgres 16: 92.
- **Typecheck (`tsc --noEmit`):** clean for domain, validators, persistence, types, ui, staff-ui and api. Web has only the known `rpc-app.ts` error (`@auction/api/app`).
- **Biome:** clean on the 89 changed files.
- **Static checks, all 20 passing:** `lint:` client-copy, admin-capability-drift, layers, deps, web-guardrails, lib-admin-boundaries, staff-legacy-shell, web-barrel-imports, datetime, staff-route-composition, staff-list-template, z-schema-transform, e2e-tags, test-mocks, brand-name, legal-names, compositor, ui-guardrails, client-boundary, web-hop-links.
- **CI:** no check runs exist for the head or any fixer commit (REST check-runs `total_count: 0`), because of finding 1.
- **Not run:** the `@journey` e2e (needs the seeded full stack) and `next build`.
