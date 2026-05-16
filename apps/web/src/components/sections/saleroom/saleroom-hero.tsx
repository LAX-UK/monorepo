import { MarketingPageHero } from "@/components/marketing/marketing-page-hero";
import { MediaImage } from "@/components/ui/media-image";
import { LiveDot } from "@auction/ui";
import { Button } from "@auction/ui/components/button";
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

  const backdrop = (
    <>
      <div className="absolute inset-0 bg-brand-900" aria-hidden>
        <MediaImage
          src={hero.coverImage}
          alt=""
          label="Auction cover"
          tone="dark"
          priority
          imgClassName="opacity-80"
          sizes="100vw"
        />
        <div
          className="absolute inset-0 opacity-20 [background-image:repeating-linear-gradient(30deg,transparent_0,transparent_23px,rgba(255,255,255,0.35)_24px)]"
          aria-hidden
        />
      </div>
    </>
  );

  const statsNode = (
    <dl className="flex flex-wrap gap-8 md:gap-10">
      {stats.map(([label, value]) => (
        <div key={label}>
          <dt className="mb-1 font-label text-[length:var(--text-label-2)] font-bold uppercase tracking-[0.16em] text-white/40">
            {label}
          </dt>
          <dd className="font-headline text-xl font-semibold text-white">{value}</dd>
        </div>
      ))}
    </dl>
  );

  return (
    <MarketingPageHero
      variant="immersive"
      className="bg-brand-900"
      backdrop={backdrop}
      toolbar={toolbar}
      eyebrow={
        <>
          {hero.isLive ? <LiveDot className="live-dot-pulse h-2 w-2" /> : null}
          <span>{statusLabel}</span>
          <span className="text-white/35">{liveTrailing}</span>
        </>
      }
      title={hero.title}
      titleAs="h1"
      meta={
        <>
          <span>{hero.dateLine}</span>
          {hero.registrationClosesLabel ? <span>{hero.registrationClosesLabel}</span> : null}
        </>
      }
      actions={
        <>
          <Button variant="cta" size="lg" asChild>
            <Link href="/register">Register to Bid →</Link>
          </Button>
          {actions}
        </>
      }
      stats={statsNode}
    />
  );
}
