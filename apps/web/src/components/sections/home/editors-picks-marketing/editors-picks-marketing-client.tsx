"use client";

import type { EditorsPickLotCardVM } from "@/components/sections/home/home-view-models";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import { DisplayHeading } from "@auction/ui";
import { Button } from "@auction/ui/components/button";
import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { EditorsPickMarketingCard } from "./editors-pick-marketing-card";

const VIEW_ALL_HREF = "/search";

type Props = {
  lots: EditorsPickLotCardVM[];
};

type CarouselProps = {
  lots: EditorsPickLotCardVM[];
};

/** Scroll strip + overflow affordances; remounted when `lots` identity changes (parent key). */
function EditorsPicksCarousel({ lots }: CarouselProps) {
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
          <li key={lot.id} className="w-[min(100vw-4rem,280px)] shrink-0 snap-start sm:w-[280px]">
            <EditorsPickMarketingCard lot={lot} index={index} />
          </li>
        ))}
      </ul>
      {canScrollEnd ? (
        <div className="pointer-events-none absolute inset-y-0 right-0 z-[1] hidden w-16 bg-gradient-to-l from-page-bg via-page-bg/90 to-transparent sm:block" />
      ) : null}
      {canScrollEnd ? (
        <button
          type="button"
          onClick={scrollForward}
          className="pointer-events-auto absolute right-0 top-[170px] z-[2] hidden size-10 -translate-y-1/2 items-center justify-center rounded-full border border-[#D1D1D1] bg-white text-[#050505] shadow-sm outline-offset-2 hover:bg-neutral-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary sm:flex dark:border-outline dark:bg-surface-container-low dark:text-on-surface dark:hover:bg-surface-container"
          aria-label="Scroll to see more editor's picks"
        >
          <ChevronRight className="size-5 shrink-0" aria-hidden />
        </button>
      ) : null}
    </div>
  );
}

export function EditorsPicksMarketingClient({ lots }: Props) {
  const stripKey = lots.map((l) => l.id).join(",");

  return (
    <section
      className="mx-auto w-full max-w-[var(--container-max,1440px)] px-8 pb-0 pt-10 md:px-10 lg:px-14"
      aria-labelledby="home-editors-picks-heading"
    >
      <div className="mx-auto flex max-w-[var(--container-inner,1376px)] flex-col gap-12">
        <div className="flex w-full flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex max-w-[720px] flex-col gap-2">
            <DisplayHeading
              as="h2"
              id="home-editors-picks-heading"
              className="text-[40px] font-semibold leading-[60px] text-[#050505] dark:text-on-surface"
            >
              Editor&apos;s Picks
            </DisplayHeading>
            <p className="font-headline text-2xl font-normal leading-9 text-[#757575] dark:text-on-surface-variant">
              Hand-selected pieces by LAX specialists
            </p>
          </div>
          <Button
            variant="chevron"
            asChild
            className="h-auto shrink-0 border-0 bg-transparent p-0 shadow-none hover:bg-transparent dark:hover:bg-transparent"
          >
            <Link
              href={VIEW_ALL_HREF}
              className="inline-flex items-center gap-[11px] py-[18px] font-headline text-base font-semibold leading-6 tracking-[0.05em] text-[#050505] dark:text-on-surface"
            >
              View All
              <span className="sr-only"> lots and catalogue</span>
              <ChevronRight className="size-5 shrink-0" aria-hidden />
            </Link>
          </Button>
        </div>

        <EditorsPicksCarousel key={stripKey} lots={lots} />
      </div>
    </section>
  );
}
