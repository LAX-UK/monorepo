Verdict: FIX FIRST

Independent review of PR #1520 "Bid admin Deliveries: list page and queue panel" (head `1afe9a28`, 16 commits, base `main`). I checked it against `docs/design/staff-gaps-delivery-zoho-alerts.md` (GAP-47, D1–D9) and against the PR 1 review notes (`review-notes-pr1517-review`, findings 4–9). Checked on 2026-11-17.

The page is close. Access, bounded reads, the kit reuse, the D6 states and the a11y wiring all hold up. I ran it in a browser myself, and the PR's own journey passes. The blockers are:

- The browser test is not in the PR browser gate.
- Two behaviours the PR says are tested are not.
- The not-found panel hides API errors, and its copy is wrong.
- The Lot column truncates the lot title (the row's main identifier) beside the panel and at 375.

## How I checked

- **Unit tests:** on the PR head, all pass. Web deliveries, nav and layout: 7 files, 87 tests. Kit `detail-panel` and `timeline`: 12 tests.
- **Local stack:** I built the stack as `e2e-stabilization` does: Postgres 16, migrations, `db:seed:local`, roles, OIDC clients, API, auth issuer, web and ws, then prepared the auth sessions.
- **The PR's journey:** `apps/web/e2e/admin-deliveries.spec.ts` passed locally (1 of 1, 9.1 s), and its rows were removed afterwards.
- **My own screenshots:** taken with Playwright as the Operations (Fulfilment) user, using six local-only quotes I added (requested ×3, one with a very long destination; quoted; accepted; withdrawn). Results:
  - At 1440 and 375, light and dark: no horizontal scroll on list, closed, not-found or no-results.
  - Opening a row puts focus on the panel's `H2` title ("Lot 3 · Anatomy of Light").
  - Escape returns focus to the row (`TR`) at 1440, in light and dark.
  - A sample is in `review-shots/`.
- **Access in the browser:**
  - `read_only` and `finance` end on `/admin/no-access?from=/admin/deliveries` and have no nav link.
  - The server's first HTML for `read_only` holds a `NEXT_REDIRECT` and none of the delivery data. I searched it for the buyer names and addresses.
  - `operations` and `admin` get the page and the nav link with count 3.
  - The API without a session returns 401.
- **The PR's screenshots:** I fetched 12 of the raw `github.com/…/raw/ca39db28…` URLs from the PR body (01, 02 at 1440 light and dark and at 375, 06, 08, 08b, 12, 13, 14, 15 at both sizes) and the mockup. All returned 200 `image/png`, real PNGs at 2880×2000 or 750×1624.
- **Mutation probes:** I reverted one behaviour at a time and re-ran the tests:

  | Reverted | Result |
  | --- | --- |
  | Tab `countLabel` | 3 failed |
  | Changed-while-open notice | 1 failed |
  | Columns stepping aside beside the panel | 1 failed |
  | `selected` fetch | 1 failed |
  | `keepMissing` | 1 failed |
  | Kit `modal={!docked}` | 1 failed |
  | `visibilitychange` refresh | **0 failed** |
  | Kit `onInteractOutside` preventDefault | **0 failed** |

- **CI:** 46 check runs on `1afe9a28`. All succeeded except 2 skipped as not applicable (`account-browser-gates`, `art-browser-gates`).
- **Hygiene:**
  - No budget, baseline, allowance or Lenis paths in `git diff origin/main...pr1520`.
  - All 16 commits are authored and committed by `mahmoudamrspace <mahmoudamr.space@gmail.com>`, with no trailers.
  - The PR body has no AI footer.

## Findings

### 1. The browser test is not in the Bid admin PR browser gate (blocker)

- **Where:** `apps/web/e2e/admin-deliveries.spec.ts:123` (`test.describe("deliveries @journey", …)`).
- **What happens:** the PR browser gate (`e2e-pr.yml` → `browser-gates` → `scripts/ci/run-pr-browser-gates.mjs` → `test:e2e:pr`) runs only `@smoke|@roles`. `@journey` runs only in `e2e-stabilization.yml`, which is `workflow_dispatch` plus a weekly cron (`0 4 * * 1`). No `@smoke` or `@roles` spec visits `/admin/deliveries`.
- **What else is missing:** `/admin/deliveries` is not in `admin-a11y.spec.ts` or in `staffViewportListRoutes` in `admin-viewport-audit.spec.ts`. Its sibling `/admin/lot-fulfilment` is in both.
- **Failure scenario:** a later PR breaks the page, the panel or the D5 guard (for example, the layout swapped back to `readOrWrite`). Every PR check stays green, and the break is found on Monday's stabilization run at the earliest.
- **Fix:**
  - Add a small `@smoke` or `@roles` test that runs in `browser-gates`:
    - Operations opens `/admin/deliveries` and sees the heading and the six view tabs.
    - The Waiting tab's accessible name matches `/\d+ waiting/`.
    - A `?record=<random uuid>` link shows the not-found Notice.
    - `read_only` ends on `/admin/no-access`, with no `a[href="/admin/deliveries"]` in the nav.
  - Keep the seeded `@journey` for the J/K and focus steps.
  - Add `{ name: "deliveries", path: "/admin/deliveries", param: "record" }` to `admin-viewport-audit.spec.ts` and a `/admin/deliveries` line to `admin-a11y.spec.ts`.

### 2. The kit test "a click on the list does not close it" passes without the behaviour (blocker: a test that cannot fail)

- **Where:**
  - The behaviour: `packages/staff-ui/src/panels/detail-panel.tsx:183`, `onInteractOutside: (event) => event.preventDefault()`.
  - The test: `packages/staff-ui/src/panels/detail-panel.test.tsx:170`.
- **What happens:** with that line deleted, all 38 panel tests still pass. Radix registers its pointer-down-outside listener on a timeout. The test fires `pointerDown`, `mouseDown` and `click` synchronously right after render, before the listener exists, so `onOpenChange` is never called either way.
- **Failure scenario:** someone tidies the line away, and at 1280px and up every click on another row or tab closes the beside panel. That is D3 and PRD-7's "list stays usable" broken, with CI green.
- **Fix:** in the test, wait for the layer before clicking: `await act(() => new Promise((r) => setTimeout(r, 0)))`, or use `userEvent.pointer`. Then assert `onOpenChange` was not called. Check that the test fails with line 183 removed.

### 3. The "list reads again when the tab comes back" behaviour has no test

- **Where:** `apps/web/src/components/admin/deliveries/deliveries-list.tsx:213-220`.
- **What happens:** with the `router.refresh()` call removed, all 69 deliveries tests still pass. The PR body says each fix "has a test that fails without it", and this is part of finding 4 (D6 changed-while-open).
- **Failure scenario:** the effect is dropped or its dependencies break. Staff come back to a tab where the buyer has since withdrawn, the panel shows the old state, and no "The buyer changed this request" notice appears.
- **Fix:** in `deliveries-list.test.tsx`:
  1. Open the panel.
  2. Set `document.visibilityState` to `"visible"` and dispatch `visibilitychange`.
  3. Assert that the mocked `refresh` was called.
  4. Assert that it is not called with the panel closed.

### 4. The not-found panel hides API failures, and its copy is wrong (D6)

- **Where:**
  - `apps/web/src/lib/admin/deliveries/load-deliveries-page.ts:48`: `getAdminDelivery(filters.record).catch(() => null)`.
  - `apps/web/src/lib/admin/deliveries/deliveries-copy.ts:184`.
- **What happens:**
  - `getAdminDelivery` already maps 404 to `null` (`nullStatuses: [404]`). The extra `.catch` also turns a 500, a timeout or a 403 into "This delivery could not be found".
  - The description says "It may have been withdrawn". But a withdrawn request is found: `/admin/deliveries?record=b1000002-…` (a withdrawn quote, opened from the Waiting tab) showed the full panel with "Withdrawn by buyer" in my run.
- **Failure scenario:** the Bid API hiccups on the detail read while the list read succeeded. Staff are told the delivery does not exist and that it "may have been withdrawn", and they close it. A real request then waits unseen, which is exactly the gap GAP-47 exists to close.
- **Fix:**
  - Drop the `.catch`, or catch only to set a panel-level error.
  - Pass a `selectedError` to the panel and render the D6 error Notice: "This delivery could not be loaded. Try again.", with Try again.
  - Reword `notFound.description` to what is true, e.g. "No buyer has asked for delivery on this lot, or the link is out of date."
  - Add a loader test where the detail read rejects.

### 5. Craft: the lot title is cut to a few characters beside the panel and at 375

- **Where:** `apps/web/src/components/admin/deliveries/deliveries-list.tsx:84-155`: the Lot column has no width, while Status is a fixed `176px` and Waiting `160px`.
- **What happens:** see `review-shots/panel-1440-dark.png`, `list-375-light.png` and `closed-375-dark.png`, and the PR's `02-waiting-panel-1440-*`.
  - Beside the panel, the title reads "Lot 3 · Anato…" or "Lot 42 · Harb…", and the sale line "Modern Britis…".
  - At 375 it reads "Lot 2 · The W…", because the badge "Withdrawn by buyer" takes the row's right half.
  - Meanwhile Status keeps about 70px of empty space after its badge, and Price about 40px.
  - Even with no panel at 1440, the sale line loses its close date ("Spring Contemporary Evening Sal…"). D3 puts the sale and its close date in this cell on purpose.
- **Failure scenario:** staff working the queue cannot tell rows apart by title. Two lots from the same sale read identically ("Lot 3 · Anato…" vs "Lot 3 · Silent …" already collide on the lot number in the seed).
- **Fix:**
  - Let Lot take the remaining width (`minWidth` of about 220px if the kit column supports it).
  - Narrow Status to its widest single badge.
  - Beside the panel, consider folding Waiting under Status, or dropping the thumbnail, rather than starving Lot.
  - At 375, let the title wrap to two lines (`truncate: "lines-2"` or the kit's equivalent) instead of ending it at about 10 characters.
  - Re-shoot 02 and the 375 states.

### 6. D9 PR 2's visual baseline is missing (needs a fix or the owner's explicit deferral)

- **What happens:** D9 item 2 is "Page: … queue panel with Send quote and Change quote. Visual baseline added to `apps/web/e2e/admin-pages-visual.spec.ts`." This PR ships neither the actions nor the baseline. The PR body discloses this ("on this PR or the next").
- Adding a baseline for a new page is not raising an existing one, so the brief's rule does not block it.
- **Fix:** add the `/admin/deliveries` entry and baseline here, generated through `visual-baselines.yml`. Or record in the design doc's D9 that PR 2 is split into 2a (read-only, this PR) and 2b (Send/Change quote plus baseline), so the plan matches what ships.

### 7. Smaller items

- **Missing `missingLabel` on the thumbnail.** `deliveries-list.tsx:94` passes `thumbnail={{ src: row.lot.imageUrl }}` with no `missingLabel`. Every other staff list passes one (`lots-staff-list.tsx:135` "No photos yet", `sales-staff-list.tsx:102`, and others), so a lot without a photo gets an unlabelled placeholder.
  - **Fix:** `missingLabel: DELIVERIES_COPY.noPhoto` ("No photo yet").
- **Copy outside the copy file (finding 8 is not quite complete).** `apps/web/src/app/admin/(platform)/deliveries/error.tsx:6-8` hard-codes "Deliveries", "/admin/deliveries" and "Back to deliveries".
  - **Fix:** use `DELIVERIES_COPY.title`, `DELIVERIES_PATH` and a new `DELIVERIES_COPY.error.back`.
- **A denied read is shown as a retryable error.** At `load-deliveries-page.ts:43`, if the web guard and the API disagree (capability drift), the 403 becomes the error state "Deliveries could not be loaded. Try again." with a Try again button that can never work.
  - **Fix:** return a `denied` flag and render the kit's `AccessDeniedState` (as `consignment-inbox/inbox-thread-unavailable.tsx` already does).
- **A ref is written during render.** `useChangedWhileOpen` (`delivery-panel.tsx:204-214`) writes `first.current` during render. React's rules say not to read or write refs while rendering: under concurrent rendering a discarded render can leave the snapshot pointing at a lot that never committed.
  - **Fix:** keep the first key in `useState` keyed by `lotId`, using the "reset state when a prop changes" pattern: `const [seen, setSeen] = useState(...)`, with `if (seen.lotId !== row.lotId) setSeen(...)`.
- **A stale comment.** `page.tsx:16-17` still says "read-only staff see it without the actions". Under D5 as implemented they cannot open it.

## The PR 1 review findings this PR was to apply

| # | Finding | Status | Evidence |
| --- | --- | --- | --- |
| 4 | D6 not found and changed while open | **Partly** | The Notice, Back to the list, the stale notice and the 15-not-found shots are all there, and the tests fail when the behaviour is reverted. Two gaps remain: an API error is shown as "not found" with wrong copy (finding 4 above), and the tab-return refresh is untested (finding 3). |
| 5 | The e2e runs and never skips silently | **Partly** | It seeds its own sale, lots and quotes and throws without `DATABASE_URL`. It asserts title focus, focus back on the row after Escape, J/K URLs, the columns in view beside the panel, and the not-found panel. It passes locally for me, and in `e2e-stabilization` run 44020786557. It is not in the PR browser gate (finding 1). |
| 6 | The panel sits beside the list at 1440, as in the mockup and D3 | **Done, with gaps** | The kit's `beside` mode is non-modal with no scrim, and `BesidePanelInset` keeps the 480px clear. Status, Price and Waiting are in view (my 1440 shot, and the journey's `toBeInViewport`). Buyer and paddle read on one line. The outside-click test is vacuous (finding 2), and the Lot title is starved (finding 5). |
| 7 | Screenshot tables render | **Done** | Plain `<img>` tags with `raw/<sha>` URLs. All 12 I fetched are real PNGs. |
| 8 | All copy in `deliveries-copy.ts` | **Done, apart from `error.tsx`** | Badges, lot title, paddle, range, sale line, courier line and history are all in the file. The unused keys are gone. |
| 9 | The count is announced as ", 3 waiting" | **Done** | `staff-nav.deliveries.test.ts` checks the sidebar text. The tab's `countLabel` goes through the shared `Tabs` component, and removing it fails 3 tests. The journey asserts `/\d+ waiting/`. |

## Verified good (no change needed)

- **D2 and D3 columns, tabs and badges.** The six URL tabs carry counts, and the counts are left out when the list fails. Badges come from one `defineStatusMap` with tone and shape (dot, check, ring). There are at most two badges, plus "Awaiting payment".
  - Columns are Lot (`PrimaryCell`, thumbnail and sale line), Buyer (`PersonCell` with paddle), Destination (kit truncation with full text), Status, Price ("–" before a quote) and Waiting.
  - Waiting shows "Asked 2 days ago" with the exact London time in `title`, carrier and tracking once On the way, and the step alone with "Time not recorded" when no time is recorded.
  - At 375 a row stacks as title, then badge, then a "Buyer · Destination · £price" meta line.
- **Closed states.** "Withdrawn by buyer", "Cancelled" (with history "Purchase cancelled") and "Collected in person" (dated from `collectedAt`) are each unit-tested.
- **Shared dates and kit.** All dates use the kit's `formatStaffDate`, `formatStaffDateTime` and `formatStaffRelative`, and the Activity says "Time not recorded" through the new `UndatedTimelineEvent`. The page uses kit components only (`ListPage`, `DataViews`, `FilterSheet`, `DetailPanel`, `useStaffQueue`, `Notice`, `Timeline`), and the kit additions are generic. The accent is the Bid admin navy; there are no new colours.
- **Bounded reads, wired to the API.** `limit` is 25, 50 or 100, `offset` is capped at 100,000, `q` at 120 characters, and the sale id must be a UUID. The sale filter uses the API's bounded `sales` list. Every read is `no-store`.
- **Permissions enforced on the server.** The route table, the segment layout (with a test) and `requireAdminCapability` on the page all apply, and the API guards `/deliveries*`. `canWork` only hides links; it guards nothing.
- **States.** Loading (`ListPageSkeleton` with the six column labels), empty per tab, no results with Clear filters, error with `role=alert` through the kit, and the not-found panel are all covered by tests and screenshots. I checked list, closed, not-found and no-results at 375 and 1440, light and dark, for horizontal overflow; none had any.
- **Hygiene.** No route-JS budget, baseline or allowance changes, no Lenis changes, commits by `mahmoudamrspace` with no trailers, and no AI footer in the PR body.

## Notes

- Thumbnails show as broken images in my shots only because this sandbox cannot reach `images.unsplash.com`, where the seed's photos live. That is not a PR defect, but see the `missingLabel` item in finding 7.
- The quotes I added for the screenshots exist only in the throwaway local database.
- I did not prove that the journey fails with the page reverted (the PR body says it was done).

## Final recheck

I rechecked the PR at head `8884fca7` (18 commits) on 2026-11-17. That head adds `12d6b52d`, a merge of `main`, and `8884fca7`, the fixes from this review. I checked it against the Deliveries section of `docs/design/staff-gaps-delivery-zoho-alerts.md` (D1–D9) and the seven findings above.

**Result: the code is ready, but the PR body is not.** All seven findings are fixed and each was checked with evidence. One item in the brief still fails: the `08b-closed-collected-panel` row of the PR body's screenshot table does not render (see below). The fix is an edit to the PR body only, with no code change.

### Findings 1–7

| # | Finding | Status | Evidence |
| --- | --- | --- | --- |
| 1 | The browser test runs in the Bid admin PR browser gate, seeds its own data and never skips | **Fixed** | See "Finding 1 in CI" below. |
| 2 | The kit test "a click on the list does not close it" can fail | **Fixed** | The test now waits a tick (`act` plus `setTimeout 0`) for Radix's listener. I replaced `onInteractOutside: (event) => event.preventDefault()` (`detail-panel.tsx:183`) with a no-op, and 1 test failed: "from 1280px has no scrim, and a click on the list beside it does not close it". Restored, it passes (11 of 11). |
| 3 | The tab-return refresh is tested | **Fixed** | See "Finding 3 mutations" below. |
| 4 | API failure and not found are separate states, with correct D6 copy | **Fixed** | See "Finding 4" below. |
| 5 | The lot title is readable beside the panel at 1440 and at 375 | **Fixed** | See "Finding 5 screenshots" below. |
| 6 | D9 records PR 2 split into 2a and 2b, and the PR body says so | **Fixed** | See "Finding 6" below. |
| 7 | The smaller items | **Fixed** | See "Finding 7" below. |

#### Finding 1 in CI

- **Run:** Web PR browser gates run `44036318293`, job `browser-gates` (133880081722), on head `8884fca7`, event `pull_request`. It succeeded.
- **The test listing** (`playwright test --list --grep "@smoke|@roles|@public-a11y"`) includes:
  - `admin-deliveries.spec.ts:149 › deliveries @smoke @journey › finds a buyer's request, opens it in the queue panel and steps through`
  - `:254 › deliveries access @roles › operations @roles › opens Deliveries with its six views and the waiting count`
  - `:278 › … read-only staff @roles › is sent to No access and has no Deliveries link`
- **The `test:e2e:pr` step** (`--grep "@smoke|@roles"`) reported `Running 84 tests`, then `78 passed, 6 skipped`.
- **These 3 tests ran and passed, not skipped.** The same step on the previous head (run `44020787235`) reported `81 tests, 75 passed, 6 skipped`, with no `admin-deliveries` in its log. So the 3 tests added here are the 3 new passes; the 6 skips are unchanged and are other specs.
- **The spec cannot skip.**
  - It has no `test.skip` or `test.fixme`.
  - `requireStack()` throws without `PLAYWRIGHT_E2E` or staff credentials, and the seeding throws without `DATABASE_URL`.
  - The gate step's env has `DATABASE_URL` and `PLAYWRIGHT_E2E=1`.
  - The journey seeds its own sale, lots and requests and removes them afterwards.
- **Audits:** `/admin/deliveries` is now in `admin-a11y.spec.ts` (at 1440 and at mobile width), in `QUEUE_PANELS` in `admin-viewport-audit.spec.ts` (`param: "record"`) and in `staffViewportListRoutes`.

#### Finding 3 mutations

The new test opens the panel and checks hidden, then visible, and checks visible with the panel closed. I reverted the behaviour two ways:

| Reverted | Result |
| --- | --- |
| `router.refresh()` replaced with a no-op | 1 failed |
| The `if (!panelOpen) return` guard removed | 1 failed |

Both failures were "reads the list again when the tab comes back with a panel open, and not with it closed".

#### Finding 4

- **The loader.** `load-deliveries-page.ts` no longer has `.catch(() => null)`:
  - A 404 is still `null` through `getAdminDelivery`'s `nullStatuses`, which shows "not found".
  - Any other failure sets `selectedError`.
- **The panel.** It renders a danger Notice with `alert`:
  - Title "This delivery could not be loaded. Try again."
  - Text "The Bid API didn't answer. The buyer's request is kept."
  - Buttons "Try again" (`router.refresh()`) and "Back to the list".
- **Not-found copy.** It now reads "No buyer has asked for delivery on this lot, or the link is out of date."
- **Mutations:**

  | Reverted | Result |
  | --- | --- |
  | `selectedError = true` set back to `selected = null` | The loader test failed |
  | The `loadFailed` branch in the panel disabled | 2 failed (panel and list) |

- **Screenshots.** `16-load-error` at 1440 shows the error in the beside panel while the list stays readable.

#### Finding 5 screenshots

I opened the PR's re-shot PNGs.

- **`02-waiting-panel-1440-light`:** beside the panel, the titles read in full ("Lot 3 · Anatomy of Light", "Lot 4 · Chromatic Resonance", "Lot 5 · Suspended Memory"). The sale line wraps to two lines and keeps its date ("Spring Contemporary Evening / Sale · Tue 8 Sep"). Status, Price and Waiting stay in view.
- **`02b-long-title-panel-1440-dark`:** the same, in dark.
- **`01-waiting-375-light` and `08-closed-375-dark`:** the badge now sits on its own line under the title. Titles read in full, including "Lot 8 · Collection journey: collected", and the sale line wraps. Only the meta line is cut ("… Berlin, Germ…"), which is acceptable.
- **Tests:** a list test asserts `whitespace-normal` on the title and the sale line, and no `data-staff-truncated`. A kit `cells.test` covers the `PrimaryCell` `wrap` change for the second line.
- **Other users of the kit change:** the only other `wrap` user is `accounting-queue-list.tsx:138`. Its short `row.kind` line may now wrap, which is harmless.

#### Finding 6

- **The design doc:** its D9 now reads "Page, split in two (decided at the review of #1520)":
  - 2a is the read-only page (#1520).
  - 2b is Send quote and Change quote, and the `/admin/deliveries` baseline in `admin-pages-visual.spec.ts`.
  - The summary table row is updated to match.
- **The PR body:** it says the same, under "D9 PR 2 is split …: this PR is 2a … 2b adds …".
- **Baselines:** none are added or changed.

#### Finding 7

- **`missingLabel`:** the thumbnail passes `missingLabel: DELIVERIES_COPY.noPhoto` ("No photo yet"), and a test finds `img` named "No photo yet".
- **`error.tsx` copy:** it uses `DELIVERIES_COPY.title`, `DELIVERIES_PATH` and `DELIVERIES_COPY.error.back`.
- **403 to `AccessDeniedState`:** a 403 on the list read now returns `denied: true`, and the list renders the kit's `AccessDeniedState` (H1 "You don't have access to Deliveries", roles Fulfilment and Administrator) with no Try again. Screenshots are `17-denied`. Mutations:

  | Reverted | Result |
  | --- | --- |
  | The loader's `denied` flag | 1 failed |
  | The list's `denied` branch | 1 failed |

- **Ref written during render:** `useChangedWhileOpen` now keeps `{ lotId, key }` in `useState`, reset by lot ("adjust state when a prop changes"). `useRef` is gone from `delivery-panel.tsx`. A new test covers reopening the same lot after its panel closed.
- **Stale comment:** `page.tsx` now says that under D5 the page opens only for Fulfilment and Administrators, and everyone else is sent to No access.

### PR 1 review findings 4–9: no regression

| Area | Result |
| --- | --- |
| Web: deliveries, nav, the segment layout and `lib/data/http` | 52 files, 280 tests passed |
| Kit `@auction/staff-ui` | 86 files, 704 tests passed |

The behaviours behind PR 1's findings 4–9 all hold, and their tests and mutations above still fail when the behaviour is removed:

- the D6 notices
- the beside panel with columns in view
- the copy all in `deliveries-copy.ts`
- the ", 3 waiting" count

Finding 8 is now complete, because `error.tsx` copy comes from the copy file.

CI on `8884fca7`: 41 check runs. All succeeded except `account-browser-gates` and `art-browser-gates`, which were skipped as not applicable.

### Hygiene

- **No budgets, baselines or allowances raised.** `git diff --name-only <merge-base> pr1520` has no path matching budget, baseline, allowance, snapshots, visual or Lenis.
- **Commits by `mahmoudamrspace`, no trailers.** All 18 commits are authored and committed by `mahmoudamrspace <mahmoudamr.space@gmail.com>`, and that includes the 4 merges. No message has a Co-authored-by, Signed-off-by or "Generated with" line.
- **No AI footer** in the PR body.
- **Behind `main`:** the branch is behind `main` (`ab2ca97c`). That is not a blocker.

### What still blocks: the PR body's 08b screenshot row does not render

- **Where:** line 107 of the PR body, the `08b-closed-collected-panel` row.
- **What is wrong:** all four cells are escaped and wrapped in backticks, for example:

  ```
  | `08b-closed-collected-panel` | &lt;img src="`` https://github.com/lax-uk/monorepo/raw/8884fca7…/08b-closed-collected-panel-1440-light.png" `` width="220"> | …
  ```

  GitHub shows this as literal text, so the four 08b images (the "Collected in person" closed panel) do not appear.
- **Everything else renders:** I fetched the other 68 image URLs in the body (all 17 states × 4, plus the 4 mockups), and every one returned 200 `image/png` with a real PNG. The 08b PNGs exist in the branch at `docs/pr-evidence/bid-admin-deliveries/08b-*`.
- **Fix:** rewrite the row like its neighbours:

  ```
  | `08b-closed-collected-panel` | <img src="https://github.com/lax-uk/monorepo/raw/8884fca7…/08b-closed-collected-panel-1440-light.png" width="220"> | … |
  ```

  Remove the `&lt;` and the backtick runs. No code change is needed.

### Not blocking

- **The 02b screenshot is mislabelled.** `02b-long-title-panel` is labelled "title and sale line wrap", but its rows are the same short seeded titles as in 02. The wrapping it shows is the sale line's. The unit test covers the wrap, and at 1440 the title column has room, so this is evidence that is weaker than its label, not a defect.
- **A refused detail read can still be retried.** A 403 on the detail read (`getAdminDelivery`) shows the retryable "could not be loaded" Notice, not access denied. That needs the list read to be allowed and the detail read refused, which cannot happen under the current API guard (both are under `/deliveries*`).

Verdict: FIX FIRST. The code passes every check; the PR body still has to be fixed so its 08b screenshot row renders.
