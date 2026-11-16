Verdict: SHIP

# Final recheck of PR #1493 "Filters: crawlable filter links and follow-ups"

Head `22462b8e`. Checked as the PR merged locally with current main `46c9bdac` (#1486, motion
hover/press), which merges cleanly. #1486 does not touch the checkbox, radio, label or filter
rows. Its only change in `packages/ui/src/components/ui/accordion.tsx` drops `transition-all` from
the trigger. Earlier review: `096d52fd` on this branch (FIX FIRST, 4 blocking). All four blocking
items are now fixed.

Method: production `next build` of main and of the PR in two checkouts, both with CI's placeholder
Sentry DSNs, served with `next start` against the same mock API. The mock has 4 upcoming sales
(2 online, 2 in London), departments Paintings 3, Watches 1 and Prints 0, and sales in November (1)
and December (3) 2026. I fetched the HTML with curl (no JS), took Playwright screenshots and
accessibility snapshots, and ran the unit suites and mutations locally.

## Blocking

None.

## Non-blocking

- **Keyboard behaviour differs from main's Radix controls, as the PR says.** The focus ring now
  covers the whole row (`FOCUS_RING` on the link,
  `apps/web/src/components/sections/sales/sales-filter-link-row.tsx:57`), not just the 16px box.
  Enter now follows a row's link. Each sort option is its own tab stop with no arrow-key movement,
  where main had a roving `radiogroup`. This is what a link row does, and it matches the artist
  directory and Shop. The PR body states it ("they read as links, not radios"). The resting look
  is pixel-identical (see Verified).
- **Collapsed groups now stay mounted, Price included.** `forceMount`
  (`sales-filter-sidebar.tsx:88-89`) also keeps `SalesPriceSlider` mounted while Price is closed.
  Two effects follow. Its Apply link
  (`/sales?tab=upcoming&minPrice=0&maxPrice=50000&view=list`) is now in the server HTML. That
  address is noindexed by the new metadata, so it does no harm. And a dragged-but-unapplied range
  now survives closing and reopening Price, where on main it reset. Both are fine. Mentioned only
  for completeness.
- **Intermittent hydration error #418 on `/sales`. It predates this PR.** It came up in 1 of 32
  production page loads on this PR (8 viewport/theme/filter combinations × 4) and in 1 of 32 on
  main, on different combinations each time. It is not caused by this change. It may be worth a
  separate ticket (likely a time-dependent string in the sale cards).
- **PR body detail.** The mutation table says "Department rows not links: 2 tests fail". With my
  mutant (a `span role="checkbox"` carrying the same accessible name) exactly 1 test fails: the SSR
  test. The count depends on the mutant, and the mutation is caught either way.

## Verified

### 1. Every sales-rail value is a real `<a href>` in server HTML, collapsed groups included

- Code: `AccordionContent forceMount hidden={!openSections.includes(g.value)}`
  (`apps/web/src/components/sections/sales/sales-filter-sidebar.tsx:87-90`). Radix
  `CollapsibleContentImpl` renders its children whenever `forceMount` is set, and spreads
  `contentProps` after its own `hidden: !isOpen`
  (`node_modules/@radix-ui/react-collapsible/dist/index.mjs:122-133`). So the PR's `hidden` prop
  decides visibility, which is why it is needed.
- **Production build of the PR, curl with no JS**, `/sales?tab=upcoming&view=list`. The rail holds
  real anchors for every option with results:
  - Auction type: `delivery=online` and `delivery=onsite`.
  - Location: `location=online` and `location=london`.
  - Sort: the default (no param) and `sort=createdDesc`.
  - **Department: `categoryId=cat-1` ("Paintings, 3") and `categoryId=cat-2` ("Watches, 1").**
  - **Month: `month=11` ("November, 1") and `month=12` ("December, 3").**
  - **Year: `year=2026` ("2026, 4").**
  - The only options without an address are those with 0 results: Prints and January–October,
    each a `span role="checkbox" aria-disabled="true"`.
  - The 4 closed groups (Price, Department, Month, Year) carry `hidden=""`.
- **Main's production build, same request:** 2 `href="/sales?` in the whole page, and no
  `categoryId`, `month` or `year` links.
- **Hidden from the accessibility tree while collapsed.** Playwright `ariaSnapshot()` of the
  "Filters" region on the PR build:
  - With groups closed: Department, Month and Year appear only as their collapsed buttons, with no
    rows.
  - After opening them: every row, including "Prints, 0" `[disabled]`, the 12 months and
    "2026, 4".
  - The mobile sheet behaves the same.
  - Unit test: `sales-filter-sidebar.test.tsx:109-116`.

### 2. The SSR test fails for the reviewer's mutations (run here)

The test is `apps/web/src/components/sections/sales/sales-filter-sidebar.test.tsx:80-107`. It
asserts the exact name and href of every option with results, 13 rows with no address, and the
two sort links. For each mutation I replaced that group's `FilterCheckbox` with a non-link
`span role="checkbox"` carrying the same accessible name, or made the change shown:

| Mutation | Result |
| --- | --- |
| Department rows not links | 1 fails (SSR test), caught |
| Month rows not links | 1 fails, caught |
| Year rows not links | 1 fails, caught |
| Auction type rows not links | 4 fail, caught |
| Location rows not links | 1 fails, caught |
| `forceMount` removed | 2 fail, caught |
| `hidden` removed | 1 fails (a11y test), caught |
| `unavailable = !checked` in `SalesFilterLinkRow` | 2 fail, caught |
| sort `fieldset` → `div` | 2 fail, caught |

The tree was restored after each mutation (`git status` clean).

### 3. Filtered `/sales` is `noindex, follow` with canonical `/sales` via `metadataForListing`, with a test

- Code:
  - `generateMetadata` is at `apps/web/src/app/(marketing)/sales/(index)/page.tsx:10-12`.
  - `salesBrowsePageMetadata(sp)` passes `noIndex: hasFacetParam(sp)` to `metadataForListing`
    (`apps/web/src/lib/marketing/sales-browse-page.seo.ts:9-41`).
  - The param list (`categoryId`, `delivery`, `location`, `sort`, `month`, `year`, `minPrice`,
    `maxPrice`) is every filter or sort param that `calendarSalesHrefFromState` writes
    (`sales-calendar-params.ts:191-207`). `tab`, `view` and `page` are rightly left out.
- Test: `apps/web/src/lib/marketing/sales-browse-page.seo.test.ts` has 10 tests: each param, the
  unfiltered page, tab, view, page 2 and an empty param.
- **Production build** (runtime `NEXT_PUBLIC_FORCE_INDEXING=visible`,
  `NEXT_PUBLIC_SITE_URL=https://www.example.test`):
  - `/sales?tab=upcoming&view=list` and `…&page=2`: `index, follow`, canonical `/sales`.
  - `…&categoryId=cat-1`, `…&sort=createdDesc` and `…&month=12`: `noindex, follow`, canonical
    `/sales`.
  - Main serves `index, follow` for `…&categoryId=cat-1`. That is the gap the PR closes.
- The unfiltered `/sales` `<head>` (28 meta/link/title tags) is byte-identical between main and
  the PR.

### 4. The sales rail looks and behaves as on main

- **1440 rail**, with Department, Month and Year opened so every row style shows: light, dark,
  light with filters applied (`&delivery=online&sort=createdDesc`) and dark applied. **0 pixels
  differ in all four** (288×934 element screenshots, main vs PR). That covers the sort radios
  (unselected and selected), checked and unchecked boxes, and zero-count dimming (box at 0.5,
  label at 0.7, as main renders through the Label's `peer-disabled:opacity-70`;
  `sales-filter-link-row.tsx:64,81`).
- **375 sheet**, in all four cases:
  - The header is pixel-identical.
  - The description is now the one-line "Choosing an option shows its sales straight away." where
    main had two lines, "Refine catalogue results. Changes apply when you confirm."
  - Below it, with the 20px offset, rows and footer differ only by 847–960 pixels in a 12px band
    at the bottom edge of the scroll viewport: one more row shows because of the shorter copy.
  - The footer is pixel-identical.
- **No new pending, `aria-busy` or transition.** `SalesFilterLinkRow` has none
  (`sales-filter-link-row.tsx:44-124`). After hydration the page has 0 `[aria-busy]` elements,
  and there is no `aria-busy` in the rail's server HTML. The `aria-busy` in the page HTML is the
  existing route loading skeleton, also on main.
- The classes are drawn from main's components: `CHECKBOX_BOX`, `RADIO_BOX` and `LABEL`
  (`sales-filter-link-row.tsx:28-36`) against `packages/ui/src/components/ui/checkbox.tsx:14-15`,
  `radio-group.tsx:33-34,43-46` and `marketing-filter-checkbox-row.tsx:39-52` on main.
- No e2e spec targets the old sales radios or checkboxes (searched `apps/web/e2e`).

### 5. Follow-ups from the first review

- **Sort uses a fieldset with a legend, not a nav.** `<fieldset>` with
  `<legend className="sr-only">Sort by date</legend>` (`sales-filter-group-contents.tsx:140-152`).
  In the server HTML: 1 fieldset and 0 `<nav>` in the rail. The accessibility snapshot shows
  `group "Sort by date"` with two links, `aria-current` on the chosen one
  (`sales-filter-link-row.tsx:116`). Unit test: `sales-filter-sidebar.test.tsx:118-127`.
- **Accessible names are one string.** They read "Paintings, 3", "Online, 2" and so on.
  - Sales row: `sales-filter-link-row.tsx:56,103,117`.
  - Shared row: `packages/marketing-ui/src/marketing-filter-link-row.tsx:109,119,134`, with the
    `sr-only ", n"` span removed.
  - The accessibility snapshot confirms it, and the marketing-ui and artist tests are updated.
- **Mobile sheet copy** is fixed (`sales-calendar-filter-sheet.tsx:46`), as shown in the
  screenshots.
- **Dedupe:** `link2` is gone. One `link = { onClick: onLinkClick }` is spread on every row,
  sort included (`sales-filter-group-contents.tsx:93,112,133,149,167,183,199`).
- **Docblock:** `/** @vitest-environment jsdom */` is back on line 1 of
  `apps/shop/src/components/catalogue/artwork-catalogue-filter-body.test.tsx`.
- **Shop and sales link-count assertions:**
  - Shop: `artwork-catalogue-filter-body.test.tsx:115-135`.
  - marketing-ui: `marketing-filter-link-groups.test.tsx:105-141`.
  - Sales: `sales-filter-sidebar.test.tsx:100-101`.
  - Mutation `unavailable = !checked` in the shared `MarketingFilterLinkRow`: Shop 3 of 7 fail,
    including the new SSR test; marketing-ui 3 of 6 fail, including the new SSR test. Caught
    directly.

### 6. Route JS: equal or lower, apart from per-build ID noise

- **CI, PR run 43848259985** (`build` job, head `22462b8e` merged with main) against main's latest
  build table, merge-queue run 43835866524 on `46c9bdac`:
  - **Sales list 442.8 → 439.1 KB** (page 105.6 → 101.8 KB). `/sales` First Load is 369 kB.
  - Home, Sale page, Terms, Shop product and public, and every lax.art group are equal.
  - Several web and Shop groups show ±0.1 KB: web checkout, listing and lot +0.1; Shop account and
    checkout +0.1; account frame +0.1 / page −0.1; About +0.1; privacy/download −0.1.
- **Local, same machine, `check-route-js-budget.mjs --app apps/web --all`, 114 web routes**, PR
  against main build 1:
  - 64 the same, 39 smaller, 11 larger, each by exactly +0.1 KB: about, artist/[slug],
    lot/[slug]/[id], sales/[slug]/[id], search, sell, unsubscribe, auth/post-login,
    onboarding/organisation/step/connect (or invitations/accept/[token]), [...missing] and
    `_not-found`.
- **Why those +0.1 KB are noise:**
  - Module by module, after normalising Sentry debug IDs, the differing chunks in these 11 routes
    hold the same modules at the same lengths. The only real differences are the
    `createServerReference("<id>")` IDs of `setConsentAction` and `syncUiThemeFromClientAction`,
    plus the module IDs and chunk names derived from them.
  - Those IDs are salted with Next's per-build random encryption key
    (`next/dist/build/webpack-config.js:416`, `serverReferenceHashSalt: encryptionKey`; the key is
    in `.next/cache/.rscinfo`). The three builds had three different keys.
  - The PR does not touch either action or any module in those routes. The changed modules
    (`sales-filter-*`, `marketing-filter-link-row`) appear only in `/sales` and the artist
    directory. The directory routes are +11 raw bytes (the `onClick` prop and `aria-label`) at
    ±1 gzip byte, and show as unchanged in the table.
  - Raw bytes are equal or smaller on 564 of 594 manifest entries. The rest are ≤ +11 bytes.
  - **A second clean build of main** (same commit, new key) differed from the first on 52 of 114
    routes (51 larger by +0.1 KB), which shows the size of this noise. No budget or baseline file
    is changed.

### 7. Tests and CI

- Local, PR merged with main `46c9bdac`, after `turbo run build --filter='./packages/*'`:

  | Suite | Result |
  | --- | --- |
  | `apps/web` | 1528 files, 9996 passed, 10 skipped |
  | `apps/shop` | 116 files, 708 passed |
  | `apps/art` | 101 files, 799 passed |
  | `packages/marketing-ui` | 111 files, 710 passed |

- CI on `22462b8e`: all 41 check runs succeeded, including build, static-checks, web vitest 1–8,
  browser-gates, art-browser-gates, account-browser-gates, ui-chromium and ci-result.
- Production `next build` of web succeeds on the merged tree.
