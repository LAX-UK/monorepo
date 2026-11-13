# Row click audit: every list in Bid admin, LAX Admin and the client workspace

Read-only audit of what a row click does on every list, checked in the code on 2026-11-13 and in the running apps with the seeded development data. The decision page is `row-click-design.html`; raw screenshots are in `shots/` (named `<app>-<list>-<width>-<list|panel|fullpage|drawer>.png`, light mode).

## Decision table

Recommendation key: **Page**: the row opens the record's full page. **Keep panel (improved)**: a work-queue panel with a URL, position, J/K stepping and "Open full page". **Panel removed**: the panel goes and the row does something simpler. **No change**: already follows the rule.

| Area | Module | Route | List component | Today | Recommendation | Reason |
|---|---|---|---|---|---|---|
| Bid admin | Lots | `/admin/lots` | `apps/web/src/components/admin/lots/lots-staff-list.tsx` | Panel (?lot=) | **Page** | The lot page has tabs and every action; the panel repeats the row and ends in “Open full page”. |
| Bid admin | Sales | `/admin/sales` | `apps/web/src/components/admin/sales/sales-staff-list.tsx` | Panel (?sale=) | **Page** | About 12 tabs on the sale page; the panel adds dates and a cover only. |
| Bid admin | Artists | `/admin/artists` | `apps/web/src/components/admin/artists/artists-staff-list.tsx` | Panel (?artist=) | **Page** | Record browser; the page holds lots, duplicates and review. |
| Bid admin | Categories | `/admin/categories` | `apps/web/src/components/admin/categories/categories-staff-list.tsx` | Panel (?category=) | **Page** | Record browser; the page holds children, lots, sales and activity. |
| Bid admin | Venues | `/admin/venues` | `apps/web/src/components/admin/venues/venues-staff-list.tsx` | Panel (?venue=) | **Page** | Record browser; contact details fit on the page header. |
| Bid admin | Submissions | `/admin/submissions` | `apps/web/src/components/admin/submissions/submissions-staff-list.tsx` | Panel (?submission=) | **Page** | The decision is made on the review page; the panel is a stop on the way (“Open review”). |
| Bid admin | Clients | `/admin/clients` | `apps/web/src/components/admin/people/clients-staff-list.tsx` | Panel (?client=) | **Page** | The panel adds email, mobile and an ID; everything else is on the client page. Sequence after #1351. |
| Bid admin | Staff directory | `/admin/staff` | `apps/web/src/components/admin/people/staff-directory-list.tsx` | Panel (?staff=) | **Page** | The panel adds email and ID only. |
| Bid admin | Staff invitations | `/admin/invitations` | `apps/web/src/components/admin/people/invitations-staff-list.tsx` | Panel (?invitation=) | **Keep panel (improved)** | Small record with no page; resend and revoke are quick actions. The panel is the whole record. |
| Bid admin | Legal entities | `/admin/legal-entities` | `apps/web/src/components/admin/legal-entities/legal-entities-staff-list.tsx` | Panel (?entity=, server-loaded) | **Page** | Six tabs on the record; the useful readiness summary moves to the page’s Overview. |
| Bid admin | Payments | `/admin/payments` | `apps/web/src/components/admin/payments/payments-staff-list.tsx` | Panel (?payment=) | **Keep panel (improved)** | Capture and refund are queue work; no payment page exists. Add “Open full page” once a payment page is built (open question 1). |
| Bid admin | Payments: manual review | `/admin/payments?manualReview=1` | `apps/web/src/components/admin/payments/manual-review-staff-list.tsx` | Panel (no URL) | **Keep panel (improved)** | A real queue: refund or release, one after another. Needs a URL and J/K stepping. |
| Bid admin | Payouts | `/admin/payouts` | `apps/web/src/components/admin/payouts/payouts-staff-list.tsx` | Panel (?payout=) | **Keep panel (improved)** | Finance queue (mark paid, retry). Touched by #1349, so change only after it merges. |
| Bid admin | Accounting queue | `/admin/finance/accounting` | `apps/web/src/components/admin/finance/accounting-queue-list.tsx` | Panel (no URL) | **Keep panel (improved)** | Retry queue; the panel shows the error. Needs a URL. |
| Bid admin | AML screening | `/admin/compliance/aml` | `apps/web/src/components/admin/compliance/aml-staff-list.tsx` | Panel (read on load only) | **Keep panel (improved)** | Recommend and decide in the panel: the clearest triage case. Needs a URL kept in step. |
| Bid admin | Source of funds | `/admin/compliance/source-of-funds` | `apps/web/src/components/admin/compliance/sof-staff-list.tsx` | Page | **No change** | Already opens the case page. |
| Bid admin | Onboarding issues | `/admin/onboarding-issues` | `apps/web/src/components/admin/onboarding/onboarding-issues-staff-list.tsx` | Panel (no URL after first click) | **Keep panel (improved)** | Queue, but the panel body is empty today. Show the blocker and the next action, or the panel has no purpose. |
| Bid admin | Condition report requests | `/admin/condition-reports` | `apps/web/src/components/admin/condition-reports/condition-reports-staff-list.tsx` | Panel (?request=) | **Keep panel (improved)** | Fulfil form in the panel; work is done row after row. |
| Bid admin | Lot fulfilment | `/admin/lot-fulfilment` | `apps/web/src/components/admin/lot-fulfilment/lot-fulfilment-staff-list.tsx` | Panel (?lot=) | **Keep panel (improved)** | Next step as the main button; a true queue. |
| Bid admin | Event RSVPs | `/admin/event-rsvps` | `apps/web/src/components/admin/event-rsvps/event-rsvps-staff-list.tsx` | Panel (?event=) | **Page** | The guest list page is where the work is; the panel adds a sale link and address. |
| Bid admin | Audit log | `/admin/audit` | `apps/web/src/components/admin/audit/audit-log-list.tsx` | Panel (?event=) | **Keep panel (improved)** | An event is small and read-only, with no page; investigators step through many. |
| Bid admin | Dashboard: work inbox | `/admin` | `apps/web/src/components/admin/personal-dashboard/work-inbox/work-inbox.tsx` | Panel (?item=) | **Keep panel (improved)** | Personal queue; actions sit in the panel. |
| Bid admin | Consignment inbox | `/admin/inbox` | `apps/web/src/components/admin/consignment-inbox/inbox-staff-list.tsx` | Page | **No change** | Already opens the thread. |
| Bid admin | Saved replies | `/admin/inbox/saved-replies` | `apps/web/src/components/admin/consignment-inbox/saved-replies-staff-list.tsx` | Edit dialog | **No change** | Small settings list; a dialog fits. |
| Bid admin | Disputes | `/admin/disputes` | `apps/web/src/components/admin/disputes/disputes-staff-list.tsx` | Page | **No change** | Already opens the case page. |
| Bid admin | Data requests | `/admin/compliance/data-requests` | `apps/web/src/components/admin/data-requests/data-requests-list.tsx` | Page | **No change** | Already opens the request page. |
| Bid admin | Enquiries | `/admin/enquiries` | `apps/web/src/components/admin/enquiries/enquiries-list.tsx` | Page | **No change** | Already opens the conversation. |
| Bid admin | Failed jobs | `/admin/failed-jobs` | `apps/web/src/components/admin/failed-jobs/failed-jobs-list.tsx` | Page | **No change** | Already opens the job page. |
| Bid admin | Private sales: deals | `/admin/private-sales` | `apps/web/src/components/admin/private-sales/deals-list.tsx` | Page | **No change** | Already opens the deal page. |
| Bid admin | Purchase problems | `/admin/purchase-problems` | `apps/web/src/components/admin/purchase-problems/purchase-problems-list.tsx` | Page | **No change** | Already opens the problem page. |
| Bid admin | Staff access review | `/admin/staff/access` | `apps/web/src/components/admin/people/staff-access-review-list.tsx` | Nothing | **Page** | Row should open the staff page; today only cell links work. |
| Bid admin | Saleroom hub | `/admin/saleroom` | `apps/web/src/components/admin/saleroom-hub-board/index.tsx` | Nothing (title link) | **Page** | Make the whole row open the saleroom, as the title already does. |
| Bid admin | Collections desk | `/admin/collections` | `apps/web/src/components/admin/collections/desk-list.tsx` | Nothing (Hand over button opens a panel) | **No change** | The hand-over panel is an action from a button, not a row click; keep it. |
| Bid admin | Unlinked originals | `/admin/settings/unlinked-originals` | `apps/web/src/components/admin/unlinked-originals/unlinked-originals-list.tsx` | Page (row is a link) | **No change** | Already a real link. |
| Bid admin | Related tables on record pages | `/admin/clients/[id], /admin/sales/[id] …` | `apps/web/src/components/admin/people/related-records-section.tsx` | Nothing (cell links only) | **Page** | Rows of related records should open that record, as in every list. |
| Bid admin | KYC history, email sends | `/admin/clients/[id], /admin/staff/[id]` | `apps/web/src/components/admin/admin-user-kyc-history-panel.tsx` | Panel (no URL) | **Keep panel (improved)** | Small items with no page, inside a record page. Keep, add a URL. |
| LAX Admin | Artist applications | `/artist-applications` | `apps/shop-admin/src/components/artist-applications/artist-applications-list.client.tsx` | Panel (?application=) | **Page** | Accept, decline and ask happen on the page; assigning moves to the row menu. |
| LAX Admin | Artists | `/artists` | `apps/shop-admin/src/components/artists/artist-list.client.tsx` | Panel (?artist=) | **Page** | The panel is a pass-through to the artist page. |
| LAX Admin | Artworks | `/artworks` | `apps/shop-admin/src/components/artworks/artwork-list.client.tsx` | Panel (?artwork=) | **Page** | The editor is the record; publish stays a bulk action on the list. |
| LAX Admin | Audit log | `/audit` | `apps/shop-admin/src/components/audit/audit-log-list.client.tsx` | Panel (?event=) | **Keep panel (improved)** | Same as Bid admin: small, read-only, no page. |
| LAX Admin | Clients | `/clients` | `apps/shop-admin/src/components/clients/clients-list.client.tsx` | Panel (?client=) | **Page** | The panel shows two counts and an ID; the client page has orders, editions, limits and payouts. |
| LAX Admin | Disputes | `/disputes` | `apps/shop-admin/src/components/disputes/disputes-list.client.tsx` | Panel (?dispute=) | **Panel removed** | The panel’s only action is “Open order”. The row opens the order at its dispute section. |
| LAX Admin | Editorial (pages, venues, exhibitions, stories) | `/editorial/[kind]` | `apps/shop-admin/src/components/editorial/editorial-list.client.tsx` | Panel (?item=) | **Page** | Content is edited on its page; publish stays on the row menu and bulk bar. |
| LAX Admin | Enquiries | `/enquiries` | `apps/shop-admin/src/components/enquiries/enquiries-list.client.tsx` | Panel (?enquiry=) | **Page** | Replies happen in the conversation; matches Bid admin, where enquiries open a page. |
| LAX Admin | Framing | `/framing` | `apps/shop-admin/src/components/framing/framing-catalogue.client.tsx` | Edit dialog | **No change** | Small catalogue; a dialog fits. |
| LAX Admin | From Zoho (all tabs) | `/from-zoho` | `apps/shop-admin/src/components/from-zoho/from-zoho-list.client.tsx` | Page / dialog / nothing by tab | **No change** | Already follows the rule; the link dialog is an action. |
| LAX Admin | Help: questions | `/help` | `apps/shop-admin/src/components/help/help-articles-list.client.tsx` | Panel (?article=) | **Page** | The editor is the record. |
| LAX Admin | Help: categories | `/help/categories` | `apps/shop-admin/src/components/help/help-categories-list.client.tsx` | Panel (?category=) | **Panel removed** | No page exists and editing is already a dialog; the row opens the edit dialog directly, as Framing does. |
| LAX Admin | Leads | `/leads` | `apps/shop-admin/src/components/leads/lead-list.client.tsx` | Page | **No change** | Already opens the lead page. |
| LAX Admin | Merchandise | `/merchandise` | `apps/shop-admin/src/components/merchandise/merchandise-list.client.tsx` | Panel (?product=) | **Page** | The panel is a pass-through to the editor. |
| LAX Admin | Orders | `/orders` | `apps/shop-admin/src/components/orders/order-list.client.tsx` | Panel (no URL); order number opens the page | **Page** | Most-used list; two behaviours on one row today. Refunds and fulfilment live on the order page. |
| LAX Admin | Delivery quotes | `/orders/delivery-quotes` | `apps/shop-admin/src/components/delivery-quotes/delivery-quotes-view.client.tsx` | Nothing (inline buttons) | **Page** | Row opens the order; quote and decline stay inline. |
| LAX Admin | Fulfilment | `/fulfilment` | `apps/shop-admin/src/components/orders/fulfilment-list.client.tsx` | Panel (?fulfilment=) | **Keep panel (improved)** | The panel is the workspace (“Next step”). The clearest queue. |
| LAX Admin | Payouts | `/payouts` | `apps/shop-admin/src/components/payouts/payout-list.client.tsx` | Panel (?payout=) | **Keep panel (improved)** | One confirmed money action (“Mark paid”), done in runs. |
| LAX Admin | Production | `/production` | `apps/shop-admin/src/components/production/production-queue.client.tsx` | Panel (?task=) | **Keep panel (improved)** | Already has “Open full page”; keep as the model. |
| LAX Admin | Sale limit requests | `/requests` | `apps/shop-admin/src/components/requests/sale-requests-list.client.tsx` | Panel (?request=) | **Keep panel (improved)** | Approve or decline, one after another. |
| LAX Admin | Stock holds | `/holds` | `apps/shop-admin/src/components/sales/holds-list.client.tsx` | Panel (?hold=) | **Keep panel (improved)** | Release is the only action; a page would add nothing. |
| LAX Admin | Original sales | `/original-sales` | `apps/shop-admin/src/components/sales/original-sales-list.client.tsx` | Panel (?sale=) | **Keep panel (improved)** | Issue invoice from the panel, with confirmation. |
| LAX Admin | Third-party sales | `/third-party-sales` | `apps/shop-admin/src/components/sales/third-party-sales-list.client.tsx` | Panel (?sale=) | **Keep panel (improved)** | Approve fee from the panel, with confirmation. |
| LAX Admin | Staff | `/staff` | `apps/shop-admin/src/components/staff/staff-list.client.tsx` | Panel (?staff=) | **Panel removed** | Read-only; roles are managed in Bid admin. Show roles in the row and link the name to the Bid admin staff page. |
| LAX Admin | Delivery regions | `/settings/delivery-regions` | `apps/shop-admin/src/components/delivery-regions/delivery-regions-editor.client.tsx` | Nothing (Edit button) | **No change** | Settings table; the dialog fits. |
| LAX Admin | Related tables on record pages | `/clients/[id], /artists/[id] …` | `apps/shop-admin/src/components/clients/client-record-page.client.tsx` | Mixed: page, other list’s panel, nothing | **Page** | Every related row opens that record’s page. |
| Client workspace | Bids (active, won, not won) | `/bids` | `apps/web/src/components/dashboard/bids/bids-view.tsx` | Page (row is a link to the lot) | **No change** | Already a real link. “Bid history” drawer opens from the row menu, which is fine. |
| Client workspace | Purchases | `/purchases` | `apps/web/src/components/dashboard/purchases/purchases-view.tsx` | Page | **No change** | Real link to /purchases/[lotId]. |
| Client workspace | Consignments | `/selling/consignments` | `apps/web/src/components/dashboard/seller/consignments-view.tsx` | Page | **No change** | Real link. |
| Client workspace | Collection | `/collection` | `apps/web/src/components/dashboard/seller/collection-view.tsx` | Page | **No change** | Real link. |
| Client workspace | Sold and payouts | `/selling/payouts` | `apps/web/src/components/dashboard/seller/sold-and-payouts-view.tsx` | Page | **No change** | Real link. |
| Client workspace | Watching | `/watching` | `apps/web/src/components/dashboard/watchlist/watching-view.tsx` | Page | **No change** | Real link; keep search and sort in the URL as other lists do. |
| Client workspace | Notifications | `/notifications` | `apps/web/src/components/dashboard/notifications-inbox-board.tsx` | Page | **No change** | Real link to the record. |
| Client workspace | Organisations and invitations | `/organisations` | `apps/web/src/app/(client)/organisations` | Page | **No change** | Real link. |
| Client workspace | Team (members, access, bidding, activity, invitations) | `/team …` | `apps/web/src/app/(client)/team` | Nothing | **No change** | No member page exists and actions are in the row menu; nothing to open. |
| Client workspace | Organisation documents: agreements, statements | `/organisation/documents` | `apps/web/src/app/(client)/organisation/documents/page.tsx` | Nothing (download only) | **Page** | Rows open the consignment or payout page; download stays a button. After #1351. |

Totals: 72 lists; 42 open a panel today. Page 25, keep panel (improved) 20, panel removed 3, no change 24.

## Screenshots taken

Every list that opens a panel was opened at 1440×900 and 375×812 in light mode. Lists with no seeded rows show their empty state only (`*-list.png` with no `*-panel.png`): Bid admin accounting queue and condition reports; LAX Admin artist applications, disputes, editorial, enquiries, help questions, help categories, production, requests, holds, original sales and third-party sales. Their panels were checked in the code only. Artwork images are blank because file storage was not running locally.

---

## Appendix A. Bid admin (apps/web/src/app/admin)

### Bid admin: what a row click does on every list (read-only audit)

No repo files were changed. Every claim below comes from reading the code.
Paths are given from the repo root. Short forms used in the tables:
- `C/` = `apps/web/src/components/admin/`
- `P/` = `apps/web/src/app/admin/`
- `UI/` = `packages/staff-ui/src/`

---

#### 0. Behaviour shared by every list (read this first)

**DataTable** (`UI/data/data-table.tsx`)
- `onRowClick` (around L423) skips clicks that land on `a,button,input,select,textarea,label,[role=checkbox],[role=menuitem]` or on the select cell. Otherwise it calls `onRowOpen(row)`. **It never checks metaKey or ctrlKey.** So:
  - **Cmd/Ctrl-click on the row background** behaves like a plain click. It opens the panel in place, or for page-nav lists it runs `router.push`, which opens the page **in the same tab**.
  - **Middle-click on the row background does nothing.** React `onClick` does not fire for button 1, and the `<tr>` is not a link.
  - A new tab only opens when the click lands on an `<a>` inside a cell, such as the title-cell link, the buyer link or the sale link.
- Keyboard (only in the table layout at 768px and wider, and only when `onRowOpen` or `selectable` is set): ArrowUp/ArrowDown or J/K move focus between rows, Home/End jump, **Enter calls `onRowOpen`**, and Space/X select. J/K only move focus. They do **not** load the next record into an open panel.
- **Phone, below 768px**: the table is replaced by a stacked `<ul>` of `<li>` cards (around L790). A tap anywhere on the card calls the same `onRowClick` and `onRowOpen`. The `<li>` cannot take keyboard focus (there is a biome-ignore comment for this), so keyboard users rely on the title link.
- `activeRowId` sets `data-active` on the `<tr>` and adds a selected overlay and an inset bar.

**DetailPanel** (`UI/panels/detail-panel.tsx`)
- It is a modal Radix `Sheet` with a scrim, sliding in from the right. It is 480px wide (`size="lg"` gives 640px) and full width below 640px. On a phone the header actions wrap to their own row.
- Focus moves to the title when the panel opens. On close it returns to `tr[data-active]` through `useReturnFocus(open, activeTableRow)`. That only works when the list passes `activeRowId`. Escape and the close button both close the panel. When `dirty` is set, a "Discard changes?" confirm appears first.
- Because the sheet is modal, the list behind it cannot be used while the panel is open. There is no previous/next inside the panel unless the list adds it. **Only Onboarding issues adds Previous/Next.**
- Slots: `headerActions` (usually "Open full page"), `overflow` (a `…` menu), `notice`, `summary` (a key-value list), `meta`, `activity`, and a sticky `footer` with the primary action last.

**URL-backed panels: `useListPanel`** (`C/staff/use-list-panel.tsx`)
- The open id lives in a search param such as `?lot=`, and its initial value comes from the server `search`. `show(id)` runs `window.history.replaceState`, so **opening or closing a panel never adds a history entry and never refetches**.
  - Back from a list with a panel open leaves the list page entirely. It does not just close the panel.
  - "Open full page" and then Back returns to the list URL, which still has `?lot=X`, so the panel reopens with the filters intact.
  - Reload and shared links reopen the panel.
- `PanelLink` is a real `<a href="/admin/x?…&lot=ID">` used in the title cell. A plain left click opens the panel in place. Cmd, Ctrl, Shift, Alt or middle-click goes to the browser, so **it opens a new tab at the list with that panel open**, not the record page.
- **A deep link works only when the record is in the current page of rows**: `openRow = rows.find(...)`. If it is not, the panel silently stays closed. There are three exceptions. Invitations shows an "Invitation not found" panel. AML and Onboarding have the server fetch the selected record (`props.selected`). Legal entities has the server fetch `props.preview`.

**Page-nav lists: `useStaffListNavigation`** (`C/staff/use-staff-list-navigation.ts`)
- `navigate(href)` is `startTransition(() => router.push(href, {scroll:false}))`. That is a normal history push, so Back returns to the list with its URL filters.
- The `Link` it returns (`ListLink`) is a real Next `<Link>`, so modified clicks and middle-clicks open a new tab.
- Every ListPage list sends its views, search, filter, page-size and pagination changes through `navigate()`. **Filter, search, view and page state is in the URL on every ListPage list.** Sort is only in the URL when the list passes `onSortChange`. Otherwise DataTable sorts locally (`localSort`, L213): only the current page is sorted, and the sort is lost on Back or reload.

---

#### 1. Main table, one row per list

Legend for **Row click**: **Panel** opens a DetailPanel. **Page** navigates to a record page with `router.push`. **Dialog** opens a StaffDialog. **Nothing** means the row has no `onRowOpen` and only links inside cells do anything.

| # | Route | Module | List component | page.tsx | Row click today | Full detail page | Panel URL-addressable | Row columns | What the panel adds beyond the row | Panel actions | Cmd/Ctrl/middle-click → new tab | Keyboard | Phone | Filter / sort / page state | Judgement |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | `/admin/lots` | Lots | `C/lots/lots-staff-list.tsx` + `C/lots/lot-quick-view.tsx` | `P/(platform)/lots/page.tsx` | **Panel** (`panel.show`) | Yes: `/admin/lots/[id]` (`P/(platform)/lots/[id]/(detail)/page.tsx`) plus tabs | **Yes** `?lot=` (useListPanel, replaceState) | Lot (thumbnail and context), Status (+ATG), Sale (link), Estimate, Hammer, Ends, Added (hidden) | Small. Adds lot number, artist, auction type, opening bid, photo count, Lot ID copy, photo, and a withdrawal-request notice | Header "Open full page". Overflow holds the full lot action set (publish, withdraw, delete, decide withdrawal). Footer "Edit lot" | Title cell is a PanelLink, so a new tab opens the **list with the panel**. The Sale cell link opens the sale. Row background: no | Enter, J/K, Esc, focus returns | Card tap opens a full-width panel | Fully in the URL: q, status, sale, artist, category, lens, sort, limit, page. Saved and team views | **Record browser**, with a triage lens for withdrawal requests |
| 2 | `/admin/sales` | Sales | `C/sales/sales-staff-list.tsx` + `C/sales/sale-quick-view.tsx` | `P/(platform)/sales/page.tsx` | **Panel** | Yes: `/admin/sales/[id]` plus about 12 tabs | **Yes** `?sale=` | Sale, Status, Lots, Starts, Ends, Added | Small. Adds type, lot count, dates, Sale ID and cover image | Header "Open full page". Overflow holds sale actions. Footer "Edit sale" or "Continue setup" | Title is a PanelLink (new tab = list with panel) | Enter, J/K, Esc | Card, then panel | URL, including sort | Record browser |
| 3 | `/admin/artists` | Artists | `C/artists/artists-staff-list.tsx` + `C/artists/artist-quick-view.tsx` | `P/(platform)/artists/page.tsx` | **Panel** | Yes: `/admin/artists/[id]` (+ duplicates, lots, review) | **Yes** `?artist=` | Artist, Status, Owner account, Lots, Updated | Small. Adds kind, years, aliases, lots, owner, Artist ID and portrait | Header "Open full page". Overflow. Footer "Edit artist" | Title is a PanelLink | Enter, J/K, Esc | Card, then panel | URL, including sort and lens (e.g. duplicates queue) | Record browser |
| 4 | `/admin/categories` | Categories | `C/categories/categories-staff-list.tsx` + `C/categories/category-quick-view.tsx` | `P/(platform)/categories/page.tsx` | **Panel** | Yes: `/admin/categories/[id]` (+ activity, children, lots, sales) | **Yes** `?category=` | Category, Status, Lots, Sales, Submissions, Updated | Some. Adds slug, description, buyer interests, position, hero image, added date and ID | Header "Open full page". Overflow. Footer "Edit category" | Title is a PanelLink | Enter, J/K, Esc | Card, then panel | Filters in the URL. **Sort is local** (5 sortable columns, no `onSortChange`) | Record browser |
| 5 | `/admin/venues` | Venues | `C/venues/venues-staff-list.tsx` + `C/venues/venue-quick-view.tsx` | `P/(platform)/venues/page.tsx` | **Panel** | Yes: `/admin/venues/[id]` (+ activity, sales) | **Yes** `?venue=` | Venue, Organisation (link), Address, Status, Updated | Some. Adds capacity, phone, email, website, slug and ID | Header "Open full page". Overflow. Footer "Edit venue" | Title is a PanelLink. The Organisation cell is a real link | Enter, J/K, Esc | Card, then panel | Filters in the URL. **Sort is local** | Record browser |
| 6 | `/admin/submissions` | Submissions (consignment) | `C/submissions/submissions-staff-list.tsx` + `C/submissions/submission-quick-view.tsx` | `P/(platform)/submissions/page.tsx` | **Panel** | Yes: `/admin/submissions/[id]` (+ decision, documents, messages) | **Yes** `?submission=` | Submission, Status, Seller, Waiting, Details, Assigned to, Submitted | Moderate. Adds category, an "It cannot be accepted yet" gaps notice, a "Worth checking" note and a photo | Header "Open review", which goes to the record page. Overflow holds submission actions (assign and others). **No footer.** Bulk actions on the list | Title is a PanelLink | Enter, J/K, Esc | Card, then panel | URL, including sort. Saved views | **Triage queue**, but the actual decision is made on the review page. The panel is a preview |
| 7 | `/admin/clients` | Clients (People) | `C/people/clients-staff-list.tsx` (ClientQuickView is inline) | `P/(platform)/clients/page.tsx` | **Panel** | Yes: `/admin/clients/[id]` | **Yes** `?client=` | Client, Account, Identity, Signed up as, Two-step, Joined | Small. Adds email, mobile, identity-verified flag and user ID | Overflow holds account actions (person actions). Footer "Open client page". **No header "Open full page"** | Title is a PanelLink | Enter, J/K, Esc | Card, then panel | URL, including sort. Saved views | Record browser |
| 8 | `/admin/staff` | Staff directory | `C/people/staff-directory-list.tsx` (inline panel) | `P/(platform)/staff/page.tsx` | **Panel** | Yes: `/admin/staff/[id]` | **Yes** `?staff=` | Staff member, Account, Roles, LAX access, Two-step, Last sign-in, Joined | Small. Adds email and user ID | Overflow holds account actions. Footer "Open staff page" | Title is a PanelLink | Enter, J/K, Esc | Card, then panel | URL, including sort | Record browser |
| 9 | `/admin/invitations` | Staff invitations | `C/people/invitations-staff-list.tsx` (inline panel) | `P/(platform)/invitations/page.tsx` | **Panel** | **No** detail page | **Yes** `?invitation=`. If the invitation is not on the page, an "Invitation not found" panel shows | Invitee, Status, Access, Sent, Expires | Moderate. Adds invited by, opened, email delivery, ID and a "did not arrive" notice | Overflow (revoke and others). Footer "Resend" | Title is a PanelLink | Enter, J/K, Esc | Card, then panel | URL, including sort | Light triage, mostly browsing |
| 10 | `/admin/legal-entities` | Legal entities | `C/legal-entities/legal-entities-staff-list.tsx` + `C/legal-entities/legal-entity-quick-view.tsx` | `P/(platform)/legal-entities/page.tsx` | **Panel**. **Opening runs `router.push`**, which makes a server round-trip to load the readiness preview and adds a history entry. Closing uses replaceState | Yes: `/admin/legal-entities/[id]` (+ activity, buyer-agents, compliance, documents, sales, stripe) | **Yes** `?entity=` (own PanelLink plus server `selectedEntityId` and `preview`) | Name, Status, Kind, Stripe requirements, Updated | **Large.** Adds server-loaded readiness: Connect stage, can sell, can get paid, a blocker list, Stripe Connect, LAX-managed, platform fee, created by and document counts | Header "Open full record". Overflow (Stripe requirements, impersonate and others). Footer "Impersonate" plus "Review Stripe requirements" | Title is a PanelLink | Enter, J/K, Esc | Card, then panel | Filters in the URL. **Sort is local** | Record browser with readiness triage |
| 11 | `/admin/payments` | Payments | `C/payments/payments-staff-list.tsx` + `C/payments/payment-quick-view.tsx` | `P/(finance)/payments/page.tsx` | **Panel** | **No** payment page. The lot page `/admin/lots/[id]` is the nearest | **Yes** `?payment=` | Lot (title links to the **lot page**), Status, Buyer (link), Amount, Fulfilment, Xero invoice (hidden), Created | Moderate. Adds platform fee, seller, a Xero section (sync state, resync, last error) and the payment ID | Header "Open lot". Overflow (open buyer and money actions). Footer "Refund" and "Capture" | The title cell is a **plain lot link, not a PanelLink**, so the only panel entry is a row click. A new tab from the title opens the lot | Enter, J/K, Esc | Card, then panel | Filters in the URL. **Sort is local**. Saved and team views | **Triage**: finance captures and refunds |
| 12 | `/admin/payments?manualReview=1` | Payments: manual review holds | `C/payments/manual-review-staff-list.tsx` (inline panel) | `P/(finance)/payments/page.tsx` (`page.mode === "manual-review"`) | **Panel** | No (lot page only) | **No**: `useState` only | Lot (lot link), Hold, Winner (link), Seller, Amount, Held since | Small to moderate. Adds a hold-reason notice, winner email, seller-archived date and payment ID | Header "Open lot". Overflow (lot, winner, compliance case, money). Footer "Refund {amount}" and "Release for checkout" (disabled for compliance holds) | Title is a lot link. No panel link | Enter, J/K, Esc | Card, then panel | Reason filter in the URL. Sort is local | **Genuine triage queue** |
| 13 | `/admin/payouts` | Payouts | `C/payouts/payouts-staff-list.tsx` + `C/payouts/payout-quick-view.tsx` | `P/(finance)/payouts/page.tsx` | **Panel** | **No** payout page. "Open seller" goes to the legal entity | **Yes** `?payout=` (own PanelLink plus replaceState) | Period, Reference, Status, Seller (link), Gross, Net, Stripe transfer (hidden), Paid | Moderate. Adds platform and Stripe fees, created date, IDs, and notices for transfer failed, blocked, clawback and statement PDF | Header "Open seller". Overflow (money). Footer "Mark paid", "Adjust", "Reverse", "Retry transfer", "Adopt/Release blocked" | Title is a PanelLink | Enter, J/K, Esc | Card, then panel | Filters in the URL. **Sort is local** | **Triage**: finance ops |
| 14 | `/admin/finance/accounting` | Accounting (Books sync queue) | `C/finance/accounting-queue-list.tsx` + `C/finance/accounting-details-sheet.tsx` | `P/(finance)/finance/accounting/page.tsx` | **Panel** | No | **No**: `useState<AccountingStaffRow>` | Document (no link), Status, Last problem / In Books, Company, Amount, Attempts, Updated, Created (hidden), Tried, Action | Small. Adds the full problem text, the LAX reference and the Books number | **No header and no overflow.** Footer "Try again" or "Open in Books" (external) | **No** link in the title. Only the external Books link | Enter, J/K, Esc | Card, then panel | Tab and filters in the URL. Sort is local | **Triage queue** (retry failures) |
| 15 | `/admin/compliance/aml` | AML screening | `C/compliance/aml-staff-list.tsx` + `C/compliance/aml-quick-view.tsx` | `P/(platform)/compliance/aml/page.tsx` | **Panel** | No screening page. The client page `/admin/clients/[id]` is the nearest | **Partly**. `?screening=` is read on load (server `selectedId`/`selected`), but clicks only `setOpenId` and the **URL is never updated** | Client (links to the **client page**), Match, Policy outcome, Triage, Hits, Screened | **Large.** Adds categories, monitoring, check type, provider session ID, a two-step review block (analyst triage and MLRO decision with notes), a blocker notice, hit detail and a timeline | Header "Open client". Overflow (decisions). Footer "Recommend block/clear" (analyst) or "Block/Clear screening" (MLRO) | The title is a client link, so a new tab opens the client. No panel link | Enter, J/K, Esc | Card, then panel | Page size and pagination in the URL. Sort is local. No search | **Genuine triage queue** |
| 16 | `/admin/compliance/source-of-funds` | Source of funds | `C/compliance/sof-staff-list.tsx` | `P/(platform)/compliance/source-of-funds/page.tsx` | **Page** `navigate(row.href)` | Yes: `/admin/compliance/source-of-funds/[id]` | n/a | Buyer (case link), Status, Trigger, Exposure, Evidence, Triage, Opened, Reviewed | n/a | Row menu "Open case" (href) | Title link: yes. Row background Cmd-click: same tab | Enter navigates. J/K | Card tap navigates | Filters in the URL. Sort is local | Triage queue, worked on the case page |
| 17 | `/admin/onboarding-issues` | Onboarding issues | `C/onboarding/onboarding-issues-staff-list.tsx` + `C/onboarding/onboarding-issue-quick-view.tsx` | `P/(platform)/onboarding-issues/page.tsx` | **Panel** | Not its own. The rows point to `/admin/legal-entities/[id]`, `/admin/clients/[id]` or `/admin/artists/[id]/edit` | **Partly**. `?item=` is read on load (server fetch), clicks use `useState`, and the URL is not updated | Title (links to the **target record**), Status (entities/kyc tabs), Waiting, Created/Uploaded | **Very little.** Adds type, provider and reference. The panel body is `{null}` | Header "Open full page". Overflow (one link). Footer **Previous / Next** (the only panel with these) plus a primary link to the record | The title opens the target record. No panel link | Enter, J/K, Esc. Prev/Next inside the panel | Card, then panel | Tab in the URL. Sort is local | Triage queue, but the panel cannot act. It is a stepping-stone |
| 18 | `/admin/condition-reports` | Condition report requests | `C/condition-reports/condition-reports-staff-list.tsx` + `C/condition-reports/condition-report-quick-view.tsx` | `P/(platform)/condition-reports/page.tsx` | **Panel** | No (lot page only) | **Yes** `?request=` | Lot (PanelLink), Requester (link), Status, Requested | **Large.** Adds the requester's question, fulfilled date, notes and an **inline "Fulfil request" form** with a dirty guard | Header "Open lot". Overflow (others). Footer decline and other buttons | Title is a PanelLink | Enter, J/K, Esc. A dirty form asks before Esc closes | Card, then panel | Filters in the URL. Sort is local | **Genuine triage queue** (the work is done in the panel) |
| 19 | `/admin/lot-fulfilment` | Lot fulfilment | `C/lot-fulfilment/lot-fulfilment-staff-list.tsx` (inline panel) | `P/(platform)/lot-fulfilment/page.tsx` | **Panel** | No (lot page only) | **Yes** `?lot=` | Lot, Step, Method, Carrier and tracking, Last change | Small. Adds sale, Lot ID and a step notice | Header "Open lot". Overflow (other steps). **Footer: the next step as the primary action** | Title is a PanelLink | Enter, J/K, Esc | Card, then panel | URL, including sort | **Triage queue** |
| 20 | `/admin/event-rsvps` | Event RSVPs (events) | `C/event-rsvps/event-rsvps-staff-list.tsx` (inline panel) | `P/(platform)/event-rsvps/page.tsx` | **Panel** | Yes: `/admin/event-rsvps/[slug]` (guest list, check-in, edit) | **Yes** `?event=` (slug) | Event, Status, RSVPs, Starts, RSVPs close | Small. Adds linked sale and address | Header "Check-in". Overflow. Footer "Open guest list" (the detail page) | Title is a PanelLink | Enter, J/K, Esc | Card, then panel | URL, including sort | Record browser |
| 21 | `/admin/audit` | Audit log | `C/audit/audit-log-list.tsx` + `C/audit/audit-event-panel.tsx` | `P/(shared)/audit/page.tsx` | **Panel** | No event page | **Yes** `?event=` | Action (PanelLink, summary), Who, Record (link), When | **Large.** Adds sections for Event, What changed (diff) and Details (payload) | Footer "Open {record type}". No header action | Title is a PanelLink. The Record cell is a real link | Enter, J/K, Esc | Card, then panel | URL, including sort | Record browser (investigation) |
| 22 | `/admin` (dashboard) | Personal dashboard: work inbox | `C/personal-dashboard/work-inbox/work-inbox.tsx` (DataTable, not ListPage) | `P/(platform)/(dashboard)/page.tsx` | **Panel** | Each item's `href` points to its source record | **Yes** `?item=` | Item, Priority, Area, Owner, Due | Small. Adds a possible-payment hint, waiting since, last change and "What to do" guidance | Header "Open full page". Overflow (other and danger actions). Footer: work actions (claim, resolve and others), or "Open record" when there are none | Title is a PanelLink | Enter, J/K, Esc. The panel is rendered only while open, mounted conditionally | Card, then panel | Area through Link (push). **Assignment through `router.replace`**, so Back skips it | **Triage queue** |
| 23 | `/admin/inbox` | Consignment inbox | `C/consignment-inbox/inbox-staff-list.tsx` | `P/(platform)/inbox/page.tsx` | **Page** `router.push(inboxThreadHref)` (plain `useRouter`, not a transition) | Yes: `/admin/inbox/[submissionId]` | n/a | Consignment (thread link), Client, Last message, Assignee | n/a | Bulk mark read, close and assign. Assign dialog | Title link: yes. Row background: same tab | Enter navigates. J/K | Card navigates | URL views and search | Triage queue, worked on the thread page |
| 24 | `/admin/inbox/saved-replies` | Saved replies | `C/consignment-inbox/saved-replies-staff-list.tsx` | `P/(platform)/inbox/saved-replies/page.tsx` | **Dialog**: `SavedReplyDialog` (StaffDialog edit form), managers only. **Nothing** for read-only staff | No | No | Title, Reply, Updated | Edit form | Row menu: Edit, Delete, Back to inbox | No links in the row | Enter opens the dialog (managers) | Card tap opens the dialog | No filters (at most 1 page) | Settings list |
| 25 | `/admin/disputes` | Disputes | `C/disputes/disputes-staff-list.tsx` | `P/(finance)/disputes/page.tsx` | **Page** `navigate(disputeCaseHref)` | Yes: `/admin/disputes/[id]` | n/a | Dispute (case link and reason), Allocation, Respond by, Buyer (link), Amount, Status, Opened | n/a | Row menu "Open case" | Title link: yes | Enter navigates | Card navigates | Views and search in the URL. **Sort is local** | Triage queue, worked on the case page |
| 26 | `/admin/compliance/data-requests` | Data requests (GDPR) | `C/data-requests/data-requests-list.tsx` | `P/(platform)/compliance/data-requests/page.tsx` | **Page** `navigate(recordHref)` | Yes: `/admin/compliance/data-requests/[reference]` | n/a | Person (link), Kind, Products, Requested, Due, Status, Products done | n/a | Row menu "Open". "Log request" dialog | Title link: yes | Enter navigates | Card navigates | View, sort (`sort=due`) and search in the URL | Case queue, worked on the record page |
| 27 | `/admin/enquiries` | Enquiries | `C/enquiries/enquiries-list.tsx` | `P/(platform)/enquiries/page.tsx` | **Page** `navigate(enquiryHref)` | Yes: `/admin/enquiries/[reference]` | n/a | Client (link), Kind, Assignee, Waiting, Status | n/a | Row menu "Open" and others. Routing dialog | Title link: yes | Enter navigates | Card navigates | URL | Triage queue, worked on the page |
| 28 | `/admin/failed-jobs` | Failed jobs | `C/failed-jobs/failed-jobs-list.tsx` | `P/(shared)/failed-jobs/page.tsx` | **Page** `navigate(failedJobHref)` | Yes: `/admin/failed-jobs/[id]` | n/a | Job (link), Error, Attempts, First failed, Last failed, Status | n/a | Row menu "Open job", retry and others. Bulk retry | Title link: yes | Enter navigates | Card navigates | URL, including sort | Ops triage (retry happens in bulk on the list) |
| 29 | `/admin/private-sales` | Private sales: deals | `C/private-sales/deals-list.tsx` | `P/(shared)/private-sales/page.tsx` | **Page** `navigate(dealHref)` | Yes: `/admin/private-sales/[reference]` | n/a | Work (link), Seller, Buyer, Price, Stage, Next date | n/a | Row menu "Open" | Title link: yes | Enter navigates | Card navigates | URL | Pipeline / record browser |
| 30 | `/admin/purchase-problems` | Purchase problems | `C/purchase-problems/purchase-problems-list.tsx` | `P/(platform)/purchase-problems/page.tsx` | **Page** `navigate(purchaseProblemHref)` | Yes: `/admin/purchase-problems/[id]` | n/a | Reference (link), Buyer, Lot, Reason, Raised, Owner, Status | n/a | Row menu "Open" | Title link: yes | Enter navigates | Card navigates | URL | Triage queue, worked on the page |
| 31 | `/admin/staff/access` | Staff access review | `C/people/staff-access-review-list.tsx` | `P/(platform)/staff/access/page.tsx` | **Nothing** (no `onRowOpen`) | Yes: `/admin/staff/[id]` via the title link | n/a | Staff member (PersonCell link), Roles, Next role ends, Last sign-in, Account | n/a | Row menu "Open staff record" and access actions | Title link: yes | Rows do not take focus (not interactive). Tab reaches the links | Tapping a card does nothing. The link inside it works | URL, including sort | Periodic review queue |
| 32 | `/admin/saleroom` | Saleroom hub | `C/saleroom-hub-board/index.tsx` + `columns.tsx` (bare DataTable) | `P/(platform)/saleroom/page.tsx` | **Nothing**. The title links to `/admin/saleroom/[saleId]` | Yes: clerk console `/admin/saleroom/[saleId]` | n/a | Sale (link), Starts, Ends, Room | n/a | Row menu "Open clerk console", "Check in bidders" | Title link: yes | No row focus | Title link | None (static) | Launcher |
| 33 | `/admin/collections` | Collections desk | `C/collections/desk-day.tsx`, `desk-list.tsx`, `desk-visit-row.tsx` (hand-made `<ul>/<li>`) + `C/collections/desk-hand-over-panel.tsx` via `use-desk-dialogs.tsx` | `P/(platform)/collections/page.tsx` | **Nothing** on the row. The **"Hand over" button** opens a DetailPanel (useState `handingId`) | No | No | Visit card: collector, time, lots, buttons Hand over / Undo / Rebook / Not collected | A hand-over form: tick lots, release, photo ID type | Footer inside the form ("Mark collected") | n/a | No row keyboard. Panel Esc | Same | Day and tab in the URL | **Desk triage**, button-driven |
| 34 | `/admin/settings/unlinked-originals` | Unlinked originals (Zoho) | `C/unlinked-originals/unlinked-originals-list.tsx` (hand-made `<ul>`) | `P/(platform)/settings/unlinked-originals/page.tsx` | **Page**. Each Bid row **is a `<Link>`** to `/admin/lots/[id]`. lax.art rows are inert `<div>`s | Lot page | n/a | Title, product, state | n/a | none | **Yes**: the whole row is an `<a>` | Tab to the link | Link | None | Report |

##### Related-record tables on record pages (embedded DataTables)

All of these use `C/people/related-records-section.tsx` or a bare DataTable. **None passes `onRowOpen` except KYC history.** The row does nothing, and cells hold real links, so new tabs work from those links.

| Where (route) | Component | Row click | Links in cells | Panel? |
|---|---|---|---|---|
| `/admin/clients/[id]` (overview) | `C/admin-user-kyc-history-panel.tsx` "Identity checks" | **Panel** (`useState openId`, plus a "Details" button) | none | DetailPanel "Identity check": KeyValueList of session and watchlist; footer "Open in Veriff" (external). Not URL-addressable. **No `activeRowId`**, so focus is not returned to the row |
| `/admin/clients/[id]` and `/admin/staff/[id]` (email delivery) | `C/people/email-delivery/email-sends-table.tsx` via `email-delivery-view.tsx` | **Panel** (`useState openSendId`) | none | DetailPanel: kind, product, delivery Timeline. Not URL-addressable |
| `/admin/clients/[id]` (overview) | `C/admin-user-aml-panel.tsx` "Earlier screenings", `C/admin-user-sof-panel.tsx` "Source of funds" | Nothing | links to the AML list `?screening=` / SOF case | – |
| `/admin/clients/[id]` tabs won-lots, bids, payments, legal entities | `C/admin-user-commerce-panel.tsx` | Nothing | lot links, Xero invoice (external), legal entity | – |
| `/admin/clients/[id]` artist profiles | `C/admin-client-artist-profiles-panel.tsx` | Nothing | artist links | – |
| `/admin/sales/[id]/lots` | `C/sale-detail/sale-lots-tab-board.tsx` | Nothing | lot title links to `/admin/lots/[id]`; menu Open lot page, artist, edit | – |
| `/admin/sales/[id]/registrations`, `/telephone-bookings`, `/schedule`, `/press`, `/atg` | `C/sale-detail/tabs/*.tsx` | Nothing | bidder links to the client page, `tel:` | – |
| `/admin/lots/[id]/bids` | `C/lot-detail/lot-bids-tab-board.tsx` | Nothing | links | – |
| `/admin/categories/[id]` children, lots, sales, overview | `C/category-detail/tabs/*.tsx` | Nothing | links | – |
| `/admin/artists/[id]/duplicates`, artist backfill | `C/admin-artist-duplicates-table.tsx`, `C/artist-backfill-table.tsx` | Nothing | artist and lot links | – |
| `/admin/legal-entities/[id]/documents`, `/buyer-agents` | `C/legal-entities/legal-entity-documents-tab.tsx`, `tabs/buyer-agents-tab.tsx`, `C/documents/staff-documents-section.tsx` | Nothing | links | – |
| `/admin/disputes/[id]` | `C/disputes/dispute-allocation-card.tsx` (3 invoice DataTables) | Nothing | – | – |
| `/admin/event-rsvps/[slug]` (+ `/check-in`) | `C/event-rsvps/onsite-event-guest-list.tsx` (local search and filter) | Nothing | – | – |
| sale registrations / gala | `C/expected-guests-panel.tsx` | Nothing | client links | – |
| `/admin/staff/[id]` | `C/people/staff-lax-access-panel.tsx` "Access history" | Nothing | – | – |
| `/admin` dashboard | `C/personal-dashboard/overview-context-sections.tsx` "Recent activity", "Upcoming sales" | Nothing | links | – |

Not found: there are **no invoice, commission, settlement or catalogue list screens**. `/admin/payouts/settlement` (`C/payout-settlement-workspace.tsx`) is a pick-entity, preview and confirm form with no list. `/admin/finance` (`C/finance/finance-hub.tsx`) is a hub of links. `/admin/integrations/xero` is a settings panel. `C/catalog/*` is shared list-shell code, not a screen.

---

#### 2. Per-list notes

1. **Lots**. `useListPanel({param:"lot"})` (L102–107). Title is a `PrimaryCell` with `href=panelHref(id)` and `Link=panel.PanelLink`. The row menu has "Open details" (panel), "Open lot page", "Edit lot", "Open sale" and the lot actions. The panel is built from the row, with no fetch, and is fairly thin next to the 6-tab record page.
2. **Sales**. Same pattern, `?sale=` (L79–83). The footer switches between "Edit sale" and "Continue setup" (`adminSaleSetupHref`).
3. **Artists**. `?artist=` (L73–77). The row menu "Open details" plus queue lenses (duplicates).
4. **Categories**. `?category=`. 5 sortable columns are sorted locally.
5. **Venues**. `?venue=`. The Organisation cell uses `ListLink`, so a new tab works.
6. **Submissions**. `?submission=`. The panel header button is "Open review" (`row.href` points to `/admin/submissions/[id]`). The panel has no footer. The accept/decline decision is on `/admin/submissions/[id]/decision`, and the overflow holds the list's submission actions.
7. **Clients**. `ClientQuickView` is inline (around L370–428). Its only "full page" link is the footer "Open client page". The client page accepts `?returnTo=` (`parseAdminListReturnTarget`).
8. **Staff directory**. Inline panel. The footer is "Open staff page".
9. **Invitations**. It has two DetailPanels: the record, and "Invitation not found" (L360–370) for a stale `?invitation=`.
10. **Legal entities**. It has its own PanelLink and `openPanel` (L65–95). **Opening does `router.push`** (a server round-trip for `preview`, which adds history), while closing does `history.replaceState`. This is the only panel list that is asymmetric like this. Readiness shows a skeleton until the preview arrives.
11. **Payments**. `?payment=`. **The title cell links to the lot page** (`/admin/lots/{lotId}`), not the panel. So a Cmd-click on the title opens the lot, and nothing opens the payment panel in a new tab.
12. **Manual review**. This is a different component on the same route, chosen by `?manualReview=1`. The panel is useState only (L75). It is a clear queue: Refund or Release from the footer.
13. **Payouts**. It has its own PanelLink with replaceState (L66–94). There is no payout record page, so the panel is the only detail view.
14. **Accounting**. `details` is the row object held in state (L92). The title cell is not a link at all. The panel's "Try again" closes the panel, then opens a confirm dialog.
15. **AML**. `useState(props.selectedId)` (L48). The server reads `?screening=` (`build-aml-list-page-model.ts` L16) and fetches the selected screening if it is off-page (`openRow` fallback L118–120). A click does not write the URL, so the link cannot be shared after a click, and Back does not restore it. The client page's AML panel links here with `?screening=`.
16. **Source of funds**. `onRowOpen: navigate(row.href)` (L198). There is no panel.
17. **Onboarding issues**. `useState(props.selectedId)`. The server reads `?item=` (`build-onboarding-issues-list-page-model.ts` L21). The panel body is `{null}`: the summary only repeats row facts. Previous and Next step through the current page with a "3 of 120" position.
18. **Condition reports**. `?request=`. The panel embeds `ConditionReportFulfilForm` with `onDirtyChange`, so it is a real work surface.
19. **Lot fulfilment**. `?lot=` (the same param name as Lots, but a different route). The primary footer button is the next fulfilment step (`next.run`).
20. **Event RSVPs**. `?event=` holds the slug. The panel's footer goes to `/admin/event-rsvps/[slug]`, the guest list.
21. **Audit**. `?event=` holds the event id. The panel is read-only. The footer goes to the affected record.
22. **Work inbox**. `useListPanel({param:"item"})` (L93). Work actions run from the panel footer and close it when done (`onDone: () => panel.show(null)`). The panel is mounted only while it is open.
23. **Consignment inbox**. `onRowOpen: router.push(inboxThreadHref(...))` (L316). The title is a NextLink to the thread.
24. **Saved replies**. A row click opens `SavedReplyDialog` (`StaffDialog`, a centred modal). It is not a DetailPanel.
25–30. **Disputes, data requests, enquiries, failed jobs, private-sales deals, purchase problems**. All use `onRowOpen: (row) => navigate(recordHref)` and a title-cell Next `<Link>` to the same URL. The row menu holds "Open" as an `href`.
31. **Staff access review**. No `onRowOpen` and not selectable, so rows are not focusable and do not move with J/K.
32. **Saleroom hub**. A bare DataTable with no `onRowOpen`.
33. **Collections desk**. Hand-made cards. The DetailPanel is opened by a button, not by the row.
34. **Unlinked originals**. Hand-made `<ul>` where each Bid row is a full `<Link>`. This is the only list where the whole row is a real link.

---

#### 3. Cross-cutting findings

- **Cmd/Ctrl-click on a row background never opens a new tab.** `onRowClick` ignores modifiers, so on page-nav lists (#16, 23, 25–30) a Cmd-click **navigates the current tab**, which goes against what the user intended. Middle-click on a row background does nothing. New tabs only work through cell links.
- On panel lists with a PanelLink title (#1–10, 13, 18–22), a new tab from the title opens **the list with the panel**, not the record page. To get the record page in a new tab, staff must Cmd-click "Open full page" inside the panel or use the row menu's page link.
- **Panels that are not URL-addressable**: Manual review (#12), Accounting (#14), AML after the first click (#15), Onboarding after the first click (#17), KYC history, email sends, collections hand-over, and saved replies (dialog).
- **Panel opening adds no history entry**, because useListPanel uses replaceState. The exception is Legal entities, which uses push. So Back from a list with an open panel leaves the list.
- A deep link to a record that is **not on the current page** silently opens nothing. The exceptions are Invitations (not-found panel) and AML, Onboarding and Legal entities (server fetch).
- **Local-only sort** (lost on Back or reload, and only sorts the current page): Categories, Venues, Condition reports, Payments, Payouts, Legal entities, Accounting, AML, SOF, Disputes, Onboarding, Manual review.
- Panels missing a header "Open full page": Clients and Staff (the link is in the footer), Payments and Manual review ("Open lot" only, because no payment page exists), Payouts ("Open seller"), Accounting (none), Audit (footer), Event RSVPs (footer).
- J/K never step the open panel to another record. Only Onboarding has Previous/Next buttons.

---

## Appendix B. LAX Admin (apps/shop-admin)

### LAX Admin (apps/shop-admin): how a row click behaves on every list

This is a read-only audit. Every path below is relative to `apps/shop-admin/src/` unless it starts with `packages/`. Each finding was checked against the code on 2026-11-13.

#### 0. Shared mechanics (they apply to every list that uses them)

**DataTable** (`packages/staff-ui/src/data/data-table.tsx`)
- A row is a `<tr>`. A click anywhere on it calls `onRowOpen(row)`, except a click on `a,button,input,select,textarea,label,[role=checkbox],[role=menuitem]` or on the select cell (line 88 and l.421-427).
- A click on an `<a>` in the title cell therefore never reaches `onRowOpen`. The link does its own thing.
- Rows can take focus only when `onRowOpen` or selection is set. ArrowUp/ArrowDown, J/K, Home and End move between rows, and Enter calls `onRowOpen` (l.378-418).
- Global J/K shortcuts (l.329-350) land on the current row. They work only in the table layout (`offsetParent` check), so they do nothing on a phone.
- With Cmd/Ctrl/Alt held, the row's key handler ignores the key, and a modified click on the `<tr>` itself opens nothing in a new tab.
- Below 768px the table becomes a `<ul>` of cards (l.776+). The `<li>` has an `onClick` that calls the same `onRowOpen`. It is not focusable and has no key handler, so on a phone a keyboard user can open a row only through a link in its title.
- `activeRowId` sets `data-active` and a highlight with a 2px left bar on the `<tr>`. In the card layout it gives the selected overlay instead.

**RelatedRecordsSection** (`packages/staff-ui/src/data/related-records-section.tsx`): an embedded, compact DataTable inside a Section. It passes `onRowOpen` through when one is given. Record pages use it for related records.

**DetailPanel** (`packages/staff-ui/src/panels/detail-panel.tsx`)
- A Radix Sheet on the right, 480px wide (`lg` 640px) and full width below 640px (`w-full`, `sm:w-[480px]`). Between 640 and 767px you get phone cards next to a 480px panel.
- The Sheet is modal (`SheetPrimitive.Root` with no `modal={false}`), so focus is trapped in it. The global J/K handler still fires, but focus cannot leave the panel, so J/K do nothing while a panel is open. To move to the next record you press Esc, then J, then Enter.
- No shop-admin panel has next/previous buttons. `RecordPager` exists in `packages/staff-ui/src/shell/record-pager.tsx`, but shop-admin uses it nowhere.
- Escape, the close button and the scrim all close the panel. When the panel is `dirty`, closing asks "Discard changes?" first.
- On close, focus goes back to the element that opened the panel. If that element is gone, it falls back to `tr[data-active]` (`useReturnFocus`, `packages/ui/src/lax/return-focus.ts`).
- Slots: `title`, `status`, `meta`, `summary` (key-value pairs; facts already in meta are dropped), `headerActions`, `overflow`, `notice`, `footer`, children and `activity`.

**useListPanel**, the panel held in the URL (`components/use-list-panel.client.ts`)
- The open record is kept in `useState`, seeded once from the URL (`initialId`). `show(id)` updates the state and calls `window.history.replaceState(list URL + ?<param>=id)`.
- **The panel can be addressed by URL.** A reload or a shared link opens it again.
- Because it uses `replaceState`, opening or closing a panel adds no history entry. Back leaves the list's current URL; it does not close the panel or step back through panels.
- Nothing listens for popstate. If Back or Forward lands on a URL with a different `?<param>`, the state does not follow it (`useState` is read only at mount).
- `PanelLink` renders a real `<a href="/list?…&param=id">`. A plain left click is intercepted and opens the panel in place. Cmd/Ctrl/Shift/Alt-click and middle-click follow the href, so **a new tab opens the list with that panel open, not the record page**.

**useWorkList** (`components/use-work-list.client.tsx`) and **WorkList** (`server/domain/work-list.vm.ts`)
- View tab, search `q`, filters, sort, `limit` and the cursor all live in the URL and change through `router.push` (`components/use-list-navigation.client.ts`). Back therefore restores the list state.
- Changing the list removes the panel param from the URL (`work-list.vm.ts` l.149, 164). The local `openId` is kept, though, so the panel just finds no row on the new page and closes.
- Panel params (`panelParam`) are defined in `server/domain/sales-lists.vm.ts`, `people-lists.vm.ts`, `artist-list.vm.ts`, `artist-application.vm.ts`, `enquiry-inbox.vm.ts`, `merchandise-list.vm.ts`, `help-list.vm.ts` and `editorial-list.vm.ts`.

---

#### 1. Summary table: main lists (pages under `app/(staff)`)

| # | Route | Module | List component | page.tsx | Row click today | Full detail page | Panel in URL? | Cmd/middle-click on title |
|---|---|---|---|---|---|---|---|---|
| 1 | `/artist-applications` | Artist applications | `components/artist-applications/artist-applications-list.client.tsx` | `app/(staff)/artist-applications/page.tsx` | **Panel** | Yes: `/artist-applications/[id]` (`app/(staff)/artist-applications/[id]/page.tsx`) | Yes, `?application=` | New tab of the list with the panel open |
| 2 | `/artists` | Artists | `components/artists/artist-list.client.tsx` | `app/(staff)/artists/page.tsx` | **Panel** | Yes: `/artists/[artistId]` | Yes, `?artist=` | New tab of the list with the panel open |
| 3 | `/artworks` | Artworks | `components/artworks/artwork-list.client.tsx` with `artwork-quick-view.client.tsx` | `app/(staff)/artworks/page.tsx` | **Panel** (fetches the detail) | Yes: `/artworks/[artworkId]` (the editor) | Yes, `?artwork=` | New tab of the list with the panel open |
| 4 | `/audit` | Audit log | `components/audit/audit-log-list.client.tsx` | `app/(staff)/audit/page.tsx` | **Panel** | **No** (the panel is the only detail) | Yes, `?event=` | New tab of the list with the panel open. The Record cell is a separate link to the record |
| 5 | `/clients` | Clients | `components/clients/clients-list.client.tsx` | `app/(staff)/clients/page.tsx` | **Panel** | Yes: `/clients/[partyId]` | Yes, `?client=` | New tab of the list with the panel open |
| 6 | `/disputes` | Disputes | `components/disputes/disputes-list.client.tsx` | `app/(staff)/disputes/page.tsx` | **Panel** | **No** (the panel links to the order) | Yes, `?dispute=` | New tab of the list with the panel open |
| 7 | `/editorial/[kind]` (kind = pages, venues, exhibitions, stories) | Editorial | `components/editorial/editorial-list.client.tsx` (server wrapper `components/editorial/editorial-list-page.tsx`) | `app/(staff)/editorial/[kind]/page.tsx` | **Panel** | Yes: `/editorial/[kind]/[id]` | Yes, `?item=` (also opens for a row off the current page, via `initialOpened`) | New tab of the list with the panel open |
| 8 | `/enquiries` | Enquiries | `components/enquiries/enquiries-list.client.tsx` | `app/(staff)/enquiries/page.tsx` | **Panel** | Yes: `/enquiries/[kind]/[id]` (the conversation) | Yes, `?enquiry=<kind:id>` | New tab of the list with the panel open |
| 9 | `/framing` | Framing | `components/framing/framing-catalogue.client.tsx` | `app/(staff)/framing/page.tsx` | **Modal edit dialog** (`StaffFormDialog`) when the user can edit; **nothing** when read-only | No | No (`useState`) | No link at all |
| 10 | `/from-zoho` (tab new) | From Zoho: New | `components/from-zoho/from-zoho-list.client.tsx` `NewFromZohoList` | `app/(staff)/from-zoho/page.tsx` | **Opens the page** (`navigate(/from-zoho/[registerId])`) | Yes: `/from-zoho/[registerId]` | n/a | Yes, the title is a `next/link` to the record page |
| 11 | `/from-zoho?tab=decisions` | From Zoho: Needs a decision | same file, `NeedsDecisionList` | same | **Opens the page** | same | n/a | Yes, opens the record page |
| 12 | `/from-zoho?tab=all` | From Zoho: All | `components/from-zoho/all-from-zoho-list.client.tsx` | same | **Opens the page** | same | n/a | Yes, opens the record page |
| 13 | `/from-zoho?tab=health&drift=register_without_product` and `&drift=status_mismatch` | From Zoho: Sync-health drift | `components/from-zoho/sync-health-drift-list.client.tsx` | same | **Opens the page** | same | n/a | Yes, opens the record page |
| 14 | `/from-zoho?tab=health&drift=product_without_register` | From Zoho: Zoho Product with no register | same file | same | **Nothing** (no `openRow`; the row has no LAX record) | No | n/a | No link in the title |
| 15 | `/from-zoho?tab=link` (view = matched) | From Zoho: Link lax.art, Matched | `components/from-zoho/link-lax-art-report.client.tsx` with `link-report-columns.client.tsx` | same | **Modal** `LinkToZohoDialog` when the user can link; otherwise **opens the page** `/artworks/[id]` | `/artworks/[artworkId]` | No (`useState`) | The title is a `next/link` to `/artworks/[id]` |
| 16 | `/from-zoho?tab=link&view=choice` | Link lax.art, Choose | same | same | **Nothing** on the row (each candidate cell has its own button that opens the dialog) | same | No | Title links to the artwork |
| 17 | `/from-zoho?tab=link&view=none` | Link lax.art, No match | same | same | **Nothing** ("Find in Zoho…" button or row menu) | same | No | Title links to the artwork |
| 18 | `/from-zoho?tab=link&view=linked` | Link lax.art, Linked | same | same | **Opens the page** `/artworks/[id]` | same | n/a | Title links to the artwork |
| 19 | `/help` | Help: questions | `components/help/help-articles-list.client.tsx` | `app/(staff)/help/page.tsx` | **Panel** | Yes: `/help/[id]` (editor) | Yes, `?article=` | New tab of the list with the panel open |
| 20 | `/help/categories` | Help: categories | `components/help/help-categories-list.client.tsx` | `app/(staff)/help/categories/page.tsx` | **Panel** | **No** (editing is a modal `HelpCategoryDialog`) | Yes, `?category=` | New tab of the list with the panel open |
| 21 | `/leads` | Leads | `components/leads/lead-list.client.tsx` | `app/(staff)/leads/page.tsx` | **Opens the page** (`navigate(/leads/[leadId])`) | Yes: `/leads/[leadId]` | n/a | Yes, the title is a link to the page |
| 22 | `/merchandise` | Merchandise | `components/merchandise/merchandise-list.client.tsx` | `app/(staff)/merchandise/page.tsx` | **Panel** | Yes: `/merchandise/[id]` (editor) | Yes, `?product=` | New tab of the list with the panel open |
| 23 | `/orders` | Orders | `components/orders/order-list.client.tsx` with `order-quick-view.client.tsx` | `app/(staff)/orders/page.tsx` | **Panel** (fetches the detail), **but a click on the order number navigates to the full page** | Yes: `/orders/[orderId]` | **No**: `useState` only | Yes, the title is a `next/link` to `/orders/[id]` (the full page) |
| 24 | `/orders/delivery-quotes` | Delivery quotes | `components/delivery-quotes/delivery-quotes-view.client.tsx` | `app/(staff)/orders/delivery-quotes/page.tsx` | **Nothing** (no `onRowOpen`). The order reference is a link; the row buttons open the quote and decline dialogs | `/orders/[orderId]` | n/a | Title links to the order |
| 25 | `/fulfilment` | Fulfilment | `components/orders/fulfilment-list.client.tsx` | `app/(staff)/fulfilment/page.tsx` | **Panel** with an inline "Next step" form | **No** fulfilment page (the panel links to the order) | Yes, `?fulfilment=` | New tab of the list with the panel open |
| 26 | `/payouts` | Payouts | `components/payouts/payout-list.client.tsx` | `app/(staff)/payouts/page.tsx` | **Panel** | **No** | Yes, `?payout=` | New tab of the list with the panel open |
| 27 | `/production` | Production | `components/production/production-queue.client.tsx` | `app/(staff)/production/page.tsx` | **Panel** | Yes: `/production/[id]` (`components/production/production-task-page.client.tsx`) | Yes, `?task=` | New tab of the list with the panel open |
| 28 | `/requests` | Sale limit requests | `components/requests/sale-requests-list.client.tsx` | `app/(staff)/requests/page.tsx` | **Panel** | **No** | Yes, `?request=` | New tab of the list with the panel open |
| 29 | `/holds` | Stock holds | `components/sales/holds-list.client.tsx` | `app/(staff)/holds/page.tsx` | **Panel** | **No** | Yes, `?hold=` | New tab of the list with the panel open |
| 30 | `/original-sales` | Original sales | `components/sales/original-sales-list.client.tsx` | `app/(staff)/original-sales/page.tsx` | **Panel** | **No** | Yes, `?sale=` | New tab of the list with the panel open |
| 31 | `/third-party-sales` | Third-party sales | `components/sales/third-party-sales-list.client.tsx` | `app/(staff)/third-party-sales/page.tsx` | **Panel** | **No** | Yes, `?sale=` | New tab of the list with the panel open |
| 32 | `/staff` | Staff | `components/staff/staff-list.client.tsx` | `app/(staff)/staff/page.tsx` | **Panel** | **No** (roles are managed in Bid admin) | Yes, `?staff=` | New tab of the list with the panel open |
| 33 | `/settings/delivery-regions` | Delivery regions | `components/delivery-regions/delivery-regions-editor.client.tsx` | `app/(staff)/settings/delivery-regions/page.tsx` | **Nothing** (a per-row "Edit" button opens the `RegionDialog` modal) | No | n/a | No link |

Every panel list above (except Orders) sits on `ListPage`, uses `useWorkList`/`useListPanel`, and passes `onRowOpen` and `activeRowId` through. Keyboard behaviour is the same for all of them: Enter on a focused row opens it, J/K and the arrow keys move between rows while the panel is closed, and Esc closes the panel and puts focus back on the row. Phone behaviour is the same too: cards, a tap on the card or its title opens the panel, and the panel is full width below 640px.

#### 2. Summary table: related-record tables on record pages

| Host page (route) | Component | Table | Row click | Title cell |
|---|---|---|---|---|
| `/artists/[artistId]` | `components/artists/artist-record-page.client.tsx` | Artworks (DataTable) | **Nothing** (no `onRowOpen`) | `PrimaryCell` link to `/artworks/[id]` |
| same | same | Editions | **Nothing** | Link to `/artworks/[id]`; "Held by" links to `/clients/[partyId]` |
| same | same | Sales | **Nothing** | **No link at all**: a dead row |
| `/clients/[partyId]` | `components/clients/client-record-page.client.tsx` | Orders (RelatedRecordsSection) | **Opens the page** `router.push(/orders/[id])` | Link to the same page. "View all N" goes to the order list |
| same | same | Editions owned | **Opens the page** `/artworks/[id]` | Link |
| same | same | Sale limits | **Nothing** | Link to `/artworks/[id]` |
| same | same | Sale limit requests | **Opens the list with its panel**: `/requests?view=all&request=<id>` | Same link |
| same | same | Enquiries | **Opens the page** `/enquiries/[kind]/[id]` | Link |
| same | same | Payouts | **Opens the list with its panel**: `/payouts?payout=<id>` | Same link |
| `/artworks/[artworkId]` (edition run) | `components/artworks/edition-runs/linked-listings-card.client.tsx` | Linked listings | **Opens the page** `/artworks/[id]` | `CellLink` to the same page |
| same (original) | `components/artworks/edition-runs/linked-prints-card.client.tsx` | Prints made from the original | **Opens the page** `/artworks/[id]` | `CellLink` |
| same (run) | `components/artworks/edition-runs/run-prints-card.client.tsx` | Prints of the run | **Nothing** (row menu: "Set apart…") | The print label has no link; the Listing cell links to the set-apart artwork |
| same (open edition) | `components/artworks/edition-runs/open-stock-card.client.tsx` | Stock batches | **Nothing** | No link (log rows) |
| `/merchandise/[id]` | `components/merchandise/merchandise-variants.client.tsx` | Variants (RelatedRecordsSection) | **Nothing** (row `…` menu opens the edit, archive and stock dialogs) | SKU, no link |
| `/orders/[orderId]` | `components/orders/order-detail-view.tsx` | Items and refunds (hand-made `<ul>`) | Not clickable | An item links to `/production/[taskId]` when it has one |
| `/leads/[leadId]` | `components/leads/lead-detail-view.tsx` | Orders and enquiries (hand-made `<ul>`) | Not clickable | Links to `/orders/[id]` and `/enquiries/[kind]/[id]` |
| `/production` (above the table) | `components/production/framing-due-list.client.tsx` | Frames due (hand-made `<ul>` in a Section) | Not clickable | The order link goes to `/orders/[id]`; an inline step button |
| `/from-zoho?tab=check` | `components/from-zoho/last-check-view.client.tsx`, `listing-check-section.client.tsx` | Count lists and listing failures (`<ul>`) | Not clickable | A failure links to `/from-zoho/[registerId]` |
| `/from-zoho/[registerId]` | `components/from-zoho/from-zoho-record.client.tsx` | Decided conflicts (`<ul>`) | Not clickable | No links |

These are not record lists (form tables): `components/artworks/edition-framing-card.client.tsx` (a `<table>` of framing toggles), `allocation-editor`, `relation-list-editor`, `opening-hours-editor`, `home-cover-section`, `settings/print-parties-panel`, `pick-and-pack-panel`, `returns-panel`, and the from-zoho dialogs. `/overview` uses `AttentionList`/`LinkList` (links to filtered lists). `/editorial` (the landing page) is a `LinkList` of kinds.

---

#### 3. Per-list detail

##### 1. Artist applications: `/artist-applications`
- **Columns:** Artist (thumbnail, name, location; a PanelLink), Reference, Works, Status, Reviewer, Sent (sortable).
- **Panel:** title, status badge. Meta: Reference, Reviewer. Summary: Based in, Works, Email (copy), Sent. Body is empty (`{null}`).
- **What the panel adds:** the email address and little else. Everything else is already in the row.
- **Panel actions:** an overflow with "Assign to me" or "Remove me as reviewer", only while the application is open. Footer "Open application" goes to `/artist-applications/[id]`, the full page, which acts as "Open full page".
- **Row menu:** Open application (href), Assign or unassign.
- **URL state:** the view (new, in review, waiting, decided, all), `q`, `assignee`, sort and cursor are all in the URL.
- **Judgement:** a **triage queue** for picking up and assigning. Decisions (accept, decline, ask for more) happen only on the full page, so for the real work the panel is a stop on the way.

##### 2. Artists: `/artists`
- **Columns:** Name (with `/slug`, PanelLink, sortable), Discipline, Artworks, Status, Added (sortable).
- **Panel:** Meta: Discipline, Works. Summary: Web address, Added, Artist ID. No body.
- **What the panel adds:** only the Artist ID. Everything else is in the row.
- **Panel actions:** footer "Show their artworks" (goes to `/artworks?artist=`) and "Open artist page" (`/artists/[id]`). No overflow.
- **Row menu:** Open details, Open artist page, Show their artworks, Archive or Restore.
- **Judgement:** a **record browser**. The panel is a pass-through.

##### 3. Artworks: `/artworks`
- **Columns:** Image, Title (artist as the second line; PanelLink), Run, Edition facts, Edition price, Sold on, Status, Last changed (sortable).
- **Panel** (`ArtworkQuickView`): calls `getArtworkDetail` when it opens (skeleton, then error or retry). It shows a large image, a "Not ready to publish" notice listing the blockers, and Details: Year, Medium, Edition price, Sale, Sold on, Last changed, Artwork ID. When there are editions it adds an Editions StatGrid (up to 4 counts).
- **What the panel adds:** a moderate amount (image, medium, year, publish blockers, edition counts).
- **Panel actions:** footer "Publish…" or "Unpublish…" (confirmed by the list) and "Edit artwork", which goes to `/artworks/[id]` and acts as the full page. No overflow.
- **Row menu and bulk:** row menu Open details, Edit artwork, publish/unpublish/archive/restore. Bulk selection with visibility and "Set facts" actions.
- **URL state:** state, `q`, artist, sale, channel, facts, sort and cursor are all in the URL (`artworkListHref`).
- **Judgement:** a **record browser** with some bulk triage (publish).

##### 4. Audit log: `/audit`
- **Columns:** Action (PanelLink), Who, Record (a `CellLink` to the record when one can be resolved), When (sortable).
- **Panel** (`lg`, 640px): Event (Who with email or source, Record type, Record ID, Event ID), What changed (field before → after), Details (extra facts).
- **What the panel adds:** a lot. The diff exists only here.
- **Panel actions:** footer "Open <record type>" goes to the record page. Row menu: Open event, Open record, "Only events by <person>", "Only events on this record".
- **URL state:** actor, action, targetType, targetId, from, to, `q` and sort are all in the URL.
- **Judgement:** a **record browser** or investigation tool. The panel is the only detail view, and no audit page exists.

##### 5. Clients: `/clients`
- **Columns:** Client (name and email; a PersonCell PanelLink; sortable), Type, Editions owned, Paid orders, Joined (sortable).
- **Panel:** status = kind badge. Meta: Joined. Summary: Email, Editions owned, Paid orders, Client ID.
- **What the panel adds:** only the Client ID. Everything else is in the row.
- **Panel actions:** footer "Find in Bid admin" (external `<a>`) and "Open client page" (`/clients/[partyId]`).
- **Judgement:** a **record browser**. The panel is a pure pass-through, and the client page is where the content is (orders, editions, limits, requests, enquiries, payouts).

##### 6. Disputes: `/disputes`
- **Columns:** Order (PanelLink), Status, Buyer, Amount, Opened (sortable), Closed (hidden by default).
- **Panel:** title "Dispute on order LAX-…". Meta: Amount, Opened. Summary: Buyer, Buyer email, Closed, Dispute reference (the Stripe id, copyable).
- **What the panel adds:** the dispute reference and the buyer email.
- **Panel actions:** headerActions "Open order" (`/orders/[id]`). No footer, no overflow, no actions on the dispute itself.
- **Row menu:** Open details, Open order, Copy dispute reference.
- **Judgement:** a low-volume **record browser**. The order page is where staff act.

##### 7. Editorial: `/editorial/pages`, `/editorial/venues`, `/editorial/exhibitions`, `/editorial/stories`
- **Columns:** Title (or Name; PanelLink with slug), Kind (some kinds), City (venues), Status, Dates (exhibitions), Updated.
- **Panel:** Summary: Kind, City, Dates, Updated, Public address (copyable once published), ID.
- **What the panel adds:** the public address and the ID.
- **Panel actions:** footer "Publish" or "Unpublish" (confirm dialog) and "Edit <kind>" (or "View"), which goes to `/editorial/[kind]/[id]` and acts as the full page.
- **URL state:** filtering, sorting and paging happen on the server over the full set, and all of it is in the URL.
- **Judgement:** a **record browser** for content.

##### 8. Enquiries: `/enquiries`
- **Columns:** Sender (PersonCell PanelLink, with an unread-style secondary line), About (artwork thumbnail and title, or the topic), Status, Assigned to, Received (sortable).
- **Panel:** Meta: About, Assigned to. Summary: Message (the excerpt), Email, Account (member or guest), Received, Enquiry ID.
- **What the panel adds:** the message excerpt and the email. Useful for triage.
- **Panel actions:** overflow (with write access) Assign to me, Unassign me, Unassign, Reopen, Close enquiry…. Footer "Open conversation" goes to `/enquiries/[kind]/[id]` and acts as the full page.
- **URL state:** the view, kind, topic, assignee, `q` and sort are in the URL.
- **Judgement:** a **triage inbox**. Replies happen only on the conversation page.

##### 9. Framing: `/framing`
- **Setup:** a plain `DataTable` under a `PageHeader`, not `ListPage`.
- **Columns:** Option (frame swatch, name, details), Lead time, one price column per size band, Status, Used on, and a row actions column when the user can edit.
- **Row click:** opens the `FramingOptionDialog` modal (a `StaffFormDialog` at md size) to edit, and only when `canEdit`. Read-only users get no `onRowOpen`, so the row is inert.
- **URL state:** none. The dialog state is in `useState`, there is no sort, and every row is on one page.
- **Judgement:** a small catalogue or config table. The modal editor is the right fit.

##### 10–18. From Zoho: `/from-zoho` (tabs new, decisions, all, check, health, link)
- **URL state:** all of it (`zohoQueueHref`: `tab`, `artist`, `missing`, `place`, `q`, `view`, `drift`, `page`).
- **New, Decisions, All:**
  - Columns for New: Artwork (title, artist and stock code; a `next/link` to `/from-zoho/[registerId]`), What is missing, Zoho last edited.
  - Columns for Decisions: Artwork, What differs, In Zoho, In LAX, Zoho last edited.
  - Columns for All: Artwork, Where it is, Type, Zoho last edited.
  - Row click: `navigate(recordHref)`, which is `router.push` to the full page.
  - Row menu: offer on lax.art or at auction, open in Zoho, open in Bid.
  - No panel. Cmd-click on the title gives a real new tab of the record.
- **Drift lists** (`sync-health-drift-list.client.tsx`):
  - Register-without-product and status-mismatch open `/from-zoho/[registerId]`.
  - Product-without-register has no `onRowOpen` and no link. It is a row you can only read.
- **Link lax.art** (`link-lax-art-report.client.tsx`):
  - Matched: the row opens the `LinkToZohoDialog` modal (`StaffDialog`) to review and link, or `/artworks/[id]` for users without link permission.
  - Choose and No match: no row open. A per-candidate button or "Find in Zoho…" opens the dialog.
  - Linked: opens `/artworks/[id]`.
  - Every view's title cell links to `/artworks/[id]`. Matched also has bulk "Link selected".
- **Judgement:** New and Decisions are **triage queues** that currently go to a full page. The Matched link view is a triage queue that uses a modal.

##### 19. Help questions: `/help`
- **Columns:** Question (PanelLink), Category, Status, Updated.
- **Panel:** Meta: Category, Updated. Summary: Last changed by, Public address (or "Address once published"), Question ID.
- **Panel actions:** footer "Publish" or "Unpublish" and "Edit" (or "View"), which goes to `/help/[id]`. Row menu: Open details, Edit, Move up or down, Publish, Delete….
- **URL state:** the view, category, `q` and sort are in the URL.
- **Judgement:** a **record browser** for content.

##### 20. Help categories: `/help/categories`
- **Columns:** Category (PanelLink), Status, Questions, Updated.
- **Panel:** Meta: Questions, Updated. Summary: Slug, Category ID.
- **Panel actions:** headerActions "View questions" (`/help?category=`). Footer "Publish" or "Unpublish" and "Edit", which opens the `HelpCategoryDialog` modal on top of the panel.
- **Judgement:** a small config list. There is no page to open.

##### 21. Leads: `/leads`
- **Columns:** Lead (name or email; a link to `/leads/[id]`), Status, Source, Orders and enquiries, Consent, CRM, Last seen (sortable on the client).
- **Row click:** `navigate('/leads/[leadId]')`. Bulk selection is available (export and similar).
- **URL state:** the tab, filters and cursor are in the URL. The sort is local (`defaultSort` with no `onSortChange`).
- **Judgement:** a **record browser** (CRM).

##### 22. Merchandise: `/merchandise`
- **Columns:** Product (with `/slug`; PanelLink), Status, Variants, Price, In stock.
- **Panel:** Meta: Variants, In stock. Summary: Price, Slug, Product ID.
- **What the panel adds:** only the Product ID.
- **Panel actions:** footer "Archive" or "Restore" and "Edit", which goes to `/merchandise/[id]`. Row menu: Open details, Edit, archive.
- **Judgement:** a **record browser**. The panel is a pass-through.

##### 23. Orders: `/orders`
- **Columns:** Order (a `next/link` to `/orders/[id]`), Status, Buyer (with a second line), Total (sortable on the client), Created (sortable on the client).
- **Row click:** `setOpenOrderId`, which opens `OrderQuickView`. A click on the **order number** follows the link to the full order page instead, because DataTable skips a click on an `<a>`. Two parts of the same row do different things.
- **Panel:** fetches `/api/admin/orders/:id`. Summary: Order, Order ID, Buyer or Guest buyer, Email, Total, Placed, Paid, Fulfilment (status and option). Then Items (n) with each line and its price, and Activity (the 5 newest timeline events).
- **What the panel adds:** a lot (lines, paid time, fulfilment, activity).
- **Panel actions:** footer "Open order", which goes to `/orders/[id]` and acts as "Open full page". No overflow; refunds and fulfilment changes happen on the page.
- **URL state:** **the panel is not in the URL.** A reload loses it and it cannot be shared. Filters (status, refund, dates, `q`) and the cursor are in the URL; the sort is local. Saved views use `useSavedViews`.
- **Selection:** bulk Export CSV and Copy numbers.
- **Judgement:** a lookup or **record browser**, the most used list.

##### 24. Delivery quotes: `/orders/delivery-quotes`
- **Columns:** Order (a `next/link` reference, with the items and price on a second line), Delivering to, State, Held until (or Requested), and an Actions column with "Quote" or "Revise quote" and "Can't deliver" buttons.
- **Row click:** nothing. The work is done inline through dialogs.
- **URL state:** `?view=` is in the URL.
- **Judgement:** a **triage queue** with inline actions.

##### 25. Fulfilment: `/fulfilment`
- **Columns:** Order (PanelLink), Status, Buyer, Delivery, Tracking (hidden by default), Last change (sortable).
- **Panel:** Meta: Delivery, Last change. Summary: Buyer, Tracking (copyable), Possession, Paid. Body: **Next step** with `FulfilmentEditForm` (status, carrier, tracking, possession). The panel is `dirty`-guarded.
- **What the panel adds:** a lot. It is where the work gets done.
- **Panel actions:** headerActions "Open order". Saving the form closes the panel. Row menu: Open details, Move on…, Open order, Copy tracking.
- **Judgement:** the clearest **triage queue**. The panel is the workspace, and no fulfilment page exists.

##### 26. Payouts: `/payouts`
- **Columns:** Payee (PersonCell PanelLink, "Ref …"), Status, Amount, Source, Due (sortable, default), Created.
- **Panel:** Meta: Net to pay, Due. Summary: Gross, Deductions, Source, Paid, Transfer reference, Payout reference.
- **What the panel adds:** the gross and deduction breakdown and the transfer reference.
- **Panel actions:** footer "Mark £X paid" (with a disabled reason when it cannot be marked), which opens `MarkPayoutPaidDialog`. Row menu: Open details, Copy payout reference.
- **URL state:** the view, `source` filter, `q`, sort and cursor are in the URL.
- **Judgement:** a **triage queue** for finance.

##### 27. Production: `/production`
- **Columns:** Task (the order on the second line; PanelLink), Status, Assignee, Created (sortable).
- **Panel:** notice for errors. Meta: Order, Created. Summary: Last change, Task ID. Body: an Assignee select (`EnumSelect`, applied straight away).
- **Panel actions:** headerActions **"Open full page"**, which goes to `/production/[id]`. **This is the only panel with that wording.** Overflow holds the other actions. Footer holds the next-step primary button.
- **URL state:** the view, assignee, `q` and sort are in the URL. Frames due appear above as a `<ul>`.
- **Judgement:** a **triage queue**.

##### 28. Sale limit requests: `/requests`
- **Columns:** Artwork (requested count on the second line; PanelLink), Status, Owner, Sent (sortable).
- **Panel:** Meta: Owner, Request. Summary: Their note, Reason given (when declined), Sent, Answered, Request ID.
- **What the panel adds:** the note and the decline reason.
- **Panel actions:** footer "Decline" and "Approve" (they open dialogs) while the request is pending. No page exists.
- **URL state:** the default view is pending. The view, `q` and sort are in the URL.
- **Judgement:** a **triage queue**.

##### 29. Stock holds: `/holds`
- **Columns:** Edition (PanelLink), Status, Held for, Ends (sortable), Created (sortable).
- **Panel:** Meta: Held for, Ends. Summary: Broker, Note, Created, Hold ID.
- **Panel actions:** footer "Release hold" (confirm). The primary action in the header is "New hold".
- **Judgement:** a light **triage** list or record browser.

##### 30. Original sales: `/original-sales`
- **Columns:** Artwork (PanelLink), Status, Buyer, Price, Created.
- **Panel:** Meta: Buyer, Price. Summary: Buyer email, Reservation ends, Created, Sale ID.
- **Panel actions:** footer "Issue £X invoice", which opens `IssueInvoiceDialog`.
- **Judgement:** a **triage** list (low volume).

##### 31. Third-party sales: `/third-party-sales`
- **Columns:** Edition (PanelLink), Status, Buyer, Paid by buyer, Fee, Created.
- **Panel:** Meta: Paid by buyer, Recorded. Summary: Seller, Buyer, Created, Sale ID. Body: a **Fees** section with each fee's amount and status.
- **Panel actions:** footer "Approve fee", which opens `ApproveFeeDialog`.
- **URL state:** the view, the `fee=pending` filter, `q` and sort are in the URL.
- **Judgement:** a **triage queue** (fee approval).

##### 32. Staff: `/staff`
- **Columns:** Staff member (PersonCell PanelLink), Access, Role, Last active, Added.
- **Panel:** Meta: Last active. Summary: Email, Can see and do, Added, Access removed, LAX account ID. Body: **Roles** as chips.
- **Panel actions:** footer "Manage in Bid admin" (an external `<a>`, new tab).
- **URL state:** the view, `role` filter (team views), `q` and sort are in the URL.
- **Judgement:** a **record browser**. Nothing can be edited here.

##### 33. Delivery regions: `/settings/delivery-regions`
- **Setup:** an embedded DataTable with columns Region, Standard, Specialist, Price and an "Edit" button.
- **Row click:** nothing. The Edit button opens the `RegionDialog` modal.
- **Judgement:** a config table.

---

#### 4. Findings worth acting on

1. **Orders is the odd one out.**
   - Its panel lives in `useState`, so it cannot be addressed by URL.
   - The order-number link goes to the full page while the rest of the row opens the panel. Two parts of one row do two different things.
   - Every other panel list keeps the panel in the URL and links the title to the panel URL.
2. **Cmd/Ctrl/middle-click on a panel list's title opens the list in a new tab with the panel open**, not the record page. Lists with a page (artists, artworks, clients, editorial, enquiries, help, merchandise, production, artist applications) give no way to open the full record in a new tab from the row. The row `…` menu sometimes has a page link: an `href` item renders as a link.
3. **Panels that add almost nothing beyond the row** (an ID or a slug): artists, clients, merchandise, help categories, editorial, and arguably artist applications. In these the panel is a pass-through to "Open … page".
4. **Panels that are the only detail view** (no page exists): audit, disputes, fulfilment, payouts, requests, holds, original sales, third-party sales, staff, help categories.
5. **Only one panel says "Open full page"** (production, in headerActions). The others put the page link in the footer under record-specific wording ("Open order", "Open client page", "Open artist page", "Edit artwork", "Edit", "Open conversation", "Open application"), or in headerActions (disputes and fulfilment: "Open order").
6. **No panel lets you step to the next or previous record.** The Sheet is modal, so J/K do nothing while it is open. `RecordPager` is not used.
7. **Back does not close a panel or step back through panels** (`replaceState`). Back after list navigation restores the filter, sort and page, but `openId` does not follow a popstate.
8. **Phone:** cards open on tap. Keyboard opening on a phone is possible only through the title link. Framing, orders and the zoho or delivery-quote lists differ in what their title link does.

#### 5. Summary by behaviour

- **Opens a DetailPanel (19):** artist applications, artists, artworks, audit, clients, disputes, editorial (4 kinds), enquiries, help questions, help categories, merchandise, orders (with `useState`, not in the URL), fulfilment, payouts, production, sale requests, holds, original sales, third-party sales, staff.
- **Opens a full page (row navigates):**
  - Main lists: leads, From Zoho New, Needs a decision, All, the two drift lists (register-without-product and status-mismatch), and Link lax.art Linked (and Matched for users without link permission).
  - Related tables: client page Orders, Editions owned and Enquiries; artwork Linked listings and Prints.
  - Rows that open another list's panel: client page Sale limit requests (goes to `/requests?request=`) and Payouts (goes to `/payouts?payout=`).
- **Opens a modal dialog:** framing (edit, editors only) and Link lax.art Matched (the review and link dialog).
- **Nothing on row click** (only a link in the title, or none):
  - delivery quotes (inline buttons), delivery regions (Edit button), Zoho product-without-register, Link lax.art Choose and No match, framing for read-only users.
  - Artist page Artworks, Editions and Sales (Sales has no link at all).
  - Client page Sale limits, artwork run Prints, open-stock batches, merchandise Variants.
  - The hand-made `<ul>` lists on the order, lead and production pages.

#### 6. Seed data (shop-api seeds, `apps/shop-api/src/infrastructure/seed/`; packages/db seeds are the Bid platform's)

- Artist: **Flora Powers** (slug `foundation-artist`), from `catalogue-seed.ts`.
- Artworks: **Reed Study**, **Harbor Print**, **String Study**, **Vessel Study** and **Tide Line**.
- Clients (parties): **Acceptance consignor** and **Acceptance buyer party** (`acceptance-staff-operations-seed.ts`).
- Order, fulfilment and payout: one paid order for **Reed Study**, awaiting production. The buyer is the acceptance buyer party and the payout goes to **Acceptance consignor**. The seed creates the fulfilment and the payout ledger row.
- Production task: the code does not show whether one is created for that order.
- Merchandise: **Acceptance test cap** (SKU `ACCEPT-MERCH-CAP-001`).
- Help: the categories are "Buying", "Shipping and delivery", "Returns" and "Private viewings"; one question is "How do I buy an artwork?" (`help-centre-seed.ts`).
- Enquiries, sale-limit requests, disputes, artist applications: no seeded rows found.

---

## Appendix C. Client and organisation workspace (apps/web/src/app/(client), apps/account)

### Client & organisation workspace: row-click audit (read-only)

Scope: `apps/web/src/app/(client)/**`, `apps/web/src/components/{dashboard,workspace,organisation-team,legal-entity,organisations,organisation-home,collect}`, `apps/web/src/features/*` (only `saleroom`, which is staff-only: no client lists), and `apps/account` (LAX Account). Everything below was checked in code; no repo files were changed.

#### How rows are built (shared)

Almost every client list uses `RecordList` + `RecordRow` from `packages/ui/src/components/ui/record-row.tsx`:

- With `href`, the **title becomes a real `<Link>`/`<a>`** whose `::after` spans the whole row (`after:absolute after:inset-0`). The row is a link, so Cmd/Ctrl-click, middle-click, "open in new tab", Enter on focus and the status-bar URL all work natively. The row's own controls (action button, "…" menu, checkboxes) sit above it at `z-10`.
- Without `href`, the row is static: clicking it does nothing.
- Responsive: `RecordList` is a CSS size container. Below 42rem (`@2xl`) the row stacks (title, facts, status, lead figure) on a **card-like stacked row**. A `needsYou` action becomes a full-width button under the facts. There is no `<table>` anywhere in the web client lists.
- Filter, sort, view and search state use `apps/web/src/components/workspace/use-list-query.ts`, which writes `history.replaceState` (shareable URL, but no new history entries for filter changes). View tabs are real links (`?view=`). No client list paginates; each loads everything. The exceptions are Notifications ("Load more") and Team activity ("Show older"), and neither keeps the extra page in the URL.
- The **only side drawer in the whole client area** is `BidHistoryDrawer` (`apps/web/src/components/dashboard/bid-history-drawer.tsx`, built on `DrawerDetail` → Radix `Sheet`, `side="right"`, `w-full sm:max-w-lg`, so it is full-screen on a phone, not a bottom sheet). It opens from the **"…" menu → "Bid history"** on a bid row, **not** from a row click, and it is held in `useState` (`history`), so it is **not URL-addressable**.
- `components/dashboard/seller/payout-detail.tsx` is **not a drawer**. It is the body of the full page `/selling/payouts/[payoutId]`.
- Other overlays in the client area are Radix `Dialog`s for actions only, for example watching reminders and alerts, member role, remove and transfer, access-request approve, buyer-agent limits, the "How this list works" dialog on Home, and the collection visit card dialog. `FilterSheet` and `BidsFilterSheet` are filter sheets, not record panels.

#### Wide table

| # | Module | Route (list) | page.tsx | List / row component | Row click today | Full detail page for the record | Drawer URL-addressable? | Row fields | Drawer/panel content & added value | Drawer/row actions | Row is `<a>` (Cmd/middle-click new tab) | Keyboard | Phone | Filter/sort/page in URL | Triage queue vs record browser | Who can see it |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | Bids (Active / Won / Not won) | `/bids?view=active\|won\|lost` | `apps/web/src/app/(client)/bids/(list)/page.tsx` → `app/(client)/bids/bids-page-content.tsx` | `components/dashboard/bids/bids-view.tsx` → `bids/bid-row.tsx` | **Navigates to the public lot page** (`lotPath(lot)`, from `lib/bid/my-bids.vm.ts`). A withdrawn lot has no href, so the click does nothing | The lot page only. There is no account-side bid detail page | Drawer = `BidHistoryDrawer`, opened from the "…" menu only. State is `useState`, **not in the URL** | thumb, title, lot no., sale, "Placed by" (shared org), placement note, 2–3 figures (current bid / your max / closes, with local time), status badge, one next step (`RowStep`), "…" | Bid history: every bid on the lot, newest first, own bids highlighted, anonymised bidder refs, amounts, times. It adds the competitor bid ladder, which is not on the row. Read-only | Drawer: none (close only, plus "Try again" on error). Row menu: View lot, extra steps, Bid history, Copy link | Yes (Next `Link`) | Enter on title link opens the lot. Esc closes the drawer (Radix). Focus returns to the previously focused element (the "…" trigger, since the menu item runs in rAF after the menu closes): likely OK, unverified at runtime | Stacked rows. The drawer is a right sheet at full width (not a bottom sheet) | view, q, sale, by, status, sort in URL (`bidsListSearch`, replaceState). No pagination | **Triage queue** (outbid / pay / closing soon, `needsYou`) | Personal client or org member whose role follows buying (`buyingPageView`; refused roles get `WorkspacePageNoAccess`) |
| 2 | Bids → Sales (registrations) | `/bids?view=sales` (org only) | same | `bids/registration-row.tsx` | Approved/pending: **navigates to `/bids?sale=<id>`** (the filtered bid list). Otherwise no href, so nothing | none | n/a | gavel icon, sale title, meta (date, paddle, registered by), figure (limit), status, "Contact us" | – | Contact us | Yes when href | Native link | Stacked | q in URL | Record browser (status check) | Org member with buying. `registrations` is `undefined` for personal accounts, so the tab is hidden |
| 3 | Bids → Telephone bids | `/bids` section (personal only) | `app/(client)/bids/bids-extra-sections.tsx` | `bids/telephone-booking-row.tsx` | **Navigates to `/bids/telephone/[id]`** | `app/(client)/bids/telephone/[id]/page.tsx` (+ `telephone-bid-detail-content.tsx`) | n/a | phone icon, sale title, meta, max figure, status | – | none | Yes | Native | Stacked | none | Record browser | Personal account only |
| 4 | Bids → Condition reports | `/bids` section (personal only) | same | `bids/condition-report-row.tsx` | **Navigates to the lot page** (`row.lotHref`) | lot page only | n/a | icon, lot title, lot no., "asked" date, status, decline note in the detail line | – | Download (when ready) | Yes | Native | Stacked | none | Record browser | Personal only |
| 5 | Bids → Offers (re-offers to bidders) | `/bids` top section | `bids-page-content.tsx` → `bids/offers/reoffer-offers-section.tsx` | `bids/offers/reoffer-offer-rows.tsx` | **Navigates to `/bids/offers/[reofferId]`** | `app/(client)/bids/offers/[reofferId]/page.tsx` | n/a | thumb, title, meta, step button (same href) | – | Answer (link) | Yes | Native | Stacked | none | Triage queue | Bidder who received an offer |
| 6 | Purchases (To pay / In progress / Completed) | `/purchases?view=to-pay\|…` | `app/(client)/purchases/(list)/page.tsx` | `components/dashboard/purchases/purchases-view.tsx` → `purchases/purchase-row.tsx` | **Navigates to `/purchases/[lotId]`** (`card.detailHref`) | `app/(client)/purchases/[lotId]/page.tsx` (`components/dashboard/purchases/purchase-detail.tsx`) | n/a | checkbox (payer multi-select), thumb, title, lot no., sale, "won by", badge note, amount (due/paid), status, next step | – | Row step (Pay, and so on), "…": View purchase, View lot, Invoice (new tab), Report a problem, Copy reference. Bulk: "Pay N" bar | Yes | Native. Checkbox is z-10 above the link | Stacked. Needs-you step full-width | view, q, sale, wonBy, sort in URL. Selection is useState | **Triage queue** (to pay) + record browser | Personal client or org member with buying/finance |
| 7 | Private sales (buyer side) | `/purchases` top section | `purchases/(list)/page.tsx` → `components/dashboard/private-sales/private-sales-panel.tsx` | `private-sales/private-sale-rows.tsx` | **Navigates to `/private-sales/[reference]`** | `app/(client)/private-sales/[reference]/page.tsx` (`private-sale-detail.tsx`) | n/a | title, "Private sale", work ref, pay-by date, figure, stage badge, step | – | needStep | Yes | Native | Stacked | none | Triage | Party to a private sale (seeded? not checked) |
| 8 | Consignments | `/selling/consignments?view=…` | `app/(client)/selling/consignments/page.tsx` | `components/dashboard/seller/consignments-view.tsx` → `seller/consignment-row.tsx` | **Navigates to `/selling/consignments/[id]`** | `app/(client)/selling/consignments/[id]/page.tsx` (tabs via `?tab=messages\|documents\|history`) | n/a | thumb, title, reference, "sent by", sale, moment figure (labelFirst), price/estimate, status (live), step | – | Step, "…": View consignment, Download agreement (PDF), View lot, Copy reference | Yes | Native | Stacked | view, q, stage, sort in URL | **Triage** (needs changes / accept agreement) + browser | Personal seller or org member with selling |
| 9 | Private sales (seller side) | `/selling/consignments` section | `consignments/page.tsx` (`<PrivateSalesPanel side="seller" />`) | `private-sale-rows.tsx` | Navigates to `/private-sales/[reference]` | as #7 | n/a | as #7 | – | step | Yes | Native | Stacked | none | Triage | Seller party |
| 10 | Collection | `/collection` | `app/(client)/collection/page.tsx` | `components/dashboard/seller/collection-view.tsx` (inline `WorkRow`) | Bought work: **navigates to `/purchases/[lotId]`** (if the member follows purchases) else the **lot page**. Returned work: lot page | Purchase page or lot page | n/a | thumb, title, meta, consign note, hammer price (finance only), "where" badge, "Consign this work" step | – | Consign step, "…": View purchase/lot, Copy reference | Yes | Native | Stacked | view, q, filters, sort in URL (`worksListSearch`) | Record browser | **Organisation only** (a personal account redirects to `/selling/consignments`). Role gated by `workspacePageRefusal` |
| 11 | Sold & payouts: Sold lots | `/selling/payouts?view=sold` | `app/(client)/selling/payouts/page.tsx` | `components/dashboard/seller/sold-and-payouts-view.tsx` (`SoldRow`) | **Navigates to `/selling/payouts/[payoutId]`** if in a payout, else the **lot page** | payout page / lot page | n/a | (blank) thumb, title, meta, hammer + "you receive" (both on phone, `figuresNarrow="all"`), status | – | "…": View payout, View lot | Yes | Native | Stacked | view, q, year, sort in URL | Record browser | Personal seller or org member allowed payouts (not consignors/viewers) |
| 12 | Sold & payouts: Payouts | `/selling/payouts?view=payouts` | same | same (`PayoutListRow`) | **Navigates to `/selling/payouts/[payoutId]`** | `app/(client)/selling/payouts/[payoutId]/page.tsx` (`components/dashboard/seller/payout-detail.tsx`: lines table, statement download) | n/a | "Payout of £net", period, reference, gross "sales", "fees", status | – | "…": Download statement (PDF) | Yes | Native | Stacked | as #11 | Record browser | as #11 |
| 13 | Seller re-offer requests | `/selling/payouts` top | `selling/payouts/page.tsx` | `components/dashboard/seller/seller-reoffer-rows.tsx` | Navigates to `/selling/payouts/offers/[reofferId]` | `app/(client)/selling/payouts/offers/[reofferId]/page.tsx` | n/a | title, meta, status | – | – | Yes | Native | Stacked | none | Triage | Seller with an unsold-lot request |
| 14 | Watching → Lots | `/watching` (`?tab=lots`) | `app/(client)/watching/page.tsx` | `components/dashboard/watchlist/watching-view.tsx` (`LotsList`) | **Navigates to the public lot page** | lot page | n/a | thumb, title, lot no., sale, moment, reminder label, figure, standing badge | – (reminder/note = **Dialog** from menu) | "…": View lot, Set/Change reminder or note (`LotReminderDialog`), Stop watching. "Clear ended" | Yes | Native | Stacked | **tab only** in URL. Search + sort are `useState` (lost on reload) | Record browser | Any signed-in client (personal or org) |
| 15 | Watching → Artists | `/watching?tab=artists` | same | same (`ArtistsList`) | **Navigates to the public artist page** | artist page | n/a | portrait, name, alert summary, reach | `ArtistAlertDialog` (Edit alert) | Edit alert, Stop following | Yes | Native | Stacked | tab in URL, search useState | Record browser | Any |
| 16 | Watching → Searches | `/watching?tab=searches` | same | `watchlist/watching-searches-list.tsx` | **Navigates to `/search?<saved query>`** | search results | n/a | icon, query summary, alert state | `TurnOnEmailDialog` | alert toggle actions | Yes | Native | Stacked | tab in URL | Record browser | Any |
| 17 | Notifications | `/notifications` | `app/(client)/notifications/page.tsx` → `notifications-inbox-content.tsx` | `components/dashboard/notifications-inbox-board.tsx` → `notifications/notification-row.tsx` (custom `<li>`, not RecordRow) | **Navigates to `row.href`** (the related record) and marks it read (`onOpened`). Account-switch hop = full-load `<a>`. No href = nothing | n/a (the target record's page) | n/a | checkbox (md+), type icon, title (bold if unread), message (2 lines), account tag, relative time | – | "…": Open, Mark as read, Archive, Mute org. Bulk: Mark as read, Archive. Mark all read | Yes | Native. Checkbox hidden < md | Stacked. No checkbox on phone | tab, q, type, account in URL (`useListQuery`). "Load more" not in URL | **Triage queue** (inbox) | Any |
| 18 | Notifications → Needs action | `/notifications` top section | same | `notifications/needs-action-row.tsx` | **Nothing on the row**. Only the action button links | – | n/a | topic icon, title, detail, account, raised time, due badge | – | single action button (Link) | Button only | Tab to button | Button full-width on phone | – | **Triage** | Any |
| 19 | Home (organisation): Needs you | `/home` | `app/(client)/home/page.tsx` | `components/organisation-home/home-needs-you.tsx` | **Nothing on the row**. Only the action button (Link) | – | n/a | icon, title, detail, raised time, due badge | "How this list works" = **Dialog** (help text) | action button | Button only | Tab to button | Button full-width on phone | none | **Triage** | **Organisation member** (personal accounts are redirected to `/bids`) |
| 20 | Home: Recent activity / Upcoming sales | `/home` | same | `organisation-home/home-activity.tsx`, `home-upcoming-sales.tsx` | Activity: inline text link to the record when href. Sales: whole card is a `<Link>` to the sale | sale page | n/a | sentence + time; sale mat, title, timing, works count | – | "See all" → team activity / sales | Yes | Native | Sales scroll sideways on phone | – | Summary | Org member |
| 21 | Team → Members | `/team` | `app/(client)/team/page.tsx` | `components/legal-entity/member-list.tsx` → `legal-entity/members/member-row.tsx` | **Nothing** (no href) | **none** (no member detail page). "View activity" goes to `/team/activity?person=` | n/a | initials, name ("You"), email, two-step note, last active, role text | Actions are **Dialogs**: ChangeRole, RemoveMember, TransferOwnership, LeaveOrganisation | "…": Change role…, View activity, Transfer ownership…, Remove…, Leave… | No | Tab to "…" only | Stacked | search + role filter are **useState** (not in URL) | Record browser (admin) | **Org owner/admin** (Team is owners and admins only) |
| 22 | Team → Asking for access | `/team` top | same | `components/organisation-team/access-requests-panel.tsx` | **Nothing** | none | n/a | initials, "name · ask", quoted reason, when | Approve → **Dialog** to pick a role | Decline, Approve | No | Buttons | Stacked | none | **Triage** | Org owner/admin |
| 23 | Team → Bidding (who can bid) | `/team/bidding` | `app/(client)/team/bidding/page.tsx` | `components/organisation-team/who-can-bid-view.tsx` | **Nothing** | none | n/a | initials, agent name, facts (limits), status badge, usage meter | Dialogs: OrganisationLimit, AuthoriseBuyerAgent, RevokeAuthorisation | "…": Change limits…, End authorisation…. "Authorise" button | No | Buttons/menu | Stacked | none | Record browser (config) | Org owner/admin |
| 24 | Team → Bidding: stopped bids | `/team/bidding` section | same | `components/legal-entity/stopped-member-bids-section.tsx` (plain `<ul>`) | **Nothing** (read-only text) | none | n/a | member, left date, each lot · kind · max | – | none | No | – | plain list | none | Review log | Org owner/admin |
| 25 | Team → Activity | `/team/activity` | `app/(client)/team/activity/page.tsx` | `components/organisation-team/activity-view.tsx` (day groups, plain `<li>`) | **Nothing** (no link per entry) | none | n/a | group icon, sentence, time, note | – | Export CSV, Show older | No | – | plain list | person, group, period **in URL** (`router.push`). "Show older" pages are useState | Audit log browser | Org owner/admin |
| 26 | Team → Invitations | `/team/invitations` | `app/(client)/team/invitations/page.tsx` | `components/legal-entity/members/pending-invitations.tsx` | **Nothing** | none | n/a | mail icon, email, detail (role, sent, expiry) | – | Resend, "…": Resend, Withdraw/Remove (toast + Undo) | No | Buttons | Stacked | none | Triage-ish (pending) | Org owner/admin |
| 27 | Organisations (my accounts) | `/organisations` | `app/(client)/organisations/page.tsx` | `components/organisations/account-list.tsx` | **Switches account and navigates to that account's home** (hop URL via `AccountSwitchLink`) | the account's home | n/a | title, meta, status, step button | – | step/"Open" button | Yes (hop link; a new tab also switches) | Native | Stacked | none | Switcher | Any client |
| 28 | Organisations → Invitations to me | `/organisations` section and `/organisations/invitations` | `app/(client)/organisations/page.tsx`, `organisations/invitations/page.tsx` | `components/organisations/invitation-list.tsx` | **Navigates to `/organisations/invitations/review/[id]`** | `app/(client)/organisations/invitations/review/[id]/page.tsx` | n/a | title (org), meta, Review button | – | Review | Yes | Native | Stacked | none | Triage | Invitee |
| 29 | Organisation → Documents (KYB asked for) | `/organisation/documents` | `app/(client)/organisation/documents/page.tsx` | `components/organisations/organisation-document-list.tsx` (plain `<li>`) | **Nothing** | none | n/a | title, status badge, hint | – | Upload (inline `OrganisationDocumentUpload`) | No | – | stacked flex | none | Triage (docs requested) | Org owner/admin (tab gated by `requireOrganisationTab`) |
| 30 | Organisation → Documents: agreements | same | same | `components/organisation-team/agreement-documents.tsx` | **Nothing** (no href) | the consignment page exists but is not linked | n/a | icon, title, detail, "PDF", "To accept" badge | – | Download icon (`<a download>`) | No | – | Stacked | none | Record browser (files) | Org member with documents access |
| 31 | Organisation → Documents: payout statements | same | same | `components/organisation-team/statement-documents.tsx` | **Nothing** | `/selling/payouts/[payoutId]` exists but is not linked | n/a | icon, title, period, detail | – | Download | No | – | Stacked | none | Record browser | Org finance-capable member |
| 32 | Organisation → Payouts | `/organisation/payouts` | `app/(client)/organisation/payouts/page.tsx` | **No record list**: payout account card + Stripe Connect `ConnectAccountManagement` setup | – | – | – | – | – | – | – | – | – | – | Settings | Org owner/admin/finance |
| 33 | Organisation → Security | `/organisation/security` | `app/(client)/organisation/security/page.tsx` | **No record list** (`TwoStepPolicyPanel`) | – | – | – | – | – | – | – | – | – | – | Settings | Org owner/admin |
| 34 | Purchases → Collect visits | `/purchases/collect` (no `lots`) | `app/(client)/purchases/collect/page.tsx` | `components/collect/visits-list.tsx` → `visit-card.tsx` | **Nothing**: full inline card. Change/cancel through an inline `Dialog` | none | n/a | full visit card (date, lots, collector) | – | change/cancel | No | – | cards | none | Record browser | Buyer with paid lots |
| 35 | Legal entities | `/legal-entities/[id]/payouts/[payoutId]/statement/unavailable` | only an error page | – | **No list** | – | – | – | – | – | – | – | – | – | – | – |
| 36 | Settings lists (muted orgs, devices) | `/settings/notifications` | `app/(client)/settings/notifications/page.tsx` | `components/dashboard/settings/muted-organisations.tsx`, `device-push-row.tsx` (iOS install **Sheet**, not a record panel) | Inline toggles only | – | – | – | – | – | – | – | – | – | Settings | Any |

##### LAX Account app (`apps/account`)

| Module | Route | page.tsx | Component | Row click | Detail page | Notes |
|---|---|---|---|---|---|---|
| Portfolio holdings | `/account/portfolio` | `apps/account/src/app/account/portfolio/page.tsx` | `apps/account/src/components/portfolio-holdings.tsx` (`<Table>` on md+, `<ul>` cards on phone `md:hidden`). Title from `components/holding-row-parts.tsx` | **Only the title is an `<a>`** (not the whole row) → `/account/portfolio/[product]/[id]`. Edition groups **expand inline** (`holding-group.client.tsx`, `aria-expanded` button) | `apps/account/src/app/account/portfolio/[product]/[id]/page.tsx` (`portfolio-work-detail.tsx`) | Filters in URL via `filter-toolbar.client.tsx` (`router.replace/push`, GET form). Real table on desktop, cards on phone. No drawer |
| Money ledger | `/account/portfolio/money` | `.../portfolio/money/page.tsx` | `components/portfolio-money.tsx` | Per-entry "deep link" cell (`EntryLink`, `safeDeepLink`) to the product's page. The row itself is not clickable | external/product page | Table + phone list |
| Selling → Sales | `/account/selling/sales` | `.../selling/sales/page.tsx` | `components/selling/selling-sales.tsx` | Nothing (inline `<li>`). Period links, CSV download | – | period in URL |
| Selling → Payouts | `/account/selling/payouts` | `.../selling/payouts/page.tsx` | `components/selling/selling-payouts.tsx` | Nothing. `<li id="payout-…">` is an anchor target only | – | – |
| Selling → Artworks / Editions | `/account/selling/artworks`, `/editions` | respective pages | `selling-artworks.tsx`, `selling-editions.tsx` | Nothing. Editions has `SaleRequestDialog` / withdraw buttons | – | Dialog = action |
| Security (devices, passkeys, sign-in methods), address book | `/account/security`, `/account/profile` | – | `*-list.client.tsx` | inline actions with dialogs | – | settings |

#### Per-list notes

1. **Bids** (`components/dashboard/bids/bids-view.tsx`, `bid-row.tsx`). Every row with a lot is a link to the **public lot page**. There is no account-side bid record page. The only drawer in the client area, `BidHistoryDrawer`, is hidden in the "…" menu (`{ label: "Bid history", onSelect: () => onOpenHistory(card) }`) and kept in `useState<MyBidCardVm|null>`, so you cannot deep-link, refresh into, or Back out of it. It shows only the lot's bid ladder (fetched with `fetchLotBidHistoryRows(lotId, 200)`) and has no actions. On a phone it is a full-width right sheet (`DrawerDetail`, `side="right"`, `w-full sm:max-w-lg`). Live updates through `MyBidsLiveUpdates`. This is the strongest triage queue (outbid, to pay, closing).
2. **Purchases** (`purchases-view.tsx`, `purchase-row.tsx`). The row goes to `/purchases/[lotId]`, which is a real page. Multi-select checkboxes for "pay together" sit above the row link. This queue is driven by the "To pay" tab, with an attention count.
3. **Consignments** (`consignments-view.tsx`, `consignment-row.tsx`). The row goes to `/selling/consignments/[id]`. The detail page has tabs in `?tab=`. `SubmissionsListAutoRefresh` polls.
4. **Collection** (`collection-view.tsx`). The row target depends on role: the purchase page if the member follows purchases, otherwise the lot page. The page is organisation-only.
5. **Sold & payouts** (`sold-and-payouts-view.tsx`). A sold-lot row goes to its payout page when one exists, otherwise the lot page. A payout row goes to `/selling/payouts/[payoutId]`. `seller/payout-detail.tsx` renders that page (a lines `<table>` on md+, a list on phone), **not a drawer**.
6. **Watching**. All rows are links to public pages (lot, artist, search). Search and sort are in `useState`, so they are not in the URL, unlike the other lists. Reminders and alerts open Dialogs from the menu.
7. **Notifications**. The row is a link to the target record and marks it read. The custom row has its own `data-row-link` overlay with the same pattern as RecordRow. The "Needs action" rows have no row link, only a button.
8. **Team** (members, invitations, access requests, who-can-bid, stopped bids, activity). **None of these rows open anything.** Every action is a "…" menu item or button that opens a Dialog. There is no member detail page. The member filter and search are `useState`. Activity filters are in the URL, but entries are not linked.
9. **Organisation documents**. The rows are static. Agreements and statements have a download icon but do not link to the consignment or payout pages that do exist.
10. **Organisation payouts / security**. These are settings pages, with no record lists.
11. **features/saleroom**. This is staff saleroom/clerk UI, not reachable from the client workspace.
12. For contrast (out of scope): the admin side does have URL-addressable panels (`lib/admin/submissions/submissions-staff-list.vm.ts` `submissionPanelHref`/`submissionPanelId`, `lib/admin/sales/sales-staff-list.vm.ts` `salePanelHref`). The client side has no equivalent.

#### Seeded users (packages/db/src/seed/dev)

From `packages/db/src/seed/dev/legacy-demo-seed.ts` and `organisation-journeys-seed.ts`. All demo users use the `@lax.bid` domain. Passwords are intentionally not reproduced.

- Individual (personal) clients: `user1@…` (buyer, KYC approved, has demo bids), `user2@…` (personal seller; also a **viewer** of Northbank Gallery). There are also state fixtures (`kyc-pending@`, `kyc-rejected@`, `unverified@`, `suspended@`, `bounced@`).
- **Organisation "Northbank Gallery" (approved):** `gallery-admin@…` = **admin** (also owner of the restricted dealer org Cedar & Stone); `gallery-finance@…` = finance; `consignor@…` = consignor; `viewer@…` and `specialist@…` = viewer; `buyer-agent@…` = buyer_agent (journeys seed, with a bid limit); `estate-owner@…` = **owner** (journeys seed; also owns an estate org). `company-owner@…` = owner of several orgs.
- Staff accounts (`admin@`, `staff-*@`) are staff, not client-workspace users.

---
