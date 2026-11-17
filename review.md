Verdict: FIX FIRST

# Review of PR #1527: the Zoho mirror badge on the artwork record and an optional Orders column

Reviewed head `44dddd38` against section 2 of `docs/design/staff-gaps-delivery-zoho-alerts.md` (Z1 to Z5, Q5 to Q7, and the accessibility notes) and against how PR 2 (#1521) built the order page badge.

One thing blocks the merge. For any staff member who had already saved a column choice on Orders, the "hidden by default" Zoho column turns up already shown. That breaks Z1 and TBL-12. The fix is small. Everything else is in good shape.

## Blocking

### 1. Staff who already saved Orders column choices get the Zoho column shown, and a ledger read on every page

- **Where:** `apps/shop-admin/src/components/orders/order-list.client.tsx:76` and `:396` (`DEFAULT_HIDDEN_COLUMNS = ["zoho"]`), together with `packages/staff-ui/src/data/columns-menu.tsx:47-53`.
- **What happens:**
  - `useColumnVisibility` saves the whole hidden set under `staff.columns.orders`.
  - When it finds a saved set, that set replaces `defaultHiddenColumns` completely.
  - Before this PR, Orders had no default-hidden columns. So anyone who hid any column has a saved set without `"zoho"` in it, for example `["buyer"]`.
  - After this PR, the column appears for them unasked. The list then calls the batched status read on every page view.
- **Failure scenario:**
  1. A finance user hid Buyer last month.
  2. After deploy they open Orders.
  3. A "Zoho" column they never chose is on screen, and `loadZohoMirrorCells` runs on every page.
- **Proof:** I added a scratch component test, then deleted it. It sets `localStorage["staff.columns.orders"] = '["buyer"]'`, renders `OrderList`, and expects no "Zoho" column header and no load call. It fails: `expected <th scope="col" …> to be null`.
  - The PR's own tests miss this because each one starts from `localStorage.clear()`, or from `"[]"` (`order-zoho-column.component.test.tsx:153`, `:174`).
- **Fix:** have `useColumnVisibility` remember which columns existed when the choice was saved.
  - Save `{ hidden: [...], known: [...allColumnIds] }`, and read the old array form as `known = <ids at the time>`.
  - A column not in `known` takes its default.
  - Add a staff-ui test, and an Orders test that starts from `'["buyer"]'`.
  - The same latent bug hits every `apps/web` list that later adds a default-hidden column, so fix it in staff-ui rather than with an Orders-only migration.
  - If you would rather keep this PR narrow, a one-off migration in `OrderList` also works: add `"zoho"` to a saved array that does not mention it. It needs a test, and a follow-up issue for the staff-ui fix.

## Should fix (not blocking)

### 2. The "own line on a phone" behaviour is not pinned by any test

- **Where:** `apps/shop-admin/src/components/zoho/zoho-mirror-column.client.tsx:79` (`mobile: "detail"`). The e2e check is at `apps/shop-admin/e2e/zoho-mirror-orders-column.spec.ts:129-135`.
- **Mutation:**
  - Changing `mobile: "detail"` to `mobile: "meta"` passes all five unit test files (43 tests).
  - The e2e check only asserts that the badge is visible somewhere inside the card's `li`. A meta-line placement would pass it too.
  - Removing `mobile` entirely also passes the unit tests. The e2e check would catch that one.
- **Failure scenario:** a later refactor folds the badge into the gathered meta line ("Unknown buyer · £125.00 · Mirrored to Zoho"), and nothing goes red. The design said "a line of its own".
- **Fix:**
  - In the e2e, assert that the badge's box sits below the order number's box and above the buyer/total line. Or assert it is inside the DataTable detail slot, if that slot has a hook.
  - Add a component test at a phone width that checks the detail slot.

### 3. The loading placeholder is untested

- **Where:** `zoho-mirror-column.client.tsx:82`.
- **Mutation:** dropping `|| cells.status === "loading"` survives. While loading, the cell then shows the "None" dash, which reads as "nothing to mirror" for a moment.
- **Fix:** in `order-zoho-column.component.test.tsx`, add a case with a loader that never settles. It should assert a skeleton is shown, not a "—".

## Notes (no change required)

- **Screenshot craft:** the Orders shots (`orders-column-*`) show the summary strip "Paid £0.00 ↓100% · Orders placed 0", while the list holds 5 paid orders.
  - Cause: the seed dates fixtures 30 days back (`apps/shop-api/src/infrastructure/seed/zoho-mirror-badge-seed.ts:239`), just outside "last 30 days".
  - This is not the PR's code, but it makes the gallery look broken.
  - Either date the fixtures 29 days back, or crop the shots to the table.
- **e2e coupling:** in `zoho-mirror-orders-column.spec.ts`, the second and third tests rely on the first having switched the column on (serial mode, same context). That works, but if the first test fails, the others fail for the wrong reason. Seeding `staff.columns.orders = "[]"` in their own setup would make them independent.

## Checked and fine

**Reuse of PR 2, with no duplicated logic**
- The record page reuses `ZohoMirrorBadge` (the shared staff-ui `StatusDetailsButton` underneath), `presentZohoMirror`, `loadZohoFailedJobsHref` and the `@auction/datetime` London formatting unchanged.
- `presentZohoMirror` is now built on the new `presentZohoMirrorCell`, so the list cell and the record badge share their label, tone and shape from one table.
- The only new copy is `ZOHO_MIRROR_COLUMN_HEADER` in `packages/shop-contracts/src/zoho-mirror-copy.ts`.

**Every state on both surfaces**
- Artwork record: Mirrored, Sending, Not in Zoho and Zoho dry run render as buttons with their details. Nothing to mirror, and a failed read, show no badge.
- A print with no Where it is chip still gets the badge.
- Orders column: each badge state renders, and an order with nothing to mirror, or a failed read, gets the table's "—".
- Confirmed in the unit tests, the CI e2e and the screenshots.

**Failed jobs gating (Q7, PRM-1)**
- Bid is asked about Failed jobs only when the state is `failed`.
- The mutation that asks for every state is killed by `page.test.tsx`.

**Bounded reads, no N+1**
- One server action call per page of ids. The ref guard means the table and phone layouts share it; the mutation that removes the guard is killed.
- The action caps ids at `ZOHO_MIRROR_BATCH_LIMIT` (100), the same as the largest page size.
- On the API, `ZohoMirrorStatusService.statuses` runs one ledger query (`DrizzleZohoMirrorLedgerReader.read`, a single `inArray` select). For orders it adds at most one `paidOf` query, made only for unsent orders.
- So the worst case is 2 SQL statements per page, whatever the row count.
- The artwork record runs one status read in parallel with the record (`Promise.all`); the mutation that makes it sequential is killed.
- The artwork key is the register id, which matches the ledger's `aggregate_type = 'artwork_register'`.

**Optional column**
- Hidden by default for a fresh browser, turned on from Display, and remembered per browser under `staff.columns.orders`. "Reset to default" restores it.
- See finding 1 for browsers that already had a saved choice.

**Accessibility**
- The column header is a real `<th scope="col">` named "Zoho".
- Cells hold a `StatusBadge` with text plus a distinct shape (✓, dot, !, ring), so colour is not the only cue.
- Axe runs with the column shown in light and dark.
- Display is driven by the keyboard in the e2e (Enter to open, Space to tick).

**Keyboard focus on the record badge**
- Enter opens the details, focus moves into the dialog, and Esc returns focus to the badge.
- On a phone the details open as a bottom sheet with a close target of at least 44 px.
- Covered by the unit tests and by the e2e for every state, light and dark.

**375 px**
- The CI e2e checks for no horizontal scroll on the list and on every record state.
- The screenshots show the badge wrapping under the title with Where it is, and the list badge on its own line.

**Light and dark**
- All 26 screenshots are 2x, both themes, at 1440 and 375.
- Kit tones read well in both themes. The popover and sheet are tidy, and the text is not clipped.

**e2e runs in CI and never skips**
- In the `browser-gates` job log for `44dddd38`, `seed:zoho-mirror-badge` runs, then `test:e2e:a11y` runs both specs.
- All 26 Zoho checks show ✓ (20 for the badge across order and artwork, light and dark; 6 for the Orders column). The step ends "98 passed" with no skipped count.
- `requireFixture` throws under `CI`, so a missing fixture fails the run instead of skipping.

**Tests fail without each behaviour**
- I ran 19 mutations against the five shop-admin unit test files. 16 were killed.
- Survivors: M6 (equivalent, so not a gap), M11/M18 (finding 2) and M19 (finding 3).
- The seed test passes (4 tests).

**Route-JS budgets and circular dependencies**
- No budget, baseline or allowance file is touched.
- `check-circular-deps`: ok (46 allowlisted cycles). Freeze check: ok (47/47).

**Commits, PR body, fixtures**
- Both commits are by `mahmoudamrspace <mahmoudamr.space@gmail.com>` and have no trailers.
- The PR body has no AI footer.
- The seed stays hermetic-only (`assertSeedTarget` plus the `hermetic` check), is insert-once, and uses made-up names.
