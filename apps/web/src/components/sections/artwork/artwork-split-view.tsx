import { ShareButton } from "@/components/marketing/share-button";
import type {
  AccordionBlock,
  LotHeroVM,
  LotRelatedRailVM,
  LotSummarySeedVM,
} from "@/components/sections/artwork/artwork-view-models";
import { LotActionsRow } from "@/components/sections/artwork/redesign/lot-actions-row";
import { LotBreadcrumbTabs } from "@/components/sections/artwork/redesign/lot-breadcrumb-tabs";
import { LotMarketingAccordion } from "@/components/sections/artwork/redesign/lot-marketing-accordion";
import { LotMediaBlock } from "@/components/sections/artwork/redesign/lot-media-block";
import { LotMoreFromRail } from "@/components/sections/artwork/redesign/lot-more-from-rail";
import { LotNavArrows } from "@/components/sections/artwork/redesign/lot-nav-arrows";
import { LotRightSummary } from "@/components/sections/artwork/redesign/lot-right-summary";
import type { Lot } from "@auction/types";
import type { ReactNode } from "react";

type Props = {
  auction: Lot;
  heroVM: LotHeroVM;
  summarySeed: LotSummarySeedVM;
  marketingAccordionBlocks: AccordionBlock[];
  rail: LotRelatedRailVM;
  bidPanel: ReactNode;
  followSlot: ReactNode;
  shareUrl: string;
  isAuthenticated: boolean;
  watchedLotIds: readonly string[];
  currentUserId?: string | null;
};

export function ArtworkSplitView({
  auction,
  heroVM,
  summarySeed,
  marketingAccordionBlocks,
  rail,
  bidPanel,
  followSlot,
  shareUrl,
  isAuthenticated,
  watchedLotIds,
  currentUserId = null,
}: Props) {
  return (
    <section aria-labelledby="lot-heading" className="bg-page-bg dark:bg-background">
      <div className="mx-auto max-w-[1440px] px-4 pb-20 pt-6 sm:px-6 md:px-8">
        <div className="flex min-h-10 flex-wrap items-center justify-between gap-3">
          <LotBreadcrumbTabs vm={heroVM} />
          <LotNavArrows vm={heroVM} />
        </div>

        <div className="mt-6 flex w-full flex-col items-start gap-8 lg:mt-10 lg:flex-row lg:gap-10">
          <div className="flex w-full min-w-0 max-w-[786px] flex-col gap-6 lg:gap-8">
            <LotMediaBlock lot={auction} />
            <LotMarketingAccordion blocks={marketingAccordionBlocks} />
          </div>

          <div className="w-full min-w-0 max-w-[550px] flex-1 pb-24">
            <LotRightSummary seed={summarySeed}>{bidPanel}</LotRightSummary>
            <div className="mt-6">
              <LotActionsRow
                followSlot={followSlot}
                shareSlot={
                  <ShareButton
                    url={shareUrl}
                    title={auction.title}
                    className="h-10 w-full min-h-10 border-[#474747] font-['DM_Sans',sans-serif] text-base font-semibold"
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
        />
      </div>
    </section>
  );
}
