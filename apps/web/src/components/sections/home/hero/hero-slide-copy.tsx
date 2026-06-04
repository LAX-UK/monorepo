"use client";

import type { HeroSaleSlideVM } from "@/components/sections/home/home-view-models";
import { OverlayToneText } from "@/components/ui/overlay-tone-text";
import { Countdown } from "@auction/ui";
import { Button } from "@auction/ui/components/button";
import Link from "next/link";

type Props = {
  slide: HeroSaleSlideVM;
  slideIndex: number;
  slideCount: number;
};

/** Resolve the hero countdown target: live sales count down to close, upcoming to open. */
function heroCountdown(slide: HeroSaleSlideVM): { label: string; target: Date } | null {
  if (slide.status === "active" && slide.endIso) {
    return { label: "Closes in", target: new Date(slide.endIso) };
  }
  if (slide.status === "scheduled" && slide.startIso) {
    const target = new Date(slide.startIso);
    if (target.getTime() > Date.now()) return { label: "Opens in", target };
  }
  return null;
}

/** Pure presentation for one hero saleroom slide (no carousel logic). */
export function HeroSlideCopy({ slide, slideIndex, slideCount }: Props) {
  const countdown = heroCountdown(slide);
  return (
    <div
      role="group"
      aria-roledescription="slide"
      aria-label={`${slideIndex + 1} of ${slideCount}`}
      className="m-0 flex min-w-0 max-w-[684px] flex-col gap-8 border-0 p-0 md:gap-14"
    >
      <div className="flex flex-col gap-6">
        <OverlayToneText className="font-label text-base font-medium leading-6 tracking-normal">
          {slide.modeBadge}
        </OverlayToneText>
        <OverlayToneText
          as="h1"
          variant="display"
          className="font-headline text-4xl font-medium uppercase leading-[120%] tracking-tight md:text-[60px] md:leading-[72px]"
        >
          {slide.title}
        </OverlayToneText>
        <OverlayToneText
          variant="muted"
          className="font-body text-sm font-semibold uppercase tracking-wide"
        >
          {slide.dateLabel}
        </OverlayToneText>
        {countdown ? (
          <div className="flex items-baseline gap-2">
            <OverlayToneText
              variant="muted"
              className="font-label text-xs font-bold uppercase tracking-[0.18em]"
            >
              {countdown.label}
            </OverlayToneText>
            <OverlayToneText className="font-headline text-lg font-semibold tabular-nums md:text-xl">
              <Countdown end={countdown.target} announce={false} />
            </OverlayToneText>
          </div>
        ) : null}
      </div>
      <Button variant="cta" size="xl" className="pointer-events-auto min-h-[44px] w-fit" asChild>
        <Link href={slide.href}>Open saleroom</Link>
      </Button>
      <p className="sr-only" aria-live="polite" aria-atomic="true">
        {slide.title}
      </p>
    </div>
  );
}
