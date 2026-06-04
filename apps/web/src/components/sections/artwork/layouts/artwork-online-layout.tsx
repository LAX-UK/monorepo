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
import { shouldShowLotQueueSidebar } from "@/components/sections/artwork/online/lot-queue-sidebar-utils";
import { LotSessionStatePill } from "@/components/sections/artwork/online/lot-session-state-pill";
import { OnlineVideoStreamPanel } from "@/components/sections/artwork/online/online-video-stream-panel";
import { LotActionsRow } from "@/components/sections/artwork/redesign/lot-actions-row";
import { LotMarketingAccordion } from "@/components/sections/artwork/redesign/lot-marketing-accordion";
import { LotMoreFromRail } from "@/components/sections/artwork/redesign/lot-more-from-rail";
import type { Lot, Sale } from "@auction/types";
import { cn } from "@auction/ui";
import type { ReactNode } from "react";

type SalePick = Pick<Sale, "status" | "deliveryMode"> | null;

type Props = {
  auction: Lot;
  saleForLifecycle: SalePick;
  /** Draft sale / draft lot catalogue ribbon */
  showPreviewRibbon?: boolean;
  /** Optional shimmer when sale siblings are still loading */
  isSaleQueueLoading?: boolean;
  /** Align first client tick of `LotStatePill` with server `classifyLotLifecycle`. */
  serverClockMs?: number;
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
  /** Optional strip above the bid panel (e.g. condition report request). */
  bidPanelTop?: ReactNode;
  /** When true, show the Video Stream tab in the bid panel. */
  hasVideoStream?: boolean;
  streamUrl?: string | null;
  streamSaleTitle?: string;
  streamPosterUrl?: string | null;
};

export function ArtworkOnlineLayout({
  auction,
  saleForLifecycle,
  showPreviewRibbon = false,
  isSaleQueueLoading = false,
  serverClockMs,
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
  bidPanelTop,
  hasVideoStream = false,
  streamUrl,
  streamSaleTitle,
  streamPosterUrl,
}: Props) {
  const lifecycleLot = {
    id: auction.id,
    status: auction.status,
    startTime: auction.startTime,
    endTime: auction.endTime,
    winnerId: auction.winnerId,
    reservePrice: auction.reservePrice,
    currentPrice: auction.currentPrice,
  };

  const showQueue = shouldShowLotQueueSidebar(queueUpNext, queueRest, isSaleQueueLoading);

  return (
    <section aria-labelledby="lot-heading" className="bg-page-bg dark:bg-background">
      <h1 id="lot-heading" className="sr-only">
        {auction.title}
      </h1>
      {showPreviewRibbon ? (
        <div className="border-b border-lot-orange/30 bg-lot-orange/10 px-4 py-2 text-center font-body text-sm font-medium text-lot-orange">
          Catalogue preview — bidding opens when the sale is published.
        </div>
      ) : null}
      <div className="mx-auto max-w-[var(--container-max,1440px)] px-4 pb-[var(--page-bottom-padding)] pt-6 sm:px-6 md:px-8">
        <div className="mt-0 lg:mt-2">
          <AuctionSessionHeader
            vm={sessionHeader}
            stateSlot={
              <LotSessionStatePill
                lot={lifecycleLot}
                sale={saleForLifecycle}
                {...(serverClockMs !== undefined ? { initialNowMs: serverClockMs } : {})}
              />
            }
            rightSlot={<LatencyBadgeContainer lotId={auction.id} />}
          />
        </div>

        <div
          className={cn(
            "mt-6 grid grid-cols-1 gap-8 lg:mt-8 lg:items-start lg:gap-6 xl:gap-8",
            showQueue
              ? "lg:grid-cols-[minmax(0,320px)_minmax(0,1fr)_minmax(0,440px)]"
              : "lg:grid-cols-[minmax(0,1fr)_minmax(0,440px)]",
          )}
        >
          {showQueue ? (
            <LotQueueSidebar
              current={queueCurrent}
              upNext={queueUpNext}
              queue={queueRest}
              isSaleQueueLoading={isSaleQueueLoading}
              className="order-4 lg:order-none lg:col-start-1"
            />
          ) : null}
          <div
            className={cn(
              "order-1 min-w-0 lg:self-start lg:sticky lg:top-[calc(var(--header-height)+1rem)]",
              showQueue ? "lg:col-start-2" : "lg:col-start-1",
            )}
          >
            <LotImageArea lot={auction} wide={!showQueue} />
          </div>
          <div
            className={cn(
              "order-2 w-full min-w-0 pb-6 lg:pb-24 xl:pl-2",
              showQueue ? "lg:col-start-3" : "lg:col-start-2",
            )}
          >
            {bidPanelTop ? <div className="mb-4">{bidPanelTop}</div> : null}
            <BidPanelTabs
              bidPanel={bidPanel}
              videoPanel={
                streamUrl && streamSaleTitle ? (
                  <OnlineVideoStreamPanel
                    streamUrl={streamUrl}
                    saleTitle={streamSaleTitle}
                    posterUrl={streamPosterUrl ?? null}
                  />
                ) : null
              }
              hasVideoStream={hasVideoStream && Boolean(streamUrl && streamSaleTitle)}
            />
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

        <div
          className={cn(
            "mx-auto mt-10 w-full max-w-[640px] lg:mt-14",
            showQueue ? "lg:max-w-[786px]" : "lg:max-w-[900px]",
          )}
        >
          <LotMarketingAccordion blocks={marketingAccordionBlocks} variant="artworkCenter" />
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
