import type { HeroLotVM } from "@/components/sections/home/home-view-models";
import { LiveIndicatorRow } from "@/components/sections/home/live-indicator";
import { MaterialIcon } from "@/components/ui/material-icon";
import Image from "next/image";
import Link from "next/link";

const HERO_FALLBACK_IMG =
  "https://images.unsplash.com/photo-1579783902614-a3fb3927b6a5?auto=format&fit=crop&w=1920&q=80";

type Props = {
  lot: HeroLotVM | null;
};

export function LaxHero({ lot }: Props) {
  const img = lot?.heroImageUrl ?? HERO_FALLBACK_IMG;
  const title = lot?.title ?? "Ethereal Form (1928)";
  const artist = lot?.artistName ?? "Jean-Michel Basquiat";
  const saleLine = lot?.saleMetaLine ?? "Evening Sale · Spring 2025";
  const featuredHeading = lot?.featuredHeading ?? "FEATURED LOT";
  const estimate = lot?.estimateFormatted ?? "—";
  const bid = lot?.currentBidFormatted ?? "—";
  const bids = lot?.bidCountDisplay ?? "—";
  const artworkHref = lot ? `/artwork/${lot.id}` : "/sales";

  return (
    <section className="relative w-full bg-hero-cream">
      <div className="relative mx-auto min-h-[520px] w-full max-w-[1440px] md:min-h-[760px]">
        <Image
          src={img}
          alt=""
          fill
          priority
          className="object-cover object-center"
          sizes="100vw"
        />
        <div
          className="absolute inset-0 bg-gradient-to-r from-[rgba(10,10,10,0.5)] via-[rgba(10,10,10,0.4)] to-transparent"
          aria-hidden
        />
        <div className="relative flex min-h-[520px] flex-col justify-end px-6 pb-16 pt-32 md:min-h-[760px] md:px-10 md:pb-20 lg:px-10">
          <div className="flex max-w-[684px] flex-col gap-8 md:gap-14">
            <div className="flex flex-col gap-8">
              <div className="flex flex-col gap-6">
                <LiveIndicatorRow
                  tone="dark"
                  progressLabel="Auction in progress"
                  saleLine={saleLine}
                />
                <p className="font-label text-base font-medium uppercase leading-6 tracking-normal text-brand-100">
                  {featuredHeading}
                </p>
              </div>
              <div className="flex flex-col gap-3">
                <h1 className="font-headline text-4xl font-medium uppercase leading-[120%] tracking-tight text-white md:text-[60px] md:leading-[72px]">
                  {title}
                </h1>
                <p className="font-label text-sm font-semibold uppercase leading-4 tracking-[1.8px] text-brand-200">
                  {artist}
                </p>
              </div>
              <div className="flex flex-row flex-wrap gap-8">
                <StatTile label="Estimate" value={estimate} />
                <StatTile label="Current Highest Bid" value={bid} />
                <StatTile label="Bids" value={bids} />
              </div>
            </div>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
              <Link
                href="/register"
                className="inline-flex h-[60px] min-w-[218px] items-center justify-center gap-[11px] rounded bg-white px-8 py-[18px] font-label text-base font-semibold leading-6 tracking-[0.8px] text-brand-800"
              >
                Register to Bid
                <MaterialIcon name="arrow_forward" className="!text-xl text-brand-800" />
              </Link>
              <Link
                href={artworkHref}
                className="inline-flex h-[60px] min-w-[200px] items-center justify-center gap-[11px] rounded border border-brand-100 px-8 py-[18px] font-label text-base font-semibold leading-6 tracking-[0.8px] text-brand-100"
              >
                <span className="relative flex h-5 w-5 shrink-0 items-center justify-center">
                  <span
                    className="absolute inline-flex h-[19.51px] w-[19.51px] rounded-full bg-live-red opacity-[0.05]"
                    aria-hidden
                  />
                  <span
                    className="relative inline-flex h-2.5 w-2.5 rounded-full bg-live-red opacity-[0.78]"
                    aria-hidden
                  />
                </span>
                Join Live Stream
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-2 border-l-2 border-accent-gold pl-4">
      <span className="font-label text-[13px] font-medium uppercase leading-4 text-brand-100">
        {label}
      </span>
      <span className="font-headline text-2xl font-normal leading-none tracking-[-0.96px] text-white md:text-[28px]">
        {value}
      </span>
    </div>
  );
}
