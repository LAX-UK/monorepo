import { ViewItemListTracker } from "@/components/analytics/view-item-list-tracker";
import { MarketingEmptyState } from "@/components/marketing/marketing-empty-state";
import { FeaturedAuctionsGrid } from "@/components/sections/sales/featured-auctions-grid";
import { SalesAuctionList } from "@/components/sections/sales/sales-auction-list";
import { SalesCalendarBrowse } from "@/components/sections/sales/sales-calendar-browse";
import { SalesCalendarGrid } from "@/components/sections/sales/sales-calendar-grid";
import { SalesCalendarMonthGrid } from "@/components/sections/sales/sales-calendar-month-grid";
import { SalesCalendarPagination } from "@/components/sections/sales/sales-calendar-pagination";
import { SalesHeroHeader } from "@/components/sections/sales/sales-hero-header";
import { SalesNewLotsGrid } from "@/components/sections/sales/sales-new-lots-grid";
import { SalesNewLotsToolbar } from "@/components/sections/sales/sales-new-lots-toolbar";
import { SalesPrimaryTabs } from "@/components/sections/sales/sales-primary-tabs";
import {
  mapSaleToAgendaItemVM,
  mapSaleToAuctionRowVM,
  mapSaleToCalendarGridCardVM,
  mapSaleToFeaturedAuctionCardVM,
} from "@/components/sections/sales/sales-view-models";
import type { SalesBrowseView } from "@/components/sections/sales/sales-view-switcher";
import { firstString } from "@/lib/admin/admin-list-params";
import { getServerCategoryReader } from "@/lib/data/http/categories.server";
import { getServerLotReader } from "@/lib/data/http/lots.server";
import { type SaleListRow, getServerSalesList } from "@/lib/data/http/sales.server";
import { getServerSessionUser } from "@/lib/data/http/session.server";
import { catalogViewCarryParams } from "@/lib/marketing/catalog-links";
import { MARKETING_CATALOG_PT, MARKETING_PAGE_SHELL } from "@/lib/marketing/chrome";
import { deriveHasMorePage } from "@/lib/marketing/pagination";
import { applyCalendarRowFilters } from "@/lib/marketing/sales-calendar-filter-utils";
import { fetchHasLiveSales } from "@/lib/marketing/sales-calendar-live.server";
import {
  type CalendarPrimaryTab,
  type CalendarSalesUrlState,
  calendarClearFiltersHref,
  calendarSalesHref,
  countActiveCalendarFilters,
  hasExplicitCalendarTab,
  parseCalendarPage,
  parseCalendarPrimaryTab,
  parseDeliveryMode,
  parseLocationFilter,
  parseMonth,
  parsePriceRange,
  parseSort,
  parseYear,
  resolveDefaultCalendarPrimaryTab,
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

  const rawView = firstString(sp.view);
  const isCalendarLayout = rawView === "calendar";
  const salesLayoutResolved = await resolveMarketingLayoutView({
    routeKey: "sales",
    category: "sales",
    urlView: isCalendarLayout ? undefined : rawView,
    user: session,
    fallback: "list",
  });
  const calendarView: SalesBrowseView = isCalendarLayout
    ? "calendar"
    : salesLayoutResolved === "list"
      ? "list"
      : "grid";

  const [categories, hasLiveSales] = await Promise.all([
    getServerCategoryReader()
      .then((r) => r.list())
      .catch(() => []),
    fetchHasLiveSales(),
  ]);
  const categoryId = parseSalesCategoryId(sp, categories);
  const deliveryMode = parseDeliveryMode(sp);
  const location = parseLocationFilter(sp);
  const sort = parseSort(sp);
  const month = parseMonth(sp);
  const year = parseYear(sp);
  const { minPrice, maxPrice } = parsePriceRange(sp);
  const calendarPage = parseCalendarPage(sp);

  if (!hasExplicitCalendarTab(sp) && resolveDefaultCalendarPrimaryTab(hasLiveSales) === "live") {
    redirect(
      calendarSalesHref({
        tab: "live",
        ...(categoryId ? { categoryId } : {}),
        ...(deliveryMode !== "all" ? { deliveryMode } : {}),
        ...(location !== "all" ? { location } : {}),
        ...(sort !== "startAsc" ? { sort } : {}),
        ...(month != null ? { month } : {}),
        ...(year != null ? { year } : {}),
        ...(minPrice != null ? { minPrice } : {}),
        ...(maxPrice != null ? { maxPrice } : {}),
        ...(calendarView !== "grid" ? { view: calendarView } : {}),
        ...(calendarPage > 1 ? { page: calendarPage } : {}),
      }),
    );
  }

  const tab = parseCalendarPrimaryTab(sp);

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
  const newLotsCatalogLinkParams = catalogViewCarryParams(calendarView);

  let saleRows: SaleListRow[] = [];
  let calendarHasMore = false;
  let newLots: Lot[] = [];
  let newLotsHasMore = false;
  let err: string | null = null;

  try {
    if (tab === "newLots") {
      const reader = await getServerLotReader();
      const rows = await reader.list({
        limit: CALENDAR_PAGE_SIZE + 1,
        offset: (calendarPage - 1) * CALENDAR_PAGE_SIZE,
        sort: "createdDesc",
        status: "scheduled",
      });
      const page = deriveHasMorePage(rows, CALENDAR_PAGE_SIZE);
      newLots = page.items;
      newLotsHasMore = page.hasMore;
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
  const agendaVms = filteredSales.map(({ sale, lots }) => mapSaleToAgendaItemVM(sale, lots));

  const hasActiveCalendarFilters = countActiveCalendarFilters(calendarState) > 0;

  return (
    <main
      id="main-content"
      className={`bg-page-bg pb-[var(--page-bottom-padding)] dark:bg-background ${MARKETING_CATALOG_PT}`}
    >
      <script type="application/ld+json" suppressHydrationWarning>
        {crumbText}
      </script>
      {listLdText ? (
        <script type="application/ld+json" suppressHydrationWarning>
          {listLdText}
        </script>
      ) : null}

      <div className={MARKETING_PAGE_SHELL}>
        <section className="pt-12 pb-8 sm:pt-16 sm:pb-10 lg:pt-20 lg:pb-10">
          <div className="flex flex-col gap-10 sm:gap-12 lg:gap-12">
            <div className="flex flex-col gap-10 sm:gap-12 lg:gap-12">
              <SalesHeroHeader />
              <div className="hidden md:block">
                <FeaturedAuctionsGrid vms={featuredVms} />
              </div>
            </div>

            <div className="flex flex-col gap-6 sm:gap-8 lg:gap-10">
              <SalesPrimaryTabs state={calendarState} hasLiveSales={hasLiveSales} />

              {err ? (
                <MarketingEmptyState
                  variant="marketing"
                  context="error"
                  title="Calendar temporarily unavailable"
                  description={err}
                  action={
                    <>
                      <Button variant="cta" asChild>
                        <Link href="/sales">Try again</Link>
                      </Button>
                      <Button variant="outline" asChild>
                        <Link href="/">Back to home</Link>
                      </Button>
                    </>
                  }
                />
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
                  <SalesNewLotsToolbar resultCount={newLots.length} />
                  <ViewItemListTracker
                    listId="sales_hub"
                    listName="New lots"
                    itemIds={newLots.map((l) => l.id)}
                  />
                  <SalesNewLotsGrid
                    lots={newLots}
                    {...(newLotsCatalogLinkParams
                      ? { catalogLinkParams: newLotsCatalogLinkParams }
                      : {})}
                  />
                  <SalesCalendarPagination
                    state={calendarState}
                    page={calendarPage}
                    hasMore={newLotsHasMore}
                  />
                </div>
              ) : null}

              {showSalesBrowse ? (
                <SalesCalendarBrowse
                  state={calendarState}
                  resultCount={filteredSales.length}
                  categories={categories}
                  years={yearOptions}
                  calendarView={calendarView}
                >
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
                      context={hasActiveCalendarFilters ? "filtered" : "noResults"}
                      title="No sales match this filter"
                      description={
                        hasActiveCalendarFilters
                          ? "Try clearing filters or choose another calendar tab."
                          : "Try another tab or check back when new sales are scheduled."
                      }
                      action={
                        hasActiveCalendarFilters ? (
                          <>
                            <Button variant="cta" asChild>
                              <Link href={calendarClearFiltersHref(calendarState)}>
                                Clear filters
                              </Link>
                            </Button>
                            <Button variant="outline" asChild>
                              <Link href="/sales">Browse all sales</Link>
                            </Button>
                          </>
                        ) : undefined
                      }
                    />
                  ) : calendarView === "calendar" ? (
                    <SalesCalendarMonthGrid items={agendaVms} />
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
