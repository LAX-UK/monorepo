import { ViewItemTracker } from "@/components/analytics/view-item-tracker";
import { RecentlyViewedTracker } from "@/components/marketing/recently-viewed-tracker";
import { ArtworkBidPanel } from "@/components/sections/artwork/artwork-bid-panel";
import { ArtworkConditionReportCta } from "@/components/sections/artwork/artwork-condition-report-cta";
import {
  mapAuctionSessionHeaderVM,
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
import { lotViewItemPriceMinor } from "@/lib/analytics/lot-view-item-price";
import { buildSaleRegistrationBidGate } from "@/lib/bid/build-sale-registration-bid-gate";
import { LotPortsProvider } from "@/lib/context/lot-ports";
import { OnlineLotLifecycleProvider } from "@/lib/context/online-lot-lifecycle";
import { getServerDataContainer } from "@/lib/data/container.server";
import { getServerAutoBid } from "@/lib/data/http/auto-bid.server";
import { getServerKycStatusSummary } from "@/lib/data/http/kyc.server";
import {
  getServerLotBids,
  getServerLotById,
  getServerLotDocuments,
  getServerLotReader,
} from "@/lib/data/http/lots.server";
import { getServerSaleMyRegistrations, getServerSaleWithLots } from "@/lib/data/http/sales.server";
import { getServerSessionUser } from "@/lib/data/http/session.server";
import { getServerPublicUserReader } from "@/lib/data/http/users-public.server";
import { resolveActingContext } from "@/lib/legal-entity/acting-context.server";
import { resolveOrgModuleEnabledFromRequest } from "@/lib/legal-entity/org-module-host.server";
import { classifyLotLifecycle } from "@/lib/lot/lot-lifecycle";
import { metadataForLot, metadataForNotFound } from "@/lib/seo/metadata-factory";
import { breadcrumbJsonLd, jsonLdScript, lotProductJsonLd } from "@/lib/seo/structured-data";
import { artistPath, lotPath, salePath, slugify } from "@/lib/seo/url";
import { getSiteUrl } from "@/lib/site-url";
import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";

type PageProps = {
  params: Promise<{ slug: string; id: string }>;
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

export default async function ArtworkPage({ params }: PageProps) {
  const { id, slug } = await params;
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
    relatedRaw,
    watchlist,
    saleBundle,
    artistForAccordion,
    kycSummary,
    lotDocuments,
    initialAutoBidSettings,
  ] = await Promise.all([
    getServerLotBids(id, 30).catch(() => []),
    sellerLookupId ? publicReader.getById(sellerLookupId).catch(() => null) : Promise.resolve(null),
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
    // Catalogue artist FK, then seller user id for rows without attribution.
    publicReader
      .getById(auction.artistId ?? sellerLookupId)
      .catch(() => null),
    kycSummaryPromise,
    getServerLotDocuments(id).catch(() => []),
    initialAutoBidPromise,
  ]);

  const initialHistory: BidHistoryEntry[] = initialBids.map((b) => ({
    id: b.id,
    bidderId: b.bidderId ?? b.placedByUserId ?? "",
    amount: b.amount,
    at: b.createdAt.getTime(),
  }));
  const initialLeadingBidderId =
    initialBids.find((b) => b.isWinning)?.bidderId ??
    initialBids.find((b) => b.isWinning)?.placedByUserId ??
    null;

  const watching = watchlist.some((w) => w.lotId === auction.id);
  const watchedLotIds = watchlist.map((w) => w.lotId);
  const parentSale = saleBundle ? { id: saleBundle.sale.id, title: saleBundle.sale.title } : null;
  const saleLots = saleBundle?.lots ?? null;
  const sellerName = seller?.name ?? "Private seller";
  const shareUrl = `${getSiteUrl()}${lotPath(auction)}`;

  const sellerHref = seller ? artistPath(seller) : `/artist/${auction.sellerId}`;
  const summarySeed = mapLotToSummarySeed(auction, sellerName, sellerHref, seller?.image ?? null);
  const marketingBlocks = buildArtworkPageAccordionBlocks({
    lot: auction,
    artist: artistForAccordion,
    initialHistory,
    documents: lotDocuments,
  });
  const rail = mapSiblingsToRailVM(auction, parentSale, saleLots, relatedRaw, (l) =>
    l.sellerId === auction.sellerId ? sellerName : "Seller",
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

  const isOnsiteSale = saleBundle?.sale?.deliveryMode === "onsite";

  const conditionReportCtaShow =
    !isOnsiteSale && (auction.status === "scheduled" || auction.status === "active");
  const kycApprovedForCr = session?.kycStatus === "approved";
  const kycFeedbackForCr = kycApprovedForCr ? null : (kycSummary?.feedback ?? null);

  const queueVMs = mapSaleLotsToQueueVMs(auction, saleLots, (l) =>
    l.sellerId === auction.sellerId ? sellerName : "Seller",
  );

  const sessionHeaderVM = mapAuctionSessionHeaderVM({
    saleTitle: parentSale?.title ?? "Auction",
    lot: auction,
    userVerified: session?.emailVerified ?? false,
    paddleNumber: null,
  });

  const saleLifecyclePick = saleBundle?.sale
    ? { status: saleBundle.sale.status, deliveryMode: saleBundle.sale.deliveryMode }
    : null;

  const lifecycleLotPick = {
    id: auction.id,
    status: auction.status,
    startTime: auction.startTime,
    endTime: auction.endTime,
    winnerId: auction.winnerId,
    reservePrice: auction.reservePrice,
    currentPrice: auction.currentPrice,
  };

  const previewLife = classifyLotLifecycle(lifecycleLotPick, saleLifecyclePick, serverNow);
  const showPreviewRibbon = previewLife.kind === "preLaunch";
  const isSaleQueueLoading = Boolean(auction.saleId && saleBundle === null);

  const [actingCtx, mySaleRegs] = await Promise.all([
    session
      ? resolveActingContext(session.role, session.staffRole ?? null).catch(() => ({
          acting: null,
          memberships: [],
          impersonation: null,
          bootstrapFailed: false,
        }))
      : Promise.resolve({
          acting: null,
          memberships: [],
          impersonation: null,
          bootstrapFailed: false,
        }),
    session && auction.saleId && saleBundle?.sale?.deliveryMode === "online"
      ? getServerSaleMyRegistrations(auction.saleId).catch(() => [])
      : Promise.resolve([]),
  ]);

  const kycApprovedForBid = session?.kycStatus === "approved";
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

  const onlineBidPanel = (
    <OnlineBidsView
      lotId={auction.id}
      lot={auction}
      initialHistory={initialHistory}
      currentUserId={session?.id ?? null}
      watcherCount={null}
    >
      <ArtworkBidPanel
        auction={auction}
        initialHistory={initialHistory}
        initialLeadingBidderId={initialLeadingBidderId}
        sessionUser={session}
        summarySeed={summarySeed}
        initialAutoBidSettings={initialAutoBidSettings}
        initialWatching={watching}
        loginNextPath={lotPath(auction)}
        omitPricingHeader
        mobilePricingStrip
        kycSummary={kycSummary}
        saleRegistrationBidGate={saleRegistrationBidGate}
        saleRegistrationPath={parentSale ? salePath(parentSale) : null}
        orgModuleEnabled={orgModuleEnabled}
        saleForLifecycle={saleLifecyclePick}
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
    <main id="main-content" className="pt-[calc(var(--header-height)+8px)]">
      <ViewItemTracker
        lotId={auction.id}
        title={auction.title}
        currency={viewItemCurrency}
        {...(viewItemPriceMinor != null ? { priceMinor: viewItemPriceMinor } : {})}
      />
      <RecentlyViewedTracker lotId={auction.id} href={lotPath(auction)} title={auction.title} />
      <script
        id={`auction-jsonld-${auction.id}`}
        type="application/ld+json"
        suppressHydrationWarning
      >
        {jsonLdText}
      </script>
      <LotPortsProvider>
        {isOnsiteSale && saleBundle ? (
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
          />
        ) : (
          <OnlineLotLifecycleProvider lot={lifecycleLotPick} sale={saleLifecyclePick}>
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
                  show={conditionReportCtaShow}
                  kycApproved={kycApprovedForCr}
                  kycFeedback={kycFeedbackForCr}
                />
              }
              hasVideoStream={Boolean(saleBundle?.sale?.streamUrl)}
            />
          </OnlineLotLifecycleProvider>
        )}
      </LotPortsProvider>
    </main>
  );
}
