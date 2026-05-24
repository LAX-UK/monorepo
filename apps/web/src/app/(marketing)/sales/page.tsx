import { ViewItemListTracker } from "@/components/analytics/view-item-list-tracker";
import { CatalogViewSwitcher } from "@/components/marketing/catalog-view-switcher";
import { MarketingEmptyState } from "@/components/marketing/marketing-empty-state";
import { MarketingListToolbar } from "@/components/marketing/marketing-list-toolbar";
import { FeaturedAuctionsGrid } from "@/components/sections/sales/featured-auctions-grid";
import { SalesAuctionList } from "@/components/sections/sales/sales-auction-list";
import { SalesCalendarBrowse } from "@/components/sections/sales/sales-calendar-browse";
import { SalesCalendarGrid } from "@/components/sections/sales/sales-calendar-grid";
import { SalesCalendarPagination } from "@/components/sections/sales/sales-calendar-pagination";
import { SalesHeroHeader } from "@/components/sections/sales/sales-hero-header";
import { SalesNewLotsGrid } from "@/components/sections/sales/sales-new-lots-grid";
import { SalesPrimaryTabs } from "@/components/sections/sales/sales-primary-tabs";
import {
  mapSaleToAuctionRowVM,
  mapSaleToCalendarGridCardVM,
  mapSaleToFeaturedAuctionCardVM,
} from "@/components/sections/sales/sales-view-models";
import { firstString } from "@/lib/admin/admin-list-params";
import { getServerCategoryReader } from "@/lib/data/http/categories.server";
import { getServerLotReader } from "@/lib/data/http/lots.server";
import { type SaleListRow, getServerSalesList } from "@/lib/data/http/sales.server";
import { getServerSessionUser } from "@/lib/data/http/session.server";
import { applyCalendarRowFilters } from "@/lib/marketing/sales-calendar-filter-utils";
import {
  type CalendarPrimaryTab,
  type CalendarSalesUrlState,
  parseCalendarPage,
  parseCalendarPrimaryTab,
  parseDeliveryMode,
  parseLocationFilter,
  parseMonth,
  parsePriceRange,
  parseSort,
  parseYear,
} from "@/lib/marketing/sales-calendar-params";
import { parseSalesCategoryId } from "@/lib/marketing/sales-filters";
import { resolveMarketingLayoutView } from "@/lib/preferences/resolve-marketing-layout-view.server";
import { metadataForStatic } from "@/lib/seo/metadata-factory";
import { breadcrumbJsonLd, itemListJsonLd, jsonLdScript } from "@/lib/seo/structured-data";
import { lotPath, salePath } from "@/lib/seo/url";
import { getSiteUrl } from "@/lib/site-url";
import type { Lot } from "@auction/types";
import { Button, SectionCta } from "@auction/ui";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

const CALENDAR_PAGE_SIZE = 24;

export const metadata: Metadata = metadataForStatic({
  title: "Calendar",
  description:
    "Explore upcoming auctions and browse past results from London, featuring the best of Modern & Contemporary Art, Design, and luxury.",
  path: "/sales",
});

function collectYears(rows: SaleListRow[]): number[] {
  const ys = new Set<number>();
  for (const { sale } of rows) {
    ys.add(new Date(sale.startTime).getFullYear());
  }
  const list = [...ys].sort((a, b) => b - a);
  if (list.length === 0) list.push(new Date().getFullYear());
  return list;
}

async function loadSaleRowsForTab(
  tab: CalendarPrimaryTab,
  categoryId: string | undefined,
  sort: "startAsc" | "createdDesc",
  page: number,
): Promise<{ rows: SaleListRow[]; hasMore: boolean }> {
  const cat = categoryId ? { categoryId } : {};
  const sortParam = sort;
  const offset = (page - 1) * CALENDAR_PAGE_SIZE;
  const limit = CALENDAR_PAGE_SIZE + 1;
  try {
    let rows: SaleListRow[] = [];
    switch (tab) {
      case "upcoming":
        rows = await getServerSalesList({
          status: "scheduled",
          limit,
          offset,
          sort: sortParam,
          ...cat,
        });
        break;
      case "live":
        rows = await getServerSalesList({
          status: "active",
          limit,
          offset,
          sort: sortParam,
          ...cat,
        });
        break;
      case "results":
        rows = await getServerSalesList({
          status: "ended",
          limit,
          offset,
          sort: sortParam,
          ...cat,
        });
        break;
      default:
        return { rows: [], hasMore: false };
    }
    const hasMore = rows.length > CALENDAR_PAGE_SIZE;
    return { rows: rows.slice(0, CALENDAR_PAGE_SIZE), hasMore };
  } catch {
    return { rows: [], hasMore: false };
  }
}

export default async function SalesListPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  if (firstString(sp.tab)?.toLowerCase() === "artists") {
    redirect("/artists");
  }
  const session = await getServerSessionUser();

  const salesLayoutResolved = await resolveMarketingLayoutView({
    routeKey: "sales",
    category: "sales",
    urlView: firstString(sp.view),
    user: session,
    fallback: "list",
  });
  const calendarView: "grid" | "list" = salesLayoutResolved === "list" ? "list" : "grid";

  const categories = await getServerCategoryReader()
    .then((r) => r.list())
    .catch(() => []);
  const categoryId = parseSalesCategoryId(sp, categories);

  const tab = parseCalendarPrimaryTab(sp);
  const calendarPage = parseCalendarPage(sp);
  const deliveryMode = parseDeliveryMode(sp);
  const location = parseLocationFilter(sp);
  const sort = parseSort(sp);
  const month = parseMonth(sp);
  const year = parseYear(sp);
  const { minPrice, maxPrice } = parsePriceRange(sp);

  const calendarState: CalendarSalesUrlState = {
    tab,
    deliveryMode,
    location,
    sort,
    view: calendarView,
    ...(categoryId ? { categoryId } : {}),
    ...(month != null ? { month } : {}),
    ...(year != null ? { year } : {}),
    ...(minPrice != null ? { minPrice } : {}),
    ...(maxPrice != null ? { maxPrice } : {}),
    ...(calendarPage > 1 ? { page: calendarPage } : {}),
  };

  let saleRows: SaleListRow[] = [];
  let calendarHasMore = false;
  let newLots: Lot[] = [];
  let err: string | null = null;

  try {
    if (tab === "newLots") {
      const reader = await getServerLotReader();
      newLots = await reader.list({ limit: 36, sort: "createdDesc" });
    } else if (tab === "privateSales") {
      saleRows = [];
    } else {
      const loaded = await loadSaleRowsForTab(tab, categoryId, sort, calendarPage);
      saleRows = loaded.rows;
      calendarHasMore = loaded.hasMore;
    }
  } catch (e) {
    err = e instanceof Error ? e.message : "Could not load data.";
  }

  let featuredRows: SaleListRow[] = [];
  try {
    featuredRows = await getServerSalesList({
      statuses: ["active", "scheduled"],
      limit: 3,
      sort: "startAsc",
    });
  } catch {
    featuredRows = [];
  }

  const filteredSales = applyCalendarRowFilters(saleRows, {
    ...(deliveryMode !== "all" ? { deliveryMode } : {}),
    ...(location !== "all" ? { location } : {}),
    ...(month != null ? { month } : {}),
    ...(year != null ? { year } : {}),
    ...(minPrice != null ? { minPrice } : {}),
    ...(maxPrice != null ? { maxPrice } : {}),
  });

  const base = getSiteUrl();
  const crumbLd = breadcrumbJsonLd([
    { name: "Home", path: "/" },
    { name: "Calendar", path: "/sales" },
  ]);
  const crumbText = jsonLdScript(crumbLd);

  const listLdSource =
    tab === "newLots"
      ? newLots.map((l) => ({ name: l.title, url: `${base}${lotPath(l)}` }))
      : filteredSales.map((r) => ({
          name: r.sale.title,
          url: `${base}${salePath(r.sale)}`,
        }));
  const listLd = !err && listLdSource.length > 0 ? itemListJsonLd(listLdSource) : null;
  const listLdText = listLd ? jsonLdScript(listLd) : null;

  const featuredVms = featuredRows.map(({ sale, lots }) =>
    mapSaleToFeaturedAuctionCardVM(sale, lots),
  );

  const yearOptions = collectYears(saleRows.length > 0 ? saleRows : featuredRows);

  const showSalesBrowse = tab === "upcoming" || tab === "live" || tab === "results";
  const rowVms = filteredSales.map(({ sale, lots }) =>
    mapSaleToAuctionRowVM(sale, lots, {
      showRegisterButton: !session && (sale.status === "scheduled" || sale.status === "active"),
    }),
  );
  const gridVms = filteredSales.map(({ sale, lots }) =>
    mapSaleToCalendarGridCardVM(sale, lots, {
      showRegisterButton: !session && (sale.status === "scheduled" || sale.status === "active"),
    }),
  );

  return (
    <main
      id="main-content"
      className="bg-page-bg pb-[var(--page-bottom-padding)] pt-[var(--header-height)] dark:bg-background"
    >
      <script type="application/ld+json" suppressHydrationWarning>
        {crumbText}
      </script>
      {listLdText ? (
        <script type="application/ld+json" suppressHydrationWarning>
          {listLdText}
        </script>
      ) : null}

      <div className="mx-auto w-full max-w-[var(--container-max,1440px)] px-4 sm:px-6 md:px-8 lg:px-8">
        <section className="pt-12 pb-8 sm:pt-16 sm:pb-10 lg:pt-20 lg:pb-10">
          <div className="flex flex-col gap-10 sm:gap-12 lg:gap-12">
            <div className="flex flex-col gap-10 sm:gap-12 lg:gap-12">
              <SalesHeroHeader />
              <FeaturedAuctionsGrid vms={featuredVms} />
            </div>

            <div className="flex flex-col gap-6 sm:gap-8 lg:gap-10">
              <SalesPrimaryTabs state={calendarState} />

              {err ? (
                <p className="text-sm text-error" role="alert">
                  {err}
                </p>
              ) : null}

              {tab === "privateSales" ? (
                <MarketingEmptyState
                  variant="marketing"
                  title="Private sales"
                  description="Acquire exceptional works outside the auction calendar. Contact us or browse highlights on the homepage."
                  action={
                    <Button variant="cta" asChild>
                      <Link href="/#private-sale-heading">View highlights</Link>
                    </Button>
                  }
                />
              ) : null}

              {tab === "newLots" ? (
                <div className="flex flex-col gap-6">
                  {!session ? (
                    <SectionCta
                      className="rounded-xl border border-outline-variant/30 bg-surface-container-lowest p-8 dark:border-outline-variant/30 dark:bg-surface-container-low/40"
                      title="Ready to bid?"
                      description="Create a free account to place bids, track lots, and receive saleroom updates."
                      primary={
                        <Button variant="cta" asChild>
                          <Link href="/register">Register to bid</Link>
                        </Button>
                      }
                      secondary={
                        <Button variant="outline" asChild>
                          <Link href="/login">Sign in</Link>
                        </Button>
                      }
                    />
                  ) : null}
                  <ViewItemListTracker
                    listId="sales_hub"
                    listName="New lots"
                    itemIds={newLots.map((l) => l.id)}
                  />
                  <SalesNewLotsGrid lots={newLots} />
                </div>
              ) : null}

              {showSalesBrowse ? (
                <SalesCalendarBrowse
                  state={calendarState}
                  resultCount={filteredSales.length}
                  categories={categories}
                  years={yearOptions}
                >
                  <MarketingListToolbar
                    className="mb-4 rounded-lg border border-border-hairline bg-white/80 dark:bg-surface-container-low/40"
                    countLabel={`${filteredSales.length} sale${filteredSales.length === 1 ? "" : "s"}`}
                    trailing={
                      <CatalogViewSwitcher
                        routeKey="sales"
                        value={calendarView === "list" ? "list" : "grid"}
                        supportedModes={["grid", "list"]}
                      />
                    }
                  />
                  {!session ? (
                    <SectionCta
                      className="mb-6 rounded-xl border border-outline-variant/30 bg-surface-container-lowest p-8 dark:border-outline-variant/30 dark:bg-surface-container-low/40"
                      title="Ready to bid?"
                      description="Create a free account to place bids, track lots, and receive saleroom updates."
                      primary={
                        <Button variant="cta" asChild>
                          <Link href="/register">Register to bid</Link>
                        </Button>
                      }
                      secondary={
                        <Button variant="outline" asChild>
                          <Link href="/login">Sign in</Link>
                        </Button>
                      }
                    />
                  ) : null}

                  {filteredSales.length === 0 && !err ? (
                    <MarketingEmptyState
                      variant="marketing"
                      title="No sales match this filter"
                      description="Try another tab or adjust filters in the sidebar."
                    />
                  ) : calendarView === "grid" ? (
                    <SalesCalendarGrid vms={gridVms} />
                  ) : (
                    <SalesAuctionList rows={rowVms} className="gap-2 sm:gap-2 lg:gap-3" />
                  )}
                  <SalesCalendarPagination
                    state={calendarState}
                    page={calendarPage}
                    hasMore={calendarHasMore}
                  />
                </SalesCalendarBrowse>
              ) : null}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
