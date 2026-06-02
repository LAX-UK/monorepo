"use client";

import { BuyersPremiumChip } from "@/components/marketing/buyers-premium-chip";
import { MagneticButton } from "@/components/marketing/magnetic-button";
import { type HeroLotVM, heroLotCoverSources } from "@/components/sections/home/home-view-models";
import { LiveIndicatorRow } from "@/components/sections/home/live-indicator";
import { HeroAdaptiveShell } from "@/components/ui/hero-adaptive-shell";
import { HeroHorizontalScrim } from "@/components/ui/hero-tone-scrim";
import { OverlayToneText } from "@/components/ui/overlay-tone-text";
import { RevealOnMount } from "@/components/ui/reveal";
import { HOME_HERO_CONTENT_PT, HOME_HERO_MIN_H } from "@/lib/marketing/home-hero-layout";
import { Countdown, LiveDot } from "@auction/ui";
import { cn } from "@auction/ui";
import { Button } from "@auction/ui/components/button";
import { ArrowRight } from "lucide-react";
import Link from "next/link";

type Props = {
  lot: HeroLotVM;
};

export function LaxHeroLot({ lot }: Props) {
  const artworkHref = lot.href ?? "/sales";
  const liveCtaHref = lot.isAuctionLive && lot.saleroomHref ? lot.saleroomHref : artworkHref;
  const lotWatermark = lot.lotLabel.replace(/^lot\s*/i, "").trim() || "—";

  return (
    <section className="relative w-full overflow-hidden bg-brand-900">
      <div
        className={cn(
          "relative mx-auto w-full max-w-[var(--container-max,1440px)]",
          HOME_HERO_MIN_H,
        )}
      >
        <RevealOnMount className="absolute inset-0" innerClassName="absolute inset-0">
          <HeroAdaptiveShell
            cover={heroLotCoverSources(lot)}
            alt={lot.imageAlt}
            priority
            backdropScrim={
              <>
                <HeroHorizontalScrim />
                <div
                  className="absolute inset-x-0 bottom-0 h-[30%] bg-gradient-to-t from-black/50 to-transparent"
                  aria-hidden
                />
              </>
            }
          >
            <div
              className={cn(
                "relative flex flex-col justify-end px-6 pb-[max(4rem,env(safe-area-inset-bottom))] md:px-10 md:pb-[max(5rem,env(safe-area-inset-bottom))] lg:px-16",
                HOME_HERO_MIN_H,
                HOME_HERO_CONTENT_PT,
              )}
            >
              <div className="flex max-w-[660px] flex-col gap-9">
                <div className="flex flex-col gap-8">
                  <div className="fade-up flex flex-col gap-6">
                    <LiveIndicatorRow
                      tone="white"
                      progressLabel="Auction in progress"
                      saleLine={lot.saleMetaLine}
                      announceUpdates={lot.isAuctionLive}
                    />
                    <OverlayToneText className="font-label text-base font-medium leading-6 tracking-normal">
                      {lot.featuredHeading}
                    </OverlayToneText>
                  </div>
                  <div className="flex flex-col gap-3">
                    <OverlayToneText
                      as="h1"
                      variant="display"
                      className="font-headline text-4xl font-medium uppercase leading-[120%] tracking-tight md:text-[60px] md:leading-[72px]"
                    >
                      {lot.title}
                    </OverlayToneText>
                    <OverlayToneText
                      variant="muted"
                      className="font-body text-sm font-semibold uppercase leading-4 tracking-[1.8px]"
                    >
                      {lot.artistName}
                    </OverlayToneText>
                  </div>
                  <div className="fade-up-d2 flex flex-row flex-wrap gap-8 md:gap-12">
                    <HeroStat label={lot.priceLabel} value={lot.priceFormatted} />
                    <HeroStat label="Current bid" value={lot.currentBidFormatted} />
                    <HeroStat label="Bids" value={lot.bidCountDisplay} />
                    {lot.isAuctionLive && lot.endTime ? (
                      <div className="flex min-w-0 flex-col gap-2 border-l-2 border-accent-brand pl-4">
                        <OverlayToneText
                          variant="muted"
                          className="font-label text-[13px] font-medium uppercase leading-4"
                        >
                          Closes in
                        </OverlayToneText>
                        <Countdown
                          end={new Date(lot.endTime)}
                          variant="display"
                          className="font-headline text-2xl font-normal leading-none tracking-[-0.96px] text-[color:var(--overlay-fg)] md:text-[28px]"
                        />
                      </div>
                    ) : null}
                  </div>
                  <BuyersPremiumChip className="fade-up-d2" />
                </div>
                <div className="fade-up-d3 flex flex-col gap-4 sm:flex-row sm:items-start">
                  <MagneticButton strength={10}>
                    <Button
                      variant="cta"
                      size="xl"
                      className="min-h-[44px] min-w-0 sm:min-w-[218px]"
                      asChild
                    >
                      <Link
                        href="/register"
                        className="inline-flex items-center justify-center gap-[11px]"
                      >
                        Register to Bid
                        <ArrowRight className="!size-5 shrink-0 text-cta-on" aria-hidden />
                      </Link>
                    </Button>
                  </MagneticButton>
                  {lot.isAuctionLive ? (
                    <Button
                      variant="liveJoin"
                      size="xl"
                      className="min-h-[44px] min-w-0 sm:min-w-[200px]"
                      asChild
                    >
                      <Link
                        href={liveCtaHref}
                        className="inline-flex items-center justify-center gap-[11px]"
                      >
                        <LiveDot className="h-5 w-5" />
                        Join Live Stream
                      </Link>
                    </Button>
                  ) : (
                    <Button
                      variant="outline"
                      size="xl"
                      className="min-h-[44px] min-w-0 border-[color:var(--overlay-border)] bg-transparent text-[color:var(--overlay-fg)] shadow-none hover:bg-[color:var(--overlay-bg)] sm:min-w-[200px]"
                      asChild
                    >
                      <Link
                        href={artworkHref}
                        className="inline-flex items-center justify-center gap-[11px]"
                      >
                        View lot
                        <ArrowRight className="!size-5 shrink-0" aria-hidden />
                      </Link>
                    </Button>
                  )}
                </div>
              </div>
              <div
                className="pointer-events-none absolute right-6 top-[calc(var(--header-height)+2.5rem)] hidden flex-col items-end gap-1 lg:flex"
                aria-hidden
              >
                <OverlayToneText
                  variant="muted"
                  className="font-label text-[10px] font-bold uppercase tracking-[0.2em] opacity-60"
                >
                  Lot
                </OverlayToneText>
                <OverlayToneText className="font-artists-serif text-[72px] font-light leading-none opacity-10">
                  {lotWatermark}
                </OverlayToneText>
              </div>
            </div>
          </HeroAdaptiveShell>
        </RevealOnMount>
      </div>
    </section>
  );
}

function HeroStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <OverlayToneText variant="muted" className="font-label text-[13px] font-medium uppercase">
        {label}
      </OverlayToneText>
      <OverlayToneText className="font-headline text-2xl font-normal leading-none tracking-[-0.96px] md:text-[28px]">
        {value}
      </OverlayToneText>
    </div>
  );
}
