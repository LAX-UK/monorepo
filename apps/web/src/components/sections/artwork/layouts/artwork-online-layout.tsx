import { ShareButton } from "@/components/marketing/share-button";
import type {
  AccordionBlock,
  AuctionSessionHeaderVM,
  LotQueueCardVM,
  LotRelatedRailVM,
} from "@/components/sections/artwork/artwork-view-models";
import { AuctionSessionHeader } from "@/components/sections/artwork/online/auction-session-header";
import { BidPanelTabs } from "@/components/sections/artwork/online/bid-panel-tabs";
import { LatencyBadgeContainer } from "@/components/sections/artwork/online/latency-badge-container";
import { LotImageArea } from "@/components/sections/artwork/online/lot-image-area";
import { LotQueueSidebar } from "@/components/sections/artwork/online/lot-queue-sidebar";
import { OnlineVideoStreamPanel } from "@/components/sections/artwork/online/online-video-stream-panel";
import { LotActionsRow } from "@/components/sections/artwork/redesign/lot-actions-row";
import { LotMarketingAccordion } from "@/components/sections/artwork/redesign/lot-marketing-accordion";
import { LotMoreFromRail } from "@/components/sections/artwork/redesign/lot-more-from-rail";
import type { Lot } from "@auction/types";
import type { ReactNode } from "react";

type Props = {
  auction: Lot;
  sessionHeader: AuctionSessionHeaderVM;
  queueCurrent: LotQueueCardVM;
  queueUpNext: LotQueueCardVM | null;
  queueRest: LotQueueCardVM[];
  marketingAccordionBlocks: AccordionBlock[];
  rail: LotRelatedRailVM;
  isAuthenticated: boolean;
  watchedLotIds: readonly string[];
  currentUserId: string | null;
  shareUrl: string;
  followSlot: ReactNode;
  bidPanel: ReactNode;
};

export function ArtworkOnlineLayout({
  auction,
  sessionHeader,
  queueCurrent,
  queueUpNext,
  queueRest,
  marketingAccordionBlocks,
  rail,
  isAuthenticated,
  watchedLotIds,
  currentUserId,
  shareUrl,
  followSlot,
  bidPanel,
}: Props) {
  const isLive = auction.status === "active";

  return (
    <section aria-labelledby="lot-heading" className="bg-page-bg dark:bg-background">
      <h1 id="lot-heading" className="sr-only">
        {auction.title}
      </h1>
      <div className="mx-auto max-w-[1440px] px-4 pb-20 pt-6 sm:px-6 md:px-8">
        <div className="mt-0 lg:mt-2">
          <AuctionSessionHeader
            vm={sessionHeader}
            rightSlot={<LatencyBadgeContainer lotId={auction.id} />}
          />
        </div>

        <div className="mt-6 flex flex-col gap-8 lg:mt-8 lg:flex-row lg:items-start lg:gap-6 xl:gap-8">
          <LotQueueSidebar
            current={queueCurrent}
            upNext={queueUpNext}
            queue={queueRest}
            isLive={isLive}
          />
          <div className="min-w-0 flex-1">
            <LotImageArea lot={auction} />
            <div className="mx-auto mt-8 w-full max-w-[640px] lg:max-w-[786px]">
              <LotMarketingAccordion blocks={marketingAccordionBlocks} variant="artworkCenter" />
            </div>
          </div>
          <div className="w-full min-w-0 pb-6 lg:max-w-[440px] lg:shrink-0 lg:pb-24 xl:pl-2">
            <BidPanelTabs bidPanel={bidPanel} videoPanel={<OnlineVideoStreamPanel />} />
            <div className="mt-6">
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
