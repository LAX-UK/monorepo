import { ViewItemListTracker } from "@/components/analytics/view-item-list-tracker";
import { MarketingDetailShell } from "@/components/marketing/marketing-detail-shell";
import { MarketingDetailWayfinding } from "@/components/marketing/marketing-detail-wayfinding";
import { MarketingPaginationControls } from "@/components/marketing/marketing-pagination-controls";
import { SaleAnchorTabs } from "@/components/marketing/sale-anchor-tabs";
import { SaleMobileSummaryBar } from "@/components/marketing/sale-mobile-summary-bar";
import { SaleTelephoneBiddingSection } from "@/components/marketing/sale-telephone-bidding-section";
import { SaleroomCatalogLiveShell } from "@/components/sections/saleroom/saleroom-catalog-live-shell";
import { SaleroomCatalogLotsLive } from "@/components/sections/saleroom/saleroom-catalog-lots-live";
import { SaleroomCatalogToolbarRow } from "@/components/sections/saleroom/saleroom-catalog-toolbar-row";
import { SaleroomDayGallery } from "@/components/sections/saleroom/saleroom-day-gallery";
import { SaleroomHero } from "@/components/sections/saleroom/saleroom-hero";
import { SaleroomHeroActionRow } from "@/components/sections/saleroom/saleroom-hero-action-row";
import { SaleroomHeroToolbar } from "@/components/sections/saleroom/saleroom-hero-toolbar";
import { SaleroomOverviewPanel } from "@/components/sections/saleroom/saleroom-overview-panel";
import { SaleroomPressCoverage } from "@/components/sections/saleroom/saleroom-press-coverage";
import { SaleroomRelatedAuctionsSection } from "@/components/sections/saleroom/saleroom-related-auctions-section";
import { MARKETING_PAGE_SHELL, SALE_SECTION_SCROLL_MT } from "@/lib/marketing/chrome";
import type { SaleroomDetailPageData } from "@/lib/marketing/load-saleroom-detail-page";
import { buildSaleAnchorTabs } from "@/lib/marketing/sale-anchor-tab-list";
import { SALE_CATALOG_LOAD_ALL_CAP } from "@/lib/marketing/saleroom-page-data.service";
import { cn } from "@auction/ui";

type SaleroomDetailViewProps = SaleroomDetailPageData;

export function SaleroomDetailView({
  vm,
  jsonLdText,
  session,
  explainerContext,
}: SaleroomDetailViewProps) {
  return (
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
          <SaleMobileSummaryBar
            start={vm.sale.startTime}
            end={vm.sale.endTime}
            status={vm.sale.status}
            saleTitle={vm.sale.title}
            deliveryMode={vm.sale.deliveryMode}
            directionsUrl={vm.directionsUrl}
            streamUrl={vm.sale.streamUrl}
            sale={vm.sale}
            locationLine={vm.locationLine}
            canParticipate={vm.viewer.canParticipateAsBuyer}
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
            saleStartsSoon={vm.saleStartsSoon}
            showOnlineBiddingGatedBadge={vm.showOnlineBiddingGatedBadge}
            explainerContext={explainerContext}
            toolbar={<SaleroomHeroToolbar shareUrl={vm.shareUrl} shareTitle={vm.sale.title} />}
            actions={
              <SaleroomHeroActionRow
                hero={vm.heroVM}
                isAuthenticated={vm.isAuthenticated}
                deliveryMode={vm.sale.deliveryMode}
                saleId={vm.sale.id}
                saleHref={vm.basePath}
                initialFollowing={vm.initialFollowing}
                registerToBid={{
                  show: vm.registerToBidShow,
                  buyerEntities: vm.buyerEntities,
                  myRegistrations: vm.myRegistrations,
                  kycApproved: vm.kycApproved,
                  kycFeedback: vm.kycFeedback,
                  orgModuleEnabled: vm.orgModuleEnabled,
                  saleCurrency: "GBP",
                }}
                hasApprovedRegistration={vm.myRegistrations.some((r) => r.status === "approved")}
              />
            }
          />
        }
      >
        <SaleAnchorTabs
          tabs={buildSaleAnchorTabs({
            showTelephone: vm.showTelephoneBooking,
            showGallery: vm.showDayGallery,
            showPress: vm.showPressSection,
          })}
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
          <SaleroomCatalogToolbarRow
            basePath={vm.basePath}
            layoutView={vm.layoutView}
            countLabel={vm.countLabel}
            resultCountLabel={vm.resultCountLabel}
          />
          {vm.catalogSearchFilterCapped ? (
            <p className="mb-4 text-sm text-on-surface-variant">
              Search and status filters apply to the first {SALE_CATALOG_LOAD_ALL_CAP} lots of{" "}
              {vm.lotsPage.total} in this sale.
            </p>
          ) : null}
          <SaleroomCatalogLotsLive
            view={vm.layoutView}
            lots={vm.lotVMs}
            saleForLifecycle={{
              status: vm.sale.status,
              deliveryMode: vm.sale.deliveryMode,
              allowOnlineBidsBeforeGoLive: vm.sale.allowOnlineBidsBeforeGoLive,
            }}
            isAuthenticated={vm.isAuthenticated}
            canParticipate={vm.viewer.canParticipateAsBuyer}
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

        {vm.showTelephoneBooking ? (
          <SaleTelephoneBiddingSection
            saleId={vm.sale.id}
            saleTitle={vm.sale.title}
            loginNextPath={vm.basePath}
            isAuthenticated={vm.isAuthenticated}
            kycApproved={vm.kycApproved}
            mobile={session?.phoneNumber ?? session?.mobile ?? null}
            phoneNumberVerified={session?.phoneNumberVerified === true}
            {...(session?.mobileDisplay ? { mobileDisplay: session.mobileDisplay } : {})}
            buyerEntities={vm.buyerEntities}
            existingBooking={vm.telephoneBooking}
            orgModuleEnabled={vm.orgModuleEnabled}
          />
        ) : null}

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
  );
}
