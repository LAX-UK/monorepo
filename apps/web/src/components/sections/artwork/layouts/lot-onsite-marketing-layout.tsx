import { SaleParticipationTimeline } from "@/components/marketing/sale-participation-timeline";
import { ShareButton } from "@/components/marketing/share-button";
import type {
  AccordionBlock,
  AuctionSessionHeaderVM,
  LotQueueCardVM,
  LotRelatedRailVM,
  LotSummarySeedVM,
} from "@/components/sections/artwork/artwork-view-models";
import { LotQueueSidebar } from "@/components/sections/artwork/online/lot-queue-sidebar";
import { shouldShowLotQueueSidebar } from "@/components/sections/artwork/online/lot-queue-sidebar-utils";
import { OnsiteLotHero } from "@/components/sections/artwork/onsite/onsite-lot-hero";
import { OnsiteParticipationHub } from "@/components/sections/artwork/onsite/onsite-participation-hub";
import { OnsitePlanVisitSection } from "@/components/sections/artwork/onsite/onsite-plan-visit-section";
import { OnsiteSessionHeader } from "@/components/sections/artwork/onsite/onsite-session-header";
import { OnsiteStreamSection } from "@/components/sections/artwork/onsite/onsite-stream-section";
import { LotActionsRow } from "@/components/sections/artwork/redesign/lot-actions-row";
import { LotMarketingAccordion } from "@/components/sections/artwork/redesign/lot-marketing-accordion";
import { LotMoreFromRail } from "@/components/sections/artwork/redesign/lot-more-from-rail";
import type { SaleOverviewVM } from "@/components/sections/saleroom/view-models";
import { MARKETING_PAGE_SHELL } from "@/lib/marketing/chrome";
import type { OnsiteParticipationContext } from "@/lib/onsite/participation-request-input";
import { getOnsiteNoWebBiddingNote } from "@/lib/sale-type-presentation";
import type { TelephoneBookingSnapshot } from "@/lib/telephone/telephone-booking-types";
import type { Lot, Sale } from "@auction/types";
import { cn } from "@auction/ui";
import { formatPostalAddressLines } from "@auction/validators";
import { Info } from "lucide-react";
import type { ReactNode } from "react";

type SaleLifecyclePick = Pick<Sale, "status" | "deliveryMode"> | null;

type TimelineRegistration = {
  buyerLegalEntityId: string;
  status: string;
};

type TimelineEntity = {
  id: string;
  displayName: string;
  memberRole: string;
};

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
  showPreviewRibbon?: boolean;
  serverClockMs?: number;
  sessionHeader: AuctionSessionHeaderVM;
  queueCurrent: LotQueueCardVM;
  queueUpNext: LotQueueCardVM | null;
  queueRest: LotQueueCardVM[];
  isSaleQueueLoading?: boolean;
  saleForLifecycle: SaleLifecyclePick;
  overview: SaleOverviewVM;
  kycApproved?: boolean;
  myRegistrations?: TimelineRegistration[];
  buyerEntities?: TimelineEntity[];
  mobile?: string | null;
  mobileDisplay?: string | null;
  telephoneBooking?: TelephoneBookingSnapshot | null;
  orgModuleEnabled?: boolean;
  loginNextPath?: string;
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
  kycApproved = false,
  myRegistrations = [],
  buyerEntities = [],
  mobile = null,
  mobileDisplay,
  telephoneBooking = null,
  orgModuleEnabled = true,
  loginNextPath = "",
}: Props) {
  const streamPosterUrl = auction.images[0] ?? sale.coverImages[0] ?? null;
  const locationLine = locationOneLine(sale);
  const showQueue = shouldShowLotQueueSidebar(queueUpNext, queueRest, isSaleQueueLoading);

  const participationCtx: OnsiteParticipationContext = {
    saleTitle: sale.title,
    lotNumber: auction.lotNumber,
    lotTitle: auction.title,
    lotUrl: shareUrl,
  };

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
              {...(serverClockMs !== undefined ? { serverClockMs } : {})}
            />
          </div>
        </div>

        <div className="mt-8 rounded-2xl border border-amber-500/10 bg-amber-500/[0.04] p-5 flex items-start gap-3.5">
          <div className="rounded-full bg-amber-500/10 p-1.5 text-amber-600 dark:text-amber-400">
            <Info className="size-5 shrink-0" />
          </div>
          <div>
            <h3 className="font-body text-sm font-semibold text-amber-900 dark:text-amber-400">
              In-Person Saleroom Event
            </h3>
            <p className="mt-1 font-body text-xs leading-relaxed text-amber-800/80 dark:text-amber-400/80">
              {getOnsiteNoWebBiddingNote()}
            </p>
          </div>
        </div>

        <div className="mt-12 grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,320px)] lg:items-start">
          <div className="order-2 space-y-10 lg:order-1">
            <SaleParticipationTimeline
              deliveryMode="onsite"
              isAuthenticated={isAuthenticated}
              kycApproved={kycApproved}
              myRegistrations={myRegistrations}
              buyerEntities={buyerEntities}
              previewStartTime={sale.previewStartTime}
              startTime={sale.startTime}
              endTime={sale.endTime}
              streamUrl={sale.streamUrl}
              absenteeAnchorId="bid-onsite-hub"
              telephoneAnchorId="bid-onsite-hub"
              liveStreamAnchorId="live-stream"
              {...(loginNextPath ? { registerReturnPath: loginNextPath } : {})}
              className="rounded-3xl border border-outline-variant/20 bg-surface-container-lowest p-6 shadow-sm dark:bg-surface-container-low/40 sm:p-8"
            />

            <OnsiteParticipationHub
              sale={sale}
              participationCtx={participationCtx}
              lotId={auction.id}
              loginNextPath={loginNextPath || shareUrl}
              isAuthenticated={isAuthenticated}
              kycApproved={kycApproved}
              mobile={mobile}
              {...(mobileDisplay ? { mobileDisplay } : {})}
              buyerEntities={buyerEntities}
              telephoneBooking={telephoneBooking}
              orgModuleEnabled={orgModuleEnabled}
            />

            <OnsitePlanVisitSection
              sale={sale}
              auction={auction}
              overview={overview}
              locationLine={locationLine}
            />

            <div className="mx-auto w-full max-w-[900px]">
              <LotMarketingAccordion blocks={marketingAccordionBlocks} variant="artworkCenter" />
            </div>

            <OnsiteStreamSection sale={sale} streamPosterUrl={streamPosterUrl} />
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
