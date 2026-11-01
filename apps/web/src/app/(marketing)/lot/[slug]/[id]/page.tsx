import { ViewItemTracker } from "@/components/analytics/view-item-tracker";
import { SetMarketingHeaderTitle } from "@/components/layout/set-marketing-header-title";
import { ActingEntityCookieReconciler } from "@/components/legal-entity/acting-entity-cookie-reconciler";
import { LotBidEntry } from "@/components/lot-page/bid/lot-bid-entry";
import { LotTemplate } from "@/components/lot-page/lot-template";
import { LotWayfinding } from "@/components/lot-page/lot-wayfinding";
import {
  AtgExternalBiddingPanel,
  isAtgReadOnlyCatalogSale,
} from "@/components/marketing/atg-external-bidding";
import { LotPager } from "@/components/marketing/lot-pager";
import { MarketingDetailShell } from "@/components/marketing/marketing-detail-shell";
import { MarketingDetailWayfinding } from "@/components/marketing/marketing-detail-wayfinding";
import { RecentlyViewedTracker } from "@/components/marketing/recently-viewed-tracker";
import { ArtworkConditionReportCta } from "@/components/sections/artwork/artwork-condition-report-cta";
import { ArtworkWatchToggle } from "@/components/sections/artwork/artwork-watch-toggle";
import { LotOnsiteMarketingLayout } from "@/components/sections/artwork/layouts/lot-onsite-marketing-layout";
import { OnlineVideoStreamPanel } from "@/components/sections/artwork/online/online-video-stream-panel";
import { OnsiteLotUnavailable } from "@/components/sections/artwork/onsite/onsite-lot-unavailable";
import { LotMoreFromRail } from "@/components/sections/artwork/redesign/lot-more-from-rail";
import { SaleroomLiveLotBanner } from "@/components/sections/saleroom/saleroom-live-lot-banner";
import { usesBidAsClient } from "@/lib/auth/client-audience";
import { resolveKycBidGate } from "@/lib/bid/resolve-kyc-bid-gate";
import { isStrictBidEligibilityEnabled } from "@/lib/bid/strict-bid-eligibility-rollout.server";
import { LiveConnectivityNoticeProvider } from "@/lib/connection/live-connectivity-notice";
import { RealtimeHealthProvider } from "@/lib/connection/realtime-health-provider";
import { LotBidHistoryProvider } from "@/lib/context/lot-bid-history-provider";
import { LotPortsProvider } from "@/lib/context/lot-ports";
import { LotRealtimeProvider } from "@/lib/context/lot-realtime-provider";
import { MarketingBidBarChromeProvider } from "@/lib/context/marketing-bid-bar-chrome";
import { OnlineLotLifecycleProvider } from "@/lib/context/online-lot-lifecycle";
import { MaybeSaleroomLiveProvider } from "@/lib/context/saleroom-live-provider";
import { isEnglishOnlyAuctionsLocked } from "@/lib/feature-flags/english-only-auctions";
import { loadLotTemplateReads } from "@/lib/lot-page/lot-page-reads.server";
import { toLotTemplateData } from "@/lib/lot-page/lot-template-props";
import {
  ensureCanonicalLotSlug,
  loadLotDetailMetadata,
  loadLotDetailPage,
} from "@/lib/marketing/load-lot-detail-page";
import { restoreAccountHref } from "@/lib/navigation/account-link";
import { metadataForLot, metadataForNotFound } from "@/lib/seo/metadata-factory";
import { lotPath, salePath } from "@/lib/seo/url";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

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
    actingCtx,
    orgModuleEnabled,
    initialSaleroomStatus,
    initialHistory,
    initialLeadingBidderId,
    watching,
    watchedLotIds,
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
    lifecycleLotPick,
    showPreviewRibbon,
    isSaleQueueLoading,
    initialMarketingBidBarActive,
    onsiteOverviewVM,
    saleRegistrationBidGate,
    isOwnLot,
    actingLegalEntityId,
    biddingAccount,
    saleLots,
    breadcrumbItems,
    artist,
    lotDocuments,
    viewItemCurrency,
    viewItemPriceMinor,
  } = vm;

  // A signed-in person on a new device bids as the account they used last, not by default as
  // themselves: put this browser in it first.
  if (session && usesBidAsClient(session) && actingCtx.needsRestore) {
    redirect(restoreAccountHref(lotPath(auction)));
  }

  const atgReadOnlyCatalog = isAtgReadOnlyCatalogSale(saleBundle?.sale ?? null);
  const atgLotSold = saleLots?.find((l) => l.id === auction.id)?.atgSold;

  const onsiteLayout = Boolean(isOnsiteSale && saleBundle && onsiteOverviewVM);
  const onsiteUnavailable = Boolean(auction.saleId && !saleBundle);
  const usesLotTemplate = !onsiteLayout && !onsiteUnavailable;

  const templateReads = usesLotTemplate
    ? await loadLotTemplateReads({
        lotId: auction.id,
        signedIn: Boolean(session),
        actingEntityId: actingLegalEntityId,
      })
    : null;

  const bidEntry =
    atgReadOnlyCatalog && saleBundle ? (
      <AtgExternalBiddingPanel sale={saleBundle.sale} lot={{ sold: atgLotSold }} />
    ) : (
      <LotBidEntry
        auction={auction}
        artistName={artist?.name ?? null}
        buyersPremium={templateReads?.bidding.buyersPremium ?? null}
        gate={{
          sessionUser: session,
          loginNextPath: lotPath(auction),
          isOwnLot,
          actingLegalEntityId,
          biddingAccount,
          kycBidGate: resolveKycBidGate({ summary: kycSummary, unavailable: kycUnavailable }),
          saleRegistrationBidGate,
          strictBidEligibilityEnabled: isStrictBidEligibilityEnabled(),
          orgModuleEnabled,
          saleRegistrationPath: parentSale ? salePath(parentSale) : null,
          unsupportedAuctionMode:
            isEnglishOnlyAuctionsLocked() &&
            auction.auctionType !== "english" &&
            auction.auctionType !== "buy_it_now",
        }}
      />
    );

  const followSlot = atgReadOnlyCatalog ? null : (
    <ArtworkWatchToggle
      lotId={auction.id}
      initialWatching={watching}
      isAuthenticated={Boolean(session)}
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
    <>
      <SetMarketingHeaderTitle title={auction.title} />
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
        {session && actingCtx.acting && !actingCtx.needsRestore ? (
          <ActingEntityCookieReconciler
            serverActingId={actingCtx.acting.id}
            verbose={sp.acting_debug === "1" || sp.acting_debug === "true"}
          />
        ) : null}
        {onsiteLayout && saleBundle && onsiteOverviewVM ? (
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
        ) : onsiteUnavailable ? (
          <OnsiteLotUnavailable saleTitle={parentSale?.title ?? null} saleId={auction.saleId} />
        ) : templateReads ? (
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
                          initialSnapshot={lifecycleLotPick}
                          initialLeadingBidderId={initialLeadingBidderId}
                          currentUserId={session?.id ?? null}
                        >
                          <LotTemplate
                            {...toLotTemplateData({
                              auction,
                              lotPath: lotPath(auction),
                              shareUrl,
                              saleLifecycle: saleLifecyclePick,
                              parentSale,
                              signedIn: Boolean(session),
                              watching,
                              artist,
                              documents: lotDocuments,
                              bidding: templateReads.bidding,
                              viewer: templateReads.viewer,
                              history: templateReads.history,
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
                                <ArtworkConditionReportCta model={conditionReport.session} />
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
                            footer={
                              <LotMoreFromRail
                                rail={rail}
                                currentUserId={session?.id ?? null}
                                isAuthenticated={Boolean(session)}
                                watchedLotIds={watchedLotIds}
                                density="compact"
                              />
                            }
                          />
                        </LotBidHistoryProvider>
                      </OnlineLotLifecycleProvider>
                    </MarketingBidBarChromeProvider>
                  </MaybeSaleroomLiveProvider>
                </LotRealtimeProvider>
              </LotPortsProvider>
            </LiveConnectivityNoticeProvider>
          </RealtimeHealthProvider>
        ) : null}
      </MarketingDetailShell>
    </>
  );
}
