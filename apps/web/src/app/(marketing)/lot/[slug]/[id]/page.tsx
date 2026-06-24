import { ViewItemTracker } from "@/components/analytics/view-item-tracker";
import { shouldShowBidStickyMobileBar } from "@/components/bid/bid-sticky-mobile-bar.logic";
import { SetMarketingHeaderTitle } from "@/components/layout/set-marketing-header-title";
import { ActingEntityCookieReconciler } from "@/components/legal-entity/acting-entity-cookie-reconciler";
import { classifyLotTimerState } from "@/components/lot-timer";
import { LotPager } from "@/components/marketing/lot-pager";
import { MarketingDetailShell } from "@/components/marketing/marketing-detail-shell";
import { MarketingDetailWayfinding } from "@/components/marketing/marketing-detail-wayfinding";
import { RecentlyViewedTracker } from "@/components/marketing/recently-viewed-tracker";
import { ArtworkBidPanel } from "@/components/sections/artwork/artwork-bid-panel";
import { ArtworkConditionReportCta } from "@/components/sections/artwork/artwork-condition-report-cta";
import {
  mapAuctionSessionHeaderVM,
  mapLotToHeroVM,
  mapLotToSummarySeed,
  mapSaleLotsToQueueVMs,
  mapSiblingsToRailVM,
} from "@/components/sections/artwork/artwork-view-models";
import { ArtworkWatchToggle } from "@/components/sections/artwork/artwork-watch-toggle";
import type { BidHistoryEntry } from "@/components/sections/artwork/bid-history";
import { buildArtworkPageAccordionBlocks } from "@/components/sections/artwork/build-artwork-accordion-blocks";
import { ArtworkOnlineLayout } from "@/components/sections/artwork/layouts/artwork-online-layout";
import { LotOnsiteMarketingLayout } from "@/components/sections/artwork/layouts/lot-onsite-marketing-layout";
import { OnlineBidsView } from "@/components/sections/artwork/online/online-bids-view";
import { OnsiteLotUnavailable } from "@/components/sections/artwork/onsite/onsite-lot-unavailable";
import { mapSaleToOverviewVM } from "@/components/sections/saleroom/mappers";
import { lotViewItemPriceMinor } from "@/lib/analytics/lot-view-item-price";
import { buildSaleRegistrationBidGate } from "@/lib/bid/build-sale-registration-bid-gate";
import { computeIsOwnLot } from "@/lib/bid/compute-is-own-lot";
import { deriveInitialOutbid, deriveUserHasBid } from "@/lib/bid/derive-initial-outbid";
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
import { getServerDataContainer } from "@/lib/data/container.server";
import { fetchRegistryArtistById } from "@/lib/data/http/artist.server";
import { getServerAutoBid } from "@/lib/data/http/auto-bid.server";
import { getServerConditionReportForLot } from "@/lib/data/http/condition-report.server";
import { getServerKycStatusSummary } from "@/lib/data/http/kyc.server";
import {
  getServerLotBids,
  getServerLotById,
  getServerLotDocuments,
  getServerLotReader,
  getServerLotWatchCount,
} from "@/lib/data/http/lots.server";
import { getServerSaleroomStatus } from "@/lib/data/http/saleroom-status.server";
import { getServerSaleMyRegistrations, getServerSaleWithLots } from "@/lib/data/http/sales.server";
import { getServerSessionUser } from "@/lib/data/http/session.server";
import { getServerPublicUserReader } from "@/lib/data/http/users-public.server";
import { resolveActingContext } from "@/lib/legal-entity/acting-context.server";
import { resolveOrgModuleEnabledFromRequest } from "@/lib/legal-entity/org-module-host.server";
import { classifyLotLifecycle } from "@/lib/lot/lot-lifecycle";
import {
  catalogLotLinkParamsFromSearchParams,
  lotCatalogBackHref,
  lotCatalogBackLabel,
} from "@/lib/marketing/catalog-links";
import { resolveViewerParticipation } from "@/lib/presenters/viewer-participation";
import { saleAllowsWebBidding } from "@/lib/sale-mode";
import { resolveSaleStreamContext } from "@/lib/sale-stream-policy";
import { metadataForLot, metadataForNotFound } from "@/lib/seo/metadata-factory";
import { breadcrumbJsonLd, jsonLdScript, lotProductJsonLd } from "@/lib/seo/structured-data";
import { artistPath, lotPath, salePath, slugify } from "@/lib/seo/url";
import { getSiteUrl } from "@/lib/site-url";
import { toLotCardTimingVM } from "@auction/validators";
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
  const reader = await getServerLotReader();
  const [auction, session, publicReader] = await Promise.all([
    getServerLotById(id),
    getServerSessionUser(),
    getServerPublicUserReader(),
  ]);
  if (!auction) {
    notFound();
  }
  const canPreviewCatalog = viewerCanSeeNonPublicCatalog(session?.role, session?.staffRole);
  ensureCanonicalLotSlug(slug, auction);

  const orgModuleEnabled = await resolveOrgModuleEnabledFromRequest();

  const watchlistPromise = session
    ? getServerDataContainer()
        .then((c) => c.watchlist.listMine())
        .catch(() => [])
    : Promise.resolve([]);

  const kycSummaryPromise = session
    ? getServerKycStatusSummary().catch(() => null)
    : Promise.resolve(null);

  const initialAutoBidPromise = session
    ? getServerAutoBid(id).catch(() => null)
    : Promise.resolve(null);

  const sellerLookupId = auction.sellerId ?? auction.sellerLegalEntityId ?? "";
  const [
    initialBids,
    seller,
    catalogArtist,
    relatedRaw,
    watchlist,
    saleBundle,
    kycSummary,
    lotDocuments,
    initialAutoBidSettings,
    watcherCount,
  ] = await Promise.all([
    getServerLotBids(id, 30).catch(() => []),
    sellerLookupId ? publicReader.getById(sellerLookupId).catch(() => null) : Promise.resolve(null),
    auction.artistId
      ? fetchRegistryArtistById(auction.artistId).catch(() => null)
      : Promise.resolve(null),
    reader
      .list({
        ...(sellerLookupId ? { sellerId: sellerLookupId } : {}),
        limit: 12,
        status: "active",
        sort: "endingAsc",
      })
      .catch(() => []),
    watchlistPromise,
    auction.saleId
      ? getServerSaleWithLots(auction.saleId).catch(() => null)
      : Promise.resolve(null),
    kycSummaryPromise,
    getServerLotDocuments(id).catch(() => []),
    initialAutoBidPromise,
    getServerLotWatchCount(id).catch(() => 0),
  ]);
  const artistForAccordion = catalogArtist
    ? {
        id: catalogArtist.id,
        name: catalogArtist.displayName,
        image: catalogArtist.portraitUrl ?? null,
      }
    : null;

  if (!canPreviewCatalog && !isPublicCatalogLot(auction, saleBundle?.sale ?? null)) {
    notFound();
  }

  const actingCtx = session
    ? await resolveActingContext(session.role, session.staffRole ?? null).catch(() => ({
        acting: null,
        memberships: [],
        impersonation: null,
        bootstrapFailed: false,
      }))
    : {
        acting: null,
        memberships: [],
        impersonation: null,
        bootstrapFailed: false,
      };

  const mySaleRegs =
    session && auction.saleId && saleBundle
      ? await getServerSaleMyRegistrations(auction.saleId).catch(() => [])
      : [];

  const initialHistory: BidHistoryEntry[] = initialBids.map((b) => ({
    id: b.id,
    bidderId: b.bidderId ?? b.placedByUserId ?? "",
    amount: b.amount,
    at: b.createdAt.getTime(),
    ...(b.isAutoBid ? { isAutoBid: true } : {}),
    ...(b.placedVia ? { placedVia: b.placedVia } : {}),
  }));
  const initialLeadingBidderId =
    initialBids.find((b) => b.isWinning)?.bidderId ??
    initialBids.find((b) => b.isWinning)?.placedByUserId ??
    null;

  const initialUserHasBid = deriveUserHasBid(initialBids, session?.id ?? null);
  const initialOutbid = deriveInitialOutbid({
    lotStatus: auction.status,
    sessionUserId: session?.id ?? null,
    leadingBidderId: initialLeadingBidderId,
    userHasBid: initialUserHasBid,
  });

  const watching = watchlist.some((w) => w.lotId === auction.id);
  const watchedLotIds = watchlist.map((w) => w.lotId);
  const parentSale = saleBundle
    ? {
        id: saleBundle.sale.id,
        title: saleBundle.sale.title,
        deliveryMode: saleBundle.sale.deliveryMode,
      }
    : null;
  const catalogLinkParams = catalogLotLinkParamsFromSearchParams(sp);
  const catalogBackHref = lotCatalogBackHref(sp, parentSale);
  const catalogBackLabel = lotCatalogBackLabel(sp, parentSale);
  const saleLots = saleBundle?.lots ?? null;
  const lotNavVM = mapLotToHeroVM(
    auction,
    parentSale ? { id: parentSale.id, title: parentSale.title } : null,
    saleLots,
    catalogLinkParams,
  );
  const sellerName = seller?.name ?? "Private seller";
  const shareUrl = `${getSiteUrl()}${lotPath(auction)}`;

  const sellerHref = catalogArtist
    ? artistPath({ id: catalogArtist.id, name: catalogArtist.displayName })
    : "";
  const summarySeed = mapLotToSummarySeed(auction, sellerName, sellerHref, seller?.image ?? null);
  const marketingBlocks = buildArtworkPageAccordionBlocks({
    lot: auction,
    artist: artistForAccordion,
    documents: lotDocuments,
  });
  const rail = mapSiblingsToRailVM(
    auction,
    parentSale,
    saleLots,
    relatedRaw,
    (l) => (l.sellerId === auction.sellerId ? sellerName : "Seller"),
    catalogLinkParams,
  );

  const crumbs = breadcrumbJsonLd(
    parentSale
      ? [
          { name: "Home", path: "/" },
          { name: parentSale.title, path: salePath(parentSale) },
          { name: auction.title, path: lotPath(auction) },
        ]
      : [
          { name: "Home", path: "/" },
          { name: "Search", path: "/search" },
          { name: auction.title, path: lotPath(auction) },
        ],
  );
  const jsonLdText = jsonLdScript(
    lotProductJsonLd(auction, {
      ...(artistForAccordion?.name ? { artistName: artistForAccordion.name } : {}),
      ...(sellerName ? { sellerName } : {}),
    }),
    crumbs,
  );

  const isOnsiteSale =
    saleBundle?.sale != null && !saleAllowsWebBidding(saleBundle.sale.deliveryMode);
  const isHybridSale = saleBundle?.sale?.deliveryMode === "hybrid";
  const lotStreamCtx = saleBundle?.sale
    ? resolveSaleStreamContext({
        streamUrl: saleBundle.sale.streamUrl,
        status: saleBundle.sale.status,
        deliveryMode: saleBundle.sale.deliveryMode,
        saleTitle: saleBundle.sale.title,
        endTime: saleBundle.sale.endTime,
      })
    : null;
  const initialSaleroomStatus =
    isHybridSale && auction.saleId
      ? await getServerSaleroomStatus(auction.saleId)
      : { status: "none" as const, currentLotId: null };

  const conditionReportCtaShow =
    !isOnsiteSale && (auction.status === "scheduled" || auction.status === "active");
  const kycApprovedForCr = session?.kycStatus === "approved";
  const kycFeedbackForCr = kycApprovedForCr ? null : (kycSummary?.feedback ?? null);

  const mdCr = auction.marketingDetails?.conditionReport;
  const publishedConditionReport =
    mdCr?.downloadUrl || mdCr?.summary
      ? {
          ...(mdCr.summary ? { summary: mdCr.summary } : {}),
          ...(mdCr.downloadUrl ? { downloadUrl: mdCr.downloadUrl } : {}),
        }
      : null;

  const buyerConditionReportRequest = session
    ? await getServerConditionReportForLot(auction.id).catch(() => null)
    : null;

  const saleroomLotRefs = isHybridSale
    ? (saleLots ?? []).map((l) => ({
        id: l.id,
        lotNumber: l.lotNumber,
        title: l.title,
        href: lotPath(l),
        status: l.status,
      }))
    : [];

  const queueVMs = mapSaleLotsToQueueVMs(
    auction,
    saleLots,
    (l) => (l.sellerId === auction.sellerId ? sellerName : "Seller"),
    catalogLinkParams,
  );

  const artistNameByLotId = Object.fromEntries(
    (saleLots ?? []).map((l) => [l.id, l.sellerId === auction.sellerId ? sellerName : "Seller"]),
  );

  const sessionHeaderVM = mapAuctionSessionHeaderVM({
    saleTitle: parentSale?.title ?? "Auction",
    lot: auction,
    userVerified: session?.emailVerified ?? false,
    paddleNumber: null,
  });

  const saleLifecyclePick = saleBundle?.sale
    ? {
        status: saleBundle.sale.status,
        deliveryMode: saleBundle.sale.deliveryMode,
        allowOnlineBidsBeforeGoLive: saleBundle.sale.allowOnlineBidsBeforeGoLive,
      }
    : null;

  const lifecycleLotPick = {
    id: auction.id,
    status: auction.status,
    startTime: auction.startTime,
    endTime: auction.endTime,
    winnerId: auction.winnerId,
    currentPrice: auction.currentPrice,
  };

  const previewLife = classifyLotLifecycle(lifecycleLotPick, saleLifecyclePick, serverNow);
  const showPreviewRibbon = previewLife.kind === "preLaunch";
  const isSaleQueueLoading = Boolean(auction.saleId && saleBundle === null);
  const lotTimerState = classifyLotTimerState(toLotCardTimingVM(lifecycleLotPick), serverNow);
  const biddingLiveAtSsr =
    previewLife.kind === "live" ||
    previewLife.kind === "extended" ||
    previewLife.kind === "liveSaleroom" ||
    previewLife.kind === "saleroomPaused";
  const initialMarketingBidBarActive = shouldShowBidStickyMobileBar({
    live: biddingLiveAtSsr,
    lifecycleKind: previewLife.kind,
    timerState: lotTimerState,
  });

  const onsiteOverviewVM = saleBundle
    ? mapSaleToOverviewVM(saleBundle.sale, {
        categoryLabel: null,
      })
    : null;

  const kycApprovedForBid = session?.kycStatus === "approved";
  const viewer = resolveViewerParticipation(session);
  const saleRegistrationBidGate = buildSaleRegistrationBidGate({
    saleId: auction.saleId,
    saleDeliveryMode: saleBundle?.sale?.deliveryMode,
    saleStatus: saleBundle?.sale?.status,
    acting: actingCtx.acting,
    memberships: actingCtx.memberships,
    myRegistrations: mySaleRegs.map((r) => ({
      buyerLegalEntityId: r.buyerLegalEntityId,
      status: r.status,
      bidLimit: r.bidLimit,
    })),
    kycApproved: kycApprovedForBid,
    kycFeedback: kycApprovedForBid ? null : (kycSummary?.feedback ?? null),
  });

  const isOwnLot = computeIsOwnLot(auction, session, actingCtx.acting);
  const actingLegalEntityId = actingCtx.acting?.id ?? null;

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
        saleRegistrationBidGate={saleRegistrationBidGate}
        saleRegistrationPath={parentSale ? salePath(parentSale) : null}
        orgModuleEnabled={orgModuleEnabled}
        saleForLifecycle={saleLifecyclePick}
        isOwnLot={isOwnLot}
        actingLegalEntityId={actingLegalEntityId}
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

  const viewItemCurrency = auction.marketingDetails?.estimate?.currency ?? "GBP";
  const viewItemPriceMinor = lotViewItemPriceMinor(auction);

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
            breadcrumbItems={
              parentSale
                ? [
                    { label: "Home", href: "/" },
                    { label: parentSale.title, href: salePath(parentSale) },
                    { label: auction.title, current: true },
                  ]
                : [
                    { label: "Home", href: "/" },
                    { label: "Search", href: "/search" },
                    { label: auction.title, current: true },
                  ]
            }
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
