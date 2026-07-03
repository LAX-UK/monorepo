import { ViewItemListTracker } from "@/components/analytics/view-item-list-tracker";
import { MarketingBidPromoCta } from "@/components/marketing/marketing-bid-promo-cta";
import { MarketingCatalogHubShell } from "@/components/marketing/marketing-catalog-hub-shell";
import { MarketingEmptyState } from "@/components/marketing/marketing-empty-state";
import { FeaturedAuctionsGrid } from "@/components/sections/sales/featured-auctions-grid";
import { SalesBrowseResults } from "@/components/sections/sales/sales-browse-results";
import { SalesCalendarBrowse } from "@/components/sections/sales/sales-calendar-browse";
import { SalesCalendarPagination } from "@/components/sections/sales/sales-calendar-pagination";
import { SalesHeroHeader } from "@/components/sections/sales/sales-hero-header";
import { SalesNewLotsGrid } from "@/components/sections/sales/sales-new-lots-grid";
import { SalesNewLotsToolbar } from "@/components/sections/sales/sales-new-lots-toolbar";
import { SalesPrimaryTabs } from "@/components/sections/sales/sales-primary-tabs";
import { MARKETING_PAGE_SHELL } from "@/lib/marketing/chrome";
import type { SalesBrowsePageData } from "@/lib/marketing/load-sales-browse-page";
import { calendarClearFiltersHref } from "@/lib/marketing/sales-calendar-params";
import { Button, cn } from "@auction/ui";
import Link from "next/link";

type SalesBrowseViewProps = SalesBrowsePageData;

export function SalesBrowseView({ vm, crumbText, listLdText }: SalesBrowseViewProps) {
  const session = vm.session;

  return (
    <MarketingCatalogHubShell
      jsonLd={
        <>
          <script type="application/ld+json" suppressHydrationWarning>
            {crumbText}
          </script>
          {listLdText ? (
            <script type="application/ld+json" suppressHydrationWarning>
              {listLdText}
            </script>
          ) : null}
        </>
      }
      hero={
        <section
          className={cn(MARKETING_PAGE_SHELL, "pt-12 pb-8 sm:pt-16 sm:pb-10 lg:pt-20 lg:pb-0")}
        >
          <div className="flex flex-col gap-10 sm:gap-12 lg:gap-12">
            <SalesHeroHeader />
            <div className="hidden md:block">
              <FeaturedAuctionsGrid vms={vm.featuredVms} />
            </div>
          </div>
        </section>
      }
    >
      <div className="flex flex-col gap-6 pb-8 sm:gap-8 sm:pb-10 lg:gap-10 lg:pb-10">
        <SalesPrimaryTabs state={vm.calendarState} hasLiveSales={vm.hasLiveSales} />

        {vm.err ? (
          <MarketingEmptyState
            variant="marketing"
            context="error"
            title="Calendar temporarily unavailable"
            description={vm.err}
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

        {vm.tab === "privateSales" ? (
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

        {vm.tab === "newLots" ? (
          <div className="flex flex-col gap-6">
            {!session ? (
              <MarketingBidPromoCta className="rounded-xl border border-outline-variant/30 bg-surface-container-lowest p-8 dark:border-outline-variant/30 dark:bg-surface-container-low/40" />
            ) : null}
            <SalesNewLotsToolbar resultCount={vm.newLots.length} />
            <ViewItemListTracker
              listId="sales_hub"
              listName="New lots"
              itemIds={vm.newLots.map((l) => l.id)}
            />
            <SalesNewLotsGrid
              lots={vm.newLotVMs}
              {...(vm.newLotsCatalogLinkParams
                ? { catalogLinkParams: vm.newLotsCatalogLinkParams }
                : {})}
            />
            <SalesCalendarPagination
              state={vm.calendarState}
              page={vm.calendarPage}
              hasMore={vm.newLotsHasMore}
            />
          </div>
        ) : null}

        {vm.showSalesBrowse ? (
          <SalesCalendarBrowse
            state={vm.calendarState}
            resultCount={vm.filteredSalesCount}
            categories={vm.categories}
            years={vm.yearOptions}
            calendarView={vm.calendarView}
          >
            {!session ? (
              <MarketingBidPromoCta className="mb-6 rounded-xl border border-outline-variant/30 bg-surface-container-lowest p-8 dark:border-outline-variant/30 dark:bg-surface-container-low/40" />
            ) : null}

            {vm.filteredSalesCount === 0 && !vm.err ? (
              <MarketingEmptyState
                variant="marketing"
                context={vm.hasActiveCalendarFilters ? "filtered" : "noResults"}
                title="No sales match this filter"
                description={
                  vm.hasActiveCalendarFilters
                    ? "Try clearing filters or choose another calendar tab."
                    : "Try another tab or check back when new sales are scheduled."
                }
                action={
                  vm.hasActiveCalendarFilters ? (
                    <>
                      <Button variant="cta" asChild>
                        <Link href={calendarClearFiltersHref(vm.calendarState)}>Clear filters</Link>
                      </Button>
                      <Button variant="outline" asChild>
                        <Link href="/sales">Browse all sales</Link>
                      </Button>
                    </>
                  ) : undefined
                }
              />
            ) : (
              <SalesBrowseResults
                initialView={vm.calendarView}
                defaultView="grid"
                agendaVms={vm.agendaVms}
                gridVms={vm.gridVms}
                rowVms={vm.rowVms}
              />
            )}
            <SalesCalendarPagination
              state={vm.calendarState}
              page={vm.calendarPage}
              hasMore={vm.calendarHasMore}
            />
          </SalesCalendarBrowse>
        ) : null}
      </div>
    </MarketingCatalogHubShell>
  );
}
