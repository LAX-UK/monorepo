import { MarketingBidPromoCta } from "@/components/marketing/marketing-bid-promo-cta";
import { MarketingCatalogHubShell } from "@/components/marketing/marketing-catalog-hub-shell";
import { MarketingEmptyState } from "@/components/marketing/marketing-empty-state";
import { FeaturedAuctionsGrid } from "@/components/sections/sales/featured-auctions-grid";
import { SalesBrowseResults } from "@/components/sections/sales/sales-browse-results";
import { SalesCalendarBrowse } from "@/components/sections/sales/sales-calendar-browse";
import { SalesCalendarEmpty } from "@/components/sections/sales/sales-calendar-empty";
import { SalesCalendarPagination } from "@/components/sections/sales/sales-calendar-pagination";
import { SalesHeroHeader } from "@/components/sections/sales/sales-hero-header";
import { SalesPrimaryTabs } from "@/components/sections/sales/sales-primary-tabs";
import { MARKETING_PAGE_SHELL } from "@/lib/marketing/chrome";
import type { SalesBrowsePageData } from "@/lib/marketing/load-sales-browse-page";
import { calendarSalesHref } from "@/lib/marketing/sales-calendar-params";
import { MarketingSectionReveal } from "@auction/marketing-ui";
import { cn } from "@auction/ui";
import { ButtonLink } from "@auction/ui/lax";
import Link from "next/link";

type SalesBrowseViewProps = SalesBrowsePageData;

export function SalesBrowseView({ vm, crumbText, listLdText }: SalesBrowseViewProps) {
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
        <section className={cn(MARKETING_PAGE_SHELL, "pt-4 pb-8 sm:pt-6 sm:pb-10 lg:pt-8 lg:pb-0")}>
          <div className="flex flex-col gap-10 sm:gap-12 lg:gap-12">
            <SalesHeroHeader />
            {vm.featuredVms.length > 0 ? (
              <div className="hidden md:block">
                <FeaturedAuctionsGrid vms={vm.featuredVms} />
              </div>
            ) : null}
          </div>
        </section>
      }
    >
      <MarketingSectionReveal
        index={0}
        className="flex flex-col gap-6 pb-8 sm:gap-8 sm:pb-10 lg:gap-10 lg:pb-10"
      >
        <SalesPrimaryTabs state={vm.calendarState} tabs={vm.tabs} />

        {vm.listState === "error" ? (
          <MarketingEmptyState
            variant="marketing"
            context="error"
            title="Calendar temporarily unavailable"
            description="We couldn't load the calendar. Try again in a moment."
            action={
              <>
                <ButtonLink
                  Link={Link}
                  variant="primary"
                  href={calendarSalesHref(vm.calendarState)}
                >
                  Try again
                </ButtonLink>
                <ButtonLink Link={Link} variant="secondary" href="/">
                  Back to home
                </ButtonLink>
              </>
            }
          />
        ) : null}

        {vm.listState === "empty" ? <SalesCalendarEmpty vm={vm} /> : null}

        {vm.showBrowseControls ? (
          <SalesCalendarBrowse
            state={vm.calendarState}
            resultCount={vm.filteredSalesCount}
            categories={vm.categories}
            years={vm.yearOptions}
            facets={vm.facets}
            calendarView={vm.calendarView}
          >
            {vm.listState === "filteredEmpty" ? (
              <SalesCalendarEmpty vm={vm} />
            ) : (
              <div className="flex flex-col">
                {/* The list is the page's job: on phones the invitation follows it. */}
                {!vm.session ? (
                  <MarketingBidPromoCta className="order-2 mt-8 rounded-xl border border-outline-variant/30 bg-surface-container-lowest p-8 md:order-none md:mt-0 md:mb-6 dark:border-outline-variant/30 dark:bg-surface-container-low/40" />
                ) : null}
                <SalesBrowseResults
                  initialView={vm.calendarView}
                  defaultView="grid"
                  agendaVms={vm.agendaVms}
                  gridVms={vm.gridVms}
                  rowVms={vm.rowVms}
                />
              </div>
            )}
            <SalesCalendarPagination
              state={vm.calendarState}
              page={vm.calendarPage}
              hasMore={vm.calendarHasMore}
            />
          </SalesCalendarBrowse>
        ) : null}
      </MarketingSectionReveal>
    </MarketingCatalogHubShell>
  );
}
