import { ShareButton } from "@/components/marketing/share-button";
import type {
  AccordionBlock,
  AuctionSessionHeaderVM,
  LotQueueCardVM,
  LotRelatedRailVM,
  LotSummarySeedVM,
} from "@/components/sections/artwork/artwork-view-models";
import { splitArtworkAccordionBlocks } from "@/components/sections/artwork/artwork-view-models";
import { LotQueueSidebar } from "@/components/sections/artwork/online/lot-queue-sidebar";
import { shouldShowLotQueueSidebar } from "@/components/sections/artwork/online/lot-queue-sidebar-utils";
import { OnsiteLotHero } from "@/components/sections/artwork/onsite/onsite-lot-hero";
import { OnsitePlanVisitSection } from "@/components/sections/artwork/onsite/onsite-plan-visit-section";
import { OnsiteSessionHeader } from "@/components/sections/artwork/onsite/onsite-session-header";
import { OnsiteStreamSection } from "@/components/sections/artwork/onsite/onsite-stream-section";
import { LotActionsRow } from "@/components/sections/artwork/redesign/lot-actions-row";
import {
  LotDetailsSection,
  LotMarketingAccordion,
} from "@/components/sections/artwork/redesign/lot-marketing-accordion";
import { LotMoreFromRail } from "@/components/sections/artwork/redesign/lot-more-from-rail";
import type { SaleOverviewVM } from "@/components/sections/saleroom/view-models";
import { ParticipationWarningCallout } from "@/components/ui/participation-warning-callout";
import { MARKETING_PAGE_SHELL } from "@/lib/marketing/chrome";
import { resolveSaleStreamContext } from "@/lib/sale-stream-policy";
import { getOnsiteNoWebBiddingNote } from "@/lib/sale-type-presentation";
import type { Lot, PublicLotView, Sale } from "@auction/types";
import { cn } from "@auction/ui";
import { formatPostalAddressLines } from "@auction/validators";
import type { ReactNode } from "react";

type SaleLifecyclePick = Pick<Sale, "status" | "deliveryMode"> | null;

type Props = {
  auction: Lot | PublicLotView;
  sale: Sale;
  summarySeed: LotSummarySeedVM;
  marketingAccordionBlocks: AccordionBlock[];
  rail: LotRelatedRailVM;
  isAuthenticated: boolean;
  watchedLotIds: readonly string[];
  currentUserId: string | null;
  shareUrl: string;
  followSlot: ReactNode;
  showPreviewRibbon?: boolean;
  serverClockMs?: number;
  sessionHeader: AuctionSessionHeaderVM;
  queueCurrent: LotQueueCardVM;
  queueUpNext: LotQueueCardVM | null;
  queueRest: LotQueueCardVM[];
  isSaleQueueLoading?: boolean;
  saleForLifecycle: SaleLifecyclePick;
  overview: SaleOverviewVM;
  participationHub?: ReactNode;
};

function locationOneLine(sale: Sale): string {
  const lines = formatPostalAddressLines(sale);
  return [sale.locationName, ...lines].filter(Boolean).join(", ");
}

/** Luxury-focused onsite (in-gallery) lot page layout. */
export function LotOnsiteMarketingLayout({
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
  showPreviewRibbon = false,
  serverClockMs,
  sessionHeader,
  queueCurrent,
  queueUpNext,
  queueRest,
  isSaleQueueLoading = false,
  saleForLifecycle,
  overview,
  participationHub = null,
}: Props) {
  const streamPosterUrl = auction.images[0] ?? sale.coverImages[0] ?? null;
  const streamCtx = resolveSaleStreamContext({
    streamUrl: sale.streamUrl,
    status: sale.status,
    deliveryMode: sale.deliveryMode,
    saleTitle: sale.title,
    endTime: sale.endTime,
  });
  const locationLine = locationOneLine(sale);
  const showQueue = shouldShowLotQueueSidebar(queueUpNext, queueRest, isSaleQueueLoading);
  const { lotDetails: lotDetailsBlock, accordionBlocks } =
    splitArtworkAccordionBlocks(marketingAccordionBlocks);

  return (
    <section aria-labelledby="lot-heading-onsite" className="bg-page-bg dark:bg-background">
      <h1 id="lot-heading-onsite" className="sr-only">
        {auction.title}
      </h1>
      {showPreviewRibbon ? (
        <div className="border-b border-lot-orange/30 bg-lot-orange/10 px-4 py-2 text-center font-body text-sm font-medium text-lot-orange">
          Catalogue preview — bidding opens when the sale is published.
        </div>
      ) : null}
      <div
        className={cn(
          MARKETING_PAGE_SHELL,
          "pb-[calc(1.5rem+var(--bottom-chrome-consent-offset,0px))] pt-6",
        )}
      >
        <OnsiteSessionHeader vm={sessionHeader} sale={sale} />

        <div
          className={cn(
            "mt-6 grid grid-cols-1 gap-8 lg:mt-8 lg:items-start lg:gap-6 xl:gap-8",
            showQueue ? "lg:grid-cols-[minmax(0,280px)_minmax(0,1fr)]" : undefined,
          )}
        >
          {showQueue ? (
            <LotQueueSidebar
              current={queueCurrent}
              upNext={queueUpNext}
              queue={queueRest}
              isSaleQueueLoading={isSaleQueueLoading}
              className="order-2 lg:order-none lg:col-start-1 lg:row-start-1 lg:row-span-3"
            />
          ) : null}

          <div className={cn("order-1 min-w-0", showQueue && "lg:col-start-2")}>
            <OnsiteLotHero
              auction={auction}
              sale={sale}
              summarySeed={summarySeed}
              saleForLifecycle={saleForLifecycle}
              showStreamCta={streamCtx.showOnLotPage}
              {...(serverClockMs !== undefined ? { serverClockMs } : {})}
            />
          </div>
        </div>

        <ParticipationWarningCallout
          kind="onsiteNoWebBidding"
          detail={getOnsiteNoWebBiddingNote()}
          className="mt-8"
        />

        <div className="mt-12 grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,320px)] lg:items-start">
          <div className="order-2 space-y-10 lg:order-1">
            {lotDetailsBlock ? (
              <div className="scroll-mt-28 rounded-3xl border border-outline-variant/20 bg-surface-container-lowest p-6 shadow-sm dark:bg-surface-container-low/40 sm:p-8">
                <LotDetailsSection block={lotDetailsBlock} className="mb-0 border-0 pb-0" />
              </div>
            ) : null}

            <OnsitePlanVisitSection
              sale={sale}
              auction={auction}
              overview={overview}
              locationLine={locationLine}
            />

            {participationHub}

            {accordionBlocks.length > 0 ? (
              <div className="mx-auto w-full max-w-[900px]">
                <LotMarketingAccordion blocks={accordionBlocks} variant="default" />
              </div>
            ) : null}

            {streamCtx.showOnLotPage && streamCtx.presentation && sale.streamUrl ? (
              <OnsiteStreamSection
                streamUrl={sale.streamUrl}
                saleTitle={sale.title}
                streamPosterUrl={streamPosterUrl}
                presentation={streamCtx.presentation}
              />
            ) : null}
          </div>

          <div className="order-1 self-start space-y-6 rounded-3xl border border-outline-variant/20 bg-surface-container-lowest/80 p-6 shadow-sm backdrop-blur-md lg:sticky lg:top-24 lg:order-2">
            <div className="space-y-4">
              <h3 className="border-b border-outline-variant/10 pb-2 font-headline text-base font-bold text-on-surface">
                Follow & share
              </h3>
              <LotActionsRow
                followSlot={followSlot}
                shareSlot={
                  <ShareButton
                    url={shareUrl}
                    title={auction.title}
                    className="h-10 w-full min-h-10 border-brand-400 font-body text-base font-semibold"
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
