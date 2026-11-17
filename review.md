Verdict: FIX FIRST

Review of PR #1521 "Show the Zoho mirror badge on the order page" (head 7fde3f6e) against
docs/design/staff-gaps-delivery-zoho-alerts.md section 2 (Z1-Z5) and
docs/design/mockups/staff-gaps/index.html on origin/main (4ab41e66), on top of #1516 (5e8a086d).

## Findings

1. **The e2e badge tests never run in CI, so the browser gate proves nothing about the badge.**
   `apps/shop-admin/e2e/zoho-mirror-badge.spec.ts:94` skips any state the environment has no order for. In the
   `browser-gates` job for 7fde3f6e, all 8 state tests (4 states x light/dark) were skipped (`-`), and only
   "an order with nothing to mirror has no Zoho badge" (`:138`) ran. That test also passes on origin/main, where no
   badge exists, so the e2e passes with the change reverted. The axe-with-dialog-open check (`:113`), Enter and Esc
   focus (`:106-116`), the 44 px phone close (`:126-129`) and the no-sideways-scroll check (`:130-131`) have never
   run against this code.
   *Fix:* seed one paid Shop order per state (mirrored with a `provider_reference`, pending/retryable with
   `next_retry_at`, dead_lettered, plus dry_run mode) in the CI LAX Admin stack, for example in the acceptance seed
   used by `browser-gates` (`apps/shop-api/src/scripts/seed-acceptance-staff-operations.ts` or a sibling). Then turn
   the `test.skip` at `:94` into a hard failure when `CI` is set, so a missing fixture can't pass quietly again.

2. **When the e2e does run, its focus assertion will fail for Sending, Not in Zoho and Zoho dry run.**
   `apps/shop-admin/e2e/zoho-mirror-badge.spec.ts:112` checks `details.locator(":focus")`, and a Playwright inner
   locator only matches descendants. Radix FocusScope (`node_modules/@radix-ui/react-focus-scope/dist/index.mjs:81-83`)
   focuses the first tabbable that is not a link. If there is none, it focuses the dialog container itself. Pending
   and dry run have no tabbable, and Failed has only the "Open in Failed jobs" link, so focus lands on the dialog and
   the count is 0. I checked this in Chromium: a self-focused `role=dialog` gives `locator(':focus').count() === 0`.
   It is hidden today only because of finding 1. The component test passes because it uses `dialog.contains(...)`,
   which includes the element itself.
   *Fix:* assert `await expect.poll(() => details.evaluate((el) => el.contains(document.activeElement))).toBe(true)`
   (or check `:focus-within`) instead of the descendant `:focus` count.

3. **"Open in Failed jobs" is shown to people who cannot open Failed jobs (Q7, PRM-1).**
   `apps/shop-admin/src/app/(staff)/orders/[orderId]/page.tsx:65-66` uses `loadBidAdminUrl()`
   (`apps/shop-admin/src/server/application/load-bid-admin-url.ts:7`). That returns a Bid admin URL for anyone with
   any Bid staff role (`StaffAccessAdminService.myTools`). But Bid's Failed jobs page needs
   `FAILED_JOBS_ANY_SOURCE_READ_ACCESS` (`apps/web/src/app/admin/(shared)/failed-jobs/page.tsx:19`), and the Zoho rows
   need `admin.read` or `platform.admin.full` (`packages/types/src/failed-jobs.ts`, `integrations.zoho`). A Bid
   specialist or saleroom operator would get a link that lands on a refusal. Z3 and Q7 say "for those who can (hidden
   otherwise)". The PR body's claim "only for people Bid admin lets open it" is therefore not accurate. Sync health
   has the same gap, but this PR repeats it on a much more visible surface.
   *Fix:* decide the link from the capability, not from Bid admin access. Either have the status endpoint (or
   `/me` tools) return `canOpenFailedJobs`, computed with `FAILED_JOB_SOURCE_ACCESS["integrations.zoho"].read`, or
   add a `failed-jobs` tool to the staff-tools answer. Keep `failedJobsHref` null otherwise, and add a page test for
   "Bid admin yes, Failed jobs no". Linking with a `?source=integrations.zoho` filter would also help.

4. **The times don't follow Z3's example or the copy file's documented contract.**
   Z3 and the docstring at `packages/shop-contracts/src/zoho-mirror-copy.ts:55` give "Last sent 14 Nov 2026, 16:02"
   and "Tries again at 16:10". The build renders "Last sent Sat 14 Nov, 16:02 GMT" and "16:10 GMT"
   (`apps/shop-admin/src/server/domain/zoho-mirror.vm.ts:61,67`, pinned in `zoho-mirror.vm.test.ts:45,68`). Using the
   kit format with a zone label is defensible under MET (staff-design-standard, "Time zone"), but then the shared copy
   file's contract and the design example disagree with what ships.
   *Fix:* either pass `formatStaffDateTime(iso, now, { …absolute with year })` to match Z3 exactly, or update the
   docstring at `zoho-mirror-copy.ts:55` and note the deviation from Z3 in the PR so the owner signs it off. Consider
   wrapping the time in `<time dateTime>` as MET asks.

5. **The PR body's "Not applicable: no badge" screenshot row is broken.** The four cells are escaped
   (`&lt;img src="`` https://… `` "`) and render as literal text, not images, so the not-applicable evidence can't be
   seen in the PR. The PNGs themselves (`docs/design/screenshots/zoho-mirror-badge/not_applicable-*.png`) are fine.
   *Fix:* re-paste the row as plain `<img src="…?raw=true" width="300" alt="…">` tags like the other rows.

6. **One statement in the PR body is wrong (minor).** "LAX Admin is report-only in `route-js-budgets.json`":
   `scripts/route-js-budgets.json` has no `apps/shop-admin` entry, so `check-route-js-budget.mjs` says "no entry" and
   measures nothing. I measured it myself (below) and it's fine.
   *Fix:* correct the sentence and quote the measured before and after instead.

## Checked and fine

- **Scope (Z5):** this is PR 2. Order page only. The artwork record and the Orders column are left to PR 3. It builds
  on #1516's endpoint and shared copy file and adds no storage, migration or API.
- **Placement (Z1):** the badge sits in the order page header beside the order status (two badges, PRD-1). At 375 px
  it wraps under the title. Not applicable shows no badge.
- **States and tone/shape (Z2):** Mirrored is Success ✓, Sending is Info with a dot, Not in Zoho is Danger !, and Zoho
  dry run is Neutral with a ring. This matches the mockup row (`docs/design/mockups/staff-gaps/index.html:98`).
- **Wording (Z3):** all labels and sentences come from `packages/shop-contracts/src/zoho-mirror-copy.ts`, with no
  copy in the app (except the time format, finding 4). "Copy Zoho record ID" appears only with a reference. The
  Failed jobs link appears only on Failed. The dry run sentence is exact.
- **No hover-only tooltip:** it's a real `<button type="button">`, and the kit test checks that nothing opens on
  hover. It opens a popover from `md` up and a bottom sheet below, both `role=dialog` with a heading and a
  description. Esc and close return focus to the badge. The sheet close is `size-11` (44 px), and the badge hit area
  grows to 44 px tall.
- **Accessible name:** "Zoho: {label}, details" includes the visible label (WCAG 2.5.3) and the state.
- **Reads:** one `GET zoho-mirror/status` inside the existing `Promise.all`, so there's no waterfall. A failed or
  forbidden read leaves the page whole. Bid admin is asked only on failure. There's no list on this page, so no N+1.
  The e2e's own lookup uses the batched `/statuses` once.
- **Kit:** `StatusDetailsButton` uses the kit's existing Popover and Sheet, STAFF_LAYER, staff tokens and
  `staff-focus`. `CopyButton` gains "Zoho" as a proper noun with a test.
- **Tests fail without the change:** with `order-detail-view.tsx`, `page.tsx` and `copy-button.copy.ts` reverted to
  main, 12 of the 13 new shop-admin tests and the new copy-button case fail. The vm tests fail on import. With the
  change, staff-ui (20) and the three shop-admin files (24) pass. This does not hold for the e2e (finding 1).
- **Route JS:** a local `next build` of shop-admin gives 513.2 KB gzip on main and 513.5 KB on the PR for
  `/(staff)/orders/[orderId]/page`, with the same 18 chunks. That's +0.3 KB, because Popover and Sheet already ship in
  the shell. The diff touches no budget, baseline or allowance file.
- **Screenshots:** light, dark, 1440 and 375 for every badge state are in the repo and in the body. They match the
  mockup's tone, shape and labels, and none scroll sideways.
- **CI:** all checks on 7fde3f6e are green (36 success, 3 skipped by path filter). The commits and PR body have no
  AI footer or trailers.

## Note

The design doc on main still has the heading "(proposed design, awaiting owner approval)"
(`docs/design/staff-gaps-delivery-zoho-alerts.md:1`). If the owner approved it elsewhere, record that approval in the
doc so later PRs can point to it.
