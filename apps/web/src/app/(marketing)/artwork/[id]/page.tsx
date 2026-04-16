import { ArtworkBidPanel } from "@/components/sections/artwork/artwork-bid-panel";
import { ArtworkSplitView } from "@/components/sections/artwork/artwork-split-view";
import { ArtworkWatchToggle } from "@/components/sections/artwork/artwork-watch-toggle";
import type { BidHistoryEntry } from "@/components/sections/artwork/bid-history";
import { AuctionPortsProvider } from "@/lib/context/auction-ports";
import { getServerAuctionBids, getServerAuctionReader } from "@/lib/data/http/auctions.server";
import { getServerMyWatchlist } from "@/lib/data/http/dashboard.server";
import { getServerSessionUser } from "@/lib/data/http/session.server";
import { getServerPublicUserReader } from "@/lib/data/http/users-public.server";
import { notFound } from "next/navigation";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function ArtworkPage({ params }: PageProps) {
  const { id } = await params;
  const reader = await getServerAuctionReader();
  const [auction, session, publicReader] = await Promise.all([
    reader.getById(id),
    getServerSessionUser(),
    getServerPublicUserReader(),
  ]);
  if (!auction) {
    notFound();
  }

  const [initialBids, seller, relatedRaw, watchlist] = await Promise.all([
    getServerAuctionBids(id, 30).catch(() => []),
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

  const watching = watchlist.some((w) => w.auctionId === auction.id);
  const sellerName = seller?.name ?? "Private seller";
  const sellerHref = `/artist/${auction.sellerId}`;

  return (
    <AuctionPortsProvider>
      <ArtworkSplitView
        auction={auction}
        sellerHref={sellerHref}
        sellerName={sellerName}
        relatedAuctions={relatedRaw}
        watchSlot={
          <ArtworkWatchToggle
            auctionId={auction.id}
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
    </AuctionPortsProvider>
  );
}
