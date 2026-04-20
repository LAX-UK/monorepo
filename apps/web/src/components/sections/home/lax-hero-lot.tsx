import type { HeroLotVM } from "@/components/sections/home/home-view-models";
import { LiveIndicatorRow } from "@/components/sections/home/live-indicator";
import { DisplayHeading, LabelCaps, LiveDot, StatTile } from "@auction/ui";
import { Button } from "@auction/ui/components/button";
import { ArrowRight } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

type Props = {
  lot: HeroLotVM;
};

export function LaxHeroLot({ lot }: Props) {
  const artworkHref = lot.id === "placeholder" ? "/sales" : `/artwork/${lot.id}`;

  return (
    <section className="relative w-full bg-hero-cream dark:bg-surface-container-low">
      <div className="relative mx-auto min-h-[min(100svh,520px)] w-full max-w-[var(--container-max,1440px)] md:min-h-[min(100svh,760px)]">
        <Image
          src={lot.heroImageUrl}
          alt={lot.imageAlt}
          fill
          priority
          fetchPriority="high"
          className="object-cover object-center"
          sizes="100vw"
        />
        <div
          className="absolute inset-0 bg-gradient-to-r from-transparent via-transparent to-transparent"
          style={{
            backgroundImage:
              "linear-gradient(to right, var(--color-scrim-hero), var(--color-scrim-hero-mid), transparent)",
          }}
          aria-hidden
        />
        <div className="relative flex min-h-[min(100svh,520px)] flex-col justify-end px-6 pb-16 pt-32 md:min-h-[min(100svh,760px)] md:px-10 md:pb-20 lg:px-10">
          <div className="flex max-w-[684px] flex-col gap-8 md:gap-14">
            <div className="flex flex-col gap-8">
              <div className="flex flex-col gap-6">
                <LiveIndicatorRow
                  tone="white"
                  progressLabel="Auction in progress"
                  saleLine={lot.saleMetaLine}
                  announceUpdates={lot.isAuctionLive}
                />
                <LabelCaps className="text-base font-medium leading-6 tracking-normal text-white">
                  {lot.featuredHeading}
                </LabelCaps>
              </div>
              <div className="flex flex-col gap-3">
                <DisplayHeading
                  as="h1"
                  className="text-4xl font-medium uppercase leading-[120%] tracking-tight text-white md:text-[60px] md:leading-[72px]"
                >
                  {lot.title}
                </DisplayHeading>
                <span className="font-body text-sm font-semibold uppercase leading-4 tracking-[1.8px] text-white/90">
                  {lot.artistName}
                </span>
              </div>
              <div className="flex flex-row flex-wrap gap-8">
                <StatTile label={lot.priceLabel} value={lot.priceFormatted} tone="white" />
                <StatTile label="Current Highest Bid" value={lot.currentBidFormatted} tone="white" />
                <StatTile label="Bids" value={lot.bidCountDisplay} tone="white" />
              </div>
            </div>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
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
              <Button
                variant="liveJoin"
                size="xl"
                className="min-h-[44px] min-w-0 sm:min-w-[200px]"
                asChild
              >
                <Link
                  href={artworkHref}
                  className="inline-flex items-center justify-center gap-[11px]"
                >
                  <LiveDot className="h-5 w-5" />
                  Join Live Stream
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
