Verdict: SHIP

# Last recheck: PR #1490, "Staff tools: audit polish (labels, buttons, checkboxes)"

Reviewed head `7506cb2e` (11 commits; round-2 work is `1159d35f`, `e70cb701`, `e649e71d`, `65ba318d`,
`7506cb2e`, on top of the merge of `main` `8ed75236`). I checked it against the previous recheck on this
branch (`14014f21`) and the PR body's "Changes after review (round 2)". `main` is now `46c9bdac` (#1489
storage terms 5/7 and #1486 motion 4/8 landed after the PR's last merge), and the PR still merges
cleanly into it (`git merge-tree`). This was a review only: the PR branch was not changed.

All three blocking findings from the last recheck are resolved. Nothing new blocks.

## Blocking

None.

## Non-blocking

- **Screenshots are still the pre-review set.** I opened `after/payout-1440-light`,
  `after/data-request-1440-dark` and `after/desk-375-dark` on `pr-screenshots/staff-audit-polish`
  (still `3386d84f`, nothing newer). The payout dialog shows the old single long label ("I have checked
  in Stripe that no live transfer exists for this payout, by its payout transfer group and by the
  seller's account."). The code now has a short label plus a description
  (`apps/web/src/components/admin/payouts/payout-money-actions.tsx:440-443`). The PR body says so
  openly. The data-request image ("… · Active") and the desk image still match the code. Retake the
  payout set (1440/375, light/dark) when a harness is available.
- **Route JS: the remaining per-route deltas are build noise, but the gate cannot show that.** See
  Verified 2. Two builds of the same `main` commit at the same path differ by up to 0.3 kB on 22 web
  and 12 shop-admin routes, so "equal or lower than main on every route" at 0.01 kB precision cannot be
  met or checked with one build per side. A fix in CI would help (`ci/deterministic-route-js-sizes`
  exists as a branch), but that is outside this PR.
- **`XeroSyncStatus` is still a hand copy** (`apps/web/src/lib/admin/xero-sync-status.copy.ts:1`). The test
  now compares the map's keys with a written-out list of the database enum's values
  (`xero-sync-status-presenter.test.ts:6,10`), but nothing ties that list to
  `paymentExternalSyncStatusEnum`. Follow-up: a shared value list in `@auction/types`, as the PR body says.
- **`enquiries-list.tsx` still ships `routingRows` on the client** for the department filter options
  (`apps/web/src/components/admin/enquiries/enquiries-list.tsx:23,107-113`). This predates the PR.
- **KYC phrases stay lowercase by design** (inline phrase, `apps/web/src/lib/admin/admin-user.copy.ts:11-22`).
  This is fine.

## Verified

1. **CI is fully green on `7506cb2e` (previous blocking 1).** Run 43843889126 (on the
   `pull/1490/merge` commit `1db0053c` = head into `46c9bdac`): every job passed and `ci-result`
   succeeded. In `static-checks` (job 133219092607) every step ran and passed: Biome root check,
   Gitleaks, UI guardrails, Client boundary, Admin capability drift, Web guardrails, **Admin lib
   boundaries**, **Staff UI guardrails**, Date and time, E2E portfolio and tag guards, Zod transform,
   Vitest mock hygiene, **Client copy (no system terms)**, Brand name, Seller commission, Compositor-only
   motion, **Route JavaScript budget rule**, Legal names, Lint, Dependency graph, Package layers, Shop
   architecture, Docker patches, Identity exit criteria, CI script tests, Actionlint and Typecheck.
   The `useMemo` fault is fixed: `columns` reads `departmentNames`
   (`apps/web/src/components/admin/enquiries/enquiries-list.tsx:145`) and lists it in its dependencies
   (`:182`, `[nameOf, now, departmentNames]`).

2. **Route JS: no real growth (previous blocking 2).**
   - *CI tables.* The PR's `build` job (133219805668) built the merge onto `46c9bdac`. I compared it with
     `main`'s latest CI build that rebuilt web and shop-admin, `46c9bdac` (run 43835866524, job
     133192743466). `main`'s newest run, `618ab329` (docs only), built nothing. Result: web 23 routes
     up, 26 down; shop-admin 8 up, 13 down. Every increase is at most 0.3 kB of route size, and at most
     1 kB of First Load JS (`/admin` 372 → 373, `/admin/sales/[id]/lots` 493 → 494,
     `/admin/venues/[id]/edit` 391 → 392, `/artist-applications` and `/original-sales` +1 kB). Against
     `f1e70f47` (run 43819811178, the code base of the PR's own last merge), `/admin/collections` looked
     +3.5 kB. That growth came from `main` (#1489; `main` itself went 42.3 → 46.2 kB), and the PR is
     45.8 kB there, so it is lower than `main`.
   - *Pinned same-path builds.* To separate noise from growth I built `main` `8ed75236`, then the PR
     head `7506cb2e`, then `main` `8ed75236` again. All three were built in the same directory
     (`/home/user/pin`) with the same command (`turbo run build --force` for web and shop-admin,
     `--max-old-space-size=6144`, the CI placeholder Sentry DSNs), and after `git clean -fdx`.
     - **`main` against itself: web 22 routes up, 17 down; shop-admin 12 up, 10 down.** The changes
       reach +0.3 kB (`/admin` 23.8 → 24.1, `/admin/sales/[id]/atg` 22.6 → 22.9,
       `/selling/consignments/[id]` 22.6 → 22.9) and +1 kB First Load. 625 lines of the web chunk
       hash lists differ between the two builds, so the build is not deterministic.
     - **`main` → PR: web 22 up, 26 down; shop-admin 9 up, 11 down.** These are the same size and
       spread as `main` against itself. Many are the same routes that moved in the `main`-only rerun
       (`/admin/sales/[id]/atg`, `/admin/condition-reports`, `/selling/consignments/[id]`,
       `/admin/artists`, `/team/invitations`, `/invitations/accept/[token]`, `/account-suspended`).
     - Only 9 web and 3 shop-admin routes are above every `main` sample I have (two local builds and
       the CI build). Each is above by 0.01–0.2 kB, which is inside the 0.3 kB spread above. They
       include routes the PR does not touch (`/organisation`, `/admin/sales/new`,
       `/admin/sales/[id]/registrations`). The two touched routes in that list, `/admin/payouts`
       (+0.2) and `/admin/compliance/data-requests/[reference]` (+0.1), do not grow in the CI comparison
       against `46c9bdac`.
     - *Route-JS budget table (deterministic input check).* The **parsed (uncompressed)** sizes of every
       tracked route are byte-for-byte equal in all three builds: Home 1203.8 KB, Sales list 1373.4,
       Sale page 1473.2, Lot page 1448.3, About 1067.0, Terms 1058.3. For gzip, the PR is equal to or
       lower than the first `main` build in every web group (account 545.3 → 545.2, checkout
       471.7 → 471.6, public 394.6 → 394.5, sale 479.0 → 478.9, listing and lot equal). The second
       `main` build was higher still (account 545.5, checkout 472.1). In CI, the PR is equal to or lower
       than `46c9bdac` in every web group (account 545.4 → 545.3, checkout 471.9 → 471.8; the rest
       are equal).
   - *What the PR trimmed* (verified in the diff): the hit area is now a CSS utility (`@utility
     staff-hit`, `packages/staff-ui/src/theme.css:170`; used at `primitives/choice.tsx:23`), so no
     Tailwind string ships for it, and `CHOICE_HIT_AREA` has no remaining users. `apps/web/src/app/globals.css`
     and `apps/shop-admin/src/app/globals.css` both import `@auction/staff-ui/theme.css` and
     `@source` the staff-ui sources, so the utility is generated. The edition labels moved to
     server-only `apps/shop-admin/src/server/domain/edition-lookup-option.vm.ts`
     (imported only by `admin-lookup-actions.server.ts`). The found-account label is resolved in the
     server action (`apps/web/src/lib/actions/admin/admin-data-requests.ts:201`), and the dialog renders
     `draft.account.statusLabel` (`log-data-request-dialog.tsx:280`).
   - No budget, ratchet, baseline or allowlist file is changed by the PR.

3. **Every label map is in a `*.copy.ts` file with a full-list test (previous blocking 3).**

   | Map | Copy file | Full-list test |
   | --- | --- | --- |
   | `MANUAL_REVIEW_REASON_LABELS` | `apps/web/src/lib/admin/manual-review-reason.copy.ts:4` | keys == written list, `manual-review-presenter.test.ts:7,20` |
   | `XERO_SYNC_STATUS_LABELS` | `apps/web/src/lib/admin/xero-sync-status.copy.ts:4` | keys == written list, `xero-sync-status-presenter.test.ts:6,10` |
   | `EMAIL_DELIVERABILITY_LABELS` | `apps/web/src/lib/admin/admin-user.copy.ts:4` | `it.each(userEmailStatuses)`, `admin-user-presenters.test.ts:45` |
   | `KYC_STATUS_PHRASES` | `apps/web/src/lib/admin/admin-user.copy.ts:11` | `it.each([...userKycStatuses, …])`, `admin-user-presenters.test.ts:57` |
   | `FOUND_ACCOUNT_STATUS_LABELS` | `apps/web/src/lib/admin/data-requests/data-request-forms.copy.ts:4` | `it.each(foundAccountStatuses)`, `data-request-forms.test.ts:153` |
   | `LOT_STATUS` | `apps/web/src/lib/admin/staff-kit-status.copy.ts:5` | `it.each(lotStatuses)`, `load-recent-activity.slice.test.ts:31` |
   | `REFUND_SOURCE_LABELS` | `apps/shop-admin/src/server/domain/enum-labels.copy.ts:10` | `it.each(SHOP_REFUND_SOURCES)`, `enum-labels.copy.test.ts:6`; DB enum tie in `apps/shop-api/src/domain/shop-refund-source.test.ts` |
   | `EDITION_LISTING_LABELS` | `apps/shop-admin/src/server/domain/edition-listing.copy.ts:4` | keys == written list, `lookup-options.vm.test.ts:89-96` |
   | `ARTIST_APPLICATION_EVENT_TITLES` | `apps/shop-admin/src/server/domain/artist-application-events.copy.ts:4` | `it.each(ARTIST_APPLICATION_ACTIONS)`, `artist-application.vm.test.ts:136` |

   Every map is typed `Record<Union, …>`, so `tsc` also fails on a missing value. No new `Record<…, string>`
   label map is left in a non-copy file. The remaining `Record<string, string>` additions are the
   enquiry `departmentNames` prop and its builder (`department-label.ts`), which are data, not labels.

4. **Unit suites, run locally on `7506cb2e`** (after building the workspace packages at that commit;
   a first run against `main`'s built `dist` gave 5 false failures from missing new exports such as
   `SHOP_REFUND_SOURCES` and `foundAccountStatuses`, plus two unbuilt packages, and all of them passed
   after the rebuild):
   - `packages/staff-ui`: 84 files, **693 passed**.
   - `apps/shop-admin`: 163 files, **1706 passed**.
   - `apps/shop-api`: **2639 passed**, 542 skipped (the database-backed suites), 0 failed.
   - `apps/web` (full suite): 1526 files, **10004 passed**, 10 skipped, 0 failed.

5. **No regressions found.**
   - Round 2 touches only the files listed in the PR body (32 files, `git diff ada0d969 7506cb2e`).
   - The `staff-hit` test reads `theme.css` and checks `position: relative`, `flex-shrink: 0` and
     `inset: -4px` (`packages/staff-ui/src/primitives/choice.test.tsx:66-72`). The old `shrink-0` is
     covered by the utility's `flex-shrink: 0`.
   - The enquiries list resolves department names on the server
     (`apps/web/src/app/admin/(platform)/enquiries/page.tsx:50`).
   - The payout dialog uses the short label plus description (`payout-money-actions.tsx:440-443`).
   - The refund, SoF, legal-entity, recent-activity and found-account behaviour is unchanged since the
     last recheck. The PR still merges cleanly into current `main` `46c9bdac`.
