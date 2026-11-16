Verdict: FIX FIRST

# Review of PR #1493 "Filters: crawlable filter links and follow-ups"

Head `f892ba74` on base `f1e70f47`. Checked against PR #997's description and the code on main, not
against this PR's description. There are no `review-notes-pr997*` branches and no review comments
on #997. `docs/design` has no filters design (only `staff-design-standard.md`, which covers staff
tables). So for canonical and noindex rules I used the repo's own documented rule,
`metadataForListing` in `apps/web/src/lib/seo/metadata-factory.ts:95-111`.

## Blocking

1. **The sales calendar rail still leaves most filter values out of the server HTML.**
   `SALES_FILTER_SIDEBAR_DEFAULT_OPEN` opens only `delivery`, `location` and `sort`
   (`apps/web/src/lib/marketing/sales-filter-sidebar-catalog.ts:15-19`). `AccordionContent` wraps
   Radix `AccordionPrimitive.Content` without `forceMount` (`packages/ui/src/components/ui/accordion.tsx:60-72`),
   so the Department, Month and Year rows are not rendered until JavaScript opens those groups.
   - Production build of this branch (`next start`, `/sales?tab=upcoming&view=list`, no JS, mock
     API with four sales and three departments): the HTML has 4 `role="checkbox"` rows (Auction
     type and Location) and 2 sort links. There are no `/sales?…category=`, `month=` or `year=`
     links, and "Paintings", "December" and "January" do not appear in the rail.
   - `renderToString(<SalesFilterSidebar …/>)` gives the same result: hrefs only for delivery,
     location and sort.
   - #997's goal and this PR's own title are "every filter value reachable and crawlable without
     JavaScript". On `/sales` that holds for 3 of the 6 link groups.
   - Fix: render the link groups' content closed but present, for example `forceMount` on
     `AccordionContent` with `data-[state=closed]:hidden`, or render the rows outside the
     collapsible region. Then make the test below cover it.

2. **The guarding test passes when Department, Month or Year rows are not links (mutation check).**
   The test is `apps/web/src/components/sections/sales/sales-filter-sidebar.test.tsx:80-94`. I
   replaced the rows of one group with a non-link `<span role="checkbox">` and ran the file:

   | Mutation | Result |
   | --- | --- |
   | Department rows not links | **5/5 pass** (survives) |
   | Month rows not links | **5/5 pass** (survives) |
   | Year rows not links | **5/5 pass** (survives) |
   | Auction type rows not links | 5/5 fail (caught) |
   | Location rows not links | 2 fail, including the SSR test (caught) |
   | Sort rows not links | SSR test fails (caught) |

   The SSR test only looks at rows that are in the HTML. Collapsed groups are absent, so the test
   passes without checking them. It should assert the expected set, for example one link per
   department, month and year option that has results, so it fails today and passes after fix 1.

3. **Filtered `/sales` addresses become crawlable but stay indexable.** `/sales` uses the static
   `salesBrowsePageMetadata` (`apps/web/src/app/(marketing)/sales/(index)/page.tsx:5`,
   `apps/web/src/lib/marketing/sales-browse-page.seo.ts:8-13`): canonical `/sales` and index on
   every query string. Before this PR the rail used `router.push`, so crawlers could not find these
   addresses. Now they are plain hrefs: tab × auction type × location × department × month × year ×
   sort × view. The repo's rule for faceted listings is `metadataForListing` with
   `noIndex: <filtered>` (`metadata-factory.ts:95`; used by `/search` at
   `apps/web/src/app/(marketing)/search/page.tsx:84` and by `/press`). Use the same rule for
   `/sales` (`noindex, follow` when any filter or sort param is set), with a test, before these
   links ship.

4. **The PR says styling is unchanged and has no screenshots, but the sales rail changes visually.**
   I built main (`f1e70f47`) and this branch, served both against the same mock API, and took
   1440 and 375 screenshots in light and dark. The rail pixel diff is confined to the changed rows:
   - **Sort radios restyled** in both themes and at both widths. On main the unselected border is
     `border-input`, with a filled `dark:bg-input/30` circle in dark mode. The PR uses a
     `border-primary` outline, no dark fill and a larger dot (`marketing-filter-link-row.tsx:26-27,86-91`
     against `packages/ui/src/components/ui/radio-group.tsx:33-34`). The 375 diff is only these
     two radios (x 24–39, y 875–922).
   - **Zero-count rows** dim the whole row at `opacity-60`, where main dimmed the checkbox at
     `opacity-50` and the label at `opacity-60`. The change is slight.
   - **New loading/transition behaviour on the sales rail.** The link row's `RowBody`
     (`marketing-filter-link-row.tsx:33-46`) dims the row (`opacity-60`, `transition-opacity`) and
     sets `aria-busy` while the navigation is pending (`useLinkStatus`). The old
     `MarketingFilterCheckboxRow` and `router.push` path had no pending state. The PR says "No
     hover, press, transition or loading code touched". No code was touched, but adopting the row
     brings this behaviour to `/sales`, which the review brief rules out for this PR.
   - Either keep the rail's look and behaviour, or state the change and attach 1440/375
     light/dark before-and-after screenshots for design sign-off. The radio change does bring the
     rail in line with the artist directory and Shop sort rows. That may be the right outcome, but
     it has to be stated and reviewed.

## Non-blocking

- **The sort radios lose their radio semantics.** On main, sort was a Radix `RadioGroup`
  (`role="radiogroup"`, `role="radio"`, `aria-checked`). Now it is plain links in
  `<nav aria-label="Sort by date">` with `aria-current` on the chosen one
  (`sales-filter-group-contents.tsx:142-154`, `marketing-filter-link-row.tsx:112,133`). The row
  documents this as deliberate, and Shop and the directory already work this way. Still, the PR's
  "radio semantics unchanged" is not accurate. It also adds a `navigation` landmark per sort group
  (rail and sheet). Shop uses `<fieldset>` + `<legend>` (`artwork-catalogue-filter-body.tsx:92-93`),
  which keeps the landmark list clean. Use the same here.
- **The accessible names have a stray space**: "Online , 4" (the tests assert that string,
  `sales-filter-sidebar.test.tsx:60`). #997 specifies "Paintings, 12". The cause is in the shared
  row (`marketing-filter-link-row.tsx:94-103`). This predates the PR.
- **The mobile sheet copy is wrong for these rows.** It says "Refine catalogue results. Changes
  apply when you confirm." and has "Show N sales", but the rows navigate at once and close the sheet
  (`sales-calendar-filter-sheet.tsx:61`). This predates the PR (`router.push` also applied at
  once), but now that rows are links it is worth fixing the copy.
- **`link2` duplicates `link`** (`sales-filter-group-contents.tsx:74` vs `:95`). Pass the same
  `onClick` spread to both.
- **The `/** @vitest-environment jsdom */` docblock moved below the imports**
  (`apps/shop/src/components/catalogue/artwork-catalogue-filter-body.test.tsx:5`), likely from
  import sorting. Vitest still honours it (the suite passes and `DOMParser` is available), but put
  it back on line 1 to match the other test files.
- **The Shop and sales SSR tests skip `aria-disabled` rows.** A regression that marks rows with
  results as unavailable (`unavailable = !checked`) is caught in Shop only by the older tests, not
  by the new SSR test. Asserting the expected count of links would catch it directly.
- **Shop's "Available only" control is a `Switch` that calls `onNavigate`**
  (`artwork-catalogue-filter-body.tsx:43-50`), not a link, so that filter is not reachable without
  JavaScript. It is outside #997's scope, so this is only a note.

## Verified

- **What #997 left open.** #997's only "Follow-up" is "Move LAX Shop's pressed-button rail onto the
  shared rows". It is done on main: `apps/shop/src/components/catalogue/artwork-catalogue-filter-body.tsx:91-125`
  uses `MarketingFilterLinkRow` (checkbox rows with counts, radio links for sort). #997 does not list
  saleroom toolbar-chip counts as open. It shipped counts in the lot-status sheet only, counted when
  the page holds the whole catalogue (`apps/web/src/lib/marketing/load-saleroom-detail-page.ts:115-116`).
  The PR correctly makes no saleroom change.
- **The Shop rail renders real links in server HTML.** All of its groups are open by default
  (`apps/shop/src/lib/catalogue/artwork-catalogue-filter-config.ts:15-20`), so the rows are in the
  HTML. Mutations caught: facet rows not links (4 tests fail), sort rows not links (1 fails).
- **LAX Bid artist directory (`MarketingFilterLinkGroups`) renders real links.** Mutations caught:
  sort rows not links (2 fail, including the new SSR test). If the shared row never renders `<a>`,
  5/6 marketing-ui tests, 5/7 Shop tests and 3/5 web tests fail.
- **lax.art** drawer and toolbar use Draft-and-Apply option lists, as #997 designed ("counts update
  after Apply"). They are not link rows, so no server-HTML link check applies. The art suite passes.
- **Counts match results.** With the mock data (4 upcoming sales: 2 online, 2 in London; Paintings
  3, Watches 1, Prints 0; November 1, December 3), the production page shows exactly these counts.
  Zero-count options (Prints, empty months) are dimmed with no href and `aria-disabled`. An applied
  option stays linked to its "off" address (unit test
  `sales-filter-sidebar.test.tsx` "takes an applied option off…").
- **Accessibility.** Checkbox rows keep `role="checkbox"` and `aria-checked`, answer Space
  (`chooseWithSpace`), take a row-wide `FOCUS_RING`, and include the count in the accessible name.
  Unavailable rows are not in the tab order (same as the disabled checkbox before). The rail's
  result count is `aria-live="polite"` (`sales-filter-sidebar.tsx:65`).
- **Route JS: no growth from this PR.**
  - CI build table, PR run 43823476786, compared with main's latest CI build that has a table:
    run 43819811178 on `f1e70f47`, the PR's exact base. Main's newer `8ed75236` (#1492, docs only)
    built nothing; the budget step reported "no production build; skipped".
  - Sales list: **442.9 → 439.1 KB** (page 105.6 → 101.8 KB). `/sales` First Load: 373 → 369 kB.
  - The other ±0.1 KB differences (for example web account 545.3 → 545.4) are build noise. Two
    main builds around a test-only change (#1491) differ on 53 web routes the same way.
  - Local same-machine builds of base and PR, `check-route-js-budget.mjs --all`, 196 routes: 96
    same, 99 smaller, 1 larger. The larger one is `/sell/private-sales` at +0.1 KB. I diffed its
    chunks module by module: the only differences are the per-build random server-action IDs and
    Sentry debug IDs (plus the module id derived from them). No module this PR changed is in that
    route.
- **Tests.**
  - `apps/shop`: 703 passed.
  - `apps/art`: 798 passed.
  - `packages/marketing-ui`: 705 passed.
  - `apps/web`: 9928 passed, 10 skipped (1523 files).
  - CI: all 41 check runs on `f892ba74` succeeded, including build, browser-gates,
    art-browser-gates and web vitest 1–8.
- **Scope.** 6 files changed. No CSS or token edits, no dependency changes, and the
  `@auction/marketing-ui/marketing-filter-link-row` export was added to `package.json`. No motion
  files were edited, but see blocking item 4 for the behaviour the shared row brings.
