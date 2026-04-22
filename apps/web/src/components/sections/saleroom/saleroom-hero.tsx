import { TINY_IMAGE_BLUR } from "@/lib/image-blur";
import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import type { SaleHeroVM } from "./view-models";

type Props = {
  hero: SaleHeroVM;
  actions: ReactNode;
};

/**
 * Presentational hero — accepts view-model data only (DIP). Action bar is composed by caller
 * via `actions` slot so the hero itself stays open for extension and closed for modification.
 */
export function SaleroomHero({ hero, actions }: Props) {
  return (
    <section className="relative overflow-hidden bg-surface-container-low">
      <div className="relative grid min-h-[56vh] grid-cols-1 lg:min-h-[64vh] lg:grid-cols-[3fr_2fr]">
        <div className="relative h-[280px] w-full bg-surface-container-high lg:h-full">
          {hero.coverImage ? (
            <Image
              src={hero.coverImage}
              alt={hero.title}
              fill
              priority
              placeholder="blur"
              blurDataURL={TINY_IMAGE_BLUR}
              className="object-cover"
              sizes="(max-width: 1024px) 100vw, 60vw"
            />
          ) : (
            <div
              className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-surface-container-high to-surface-container-low"
              aria-hidden
            >
              <span className="font-headline text-2xl text-on-surface-variant">{hero.title}</span>
            </div>
          )}
        </div>

        <div className="relative flex flex-col gap-6 bg-surface px-6 py-10 md:px-12 lg:py-16">
          <nav
            aria-label="Breadcrumb"
            className="font-label text-xs uppercase tracking-widest text-on-surface-variant"
          >
            <Link
              href="/sales"
              className="hover:text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              Auctions
            </Link>
            <span className="mx-2" aria-hidden>
              /
            </span>
            <span className="text-on-surface" aria-current="page">
              {hero.title}
            </span>
          </nav>

          <div className="flex flex-wrap items-center gap-2">
            {hero.isLive ? (
              <span
                className="inline-flex items-center gap-2 rounded-full bg-error-container/70 px-3 py-1 font-label text-[0.65rem] font-bold uppercase tracking-widest text-on-error-container"
                aria-label="Live auction in progress"
              >
                <span
                  className="inline-block h-2 w-2 animate-pulse rounded-full bg-error"
                  aria-hidden
                />
                Live now
              </span>
            ) : null}
            {hero.tags.map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center rounded-full border border-outline-variant/40 px-3 py-1 font-label text-[0.65rem] font-bold uppercase tracking-widest text-on-surface-variant"
              >
                {tag}
              </span>
            ))}
          </div>

          <h1 className="font-headline text-3xl leading-tight text-on-surface md:text-5xl">
            {hero.title}
          </h1>

          {hero.description ? (
            <p className="max-w-xl font-body text-on-surface-variant">{hero.description}</p>
          ) : null}

          <dl className="grid grid-cols-2 gap-x-6 gap-y-4 border-y border-outline-variant/30 py-6 text-sm">
            <div>
              <dt className="font-label text-[0.65rem] uppercase tracking-widest text-on-surface-variant">
                Dates
              </dt>
              <dd className="mt-1 font-headline text-base text-on-surface">{hero.startEndLabel}</dd>
            </div>
            <div>
              <dt className="font-label text-[0.65rem] uppercase tracking-widest text-on-surface-variant">
                Lots
              </dt>
              <dd className="mt-1 font-headline text-base text-on-surface">{hero.itemsLabel}</dd>
            </div>
            {hero.biddingStartsLabel ? (
              <div>
                <dt className="font-label text-[0.65rem] uppercase tracking-widest text-on-surface-variant">
                  Bidding starts
                </dt>
                <dd className="mt-1 font-headline text-base text-on-surface">
                  {hero.biddingStartsLabel}
                </dd>
              </div>
            ) : null}
            {hero.registrationClosesLabel ? (
              <div>
                <dt className="font-label text-[0.65rem] uppercase tracking-widest text-on-surface-variant">
                  Registration closes
                </dt>
                <dd className="mt-1 font-headline text-base text-on-surface">
                  {hero.registrationClosesLabel}
                </dd>
              </div>
            ) : null}
          </dl>

          {actions}
        </div>
      </div>
    </section>
  );
}
