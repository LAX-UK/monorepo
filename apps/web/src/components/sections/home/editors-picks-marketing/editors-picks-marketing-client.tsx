"use client";

import { MarketingCardReveal } from "@/components/marketing/marketing-reveal";
import { MarketingSectionHeader } from "@/components/marketing/marketing-section-header";
import { MarketingViewAllLink } from "@/components/marketing/marketing-view-all-link";
import type { EditorsPickLotCardVM } from "@/components/sections/home/home-view-models";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import { MARKETING_PAGE_SHELL } from "@/lib/marketing/chrome";
import { DisplayHeading } from "@auction/ui";
import { Button } from "@auction/ui/components/button";
import { ChevronRight } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
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
  const scrollerRef = useRef<HTMLUListElement>(null);
  const reduceMotion = useReducedMotion();
  const [canScrollEnd, setCanScrollEnd] = useState(false);

  const updateScrollHint = useCallback(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const { scrollLeft, scrollWidth, clientWidth } = el;
    const maxScroll = scrollWidth - clientWidth;
    setCanScrollEnd(maxScroll > 4 && scrollLeft < maxScroll - 4);
  }, []);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    updateScrollHint();
    const ro = new ResizeObserver(() => updateScrollHint());
    ro.observe(el);
    el.addEventListener("scroll", updateScrollHint, { passive: true });
    return () => {
      ro.disconnect();
      el.removeEventListener("scroll", updateScrollHint);
    };
  }, [updateScrollHint]);

  function scrollForward() {
    const el = scrollerRef.current;
    if (!el) return;
    const delta = Math.round(el.clientWidth * 0.75);
    el.scrollBy({ left: delta, behavior: reduceMotion ? "auto" : "smooth" });
  }

  return (
    <div className="relative">
      <ul
        ref={scrollerRef}
        className="m-0 flex list-none snap-x snap-mandatory gap-6 overflow-x-auto p-0 pb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
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
      </ul>
      {canScrollEnd ? (
        <div className="pointer-events-none absolute inset-y-0 right-0 z-[1] hidden w-16 bg-gradient-to-l from-page-bg via-page-bg/90 to-transparent sm:block" />
      ) : null}
      {canScrollEnd ? (
        <Button
          type="button"
          variant="ghost"
          onClick={scrollForward}
          className="pointer-events-auto absolute right-0 top-[170px] z-[2] hidden size-11 -translate-y-1/2 items-center justify-center rounded-full border border-outline-variant bg-surface text-on-surface shadow-sm outline-offset-2 hover:bg-surface-container-low focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring sm:flex dark:bg-surface-container-low dark:hover:bg-surface-container"
          aria-label="Scroll to see more editor's picks"
        >
          <ChevronRight className="size-5 shrink-0" aria-hidden />
        </Button>
      ) : null}
    </div>
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
