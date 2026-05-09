import { ArtworkBidPanel } from "@/components/sections/artwork/artwork-bid-panel";
import {
  findUserLatestBidMeta,
  mapAuctionSessionHeaderVM,
  mapLotToSummarySeed,
  mapSaleLotsToQueueVMs,
  mapSiblingsToRailVM,
} from "@/components/sections/artwork/artwork-view-models";
import { ArtworkWatchToggle } from "@/components/sections/artwork/artwork-watch-toggle";
import type { BidHistoryEntry } from "@/components/sections/artwork/bid-history";
import { buildArtworkPageAccordionBlocks } from "@/components/sections/artwork/build-artwork-accordion-blocks";
import { ArtworkOnlineLayout } from "@/components/sections/artwork/layouts/artwork-online-layout";
import { ArtworkOnsiteLayout } from "@/components/sections/artwork/layouts/artwork-onsite-layout";
import { OnlineBidsView } from "@/components/sections/artwork/online/online-bids-view";
import { LotPortsProvider } from "@/lib/context/lot-ports";
import { getServerDataContainer } from "@/lib/data/container.server";
import {
  getServerLotBids,
  getServerLotById,
  getServerLotReader,
} from "@/lib/data/http/lots.server";
import { getServerSaleWithLots } from "@/lib/data/http/sales.server";
import { getServerSessionUser } from "@/lib/data/http/session.server";
import { getServerPublicUserReader } from "@/lib/data/http/users-public.server";
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

  const watchlistPromise = session
    ? getServerDataContainer()
        .then((c) => c.watchlist.listMine())
        .catch(() => [])
    : Promise.resolve([]);

  const sellerLookupId = auction.sellerId ?? auction.sellerLegalEntityId ?? "";
  const [initialBids, seller, relatedRaw, watchlist, saleBundle, artistForAccordion] =
    await Promise.all([
      getServerLotBids(id, 30).catch(() => []),
      sellerLookupId
        ? publicReader.getById(sellerLookupId).catch(() => null)
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
      publicReader
        .getById(auction.marketingDetails.sellerArtistId ?? sellerLookupId)
        .catch(() => null),
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
  });
  const rail = mapSiblingsToRailVM(auction, parentSale, saleLots, relatedRaw, (l) =>
    l.sellerId === auction.sellerId ? sellerName : "Seller",
  );
  const userMaxMeta = findUserLatestBidMeta(session?.id, initialBids);

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

  const isOnsiteSale = saleBundle?.sale.deliveryMode === "onsite";

  const queueVMs = mapSaleLotsToQueueVMs(auction, saleLots, (l) =>
    l.sellerId === auction.sellerId ? sellerName : "Seller",
  );

  const sessionHeaderVM = mapAuctionSessionHeaderVM({
    saleTitle: parentSale?.title ?? "Auction",
    lot: auction,
    userVerified: session?.emailVerified ?? false,
    paddleNumber: null,
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
        initialUserMaxAuto={userMaxMeta?.maxAutoBidAmount ?? null}
        loginNextPath={lotPath(auction)}
        omitPricingHeader
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
    <main id="main-content" className="pt-[calc(var(--header-height)+8px)]">
      <script
        id={`auction-jsonld-${auction.id}`}
        type="application/ld+json"
        suppressHydrationWarning
      >
        {jsonLdText}
      </script>
      <LotPortsProvider>
        {isOnsiteSale && saleBundle ? (
          <ArtworkOnsiteLayout
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
            initialHistory={initialHistory}
          />
        ) : (
          <ArtworkOnlineLayout
            auction={auction}
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
          />
        )}
      </LotPortsProvider>
    </main>
  );
}
