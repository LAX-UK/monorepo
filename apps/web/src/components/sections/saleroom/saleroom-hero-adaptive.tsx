"use client";

import { MarketingMobileBackLink } from "@/components/marketing/marketing-mobile-back-link";
import { SaleTypeBadge } from "@/components/marketing/sale-type-badge";
import { AdaptiveFrameImage } from "@/components/ui/adaptive-frame-image";
import {
  AdaptiveMediaFrame,
  AdaptiveMediaFrameContainer,
} from "@/components/ui/adaptive-media-frame";
import { HeroHorizontalScrim } from "@/components/ui/hero-tone-scrim";
import { useOverlayTone } from "@/components/ui/overlay-tone-context";
import { OverlayToneText } from "@/components/ui/overlay-tone-text";
import { HERO_IMMERSIVE_SLOTS } from "@/lib/media/overlay-slot-presets";
import { saleAllowsWebBidding } from "@/lib/sale-mode";
import { overlayPillClasses } from "@/lib/ui/overlay-tone-classes";
import { Countdown, LiveDot } from "@auction/ui";
import { Button } from "@auction/ui/components/button";
import Link from "next/link";
import type { ReactNode } from "react";
import type { SaleHeroVM } from "./view-models";

type Props = {
  hero: SaleHeroVM;
  toolbar: ReactNode;
  actions: ReactNode;
  isAuthenticated?: boolean;
  /** Mobile-only link back to the sales calendar. */
  backHref?: string;
  backLabel?: string;
  deliveryMode?: "online" | "onsite";
  streamUrl?: string | null;
};

function SaleroomHeroPrimaryCta({
  hero,
  isAuthenticated,
  deliveryMode,
  streamUrl,
}: {
  hero: SaleHeroVM;
  isAuthenticated: boolean;
  deliveryMode: "online" | "onsite";
  streamUrl: string | null;
}) {
  if (!saleAllowsWebBidding(deliveryMode)) {
    if (hero.isLive && streamUrl) {
      return (
        <Button variant="cta" size="lg" className="gap-2" asChild>
          <a href={streamUrl} target="_blank" rel="noopener noreferrer">
            <LiveDot className="live-dot-pulse h-2 w-2" />
            Watch live stream
          </a>
        </Button>
      );
    }
    if (hero.status === "scheduled" || hero.status === "draft") {
      return (
        <Button variant="cta" size="lg" asChild>
          <Link href="#plan-visit">Plan your visit →</Link>
        </Button>
      );
    }
    return (
      <Button variant="cta" size="lg" asChild>
        <Link href="#catalog">{isAuthenticated ? "Browse Lots →" : "View catalogue →"}</Link>
      </Button>
    );
  }

  if (isAuthenticated) {
    return (
      <Button variant="cta" size="lg" asChild>
        <Link href="#catalog">Browse Lots →</Link>
      </Button>
    );
  }

  return (
    <Button variant="cta" size="lg" asChild>
      <Link href="/register">Register to Bid →</Link>
    </Button>
  );
}

export function SaleroomHeroAdaptive({
  hero,
  toolbar,
  actions,
  isAuthenticated = false,
  backHref,
  backLabel = "Back to calendar",
  deliveryMode = "online",
  streamUrl = null,
}: Props) {
  const toneResult = useOverlayTone("contentBlock");
  const badgeOverlayClasses = overlayPillClasses(
    toneResult,
    "hover:bg-[color:var(--overlay-border)]",
  );

  const statusLabel = hero.isLive ? "Auction in progress" : (hero.statusBadge?.label ?? "Auction");
  const liveTrailing =
    hero.isLive && typeof hero.liveLotsCount === "number" && hero.liveLotsCount > 0
      ? hero.liveLotsCount === 1
        ? "· 1 lot live"
        : `· ${hero.liveLotsCount} lots live`
      : `· ${hero.itemsLabel}`;
  const thirdStat: readonly [string, string] = hero.estimatedTotalLabel
    ? (["Est. Total", hero.estimatedTotalLabel] as const)
    : (["Format", hero.overviewMetaLine ?? hero.dateLine] as const);
  const stats = [
    ["Total Lots", hero.itemsLabel],
    ["Live Now", hero.isLive ? "Live now" : (hero.biddingStartsShort ?? "Upcoming")],
    thirdStat,
  ] as const;

  return (
    <AdaptiveMediaFrame src={hero.coverImage} objectFit="cover" slots={HERO_IMMERSIVE_SLOTS}>
      <header className="relative min-h-[min(60vh,520px)] w-full overflow-hidden bg-brand-900">
        <AdaptiveMediaFrameContainer className="absolute inset-0 overflow-hidden">
          <div className="absolute inset-0 bg-brand-900" aria-hidden>
            <AdaptiveFrameImage
              src={hero.coverImage}
              alt=""
              objectFit="cover"
              label="Auction cover"
              priority
              sizes="100vw"
              className="size-full"
              imgClassName="opacity-80"
            />
            <div
              className="absolute inset-0 opacity-20 [background-image:repeating-linear-gradient(30deg,transparent_0,transparent_23px,rgba(255,255,255,0.35)_24px)]"
              aria-hidden
            />
          </div>
          <HeroHorizontalScrim />
        </AdaptiveMediaFrameContainer>

        <div className="relative z-[1] mx-auto flex min-h-[min(60vh,520px)] max-w-[var(--container-max,1440px)] flex-col px-8 pb-12 pt-[calc(var(--header-height)+2rem)] md:px-10 md:pb-14 lg:px-14">
          <div className="mt-auto max-w-[760px]" data-overlay-content-block>
            {backHref ? (
              <div className="fade-up mb-4 md:hidden">
                <MarketingMobileBackLink
                  href={backHref}
                  label={backLabel}
                  variant="overlay"
                  className="!block"
                />
              </div>
            ) : null}
            <div className="fade-up mb-4 flex flex-wrap items-center gap-2 font-label text-[length:var(--text-label-2)] font-bold uppercase tracking-[0.22em]">
              {hero.isLive ? <LiveDot className="live-dot-pulse h-2 w-2" /> : null}
              <OverlayToneText>{statusLabel}</OverlayToneText>
              <OverlayToneText variant="muted" className="opacity-60 mr-1">
                {liveTrailing}
              </OverlayToneText>
              <SaleTypeBadge
                deliveryMode={deliveryMode}
                size="sm"
                isLive={hero.isLive}
                withExplainer
                className={badgeOverlayClasses}
              />
            </div>
            <div className="mb-4">
              <OverlayToneText
                as="h1"
                variant="display"
                className="font-headline text-4xl md:text-5xl md:leading-tight"
              >
                {hero.title}
              </OverlayToneText>
            </div>
            <div className="fade-up-d2 mb-5 flex flex-wrap gap-x-5 gap-y-2 font-body text-sm">
              <OverlayToneText variant="muted">{hero.dateLine}</OverlayToneText>
              {hero.registrationClosesLabel ? (
                <OverlayToneText variant="muted">{hero.registrationClosesLabel}</OverlayToneText>
              ) : null}
            </div>
            {hero.status === "active" || hero.status === "scheduled" ? (
              <div className="fade-up-d2 mb-7 flex items-baseline gap-3">
                <OverlayToneText
                  as="span"
                  variant="muted"
                  className="font-label text-[length:var(--text-label-2)] font-bold uppercase tracking-[0.18em] opacity-70"
                >
                  {hero.status === "active" ? "Closes in" : "Opens in"}
                </OverlayToneText>
                <OverlayToneText as="span" variant="body">
                  <Countdown
                    end={new Date(hero.status === "active" ? hero.endTime : hero.startTime)}
                    announce
                    className="font-headline text-xl font-semibold tabular-nums md:text-2xl"
                  />
                </OverlayToneText>
              </div>
            ) : null}
            <div className="fade-up-d3 flex flex-wrap gap-3">
              <SaleroomHeroPrimaryCta
                hero={hero}
                isAuthenticated={isAuthenticated}
                deliveryMode={deliveryMode}
                streamUrl={streamUrl}
              />
              {actions}
            </div>
            <div className="fade-up-d4 mt-7">
              <dl className="flex flex-wrap gap-8 md:gap-10">
                {stats.map(([label, value]) => (
                  <div key={label}>
                    <OverlayToneText
                      as="dt"
                      variant="muted"
                      className="mb-1 font-label text-[length:var(--text-label-2)] font-bold uppercase tracking-[0.16em] opacity-60"
                    >
                      {label}
                    </OverlayToneText>
                    <OverlayToneText as="dd" className="font-headline text-xl font-semibold">
                      {value}
                    </OverlayToneText>
                  </div>
                ))}
              </dl>
            </div>
          </div>
          {toolbar ? (
            <div className="mt-8 flex w-full justify-start lg:absolute lg:right-12 lg:top-[calc(var(--header-height)+2rem)] lg:mt-0 lg:w-auto">
              {toolbar}
            </div>
          ) : null}
        </div>
      </header>
    </AdaptiveMediaFrame>
  );
}
