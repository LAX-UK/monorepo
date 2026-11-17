Verdict: SHIP

Independent review of PR #1517 "Bid admin Deliveries: read API and list page" (head `f0543607`) against `docs/design/staff-gaps-delivery-zoho-alerts.md` GAP-47 D1–D9 and `docs/design/mockups/staff-gaps/` on `origin/main` (`e1853412`).

## Verified good

- No migration, and no changes to route JS budgets, visual baselines or allowances (`git diff --stat` has no migration, budget, baseline or snapshot paths). `/admin/deliveries` builds at 16 kB / 346 kB first-load JS.
- CI: all 41 check runs on the head SHA pass (`art-browser-gates` skipped). Commits carry no AI trailers, and the PR body has no AI footer.
- Server-side permissions: `/deliveries` and `/deliveries/*` are guarded by `requireDeliveriesRead`. The PUT quote route keeps `requireOperationsFulfilment` before the new `guards.idempotent("fulfilment.delivery-quote")`.
- Every read is paged (`limit` ≤ 100, `offset` ≤ 100 000), `q` is capped at 120 characters, and the schema is `.strict()`. A page needs a fixed number of queries (rows, total, grouped counts, sales). The paddle is a correlated subquery per row, so there is no N+1 from the app. `Cache-Control: no-store` is set on all three routes.
- I reverted each behaviour and re-ran the tests; these mutations failed them:
  - Removing the idempotency guard: 3 of 4 tests failed.
  - Guarding the routes with write-only access: 2 of 18 failed.
  - Dropping the `/deliveries/*` guard: 7 of 18 failed.
  - Removing the domain `in_transit` rule: 1 of 6 failed.
  - Changing the `awaitingPayment` rule: 1 of 6 failed.
  - Removing `no-store`: 2 of 18 failed.
  - Showing the list as full access to read-only staff: 1 failed.
  - Removing the panel's `ViewOnlyBadge`: 1 failed.
  - Showing tab counts as 0 on error: 1 failed.
- On the PR branch itself, domain (6), validators (3), api (28) and web deliveries (48 + 12) tests all pass.

## Findings

1. **Scope is not D9's first PR.** D9 PR 1 is "Read model and API … idempotency key on the quote route; contract tests. No UI." This PR also ships the page, nav item, panel and 56 screenshots (≈2,000 of its 3,809 lines). The PR body says so itself ("D9 PR 1 in full, plus the read-only part of D9 PR 2").
   - **Fix:** split the PR. Keep `packages/*`, `apps/api/*` and the quote-route idempotency here. Move `apps/web/**`, `apps/web/e2e/admin-deliveries.spec.ts` and `docs/pr-evidence/bid-admin-deliveries/**` into PR 2. PR 2 should also add Send quote / Change quote and the `admin-pages-visual.spec.ts` baseline that D9 puts there. If the owner explicitly accepts the merged scope instead, record that in the design doc's D9.

2. **D2 "On the way" ignores the fulfilment method.** `packages/domain/src/delivery-status.ts:75` and `packages/persistence/src/repositories/drizzle-admin-deliveries.reader.ts:58` map any `in_transit` to `on_the_way`. D2 says "fulfilment `in_transit`, method `shipping`".
   - Line 74 (SQL line 57) also maps `delivered` with method `collection` to "Delivered". The buyer's page (`purchase-delivery-stage.ts` `MOVED.delivered`) calls that "collected". So a buyer who asked for a quote and then collected in person shows as Delivered on the staff list, while their request is never closed.
   - The "all 32 combinations" integration test never varies `method`, so this is untested.
   - **Fix:**
     - In the domain function and the SQL `CASE`, require `method = 'shipping'` (or null) for `on_the_way` and `delivered`.
     - Treat `delivered` + `collection` as `closed` with a new `closedReason: "collected"`, and add that label to the status map.
     - Add `method` to the combination matrix in `drizzle-admin-deliveries.reader.integration.test.ts` and `delivery-status.test.ts`.

3. **D2 ignores invoice refund and cancellation.** The buyer page's `purchaseDeliveryStage` returns `cancelled` when the invoice is `refunded` or `cancelled`. `deliveryStatusOf` (`delivery-status.ts:73`) only knows `lot_fulfilment.status = 'cancelled'`. A refunded purchase with an accepted quote and an `awaiting_payment` fulfilment (or no fulfilment row) shows as "Booked, not dispatched · Awaiting payment" on the staff list, but as "Cancelled" to the buyer.
   - **Fix:** either confirm, with a test, that every refund or cancellation path sets `lot_fulfilment.status = 'cancelled'`, or join the invoice state in the reader and add it to `DeliveryStatusFacts`, as `purchaseDeliveryStage` does.

4. **The D6 "changed while open" and "not found" states are missing.**
   - `apps/web/src/components/admin/deliveries/delivery-panel.tsx:48-54` renders an empty panel titled "Delivery" with a `null` body when `?record=` points at a lot that 404s or was withdrawn while the panel was open.
   - `DELIVERIES_COPY.panel.notFound` (`deliveries-copy.ts:123`) is defined and never used.
   - No screenshot or test covers a row that changes state while it is open. The PR claims every D6 state.
   - **Fix:**
     - Render a kit `Notice` with `panel.notFound` and a "Back to the list" action when `row` is null but `filters.record` is set.
     - After `router.refresh()`, show the D6 stale Notice ("The buyer changed this request…") when the open row's `status` or `quote.status` differs from what was first shown.
     - Add a test for each in `delivery-panel.test.tsx` and a `15-not-found` screenshot.

5. **The Playwright e2e has never run, and it can skip silently.**
   - `e2e-pr.yml` only runs `@smoke|@roles|@public-a11y`, so `@journey` did not run on this PR (the body admits it was not run locally either).
   - `apps/web/e2e/admin-deliveries.spec.ts:80` and `:95` `test.skip` when `DATABASE_URL` is missing or the seed has fewer than two won lots, so a green run can prove nothing.
   - The step "an empty one says so" (`:143-148`) only asserts no-results; it never reaches the empty state.
   - It never asserts that focus returns to the row after Escape, or that the panel title takes focus. Both are design a11y requirements.
   - **Fix:**
     - Run the spec once in `e2e-stabilization` (or locally against the seeded stack) and attach the run link and screenshots to the PR.
     - Seed the two won lots in the fixture instead of skipping.
     - Assert the empty state with `view=on_the_way&q=<TAG>` and the text "No deliveries on the way".
     - Add `await expect(grid.getByRole("row").nth(1)).toBeFocused()` (or the row link) after Escape, and `toBeFocused()` on the panel heading after opening.
     - Prove the spec fails with the page reverted.

6. **The 1440 panel does not match the approved mockup or D3.** In `02-waiting-panel-1440-light.png` the panel is a ~665 px modal over a dimmed list, and it hides the Status, Price and Waiting columns. In the mockup it is a 480 px side panel beside a list that stays usable. D3 also says the sale shares the Lot cell precisely "so the price and waiting columns stay in view beside the 480 px panel".
   - The mockup's header meta also puts buyer and paddle on one line. The PR wraps "Paddle 118" under the buyer.
   - **Fix:** open `DetailPanel` in the kit's non-modal side mode at the 480 px queue width (as other `useStaffQueue` pages do, e.g. Purchase problems), or show that the kit cannot and record the deviation in the "Where this differs" section. Then re-shoot 02, 04, 06 and 10.

7. **The PR body screenshot tables are broken.** Many cells are escaped as text instead of images, for example:

   ``&lt;img src="`` https://…/02-waiting-panel-1440-light.png" `` width="220">``

   This affects the "This PR" 1440 light and dark cells, and states 02, 04, 05, 06, 10 and 12, plus the dark samples. So the side-by-side comparison with the mockup does not render for the panel states.
   - **Fix:** replace each ``&lt;img src="`…` https://…" `…` `` with a plain `<img src="https://…" width="…">` tag.

8. **Copy is outside the copy file, and some copy is dead.**
   - Badge labels are hard-coded in `apps/web/src/lib/admin/deliveries/deliveries.vm.ts:127-134`.
   - Other strings in the same file: `"Lot "` (`:147`), `"Paddle "` (`:157`), `" of "` (`:196`, `:266`), and the `delivery`/`deliveries` nouns (`:195`).
   - Unused keys: `panel.notFound`, `panel.openFulfilment`, `panel.activity` and `waitingCountLabel` in `deliveries-copy.ts`.
   - **Fix:** move every label and template into `DELIVERIES_COPY` (e.g. `badges`, `lotTitle(n, title)`, `paddle(n)`, `quotedOf(price)`, `range(...)`). Use or delete the unused keys; `waitingCountLabel` belongs with finding 9.

9. **The nav count is not announced as the design says.** D2 and NAV-3 ask for ", 3 waiting" for screen readers. `staff-nav.ts` uses the generic `navBadge(navCounts.deliveriesWaiting, "warning")`, and `waitingCountLabel` is never wired in. The Waiting tab's count has the same gap.
   - **Fix:** pass an accessible label (whatever field the kit's nav item and `DataViews` view take for this, as the Inbox count does) using `DELIVERIES_COPY.waitingCountLabel(count)`. Assert it in `staff-nav.deliveries.test.ts` and `deliveries-list.test.tsx`.

10. **Access is wider than D5's literal wording; the owner should confirm it.** D5 says the page "is hidden from roles without `LOT_FULFILMENT_ACCESS` (PRM-1)", and that View only applies to "roles that can read Lot fulfilment but not write". `DELIVERIES_READ_ACCESS = readOrWrite(...)` (`packages/types/src/admin-access.ts:188`) also admits `admin.read`, i.e. the `read_only` role. That role cannot open Lot fulfilment today (`GET /admin/lot-fulfilment` requires `operations.fulfilment`), and it now sees buyers' full delivery addresses. This matches the Collections precedent and the task brief's "others view-only", so it is not a blocker.
    - **Fix:** get an explicit owner yes, and note it in D5. Otherwise use `DELIVERIES_ACCESS` for the read routes, nav, layout and page.
    - Also: changing the guard in `apps/web/src/app/admin/(platform)/deliveries/layout.tsx` from `DELIVERIES_READ_ACCESS` to `DELIVERIES_ACCESS` passed all 394 `app/admin` and `lib/navigation` tests, so the layout guard is untested. Add a test that `read_only` passes it and `finance` is redirected.

11. **`updatedAt` is used as the event time.**
    - `drizzle-admin-deliveries.reader.ts:69-70` (`statusSince`) and `apps/api/src/services/deliveries/admin-deliveries.service.ts:34` (Activity "Handed to the courier" / "Delivered") use `lot_fulfilment.updated_at`. Any later edit (a tracking-number fix, a note) moves the dispatch time and reorders the On the way and Delivered views.
    - Also, `history.cancelled` says "Sale cancelled" (`deliveries-copy.ts:133`) when it is the purchase that was cancelled.
    - **Fix:** use the fulfilment's own status timestamps where they exist (e.g. `dispatched_at` / `delivered_at`, or the last status-change audit row). Otherwise label the time "Last updated". Change the copy to "Purchase cancelled".

12. **Two unbounded or wasteful reads on hot paths.**
    - `sales()` (`drizzle-admin-deliveries.reader.ts:251-258`) returns every sale that has ever had a quote, with no limit, on every list request.
    - `summary()` (`admin-deliveries.service.ts:111-114`) runs the full six-way grouped count, a `DISTINCT ON` over all of `delivery_quote`, on every staff page render through the admin layout, just to read `waiting`.
    - **Fix:**
      - Limit `sales()` to sales that have a quote in the last N months (or that match the current view), with a `limit`.
      - Give the reader a `waitingCount()` that counts `status = 'requested'` quotes left-joined to a non-moved fulfilment, using the existing `delivery_quote_requested_idx`.

## Notes (no change needed)

- The status map is kept local rather than registered in `staffStatus` (a CRF-7 deviation), the Country filter is missing, and paging uses offset, not a cursor. All three are disclosed in the PR body with reasons; the owner should acknowledge them when approving PR 2.
- I did not run the persistence integration test or the e2e here: no Postgres or seeded stack in this environment. I checked the 1440 light panel, the 375 light list and the 1440 dark error screenshots against the mockup; the other states were reviewed from the PR body and README only.

## Final recheck

Head `79bdce9f` (8 commits), base `origin/main` `e1853412`, checked 2026-11-17. The verdict above is now **SHIP**. Findings 1, 2, 3, 10, 11 and 12 are fixed on #1517. Findings 4–9 were about the web page, which is no longer in this PR, so they carry over to D9 PR 2.

### Evidence

- **Scope is exactly D9 PR 1 (finding 1).** `git diff --stat origin/main...79bdce9f` lists 30 files, all under `packages/{domain,persistence,types,validators}` and `apps/api`. That covers the read model, `GET /admin/deliveries`, `/summary` and `/:lotId`, the idempotency key on the quote route, and contract tests. Nothing under `apps/web`, no e2e, no screenshots, no `.png`. Commit `ee7bfc86` removes 82 files (2,240 lines), including the web route-table entry in `packages/types/src/admin-routes.ts`.
- **D2 "On the way" checks the method (finding 2).**
  - Domain, `delivery-status.ts`: `in_transit` with method `collection` falls back to the quote status. `delivered` with method `collection` goes through `purchaseDeliveryStage` → `collected` → `closed`/`collected`.
  - SQL `CASE`: the same rule (`IS DISTINCT FROM 'collection'`, and `delivered` + `collection` → `closed`).
  - The integration matrix now varies the method and the invoice.
- **A refunded or cancelled invoice gives cancelled, through the buyer page's logic (finding 3).**
  - `deliveryStatusOf` calls `purchaseDeliveryStage`. That function now uses the new shared `purchaseInvoiceEnded`.
  - The reader builds the invoice with `purchaseInvoiceState`. It picks the payment row with `invoicePaymentOrder()`, now shared with `DrizzleAccountPurchaseFactsReader`, and works out `saleCancelled` the same way as `purchase-view.ts:128`.
  - In the SQL, `refunded` and fulfilment `cancelled` both give closed. Those are the only two ways the invoice can be `refunded` or `cancelled`, so the SQL matches the domain.
- **Access follows D5 word for word and is enforced on the server (finding 10).**
  - `DELIVERIES_READ_ACCESS = LOT_FULFILMENT_ACCESS`, not `readOrWrite`. `read_only` is refused.
  - `platform.use("/deliveries")` and `platform.use("/deliveries/*")` both run `requireDeliveriesRead`.
  - The PUT quote route keeps `requireOperationsFulfilment` before `guards.idempotent("fulfilment.delivery-quote")`.
- **Real event times, not `updated_at` (finding 11).** `statusSinceSql` returns `NULL` for dispatch, delivery and cancellation, and `collected_at` for a collection. The order key coalesces only the quote's stamps. `updated_at` appears nowhere in the reader.
- **Reads are bounded (finding 12).**
  - `sales()` has `requestedAt >= since` (365 days) and `.limit(100)`.
  - `summary()` calls `waitingCount()` (only `status = 'requested'` quotes), not the grouped count.
  - List and count are paged, as before.
- **Each fix has a test that fails without it.** I reverted each fix on a local copy of the head, with Postgres 16 and all migrations applied:

  | Reverted | Result |
  | --- | --- |
  | Domain method guard | domain: 1 of 9 failed |
  | SQL method guard | integration: 1 of 10 failed |
  | Domain collected → delivered | domain: 2 failed |
  | SQL collected branch | integration: 2 failed |
  | Domain refund ignored | domain: 2 failed |
  | SQL refund ignored | integration: 2 failed |
  | `updated_at` used as the dispatch time | integration: 1 failed |
  | Sales window removed | integration: 1 failed |
  | Sales limit removed | integration: 1 failed |
  | Summary back on the grouped count | service: 1 of 9 failed |
  | Idempotency guard removed | quote route: 3 of 4 failed |
  | `readOrWrite` read access | types: 1 of 66 failed; deliveries routes (types package rebuilt): 2 of 19 failed |

  Unchanged, the head passes all of these: domain (17), validators (3), api deliveries and quote route (32), deliveries routes (19), types (66) and the persistence integration test (10, including the 352-lot matrix).
- **Other checks:**
  - No migration, and no `drizzle/`, budget, baseline, snapshot or allowance paths in the diff.
  - Route JS has not grown: there are no `apps/web` changes at all.
- **CI:** 41 check runs on `79bdce9f`. 39 succeeded and 2 were skipped as not applicable (`browser-gates`, `art-browser-gates`). `ci-result` succeeded. Mergeable state: clean.
- **No AI footer:** no `Co-Authored-By`, Claude or "Generated with" lines in any commit message or in the PR body.

### The removed UI was not preserved

The PR body says the page is in a draft PR, "Bid admin Deliveries: list page and queue panel", based on this branch. **That PR does not exist.** No remote branch other than `feat/bid-admin-deliveries-read` mentions deliveries (`git ls-remote`), and no open or closed PR has that title (the latest PRs are #1519, #1518, #1516…).

The UI work survives only in this branch's history:

- **`29ad55daca40e751f56771e04215fbd85470b8f0`**: the merge of `origin/main` and the direct parent of the removal commit `ee7bfc86`. It holds the full page, nav item, queue panel, e2e spec and `docs/pr-evidence/bid-admin-deliveries/**` on top of current main. Rebuild PR 2 from it, for example with `git checkout 29ad55da -- apps/web docs/pr-evidence/bid-admin-deliveries packages/types/src/admin-routes.ts` on a branch off #1517. Then apply findings 4–9.
- The same UI work before the merge is `f0543607`. The UI commits are `e9b812d1`, `5a7c0622` and `f0543607`.
- Warning: a squash merge of #1517 drops these commits from main. If the branch is then deleted, only `refs/pull/1517/head` keeps them reachable. Push a branch at `29ad55da` before deleting `feat/bid-admin-deliveries-read`.

This does not block #1517. But the PR body's claim about the draft PR is false and should be corrected.

### Minor notes (not blockers)

- The "On the way" status also covers fulfilments with no method recorded (`method IS NULL`). The PR body says so.
- With `in_transit` + `collection` (rare), staff see the quote status while the buyer sees "in transit". This follows D2.
- `saleCancelled: fulfilment?.status === "cancelled"` is repeated in `toRecord` and `purchase-view.ts:128`. A shared helper would keep the two pages from drifting.
