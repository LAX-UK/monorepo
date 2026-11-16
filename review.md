Verdict: FIX FIRST

# Review: PR #1490, "Staff tools: audit polish (labels, buttons, checkboxes)"

Reviewed head `d94605e4` (2 commits on base `5569ca0e`) against `docs/design/staff-design-standard.md`
and current `main` (`aef61e26`). This was a review only. The PR branch was not changed.

**Audit source.** The repository has no `STAFF-AUDIT` document and no `GAP-48` entry. I searched the
working tree, all commit messages and every ref name. So I judged each finding against the
standard's rules: CRF-2 (buttons), CRF-6 (choice controls), CRF-7 (status and enum labels), and the
FRM, TBL and DSH rules. I did not rely on the PR description.

## Blocking

1. **Route JS grows on several routes.** I compared the PR's CI `build` job (run 43813628166, job
   133120804417) with main's latest CI build (merge-group run 43810475714, job 133111492899, at
   `aef61e26`). The Next route tables show 47 rows that grow. These are the main ones:
   - `/admin/payments`: size 32.7 → 33.6 kB, and First Load JS 501 → 502 kB.
   - `/admin/purchase-problems`: 9.92 → 12.1 kB. `/admin/purchase-problems/[id]`: 9.81 → 11.5 kB.
   - `/admin`: 23.9 → 24.0 kB. `/admin/lots`, `/admin/lots/[id]` and `/admin/invitations` each
     grow by about 0.1 kB.
   - Shop-admin: `/artworks` 8.63 → 8.70 kB, `/from-zoho` 14.9 → 15.0 kB, and about 12 smaller
     rows.
   - Route-JS budget table: web `account` 545.2 → 545.3 KB and web `checkout` 471.7 → 471.9 KB
     (frame 441.0 → 441.1 KB). Art `public` 527.6 → 527.7 KB.

   Some of this is noise, because main now includes #1479. But growth remains when I compare against
   the PR's own base build (run 43805181198, `5569ca0e`):
   - `/admin/enquiries/[reference]`: 15.5 → 17.0 kB, First Load JS 339 → 340 kB.
   - `/admin/payments`: 32.6 → 33.6 kB, First Load JS 501 → 502 kB.
   - `/admin/submissions/[id]/decision`: 36.7 → 37.2 kB (First Load JS 386 → 387 kB).
   - `/admin/invitations`: 359 → 360 kB First Load JS.
   - `/admin/sales/[id]/atg`, `/admin/sales/[id]/setup` and `/admin/sales/new`: +1 kB First Load JS
     each.
   - Web `account` and `checkout` frame: 441.0 → 441.1 KB.

   One cause is clear. `enquiry-view.tsx:11` and `enquiries-list.tsx` are client components, and they
   now import `departmentLabel` (`enquiry-routing-rows.ts:32`). That function calls `routingRows` and
   `visibleSellDepartmentGroups` (the marketing sell-department data) and `departmentBySlug`
   (`@auction/domain`), so all of these now ship in the enquiry record's client bundle. Two fixes
   would work:
   - Resolve the department name on the server (in the page or the view model) and pass a string.
   - Or give the client a small map with only the slugs and labels.

   The other growth suggests chunk regrouping: `ChoiceRow` is now imported by more client modules.
   Re-check the tables after rebasing on main. The rule is no growth on any route.

2. **The recent-activity test does not fail on an unmapped lot status.**
   `load-recent-activity.slice.test.ts` (the `it.each(lotStatuses)` case) compares the row with
   `staffStatus("lot", status).label`. In `staff-kit-status.ts:33`, `CATALOGUE_STATUS` is typed
   `Record<CatalogueDomain, Record<string, StatusPresentation>>`, and `staffStatus` falls back to
   `humanizeStatus(status)` for an unknown key (`staff-kit-status.ts:106`). So a new value in
   `lotStatuses` with no label would produce the same humanised text on both sides, and the test
   would still pass. The `startsWith("${status} · ")` check only catches a lowercase single-word
   code.
   - Fix: type the lot map as `Record<LotStatus, StatusPresentation>`, or assert that every value of
     `lotStatuses` is a key of the map.

3. **Not every enum label on staff screens is mapped.** The PR says the audit covered every enum
   that staff screens show. It did not. On Bid admin, Payments › Manual review, the reason column and
   chips use `manualReviewReasonLabel` (`payments-staff-list.vm.ts:142`). That function handles six
   of the eight `ManualReviewReason` values (`packages/types/src/payment.ts:38-49`). The other two
   fall to `reason.replaceAll("_", " ")` (`manual-review-presenter.ts:20-21`):
   - `identity_verification_required` shows as "identity verification required".
   - `organisation_under_review` shows as "organisation under review".

   Both read as lowercase stored codes, which breaks CRF-7. The function also has no test over the
   full value list.
   - Fix: map both values in the copy or presenter file. Back the map with a `Record<ManualReviewReason, string>`
     (or a value list in `@auction/types`) and add an `it.each` over all of them.
   - Other fallbacks were not covered by a full-list test. They do not show a known unmapped value
     today:
     - `xeroSyncStatusLabel`;
     - `formatEmailDeliverabilityStatus`;
     - `kycStatusPhrase`;
     - `EDITION_LISTING_LABELS` (shop-admin `lookup-options.vm.ts:40`);
     - the artist-application timeline title `event.action.replace(/_/g, " ")`
       (shop-admin `artist-application.vm.ts:139`), which shows lowercase action codes as titles.

     These should be checked in the same pass.

## Non-blocking

- **Merge conflicts with main.** Two files conflict, and both conflicts are import lines only, so
  they are easy to resolve:
  - `apps/web/src/components/admin/enquiries/enquiries-list.tsx`: main adds the `QUARANTINE_COPY`
    and `QUARANTINE_PATH` imports, and the PR changes the `routingRows` import to
    `departmentLabel, routingRows`. Keep both sides.
  - `apps/web/src/components/admin/enquiries/enquiry-view.tsx`: main adds `REPLIES_COPY`, and the
    PR adds `departmentLabel`. Keep both.

  I checked the merged tree (`git merge-tree`). No `humaniseSlug` call is left in either file.
- **The refund-source list is not tied to the database.** `SHOP_REFUND_SOURCES`
  (`packages/shop-domain/src/refundable-balance.ts:2`) copies `shopRefundSourceEnum`
  (`packages/db/src/schema/shop-commerce.ts:197`) by hand, and nothing checks the two against each
  other. The PR body says so. `apps/shop-api` already depends on `@auction/db`, so a test there
  could compare `shopRefundSourceEnum.enumValues` with `SHOP_REFUND_SOURCES`. That would close the
  gap.
- **The found-account status list is also a hand copy.** `FOUND_ACCOUNT_STATUSES`
  (`data-request-forms.ts:36`) matches the only two values the API produces
  (`apps/api/src/container.ts:917`), so it is correct today. A shared type would stop it drifting.
  The test uses `"pending_purge"` as its "unknown" example. That value does not exist anywhere,
  which is fine, but a neutral placeholder name would be clearer.
- **Confirmation labels are heavier.** Moving the four confirmation rows onto `ChoiceRow` makes
  their long sentences `font-medium` (`choice.tsx:199`). Before, they were regular weight (and
  `text-sm` on payouts). This matches the kit and the standard's `ChoiceRow` rule, and the
  screenshots confirm nothing else moved. But it is a visible weight change on long text. A
  multi-sentence acknowledgement could use `label` for a short lead and `description` for the rest,
  as the "Book for a client" dialog now does.
- **Single responsibility.** `departmentLabel` lives in `enquiry-routing-rows.ts`, a module about
  routing rules. A label helper belongs in the enquiries copy or view model (see blocking item 1).
- **Labels stay in code.** `REFUND_SOURCE_LABELS` sits in a `.copy.ts` file, which is good.
  `FOUND_ACCOUNT_STATUS_LABELS` sits in `data-request-forms.ts` (form logic), not in a copy file.
- **The hit-area test checks classes, not size.** The CRF-6 test (`choice.test.tsx`) asserts on
  class names. That is the right contract for jsdom, but it cannot catch a parent with
  `overflow-hidden` clipping the `::before` layer. If a Playwright gate exists for staff kit pages,
  one `elementFromPoint` check 3px outside a box would prove the target.

## Verified

- **CRF-6 kit fix.** The fix is in the shared kit, not copied per screen: `CHOICE_HIT_AREA`
  (`relative before:absolute before:-inset-1`) is added once to `boxBase` in
  `packages/staff-ui/src/primitives/choice.tsx`, and both `StaffCheckbox` and `StaffRadio` use it.
  - The drawn box stays `size-4` (16px), and the target is 24px.
  - I checked the underlying `@auction/ui` Checkbox and RadioGroupItem
    (`packages/ui/src/components/ui/{checkbox,radio-group}.tsx`). Neither uses `::before`, and
    `relative` on the root does not move the radio dot, which is positioned against the indicator.
  - A page `className` merges without dropping the hit area (tested).
  - The CRF-6 Kit line in the standard is updated to match.
- **Confirmation rows.** The four hand-built confirmation rows (accounting locked period, payout
  release, desk book-for-client, desk hand-over) now use the kit's `ChoiceRow`. The label is part of
  the target through `htmlFor`, the `mt-0.5` nudges and the off-scale `text-sm` are gone, and
  `aria-invalid` stays on the hand-over checkbox.
- **Enum fixes I checked against code and tests.**
  - Refund source (`refundSourceLabel`, with a full-list test).
  - SoF payment status: `staffStatus("payment")`, with a test over `paymentStatuses` against the
    `Record<PaymentStatus, string>` map.
  - Legal-entity readiness hint: `statusLabel`, a `Record<LegalEntityStatus, string>`, tested over
    `legalEntityStatuses`.
  - Found-account status.
  - Enquiry department: one `departmentLabel` replaces three copies, tested over `DEPARTMENTS`.
- **Already-done claims hold on main.**
  - CRF-2: no `uppercase` on any staff button. It appears only on the LAX Admin login wordmark
    (`apps/shop-admin/src/app/login/page.tsx:43`) and in the unused `catalog-list-mobile-summary.tsx`.
  - No Title Case button labels apart from proper nouns ("Reconnect Xero").
  - The FRM, TBL and DSH items are marked `MET` in the standard.
- **No restyling and no motion changes.** The diff adds no `transition`, `animate`, `duration`,
  skeleton, hover or press changes. The only kit class added is the hit-area layer, so it does not
  overlap #1485 or #1486.
- **Screenshots.** I opened them from `pr-screenshots/staff-audit-polish`: 64 images, before and
  after, 1440 and 375, light and dark.
  - Payout release, desk hand-over and the order Refunds list render correctly.
  - In dark mode, the unchecked box border and label stay readable on the dialog surface, and the
    status badges keep their text.
  - Nothing beyond the label weight changes between before and after.
  - The images come from a Vite harness, not the full app, as the PR says.
- **Tests I ran locally** on the PR head, after building the workspace packages:
  - `packages/staff-ui`: 82 files, 665 tests passed.
  - `apps/shop-admin`: 163 files, 1692 tests passed.
  - `apps/web`, affected areas: 69 files, 753 tests passed. These were admin finance, payouts, collections, enquiries, data requests, the SoF board, `lib/admin/{dashboard,enquiries,data-requests,finance}`, legal-entity health and `app/admin`. I stopped a full local web run after about 115 of 1,521 files had passed, because it would have taken around two hours on this 4-core machine. All 8 web vitest shards in CI pass on the PR, and that is the evidence for the rest of the suite.
- **CI on the PR.** All required jobs passed, including `build`, `test`, the 8 web vitest shards,
  `shop-api` and smoke, and `ci-result`. `browser-gates` was still running when I reviewed, and the
  `art` and `account` browser gates were skipped.
