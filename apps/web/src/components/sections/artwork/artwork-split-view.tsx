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
import { LotSaleContext } from "@/components/sections/artwork/redesign/lot-sale-context";
import { LotStatusRow } from "@/components/sections/artwork/redesign/lot-status-row";
import type { Lot } from "@auction/types";
import type { ReactNode } from "react";

export type ArtworkSaleContextVM = {
  backHref: string;
  title: string;
  lotCount: number;
  closesLabel: string;
};

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
  /** Parent sale (when the lot is in a sale). Renders a bar above the two-column grid. */
  saleContext?: ArtworkSaleContextVM | null;
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
  saleContext = null,
}: Props) {
  return (
    <section aria-labelledby="lot-heading" className="bg-page-bg dark:bg-background">
      <div className="mx-auto max-w-[var(--container-max,1440px)] px-4 pb-20 pt-6 sm:px-6 md:px-8">
        <div className="flex min-h-10 flex-wrap items-center justify-between gap-3">
          <LotBreadcrumbTabs vm={heroVM} />
          <LotNavArrows vm={heroVM} />
        </div>

        <div className="mt-3">
          <LotStatusRow
            isLive={auction.status === "active"}
            bidCount={0}
            saleHref={heroVM.saleHref}
            saleTitle={heroVM.saleTitle}
          />
        </div>

        {saleContext ? (
          <div className="mt-4">
            <LotSaleContext
              backHref={saleContext.backHref}
              title={saleContext.title}
              lotCount={saleContext.lotCount}
              closesLabel={saleContext.closesLabel}
            />
          </div>
        ) : null}

        <div className="mt-6 grid w-full grid-cols-1 items-start gap-8 lg:mt-10 lg:grid-cols-[minmax(0,1fr)_480px] lg:gap-10">
          <div className="flex w-full min-w-0 flex-col gap-6 lg:sticky lg:top-[var(--header-height)] lg:h-[calc(100vh_-_var(--header-height))] lg:items-center lg:justify-center lg:overflow-hidden lg:bg-surface-container-low lg:p-8">
            <LotMediaBlock lot={auction} />
          </div>

          <div className="w-full min-w-0 pb-24 lg:px-2">
            <LotRightSummary seed={summarySeed}>{bidPanel}</LotRightSummary>
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
            <div className="mt-8">
              <LotMarketingAccordion blocks={marketingAccordionBlocks} />
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
