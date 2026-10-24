# LAX staff design standard

The bar that **LAX Admin** (shop and gallery) and **Bid admin** (auction house) are audited against.
Both tools are built on `@auction/staff-ui` and look and behave the same.

- **Who it is for:** staff who work in these tools all day, such as fulfilment, finance, catalogue,
  editorial, compliance and auction operations. They are experts and repeat the same tasks hundreds
  of times. The design should be calm, dense, keyboard-first and predictable.
- **Fixed constraints:** Outfit for the interface and Montserrat for titles. Primary buttons are
  neutral ink (black in light mode). Product accents appear only on the tool tile and the
  active-nav bar.
- **Kit:** `packages/staff-ui` (`@auction/staff-ui`). Each rule records what the kit provides.
  When a kit change meets or breaks a rule, update the rule's **Kit** line and the summary below
  in the same pull request.

## How to use this document

Each rule has an ID (for example `TBL-7`) so audit findings can cite it. Every rule has:

- **Rule:** the requirement, with numbers where a number is possible.
- **Why:** a one-line rationale.
- **Check:** what an auditor does with a screenshot, a page or the keyboard.
- **Kit:** what the kit provides.
  - `MET`: the kit component meets the rule by default.
  - `PARTIAL`: the kit helps, but something is missing.
  - `GAP`: the kit has nothing for this, or it contradicts the rule.
  - `APP`: a page-level decision that the kit cannot enforce. Audit each screen.
- **Sources:** reference links, resolved at the end of the document.

Severity for audit findings:

- **P0:** a broken task, data-loss risk, or a WCAG 2.2 AA failure.
- **P1:** slows the work or causes errors daily.
- **P2:** polish or consistency.

## Kit status at a glance

| Status | Rules |
| --- | --- |
| `MET` | 58 |
| `PARTIAL` | 14 |
| `GAP` | 2 |
| `APP` | 11 |

Counted from each rule's **Kit** line by its first status. A rule the kit meets for its parts,
with the rest left to each page, counts as `MET`.

---

## Decisions where sources disagree

| Topic | Options in the sources | Our choice | Why, for our context |
| --- | --- | --- | --- |
| Validation timing | GOV.UK validates on submit only. Ontario and many SaaS products validate on blur. | Validate on **submit**. After the first failed submit, re-check the field that failed **as it changes**, so its error clears as soon as it is fixed. Format checks for money, dates and references may run on blur, only when the field is non-empty. | Early errors are noise for experts who are mid-entry. Clearing errors live after a submit gives fast confirmation. [govuk-validation] [primer-saving] |
| Errors in toasts | Polaris: never, except for errors outside the user's control. Carbon: toasts are for system messages. | **Never** put an error that needs the person to act in a toast. Use the field, a Notice, or the error summary. A toast is allowed only for a background or network failure, with a Retry action. | A toast that disappears loses the error. Staff then redo work or assume it succeeded. [polaris-toast] [carbon-notif] |
| Toast lifetime when it has an action | M3 Compose and Angular: an action toast never times out. Carbon: an action toast persists. Sonner default: about 4s. | **5s** for a plain toast. **10s** for a toast with Undo, paused while hovered or focused. The same action must also be undoable or reversible from the record, so the toast is never the only route. | Satisfies WCAG 2.2.1 through the "equivalent route" rather than by keeping toasts pinned forever. [m3-snackbar] [wcag-timing] |
| Confirm or undo | NN/g: confirm only serious, irreversible actions; prefer undo. Linear: undo for everything. | **Undo** for reversible changes, such as status, assignment, tags, archive and unpublish. **Confirm** for money movement, messages to customers, and anything irreversible. **Typed confirmation** only for rare, catastrophic actions (see FRM-12). | Refunds, payouts and bidder bans cannot be recalled. Status edits can. Confirming everything trains people to click through. [nng-confirm] [linear-undo] [primer-delete] |
| Sort states | Carbon: three states (unsorted, ascending, descending). Primer: one column is always sorted, and a click toggles direction. | **Primer.** A list always has a visible default sort. Clicking toggles ascending and descending. There is no unsorted state. | A server list is never truly unsorted, so an "unsorted" state is false. It also makes "newest first" explicit. [primer-dt] [carbon-dt] |
| Where the bulk-action bar sits | Carbon: replaces the toolbar at the top. Polaris: in the table header. Linear and Notion: floating at the bottom. | **Floating at the bottom** (current kit). The page must reserve `scroll-padding-bottom` so the bar never covers the focused row. | It stays in reach on long lists. We fix the WCAG 2.4.11 risk rather than move the bar. [carbon-dt] [wcag-focus-obscured] |
| Row actions: always visible or on hover | Polaris: reveal on hover or selection. Carbon: the overflow menu is persistent by default. Retool: actions on hover. | A **persistent** `…` overflow in the last column. At most **one** frequent action may sit inline. No hover-only controls. | Hover-only actions are invisible on touch and to people scanning, and hard to find by keyboard. [carbon-dt] [primer-dt] [polaris-index-table] |
| Pagination or infinite scroll | Most systems paginate tables. Feeds and timelines scroll. | **Paginate** lists, with page URLs and "1–50 of 312". Activity and timelines use "Show more". | Pages are addressable and shareable, select-all has a clear scope, and counts are honest. [carbon-dt] [atl-dynamic-table] |
| Hide, disable or explain | Carbon: disable when blocked by permission or prerequisite; read-only when content still matters. Nielsen: disabled items need a reason. | **Hide** what the role can never do. **Disable with a visible reason** what this record's state blocks. Use **read-only** for view-only access to editable data. | Staff need to know an action exists, but not see tools that will never be theirs. [carbon-disabled] [carbon-readonly] [uxtigers-inactive] |
| Minimum font size | Atlassian: 12px is the smallest, for fine print only. The kit keeps 11px (`2xs`) for digits. | **12px minimum for words.** 11px only for digits in counters and `kbd` glyphs. | Outfit at 11px is too small for words over a long day. 11px digits in a 20px pill stay legible. [atl-type] |
| Input border contrast | Stripe and Linear use faint borders. Carbon and GOV.UK use strong ones. WCAG 1.4.11 needs 3:1 when the border is the only boundary. | **Form control boundaries ≥ 3:1** against the surface. Card and table hairlines stay faint because they are decorative. | Our inputs, checkboxes, radios and switches sit on white with only a border, so the border is the control's only edge. The faint hairline (1.54:1) fails WCAG; the control border passes on every surface. [wcag-nontext] [carbon-input-style] |
| Side panel or full page | Notion opens records in a side peek by default. Polaris uses full pages. | A **panel** for triage and quick edits on one record. A **full page** for anything with tabs, a timeline, more than one section to edit, or a money action. A panel always offers "Open full page", and both have URLs. | Panels keep list context during triage. Complex records need room and a shareable address. [notion-peek] [polaris-details] |
| Marking required fields | GOV.UK: never use asterisks; mark optional fields. | Mark **"Optional"**. Required is the default, with no asterisks (current kit). | Most staff fields are required, so marking the exceptions is quieter. [govuk-question] |

---

## 1. Information architecture and navigation

**NAV-1. The sidebar has at most two levels: groups, then items. Items never nest.**

- **Rule:** use 4–7 groups, each with 2–7 items, and sentence-case group titles. An ungrouped top
  block may hold only Overview and Inbox.
- **Why:** anything deeper turns the nav into a tree that people scan instead of recall. Primer
  caps NavList at four levels and asks designers to rethink before going deeper. Spectrum keeps
  icons on the first level only. Two levels is plenty for our object count.
- **Check:**
  - Count the levels. No item has a disclosure triangle.
  - No group has more than 7 items.
  - Group titles are sentence case.
- **Kit:** `MET`. `StaffNavGroup` has no children, uses 32px rows and 16px icons, and has a
  240px rail that collapses to 56px.
- **Sources:** [primer-navlist] [spectrum-sidenav]

**NAV-2. Organise groups around the work, not the database.**

- **Rule:** order groups by how often people use them, with daily queues first. Use these
  groupings:
  - **LAX Admin:** Overview · *Sales* (Orders, Refunds, Fulfilment, Enquiries) · *Catalogue*
    (Artworks, Artists, Editions) · *Content* (Editorial, Help centre) · *Money* (Payouts) ·
    *Team* (Staff, Audit log).
  - **Bid admin:** Overview · *Auctions* (Sales, Lots, Live console) · *People* (Bidders, KYC
    review) · *Money* (Payments, Payouts) · *Compliance* · *Team*.
- **Why:** a fulfilment lead should never scroll past settings to reach today's work.
- **Check:** the top two groups hold the most-visited pages. Every page's breadcrumb root matches
  its sidebar group.
- **Kit:** `APP`.
- **Sources:** [atl-nav-jira] [polaris-filters]

**NAV-3. Counts appear only on queues that need action, and only when the count is above zero.**

- **Rule:**
  - Use the `attention` tone (ink fill) only for work that is assigned or overdue.
  - Use the neutral tone for everything else.
  - Cap the display at `999+`.
  - Never show totals such as "1,240 artworks".
  - A screen reader announces the count as ", 12 waiting".
- **Why:** badges on every item turn into wallpaper. A count earns its place only when it means
  "go here next".
- **Check:**
  - Every count in the nav maps to a filter that lists exactly that number of records.
  - No zero badges are shown.
  - No counts appear on catalogue or setting pages.
- **Kit:** `MET`. `Count` has the neutral and attention tones, the 999+ cap, the screen-reader
  text and a dot on the collapsed rail. Choosing which items get counts is `APP`.
- **Sources:** [primer-navlist] [intercom-inbox]

**NAV-4. ⌘K / Ctrl+K opens one palette that finds pages, records and actions.**

- **Rule:**
  - Record search starts after 2 characters with a debounce of about 180ms.
  - Results are grouped: Records, then Actions, then Pages.
  - Every row shows a hint, such as an email, a status or a shortcut.
  - An empty query shows **recently opened records** (the last 8).
  - Exact reference matches go straight to the top: order numbers (`LAX-10432`), lot numbers and
    paddle numbers.
- **Why:** staff arrive with an ID from an email or phone call. Linear and Intercom put both
  "go to" and "do" in ⌘K.
- **Check:**
  - Press ⌘K anywhere, including inside a panel.
  - Paste an order number: the record is the first result, and Enter opens it.
  - Esc returns focus to where it was.
  - The palette footer teaches ↑↓, ↵ and esc.
- **Kit:** `PARTIAL`. The palette, record search, grouping, hint, footer and focus return all
  exist. There is no "recent records" group and no exact-ID boost, so the app's search function
  has to rank results.
- **Sources:** [linear-nav] [intercom-cmdk]

**NAV-5. Breadcrumbs appear on every page below a list level.**

- **Rule:**
  - The trail runs from the section to the parent record to the current page.
  - The current page is not a link and carries `aria-current="page"`.
  - On a phone, the middle of the trail collapses.
  - Top-level list pages have no breadcrumb. The page title is enough.
- **Why:** Polaris requires a way back that does not depend on the browser's Back button.
- **Check:**
  - On a record or sub-page, the first crumb goes to the list with the filters that were
    applied.
  - At 375px, only the first and last crumbs show.
- **Kit:** `MET` (`StaffBreadcrumbs`). Returning to the list with its filters intact is `APP`:
  pass the list URL including its query.
- **Sources:** [polaris-index-template]

**NAV-6. Record switching: inside a record opened from a list, J/K or "‹ 3 of 50 ›" moves to the
previous or next record in that list.**

- **Rule:** the position control sits in the record header, right of the breadcrumbs.
- **Why:** queue work, such as reviewing 40 KYC files or packing 30 orders, is a loop. Going back
  to the list for each record wastes about two clicks per item. Intercom uses J/K between
  conversations.
- **Check:** open the 3rd row of a filtered list. J goes to the 4th row. Wrapping at the ends is
  disabled, not silent.
- **Kit:** `MET`. `RecordPager` shows "‹ 3 of 50 ›", binds J and K through the shortcut registry, and
  disables the button at either end. `recordPosition(ids, currentId)` works out the position.
  Carrying the list's ordered ids into the record (URL or session) is `APP`.
- **Sources:** [intercom-cmdk] [linear-nav]

**NAV-7. Back always does what people expect.**

- **Rule:**
  - Opening a side panel pushes a URL (`?record=ord_123`). Back closes the panel.
  - Filters, sort, view and page live in the URL.
  - Back from a record returns to the list at the same scroll position.
  - A dialog never changes the URL.
- **Why:** losing filters on Back is the most common admin complaint. URL state also makes a view
  shareable.
- **Check:**
  - Filter a list, open a panel, then press Back: the panel closes and the filters stay.
  - Press Back again: you leave the list.
  - Reload: everything is restored.
- **Kit:** `PARTIAL`. Views and pagination are URL-based (`DataViews`, `TablePagination` hrefs).
  `DetailPanel` is controlled by the app, so tying it to the URL is `APP`.
- **Sources:** [polaris-index-filters-migrate] [notion-peek]

**NAV-8. The product switcher and account menu sit in fixed places.**

- **Rule:**
  - The product mark and switcher sit at the top-left of the nav.
  - The account menu (name, role label, theme, sign out) sits at the top-right.
  - The switcher lists only the tools this person can open.
- **Why:** staff who move between Bid and LAX Admin build muscle memory.
- **Check:** a user with one tool sees no switcher choices. Their role label shows in the account
  menu.
- **Kit:** `MET` (`ProductSwitcher`, `AccountMenu`, `StaffUser.roleLabel`).
- **Sources:** [vercel-geist]

---

## 2. Data tables

**TBL-1. Two densities: 36px compact and 44px comfortable, remembered per list.**

- **Rule:**
  - The default is comfortable on lists with thumbnails (artworks, lots) and compact on
    text-only lists (payments, audit log, enquiries).
  - The header row is 36px in both densities.
  - Cells use 12px side padding, with 16px at the table edges.
  - A cell holds one line in both densities. Two-line cells (title plus a muted sub-line) need
    comfortable density.
- **Why:** Carbon offers 24–64px but uses 40px by default. 36/44 covers our needs and lines up
  with the 36px default control and the 44px coarse-pointer target.
- **Check:**
  - Measure the rows: 36 or 44px.
  - Toggle density, reload, and the choice persists.
  - No row grows taller because a cell wraps.
- **Kit:** `MET` (`DataTable` `density`, `DensityToggle`, `useTableDensity`). Picking the
  default per list is `APP`.
- **Sources:** [carbon-dt] [carbon-dt-style] [primer-dt]

**TBL-2. Column choice and order follow the question staff ask of the list.**

- **Rule:** columns run left to right in this order:
  1. Identifier or title (with a thumbnail if there is one).
  2. Status.
  3. Party (customer, artist or bidder).
  4. Amounts.
  5. Dates.
  6. Row actions.

  Keep a list to **at most 7 columns** at 1280px. Hide lower-priority columns with
  `hideBelow` rather than letting them squeeze.
- **Why:** this left-to-right order matches the order people ask questions in: which one, what
  state, who, how much, when.
- **Check:** at 1280px there is no horizontal scroll and at most 7 columns. The first column
  identifies the row without reading any other column.
- **Kit:** `PARTIAL`. Typed columns, `hideBelow` and `width` exist. There is no
  column-visibility menu (TBL-12).
- **Sources:** [carbon-dt] [primer-dt]

**TBL-3. Sticky header on every table taller than the viewport. Sticky first column when the
table scrolls horizontally.**

- **Rule:** the header sticks under the 52px top bar. A sticky column carries a 1px right
  hairline once content scrolls beneath it.
- **Why:** column meaning is lost on row 40. On narrow screens, the identifier is lost on
  horizontal scroll.
- **Check:**
  - Scroll a 50-row list: the column headers stay visible.
  - At 900px with a wide table, scroll sideways: the identifier column stays put.
- **Kit:** `MET`. `DataTable` keeps its header under the top bar by default (`stickyHeader`): the card
  clips with `overflow: clip`, which is not a scroll container, so `position: sticky` works against
  the page. When the columns are wider than the card, the table scrolls sideways instead and
  `stickyFirstColumn` keeps the identifier (and the selection column) in view with a hairline.
- **Sources:** [carbon-dt] [wcag-focus-obscured]

**TBL-4. Sorting shows its state and announces it.**

- **Rule:**
  - Only sortable headers are buttons.
  - The sorted column shows ↑ or ↓ in `fg` colour. Other sortable headers show ⇅ on hover or
    focus only.
  - `aria-sort` sits on the `th`.
  - A list always has a default sort, shown on first load (see Decisions).
  - Numeric headers are right-aligned, with the icon on the left of the label.
- **Why:** an invisible sort makes a list look broken. A visible default makes its order honest.
- **Check:**
  - On first load, exactly one header shows an arrow.
  - Clicking the sorted header toggles direction and never clears the sort.
  - A screen reader reads "ascending" or "descending".
- **Kit:** `MET`. Arrows, hover hint, `aria-sort` and numeric alignment, plus `defaultSort` (shown on
  first load) and a click that only toggles direction. `defaultSortDirection` sets a column's
  first direction, such as newest first. Ties keep the server's order. Choosing each list's
  default is `APP`.
- **Sources:** [primer-dt] [carbon-dt]

**TBL-5. Filters: one search field, filter buttons, then chips. Use no query builder.**

- **Rule:**
  - **Search** fills the toolbar row and is 32px high. It submits on Enter and searches IDs,
    names and emails.
  - **One "Filter" button** opens a sheet holding every filter, applied together. It shows how
    many filters are on. A date period that filters the rows sits beside it.
  - **Applied filters** show as removable chips, with "Clear all" when there are two or more.
  - Range filters (amount, date) use presets plus two fields.
  - Filter state lives in the URL.
- **Why:** this is the Polaris IndexFilters pattern. A query builder only pays off for analysts,
  and our staff filter the same three or four ways all day. Saved views cover the rest.
- **Check:**
  - Every applied filter shows as a chip.
  - Removing a chip updates the URL and the list.
  - Esc in search clears it.
  - The Filter button shows the number of filters that are on.
- **Kit:** `PARTIAL`. `TableSearch` (`fullWidth`), `FilterSheet` (checklist, single-select and
  date-range sections, staged until "Apply filters"), `ActiveFilterChips` and `DateRangeFilter`,
  laid out by `ListPage`. There is no amount-range section.
- **Sources:** [polaris-filters] [stripe-export]

**TBL-6. Saved views: built-in views as tabs with counts, team views in code, and personal views
saved per person.**

- **Rule:**
  - A view is a URL.
  - Changing a filter while in a view shows "Save view". It never silently edits the view.
  - Personal views follow the person across devices.
- **Why:** Polaris, Linear and Intercom all treat views as the main way to work. URL views can
  be shared in Slack.
- **Check:**
  - Change a filter while in a view: the tab no longer claims to be that view, and "Save view"
    appears.
  - Copy the URL into another browser and you get the same list.
- **Kit:** `MET` (`DataViews`, `ViewsMenu`, `useSavedViews`, server persistence, conflict
  codes).
- **Sources:** [polaris-filters] [polaris-index-filters-migrate]

**TBL-7. Bulk actions: checkbox column, header tri-state, floating bar, and a clear scope for
"all".**

- **Rule:**
  - The bar says "12 orders selected" and holds at most 3 actions plus `…`.
  - Selecting every row on the page offers **"Select all 312 matching orders"**. That is a
    separate server-side mode, sent as the filter rather than as IDs.
  - Shift+click selects a range.
  - Esc clears the selection.
  - While rows are selected, row-level overflow menus are disabled.
  - Destructive bulk actions confirm with the count and the total amount.
- **Why:** Polaris says to define what "all" means before building it. Without range-select,
  selecting 30 rows takes 30 clicks.
- **Check:**
  - Select the header checkbox: the "Select all N matching" link appears.
  - Shift-click selects a range.
  - The bar never covers the focused row.
  - A screen reader announces "12 selected".
- **Kit:** `MET`. Tri-state header, floating bar with count, Esc, Space and X, Shift+click (and
  Shift+X) range, live region, `selectAllMatching` ("Select all 312 matching", acted on as the
  filter through `bulkActions(rows, { allMatching, count })`), row `OverflowMenu`s disabled with
  a reason while rows are selected, and `scroll-padding-bottom` while the bar shows. Confirming
  destructive bulk actions with the count and total is `APP` (`ConfirmActionDialog`).
- **Sources:** [polaris-select-all] [carbon-dt] [wcag-focus-obscured]

**TBL-8. Row actions: the whole row opens the record, and a persistent `…` holds the rest.**

- **Rule:**
  - A click anywhere on the row outside a control opens the record (panel or page). Enter does
    the same.
  - The last column is 56px wide and holds a 24px ghost `…` button.
  - Money and irreversible actions in the menu open a confirm dialog with the amount; no row
    carries an inline red button.
  - At most **one** frequent action may be inline, for example "Mark packed".
  - Destructive items come last in the menu, after a separator, in danger text.
  - The row's title cell is a real link, so cmd-click opens it in a new tab.
- **Why:** Primer says to group several actions in a menu and pull out at most one. Real links
  keep middle-click and new-tab working.
- **Check:**
  - Cmd-click a row title: it opens a new tab.
  - The `…` is visible without hover.
  - Delete or Refund is last in the menu and red.
- **Kit:** `MET`. Row open (click and Enter), `RowActions` and `rowActionsColumn` (the 56px last
  column, header for screen readers only, at the right of each row on a phone; `ListPage`
  adds it from `table.rowActions`), `OverflowMenu` (destructive last), and the selection cell
  never opens the row (TBL-15). Making the title cell a link is `APP`.
- **Sources:** [primer-dt] [carbon-dt] [retool-rows]

**TBL-9. Inline edit only for one-value fields that change often, such as status, assignee or
priority. Never for money, text or anything audited with a reason.**

- **Rule:**
  - Inline edit uses a select or menu in the cell, saves on choose, and offers undo in a toast.
  - Anything that needs a reason or affects a customer opens a panel or dialog.
- **Why:** inline text editing in a dense grid causes accidental edits. Changes that need a
  reason must capture that reason.
- **Check:** no free-text inputs inside table cells. Changing a status in a cell shows "Status
  changed · Undo".
- **Kit:** `APP`. Nothing in the kit encourages inline editing, which is correct.
- **Sources:** [carbon-dt] [linear-undo]

**TBL-10. Paginate at 50 rows by default (25 / 50 / 100 options), with a range summary and links
for previous and next.**

- **Rule:**
  - Show "1–50 of 312". Cursor lists show "First page" instead of a page count.
  - Infinite scroll is never used in tables.
- **Why:** page URLs can be shared, page sizes are predictable, and select-all has a scope.
- **Check:** page 3's URL reloads page 3, and the summary is in tabular figures.
- **Kit:** `PARTIAL`. `TablePagination` has the summary, links and first-page label. A
  page-size control is missing.
- **Sources:** [carbon-dt] [atl-dynamic-table]

**TBL-11. Every list has four distinct states that keep the table's frame.**

| State | Content |
| --- | --- |
| **First load** | 8 skeleton rows at the row height. Not a spinner. |
| **Refetch** | Existing rows at 60% opacity with `aria-busy`. Never blank the table. |
| **Empty** (nothing exists yet) | Says what will appear and offers the one action that creates it. Title in positive voice: "Add your first artist". |
| **No results** (filters matched nothing) | Says so, names the filter, and offers "Clear filters". |
| **Error** | Says what failed in plain words and offers "Try again". `role="alert"`. |

- **Why:** Carbon prefers skeletons for loading and separates first-use from no-results empty
  states. Mixing them up tells staff "there are no orders" when there are.
- **Check:** force each state, including by filtering to nothing. The card's border and toolbar
  stay in place and nothing jumps.
- **Kit:** `MET` (`Skeleton` rows, refetch opacity, `EmptyState`, `NoResultsState`,
  `ErrorState`).
- **Sources:** [carbon-empty] [carbon-dt] [nng-progress]

**TBL-12. Columns can be shown or hidden per list, and the choice is remembered.**

- **Rule:** the "Columns" menu sits in the toolbar's right side. The identifier column cannot be
  hidden. Reordering is optional (P2).
- **Why:** finance and fulfilment want different columns from the same orders list.
- **Check:** hide a column, reload, and it stays hidden. "Reset columns" is available.
- **Kit:** `MET`. `ColumnsMenu` with `useColumnVisibility` (remembered per list in this browser,
  "Reset columns", the first column locked, defaults through `defaultHiddenColumns`), placed by
  `ListPage`.
- **Sources:** [carbon-dt] [polaris-filters]

**TBL-13. Numbers, money and dates are formatted and aligned consistently.**

- **Rule:**
  - **Money** is right-aligned in tabular figures, with currency symbol and two decimals:
    `£1,250.00`. Negative amounts and refunds use a minus sign (`−£20.00`), not red alone.
    Different currencies in one column show the ISO code: `€1,250.00 EUR`.
  - **Counts** are right-aligned.
  - **Dates** in tables are left-aligned and absolute: `24 Oct 2026`. Add the time only when it
    matters: `24 Oct 2026, 14:05`.
  - **Relative time** ("3 min ago") is allowed only in activity, with the absolute time as a
    tooltip and in `<time datetime>`.
  - **Time zone:** every time is shown in Europe/London. Pages where time matters (live sales,
    closing times, payouts) show the zone label: `14:05 BST`.
  - **IDs** use a monospace or tabular style and can be copied (PRD-4).
- **Why:** right-aligned tabular figures line up for comparison (Primer). An auction closing
  time that is ambiguous causes disputes.
- **Check:**
  - Money columns line up on the decimal point.
  - No `10/11/2026`-style dates.
  - Live-sale times show BST or GMT.
- **Kit:** `MET`. `formatStaffDate`, `formatStaffTime`, `formatStaffDateTime(value, { zoneLabel })` (adds
  BST or GMT), `formatStaffMoney` (minus sign, ISO code for other currencies) and `RelativeTime`
  (exact time in a tooltip and in `<time datetime>`), all in London time. Numeric columns use
  `tabular-nums` and right alignment.
- **Sources:** [primer-dt] [govuk-dates]

**TBL-14. Truncate with an ellipsis, and always make the full value available.**

- **Rule:**
  - A truncated cell shows the full value in a tooltip after 500ms, and the value stays in the
    accessible name.
  - Never truncate amounts, statuses or IDs. Size those columns to fit instead.
  - Titles may truncate. Emails truncate in the middle (`mahmo…@gmail.com`) only if a copy
    button is present.
- **Why:** a truncated amount or ID is a wrong amount or ID.
- **Check:** shrink to 1024px. No amount or ID shows "…". Hovering a truncated title reveals it.
- **Kit:** `MET`. `DataColumn.truncate` is `"end"` by default, `"middle"` for emails and references, and
  `false` (the default for numeric columns) to never shorten. `TruncatedText` shows the full
  value in a tooltip after 500ms when, and only when, the text is cut; the text stays in the DOM.
- **Sources:** [primer-dt] [carbon-dt]

**TBL-15. Selection hit area covers the whole checkbox cell (44px × row height).**

- **Rule:** a click anywhere in the cell toggles selection, never row-open. The checkbox itself
  stays 16px.
- **Why:** WCAG 2.5.8 needs a 24px target, or spacing. Gmail and Linear make the gutter
  selectable. Without it, a near miss opens the record instead.
- **Check:** click 10px to the left of a checkbox. The row is selected and no panel opens.
- **Kit:** `MET`. The whole selection cell (44px × row height) toggles the row, and a click in it never
  opens the row. The phone layout has a 44px selection strip the height of the row.
- **Sources:** [wcag-target]

**TBL-16. On phones, the table becomes a list: title, badges on the right, and up to three meta
facts underneath.**

- **Rule:**
  - Each row has a 44px minimum tap target.
  - Bulk selection keeps its checkbox.
  - The select-all control moves into the bulk bar, because the narrow layout has no header
    checkbox.
- **Why:** Polaris notes the header checkbox disappears in narrow layouts, so select-all must
  live elsewhere.
- **Check:** at 375px, rows show the title, status and amount. Select one row, and the bar
  offers "Select all".
- **Kit:** `MET`. The stacked list, the `mobile` column roles, 44px rows, and "Select all" in the
  bulk-action bar below 768px.
- **Sources:** [polaris-select-all] [polaris-index-table]

**TBL-17. Export uses what the table shows.**

- **Rule:**
  - "Export" in the toolbar exports the current filters and visible columns as CSV.
  - It says how many rows it will export.
  - Exports over 5,000 rows run as a job (FBK-6).
- **Why:** Stripe exports from the filtered list with column choice.
- **Check:** filter, export, and the CSV matches the list's count.
- **Kit:** `APP`.
- **Sources:** [stripe-export]

---

## 3. Record (detail) pages

**PRD-1. The header has a fixed anatomy.**

- **Rule:** the header contains, in order:
  1. Breadcrumbs.
  2. **Title**: the human name or reference, in Montserrat at 20/28 semibold.
  3. **Status badge** beside the title, with at most 2 badges.
  4. **Meta line**: 3–5 key facts as label and value, such as Total, Customer, Placed and
     Channel.
  5. Actions on the right: overflow, then up to 2 secondary actions, then **one** primary
     action, last.

  On a phone, the actions drop under the title.
- **Why:** this matches the Salesforce highlights panel (key fields at the top, the first one in
  bold) and the Polaris resource details page header.
- **Check:** within the first 120px of the page you can say what the record is, its state, its
  amount, its owner, and what to do next. There is at most one primary button.
- **Kit:** `MET` (`PageHeader` with `status`, `meta`, `MetaItem`, `primaryAction`, up to two
  `secondaryActions`, and `overflow`).
- **Sources:** [salesforce-compact] [polaris-details] [polaris-page-actions]

**PRD-2. The primary action is the next step in the record's life, and it changes with the
status.**

- **Rule:** for example, Paid becomes "Mark packed", Packed becomes "Add tracking", and a Lot in
  Draft becomes "Publish". When there is no next step, there is no primary button.
- **Why:** one obvious next step per state is what makes queue work fast.
- **Check:** walk an order through each status. The primary label changes, and it never offers
  an action that state forbids.
- **Kit:** `APP` (`EnumSelect` supports listing only the valid next states).
- **Sources:** [polaris-page-actions]

**PRD-3. Use one scrolling page of sections by default. Use tabs only when sections are
independent and heavy.**

- **Rule:**
  - Layout: a main column of 2fr and a side column of 1fr from 1280px.
    - The main column holds the work: line items, lots, documents.
    - The side column holds facts: customer, addresses, payment, metadata.
  - Use tabs (`TabNav`, with URL tabs) only when a record has more than 4 sections that people
    use separately, such as an Artist's Overview, Artworks, Payouts and Activity.
  - Never hide the status or primary action behind a tab.
- **Why:** Polaris resource details uses two columns. Tabs hide information and break Find in
  page.
- **Check:**
  - Order and payment pages have no tabs.
  - When tabs exist, each has a URL, and reload keeps the tab.
- **Kit:** `MET`. `DetailPage` lays out the header, a summary card, optional tabs, and the main
  column beside a rail (2fr / 1fr from 1280px), built from `Section`, `KeyValueList` and
  `TabNav`.
- **Sources:** [polaris-details]

**PRD-4. Every reference can be copied in one click.**

- **Rule:** this covers order, payment intent, payout, lot and bidder IDs. The copy button is
  24px, sits after the value, and confirms with a ✓ for 1.5s and an announcement. The record
  title's reference also gets a copy button.
- **Why:** staff paste IDs into Stripe, email and Slack dozens of times a day.
- **Check:** every ID on a record page has a copy button. Pressing it announces "Order ID
  copied".
- **Kit:** `PARTIAL`. `KeyValueList.copyValue` exists. There is no standalone `CopyButton` or
  `CopyableId` for headers and table cells.
- **Sources:** [stripe-security] [vercel-geist]

**PRD-5. The activity timeline is complete, newest first, and attributes every event.**

- **Rule:**
  - Each event is a sentence ("Refund of £20.00 issued"), with an actor ("Sara K.", "System",
    "Stripe") and an absolute London time.
  - Staff notes go in the same timeline.
  - Long histories show 20 events, then "Show more".
  - Filter chips (All · Changes · Notes · Emails) appear once there are more than 50 events.
- **Why:** one timeline answers "what happened and who did it" for disputes and compliance.
- **Check:** perform an action, and the timeline shows it with your name without a reload.
- **Kit:** `MET` for the display (`Timeline`). Pagination and filters are `APP`.
- **Sources:** [carbon-notif-pattern] [github-sudo]

**PRD-6. Related records show as compact lists with a count and "View all".**

- **Rule:** show at most 5 rows, with "View all 23" linking to the list filtered to this record.
- **Why:** this keeps the record page short while making every relation one click away.
- **Check:** "View all" lands on a list with a removable filter chip naming the parent record.
- **Kit:** `APP`. Build it with `Section` and `DataTable` in compact density.
- **Sources:** [polaris-details]

**PRD-7. A side panel is for triage. A full page is for work.**

- **Rule:**
  - Panels are 480px, or 640px for forms with side-by-side fields.
  - Panel header actions include "Open full page" (↗).
  - The panel footer holds the actions, with the primary action last.
  - J/K inside a panel moves to the next row in the list.
- **Why:** this applies the panel-or-page decision above.
- **Check:** a panel never holds tabs or a money action without confirmation. It has a URL, and
  Esc returns focus to the row.
- **Kit:** `MET` for the panel (`DetailPanel` widths, focus return, header actions slot, footer).
  URL and J/K are `APP` (NAV-6, NAV-7).
- **Sources:** [notion-peek]

**PRD-8. Edit sections in place. Use a page-level edit mode only for long documents.**

- **Rule:**
  - Facts sections have an "Edit" ghost button in the section header. The section becomes a
    form with Save and Cancel in place.
  - Only one section edits at a time.
  - Editorial articles and artwork descriptions use a full editor page with explicit save and
    the unsaved-changes guard.
  - Never autosave a form that also has a Save button.
- **Why:** Primer says never to mix save patterns in one form. In-place section editing keeps
  context.
- **Check:**
  - Opening a second section's Edit while the first has changes asks first.
  - No form both autosaves and shows a Save button.
- **Kit:** `PARTIAL`. `Section.action` exists and the unsaved-changes guard is in the kit (FRM-9).
  There is no editing-state convention for sections.
- **Sources:** [primer-saving]

---

## 4. Forms

**FRM-1. Labels sit above fields, always visible. Never use the placeholder as a label.**

- **Rule:**
  - Label: 13/20, weight 500.
  - Hint: under the label at 12/16 muted, read with the field.
  - Placeholder: only for examples ("e.g. LAX-10432").
- **Why:** above-label layout is the fastest to scan, and placeholders vanish once someone
  types.
- **Check:** clear every field. Every one still says what it is.
- **Kit:** `MET` (`Field` provides the label, description, `aria-describedby` and ids by
  context).
- **Sources:** [carbon-input-style] [govuk-error-message]

**FRM-2. Mark the optional fields. Required is the default, with no asterisks.**

- **Why:** most staff fields are required (see Decisions).
- **Check:** no `*` anywhere. Optional fields say "Optional" after the label.
- **Kit:** `MET` (`Field optional`, and `aria-required` is set automatically).
- **Sources:** [govuk-question]

**FRM-3. An inline error goes under the field, says how to fix it, and is announced.**

- **Rule:**
  - Error text is 12/16, weight 500, in danger colour, with a 14px alert icon.
  - The field border turns danger and `aria-invalid` is set.
  - Wording is "Enter a refund amount up to £120.00", not "Invalid value".
- **Why:** GOV.UK error messages describe the fix. The icon means the error does not rely on
  colour alone.
- **Check:**
  - Submit with an error: the message names the field and the fix.
  - The border, icon and text all appear.
  - A screen reader reads the error with the field.
- **Kit:** `MET` (`Field error`, plus the `aria-invalid` border on the field box).
- **Sources:** [govuk-error-message] [wcag-use-of-color]

**FRM-4. Error summary on submit for any form with more than 3 fields.**

- **Rule:**
  - The summary sits at the top and **receives focus**.
  - It lists each error as a link to its field. The messages match the inline ones exactly.
  - Show it even when there is only one error.
- **Why:** the GOV.UK pattern. Keyboard and screen-reader users land on the problem.
- **Check:**
  - Submit a long form with two errors: focus moves to the summary.
  - Each link moves focus to its field.
- **Kit:** `MET`. `FormErrorSummary` ("There is a problem") takes focus when it appears, or once per
  failed submit with `focusKey`, so errors that come and go while fields are fixed never pull
  focus. Each link moves focus to its field and scrolls its label into view.
- **Sources:** [govuk-error-summary] [govuk-validation]

**FRM-5. Validate on submit, re-check live after a failure, and run format checks on blur only.**

- **Rule:** see Decisions. The server is the authority. Client checks are a courtesy.
- **Check:** typing into an untouched field never shows an error. After a failed submit, fixing
  the field clears its error immediately.
- **Kit:** `APP`.
- **Sources:** [govuk-validation] [primer-saving]

**FRM-6. Don't disable the submit button to show that a form is invalid.**

- **Rule:**
  - Keep Submit enabled. On click, run validation and show the errors.
  - The exceptions are a typed confirmation (FRM-12) and a request in flight (`loading`).
- **Why:** a disabled submit gives no reason and cannot be focused to find one.
- **Check:** open an empty form. Submit is enabled, and pressing it lists what is missing.
- **Kit:** `PARTIAL`. `StaffButton loading` keeps the button's colours and blocks repeats, which
  is correct. The kit's own "Save view" dialog disables Save until a name is typed. That is
  acceptable for a single-field dialog, but should not be copied.
- **Sources:** [uxtigers-inactive] [carbon-disabled]

**FRM-7. Defaults: pre-fill what is known, never pre-select a consequential choice.**

- **Rule:**
  - Pre-fill the refund amount with the remaining refundable total, the carrier with the last
    used one, and the date with today.
  - Never pre-select the refund reason, the ban reason, or "Notify customer". Ask.
  - Don't make staff enter the same thing twice in one flow.
- **Why:** WCAG 3.3.7 (Redundant Entry). A default on a consequential choice becomes the answer
  through inertia.
- **Check:** in each money or sanctions form, every radio group with legal or financial effect
  starts unselected.
- **Kit:** `APP`.
- **Sources:** [wcag-redundant] [nng-confirm]

**FRM-8. Money inputs show pounds and store pence, keep the typed text while focused, and tidy
it on blur.**

- **Rule:**
  - The `£` sits inside the leading slot.
  - Tabular figures.
  - Show the maximum in the hint ("Up to £120.00 refundable").
  - Use the right input mode for phones (decimal keypad).
  - Reject negative amounts and more than two decimals with an inline error.
- **Why:** floats and mixed pounds/pence cause the refund bugs that matter most.
- **Check:** type `12.5`, then blur: it shows `12.50`. Paste `£1,250`: it is accepted as 125000
  pence.
- **Kit:** `MET` (`MoneyInput`, `parsePoundsToPence`). Showing the maximum in the hint is `APP`.
- **Sources:** [govuk-error-message]

**FRM-9. Unsaved-changes protection on every editable form, page or panel.**

- **Rule:**
  - When the form has changes, warn on Back, on navigating through the nav, on ⌘K, on panel
    close and on tab close (`beforeunload`).
  - The dialog says "Discard changes to *Artwork title*?" with the buttons **Keep editing**
    (default) and **Discard**.
  - The Save button reads "Save changes" only when there are changes.
- **Why:** Primer recommends this. Losing 10 minutes of editorial work is a P0.
- **Check:** edit a field, then click a nav link: the dialog appears. Cancel keeps both the
  text and the scroll position.
- **Kit:** `MET`. `useUnsavedChanges(dirty, { label, navigate })` with `UnsavedChangesDialog`, or
  `UnsavedChangesGuard` for both, covers tab close (`beforeunload`), in-app links (nav,
  breadcrumbs), the Back button, ⌘K (`StaffShell`), `DetailPanel` close (`dirty`) and code that
  navigates through `confirmDiscardChanges()`. The dialog reads "Discard changes to …?" with
  **Keep editing** focused first. Both admins use it. The "Save changes" label is `APP`.
- **Sources:** [primer-saving]

**FRM-10. Date, time and time-zone inputs.**

- **Rule:**
  - Dates use a text field (`DD MM YYYY` or `24 Oct 2026`) with a calendar popover. The
    calendar is optional, never the only route.
  - Date ranges use presets first: Today, Last 7 days, This month, Custom.
  - **Times use a 24-hour clock** (`14:05`).
  - Any scheduled moment (sale opens, lot closes, payout run) shows its zone as a fixed label
    beside the field: "Europe/London (BST)".
  - When a moment falls on a clock change, the hint says so.
  - The saved value is ISO UTC. What is shown is London time.
- **Why:** GOV.UK says to accept typed dates and use a calendar only for near dates. Auction
  closing times must be unambiguous across clock changes.
- **Check:**
  - Schedule a lot close on the last Sunday of October: the hint mentions the change.
  - The detail page shows the same wall-clock time with "GMT".
- **Kit:** `MET`. `DateInput` takes typed dates ("24 Oct 2026", "24/10/2026", "2026-10-24") with an
  optional calendar, tidying the text on blur. `DateTimeInput` adds a 24-hour time, a fixed
  "Europe/London (BST)" label, a hint on clock-change days, refuses the skipped hour, and stores
  ISO UTC. `DateRangeFilter` has presets and whole London days.
- **Sources:** [govuk-dates]

**FRM-11. Choose related records by name, never by ID.**

- **Rule:**
  - The picker searches after typing, with a 200ms debounce.
  - Each option shows the label, a description that tells similar options apart (email, artist,
    edition) and right-aligned meta (status or price).
  - Disabled options say why: "Already in another sale".
- **Why:** pasting IDs causes the wrong-record errors that reach customers.
- **Check:** type part of a bidder's name. Two bidders with the same name are distinguishable by
  email.
- **Kit:** `MET` (`EntityPicker` with description, meta and disabled). Disabled reasons are
  `APP`.
- **Sources:** [carbon-input-style]

**FRM-12. Dangerous actions: friction scales with damage.**

| Level | When | Pattern |
| --- | --- | --- |
| 0 | Reversible: status, assign, archive, unpublish, tag | Do it at once. Toast with **Undo** (10s) plus a reverse action on the record. |
| 1 | Irreversible but small: refund one line, resend an email, void a draft invoice | `ConfirmActionDialog`. The title asks a question, the body states the effect, and the confirm button repeats the verb and amount: "Refund £20.00". Cancel is the default focus. |
| 2 | Irreversible and wide: bulk refund, cancel a live sale, ban a bidder, delete an artist with sales, payout run | Level 1, plus a **required reason** (stored in audit), **plus step-up** (FBK-7) when money leaves the business. |
| 3 | Catastrophic and rare: delete a sale with bids, purge customer data | Level 2, plus **typed confirmation** of the record's name or reference. The button stays disabled until it matches. |

- **Why:** NN/g says to be specific, use outcome-named buttons, and avoid a default "Yes".
  Primer says friction should match the damage. Typed confirmation stays meaningful only when it
  is rare.
- **Check:**
  - No "Are you sure?" or "OK" buttons.
  - Each confirm button names the verb and amount.
  - At most 3 typed confirmations exist in each tool.
- **Kit:** `MET`. `ConfirmActionDialog` (danger tone, loading) focuses Cancel first (or the first field
  to fill), takes an audited `reason` (checked on confirm, with an inline error), and a
  `typedConfirmation` that keeps the button disabled until the reference matches. `DangerZone`
  and `danger-secondary` exist. Step-up is FBK-7.
- **Sources:** [nng-confirm] [primer-delete] [linear-undo]

**FRM-13. Multi-step wizards only for creation flows with dependent steps, such as a new sale or
an artwork import.**

- **Rule:**
  - Use no more than 5 steps.
  - A stepper shows the step names and which are done.
  - Back keeps the data entered.
  - Each step validates on Next.
  - A final "Check your answers" review comes before Create.
  - Wizards save drafts.
- **Why:** a review step catches errors before records go live.
- **Check:** go back from step 3 to step 1: nothing is lost. The review page links to each step.
- **Kit:** `GAP`. Bid has an app-level `admin-form-wizard`. Promote a `StepIndicator` and
  `ReviewList` to the kit.
- **Sources:** [govuk-validation]

**FRM-14. Selects, comboboxes, radios, checkboxes and switches each have one job.**

| Control | Use when |
| --- | --- |
| Radios | 2–5 mutually exclusive options that should all be visible. |
| `EnumSelect` | 6–15 closed options, or a "valid next state" list. |
| Combobox (`EntityPicker`) | More than 15 options, or a server search. |
| Checkbox | An independent yes/no inside a form that is saved. |
| **Switch** | Only for a setting that **takes effect immediately**, with no Save button. |
| Segmented control | 2–4 view modes, not data. |

- **Why:** a switch inside a form with Save is ambiguous about when the change applies.
- **Check:** no switch sits in a form that has a Save button.
- **Kit:** `MET` for the components (`StaffRadio`, `EnumSelect`, `EntityPicker`,
  `StaffCheckbox`, `StaffSwitch`, `SegmentedControl`). Usage is `APP`.
- **Sources:** [carbon-input-style] [primer-saving]

---

## 5. Feedback

**FBK-1. Each message type has one job.**

| Need | Component | Placement | Lifetime |
| --- | --- | --- | --- |
| "Your action worked" | **Toast** | Bottom-right, 24px offset | 5s, or 10s with Undo, paused on hover or focus |
| "This field or form needs fixing" | **Field error** and **error summary** | At the field and the top of the form | Until fixed |
| "This record can't do X yet", or "changed elsewhere" | **Notice** | Above the section it concerns | Until the condition clears |
| "The whole tool is affected": impersonation, maintenance, read-only mode | **Banner** (shell) | Full width above the top bar | Until resolved |
| Must decide before continuing | **Dialog** | Centre | Until the person answers |

- **Why:** this follows Atlassian's split of flag, section message and banner, and Carbon's
  split of toast, inline and actionable. Polaris says toasts are not for errors.
- **Check:**
  - No success messages render as inline Notices that never go away.
  - No errors appear as toasts, except network errors with a Retry action.
  - At most one banner at a time.
- **Kit:** `MET` (`StaffToaster`, `toastUndo`, `Notice` with `alert`, `FormErrorSummary`,
  `StaffShell.banner`, `StaffDialog`).
- **Sources:** [atl-messages] [atl-section-message] [carbon-notif] [polaris-toast]

**FBK-2. Toast copy is short and past tense, and names the object.**

- **Rule:**
  - Write "Order LAX-10432 marked packed", not "Success!".
  - Use at most one action: Undo, View or Retry.
  - Show no more than 3 toasts at once, with the newest on top.
  - Announce with `role="status"`.
- **Why:** M3 allows one action per snackbar. WCAG 4.1.3 requires status messages to be
  announced without moving focus.
- **Check:** every toast names the object it acted on and has at most one button.
- **Kit:** `MET` for styling and the close button. Copy is `APP`.
- **Sources:** [m3-snackbar] [wcag-status]

**FBK-3. Optimistic updates for reversible changes, with a visible rollback.**

- **Rule:**
  - Status, assignee, tags, order of items and saved views update instantly.
  - If the server refuses, the value reverts and an error toast says so: "Couldn't change status:
    order was refunded elsewhere · Reload".
  - Money, emails to customers and anything in FRM-12 level 1 or above are **never**
    optimistic. Show `loading` on the button and wait.
- **Why:** Linear-style speed where a mistake is cheap, and honesty where it is not.
- **Check:**
  - Throttle the network to Slow 3G. Status changes are instant, while a refund button shows a
    spinner.
  - Force a 409 response: the value reverts and the toast explains why.
- **Kit:** `MET`. `useOptimisticState(confirmed)` shows a change at once, puts the old value back with
  an error toast when the server refuses or the request fails, and follows the server's value
  after a refresh. `toastUndo({ title, onUndo })` confirms with one Undo for 10s.
- **Sources:** [linear-undo]

**FBK-4. Response-time feedback.**

| Duration | Feedback |
| --- | --- |
| Under 100ms | Nothing. |
| 100ms – 1s | The button's `loading` state, keeping its width. |
| 1s – 10s | Skeleton for content, spinner plus verb on the button ("Refunding…"). |
| Over 10s | A job with a progress bar and percentage (FBK-6). |

- **Why:** NN/g's response-time limits and progress-indicator guidance.
- **Check:** nothing shows a spinner for an instant action. Nothing over 10s blocks the page
  with a spinner.
- **Kit:** `MET` for button loading and skeletons. Jobs are a `GAP` (FBK-6).
- **Sources:** [nng-response] [nng-progress]

**FBK-5. Concurrent edits: a Notice appears when a record changed while it was open.**

- **Rule:** the Notice reads "This order was updated by Sara K. 2 min ago · Reload". Saving over
  someone else's change returns 409 and shows the Notice. It never silently overwrites.
- **Why:** two staff members on one refund is a real risk in a shared queue.
- **Check:** edit the same record in two tabs. The second save is refused with a Notice.
- **Kit:** `MET` for the display (`Notice`). Detection is `APP`.
- **Sources:** [atl-section-message] [carbon-readonly]

**FBK-6. Long jobs (imports, exports, bulk refunds, payout runs) run in the background with
visible progress.**

- **Rule:**
  - Starting a job shows a toast ("Import started · View").
  - A **Jobs** entry in the top bar shows a count of running jobs.
  - The job page shows a progress bar, "312 of 1,200", a per-row error list and a downloadable
    error CSV.
  - Results are partial-success aware: "1,180 imported, 20 failed · Download errors".
- **Why:** NN/g says to use percent-done for waits over 10s. Staff should not have to keep a tab
  open.
- **Check:** start an import and navigate away. The Jobs indicator shows progress, and the
  finished job lists failures.
- **Kit:** `GAP`. There is no `ProgressBar`, `JobStatus` or top-bar jobs indicator.
- **Sources:** [nng-progress] [carbon-notif]

**FBK-7. Step-up re-authentication for high-risk actions.**

- **Rule:**
  - Applies to: issuing payouts, refunds over a threshold, changing a staff role, changing bank
    details, exporting personal data, and cancelling a live sale.
  - The person's action stays in place. A dialog titled "Confirm it's you" asks for a TOTP code
    or a passkey (no password-only fallback for staff). Then the original action continues
    automatically.
  - The step-up lasts **15 minutes** of sliding window for staff. That is shorter than GitHub's
    2h, because these are money tools.
  - A wrong code shows an inline error, not a toast.
  - The dialog says what is being confirmed: "to issue £4,210.00 in payouts".
  - The code field uses `autocomplete="one-time-code"` and allows paste.
- **Why:** GitHub sudo mode is the reference. WCAG 3.3.8 forbids blocking paste in
  authentication.
- **Check:**
  - Trigger a payout after 20 minutes idle: the dialog appears, and after the code the payout
    proceeds without re-clicking.
  - Paste works in the code field.
- **Kit:** `PARTIAL`. `StepUpDialog` ("Confirm it's you", saying what is being confirmed),
  `StepUpNotice`, `useStaffStepUp()` and `isStaffStepUpRequired()` answer the shared
  `step_up_required` contract (`@auction/identity-contracts/staff-step-up`, 15-minute window).
  The code is entered on the hosted sign-in page, which returns the person to the page; the
  original action does not resume by itself, so they repeat it.
- **Sources:** [github-sudo] [stripe-security] [wcag-accessible-auth]

---

## 6. Element craft

### Buttons

**CRF-1. Button hierarchy: one primary per view, then secondary, ghost and danger.**

| Variant | Look | Use |
| --- | --- | --- |
| Primary | Ink fill, on-ink text | The one next step in a page, panel or dialog |
| Secondary | Surface, 1px strong border, xs shadow | Other page actions, filters |
| Ghost | Transparent, hover overlay | Toolbars, rows, icon buttons |
| Danger | Solid red, white text | The confirm button of a destructive dialog only |
| Danger-secondary | Surface with red text | Destructive entry points, such as a Danger zone row |

- **Rule:**
  - Never place two primary buttons in one view.
  - Never put a danger-solid button on a page. Only use it in the dialog that confirms the
    action.
- **Check:** count primary buttons per view (at most 1). Red fills appear only inside dialogs.
- **Kit:** `MET` (`StaffButton` variants).
- **Sources:** [polaris-page-actions] [primer-delete]

**CRF-2. Button sizes and anatomy.**

- **Rule:**
  - Heights: `sm` 32px (toolbars, tables) and `md` 36px (forms, page header). Icon buttons are
    24, 32 or 36px.
  - Label: 13px, weight 500, sentence case, verb first ("Add tracking").
  - Icons are 16px with a 6px gap. Horizontal padding is 12px (`sm`) or 14px (`md`).
  - Coarse pointers grow to 44px.
  - Loading replaces the leading icon with a spinner, keeps the width, and sets `aria-busy`.
  - Icon-only buttons have an `aria-label` and a tooltip that includes the shortcut.
- **Check:**
  - Measure 32 or 36px.
  - No Title Case labels.
  - Every icon-only button shows a tooltip on hover and focus.
- **Kit:** `MET` (sizes, `staff-target`, loading, `StaffTooltip shortcut`).
- **Sources:** [carbon-input-style] [fluent-icons]

**CRF-3. Every interactive element has all of these states: default, hover, active or pressed,
focus-visible, disabled, loading (for actions), selected or open (for toggles and menus), and
invalid (for fields).**

- **Check:** tab through a page and hover each control. Each state is visibly different, and
  disabled differs from read-only.
- **Kit:** `MET` for buttons, field boxes, checkbox, radio and switch (`data-[state=open]`,
  `aria-invalid`, read-only shown as sunken).
- **Sources:** [carbon-disabled] [carbon-readonly]

### Inputs and choice controls

**CRF-4. Form control boundary has ≥ 3:1 contrast against its background.**

- **Rule:** this covers input borders, checkbox and radio borders and the switch track when off.
  Hover darkens the border, and focus adds the 2px ring.
- **Why:** WCAG 1.4.11.
- **Measured:**
  - The hairline `line-strong` (`#d0d0ce` on white) is 1.54:1, and 1.69:1 in dark mode
    (`#3d4141` on `#181a1a`). It is for cards and tables only and must never be a control's
    only edge.
  - `control-border` is 3.35:1 on white and 3.01:1 on sunken in light mode, and 3.59:1 on
    surface and 3.25:1 on raised in dark mode. Its hover step is 4.37:1 or more.
- **Check:** use a contrast checker on the input border and on the switch-off track against the
  card surface.
- **Kit:** `MET`. `--color-staff-control-border` (`#8a8d8d` light, `#6e7272` dark) and a darker hover
  step draw input, select, picker, money-input, checkbox and radio borders and the switch's off
  track. `tokens.test.ts` checks both tokens keep 3:1 against canvas, surface, sunken and raised in
  both schemes, and the switch thumb keeps 3:1 against its off track.
- **Sources:** [wcag-nontext] [carbon-input-style] [webaim-contrast]

**CRF-5. Field anatomy.**

- **Rule:**
  - Height 36px (32px in toolbars), radius 6px, horizontal padding 12px.
  - Value at 14px (13px in the `sm` size).
  - Leading and trailing slots hold 16px icons or units.
  - Read-only fields have a sunken background with no hover.
  - Disabled fields have a sunken background with disabled text, and are skipped from
    submission.
- **Check:** all fields in a row share the same height and baseline.
- **Kit:** `MET` (`staffFieldBox`, `TextInput` sizes, read-only style).
- **Sources:** [carbon-input-style] [carbon-readonly]

**CRF-6. Checkboxes and radios are 16px with a ≥ 24px hit area. Switches are 32×20px.**

- **Rule:** the label is part of the hit target (`ChoiceRow`, 32px row).
- **Check:** click the label to toggle. In tables, see TBL-15.
- **Kit:** `MET` in forms (`ChoiceRow`) and in table cells (TBL-15).
- **Sources:** [wcag-target]

### Badges and status

**CRF-7. A status badge carries colour, shape and text, and the text alone must be enough.**

- **Rule:**
  - Height 20px, radius 4px, 12px label at weight 500, sentence case, 6px dot.
  - One status map per domain, such as `defineStatusMap(orderStatus)`. A status the code does not
    know renders as neutral with a humanised label.
  - Tone meanings:

    | Tone | Meaning |
    | --- | --- |
    | Success | Done and good |
    | Info | In progress, waiting on us |
    | Warning | Needs attention soon |
    | Danger | Failed or blocked |
    | Neutral | Draft, archived or inactive |

  - **Shape by lifecycle**, so tones never need to be told apart by hue:

    | Shape | Lifecycle |
    | --- | --- |
    | Hollow ring | Not started or draft |
    | Filled dot | Active or in progress |
    | ✓ | Complete |
    | ! | Failed or blocked |
    | Pulsing dot | Live now (Bid only) |

  - At most 2 badges per row. The status column is not truncated.
- **Why:** WCAG 1.4.1, and Polaris keeps progress explicit in the label.
- **Check:**
  - Grey-scale the screenshot. Every status is still readable by its label and shape.
  - No badge says "Status: Paid".
- **Kit:** `PARTIAL`. Tint, dot, label, `defineStatusMap`, a neutral fallback and `live` pulse
  exist. All tones use the same dot shape: add `shape` (ring, dot, check, alert).
- **Sources:** [polaris-badge] [polaris-badge-migrate] [wcag-use-of-color]

**CRF-8. Counts and labels are different things.**

- **Rule:**
  - A count is a 20px pill with digits only and tabular figures.
  - A tag is user-defined, carries no tone and uses the neutral style.
  - A status badge is a domain state.
  - Never use a status badge for a count, or a pill for a status.
- **Check:** the visual language is consistent across both tools.
- **Kit:** `MET` (`Count`, `StatusBadge`). There is no `Tag` component, which matters only if
  tags are added.
- **Sources:** [primer-navlist]

### Icons

**CRF-9. One icon set (lucide), one stroke (1.75), and three sizes: 14, 16 and 20px.**

- **Rule:**
  - 14px inside badges, chips and compact buttons.
  - 16px in controls, nav and menus.
  - 20px in empty states.
  - Icons inherit `currentColor`. Decorative icons are `aria-hidden`.
  - No 12px icon is ever an interactive target on its own.
  - Never use an icon alone in a menu item or nav item without its label, except in the
    collapsed rail with a tooltip.
- **Why:** Fluent says 12px is too small to interact with. One stroke weight keeps density calm.
- **Check:** inspect the SVGs: stroke 1.75, size 14, 16 or 20.
- **Kit:** `MET` (`[data-staff-ui] svg.lucide { stroke-width: 1.75 }`, `STAFF_ICON`).
- **Sources:** [fluent-icons]

### Focus, spacing, type, elevation, motion, dark mode

**CRF-10. The focus ring is a 2px ink outline, offset 2px (inset −2px for rows and cells), shown
on `:focus-visible` only.**

- **Rule:**
  - Focus is never hidden under sticky bars: use `scroll-padding-top: 52px+header` and
    `scroll-padding-bottom: 72px` when a bulk bar is shown.
  - Ink on canvas is 16.3:1.
- **Why:** WCAG 2.4.7 and 2.4.11 at AA. The ring also meets 2.4.13 (AAA) because it is ≥ 2px
  with ≥ 3:1 change.
- **Check:**
  - Tab through a page: every stop shows the ring.
  - Tab to the bottom rows with the bulk bar open: the focused row is never fully covered.
- **Kit:** `MET`. The ring (`staff-focus`, `staff-focus-inset`), and scroll padding from the theme:
  52px for the top bar, 36px more while a sticky table header is on the page, and 72px at the
  bottom while the bulk-action bar shows. Keyboard row moves scroll with `block: "nearest"`, which
  honours it.
- **Sources:** [wcag-focus-appearance] [wcag-focus-obscured]

**CRF-11. Spacing uses the 4px grid only: 4, 8, 12, 16, 20, 24, 32, 40, 48.**

| Context | Value |
| --- | --- |
| Inside controls | 8px gaps |
| Field to field | 16px |
| Sections inside a card | 24px |
| Cards in a page | 16px (dense) or 24px |
| Page gutter | 16px on phone, 32px on desktop |
| Page max width | 1280px. Tables may go full width. |

- **Check:** an overlay grid at 4px. No odd values except 2px optical nudges.
- **Kit:** `MET` (`STAFF_SPACING_STEPS`, enforced in `tokens.test.ts`).
- **Sources:** [atl-spacing] [fluent-layout]

**CRF-12. The type scale is for dense UI.**

| Size | Use |
| --- | --- |
| 11/16 | Digits in counts and `kbd` only |
| 12/16 | Column headers, hints, badges, captions |
| **13/20** | Default UI text: tables, menus, nav |
| 14/20 | Form values, panel body, section titles |
| 16/24 | Panel and dialog titles (Montserrat) |
| 20/28 | Page titles (Montserrat) |

- **Rule:**
  - Weights are 400, 500 and 600 only.
  - No all-caps labels. Column headers are sentence case at 12px weight 500, muted.
  - Long-form reading (editorial previews, enquiry messages) uses 14/22 with a 72ch maximum
    width.
- **Why:** Carbon's productive set uses 12/16 for labels and 14/18 for body. Atlassian sets the
  floor at 12px.
- **Check:** no words at 11px. No text above 20px except on the dashboard's KPI values.
- **Kit:** `PARTIAL`. The scale is defined, and `2xs` (11px) is documented for digits in counters and
  `kbd` glyphs only. The 14/22 reading style is missing.
- **Sources:** [carbon-type] [atl-type]

**CRF-13. Four elevation levels, plus a hairline.**

| Level | Shadow | Use |
| --- | --- | --- |
| 0 | Flat with a hairline | Page, cards, tables |
| xs | xs | Secondary buttons |
| md | md | Menus, popovers, tooltips, the bulk bar |
| lg | lg plus scrim | Dialogs, sheets, ⌘K |

- **Rule:**
  - Never put a shadow on a card that sits in the page.
  - In dark mode, raised surfaces get **lighter**, not just a darker shadow.
- **Why:** Apple's base and elevated colours: shadows read poorly on dark backgrounds.
- **Check:** in dark mode, a menu over a card is visibly lighter than the card.
- **Kit:** `MET` (`canvas` → `surface` → `raised`, `shadow-staff-*`).
- **Sources:** [apple-dark]

**CRF-14. Motion is quick and functional, and reduced motion is respected.**

| Interaction | Duration and easing |
| --- | --- |
| Hover and colour | 100–150ms ease-out |
| Menus and popovers | 150ms enter, 100ms exit |
| Panels and dialogs | 200ms enter with decelerate, 150ms exit |

- **Rule:**
  - Never animate layout in tables.
  - No bouncy or spring easing.
  - Under `prefers-reduced-motion`, everything is instant.
  - The `live` pulse is the only looping animation apart from loaders.
- **Why:** Atlassian says exits should be 50–100ms shorter than entrances. All-day tools should
  not perform.
- **Check:** record a panel opening: about 200ms. With reduced motion turned on, nothing slides.
- **Kit:** `PARTIAL`. Reduced motion and 150ms transitions exist. There are no `--duration-*`
  or `--ease-*` tokens, so the timings sit in each component.
- **Sources:** [atl-motion] [m3-motion]

**CRF-15. Dark mode is a first-class theme.**

- **Rule:**
  - Every colour is a `light-dark()` pair.
  - Text keeps ≥ 4.5:1 contrast, and control boundaries keep ≥ 3:1.
  - Status tints become translucent fills.
  - Images and artwork thumbnails get a 1px inner hairline so dark artworks don't merge into the
    surface.
  - The theme follows the system by default, with an override in the account menu.
- **Check:**
  - Audit every screen in both themes.
  - Artwork thumbnails have a visible edge on dark.
  - The Bid accent bar is still visible in dark (it falls back to ink).
- **Kit:** `MET` for tokens and the theme switch. Thumbnail hairlines are `APP`.
- **Sources:** [apple-dark] [wcag-nontext]

**CRF-16. Text contrast is at least 4.5:1 for all text, including muted, subtle, placeholder and
badge text.**

- **Measured:**

  | Pair | Ratio |
  | --- | --- |
  | `subtle` on canvas, light | 5.17 |
  | `subtle` on surface, dark | 5.36 |
  | `muted` on sunken | 5.9 |
  | Warning badge | 6.67 |
  | Neutral badge | 8.1 |
  | Danger-solid with white, dark | 5.37 |

  Disabled text (2.31:1) is exempt.
- **Check:** run axe on each page in both themes. There must be zero contrast violations.
- **Kit:** `MET`.
- **Sources:** [webaim-contrast]

**CRF-17. Every pointer target is at least 24×24px, and 44px on coarse pointers.**

- **Why:** WCAG 2.5.8.
- **Check:** measure close buttons, chip remove buttons, copy buttons and sort buttons.
- **Kit:** `MET`. `icon-xs` is 24px and `staff-target` provides 44px on touch. The filter chip's remove
  button looks 20px and hits 24px.
- **Sources:** [wcag-target]

---

## 7. Permissions

**PRM-1. Hide what the role can never do.**

- **Rule:**
  - Hide nav items, page actions and menu items the role can never use. This applies to Finance
    as well as Catalogue.
  - A URL opened without access shows a "You don't have access to Payouts" page that names the
    role required and who to ask. It is not a 404, and not an empty list.
- **Why:** this cuts clutter, while the access page explains a shared link.
- **Check:** sign in as each role. The nav lists only reachable pages. Paste a forbidden URL and
  you see the access page.
- **Kit:** `APP`. `AccessDeniedState` (also `access="denied"` on `ListPage` and `DetailPage`)
  draws the access page; deciding what each role sees stays with the app.
- **Sources:** [carbon-disabled] [uxtigers-inactive]

**PRM-2. Disable with a reason what this record's *state* blocks.**

- **Rule:**
  - For example, "Refund" on an unpaid order.
  - Use `aria-disabled` (keeps focus) and a tooltip or hint with the reason: "Refunds open once
    payment settles."
  - When the block affects the primary action, show a `Notice` above the section saying how to
    unblock it.
- **Why:** Carbon recommends an inline notice when a disabled item affects the primary action.
  Native `disabled` cannot be focused to read the reason.
- **Check:** tab to a disabled action. It takes focus and announces its reason.
- **Kit:** `MET`. `StaffButton disabledReason` switches to `aria-disabled`, stays focusable, swallows
  presses and shows the reason in a tooltip on hover and focus. `StaffMenuItem` and
  `OverflowAction` take `disabledReason` and show it under the label. Showing a `Notice` when the
  primary action is blocked is `APP`.
- **Sources:** [carbon-disabled] [uxtigers-inactive]

**PRM-3. View-only access shows data read-only, not as disabled inputs.**

- **Rule:**
  - Render `KeyValueList` (or read-only fields) instead of a greyed form.
  - Show a quiet label in the page header: "View only · Finance".
  - Remove Save buttons. Don't disable them.
- **Why:** Carbon reserves read-only for content that is still relevant. Text stays at full
  contrast and stays copyable.
- **Check:** as a view-only role, there are no disabled inputs, all values can be selected and
  copied, and the header says View only.
- **Kit:** `MET`. Read-only field styling, `KeyValueList`, and `ViewOnlyBadge`, which
  `access="read-only"` on `ListPage` and `DetailPage` shows in the header while dropping the
  primary action and row selection.
- **Sources:** [carbon-readonly]

**PRM-4. Actions check permissions on the server. The UI only mirrors those rules.**

- **Rule:** a permission error from the server shows a Notice ("Your role can't issue refunds
  over £500"), never a raw 403.
- **Check:** force a 403. The message is human-readable and names the limit.
- **Kit:** `APP`.
- **Sources:** [carbon-disabled]

---

## 8. Dashboards and overviews

**DSH-1. Overview is a work inbox first and a scoreboard second.**

- **Rule:**
  - The top of Overview is a **"Needs attention"** list: queues with counts and age, each
    linking to a filtered view. Examples:
    - "7 orders paid > 48h, not packed".
    - "3 KYC reviews waiting · oldest 2d".
    - "2 payouts failed".
  - Each queue is sorted by urgency.
  - An empty queue disappears. When all are empty, show "Nothing needs you right now".
- **Why:** Intercom's inbox and Linear's "My issues" are where staff start. KPI tiles do not tell
  anyone what to do next.
- **Check:**
  - Every item on Overview links to a list filtered to exactly that count.
  - No queue shows a zero.
  - The page differs by role.
- **Kit:** `MET`. `AttentionList` shows each queue's count, label and oldest age as a link to the
  filtered list, hides empty queues, caps at 999+, and says "Nothing needs you right now" when
  all are clear. Which queues each role sees is `APP`.
- **Sources:** [intercom-inbox] [linear-nav]

**DSH-2. KPI tiles only when someone acts on the number.**

- **Rule:**
  - Use at most 4 tiles. Each has a label, a value in tabular figures, and a comparison with its
    period ("vs last 7 days").
  - No sparklines without axes. No charts on operational pages.
  - Tiles link to the list behind the number.
  - Finance pages may show more tiles. Fulfilment does not need any.
- **Why:** tiles without a decision attached are decoration and slow the page.
- **Check:** for each tile, ask "who changes what when this moves?" If there is no answer,
  remove it.
- **Kit:** `MET`. `MetricStrip`: at most four metrics in one bordered row, the period stated, a
  comparison only when given, with a ▲/▼ glyph and a spoken direction so tone is never the only
  cue, and metrics that link to the list behind them. `StatGrid` remains for record pages.
- **Sources:** [polaris-details] [wcag-use-of-color]

**DSH-3. Counts in the nav, on Overview and on view tabs agree, and each is labelled as yours or
everyone's.**

- **Check:** the nav count for Refunds matches the "Needs attention" refund count and the
  refunds tab count.
- **Kit:** `APP`.
- **Sources:** [primer-navlist]

---

## 9. Productivity

**PRD-K1. A shortcut set staff can learn in a day.**

| Scope | Keys |
| --- | --- |
| Global | `⌘K` search · `?` shortcuts help · `g` then `o` Orders, `g` then `l` Lots (go-to chords) · `/` focus list search |
| Lists | `↑ ↓` or `j k` move · `↵` open · `x` or `Space` select · `⇧`+click range · `Esc` clear · `⌘↵` open in new tab |
| Records | `j k` previous or next record (NAV-6) · `e` edit · `⌘S` save · `⌘C` copy record ID when nothing is selected · `Esc` close panel |

- **Rule:**
  - Single-character shortcuts work only when focus is not in a text field. They can be turned
    off in the account menu (WCAG 2.1.4).
  - Never take over browser or screen-reader keys.
  - Every shortcut duplicates a visible control.
- **Why:** Primer's shortcut rules, and the WCAG character-key rule.
- **Check:**
  - Typing "g" in a text field types "g".
  - The account menu has "Keyboard shortcuts: on/off".
  - Every shortcut action has a clickable equivalent.
- **Kit:** `MET`. `StaffShortcutsProvider` (mounted by `StaffShell`) with `useStaffShortcut` handles
  single keys, modifier combinations and two-key sequences (`g` then `o`), never fires
  single-key shortcuts while typing, and lets people turn them off from the account menu. The kit
  binds `?` (sheet), `/` (`TableSearch`), J, K, X and Shift+click in lists, and J and K in
  `RecordPager`. Each tool's `g` go-to chords are `APP`.
- **Sources:** [primer-kbd] [wcag-char-key] [linear-kbd-help] [intercom-cmdk]

**PRD-K2. Teach shortcuts where actions live.**

- **Rule:**
  - Tooltips show the key: "Edit `E`".
  - Menu items show their key right-aligned.
  - The ⌘K footer shows the navigation keys.
  - `?` opens a searchable sheet grouped by scope.
- **Why:** Linear's searchable `?` help. The tooltip is where people learn.
- **Check:** hover the main record actions. Each tooltip shows its shortcut. `?` opens the sheet.
- **Kit:** `MET`. `StaffTooltip shortcut`, `Kbd`, `ShortcutKeys`, the ⌘K footer, a `shortcut` slot on
  `StaffMenuItem` and `OverflowAction`, and the searchable `?` sheet (`ShortcutsDialog`) built
  from the registry.
- **Sources:** [linear-kbd-help] [primer-kbd]

**PRD-K3. Quick actions in ⌘K are context-aware.**

- **Rule:**
  - On a record, ⌘K lists that record's actions first ("Mark packed", "Refund…", "Copy order
    ID").
  - On a list with a selection, it lists the bulk actions.
  - Each action has its own permission check.
- **Why:** Intercom's ⌘K holds Snooze, Assign and the layout switch, so it doubles as a menu for
  the current view.
- **Check:** open ⌘K on an order. The first group is "This order".
- **Kit:** `PARTIAL`. `commands` are passed in by the shell. There is no per-page registration
  API (`useStaffCommands`).
- **Sources:** [intercom-cmdk] [linear-nav]

**PRD-K4. Copying an ID is one action everywhere.**

- **Rule:** use the copy button on record pages (PRD-4), in the row `…` menu ("Copy ID"), in ⌘K
  on a record, and with `⌘C` on a focused row.
- **Check:** copy the same order ID four ways and paste it each time. The four results are
  identical.
- **Kit:** `PARTIAL` (`KeyValueList` only).
- **Sources:** [stripe-security]

---

## 10. Mobile and tablet

**MOB-1. These must work on a phone (375px):**

- Search and open any record.
- Read a record's status, amounts and timeline.
- Approve or reject a queue item: KYC, an enquiry reply or a refund request.
- Mark fulfilment steps: packed, shipped, tracking.
- Live-sale monitoring in **read** mode.
- Step-up and sign-in.

**Why:** gallery staff work on the floor and at art fairs. Auction staff check bids away from a
desk.

**Check:** do each task at 375px, both one-handed and with a keyboard (WCAG 1.4.10 reflow, with
no sideways scroll except inside tables).

**Kit:** `MET` for the building blocks: drawer nav below 1024px, stacked list tables, full-width
panels, 44px coarse targets, actions under the title, and the breadcrumb collapse.

**Sources:** [wcag-reflow] [polaris-index-table]

**MOB-2. These may degrade on a phone, but must say so rather than break:**

- Bulk editing beyond select-and-act.
- Column management and saved-view editing.
- Imports.
- Rich editorial editing.
- The live-auction **clerking** console.

For those, show a Notice: "Live clerking needs a screen at least 1024px wide." Tablets at 768px
and above get the full table layout and the panel.

**Check:** open the live console at 375px. You see the Notice and a read-only view, not a broken
layout.

**Kit:** `APP`.

**Sources:** [polaris-index-table]

**MOB-3. Tablet (768–1023px): drawer nav, full tables with priority columns, and panels at 480px
over the list. The sticky first column is required here (TBL-3).**

**Check:** at 820px, the identifier column stays visible on horizontal scroll.

**Kit:** `MET` (TBL-3: `stickyFirstColumn`).

---

## Kit roadmap

Kit work in priority order. **Done** items are in `@auction/staff-ui`; the rule they serve
records how. **Open** items are still to build.

### P0: accessibility failures or data-loss risk

1. **Done.** **Control-border contrast.** `--color-staff-control-border` and its hover step draw
   every form control's edge at 3:1 or more; `line-strong` stays for hairlines and secondary
   buttons. (CRF-4)
2. **Done.** **Selection cell hit area.** The whole checkbox cell toggles selection and never
   opens the row. (TBL-15)
3. **Done.** **`FormErrorSummary` focus.** Focus on appearing or per failed submit (`focusKey`),
   links that focus their field, and the "There is a problem" title. (FRM-4)
4. **Done.** **Unsaved-changes guard.** `useUnsavedChanges`, `UnsavedChangesDialog`,
   `UnsavedChangesGuard` and `confirmDiscardChanges`, wired to the `StaffShell` ⌘K, `DetailPanel`
   and `beforeunload`. Both admins use it. (FRM-9)
5. **Done.** **Focus not obscured.** Scroll padding for the top bar, a sticky table header and the
   bulk-action bar. (CRF-10, TBL-7)

### P1: daily speed and error prevention

1. **Done.** **Sticky table header and sticky first column** (`stickyHeader`,
   `stickyFirstColumn`). (TBL-3)
2. **Done.** **Sort behaviour.** `defaultSort`, `defaultSortDirection`, and a click that only
   toggles direction. (TBL-4)
3. **Done.** **Select all matching, and range select.** `selectAllMatching`, Shift+click and
   Shift+X ranges, X to select, row menus disabled in batch mode, and select-all in the bar on a
   phone. (TBL-7, TBL-16)
4. **Done.** **Step-up.** `StepUpDialog`, `StepUpNotice`, `useStaffStepUp()` and
   `isStaffStepUpRequired()` for the `step_up_required` contract. Open: resuming the action
   automatically after the fresh sign-in. (FBK-7)
5. **Done.** **`RecordPager`.** "‹ 3 of 50 ›" with J and K, and `recordPosition()`. (NAV-6)
6. **Done.** **`ConfirmActionDialog` upgrades.** Cancel focused first, a `reason` field and a
   `typedConfirmation` variant. (FRM-12)
7. **Done.** **Undo and optimistic updates.** `toastUndo({ title, onUndo })` (10s, pauses on
   hover) and `useOptimisticState` with rollback and an error toast. (FBK-1, FBK-3)
8. **Done.** **Truncation tooltip.** `DataColumn.truncate` (`"end"`, `"middle"`, `false`) and
   `TruncatedText`. (TBL-14)
9. **Done.** **`disabledReason`** on `StaffButton`, `StaffMenuItem` and `OverflowAction`. (PRM-2)
10. **Done.** **Shortcut system.** `StaffShortcutsProvider`, `useStaffShortcut`, the `?`
    `ShortcutsDialog`, sequences such as `g` then `o`, `/` for list search, the account-menu
    switch for single-key shortcuts, and a shortcut slot on menu items. (PRD-K1, PRD-K2)
11. **Done.** **`AttentionList`** for Overview pages. (DSH-1)
12. **Done.** **Formatting helpers.** `formatStaffDate`, `formatStaffTime`,
    `formatStaffDateTime({ zoneLabel })`, `formatStaffMoney`, `formatStaffRelative` and
    `RelativeTime`. (TBL-13)
13. **Done.** **`DateInput` and `DateTimeInput`.** (FRM-10)
14. **Open.** **⌘K recents and context.** A "Recent" group from local history, a
    `useStaffCommands()` hook so pages register their own actions, and an exact-ID boost hook.
    (NAV-4, PRD-K3)

### P2: consistency and polish

1. **Open.** **`StatusBadge` `shape`** (ring, dot, check, alert), defined once in each domain's status map.
   (CRF-7)
2. **Done.** **Column visibility menu** (`ColumnsMenu`, `useColumnVisibility`), remembered per list, with "Reset columns". (TBL-12)
3. **Open.** **Filter set completion.** `FilterSheet` holds checklist, single-select and date sections; an amount-range section is still
   to come. (TBL-5)
4. **Open.** **Page-size control** in `TablePagination` (25, 50, 100). (TBL-10)
5. **Open.** **`CopyButton` / `CopyableId` exported** for headers, cells and menus. (PRD-4, PRD-K4)
6. **Open.** **Motion tokens:** `--duration-staff-fast` 100, `-base` 150, `-panel` 200, and
   `--ease-staff-out` / `-in`. (CRF-14)
7. **Open.** **Type.** Restrict `text-staff-2xs` to digits and `kbd`. Add a 14/22 `prose` style for
   reading text. (CRF-12)
8. **Done.** **Filter-chip remove button** has a 24px target. (CRF-17)
9. **Done.** **Comparison glyphs:** ▲ and ▼ with a spoken direction, in `MetricStrip`. (DSH-2)
10. **Open.** **Wizard parts:** `StepIndicator` and `ReviewList` ("Check your answers"). (FRM-13)
11. **Open.** **`ProgressBar` and `JobStatus`**, plus a top-bar jobs indicator slot. (FBK-6) This is P2 for
    the kit, but promote it to P1 when imports or bulk payouts ship.
12. **Done.** **"View only" marker** (`ViewOnlyBadge`) and `AccessDeniedState`. (PRM-1, PRM-3)
13. **Done.** **`DetailPage`:** header, summary, then a 2fr/1fr main and rail that stacks below 1280px. (PRD-3)

---

## Audit checklist (one pass per screen)

1. **Light, dark and 375px screenshots.** Check contrast, control borders (CRF-4) and that
   status labels can be read in grey-scale.
2. **Tab through everything.** Check the focus ring, focus order, focus return after
   panels and dialogs, and that focus is not hidden by sticky bars.
3. **States.** Check loading, refetch, empty, no-results and error (TBL-11), plus every
   button's loading state.
4. **One primary action per view.** Confirm buttons name the verb and amount.
5. **URL.** Check that filters, view, page, tab and open panel survive a reload and Back.
6. **Each role.** Check what is hidden, what is disabled with a reason, and what is
   view-only.
7. **Money and time.** Check right alignment, tabular figures, `£` and two decimals,
   London time, and the zone label where time matters.
8. **Keyboard power.** Check ⌘K finds the record by ID, J/K, `?`, and that IDs can be
   copied.

---

## Sources

[atl-designing-messages]: https://atlassian.design/content/designing-messages
[atl-dynamic-table]: https://atlassian.design/components/dynamic-table
[atl-messages]: https://atlassian.design/patterns/messages/
[atl-motion]: https://atlassian.design/foundations/motion/applying-motion
[atl-nav-jira]: https://developer.atlassian.com/cloud/jira/platform/navigation/
[atl-section-message]: https://atlassian.design/components/section-message
[atl-spacing]: https://atlassian.design/foundations/spacing
[atl-type]: https://atlassian.design/foundations/typography/applying-typography
[apple-dark]: https://developer.apple.com/design/human-interface-guidelines/dark-mode
[carbon-disabled]: https://carbondesignsystem.com/patterns/disabled-states/
[carbon-dt]: https://carbondesignsystem.com/components/data-table/usage/
[carbon-dt-style]: https://carbondesignsystem.com/components/data-table/style
[carbon-empty]: https://carbondesignsystem.com/patterns/empty-states-pattern/
[carbon-input-style]: https://carbondesignsystem.com/components/text-input/style
[carbon-notif]: https://carbondesignsystem.com/components/notification/usage/
[carbon-notif-pattern]: https://carbondesignsystem.com/patterns/notification-pattern
[carbon-readonly]: https://carbondesignsystem.com/patterns/read-only-states-pattern/
[carbon-type]: https://carbondesignsystem.com/elements/typography/type-sets/
[fluent-icons]: https://fluent2.microsoft.design/iconography
[fluent-layout]: https://fluent2.microsoft.design/layout
[github-sudo]: https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/sudo-mode
[govuk-dates]: https://design-system.service.gov.uk/patterns/dates
[govuk-error-message]: https://design-system.service.gov.uk/components/error-message
[govuk-error-summary]: https://design-system.service.gov.uk/components/error-summary
[govuk-question]: https://design-system.service.gov.uk/patterns/question-pages
[govuk-validation]: https://design-system.service.gov.uk/patterns/validation
[intercom-cmdk]: https://www.intercom.com/help/en/articles/6272267-how-to-use-command-k-with-intercom-help-desk
[intercom-inbox]: https://www.intercom.com/help/en/articles/6258745-the-help-desk-explained
[linear-kbd-help]: https://linear.app/changelog/2021-03-25-keyboard-shortcuts-help
[linear-nav]: https://linear.app/enablement/guide/navigating-linear
[linear-undo]: https://linear.app/changelog/undo-actions
[m3-motion]: https://m3.material.io/styles/motion/easing-and-duration/tokens-specs
[m3-snackbar]: https://m3.material.io/components/snackbar/guidelines
[nng-confirm]: https://www.nngroup.com/articles/confirmation-dialog/
[nng-progress]: https://www.nngroup.com/articles/progress-indicators/
[nng-response]: https://www.nngroup.com/articles/response-times-3-important-limits/
[notion-peek]: https://www.notion.com/releases/2022-07-20
[polaris-badge]: https://polaris.shopify.com/components/feedback-indicators/badge
[polaris-badge-migrate]: https://shopify.dev/docs/apps/build/app-home/migrate-from-polaris-react/badge
[polaris-details]: https://polaris.shopify.com/patterns/resource-details-layout
[polaris-filters]: https://polaris.shopify.com/components/selection-and-input/index-filters
[polaris-index-filters-migrate]: https://shopify.dev/docs/apps/build/app-home/migrate-from-polaris-react/index-filters
[polaris-index-table]: https://polaris.shopify.com/components/index-table
[polaris-index-template]: https://shopify.dev/docs/api/app-home/patterns/templates/index
[polaris-page-actions]: https://polaris.shopify.com/components/actions/page-actions
[polaris-select-all]: https://shopify.dev/docs/apps/build/app-home/migrate-from-polaris-react/select-all-actions
[polaris-toast]: https://polaris.shopify.com/components/deprecated/toast
[primer-delete]: https://primer.style/product/scenario-patterns/delete
[primer-dt]: https://primer.style/product/components/data-table/
[primer-kbd]: https://primer.style/accessibility/patterns/keyboard-shortcuts
[primer-navlist]: https://primer.style/components/nav-list
[primer-saving]: https://primer.style/ui-patterns/saving
[retool-rows]: https://docs.retool.com/apps/guides/data/table/rows
[salesforce-compact]: https://developer.salesforce.com/docs/atlas.en-us.218.0.salesforce1appadmin.meta/salesforce1appadmin/s1_admin_guide_compact_layouts_intro.htm
[spectrum-sidenav]: https://spectrum.adobe.com/page/side-navigation
[stripe-export]: https://support.stripe.com/questions/exporting-payment-data
[stripe-security]: https://docs.stripe.com/security
[uxtigers-inactive]: https://www.uxtigers.com/post/inactive-buttons
[vercel-geist]: https://vercel.com/geist
[wcag-accessible-auth]: https://www.w3.org/WAI/WCAG22/Understanding/accessible-authentication-minimum.html
[wcag-char-key]: https://www.w3.org/WAI/WCAG22/Understanding/character-key-shortcuts.html
[wcag-focus-appearance]: https://www.w3.org/WAI/WCAG22/Understanding/focus-appearance
[wcag-focus-obscured]: https://www.w3.org/WAI/WCAG22/Understanding/focus-not-obscured-minimum.html
[wcag-nontext]: https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html
[wcag-redundant]: https://www.w3.org/WAI/WCAG22/Understanding/redundant-entry.html
[wcag-reflow]: https://www.w3.org/WAI/WCAG22/Understanding/reflow.html
[wcag-status]: https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html
[wcag-target]: https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html
[wcag-timing]: https://www.w3.org/WAI/WCAG22/Understanding/timing-adjustable.html
[wcag-use-of-color]: https://www.w3.org/WAI/WCAG22/Understanding/use-of-color.html
[webaim-contrast]: https://webaim.org/articles/contrast/
