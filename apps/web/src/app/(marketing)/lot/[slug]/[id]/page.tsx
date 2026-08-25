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
import { isStrictBidEligibilityEnabled } from "@/lib/bid/strict-bid-eligibility-rollout.server";
import { LiveConnectivityNoticeProvider } from "@/lib/connection/live-connectivity-notice";
import { RealtimeHealthProvider } from "@/lib/connection/realtime-health-provider";
import { LotBidHistoryProvider } from "@/lib/context/lot-bid-history-provider";
import { LotPortsProvider } from "@/lib/context/lot-ports";
import { LotRealtimeProvider } from "@/lib/context/lot-realtime-provider";
import { MarketingBidBarChromeProvider } from "@/lib/context/marketing-bid-bar-chrome";
import { OnlineLotLifecycleProvider } from "@/lib/context/online-lot-lifecycle";
import { MaybeSaleroomLiveProvider } from "@/lib/context/saleroom-live-provider";
import {
  ensureCanonicalLotSlug,
  loadLotDetailMetadata,
  loadLotDetailPage,
} from "@/lib/marketing/load-lot-detail-page";
import { metadataForLot, metadataForNotFound } from "@/lib/seo/metadata-factory";
import { lotPath, salePath } from "@/lib/seo/url";
import type { Metadata } from "next";

type PageProps = {
  params: Promise<{ slug: string; id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({ params, searchParams }: PageProps): Promise<Metadata> {
  const { id, slug } = await params;
  const sp = await searchParams;
  const auction = await loadLotDetailMetadata(id);
  if (!auction) return metadataForNotFound("Lot not found");
  ensureCanonicalLotSlug(slug, auction, sp);
  return metadataForLot(auction);
}

export default async function ArtworkPage({ params, searchParams }: PageProps) {
  const { id, slug } = await params;
  const sp = await searchParams;
  const vm = await loadLotDetailPage({
    id,
    slug,
    searchParams: sp,
    serverNow: Date.now(),
  });
  const {
    serverNow,
    auction,
    session,
    saleBundle,
    kycSummary,
    kycUnavailable,
    initialAutoBidSettings,
    watcherCount,
    actingCtx,
    orgModuleEnabled,
    initialSaleroomStatus,
    initialHistory,
    initialLeadingBidderId,
    initialOutbid,
    initialUserHasBid,
    watching,
    watchedLotIds,
    parentSale,
    catalogLinkParams,
    catalogBackHref,
    catalogBackLabel,
    lotNavVM,
    shareUrl,
    summarySeed,
    marketingBlocks,
    rail,
    jsonLdText,
    isOnsiteSale,
    isHybridSale,
    lotStreamCtx,
    conditionReportCtaShow,
    kycApprovedForCr,
    kycFeedbackForCr,
    publishedConditionReport,
    buyerConditionReportRequest,
    saleroomLotRefs,
    queueVMs,
    artistNameByLotId,
    sessionHeaderVM,
    saleLifecyclePick,
    lifecycleLotPick,
    showPreviewRibbon,
    isSaleQueueLoading,
    initialMarketingBidBarActive,
    onsiteOverviewVM,
    saleRegistrationBidGate,
    isOwnLot,
    actingLegalEntityId,
    viewer,
    saleLots,
    breadcrumbItems,
    viewItemCurrency,
    viewItemPriceMinor,
  } = vm;

  const onlineBidPanel = (
    <OnlineBidsView
      lotId={auction.id}
      lot={auction}
      currentUserId={session?.id ?? null}
      watcherCount={watcherCount > 0 ? watcherCount : null}
      compactFeedHeader
      initialOutbid={initialOutbid}
    >
      <ArtworkBidPanel
        auction={auction}
        initialHistory={initialHistory}
        initialLeadingBidderId={initialLeadingBidderId}
        sessionUser={session}
        summarySeed={summarySeed}
        initialAutoBidSettings={initialAutoBidSettings}
        initialOutbid={initialOutbid}
        initialUserHasBid={initialUserHasBid}
        initialWatching={watching}
        loginNextPath={lotPath(auction)}
        omitPricingHeader
        kycSummary={kycSummary}
        kycUnavailable={kycUnavailable}
        saleRegistrationBidGate={saleRegistrationBidGate}
        saleRegistrationPath={parentSale ? salePath(parentSale) : null}
        orgModuleEnabled={orgModuleEnabled}
        saleForLifecycle={saleLifecyclePick}
        isOwnLot={isOwnLot}
        actingLegalEntityId={actingLegalEntityId}
        strictBidEligibilityEnabled={isStrictBidEligibilityEnabled()}
      />
    </OnlineBidsView>
  );

  const followSlot = (
    <ArtworkWatchToggle
      lotId={auction.id}
      initialWatching={watching}
      isAuthenticated={Boolean(session)}
      loginNextPath={lotPath(auction)}
      appearance="outlined-block"
    />
  );

  return (
    <>
      <SetMarketingHeaderTitle title={auction.title} />
      <MarketingDetailShell
        useCatalogPt={false}
        className="pt-[calc(var(--header-height)+8px)]"
        wrapChildren={false}
        wayfinding={
          <MarketingDetailWayfinding
            backHref={catalogBackHref}
            backLabel={catalogBackLabel}
            actions={
              lotNavVM.prevHref || lotNavVM.nextHref ? (
                <LotPager
                  prevHref={lotNavVM.prevHref}
                  nextHref={lotNavVM.nextHref}
                  positionLabel={lotNavVM.positionLabel}
                />
              ) : null
            }
            breadcrumbItems={breadcrumbItems}
          />
        }
        wayfindingClassName="pb-2 md:pb-4"
        jsonLd={
          <script
            id={`auction-jsonld-${auction.id}`}
            type="application/ld+json"
            suppressHydrationWarning
          >
            {jsonLdText}
          </script>
        }
      >
        <ViewItemTracker
          lotId={auction.id}
          title={auction.title}
          currency={viewItemCurrency}
          {...(viewItemPriceMinor != null ? { priceMinor: viewItemPriceMinor } : {})}
        />
        <RecentlyViewedTracker lotId={auction.id} href={lotPath(auction)} title={auction.title} />
        {session && actingCtx.acting ? (
          <ActingEntityCookieReconciler
            serverActingId={actingCtx.acting.id}
            verbose={sp.acting_debug === "1" || sp.acting_debug === "true"}
          />
        ) : null}
        {isOnsiteSale && saleBundle && onsiteOverviewVM ? (
          <LotOnsiteMarketingLayout
            auction={auction}
            sale={saleBundle.sale}
            summarySeed={summarySeed}
            marketingAccordionBlocks={marketingBlocks}
            rail={rail}
            isAuthenticated={Boolean(session)}
            watchedLotIds={watchedLotIds}
            currentUserId={session?.id ?? null}
            shareUrl={shareUrl}
            followSlot={followSlot}
            showPreviewRibbon={showPreviewRibbon}
            serverClockMs={serverNow}
            sessionHeader={sessionHeaderVM}
            queueCurrent={queueVMs.current}
            queueUpNext={queueVMs.upNext}
            queueRest={queueVMs.queue}
            isSaleQueueLoading={isSaleQueueLoading}
            saleForLifecycle={saleLifecyclePick}
            overview={onsiteOverviewVM}
          />
        ) : auction.saleId && !saleBundle ? (
          <OnsiteLotUnavailable saleTitle={parentSale?.title ?? null} saleId={auction.saleId} />
        ) : (
          <RealtimeHealthProvider>
            <LiveConnectivityNoticeProvider>
              <LotPortsProvider actingEntityId={actingCtx.acting?.id}>
                <LotRealtimeProvider lotId={auction.id}>
                  <MaybeSaleroomLiveProvider
                    saleId={isHybridSale ? auction.saleId : null}
                    initial={initialSaleroomStatus}
                  >
                    <MarketingBidBarChromeProvider initialActive={initialMarketingBidBarActive}>
                      <OnlineLotLifecycleProvider lot={lifecycleLotPick} sale={saleLifecyclePick}>
                        <LotBidHistoryProvider
                          lotId={auction.id}
                          initialHistory={initialHistory}
                          initialCurrentPrice={auction.currentPrice}
                          initialLeadingBidderId={initialLeadingBidderId}
                          currentUserId={session?.id ?? null}
                        >
                          <ArtworkOnlineLayout
                            auction={auction}
                            saleForLifecycle={saleLifecyclePick}
                            showPreviewRibbon={showPreviewRibbon}
                            isSaleQueueLoading={isSaleQueueLoading}
                            serverClockMs={serverNow}
                            sessionHeader={sessionHeaderVM}
                            queueCurrent={queueVMs.current}
                            queueUpNext={queueVMs.upNext}
                            queueRest={queueVMs.queue}
                            marketingAccordionBlocks={marketingBlocks}
                            rail={rail}
                            isAuthenticated={Boolean(session)}
                            watchedLotIds={watchedLotIds}
                            currentUserId={session?.id ?? null}
                            shareUrl={shareUrl}
                            followSlot={followSlot}
                            bidPanel={onlineBidPanel}
                            bidPanelTop={
                              <ArtworkConditionReportCta
                                lotId={auction.id}
                                loginNextPath={lotPath(auction)}
                                isAuthenticated={Boolean(session)}
                                canParticipate={viewer.canParticipateAsBuyer}
                                show={conditionReportCtaShow}
                                lotEligible={conditionReportCtaShow}
                                kycApproved={kycApprovedForCr}
                                kycFeedback={kycFeedbackForCr}
                                publishedConditionReport={publishedConditionReport}
                                buyerRequest={buyerConditionReportRequest}
                                userId={session?.id ?? null}
                              />
                            }
                            hasVideoStream={Boolean(lotStreamCtx?.showOnLotPage)}
                            streamUrl={saleBundle?.sale?.streamUrl ?? null}
                            streamSaleTitle={
                              saleBundle?.sale?.title ?? parentSale?.title ?? auction.title
                            }
                            streamPosterUrl={
                              auction.images[0] ?? saleBundle?.sale?.coverImages?.[0] ?? null
                            }
                            saleroomLotRefs={saleroomLotRefs}
                            saleLots={saleLots}
                            artistNameByLotId={artistNameByLotId}
                            {...(catalogLinkParams !== undefined ? { catalogLinkParams } : {})}
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
