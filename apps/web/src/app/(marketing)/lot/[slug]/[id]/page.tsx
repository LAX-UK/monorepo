import { ViewItemTracker } from "@/components/analytics/view-item-tracker";
import { SetMarketingHeaderTitle } from "@/components/layout/set-marketing-header-title";
import {
  LotActingEntityReconcilerIsland,
  LotBidEntryIsland,
  LotBidHistoryProviderIsland,
  LotConditionReportCtaIsland,
  LotMoreFromRailIsland,
  LotPageRestoreGate,
  LotPortsProviderIsland,
  LotWatchToggleIsland,
} from "@/components/lot-page/lot-page-viewer-islands";
import { LotTemplate } from "@/components/lot-page/lot-template";
import { LotWayfinding } from "@/components/lot-page/lot-wayfinding";
import { WithdrawnLotPage } from "@/components/lot-page/withdrawn-lot-page";
import {
  AtgExternalBiddingPanel,
  isAtgReadOnlyCatalogSale,
} from "@/components/marketing/atg-external-bidding";
import { LotPager } from "@/components/marketing/lot-pager";
import { MarketingDetailShell } from "@/components/marketing/marketing-detail-shell";
import { MarketingDetailWayfinding } from "@/components/marketing/marketing-detail-wayfinding";
import { RecentlyViewedTracker } from "@/components/marketing/recently-viewed-tracker";
import { LotOnsiteMarketingLayout } from "@/components/sections/artwork/layouts/lot-onsite-marketing-layout";
import { OnlineVideoStreamPanel } from "@/components/sections/artwork/online/online-video-stream-panel";
import { OnsiteLotUnavailable } from "@/components/sections/artwork/onsite/onsite-lot-unavailable";
import { SaleroomLiveLotBanner } from "@/components/sections/saleroom/saleroom-live-lot-banner";
import { isStrictBidEligibilityEnabled } from "@/lib/bid/strict-bid-eligibility-rollout.server";
import { LiveConnectivityNoticeProvider } from "@/lib/connection/live-connectivity-notice";
import { RealtimeHealthProvider } from "@/lib/connection/realtime-health-provider";
import { LotRealtimeProvider } from "@/lib/context/lot-realtime-provider";
import { OnlineLotLifecycleProvider } from "@/lib/context/online-lot-lifecycle";
import { MaybeSaleroomLiveProvider } from "@/lib/context/saleroom-live-provider";
import { getLotMediaTreatments } from "@/lib/departments/lot-media-treatments.server";
import { isEnglishOnlyAuctionsLocked } from "@/lib/feature-flags/english-only-auctions";
import { withoutLiveBidState } from "@/lib/lot-page/catalogue-lot";
import {
  getServerWithdrawnLot,
  loadWithdrawnLotPage,
} from "@/lib/lot-page/load-withdrawn-lot.server";
import { lotPageViewerFrom } from "@/lib/lot-page/lot-page-viewer";
import { LotPageViewerProvider } from "@/lib/lot-page/lot-page-viewer-context";
import { toLotTemplateData } from "@/lib/lot-page/lot-template-props";
import { loadPublicLotTemplateReads } from "@/lib/lot-page/public-lot-page-reads.server";
import {
  ensureCanonicalLotSlug,
  loadLotDetailMetadata,
  loadLotDetailPage,
} from "@/lib/marketing/load-lot-detail-page";
import { metadataForLot, metadataForNotFound } from "@/lib/seo/metadata-factory";
import { lotPath, salePath } from "@/lib/seo/url";
import { DEFAULT_LOT_MEDIA_TREATMENT, lotMediaTreatment } from "@auction/domain";
import type { Lot, PublicLotView } from "@auction/types";
import type { Metadata } from "next";

type PageProps = {
  params: Promise<{ slug: string; id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({ params, searchParams }: PageProps): Promise<Metadata> {
  const { id, slug } = await params;
  const sp = await searchParams;
  const auction = await loadLotDetailMetadata(id);
  if (!auction) {
    const withdrawn = await getServerWithdrawnLot(id);
    return withdrawn
      ? metadataForNotFound(`${withdrawn.title} (withdrawn)`)
      : metadataForNotFound("Lot not found");
  }
  ensureCanonicalLotSlug(slug, auction, sp);
  return metadataForLot(auction);
}

/** The lifecycle provider's lot, from the catalogue lot: its bid fields are neutral placeholders. */
function catalogueLifecycleLot(lot: Lot | PublicLotView) {
  return {
    id: lot.id,
    status: lot.status,
    startTime: lot.startTime,
    endTime: lot.endTime,
    winnerId: lot.winnerId,
    currentPrice: lot.currentPrice,
  };
}

export default async function ArtworkPage({ params, searchParams }: PageProps) {
  const { id, slug } = await params;
  const sp = await searchParams;
  const withdrawn = await loadWithdrawnLotPage({ id, slug, searchParams: sp });
  if (withdrawn) {
    return (
      <MarketingDetailShell useCatalogPt={false} className="pt-[calc(var(--header-height)+8px)]">
        <SetMarketingHeaderTitle title={withdrawn.lot.title} />
        <WithdrawnLotPage data={withdrawn} now={new Date()} />
      </MarketingDetailShell>
    );
  }
  const vm = await loadLotDetailPage({
    id,
    slug,
    searchParams: sp,
    serverNow: Date.now(),
  });
  const {
    serverNow,
    auction,
    saleBundle,
    initialSaleroomStatus,
    parentSale,
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
    conditionReport,
    saleroomLotRefs,
    queueVMs,
    sessionHeaderVM,
    saleLifecyclePick,
    showPreviewRibbon,
    isSaleQueueLoading,
    onsiteOverviewVM,
    saleLots,
    breadcrumbItems,
    artist,
    lotDocuments,
    viewItemCurrency,
    viewItemPriceMinor,
  } = vm;
  // What the page is drawn with for everyone; `/api/lots/:id/me` replaces it in the browser.
  const signedOutViewer = lotPageViewerFrom(vm);
  // The page is built from cached reads, so the lot it hands the browser carries no bid state
  // (CO-7): price, status, close and result come from the live read and the socket.
  const catalogueAuction = withoutLiveBidState(auction);

  const atgReadOnlyCatalog = isAtgReadOnlyCatalogSale(saleBundle?.sale ?? null);
  const atgLotSold = saleLots?.find((l) => l.id === auction.id)?.atgSold;

  const onsiteLayout = Boolean(isOnsiteSale && saleBundle && onsiteOverviewVM);
  const onsiteUnavailable = Boolean(auction.saleId && !saleBundle);
  const usesLotTemplate = !onsiteLayout && !onsiteUnavailable;

  const templateReads = usesLotTemplate ? await loadPublicLotTemplateReads(auction.id) : null;
  const mediaTreatment = usesLotTemplate
    ? lotMediaTreatment(auction, await getLotMediaTreatments())
    : DEFAULT_LOT_MEDIA_TREATMENT;

  const bidEntry =
    atgReadOnlyCatalog && saleBundle ? (
      <AtgExternalBiddingPanel sale={saleBundle.sale} lot={{ sold: atgLotSold }} />
    ) : (
      <LotBidEntryIsland
        auction={catalogueAuction}
        artistName={artist?.name ?? null}
        buyersPremium={templateReads?.buyersPremium ?? null}
        gate={{
          loginNextPath: lotPath(auction),
          strictBidEligibilityEnabled: isStrictBidEligibilityEnabled(),
          saleRegistrationPath: parentSale ? salePath(parentSale) : null,
          unsupportedAuctionMode:
            isEnglishOnlyAuctionsLocked() &&
            auction.auctionType !== "english" &&
            auction.auctionType !== "buy_it_now",
        }}
      />
    );

  const followSlot = atgReadOnlyCatalog ? null : (
    <LotWatchToggleIsland
      lotId={auction.id}
      loginNextPath={lotPath(auction)}
      appearance="outlined-block"
    />
  );

  const wayfinding = usesLotTemplate ? (
    <LotWayfinding
      backHref={catalogBackHref}
      backLabel={catalogBackLabel}
      prevHref={lotNavVM.prevHref}
      nextHref={lotNavVM.nextHref}
      positionLabel={lotNavVM.positionLabel}
    />
  ) : (
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
  );

  return (
    <LotPageViewerProvider lotId={auction.id} signedOut={signedOutViewer}>
      <SetMarketingHeaderTitle title={auction.title} />
      <LotPageRestoreGate returnTo={lotPath(auction)}>
        <MarketingDetailShell
          useCatalogPt={false}
          className="pt-[calc(var(--header-height)+8px)]"
          wrapChildren={usesLotTemplate}
          wayfinding={wayfinding}
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
          <LotActingEntityReconcilerIsland />
          {onsiteLayout && saleBundle && onsiteOverviewVM ? (
            <LotOnsiteMarketingLayout
              auction={auction}
              sale={saleBundle.sale}
              summarySeed={summarySeed}
              marketingAccordionBlocks={marketingBlocks}
              rail={rail}
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
          ) : onsiteUnavailable ? (
            <OnsiteLotUnavailable saleTitle={parentSale?.title ?? null} saleId={auction.saleId} />
          ) : templateReads ? (
            <RealtimeHealthProvider>
              <LiveConnectivityNoticeProvider>
                <LotPortsProviderIsland>
                  <LotRealtimeProvider lotId={auction.id}>
                    <MaybeSaleroomLiveProvider
                      saleId={isHybridSale ? auction.saleId : null}
                      initial={initialSaleroomStatus}
                    >
                      <OnlineLotLifecycleProvider
                        lot={catalogueLifecycleLot(catalogueAuction)}
                        sale={saleLifecyclePick}
                      >
                        <LotBidHistoryProviderIsland lotId={auction.id}>
                          <LotTemplate
                            {...toLotTemplateData({
                              auction,
                              lotPath: lotPath(auction),
                              shareUrl,
                              saleLifecycle: saleLifecyclePick,
                              parentSale,
                              signedIn: false,
                              watching: false,
                              artist,
                              documents: lotDocuments,
                              buyersPremium: templateReads.buyersPremium,
                              viewer: null,
                              media: mediaTreatment,
                            })}
                            bidEntry={bidEntry}
                            banner={
                              <>
                                {showPreviewRibbon ? (
                                  <p className="m-0 rounded-lg bg-lax-neutral-bg px-4 py-2 text-lax-13 leading-5 text-lax-neutral-fg">
                                    Catalogue preview. Bidding opens when the sale is published.
                                  </p>
                                ) : null}
                                {isHybridSale && saleroomLotRefs.length > 0 ? (
                                  <SaleroomLiveLotBanner
                                    lots={saleroomLotRefs}
                                    viewedLotId={auction.id}
                                  />
                                ) : null}
                              </>
                            }
                            supplementary={
                              <>
                                <LotConditionReportCtaIsland
                                  signedOutModel={conditionReport.session}
                                />
                                {lotStreamCtx?.showOnLotPage && saleBundle?.sale?.streamUrl ? (
                                  <OnlineVideoStreamPanel
                                    streamUrl={saleBundle.sale.streamUrl}
                                    saleTitle={saleBundle.sale.title ?? auction.title}
                                    posterUrl={
                                      auction.images[0] ?? saleBundle.sale.coverImages?.[0] ?? null
                                    }
                                  />
                                ) : null}
                              </>
                            }
                            footer={<LotMoreFromRailIsland rail={rail} density="compact" />}
                          />
                        </LotBidHistoryProviderIsland>
                      </OnlineLotLifecycleProvider>
                    </MaybeSaleroomLiveProvider>
                  </LotRealtimeProvider>
                </LotPortsProviderIsland>
              </LiveConnectivityNoticeProvider>
            </RealtimeHealthProvider>
          ) : null}
        </MarketingDetailShell>
      </LotPageRestoreGate>
    </LotPageViewerProvider>
  );
}
