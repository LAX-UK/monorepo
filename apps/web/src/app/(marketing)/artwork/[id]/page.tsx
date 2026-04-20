import { ArtworkBidPanel } from "@/components/sections/artwork/artwork-bid-panel";
import { ArtworkSplitView } from "@/components/sections/artwork/artwork-split-view";
import { ArtworkWatchToggle } from "@/components/sections/artwork/artwork-watch-toggle";
import type { BidHistoryEntry } from "@/components/sections/artwork/bid-history";
import { LotPortsProvider } from "@/lib/context/lot-ports";
import { getServerMyWatchlist } from "@/lib/data/http/dashboard.server";
import { getServerLotBids, getServerLotReader } from "@/lib/data/http/lots.server";
import { getServerSaleWithLots } from "@/lib/data/http/sales.server";
import { getServerSessionUser } from "@/lib/data/http/session.server";
import { getServerPublicUserReader } from "@/lib/data/http/users-public.server";
import { metadataForLot } from "@/lib/seo/metadata-factory";
import { lotProductJsonLd } from "@/lib/seo/structured-data";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

type PageProps = {
  params: Promise<{ id: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const reader = await getServerLotReader();
  const auction = await reader.getById(id);
  if (!auction) return { title: "Lot" };
  return metadataForLot(auction);
}

export default async function ArtworkPage({ params }: PageProps) {
  const { id } = await params;
  const reader = await getServerLotReader();
  const [auction, session, publicReader] = await Promise.all([
    reader.getById(id),
    getServerSessionUser(),
    getServerPublicUserReader(),
  ]);
  if (!auction) {
    notFound();
  }

  const [initialBids, seller, relatedRaw, watchlist] = await Promise.all([
    getServerLotBids(id, 30).catch(() => []),
    publicReader.getById(auction.sellerId).catch(() => null),
    auction.categoryId
      ? reader
          .list({
            categoryId: auction.categoryId,
            limit: 8,
            status: "active",
            sort: "endingAsc",
          })
          .catch(() => [])
      : Promise.resolve([]),
    session ? getServerMyWatchlist().catch(() => []) : Promise.resolve([]),
  ]);

  const initialHistory: BidHistoryEntry[] = initialBids.map((b) => ({
    id: b.id,
    bidderId: b.bidderId,
    amount: b.amount,
    at: b.createdAt.getTime(),
  }));
  const initialLeadingBidderId = initialBids.find((b) => b.isWinning)?.bidderId ?? null;

  const watching = watchlist.some((w) => w.lotId === auction.id);
  let parentSale: { id: string; title: string } | null = null;
  if (auction.saleId) {
    const bundle = await getServerSaleWithLots(auction.saleId).catch(() => null);
    if (bundle) parentSale = { id: bundle.sale.id, title: bundle.sale.title };
  }
  const sellerName = seller?.name ?? "Private seller";
  const sellerHref = `/artist/${auction.sellerId}`;

  const jsonLd = lotProductJsonLd(auction);
  const jsonLdText = JSON.stringify(jsonLd).replace(/</g, "\\u003c");

  return (
    <main id="main-content">
      <script
        id={`auction-jsonld-${auction.id}`}
        type="application/ld+json"
        suppressHydrationWarning
      >
        {jsonLdText}
      </script>
      <LotPortsProvider>
        <ArtworkSplitView
          auction={auction}
          parentSale={parentSale}
          sellerHref={sellerHref}
          sellerName={sellerName}
          relatedAuctions={relatedRaw}
          watchSlot={
            <ArtworkWatchToggle
              lotId={auction.id}
              initialWatching={watching}
              isAuthenticated={Boolean(session)}
            />
          }
          bidPanel={
            <ArtworkBidPanel
              auction={auction}
              initialHistory={initialHistory}
              initialLeadingBidderId={initialLeadingBidderId}
              sessionUser={session}
            />
          }
        />
      </LotPortsProvider>
    </main>
  );
}
