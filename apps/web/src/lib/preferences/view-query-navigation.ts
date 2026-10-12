import type { CatalogLayoutView } from "@/lib/preferences/view-cookie";

export {
  type BuildViewQueryParamsOptions,
  VIEW_CHANGE_CLEAR_PARAMS,
  buildViewHref,
  buildViewQueryParams,
  writeViewPreferenceCookie,
} from "@auction/marketing-ui";

/**
 * Marketing layout view navigation contract (performance + SEO + SOLID):
 *
 * - **URL is source of truth** — server components read `?view=` via `resolveMarketingLayoutView`
 * - **Client switchers** call `useViewQueryNavigation` → `history.replaceState` (no RSC refetch)
 * - **Canonical URLs** — omit `view` when it matches `defaultView` (usually `grid`)
 * - **Cookies** — per-route persistence via `routeKey` (see usages below)
 * - **Content renderer** — must call `useUrlLayoutView` (Pattern A or B below) or toggling
 *   view updates the switcher only, not the catalogue layout
 * - **Home page** — resolve `searchParams` outside the data-fetch `Suspense` boundary
 *
 * | Surface            | Switcher              | routeKey        | URL default | Content renderer (live view)        |
 * |--------------------|-----------------------|-----------------|-------------|-------------------------------------|
 * | Home urgency       | CatalogViewSwitcher   | home-urgency    | grid        | LaxUrgencySectionBody (Pattern B)   |
 * | Home upcoming      | CatalogViewSwitcher   | home-upcoming   | grid        | UpcomingAuctionsMarketingClient (B) |
 * | Search             | CatalogViewSwitcher   | search          | grid        | CatalogLotViewClient (Pattern A)    |
 * | Archive            | CatalogViewSwitcher   | archive         | grid        | CatalogArchiveViewClient (Pattern A)|
 * | Artists            | CatalogViewSwitcher   | artists         | grid        | CatalogArtistViewClient (Pattern A) |
 * | Saleroom catalogue | CatalogViewSwitcher   | sales-lot       | grid        | SaleroomCatalogLotsLive (Pattern B) |
 * | Sales calendar     | SalesViewSwitcher     | sales           | grid        | SalesBrowseResults (Pattern B)      |
 *
 * **Pattern A** — `*ViewClient` wrapper when the presenter is a server component:
 * `const view = useUrlLayoutView(defaultView, initialView); return <CatalogXView view={view} ... />`
 *
 * **Pattern B** — inline hook when the presenter is already `"use client"`:
 * `const view = useUrlLayoutView("grid", initialView);`
 */

/** Sales calendar stores `grid` in the sales cookie when calendar mode is active. */
export function salesBrowseViewCookieValue(view: string): CatalogLayoutView {
  return view === "calendar" ? "grid" : (view as CatalogLayoutView);
}
