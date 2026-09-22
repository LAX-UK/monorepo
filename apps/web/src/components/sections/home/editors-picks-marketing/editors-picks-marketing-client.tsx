"use client";

import { MarketingCardReveal } from "@/components/marketing/marketing-reveal";
import { MarketingSectionHeader } from "@/components/marketing/marketing-section-header";
import { MarketingViewAllLink } from "@/components/marketing/marketing-view-all-link";
import type { EditorsPickLotCardVM } from "@/components/sections/home/home-view-models";
import { MARKETING_PAGE_SHELL } from "@/lib/marketing/chrome";
import { MarketingHorizontalRail } from "@auction/marketing-ui";
import { DisplayHeading } from "@auction/ui";
import { EditorsPickMarketingCard } from "./editors-pick-marketing-card";

const VIEW_ALL_HREF = "/search";

type Props = {
  lots: EditorsPickLotCardVM[];
  isAuthenticated: boolean;
  watchedLotIds: readonly string[];
  loginNextPath?: string;
};

type CarouselProps = {
  lots: EditorsPickLotCardVM[];
  isAuthenticated: boolean;
  watchedLotIds: readonly string[];
  loginNextPath: string;
};

/** Scroll strip + overflow affordances; remounted when `lots` identity changes (parent key). */
function EditorsPicksCarousel({
  lots,
  isAuthenticated,
  watchedLotIds,
  loginNextPath,
}: CarouselProps) {
  return (
    <MarketingHorizontalRail
      id="home-editors-picks-rail"
      ariaLabel="Editor's picks"
      forwardAriaLabel="Scroll to see more editor's picks"
      forwardButtonClassName="top-[170px]"
      scrollerAs="ul"
      scrollerClassName="m-0 flex list-none snap-x snap-mandatory gap-6 overflow-x-auto p-0 pb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      {lots.map((lot, index) => (
        <li
          key={lot.id}
          className="flex w-[min(100vw-4rem,280px)] shrink-0 snap-start flex-col sm:w-[280px]"
        >
          <MarketingCardReveal index={index} className="h-full min-w-0">
            <EditorsPickMarketingCard
              lot={lot}
              isAuthenticated={isAuthenticated}
              watchedLotIds={watchedLotIds}
              loginNextPath={loginNextPath}
            />
          </MarketingCardReveal>
        </li>
      ))}
    </MarketingHorizontalRail>
  );
}

export function EditorsPicksMarketingClient({
  lots,
  isAuthenticated,
  watchedLotIds,
  loginNextPath = "/",
}: Props) {
  const stripKey = lots.map((l) => l.id).join(",");

  return (
    <section
      className={`${MARKETING_PAGE_SHELL} pb-0 pt-[var(--section-spacing-tight)]`}
      aria-labelledby="home-editors-picks-heading"
    >
      <div className="mx-auto flex max-w-[var(--container-inner,1376px)] flex-col gap-12">
        <MarketingSectionHeader
          heading={
            <DisplayHeading
              as="h2"
              id="home-editors-picks-heading"
              size="section"
              className="font-semibold text-on-surface"
            >
              Editor&apos;s Picks
            </DisplayHeading>
          }
          subtitle="Hand-selected pieces by LAX specialists"
          action={<MarketingViewAllLink href={VIEW_ALL_HREF} srSuffix="lots and catalogue" />}
        />

        <EditorsPicksCarousel
          key={stripKey}
          lots={lots}
          isAuthenticated={isAuthenticated}
          watchedLotIds={watchedLotIds}
          loginNextPath={loginNextPath}
        />
      </div>
    </section>
  );
}
