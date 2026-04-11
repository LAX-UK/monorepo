import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { ArtworkBidPanel } from "@/components/sections/artwork/artwork-bid-panel";
import { ArtworkSplitView } from "@/components/sections/artwork/artwork-split-view";
import { AuctionPortsProvider } from "@/lib/context/auction-ports";
import { getServerAuctionReader } from "@/lib/data/http/auctions.server";
import { notFound } from "next/navigation";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function ArtworkPage({ params }: PageProps) {
  const { id } = await params;
  const reader = await getServerAuctionReader();
  const auction = await reader.getById(id);
  if (!auction) {
    notFound();
  }

  return (
    <>
      <SiteHeader />
      <AuctionPortsProvider>
        <ArtworkSplitView auction={auction} bidPanel={<ArtworkBidPanel auction={auction} />} />
      </AuctionPortsProvider>
      <SiteFooter />
    </>
  );
}
