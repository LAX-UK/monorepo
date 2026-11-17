Verdict: SHIP

# Review: PR #1547, Bid admin Deliveries part 4 (link booked deliveries to their Lot fulfilment step)

Reviewed head `467ff459` (`bid-admin-deliveries-fulfilment-links`). I checked it against
`docs/design/staff-gaps-delivery-zoho-alerts.md` section 1: D2 (statuses and tabs), D4 (panel,
"Delivery section … with the existing Lot fulfilment actions linked, not duplicated", footer per
`PRD-2`), D5 (permissions) and D9 item 4 (this PR).

No blocking defects.

## What "link" means here

The PR adds navigation only. There is no new route, server action, table or migration. The step
itself (dialog, confirmation, API call) still happens only on Lot fulfilment, as D4 and D5 require.
So the "duplicate or orphan links on retries" risk doesn't apply to stored data. Clicking twice
navigates twice and writes nothing.

## Checked and correct

- **Which step to show.** This is a pure function,
  `apps/web/src/lib/admin/deliveries/deliveries.vm.ts:118` (`deliveryFulfilmentStep`):
  - It returns a step only in `to_dispatch` and `on_the_way`.
  - It returns a step only for fulfilment statuses `awaiting_release`, `released`,
    `ready_for_collection` and `in_transit`.
  - It returns null for no fulfilment, `awaiting_payment`, delivered, closed, waiting and quoted.
  - The labels (`deliveries-copy.ts:164`) match Lot fulfilment's own primary action for each status
    (`components/admin/lot-fulfilment/use-lot-fulfilment-actions.tsx:344-351`): Release lot, Ship lot,
    Mark delivered, Mark collected. So the link names the button the user will find when they land.
- **Every state is consistent with the status model.**
  - `awaitingPayment` is `to_dispatch && (fulfilment null || awaiting_payment)`
    (`packages/domain/src/delivery-status.ts:77`). That is exactly the case where the step is null.
    So the footer link and the Delivery note (`delivery-panel.tsx:315`, "Lot fulfilment opens the
    next step once the buyer has paid" against "… recorded on Lot fulfilment") can't contradict
    each other.
  - `on_the_way` is always `in_transit` for shipping (`drizzle-admin-deliveries.reader.ts:112`), so
    it always gets "Mark delivered".
  - A cancelled or refunded lot is closed, so it gets no step.
- **The link lands on the lot.**
  - `lotFulfilmentHref` (`deliveries.vm.ts:105`) is now `?q=<id>&lot=<id>`, URL-encoded.
  - When the needle is a uuid, Lot fulfilment's search matches the lot id exactly
    (`packages/persistence/src/repositories/drizzle-lot-fulfilment.repository.ts:24`). The page
    applies no default status filter, so the record is always listed and `lot=` opens its panel.
  - Screenshot `3-lot-fulfilment-landing-*` shows the lot as "1 of 1" with "Ship lot" as the primary
    action.
  - The panel's "Open full page" link and the plain row-menu link use the same href, so the bug
    where the old `?lot=` opened nothing on a busy queue is fixed everywhere.
- **Row menu (D3).**
  - The step comes first (`deliveries-list.tsx:201`, `:431`).
  - The plain "Open lot fulfilment" is dropped only when a step replaces it (`:204`). So unpaid
    bookings and other tabs keep the plain link, and no row has two links to the same place.
- **Panel footer (D4, PRD-2).**
  - The footer is a single primary `StaffButtonLink` (`delivery-panel.tsx:390`).
  - `quoteActionFor` and the "Can't deliver" secondary only apply in waiting and quoted, so the
    footer never has two primaries.
  - Delivered has no footer.
- **Permissions (D5, PRM-3, PRM-4).**
  - The step links, the plain link and "Open full page" all depend on `canWork`. The server works
    out `canWork` from `DELIVERIES_ACCESS` (`app/admin/(platform)/deliveries/page.tsx:41`). The page
    itself is gated on `DELIVERIES_READ_ACCESS`.
  - The landing page is still guarded by `requireAdminCapability(LOT_FULFILMENT_ACCESS)`, and every
    step's API route is still guarded by `operations.fulfilment`.
  - The link grants nothing. Read-only staff get no link and no footer, and a test covers this.
- **Staff-ui kit and themes.**
  - Only kit components are used (`StaffButtonLink`, `OverflowAction`, `ArrowRight` from
    `@auction/staff-ui/icons`), with token classes `text-staff-sm text-staff-muted`. No new colours.
  - I looked at the panel at 1440 light and 375 dark, the row menu at 375 light, and the landing at
    1440 dark. The footer stays in view at 375, the label fits, and the menu doesn't overflow.
  - All 20 screenshots (5 states × 1440/375 × light/dark) are committed under
    `docs/pr-evidence/bid-admin-deliveries-fulfilment/`.
- **E2E hygiene.**
  - `e2e/admin-deliveries-fulfilment.spec.ts` seeds its own sale, lots and bookings, and removes them
    in `afterAll` (`helpers/deliveries-seed.ts:110`).
  - `lot_fulfilment.lot_id` is `unique` with `on delete cascade`, so a re-run can't leave behind
    orphan or duplicate fulfilment rows.
  - It is tagged `@smoke @journey`, so the PR browser gate runs it.
- **Docs.** The D9 item 4 "As built" note (`staff-gaps-delivery-zoho-alerts.md:174`) matches the
  code.

## Not blocking

- **Read-only staff still see the Delivery note** (`delivery-panel.tsx:315`), which names Lot
  fulfilment. A reader with `DELIVERIES_READ_ACCESS` but not `LOT_FULFILMENT_ACCESS` can't open that
  page. The copy is still true; consider showing it only when `canWork`.
- **A `released` lot always offers "Ship lot on Lot fulfilment"**, even for a lot that will be
  collected after all. This mirrors Lot fulfilment's own primary action, and Lot fulfilment's menu
  also offers "Ready for collection", so the user still lands where both steps are. I'm noting it
  for completeness, not as a defect.

## Test evidence (this review)

- `apps/web`:
  - `vitest run src/components/admin/deliveries src/lib/admin/deliveries src/lib/actions/admin/admin-deliveries.test.ts src/components/admin/lot-fulfilment`:
    12 files, 167 tests passed.
  - `tsc --noEmit`: clean.
  - `biome check` on the changed sources and e2e files: clean.
- CI on `467ff459`: green (`ci-result` success, `browser-gates` success, all 8 web vitest shards).
- I didn't run the Playwright journey locally. CI's browser gate passed, and the PR reports 2 passed
  at 1440 and 375.
