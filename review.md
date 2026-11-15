Verdict: FIX FIRST

# Review of PR #1477: Storage terms 3/7, Bid admin staff Storage tab

Head reviewed: `c66cc7ba` (`storage-terms-staff-tab`). Judged against `docs/design/storage-terms.md` (ST1–ST17, "Staff screens") and `docs/design/staff-design-standard.md`. Line numbers refer to the PR head.

One blocking correctness issue: two changes can be scheduled at the same time. Everything else is should-fix or polish. Security is sound: capability checks, step-up, Fulfilment read-only, validation at the edge, audit and the VAT rule are all enforced on the server. The copy matches the spec word for word.

## Findings

1. **BLOCKING: "one change waits at a time" is not enforced under concurrency.**
   - Where: `apps/api/src/services/collection-storage/collection-storage.service.ts:162-163` checks for a waiting change with `listTerms` *before* the transaction. Inside the transaction, `packages/persistence/src/repositories/drizzle-collection-storage.repository.ts:160-161` takes the place lock but re-checks only `startIsTaken`, which compares the same start date. The unique index is also per date only.
   - What goes wrong: two Finance users submit changes for 1 Dec and 1 Jan at the same moment, or a second tab submits. Both are inserted. `splitTerms` (service :103) shows only `waiting[0]`, so the 1 Jan change is invisible on the tab, cannot be edited or cancelled there, and takes effect silently.
   - Fix: re-check "no live version with `effective_from > today`" inside the locked transaction and return `change_already_scheduled`.
   - Tests: the in-memory double (`apps/api/src/testing/in-memory-collection-storage.ts:117-118`) has the same gap. Add a repository integration test with two concurrent schedules.

2. **Should-fix: History can lose place-level changes.** `service.ts:141` reads 200 audit rows (`STORAGE_HISTORY_LIMIT * 4`) and then drops per-lot rows in memory (`toHistoryView`, :83-94). Once extensions, waivers and large flags (PR 5) add more than 200 recent per-lot rows, the tab's History thins out or looks empty, although ST10 says every change is recorded. Filter `lot_id IS NULL` in SQL in `listAudit` (repository :433).

3. **Should-fix: the London-date test does not prove London time.** `collection-storage.service.test.ts:111-113` uses 2026-12-01T00:30Z, which is GMT, so the UTC and London dates are the same and a `toISOString().slice(0,10)` bug would still pass. Add a BST case, for example `now = 2026-07-01T23:30Z`: today is 2026-07-02 in London, so a start of 2026-07-02 must be refused. The code is correct (`londonDateKey`, service :118); only the test is missing.

4. **Should-fix (tracking): what staff schedule does not reach buyers yet, but the banner says it does.**
   - Buyer pages still read the frozen `collection_place.free_storage_days`: `apps/api/src/services/organisation-buying/purchase-view.ts:170` and `packages/persistence/src/repositories/drizzle-workspace-buying.readers.ts:283`.
   - `recordTermsForSale` (repository :413) has no caller, so lots in sales that close after a scheduled start keep `storage_terms_id = null` and fall back to legacy terms.
   - The spec's charging-off banner ("Buyers see the free period and the rates below") is therefore untrue until PR 4.
   - Acceptable as PR 3 of 7, but it needs a tracked PR 4 item that wires `recordTermsForSale` into sale close and moves the buyer reads. Otherwise do not ship this PR to production ahead of PR 4.

5. **Should-fix: a stale error banner after a successful retry.** `apps/web/src/components/admin/collections/storage/storage-panel.tsx:50-57, 65-69`: `failure` is cleared only by a sheet save (:84). A failed Cancel change or charging switch leaves the red "wasn't saved" notice on screen after a later success, alongside the success toast. Clear `failure` on every successful change, and add a test for the failure-then-success path.

6. **Should-fix: Finance sees a hand-over badge they cannot act on.** `apps/web/src/components/layout/staff-nav.ts:276`: Collections is now shown to Finance (`COLLECTIONS_PAGE_ACCESS`) but still carries the global `collectionsToHandOver` warning count. Finance opens the page and finds only the Storage tab. Show the badge only to roles that have the hand-over tabs.

7. **Should-fix: the charging switch is blocked in a way that hides the reason.** `storage-cards.tsx:144-149` uses native `disabled`, so the switch cannot take focus and a keyboard or screen-reader user never reaches the reason. The staff standard's rule for blocked actions (PRM-2) asks for `aria-disabled`: the control stays focusable and announces why. The "no VAT treatment" reason is also run into the explanation text in the same muted grey (screenshot 01/02), so it does not read as the reason. Give it its own line, styled as the disabled reason the kit uses elsewhere.

8. **Should-fix (craft): the Large rate field is half width.** `storage-terms-sheet.tsx:276-291`: only Large is wrapped in `FieldRow`, so at 1440 it renders at half the width of Standard and its hint wraps onto two lines ("Per lot per day, before VAT. / Up to £500.00."). See screenshot `04-sheet-preview-1440-*`. Standard and Large are a pair and should match.

9. **Should-fix (craft): Charging card left alone on its row.** `storage-panel.tsx:122` (`lg:grid-cols-2`) puts three cards in a two-column grid. Charging sits alone on the second row with an empty right half (`02-scheduled-1440-*`, `07-read-only-fulfilment-1440-*`), which looks unfinished. Either span Charging across both columns or stack In force / Scheduled above a full-width Charging card.

10. **Should-fix: test gaps.**
    - No test file for the server action `apps/web/src/lib/actions/admin/admin-collection-storage.ts` (capability denial, step-up mapping, refusal-to-error mapping).
    - No `loadCollectionsPage` test for Finance (settings not fetched, storage load error).
    - No test for switching charging on through the confirmation, or for a failed cancel or switch.
    - No route test through the real `createAdminRoutes` mount order. `collection-storage.routes.test.ts:28-56` builds its own Hono app. I read the wiring and found no bypass.
    - The `@journey` e2e (`apps/web/e2e/admin-collections-storage.spec.ts`) was not run by the author. It must pass in the stabilisation job before merge.

11. **Nit: the preview wording differs from the spec example.** `formatStorageTerms` (`packages/domain/src/storage-terms.ts` ~:247-271) renders "…or £7.00 for works over 150 cm on any side…". The Staff screens preview example says "for large works", while the spec's lot/shipping copy uses the "over 150 cm" form. Using the same formatter is correct; record which wording the spec intends. Also, `largeDailyPence: 0` with a standard rate renders "or £0.00 for works over 150 cm". Either refuse 0 for an enabled large band or word it as no surcharge.

12. **Nit: no upper bound on the start date.** `packages/validators/src/collection-storage.ts:18-24` accepts any future date. A typo such as 2062 creates a change that blocks all other scheduling until it is cancelled. Consider a cap of a few years.

13. **Nit: the old field has no removal ticket.** `packages/validators/src/collection-settings.ts:49-53` keeps `freeStorageDays` (and `storageChargePence`) accepted and ignored "for one release" without a TODO or ticket. The schema is still `.strict()` and the value is never written, so this is safe; add a tracked removal.

14. **Nit: copy consistency.**
    - `storage-copy.ts:113` says "Shown in history." while :47 and :90 say "Shown in History.".
    - The large-band error (:138, spec wording "turn off the large band") refers to a control labelled "Charge more for large works" (:123). Consider matching the label to the error.
    - `storage-cards.tsx:160`: Fulfilment reads "Raise storage invoices: Charging off"; "Off" is enough.

15. **Nit: the preview is re-announced on every keystroke.** `storage-terms-sheet.tsx:313` has `aria-live="polite"` on the preview, so a screen reader re-reads the whole buyer sentence on each keystroke in any money field. Debounce it or announce only on blur.

16. **Nit: skeleton fidelity.** `storage-skeleton.tsx:13,18`:
    - Hand-built card markup with a raw `148px` grid value.
    - Mixes the `@sm:` container variant with the `sm:` viewport variant.
    - Draws a header-button placeholder on Charging and History, which have no button.
    - Has no placeholder for the header chip, so the page shifts when the chip arrives (`09-loading-*`).

17. **Nit: Scheduled and History table alignment** (`02-scheduled-1440-*`).
    - The Reason row's value column does not line up with the table columns above it.
    - "Starts on" is always highlighted as changed.
    - At 375 px the labels wrap ("Standard / works", "Handling / fee").
    - In History, the Change cell is top-aligned against the row border while When and Who are centred.

18. **Nit: the date placeholder is in the past.** The kit `DateInput` shows "e.g. 24 Oct 2026" next to "From tomorrow" (`03-sheet-errors-*`).

19. **Note: error summary for one error.** The standard (FRM-4) asks for a summary even with one error; the storage spec says 2+ and the PR follows the spec. Record it as a deliberate exception.

## Checked and correct

- **Capability:** all four writes require Finance write or Administrator (`requireCollectionStorage`, `packages/types/src/admin-access.ts`). Reads add Fulfilment and read-only. The role matrix is tested, and refused calls write nothing.
- **Step-up:** all four writes are in the step-up registry (`apps/api/src/middleware/dangerous-staff-actions.ts:182-205`); the read is not.
- **Fulfilment read-only:** the web server action checks `COLLECTION_STORAGE_ACCESS` and hands step-up to `handleStaffStepUp`. The UI shows the read-only line and no enabled actions.
- **Routes beside finance:** mounting beside the finance routes exposes only `GET /collections` (the place list) and the storage routes to Finance. Nothing else widens, and the old platform route was removed.
- **Edge validation:** integer pence 0–50,000; free days 0–90; real dates; reason 1–500 characters, trimmed; `.strict()` bodies; no negative or fractional values. A null large band is handled consistently from the types through to the database.
- **Start date:** from tomorrow in London time on the server (`londonDateKey`), re-checked on edit. The client minimum comes from the London `today`.
- **Edit and cancel:** both lock the row, and versions that have started or been cancelled are refused with 409.
- **Audit:** schedule, edit, cancel and the charging switch each write who, when, before, after and why in the same transaction. A switch request that changes nothing writes nothing.
- **VAT rule:** charging on is refused under lock without a VAT treatment, and no route can set one yet.
- **Domain:** `LEGACY_STORAGE_TERMS` is 30 calendar days free with nothing charged. `storageTermsForLot` falls back to it, `assertStorageTerms` and `isStoragePence` are used by the calculator, and money formatting refuses fractions. Version selection by sale-close date is inclusive.
- **Sheet:** error summary at 2+ errors, with focus to the field when there is one; a ref guard plus the loading state stop a double submit. The unsaved-changes guard covers Cancel, close, navigation and beforeunload. Edit pre-fills, and the cancel-change and charging confirmations are in-page and ask for a reason.
- **Copy:** all spec strings match exactly and live in `storage-copy.ts` (`lint:client-copy` passes). The buyer preview calls the domain `formatStorageTerms`. Only shared kit components are used.
- **Hours and rules:** the free storage days field is removed cleanly from the types, validator, service, repository, form and tests. No migration is in this PR.
- **Commit message and PR text:** no Co-Authored-By, Claude-Session or generated-by lines.
- **Screenshots** (all states at 1440 and 375, light and dark): no overflow at 375, cards stack, and contrast in dark mode is fine.

## What I ran

All of these were run on the PR head after `pnpm install --frozen-lockfile` and the packages build.

- **Tests:**
  - domain `storage-terms.test.ts`: 70 passed.
  - validators `collection-storage`/`collection-settings`: 25 passed.
  - staff-ui `money-input`/`form-page`: 7 passed.
  - api routes, services and middleware for collection storage and settings: 263 passed.
  - web `components/admin/collections`, `lib/admin/collections`, `lib/navigation`, `components/layout`, `lib/actions/admin`: 995 passed (`--maxWorkers=2`).
- **Typecheck (`tsc --noEmit`):** clean for domain, validators, types, staff-ui, persistence and api. Web has 1 error, `rpc-app.ts` not finding `@auction/api/app`, because the API build output is missing in this environment; it is not related to this PR.
- **Biome:** clean on the changed files.
- **Static checks, all passing:** `lint:` client-copy, admin-capability-drift, layers, deps, web-guardrails, lib-admin-boundaries, staff-legacy-shell, web-barrel-imports, datetime, staff-route-composition, staff-list-template, z-schema-transform, e2e-tags, test-mocks, brand-name, legal-names, compositor, ui-guardrails, client-boundary, web-hop-links.
- **CI:** the PR check runs all pass (`ci-result` success). One check, art-browser-gates, was skipped.
- **Not run:** the new `@journey` e2e, which needs the full stack, and a full `next build` of apps/web (not run, as instructed).
