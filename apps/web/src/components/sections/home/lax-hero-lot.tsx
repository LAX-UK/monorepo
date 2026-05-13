import { BuyersPremiumChip } from "@/components/marketing/buyers-premium-chip";
import { MagneticButton } from "@/components/marketing/magnetic-button";
import type { HeroLotVM } from "@/components/sections/home/home-view-models";
import { LiveIndicatorRow } from "@/components/sections/home/live-indicator";
import { MediaImage } from "@/components/ui/media-image";
import { RevealOnMount } from "@/components/ui/reveal";
import { Countdown, DisplayHeading, LabelCaps, LiveDot, StatTile } from "@auction/ui";
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
      <div className="relative mx-auto min-h-[min(100svh,520px)] w-full max-w-[var(--container-max,1440px)] md:min-h-[min(100svh,760px)]">
        <RevealOnMount
          className="zoom-bg absolute inset-0 overflow-hidden"
          innerClassName="absolute inset-0"
        >
          <MediaImage
            src={lot.heroImageUrl}
            alt={lot.imageAlt}
            label="Hero artwork"
            tone="dark"
            priority
            imgClassName="object-center"
            sizes="100vw"
          />
        </RevealOnMount>
        <div
          className="absolute inset-0 bg-gradient-to-r from-transparent via-transparent to-transparent"
          style={{
            backgroundImage:
              "linear-gradient(105deg, var(--color-scrim-hero-strong) 0%, var(--color-scrim-hero-soft) 45%, transparent 80%)",
          }}
          aria-hidden
        />
        <div
          className="absolute inset-x-0 bottom-0 h-[30%] bg-gradient-to-t from-black/50 to-transparent"
          aria-hidden
        />
        <div className="relative flex min-h-[min(100svh,520px)] flex-col justify-end px-6 pb-16 pt-32 md:min-h-[min(100svh,760px)] md:px-10 md:pb-20 lg:px-16">
          <div className="flex max-w-[660px] flex-col gap-9">
            <div className="flex flex-col gap-8">
              <div className="fade-up flex flex-col gap-6">
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
              <div className="fade-up-d2 flex flex-row flex-wrap gap-8 md:gap-12">
                <StatTile label={lot.priceLabel} value={lot.priceFormatted} tone="white" />
                <StatTile label="Current bid" value={lot.currentBidFormatted} tone="white" />
                <StatTile label="Bids" value={lot.bidCountDisplay} tone="white" />
                {lot.isAuctionLive && lot.endTime ? (
                  <div className="flex min-w-0 flex-col gap-2 border-l-2 border-accent-brand pl-4">
                    <span className="font-label text-[13px] font-medium uppercase leading-4 text-white/80">
                      Closes in
                    </span>
                    <Countdown
                      end={new Date(lot.endTime)}
                      variant="display"
                      className="font-headline text-2xl font-normal leading-none tracking-[-0.96px] text-white md:text-[28px]"
                    />
                  </div>
                ) : null}
              </div>
              <BuyersPremiumChip tone="dark" className="fade-up-d2" />
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
                  className="min-h-[44px] min-w-0 border-white/80 bg-transparent text-white shadow-none hover:bg-white/10 hover:text-white sm:min-w-[200px] dark:border-white/80"
                  asChild
                >
                  <Link
                    href={artworkHref}
                    className="inline-flex items-center justify-center gap-[11px]"
                  >
                    View lot
                    <ArrowRight className="!size-5 shrink-0 text-white" aria-hidden />
                  </Link>
                </Button>
              )}
            </div>
          </div>
          <div
            className="pointer-events-none absolute right-6 top-[calc(var(--header-height)+2.5rem)] hidden flex-col items-end gap-1 lg:flex"
            aria-hidden
          >
            <span className="font-label text-[10px] font-bold uppercase tracking-[0.2em] text-white/40">
              Lot
            </span>
            <span className="font-artists-serif text-[72px] font-light leading-none text-white/[0.08]">
              {lotWatermark}
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
