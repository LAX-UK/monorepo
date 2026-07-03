import { ViewItemTracker } from "@/components/analytics/view-item-tracker";
import { SetMarketingHeaderTitle } from "@/components/layout/set-marketing-header-title";
import { ActingEntityCookieReconciler } from "@/components/legal-entity/acting-entity-cookie-reconciler";
import { LotPager } from "@/components/marketing/lot-pager";
import { MarketingDetailShell } from "@/components/marketing/marketing-detail-shell";
import { MarketingDetailWayfinding } from "@/components/marketing/marketing-detail-wayfinding";
import { RecentlyViewedTracker } from "@/components/marketing/recently-viewed-tracker";
import { ArtworkBidPanel } from "@/components/sections/artwork/artwork-bid-panel";
import { ArtworkConditionReportCta } from "@/components/sections/artwork/artwork-condition-report-cta";
import { ArtworkWatchToggle } from "@/components/sections/artwork/artwork-watch-toggle";
import { ArtworkOnlineLayout } from "@/components/sections/artwork/layouts/artwork-online-layout";
import { LotOnsiteMarketingLayout } from "@/components/sections/artwork/layouts/lot-onsite-marketing-layout";
import { OnlineBidsView } from "@/components/sections/artwork/online/online-bids-view";
import { OnsiteLotUnavailable } from "@/components/sections/artwork/onsite/onsite-lot-unavailable";
import { OnsiteParticipationHub } from "@/components/sections/artwork/onsite/onsite-participation-hub";
import {
  isPublicCatalogLot,
  viewerCanSeeNonPublicCatalog,
} from "@/lib/catalog/public-catalog-visibility";
import { LiveConnectivityNoticeProvider } from "@/lib/connection/live-connectivity-notice";
import { RealtimeHealthProvider } from "@/lib/connection/realtime-health-provider";
import { LotBidHistoryProvider } from "@/lib/context/lot-bid-history-provider";
import { LotPortsProvider } from "@/lib/context/lot-ports";
import { LotRealtimeProvider } from "@/lib/context/lot-realtime-provider";
import { MarketingBidBarChromeProvider } from "@/lib/context/marketing-bid-bar-chrome";
import { OnlineLotLifecycleProvider } from "@/lib/context/online-lot-lifecycle";
import { MaybeSaleroomLiveProvider } from "@/lib/context/saleroom-live-provider";
import { getServerLotById } from "@/lib/data/http/lots.server";
import { lotPageDataService } from "@/lib/marketing/lot-page-data.service";
import { buildLotPageViewModel } from "@/lib/marketing/lot-page-vm";
import { metadataForLot, metadataForNotFound } from "@/lib/seo/metadata-factory";
import { lotPath, salePath, slugify } from "@/lib/seo/url";
import { getSiteUrl } from "@/lib/site-url";
import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";

type PageProps = {
  params: Promise<{ slug: string; id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function ensureCanonicalLotSlug(slug: string, lot: { id: string; title: string }) {
  if (slug !== slugify(lot.title)) permanentRedirect(lotPath(lot));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id, slug } = await params;
  const auction = await getServerLotById(id);
  if (!auction) return metadataForNotFound("Lot not found");
  ensureCanonicalLotSlug(slug, auction);
  return metadataForLot(auction);
}

export default async function ArtworkPage({ params, searchParams }: PageProps) {
  const { id, slug } = await params;
  const sp = await searchParams;
  const serverNow = Date.now();

  const shell = await lotPageDataService.loadShell(id);
  if (!shell) notFound();

  const canPreviewCatalog = viewerCanSeeNonPublicCatalog(
    shell.session?.role,
    shell.session?.staffRole,
  );
  ensureCanonicalLotSlug(slug, shell.auction);

  if (!canPreviewCatalog && !isPublicCatalogLot(shell.auction, shell.saleBundle?.sale ?? null)) {
    notFound();
  }

  const secondary = await lotPageDataService.loadSecondary(shell);
  const vm = buildLotPageViewModel({ shell, secondary, searchParams: sp, serverNow });

  const onlineBidPanel = (
    <OnlineBidsView
      lotId={vm.auction.id}
      lot={vm.auction}
      currentUserId={vm.session?.id ?? null}
      watcherCount={vm.watcherCount > 0 ? vm.watcherCount : null}
      compactFeedHeader
      initialOutbid={vm.initialOutbid}
    >
      <ArtworkBidPanel
        auction={vm.auction}
        initialHistory={vm.initialHistory}
        initialLeadingBidderId={vm.initialLeadingBidderId}
        sessionUser={vm.session}
        summarySeed={vm.summarySeed}
        initialAutoBidSettings={vm.initialAutoBidSettings}
        initialOutbid={vm.initialOutbid}
        initialUserHasBid={vm.initialUserHasBid}
        initialWatching={vm.watching}
        loginNextPath={lotPath(vm.auction)}
        omitPricingHeader
        kycSummary={vm.kycSummary}
        saleRegistrationBidGate={vm.saleRegistrationBidGate}
        saleRegistrationPath={vm.parentSale ? salePath(vm.parentSale) : null}
        orgModuleEnabled={vm.orgModuleEnabled}
        saleForLifecycle={vm.saleLifecyclePick}
        isOwnLot={vm.isOwnLot}
        actingLegalEntityId={vm.actingLegalEntityId}
      />
    </OnlineBidsView>
  );

  const followSlot = (
    <ArtworkWatchToggle
      lotId={vm.auction.id}
      initialWatching={vm.watching}
      isAuthenticated={Boolean(vm.session)}
      loginNextPath={lotPath(vm.auction)}
      appearance="outlined-block"
    />
  );

  const onsiteParticipationHub =
    vm.isOnsiteSale && vm.saleBundle ? (
      <OnsiteParticipationHub
        sale={vm.saleBundle.sale}
        participationCtx={{
          saleTitle: vm.saleBundle.sale.title,
          lotNumber: vm.auction.lotNumber,
          lotTitle: vm.auction.title,
          lotUrl: `${getSiteUrl()}${lotPath(vm.auction)}`,
        }}
        lotId={vm.auction.id}
        loginNextPath={lotPath(vm.auction)}
        isAuthenticated={Boolean(vm.session)}
        kycApproved={vm.kycApprovedForBid}
        mobile={vm.session?.phoneNumber ?? vm.session?.mobile ?? null}
        phoneNumberVerified={vm.session?.phoneNumberVerified === true}
        {...(vm.session?.mobileDisplay ? { mobileDisplay: vm.session.mobileDisplay } : {})}
        buyerEntities={vm.buyerEntitiesForOnsite}
        telephoneBooking={vm.telephoneBookingForOnsite}
        orgModuleEnabled={vm.orgModuleEnabled}
        assignedPaddle={vm.assignedPaddle}
      />
    ) : null;

  return (
    <>
      <SetMarketingHeaderTitle title={vm.auction.title} />
      <MarketingDetailShell
        useCatalogPt={false}
        className="pt-[calc(var(--header-height)+8px)]"
        wrapChildren={false}
        wayfinding={
          <MarketingDetailWayfinding
            backHref={vm.catalogBackHref}
            backLabel={vm.catalogBackLabel}
            actions={
              vm.lotNavVM.prevHref || vm.lotNavVM.nextHref ? (
                <LotPager
                  prevHref={vm.lotNavVM.prevHref}
                  nextHref={vm.lotNavVM.nextHref}
                  positionLabel={vm.lotNavVM.positionLabel}
                />
              ) : null
            }
            breadcrumbItems={vm.breadcrumbItems}
          />
        }
        wayfindingClassName="pb-2 md:pb-4"
        jsonLd={
          <script
            id={`auction-jsonld-${vm.auction.id}`}
            type="application/ld+json"
            suppressHydrationWarning
          >
            {vm.jsonLdText}
          </script>
        }
      >
        <ViewItemTracker
          lotId={vm.auction.id}
          title={vm.auction.title}
          currency={vm.viewItemCurrency}
          {...(vm.viewItemPriceMinor != null ? { priceMinor: vm.viewItemPriceMinor } : {})}
        />
        <RecentlyViewedTracker
          lotId={vm.auction.id}
          href={lotPath(vm.auction)}
          title={vm.auction.title}
        />
        {vm.session && vm.actingCtx.acting ? (
          <ActingEntityCookieReconciler
            serverActingId={vm.actingCtx.acting.id}
            verbose={sp.acting_debug === "1" || sp.acting_debug === "true"}
          />
        ) : null}
        {vm.isOnsiteSale && vm.saleBundle && vm.onsiteOverviewVM ? (
          <LotOnsiteMarketingLayout
            auction={vm.auction}
            sale={vm.saleBundle.sale}
            summarySeed={vm.summarySeed}
            marketingAccordionBlocks={vm.marketingBlocks}
            rail={vm.rail}
            isAuthenticated={Boolean(vm.session)}
            watchedLotIds={vm.watchedLotIds}
            currentUserId={vm.session?.id ?? null}
            shareUrl={vm.shareUrl}
            followSlot={followSlot}
            showPreviewRibbon={vm.showPreviewRibbon}
            serverClockMs={serverNow}
            sessionHeader={vm.sessionHeaderVM}
            queueCurrent={vm.queueVMs.current}
            queueUpNext={vm.queueVMs.upNext}
            queueRest={vm.queueVMs.queue}
            isSaleQueueLoading={vm.isSaleQueueLoading}
            saleForLifecycle={vm.saleLifecyclePick}
            overview={vm.onsiteOverviewVM}
            participationHub={onsiteParticipationHub}
          />
        ) : vm.auction.saleId && !vm.saleBundle ? (
          <OnsiteLotUnavailable
            saleTitle={vm.parentSale?.title ?? null}
            saleId={vm.auction.saleId}
          />
        ) : (
          <RealtimeHealthProvider>
            <LiveConnectivityNoticeProvider>
              <LotPortsProvider actingEntityId={vm.actingCtx.acting?.id}>
                <LotRealtimeProvider lotId={vm.auction.id}>
                  <MaybeSaleroomLiveProvider
                    saleId={vm.isHybridSale ? vm.auction.saleId : null}
                    initial={vm.initialSaleroomStatus}
                  >
                    <MarketingBidBarChromeProvider initialActive={vm.initialMarketingBidBarActive}>
                      <OnlineLotLifecycleProvider
                        lot={vm.lifecycleLotPick}
                        sale={vm.saleLifecyclePick}
                      >
                        <LotBidHistoryProvider
                          lotId={vm.auction.id}
                          initialHistory={vm.initialHistory}
                          initialCurrentPrice={vm.auction.currentPrice}
                          initialLeadingBidderId={vm.initialLeadingBidderId}
                          currentUserId={vm.session?.id ?? null}
                        >
                          <ArtworkOnlineLayout
                            auction={vm.auction}
                            saleForLifecycle={vm.saleLifecyclePick}
                            showPreviewRibbon={vm.showPreviewRibbon}
                            isSaleQueueLoading={vm.isSaleQueueLoading}
                            serverClockMs={serverNow}
                            sessionHeader={vm.sessionHeaderVM}
                            queueCurrent={vm.queueVMs.current}
                            queueUpNext={vm.queueVMs.upNext}
                            queueRest={vm.queueVMs.queue}
                            marketingAccordionBlocks={vm.marketingBlocks}
                            rail={vm.rail}
                            isAuthenticated={Boolean(vm.session)}
                            watchedLotIds={vm.watchedLotIds}
                            currentUserId={vm.session?.id ?? null}
                            shareUrl={vm.shareUrl}
                            followSlot={followSlot}
                            bidPanel={onlineBidPanel}
                            bidPanelTop={
                              <ArtworkConditionReportCta
                                lotId={vm.auction.id}
                                loginNextPath={lotPath(vm.auction)}
                                isAuthenticated={Boolean(vm.session)}
                                canParticipate={vm.viewer.canParticipateAsBuyer}
                                show={vm.conditionReportCtaShow}
                                lotEligible={vm.conditionReportCtaShow}
                                kycApproved={vm.kycApprovedForCr}
                                kycFeedback={vm.kycFeedbackForCr}
                                publishedConditionReport={vm.publishedConditionReport}
                                buyerRequest={vm.buyerConditionReportRequest}
                                userId={vm.session?.id ?? null}
                              />
                            }
                            hasVideoStream={Boolean(vm.lotStreamCtx?.showOnLotPage)}
                            streamUrl={vm.saleBundle?.sale?.streamUrl ?? null}
                            streamSaleTitle={
                              vm.saleBundle?.sale?.title ?? vm.parentSale?.title ?? vm.auction.title
                            }
                            streamPosterUrl={
                              vm.auction.images[0] ?? vm.saleBundle?.sale?.coverImages?.[0] ?? null
                            }
                            saleroomLotRefs={vm.saleroomLotRefs}
                            saleLots={vm.saleLots}
                            artistNameByLotId={vm.artistNameByLotId}
                            {...(vm.catalogLinkParams !== undefined
                              ? { catalogLinkParams: vm.catalogLinkParams }
                              : {})}
                          />
                        </LotBidHistoryProvider>
                      </OnlineLotLifecycleProvider>
                    </MarketingBidBarChromeProvider>
                  </MaybeSaleroomLiveProvider>
                </LotRealtimeProvider>
              </LotPortsProvider>
            </LiveConnectivityNoticeProvider>
          </RealtimeHealthProvider>
        )}
      </MarketingDetailShell>
    </>
  );
}
