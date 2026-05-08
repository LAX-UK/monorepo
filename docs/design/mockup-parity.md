# Mockup parity & deliberate supersets

This document tracks where the live UI deliberately ships richer behaviour than
the static UI mockups. Reviewers landing on this list should treat each item as
intentional and not file regressions for them.

The mockup parity review applied to the routes listed in
`apps/web/src/app/(marketing)/**`, `apps/web/src/app/dashboard/**`, and
`apps/web/src/app/admin/**`. The Phase 0–4 changes are documented in the
implementation plan under `.cursor/plans/ui-mockup-parity-plan_*.plan.md`.

## Deliberate supersets we keep

These items are present in the production app even though the mockups omit them.
They are documented here so design reviews don't re-flag them:

- **Command palette** (Cmd/Ctrl + K) — `components/layout/command-palette-lazy.tsx`.
  Power-user navigation across both marketing and dashboard shells.
- **Density toggle / TweaksPopover** — `components/layout/tweaks-popover.tsx`.
  Mockups show a single density swap; we keep an explicit Comfortable/Compact
  radio group + theme toggle.
- **Related auctions rail on the saleroom** — `components/sections/saleroom/saleroom-related-auctions.tsx`.
  Mockup omits this rail; we keep it as a discovery aid.
- **Verified seller badge on the lot detail right summary** —
  `components/sections/artwork/redesign/lot-right-summary.tsx`. Mockup omits the
  badge; we keep it as a small chip styled to mockup typography.
- **Settlement timeline on the dashboard overview** —
  `components/dashboard/overview/secondary-action-stack.tsx`. Mockup shows only
  the stacked tile-grid watchlist preview; we keep the secondary action stack
  beneath it.
- **Notifications inbox board** — `components/dashboard/notifications-inbox-board.tsx`.
  Mockup shows the minimalist feed; we render the feed at `/dashboard/notifications`
  and keep the full inbox available at `?view=inbox`.
- **Full portfolio detail drawer** — `components/dashboard/portfolio-lot-grid.tsx`
  drawer. Mockup shows only the stacked card; we keep the drawer detail
  available behind the existing trigger.
- **Live saleroom card on admin operations** —
  `components/admin/admin-operations-home-view.tsx`. Mockup omits it; we keep it
  and let the surrounding grid emphasise the attention list when it's empty.
- **Multi-route settings sub-pages** — `apps/web/src/app/dashboard/settings/**`.
  Composite single-page settings is layered alongside the existing per-section
  routes.
- **Window KPI tile on admin analytics** — `components/admin/analytics/**`.
  Mockup omits it; we keep it as additional context.
- **Admin invitations form Card** — `apps/web/src/app/admin/(platform)/invitations/page.tsx`.
  Mockup is inline-only; we keep the existing Card layout.
- **Xero panel preserves OAuth fields** — `apps/web/src/app/admin/(finance)/integrations/xero/page.tsx`.
  Mockup shows Token expiry + Webhook URL only; we keep OAuth status,
  organisation, and expiresAt rows alongside the new optional fields.
- **Dashboard portfolio drawer + medium/dimensions metadata** — same component.
  Mockup omits both; we render them when present.
- **Admin lot image manager** —
  `components/admin/lot-image-manager.tsx`. Mockups show a simple upload affordance;
  admins now get reorder, primary-image selection, and per-image alt text while
  retaining the existing upload pipeline.
- **Workspace-aware mobile bottom nav** —
  `components/layout/client-bottom-nav.tsx`. Mobile dashboard routes get a fixed
  buying/selling-aware tab bar with safe-area padding and a More sheet for
  workspace, density, theme, and logout controls.
- **URL-first admin table operations** —
  `components/admin/bulk-actions-toolbar.tsx` and filter share/reset controls.
  Admin list pages keep filters in the URL, expose copy-link sharing, and show
  bulk action toolbars when rows are selected.

## Variants introduced by this pass

All variants are additive props with the mockup-aligned variant being the
explicit opt-in; previous behaviour stays the default unless wired otherwise.

| Component | Variant prop | Default | Mockup-aligned value | Notes |
|---|---|---|---|---|
| `SiteHeader` | `chromeVariant` (auto via `transparentPaths`) | solid | `transparentUntilScroll` | Marketing layout opts homepage in. |
| `WatchlistPreviewCard` | `variant` | `card-list` | `tile-grid` | Dashboard overview opts in. |
| `PortfolioLotGrid` | `variant` | `split` | `stacked` | `/dashboard/portfolio` opts in. |
| `LotMoreFromRail` | `density` | `rich` | `compact` | `ArtworkSplitView` opts in. |
| `SaleCalendarRow` | extra optional VM fields | — | category + results summary | Mapper populates when source data present. |
| `SaleHeroVM` | `liveLotsCount`, `estimatedTotalLabel` | — | mockup labels | Server passes `liveLotsCount` to mobile bar too. |
| `SaleroomLotCard` | `priceEmphasis` | `currentBid` | mockup status-driven | Both lines rendered to retain disclosure. |
| `LegalPage` | `kicker`, `dividerUnderDate` | string kicker | `kicker={null}` + divider | Backwards compatible. |
| `ContactForm` | `nameMode` | `single` | `split` | `firstName`/`lastName` resolves into the existing `name` API field via `resolveContactName`. |
| `AdminUsersBoard` | `globalUserTotals` | — | mockup-aligned KPI labels | Falls back to per-page labels when omitted. |

## Verification checklist

When reviewing the deployed test environment, walk each route and compare to
the mockup file in `LAX *.html` (workspace root):

1. Home — `LAX Home.html`
2. Sales index — `LAX Calendar.html`
3. Saleroom — `LAX Saleroom.html`
4. Lot detail — `LAX Lot.html`
5. Artist — `LAX Artist.html`
6. Dashboards — `LAX Dashboards.html`
7. Legal cluster — `LAX About / FAQ / Contact / Privacy / Shipping / Terms.html`

Open dev tools, ensure no console errors, and run Lighthouse for Performance,
Accessibility, Best Practices, and SEO. Targets: SEO = 100, Accessibility ≥ 95,
Performance ≥ 90, Best Practices ≥ 95.
