import { ViewItemListTracker } from "@/components/analytics/view-item-list-tracker";
import { AtgExternalBiddingPanel } from "@/components/marketing/atg-external-bidding";
import { MarketingDetailShell } from "@/components/marketing/marketing-detail-shell";
import { MarketingDetailWayfinding } from "@/components/marketing/marketing-detail-wayfinding";
import { MarketingPaginationControls } from "@/components/marketing/marketing-pagination-controls";
import { SaleViewerProvider } from "@/components/sections/saleroom/sale-viewer-provider";
import { SaleroomCatalogLiveShell } from "@/components/sections/saleroom/saleroom-catalog-live-shell";
import { SaleroomCatalogToolbarRow } from "@/components/sections/saleroom/saleroom-catalog-toolbar-row";
import { SaleroomDayGallery } from "@/components/sections/saleroom/saleroom-day-gallery";
import { SaleroomHangSection } from "@/components/sections/saleroom/saleroom-hang-section";
import { SaleroomHero } from "@/components/sections/saleroom/saleroom-hero";
import { SaleroomHeroToolbar } from "@/components/sections/saleroom/saleroom-hero-toolbar";
import { SaleroomOverviewPanel } from "@/components/sections/saleroom/saleroom-overview-panel";
import { SaleroomPressCoverage } from "@/components/sections/saleroom/saleroom-press-coverage";
import { SaleroomRelatedAuctionsSection } from "@/components/sections/saleroom/saleroom-related-auctions-section";
import { SaleroomResultsBand } from "@/components/sections/saleroom/saleroom-results-band";
import {
  SaleAnchorTabsIsland,
  SaleLayoutPreference,
  SaleMobileSummaryBarIsland,
  SaleTelephoneBiddingIsland,
  SaleroomCatalogLotsLiveIsland,
  SaleroomCataloguePreparingIsland,
  SaleroomHeroActionRowIsland,
} from "@/components/sections/saleroom/saleroom-viewer-islands";
import { MARKETING_PAGE_SHELL, SALE_SECTION_SCROLL_MT } from "@/lib/marketing/chrome";
import type { SaleroomDetailPageData } from "@/lib/marketing/load-saleroom-detail-page";
import { SALE_CATALOG_LOAD_ALL_CAP } from "@/lib/marketing/saleroom-page-data.service";
import { cn } from "@auction/ui/lib/utils";

type SaleroomDetailViewProps = SaleroomDetailPageData;

/**
 * The sale page, the same for everyone (CO-7): rendered signed out from session-free reads so it
 * can be cached. `SaleViewerProvider` asks `/api/sales/:id/me` who is looking, and the islands
 * fill in following, watching, registering and telephone bidding.
 */
export function SaleroomDetailView({ vm, jsonLdText, explainerContext }: SaleroomDetailViewProps) {
  return (
    <SaleViewerProvider saleId={vm.sale.id}>
      <SaleLayoutPreference routeKey="sales-lot" />
      <SaleroomCatalogLiveShell
        saleId={vm.isSaleroomSale ? vm.sale.id : null}
        initial={vm.initialSaleroomStatus}
      >
        <MarketingDetailShell
          wrapChildren={false}
          jsonLd={
            <script type="application/ld+json" suppressHydrationWarning>
              {jsonLdText}
            </script>
          }
          leadingChrome={
            <SaleMobileSummaryBarIsland
              start={vm.sale.startTime}
              end={vm.sale.endTime}
              status={vm.displayStatus}
              saleTitle={vm.sale.title}
              deliveryMode={vm.sale.deliveryMode}
              directionsUrl={vm.directionsUrl}
              streamUrl={vm.sale.streamUrl}
              sale={vm.sale}
              locationLine={vm.locationLine}
              atgReadOnly={vm.atgReadOnly}
              {...(vm.liveLotsCount > 0 ? { liveLotsCount: vm.liveLotsCount } : {})}
              {...(vm.isSaleroomSale ? { saleroomLotRefs: vm.saleroomLotRefs } : {})}
            />
          }
          wayfinding={
            <MarketingDetailWayfinding
              backHref={vm.calendarBackHref}
              backLabel="Back to calendar"
              breadcrumbItems={vm.breadcrumbItems}
              className="pb-2"
            />
          }
          wayfindingClassName="hidden md:block"
          hero={
            <SaleroomHero
              hero={vm.heroVM}
              backHref={vm.calendarBackHref}
              deliveryMode={vm.sale.deliveryMode}
              catalogLotRefs={vm.catalogLotRefs}
              saleroomSession={vm.isSaleroomSale ? vm.initialSaleroomStatus : null}
              coverBlurDataURL={vm.coverBlurDataURL}
              showOnlineBiddingGatedBadge={vm.showOnlineBiddingGatedBadge}
              explainerContext={explainerContext}
              toolbar={
                vm.atgReadOnly ? (
                  <SaleroomHeroToolbar shareUrl={vm.shareUrl} shareTitle={vm.sale.title} />
                ) : null
              }
              actions={
                vm.atgReadOnly ? (
                  <AtgExternalBiddingPanel sale={vm.sale} />
                ) : (
                  <SaleroomHeroActionRowIsland
                    hero={vm.heroVM}
                    deliveryMode={vm.sale.deliveryMode}
                    saleId={vm.sale.id}
                    saleHref={vm.basePath}
                    registerToBidSale={vm.registerToBidSale}
                    saleCurrency="GBP"
                    utility={
                      <SaleroomHeroToolbar shareUrl={vm.shareUrl} shareTitle={vm.sale.title} />
                    }
                  />
                )
              }
            />
          }
        >
          {vm.resultsBand ? <SaleroomResultsBand band={vm.resultsBand} /> : null}

          {/* The room first, then the lots: the hang opens the catalogue under the header. */}
          {vm.hang ? <SaleroomHangSection hang={vm.hang} /> : null}

          <SaleAnchorTabsIsland
            telephoneSale={vm.telephoneSale}
            showGallery={vm.showDayGallery}
            showPress={vm.showPressSection}
          />

          <section
            id="catalog"
            className={cn(
              MARKETING_PAGE_SHELL,
              SALE_SECTION_SCROLL_MT,
              "pb-0 pt-[var(--section-spacing-tight)]",
            )}
          >
            <ViewItemListTracker
              listId={`sale:${vm.sale.id}`}
              listName={vm.sale.title}
              itemIds={vm.lotVMs.map((l) => l.id)}
            />
            {vm.pageState === "preparing" && vm.preparing ? (
              <SaleroomCataloguePreparingIsland
                copy={vm.preparing}
                saleId={vm.sale.id}
                saleHref={vm.basePath}
              />
            ) : (
              <>
                <SaleroomCatalogToolbarRow
                  basePath={vm.basePath}
                  layoutView={vm.layoutView}
                  countLabel={vm.countLabel}
                  resultCountLabel={vm.resultCountLabel}
                  controls={vm.controls}
                  statusCounts={vm.statusCounts}
                />
                {vm.catalogSearchFilterCapped ? (
                  <p className="mb-4 text-sm text-on-surface-variant">
                    Search and status filters apply to the first {SALE_CATALOG_LOAD_ALL_CAP} lots of{" "}
                    {vm.lotsPage.total} in this sale.
                  </p>
                ) : null}
                <SaleroomCatalogLotsLiveIsland
                  view={vm.layoutView}
                  rows={vm.catalogueRows}
                  saleForLifecycle={{
                    status: vm.sale.status,
                    deliveryMode: vm.sale.deliveryMode,
                    allowOnlineBidsBeforeGoLive: vm.sale.allowOnlineBidsBeforeGoLive,
                  }}
                  atgReadOnly={vm.atgReadOnly}
                  emptyMessage={vm.catalogEmptyMessage}
                  clearFiltersHref={vm.catalogClearFiltersHref}
                />
                {vm.query.isCatalogLoadAll ? null : (
                  <MarketingPaginationControls
                    ariaLabel="Catalogue pagination"
                    currentPage={vm.query.pageNum}
                    totalPages={vm.catalogTotalPages}
                    getPageHref={vm.catalogPageHref}
                    className="mt-12 border-t border-border-hairline pt-10"
                    scroll={false}
                  />
                )}
              </>
            )}
          </section>

          {vm.showDayGallery && vm.dayGalleryVM ? (
            <section
              id="gallery"
              className={cn(
                MARKETING_PAGE_SHELL,
                SALE_SECTION_SCROLL_MT,
                "pb-0 pt-[var(--section-spacing)]",
              )}
              aria-label="Auction day media"
            >
              <SaleroomDayGallery vm={vm.dayGalleryVM} />
            </section>
          ) : null}

          {vm.showPressSection && vm.pressCoverageItems ? (
            <section
              id="press"
              className={cn(
                MARKETING_PAGE_SHELL,
                SALE_SECTION_SCROLL_MT,
                "pb-0 pt-[var(--section-spacing)]",
              )}
              aria-label="Press coverage"
            >
              <SaleroomPressCoverage items={vm.pressCoverageItems} />
            </section>
          ) : null}

          <SaleTelephoneBiddingIsland
            telephoneSale={vm.telephoneSale}
            saleId={vm.sale.id}
            saleTitle={vm.sale.title}
            loginNextPath={vm.basePath}
          />

          <section
            id="overview"
            className={cn(
              MARKETING_PAGE_SHELL,
              SALE_SECTION_SCROLL_MT,
              "pb-0 pt-[var(--section-spacing)]",
            )}
            aria-label="Additional sale information"
          >
            <SaleroomOverviewPanel overview={vm.overviewVM} sale={vm.sale} />
          </section>

          <SaleroomRelatedAuctionsSection relatedSales={vm.relatedSales} />
        </MarketingDetailShell>
      </SaleroomCatalogLiveShell>
    </SaleViewerProvider>
  );
}
