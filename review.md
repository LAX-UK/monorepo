Verdict: SHIP

# Final recheck (round 2) of PR #1477: Storage terms 3/7, Bid admin staff Storage tab

Head rechecked: `d9707984` (`storage-terms-staff-tab`). The last commit is from 01:07 UTC, and the head had not changed when this check started at 01:48 UTC. Judged against the previous recheck (of `53a272f7`), the PR body's "Changes after review (2)", `docs/design/storage-terms.md` and `docs/design/staff-design-standard.md`. Line numbers refer to `d9707984`.

Nothing blocks. The merge is clean, CI is green on the head, and all eight items from the last recheck are fixed. I checked each fix in the screenshots, in the code, or by running it. The findings at the end are small polish items and can be follow-ups.

## Blocking checks

1. **Merge with `main` and CI: pass.**
   - `main` is merged in with a normal merge commit, `3e0d82f2` (parents `53a272f7` and `ab724177`). No history was rewritten.
   - GitHub reports `mergeable: true` and `mergeable_state: clean`.
   - `main` has moved on by one commit since the merge: `9d2281dd` (#1480, lax.art e2e helpers only). `git merge-tree` against it is clean.
   - REST check-runs for `d9707984` show all 30 runs completed with `success`, including `ci-result`, `build`, `test`, `static-checks`, `browser-gates`, the web, api and shop-api vitest shards, the role contracts and `docker-images`.
   - `main` has no branch-protection list of required checks, only an active ruleset named `main`. `ci-result`, which collects the other checks, is green.
2. **AI attribution: none found.** I searched all 10 commit messages on the PR (author and committer `mahmoudamrspace`), the PR title and the PR body. None has a Co-Authored-By, Claude-Session or generated-by line.

## The eight items from the last recheck

| # | Status | Evidence |
|---|---|---|
| 1 Merge and CI | **Fixed** | See above. |
| 2 Equal card heights at 1440 | **Fixed** | `items-start` is removed from the grid (`storage-panel.tsx:128`). In `01-charging-off-1440-*`, In force and Charging end on one line. In `02-scheduled-1440-*` and `07-read-only-fulfilment-1440-*`, In force and Scheduled end on one line. The skeleton matches (`09-loading-1440-*`). |
| 3 Blocked reason visible on a phone | **Fixed** | `storage-cards.tsx:68` draws a `DisabledReason` line ("A change is already scheduled. Edit or cancel it first.") above the facts when a change waits. It shows only when the user can change terms. It is readable at 375 (`02-scheduled-375-*`, `12-scheduled-blocked-reason-375-*`). Read-only Fulfilment sees no line (`07-*-375-*`). Tested both ways. |
| 4 One-line rows at 375 | **Fixed** | In `02-scheduled-375-light`, every row of the Scheduled table fits on one line: Free 14 days, Counting Calendar days, Standard, Large, Handling. |
| 5 Content-sized fields | **Fixed** | Kit tokens `--container-staff-field-count`, `-money` and `-date` (96, 160 and 208px, `packages/staff-ui/src/theme.css:65-67`), with a drift test and a README row. The sheet uses them on Starts on, Free days and the three money fields (`storage-terms-sheet.tsx:202,234,270,300,320`). In `03-*` and `04-*`, the days field holds "91", the money fields hold "500.00", and the Reason textarea keeps the full width. |
| 6 Matching labels | **Fixed** | In force and Scheduled both say Free, Counting, Standard, Large and Handling. A test checks that every table label appears in the In force list. |
| 7 Date examples in the future | **Fixed** | `dateInputExample` (`packages/staff-ui/src/forms/date-input.tsx:74-82`) uses `min`, or else today in London (or `max` when that is sooner). The Storage sheet reads "e.g. 17 Nov 2026" on 16 Nov, which is tomorrow, and its hint is "From tomorrow, up to Thu 16 Nov 2028". Tested across the BST day boundary. |
| 8 Concurrency test fails without the lock when run alone | **Fixed, and I verified it** | See below. |

## Concurrency mutation (I ran it on local Postgres 16)

- **Setup:** `pnpm db:migrate`, then `db:roles` with `DATABASE_URL_OWNER` set.
- **Full `drizzle-collection*` integration:** 5 files, 92 tests, all passing.
- **Mutation:** I removed `await lockCollectionPlace(tx, venueId)` from `scheduleTerms` (`drizzle-collection-storage.repository.ts:160`) and ran only `-t "same moment"`. It failed 5 times out of 5 with "expected [ Array(4) ] to have a length of 1 but got 4".
- **Restored:** the same command passed 3 times out of 3. The working tree is clean.
- **Why the test is now reliable:** on its own pool, the barrier transaction holds a `SHARE` lock on `collection_storage_terms`, so all four calls make their checks before any insert can run. The barrier lifts only once `pg_locks` shows four waiters. The test no longer depends on how warm the pool is or on run order.

## Earlier confirmations, re-checked after the merge

- **No security-relevant code changed.** Since `3e0d82f2`, the PR changes 17 files: the web Storage components and view model, the kit (date input, tokens, theme, README), the spec and one integration test. No route, middleware, step-up registry, server action, validator or repository code changed. The merge brought in only `main`'s own code.
- **Capability and step-up:** unchanged. The mount test still passes (api `collection-storage`, `collection-settings` and `dangerous-staff`: 129 tests).
- **Fulfilment read-only:** no Schedule, Edit or Cancel controls. The page shows the "View only" chip and "Raise storage invoices: Off" with its reason line (`07-read-only-fulfilment-*`).
- **Edge validation:** unchanged and tested (validators: 26, domain `storage-terms`: 74).
- **Audit and legacy terms rule:** unchanged. The audit row is still written in the same transaction, and History shows the System row for the free storage days moved from Hours and rules.
- **No migration** is added, so there is no migration journal conflict with `main`.

## What I ran (on `d9707984`, after `corepack enable`, `pnpm install --frozen-lockfile` and the packages build)

- **Tests (`--maxWorkers=2`), all passing:**
  - staff-ui (full): 662.
  - web `components/admin/collections`, `lib/admin`, `lib/navigation`, `components/layout`, `lib/actions/admin`, `hooks/use-settled-value`: 2734 in 392 files.
  - api: 129.
  - domain: 74.
  - validators: 26.
  - ui `notice`: 4.
  - persistence `drizzle-collection*` integration on Postgres 16: 92.
- **Typecheck (`tsc --noEmit`):** clean for staff-ui, persistence, domain, validators, ui and api. Web has only the known `rpc-app.ts` error (`@auction/api/app`), as before.
- **Biome:** clean on the 95 changed files.
- **`lint:client-copy`:** passes.
- **Not run here:** the `@journey` e2e (it needs the seeded full stack) and `next build`. CI's `browser-gates` and `build` jobs cover them, and both are green.

## UI judgement (48 screenshots at `1ff0d662`, taken at 01:14, after the last code commit)

I looked at every state at 1440 and 375, in light and dark. The tab reads as finished:
- Cards in a row share a bottom edge.
- The blocked action explains itself on a phone.
- The Scheduled before → after table is calm and fits on one line at 375.
- Field widths tell staff what to type.
- Labels match across cards.
- The error summary links to the fields.
- There is no horizontal overflow at 375.

## Findings (none blocking)

1. **Nit (evidence): the "preview" screenshots do not show the preview.**
   - `04-sheet-preview-1440-*` is scrolled to the middle of the form. The "Starts on" label is cut off at the top, and the handling field at the bottom.
   - `04-sheet-preview-375-*` stops at "Daily charge after that".
   - So neither shows the buyer-wording preview the row is named for. Tests cover the preview (the spec wording and the delayed `<output>`), so only the evidence is missing. Next time, scroll the preview into view for this shot.
2. **Nit (evidence): the 375 sheet captures show the page under the sheet.** In `03-*-375-*`, `04-*-375-*` and `05-*-375-*`, the full-page capture draws the fixed sheet at viewport height, and the page (In force, Charging, History) continues below the sheet's footer. This is a capture artifact, not a product bug, but at a glance it looks broken. Capture sheets at viewport size only.
3. **Nit (craft, 1440): with equal heights, the Charging card is half empty when charging is off.**
   - In `01-charging-off-1440-*`, Charging now stretches to In force's height, and about half the card is blank under the switch.
   - This is the expected cost of finding 2 from the last recheck, and it looks better than the ragged edge did. Nothing to do now.
4. **Nit (kit, low risk): `dateInputExample` reads the clock on every render.**
   - `date-input.tsx:120` calls it with `new Date()`, in a client component that the server also renders.
   - Near London midnight, the server and the client can disagree on the placeholder, and React then warns about a hydration mismatch.
   - It only matters for date fields without `min`; the Storage sheet passes `min`.
   - Kit follow-up: compute the example once on mount, or take `today` from the page.
5. **Known, carried over (out of scope):** in dark mode, the kit `ChangesTable` highlight (amber struck-through values on the brown fill) still has weak contrast (`02-scheduled-1440-dark`). The PR body lists it for a kit ticket, to be checked against WCAG 1.4.3.
