import { formatMoney } from "@/lib/format-currency";
import type { Auction } from "@auction/types";
import Image from "next/image";
import Link from "next/link";

const FALLBACK_IMG =
  "https://images.unsplash.com/photo-1579783902614-a3fb3927b6a5?auto=format&fit=crop&w=1920&q=80";

type Props = {
  featured: Auction | null;
};

export function HomeHero({ featured }: Props) {
  const img = featured?.images[0] ?? FALLBACK_IMG;
  const title = featured?.title ?? "Ethereal Form & Found Light";
  const bid = featured ? formatMoney(featured.currentPrice) : "$142,000";
  const href = featured ? `/artwork/${featured.id}` : "/";
  const primaryLinkClass =
    "inline-flex items-center justify-center bg-gradient-to-br from-primary to-primary-container px-12 py-5 font-label text-xs font-bold uppercase tracking-[0.3em] text-on-primary shadow-2xl transition-all duration-500 hover:opacity-95 rounded-md";

  return (
    <section className="mb-20 px-4 md:mb-32 md:px-10 lg:px-20">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4 border-b border-outline-variant/10 pb-4 font-label text-xs uppercase tracking-[0.25em] text-secondary md:mb-8">
        <span className="text-on-surface">Editorial</span>
        <span className="max-w-xl text-right text-on-surface-variant">
          This week: luminous abstraction, architectural photography, and sealed masterworks.
        </span>
      </div>
      <div className="group relative h-[600px] w-full overflow-hidden md:h-[800px]">
        <Image
          src={img}
          alt="Featured artwork"
          fill
          priority
          className="object-cover transition-transform duration-[2000ms] ease-out group-hover:scale-105"
          sizes="100vw"
        />
        <div className="absolute inset-0 bg-black/30" />
        <div className="absolute inset-0 bg-gradient-to-t from-inverse-surface via-transparent to-transparent opacity-80" />
        <div className="absolute bottom-12 left-6 max-w-3xl md:bottom-24 md:left-20">
          <div className="mb-8 flex items-center space-x-4">
            <span className="flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-2.5 w-2.5 animate-ping rounded-full bg-error opacity-75" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-error" />
            </span>
            <span className="font-label text-xs font-bold uppercase tracking-[0.4em] text-white">
              Live Auction Phase
            </span>
          </div>
          <h1 className="mb-10 font-headline text-5xl font-light leading-none tracking-tight text-white md:text-8xl">
            {title}
          </h1>
          <div className="flex flex-col space-y-8 md:flex-row md:items-center md:space-x-12 md:space-y-0">
            <div className="min-w-[240px] border border-white/20 bg-white/10 p-6 backdrop-blur-md md:px-10 md:py-5">
              <p className="mb-2 font-label text-xs font-semibold uppercase tracking-[0.2em] text-white/60">
                Current Highest Bid
              </p>
              <div className="flex items-baseline space-x-3">
                <span className="font-headline text-3xl text-white">{bid}</span>
                <span className="font-label text-xs uppercase tracking-wider text-primary-fixed-dim">
                  USD
                </span>
              </div>
            </div>
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:gap-6">
              <Link href="/register" className={primaryLinkClass}>
                Register
              </Link>
              <Link
                href={href}
                className="inline-flex items-center justify-center rounded-md border border-white/40 px-10 py-5 font-label text-xs font-bold uppercase tracking-[0.3em] text-white transition-colors hover:bg-white/10"
              >
                View featured lot
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
