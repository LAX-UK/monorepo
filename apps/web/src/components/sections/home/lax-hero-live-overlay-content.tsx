"use client";

import type { HeroStateVM } from "@/components/sections/home/home-view-models";
import { LiveIndicatorRow } from "@/components/sections/home/live-indicator";
import { OverlayToneText } from "@/components/ui/overlay-tone-text";
import { HOME_HERO_CONTENT_PT, HOME_HERO_MIN_H } from "@/lib/marketing/home-hero-layout";
import { LiveDot } from "@auction/ui";
import { cn } from "@auction/ui";
import { Button } from "@auction/ui/components/button";
import Link from "next/link";

type LiveVm = Extract<HeroStateVM, { kind: "live" }>;

export function LaxHeroLiveOverlayContent({
  vm,
  watchOnYoutubeHref,
}: {
  vm: LiveVm;
  watchOnYoutubeHref?: string | undefined;
}) {
  return (
    <div
      className={cn(
        "relative z-[2] mx-auto flex w-full max-w-[var(--container-max,1440px)] flex-col px-6 pb-16 md:px-10 md:pb-20 lg:px-10",
        HOME_HERO_MIN_H,
        HOME_HERO_CONTENT_PT,
      )}
    >
      <div className="relative mt-auto flex max-w-[684px] flex-col gap-8 md:gap-14">
        <div className="flex flex-col gap-6">
          <LiveIndicatorRow
            tone="white"
            progressLabel="Live saleroom"
            saleLine={vm.saleTitle}
            announceUpdates
          />
          <OverlayToneText className="font-label text-base font-medium leading-6 tracking-normal">
            {vm.modeLabel}
          </OverlayToneText>
          <OverlayToneText
            as="h1"
            variant="display"
            className="font-headline text-4xl font-medium uppercase leading-[120%] tracking-tight md:text-[60px] md:leading-[72px]"
          >
            Live · {vm.saleTitle}
          </OverlayToneText>
        </div>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <Button variant="liveJoin" size="xl" className="min-h-[44px] w-fit" asChild>
            <Link href={vm.saleroomHref} className="inline-flex items-center justify-center gap-2">
              <LiveDot className="h-5 w-5" />
              Open saleroom
            </Link>
          </Button>
          {watchOnYoutubeHref ? (
            <Button variant="secondary" size="xl" className="min-h-[44px] w-fit" asChild>
              <a href={watchOnYoutubeHref} target="_blank" rel="noreferrer noopener">
                Watch on YouTube<span className="sr-only"> (opens in new tab)</span>
              </a>
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
