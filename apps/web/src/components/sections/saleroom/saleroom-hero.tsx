import { ImagePlaceholder } from "@/components/ui/image-placeholder";
import { TINY_IMAGE_BLUR } from "@/lib/image-blur";
import { LiveDot } from "@auction/ui";
import { Button } from "@auction/ui/components/button";
import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import type { SaleHeroVM } from "./view-models";

type Props = {
  hero: SaleHeroVM;
  toolbar: ReactNode;
  actions: ReactNode;
};

export function SaleroomHero({ hero, toolbar, actions }: Props) {
  const statusLabel = hero.isLive ? "Auction in progress" : (hero.statusBadge?.label ?? "Auction");
  const liveTrailing =
    hero.isLive && typeof hero.liveLotsCount === "number" && hero.liveLotsCount > 0
      ? `· ${hero.liveLotsCount} lots live`
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
    <section className="relative min-h-[min(60vh,520px)] w-full overflow-hidden bg-brand-900">
      <div className="absolute inset-0 bg-brand-900" aria-hidden>
        {hero.coverImage ? (
          <Image
            src={hero.coverImage}
            alt=""
            fill
            priority
            placeholder="blur"
            blurDataURL={TINY_IMAGE_BLUR}
            className="object-cover opacity-80"
            sizes="100vw"
          />
        ) : (
          <ImagePlaceholder tone="dark" label="Auction cover" hideIcon />
        )}
        <div className="absolute inset-0 opacity-20 [background-image:repeating-linear-gradient(30deg,transparent_0,transparent_23px,rgba(255,255,255,0.35)_24px)]" />
      </div>
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(to right, rgba(5,5,5,.85) 0%, rgba(5,5,5,.5) 55%, transparent 100%)",
        }}
        aria-hidden
      />
      <div className="relative z-[1] mx-auto flex min-h-[min(60vh,520px)] max-w-[1440px] flex-col justify-end px-6 pb-12 pt-[calc(var(--header-height)+2rem)] md:px-10 md:pb-14 lg:px-12">
        <div className="max-w-[760px]">
          <div className="fade-up mb-4 flex flex-wrap items-center gap-2 font-label text-[10px] font-bold uppercase tracking-[0.22em] text-white/55">
            {hero.isLive ? <LiveDot className="live-dot-pulse h-2 w-2" /> : null}
            <span>{statusLabel}</span>
            <span className="text-white/35">{liveTrailing}</span>
          </div>
          <h1 className="wipe-in mb-4 font-headline text-4xl font-semibold leading-tight text-white md:text-5xl">
            {hero.title}
          </h1>
          <p className="fade-up-d2 mb-7 flex flex-wrap gap-x-5 gap-y-2 font-body text-sm text-white/60">
            <span>{hero.dateLine}</span>
            {hero.registrationClosesLabel ? <span>{hero.registrationClosesLabel}</span> : null}
          </p>
          <div className="fade-up-d3 flex flex-wrap gap-3">
            <Button variant="cta" size="lg" asChild>
              <Link href="/register">Register to Bid →</Link>
            </Button>
            {actions}
          </div>
          <dl className="fade-up-d4 mt-7 flex flex-wrap gap-8 md:gap-10">
            {stats.map(([label, value]) => (
              <div key={label}>
                <dt className="mb-1 font-label text-[10px] font-bold uppercase tracking-[0.16em] text-white/40">
                  {label}
                </dt>
                <dd className="font-headline text-xl font-semibold text-white">{value}</dd>
              </div>
            ))}
          </dl>
        </div>
        <div className="mt-8 flex w-full justify-start lg:absolute lg:right-12 lg:top-[calc(var(--header-height)+2rem)] lg:mt-0 lg:w-auto">
          {toolbar}
        </div>
      </div>
    </section>
  );
}
