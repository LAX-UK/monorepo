import { ShareButton } from "@/components/marketing/share-button";
import { ArtworkOnsitePanel } from "@/components/sections/artwork/artwork-onsite-panel";
import type {
  AccordionBlock,
  LotRelatedRailVM,
  LotSummarySeedVM,
} from "@/components/sections/artwork/artwork-view-models";
import type { BidHistoryEntry } from "@/components/sections/artwork/bid-history";
import { LiveBidFeed } from "@/components/sections/artwork/onsite/live-bid-feed";
import { OnsiteAuctionHeader } from "@/components/sections/artwork/onsite/onsite-auction-header";
import { VideoOverlay } from "@/components/sections/artwork/onsite/video-overlay";
import { VideoPlaceholder } from "@/components/sections/artwork/onsite/video-placeholder";
import { LotActionsRow } from "@/components/sections/artwork/redesign/lot-actions-row";
import { LotMarketingAccordion } from "@/components/sections/artwork/redesign/lot-marketing-accordion";
import { LotMoreFromRail } from "@/components/sections/artwork/redesign/lot-more-from-rail";
import { formatMoney } from "@/lib/format-currency";
import type { Lot, Sale } from "@auction/types";
import type { ReactNode } from "react";

type Props = {
  auction: Lot;
  sale: Sale;
  summarySeed: LotSummarySeedVM;
  marketingAccordionBlocks: AccordionBlock[];
  rail: LotRelatedRailVM;
  isAuthenticated: boolean;
  watchedLotIds: readonly string[];
  currentUserId: string | null;
  shareUrl: string;
  followSlot: ReactNode;
  initialHistory: BidHistoryEntry[];
};

function gmtClockLabel(): string {
  return `${new Date().toLocaleTimeString("en-GB", {
    timeZone: "Etc/GMT",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  })} GMT`;
}

export function ArtworkOnsiteLayout({
  auction,
  sale,
  summarySeed,
  marketingAccordionBlocks,
  rail,
  isAuthenticated,
  watchedLotIds,
  currentUserId,
  shareUrl,
  followSlot,
  initialHistory,
}: Props) {
  const isLive = auction.status === "active";
  const lotNo =
    auction.lotNumber != null ? `Lot ${auction.lotNumber}` : `Lot ${auction.id.slice(0, 8)}`;
  const endAtMs = new Date(auction.endTime).getTime();
  const currentBidLabel = formatMoney(auction.currentPrice);

  return (
    <section aria-labelledby="lot-heading-onsite" className="bg-page-bg dark:bg-background">
      <h1 id="lot-heading-onsite" className="sr-only">
        {auction.title}
      </h1>
      <div className="mx-auto max-w-[1440px] px-4 pb-20 pt-6 sm:px-6 md:px-8">
        <div className="mt-0 space-y-8 lg:mt-2 lg:space-y-10">
          <OnsiteAuctionHeader saleTitle={sale.title} lotLabel={lotNo} endAtMs={endAtMs} />

          <div className="flex flex-col gap-6 lg:flex-row lg:items-stretch lg:gap-8">
            <div className="min-w-0 flex-1 motion-safe:animate-in motion-safe:fade-in motion-safe:duration-500 motion-reduce:animate-none">
              <VideoPlaceholder>
                <VideoOverlay
                  title={auction.title}
                  artistName={summarySeed.sellerName}
                  estimateLine={summarySeed.estimateLine}
                  currentBidLabel={currentBidLabel}
                  isLive={isLive}
                  clockLabel={gmtClockLabel()}
                />
              </VideoPlaceholder>
            </div>
            <LiveBidFeed
              lotId={auction.id}
              initialHistory={initialHistory}
              currentUserId={currentUserId}
              className="shrink-0 lg:min-h-0"
            />
          </div>

          <div className="motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 motion-safe:duration-500 motion-reduce:animate-none">
            <ArtworkOnsitePanel auction={auction} sale={sale} summarySeed={summarySeed} />
          </div>

          <div>
            <LotActionsRow
              followSlot={followSlot}
              shareSlot={
                <ShareButton
                  url={shareUrl}
                  title={auction.title}
                  className="h-10 w-full min-h-10 border-brand-400 font-['DM_Sans',sans-serif] text-base font-semibold"
                />
              }
            />
          </div>

          <div className="mt-2">
            <LotMarketingAccordion blocks={marketingAccordionBlocks} />
          </div>
        </div>

        <LotMoreFromRail
          rail={rail}
          currentUserId={currentUserId}
          isAuthenticated={isAuthenticated}
          watchedLotIds={watchedLotIds}
          density="compact"
        />
      </div>
    </section>
  );
}
