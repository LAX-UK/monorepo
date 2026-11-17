Verdict: FIX FIRST

# Review: PR #1529 "Release-alert send log, part 2: LAX Admin screen"

Reviewed head `04bf91a1` against section 3 of `docs/design/staff-gaps-delivery-zoho-alerts.md`
(LA-3: L1–L6, Q8–Q10), the merged read from PR 1 (#1519, merge `ab2ca97c`) and
`docs/design/staff-design-standard.md` (PRD-7, TBL-8, TBL-13, NAV-3).

The screen is close. It is built on the kit, matches the design's columns and statuses, and its
e2e really runs in CI. It is "fix first" because three things the brief asks for are not met:

- the long-title state is not covered anywhere;
- three visible behaviours survive mutation, so no test fails without them;
- a panel URL for a release that is not on the shown page silently opens nothing, which breaks PRD-7.

All of these are small fixes.

## What I checked and found sound

- **Design match (L1, L2, Q8)**
  - The Release alerts view tab sits on Leads, after the lead tabs, and carries no count (NAV-3).
  - The columns are Edition, Published (and by whom), Told subscribers, People matched, Emailed, Waiting, Not sent and Status.
  - The badges follow L2: neutral ring, info dot, success tick, danger alert. "Counts not kept" is a neutral tick, which matches PR 1's `counts_not_kept` and the `countsKept` fallback.
  - The panel says "Publisher chose not to tell subscribers." and gives the not-sent reasons as plain sentences. An unknown code reads "another reason", so no code leaks.
  - Nobody is named (Q9). The figures come from the kept counts (Q10, PR 1).
  - The publisher shows as "by …" and "Not recorded" when unknown (the PR 1 NULL-kind and NULL-publisher rows).
  - Paging uses PR 1's cursor: Next, then First page.
- **Copy:** every string is in `apps/shop-admin/src/server/domain/release-alert-sends.copy.ts`, in sentence case. The empty and error copy match L5.
- **Dates:** `formatDateTime(…, LONDON_TIME_ZONE)` from `@auction/datetime` renders inside a `<time datetime>`. `pnpm lint:datetime` passes.
- **Kit reuse:** `ListPage`, `DataViews`, `DetailPanel`, `useQueuePanel`, `MappedStatusBadge`, `KeyValueList`, `Notice` and `PrimaryCell`. The metric strip and lead tabs are shared (`releaseAlertMetricStrip`, `leadsViews`), `ARTWORKS_CAPABILITIES` is one export, and `QueueRowLink` is reused. I found no duplicated logic and no hard-coded colours (only `text-staff-*` tokens), so the LAX Admin accent comes from the shell.
- **Gating:** the tab shows only with `lead.read`. The server enforces it: 403 renders "Your role cannot open this page". "Open artwork" shows only with `catalogue.read` or `artwork_price.write`.
- **E2E in CI:** in the Web PR browser gates run 44055583309 (job 133944189898), step "Run LAX Admin accessibility and role checks":
  - `seed:release-alert-sends` ran and created all six statuses. The second call created none, so the seed is insert-once.
  - All 7 `release-alert-sends.spec.ts` tests passed, light and dark. The run total was 89 passed, with 0 skipped and 0 flaky.
  - `prerequisite()` throws under `CI`, so the spec cannot skip there.
- **Unit tests:** the 5 new or changed test files pass locally (47 tests).
- **Lint:**
  - `pnpm lint:deps` passes: no new cycles, freeze intact.
  - No route-JS budget, baseline or allowance files are touched, and no visual baselines.
- **Screenshots:**
  - All 52 image URLs in the PR body return 200. They are byte-identical to the committed files, at 2880×2000 and 750×1624 (true 2x of 1440×1000 and 375×812).
  - Send log, panel, stuck panel, phone list, phone panel, error, loading and permission denied all render cleanly in both themes.
- **Commits:** all three are authored and committed by `mahmoudamrspace` with no trailers. The PR body has no AI footer.

### Mutation results

I ran these against the unit tests (`vm`, `lead-list.vm`, `metrics`, the client test, the page test and `admin-nav.vm`).

27 of 31 mutations failed the suite (killed), including:

- the tone of each badge;
- the capability gate on the tab;
- a count on the tab;
- the London time zone;
- the phone line for "not announced";
- filtering out zero-count reasons;
- leaking a reason code;
- the artwork link by role (page and client);
- the forbidden state;
- Try again and the error state;
- next and previous page;
- keeping the cursor in the panel href;
- the publisher;
- false zeros on the lead tabs;
- the panel's reasons and notice;
- the metric strip;
- the empty copy;
- the `<time>` element;
- the active tab;
- row open.

The phone-counts column survives the unit tests but the e2e kills it. The survivors are findings 2 to 4.

## Findings

### 1. Long titles: no fixture, screenshot or test (brief requirement, L6 checks)

- **Where:**
  - `apps/shop-admin/e2e/release-alert-sends.spec.ts:26`, where the fixtures are all one or two words;
  - `apps/shop-api/src/infrastructure/seed/release-alert-sends-seed.ts:53`;
  - `docs/design/screenshots/release-alerts/`.
- **Failure scenario:** an edition titled, say, "Untitled (harbour at low tide, after Whistler), second state, signed proof" has never been rendered.
  - At 1440 the Edition cell's truncation and min-width are unverified next to the 200px Published column.
  - At 375 the title in the stacked row competes with the badge and `…` on one line, so the badge may wrap or the row may scroll sideways.
  - In the panel, a long title beside the badge, ↑/↓ and "Open artwork" header actions may push the actions off-screen.
- **Fix:**
  - Give one fixture (for example the Sending one) a long title.
  - Assert `noSidewaysScroll` at 375 and that the full title is reachable: the link's accessible name, or `title`/tooltip if truncated.
  - Add a `send-log-long-title-{1440,375}-{light,dark}` capture.

### 2. The "Told subscribers" column is untested

- **Where:** `apps/shop-admin/src/components/leads/release-alert-send-log.client.tsx:141`
- **Failure scenario:** changing the cell to `() => COPY.yes` passes every unit test and the e2e. A regression that shows "Yes" for a release whose publisher unticked Tell subscribers would ship. That is the fact this log exists to record.
- **Fix:** in the client test, assert the Quiet harbour (`toldSubscribers: false`) row's Told subscribers cell reads "No" and a told row reads "Yes". The e2e can check the same in `rowOf(page, "Quiet harbour")`.

### 3. Right-aligned counts (TBL-13) are untested

- **Where:** `apps/shop-admin/src/components/leads/release-alert-send-log.client.tsx:147`, `:155`, `:163`, `:171`
- **Failure scenario:** removing `numeric: true` from any count column passes every test. The figures then left-align, against TBL-13 and the design's "Accessibility, themes and phone" ("right-aligned").
- **Fix:** assert in the client test that the four count cells and headers carry the kit's numeric alignment (class or `data-numeric`), the same way other list tests check numeric columns.

### 4. The stuck panel's danger notice tone is untested

- **Where:** `apps/shop-admin/src/components/leads/release-alert-send-log.client.tsx:315`
- **Failure scenario:** `tone="info"` for every status passes all tests. "Not sent yet" is the one state that needs action, and it would then read as a calm blue note in the panel.
- **Fix:** in the client test, assert the Salt marsh panel's notice has the danger role or tone (for example `role="alert"` or the kit's tone attribute), and that the others are info.

### 5. A panel URL for a release not on the shown page opens nothing (PRD-7)

- **Where:** `apps/shop-admin/src/components/leads/release-alert-send-log.client.tsx:97`
- **What happens:** `opened = page.items.find(…)` returns null when `?release=` names a release outside the current page. The panel stays closed, nothing tells the reader why, and the param stays in the URL.
- **Why it matters:** PRD-7 says "A panel has a URL that reopens it, even when the record is not on the page of the list shown." Its check is "Reload a panel's URL for a record on page 3: it opens."
- **Failure scenario:** someone shares `/leads/release-alerts?release=<id>` from the first page, which has no cursor. A week and 50+ new releases later the link opens the list with no panel. The same happens to any link built from elsewhere, for example the L4 per-artwork line. Links made on later pages keep their cursor, so they still work. The first page is the common case.
- **Fix:** when `state.open` is not among `page.items`, fetch that one release and open the panel with it, as other no-page records do. This needs a by-id read: add `GET /admin/v1/release-alerts/sends/:artworkId` (`lead.read`) as a follow-up to PR 1, or filter the list read by item key. Failing that, at least show a "This release is not on this page" notice with a link to the first page, and add a test.

### 6. Loading skeleton: the last column looks clipped at 1440 (craft)

- **Where:** `docs/design/screenshots/release-alerts/loading-1440-{light,dark}.png`, the right edge of each skeleton row.
- **Failure scenario:** a sliver of a ninth skeleton cell (the row-actions column) is cut off by the card's right edge, while the loaded table fits. The page then jumps width when data arrives, and the skeleton looks broken.
- **Fix:** check that the skeleton uses the same column set as the table, including the 56px actions column (TBL-8), so it fits the card. If this comes from the kit's `ListPage` skeleton, fix it there and note it.

### 7. "Emailed 0 of 0" on a queued release (phone)

- **Where:** `apps/shop-admin/src/server/domain/release-alert-sends.vm.ts:93`, seen in `send-log-375-*.png` (First light).
- **Failure scenario:** a queued release has not been matched yet, so the phone line says "Emailed 0 of 0". That reads as "went to nobody" rather than "not worked out yet".
- **Fix:** return null for `status === "queued"`, as for not announced, and let the badge speak. Update the e2e fixture (`phone: null`) and the vm test.

### 8. The seed's doc comment is wrong, and the fixtures depend on `ALERTS_SEND_MODE=off`

- **Where:** `apps/shop-api/src/infrastructure/seed/release-alert-sends-seed.ts:16` ("such as the CI stack, where no worker runs").
- **What happens:** the CI stack runs shop-api's scheduler. `SHOP_SCHEDULER_ENABLED` defaults to true, every 60s, with the alert matching and digest tasks. The PR body itself relies on this: the queued work is a draft so the alert run does not expand it.
- **Failure scenario:** if the stack ever runs with `ALERTS_SEND_MODE=dry_run` or `on`, the digest task can build and mark digests for Night ferry's waiting matches. The "Sending" assertion then turns into "Sent" and fails intermittently.
- **Fix:** correct the comment. Either pin `ALERTS_SEND_MODE=off` for the LAX Admin stack in the workflow, with a comment saying the fixtures depend on it, or make the e2e assert that precondition.

### 9. If the session read fails, the page loses its own tab (low)

- **Where:** `apps/shop-admin/src/app/(staff)/leads/release-alerts/page.tsx:38`
- **Failure scenario:** the sends read succeeds, but `loadAdminSession()` fails or times out. `capabilities` becomes `[]`, so `leadsViews` drops "Release alerts" and the page renders with `activeId="release-alerts"` and no active tab. "Open artwork" is also hidden for administrators.
- **Fix:** the sends read succeeding proves `lead.read`. Always include the tab on this page, or treat a failed session as the error state.

### 10. The design doc is not updated (low, docs)

- **Where:** `docs/design/staff-gaps-delivery-zoho-alerts.md:1` and `:287` onward.
- **What is out of date:**
  - The title still says "proposed design, awaiting owner approval", and section 3 has no PR plan for LA-3.
  - L2 says the Edition column links "to the artwork". The PR links the title to the panel URL (TBL-8/PRD-7: the panel is the record) and moves the artwork to the panel header and row menu. That is the right call under the standard, but the doc does not record it.
  - L5's "No results" state is intentionally dropped, because the read has no search. The doc does not say so either.
- **Fix:** in this PR, note in section 3 that:
  - L1, L2, L5 and L6 are built (PR 1 #1519, PR 2 #1529);
  - the Edition title opens the panel, with the artwork reached from the panel or `…`;
  - there is no no-results state until search exists.

## Not blocking, noted

- No thumbnail is exercised, because every fixture has `primaryImageUrl: null`. Consider one fixture with an image so the 1440 and 375 rows are seen with a real picture.
- J/K stepping is covered by the client test, not the e2e. That is fine at this layer.
