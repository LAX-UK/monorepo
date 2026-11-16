Verdict: FIX FIRST

# Final recheck: PR #1490, "Staff tools: audit polish (labels, buttons, checkboxes)"

Reviewed head `6bde5bd3` (5 commits, merge of `aef61e26` included) against the previous review on this
branch and the PR body's "Changes after review". Current `main` is `8ed75236`; the PR merges into it
cleanly (`git merge-tree`). This was a review only. The PR branch was not changed.

## Blocking

1. **CI is red: `static-checks` fails on Biome, so `ci-result` fails.** Run 43825286489, job
   133157565785, step "Biome root check": 13 errors, 3 warnings. Because that step failed, every later
   step in the job was skipped, including "Route JavaScript budget rule", "Client copy (no system
   terms)", "Staff UI guardrails", "Admin lib boundaries" and the other lints. They have not run on
   this head. I reproduced it locally with `npx biome check .` (same 13 errors). Twelve are
   formatting or import order and `biome check --write` fixes them:
   - `apps/api/src/services/admin/data-requests/admin-data-requests.service.ts` (import order)
   - `apps/shop-admin/src/server/domain/artist-application.vm.ts` (format)
   - `apps/shop-admin/src/server/domain/lookup-options.vm.test.ts` (import order)
   - `apps/web/src/app/admin/(platform)/enquiries/[reference]/page.tsx` and `.../enquiries/page.tsx`
     (import order)
   - `apps/web/src/components/admin/enquiries/enquiry-view.tsx` (format)
   - `apps/web/src/lib/admin/admin-user-presenters.ts` (format; `KYC_STATUS_PHRASES` line 60 is too long)
   - `apps/web/src/lib/admin/data-requests/data-request-forms.ts` (import order and format)
   - `apps/web/src/lib/admin/enquiries/department-label.ts:20` (format)
   - `apps/web/src/lib/admin/manual-review-presenter.test.ts` (import order and format)

   The thirteenth is a real code fault, not formatting:
   `apps/web/src/components/admin/enquiries/enquiries-list.tsx:115`
   (`lint/correctness/useExhaustiveDependencies`). The `columns` `useMemo` now reads the new
   `departmentNames` prop (line 145), but its dependency list is still `[nameOf, now]` (line 182). In
   practice `now` changes on each server render, so the stale closure is mostly masked today, but it
   is a correctness bug and it fails the gate. Fix: add `departmentNames` to the list.

   After fixing, the skipped lints (including the route-JS budget rule) must run and pass.

2. **Route JS still grows on many routes against main's own CI builds.** Requirement: equal or lower
   than main on every route. I parsed every Next route table in the PR's `build` job (run
   43825286489, job 133158256062) and compared them with:
   - main at the PR base `aef61e26` (merge-group run 43810475714, job 133111492899), a full build;
   - main's latest build that rebuilt web and shop-admin, `f1e70f47` (run 43819811178, job
     133140258965). Main's newest run, `8ed75236` (docs only), built nothing.

   Results (route Size or First Load JS higher on the PR):
   - **apps/web vs `aef61e26`: 25 routes grow, 25 shrink.** Largest: `/admin/sales/[id]/cover`
     37.3 → 37.6 kB, `/settings` 25.9 → 26.2 kB, `/admin/sales/[id]/lots` 95.0 → 95.2 kB,
     `/admin/lots` 20.2 → 20.4 kB, `/selling/consignments/[id]` 22.6 → 22.8 kB,
     `/admin/private-sales/[reference]` 25.2 → 25.3 kB, `/admin/lots/[id]` 14.4 → 14.5 kB,
     `/admin/compliance/aml` 25.3 → 25.4 kB.
   - **apps/web vs `f1e70f47`: 27 routes grow, 21 shrink.** Largest: `/admin/sales/[id]/lots`
     94.7 → 95.2 kB (First Load 493 → 494 kB), `/admin/sales/[id]/atg` 22.5 → 22.8 kB (311 → 312 kB),
     `/admin/collections` 42.3 → 42.5 kB (403 → 404 kB), `/admin/lots` 20.2 → 20.4 kB. The
     enquiries list itself, `/admin/enquiries`, is 21.1 → 21.2 kB here (equal to `aef61e26`'s
     21.2 kB, so it is unclear whether this is the PR's new `departmentNames` prop or noise).
   - **apps/shop-admin: 11 routes grow vs `aef61e26`, 12 vs `f1e70f47`.** For example `/from-zoho`
     14.9 → 15.0 kB, `/production/[id]` 8.41 → 8.46 kB, `/orders/[orderId]` 8.62 → 8.68 kB,
     `/payouts` 504 → 505 kB First Load, `/artist-applications` 516 → 517 kB First Load.
   - **Route-JS budget table vs `aef61e26`:** web `account` 545.2 → 545.0 KB and `checkout`
     471.7 → 471.4 KB now shrink (good), but shop `checkout` 551.8 → 551.9, shop `public`
     520.4 → 520.5, art `public` 527.6 → 527.7 KB, and the shop/art frames +0.1 KB.

   What is fixed: the routes the previous review named no longer grow, against either main build.
   `/admin/enquiries/[reference]` 21.7 kB / 348 kB (equal), `/admin/payments` 32.5 kB / 501 kB
   (main 32.7 and 33.5 kB), `/admin/purchase-problems` 9.92 kB (equal), `/admin/purchase-problems/[id]`
   9.79 kB (equal or lower), `/admin/invitations` 30.7 kB / 359 kB (main 30.9 kB / 360 kB),
   `/admin/submissions/[id]/decision` 37.0 kB (main 37.2 and 37.1 kB).
   `enquiry-view.tsx` no longer imports `departmentLabel`, `routingRows` or `departmentBySlug`
   (department name now resolved in `app/admin/(platform)/enquiries/[reference]/page.tsx:43-45`).
   No budget, ratchet, baseline or allowlist file is changed (`git diff --name-only aef61e26 HEAD`).

   What is not: the PR body itself says 46 web and 13 shop-admin routes still grow by 0.01-0.3 kB and
   that build noise was "not separated from real growth". The CI tables confirm growth on several
   staff routes the PR touches indirectly (lots, sales, collections, AML). A likely contributor is
   `staff-kit-status.ts` (now exports `LOT_STATUS`) and the kit `choice.tsx` change, both used widely,
   but nothing shows the remaining growth is noise. To close this: either show a same-commit rebuild
   of main gives the same deltas (noise), or trim the cause, then re-compare after rebasing on current
   `main`.

3. **Not every label map is in a copy file.** The bar for this pass was mapped enums with full-list
   tests and sentence-case labels in copy files. Mapping and tests are now done (see Verified), but
   only two of the maps live in `.copy.ts` files:
   - in copy files: `MANUAL_REVIEW_REASON_LABELS` (`apps/web/src/lib/admin/manual-review-reason.copy.ts:4`),
     `REFUND_SOURCE_LABELS` (`apps/shop-admin/src/server/domain/enum-labels.copy.ts:10`);
   - still in presenter or view-model code: `XERO_SYNC_STATUS_LABELS`
     (`xero-sync-status-presenter.ts:4`), `EMAIL_DELIVERABILITY_LABELS` and `KYC_STATUS_PHRASES`
     (`admin-user-presenters.ts:7,60`), `EDITION_LISTING_LABELS` (`lookup-options.vm.ts:23`),
     `EVENT_PRESENTATION` titles (`artist-application.vm.ts:123`), `LOT_STATUS`
     (`staff-kit-status.ts:27`) and `FOUND_ACCOUNT_STATUS_LABELS` (`data-request-forms.ts:37`).

   The repo's engineering bar says "copy in copy files" (`docs/design/motion.md:90`). The previous
   review allowed "copy or presenter file" for the manual-review labels, so this is a tightening;
   it is a mechanical move.

## Non-blocking

- **Most "full-list" tests iterate the map, not the value list.** `manual-review-presenter.test.ts`,
  `xero-sync-status-presenter.test.ts` and `lookup-options.vm.test.ts` use
  `it.each(Object.entries(MAP))`, so they cannot fail on a value missing from the map. The guard for
  those is the `Record<…>` type and `tsc` in CI, which works (`ManualReviewReason` and
  `EditionListingStatus` are real unions). The lot, email, KYC, artist-application and refund tests do
  iterate the value list. A value list for `ManualReviewReason` in `@auction/types` would make the
  test independent of the compiler.
- **`XeroSyncStatus` is a hand copy.** `xero-sync-status-presenter.ts:1` declares
  `"pending_sync" | "synced" | "error"` locally. It matches `paymentExternalSyncStatusEnum`
  (`packages/db/src/schema/xero-integration.ts:6`) today, but nothing ties them, the same drift class
  the PR closed for refund sources with a shop-api test.
- **KYC phrases stay lowercase by design** (inline phrase, e.g. "KYC rejected — follow up"), and an
  unknown value falls back to the lowercased code with `_` replaced (`admin-user-presenters.ts:73`).
  Fine for an inline phrase; noted because the other fallbacks were changed to sentence case.
- **Screenshots are stale.** The PR body says so. I opened `after/payout-1440-dark`,
  `after/payout-375-dark`, `after/enquiry-375-dark` and `after/order-375-light` from
  `pr-screenshots/staff-audit-polish` (`3386d84f`). The payout dialog still shows the old long
  label; the code now has a short label plus a description (`payout-money-actions.tsx:442-443`).
  Retake at least the payout set (1440/375, light/dark).
- **`enquiries-list.tsx` still imports `routingRows` on the client** (line 23, for the department
  filter options at line 109). This predates the PR and the list route does not grow, but it is the
  same data the PR moved off the record page.

## Verified

- **Previous blocking 2 (lot status test): fixed.** `LOT_STATUS` is `Record<LotStatus,
  StatusPresentation>` (`apps/web/src/lib/admin/staff-kit-status.ts:27`) and the
  `it.each(lotStatuses)` case asserts `Object.keys(LOT_STATUS)` contains each status
  (`load-recent-activity.slice.test.ts:31-38`). **Mutation check:** I added `"paused"` to
  `lotStatuses` (`packages/types/src/lot.ts`), rebuilt `@auction/types`, and ran the test:
  `never shows the stored code for paused` failed with `expected [ Array(6) ] to include 'paused'`;
  `tsc` also failed at `staff-kit-status.ts(27,14)`. Reverted afterwards.
- **Previous blocking 3 (enums): mapped and tested.**
  - `identity_verification_required` → "Identity verification required",
    `organisation_under_review` → "Organisation under review"
    (`manual-review-reason.copy.ts:11-12`), with explicit tests.
  - Xero sync, email deliverability (`Record<UserEmailStatus>`, tested over `userEmailStatuses`),
    KYC (tested over `userKycStatuses` plus the three extra values), `EDITION_LISTING_LABELS`
    (`Record<EditionListingStatus>`), artist-application actions (`Record<ArtistApplicationAction>`,
    tested over `ARTIST_APPLICATION_ACTIONS`). Unknown values fall back to sentence case
    (`manual-review-presenter.ts:11-12`, `xero-sync-status-presenter.ts:15-16`,
    `lookup-options.vm.ts:42-45`, `artist-application.vm.ts:136-145`).
  - All labels are sentence case and contain no `_` (asserted in the tests).
- **Previous non-blocking items: done.**
  - `apps/shop-api/src/domain/shop-refund-source.test.ts` compares `shopRefundSourceEnum.enumValues`
    with `SHOP_REFUND_SOURCES`.
  - `FoundAccountStatus` is shared in `packages/types/src/user.ts:50-51` and used by the API
    (`admin-data-requests.service.ts`) and the screen.
  - `departmentLabel` moved to `apps/web/src/lib/admin/enquiries/department-label.ts`, server only.
  - The payout confirmation uses a short label plus a description.
- **Merge:** `main` merged in with a normal merge commit (`44c46511`); no `humaniseSlug` left in the
  enquiry components; merges cleanly into current `main` `8ed75236`.
- **No regressions found** in the diff beyond item 1: the legal-entity hint, SoF status, found-account
  status and refund labels are unchanged since the last review; the recent-activity badge still gets
  `statusLabel: lot.status` and maps it as before.
- **Local tests on `6bde5bd3`** (after building workspace packages):
  - `packages/staff-ui`: 83 files, 672 tests passed.
  - `apps/shop-admin`: 163 files, 1705 tests passed.
  - `apps/shop-api`: 232 files passed, 88 skipped; 2626 tests passed, 539 skipped (the skips are the
    database-backed suites, which need Postgres; CI's 4 shop-api shards run them and pass). This
    includes the new `shop-refund-source.test.ts`.
  - `apps/web`, `src/lib/admin`, `src/components/admin`, `src/app/admin` and `src/lib/presenters`:
    456 files, 3369 tests passed. I did not run the full web suite locally, because it takes about two
    hours on this machine. All 8 web vitest shards pass in CI on this head.
- **CI on `6bde5bd3`:** all test jobs pass (`build`, `test`, web vitest 1-8/8, shop-api vitest 1-4/4,
  api vitest 1-2/2, smoke jobs, contracts, `browser-gates`, `account-browser-gates`;
  `art-browser-gates` skipped). `static-checks` fails (item 1), so `ci-result` fails.
