Verdict: FIX FIRST

# Review of PR #1552: Consignor agreements, part 2 (ZI-5), Agreements on the LAX Admin client page

Reviewed head `3b8ef3a2` against the approved design in `docs/design/decision-pack-2026-11-17.md`
(section 1, option B, PR plan step 2; approved 17 Nov 2026) and part 1 as merged (#1545, `934d2b40`, migration 0407).
The PR branch was not changed.

## Blocking

1. **The PR cannot merge: it conflicts with `main` in 7 files** (GitHub `mergeable_state: dirty`).
   The branch still carries its own copy of part 1 (`91bd8b6f`). Part 1 has since been squash-merged
   as `934d2b40`, and this PR then edits the same new files. Conflicting files:
   - `packages/shop-contracts/src/admin-consignor-agreement.ts` and its `.test.ts` (add/add)
   - `packages/shop-contracts/src/index.ts`
   - `packages/shop-domain/src/staff-capabilities.ts` and its `.test.ts`
   - `packages/shop-domain/src/staff-role-migration.ts`
   - `apps/shop-api/src/application/admin/get-staff-session.test.ts`

   The PR body also flags a merge with #1536 (catalogue editors move artworks) in `staff-capabilities.ts`.
   **Fix:** rebase the part-2 commits onto `main`, drop `91bd8b6f`, resolve the capability merge with
   #1536, then re-run the capability and role tests.

2. **"Reload" after a stale-version refusal does not recover; every retry fails again.**
   - `apps/shop-admin/src/components/consignor-agreements/agreements-section.client.tsx:100-101,123,131`
     copies the agreement object into `open` state when a dialog opens.
   - `use-agreement-write.client.tsx:61` Reload calls `router.refresh()` and leaves the dialog open.
   - The dialog keeps the agreement it was opened with: `agreement-dialog.client.tsx:138` sends the old
     `expectedVersion`, and the retire dialog does the same.
   - So the notice's advice, "Reload to see their change, then try again" (`use-agreement-write.client.tsx:68`),
     ends in another 409. The only way out is to close the dialog and reopen it.
   - The test at `agreements-section.client.test.tsx:276-292` only checks that `refresh` was called.

   **Fix:** on Reload, close the dialog after refreshing. Otherwise, keep only `agreementId` in `open` state
   and look up the current version in the refreshed `agreements` prop. Add a test showing that a retry
   after Reload sends the new version.

## Checked and fine

- **Design.** It matches B, step 2:
  - The Agreements section is on the existing `clients/[partyId]` page.
  - It covers places (LAX Bid, lax.art, private sale), start and end dates, optional lowest price and
    commission, the signed file and a note.
  - Replace adds version N+1 and never edits in place; replaced versions are not listed.
  - Retire keeps the agreement on the page.
  - Add, replace and retire need a recent sign-in.
  - Capabilities `consignor_agreement.read` and `.manage` are added.
  - Every write gets an audit row.
  - No scope creep into PR 3 or 4: no consignor field and no change to the move dialogs.
- **Permissions are enforced server-side**
  (`apps/shop-api/src/routes/admin/v1/admin-consignor-agreement.routes.ts`):
  - Reading needs `.read`; writing and uploading need `.manage`.
  - Anyone without `.manage` gets the client-scope check, so a broker sees only assigned clients.
  - Add, replace and retire check `requireRecentAuthentication`, and the path is in `SHOP_ADMIN_STEP_UP_PATHS`.
  - Writes need an `Idempotency-Key`.
  - In the service, every version or agreement lookup is checked against `partyId` (404 otherwise), and
    file keys are checked as belonging to the client, the right type and size, with matching magic bytes.
  - Audit rows are written in the same unit of work and leave out the note text.
  - Capability mapping: `shop-domain/src/staff-capabilities.ts` (admin and catalogue editor manage; everyone
    who can read clients can read agreements; operations, finance, editor and read-only get nothing).
- **The UI hides actions people cannot take.** Add, Replace… and Retire… use `StaffButton requires=`,
  which renders nothing without the capability (`packages/staff-ui/src/primitives/button.tsx:18-24`).
  Retired agreements show no Replace or Retire. The page renders the section only with `.read`.
- **States.** In force, not started, expired and retired are read against the London day and sorted in
  that order (`server/domain/consignor-agreement.vm.ts`). Empty, error (with retry) and loading
  (`SectionSkeleton` under `Suspense`, streamed) are all present. The catalogue-editor-only page also exists.
- **Retire dialog.** `ConfirmActionDialog` with the danger tone, the places and consignor in its words,
  the version sent at the version shown, step-up handled, and it closes on success.
- **Validation.** Client checks plus shop-api `issues` per field, mapped back inline. The file is checked
  for type and size before upload, and a replace keeps the existing file unless a new one is chosen.
- **Dates** use the kit's `StaffDate`, `formatStaffDate`, `londonToday` and `DateInput`, which are built on
  `@auction/datetime`. `lint:datetime` passes.
- **Staff kit only, no restyling:** Section, KeyValueList, StatusBadge, StaffFormDialog, ChoiceFieldset,
  MoneyInput, PercentInput, FileDropzone, FormErrorSummary and ConfirmActionDialog.
  `client-record-page.client.tsx` only gains an `agreements` slot.
- **No route-JS budget raised.** No budget or baseline file changed, and `lint:route-js-budget` passes.
- **Screenshots.** Checked `agreements-1440-light` and `add-dialog-errors-375-dark`; they match the code
  (labels, badges, Replace…/Retire…, error copy, Optional markers). No sideways scroll at 375.

## Not blocking

- **The form-error rule conflicts between the brief and the repo standard.** The brief's rule is "one field
  inline only; 2+ fields summary + inline". `agreement-dialog.client.tsx:180` shows the summary whenever
  there is any error, including a single one. That follows `docs/design/staff-design-standard.md` FRM-4
  ("Show it even when there is only one error") and every other shop-admin form, so it is not counted
  as a defect here. If the brief's rule is meant to apply, FRM-4 and the kit usage need changing everywhere.
- **Duplication:**
  - `AGREEMENT_NOTE_MAX_LENGTH = 1000` (`consignor-agreement.vm.ts:121`) repeats `AGREEMENT_NOTE_MAX`
    from `@auction/artwork-register-contracts`; import it instead.
  - The field error sentences exist both in the vm and in the service `ISSUE_MESSAGES`.
- **The 409 can report a stale current version.** `currentVersion` comes from `latest.version`, which is
  read before the transaction (`consignor-agreement.service.ts:290,328`). Under a race it can be stale;
  read it from the store's refusal instead.
- **Catalogue editors have no navigation entry to a client's agreements page** until PR 3 links the
  consignor. Holders of `.manage` can see any party's display name via the list route. This is documented
  in the PR and is consistent with "manage for any consignor".
- **The year is dropped for current-year dates.** The expired example reads "Sun 1 Jun 2025 to Sun 31 May".
  That is the formatter's current-year rule, but the year mismatch in one range reads oddly; consider
  always showing the year in an agreement's date range.
- **No E2E coverage.** The PR body explains why (no object storage in the browser gate).

## Suites run (on the PR head, detached worktree)

| Suite | Result |
| --- | --- |
| shop-api routes, file adapter, staff session | 68 passed |
| shop-api `consignor-agreement.service.integration.test.ts` (Postgres 16, migrated, `db:roles`, as `shop_app`, `SHOP_V1_INTEGRATION_REQUIRED=true`) | 15 passed |
| shop-admin section/dialog, vm, audit-log tests | 43 passed |
| shop-domain | 1334 passed |
| shop-contracts | 128 passed |
| `tsc --noEmit` for shop-api and shop-admin | clean |

These lint gates also pass: `ui-guardrails`, `client-boundary`, `admin-capability-drift`, `datetime`,
`staff-route-composition`, `lib-admin-boundaries`, `test-mocks`, `client-copy`, `brand-name`,
`route-js-budget` and `layers`.
