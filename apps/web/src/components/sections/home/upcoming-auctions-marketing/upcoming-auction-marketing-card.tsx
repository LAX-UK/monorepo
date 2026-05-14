import type { HomeUpcomingAuctionTileVM } from "@/components/sections/home/home-view-models";
import { MediaImage } from "@/components/ui/media-image";
import Link from "next/link";

type Props = {
  tile: HomeUpcomingAuctionTileVM;
};

export function UpcomingAuctionMarketingCard({ tile }: Props) {
  const itemsLabel = tile.lotCount === 1 ? "1 Item" : `${tile.lotCount} Items`;

  return (
    <article className="flex h-full min-w-0 w-full flex-col items-start gap-4 bg-white py-4 sm:gap-6 sm:py-6 sm:flex-row dark:bg-surface-container-low">
      <Link
        href={tile.href}
        className="group relative block aspect-[220/150] w-full shrink-0 overflow-hidden rounded-sm bg-surface-container-high outline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary sm:w-[clamp(200px,40%,280px)] sm:max-w-[280px] sm:self-start dark:bg-surface-container-high"
        aria-labelledby={`auction-title-${tile.id}`}
      >
        <MediaImage
          src={tile.coverImageUrl}
          alt={tile.coverImageAlt}
          label="Auction cover"
          className="size-full"
          imgClassName="size-full object-cover transition-transform duration-700 ease-out motion-safe:group-hover:scale-105 motion-reduce:group-hover:scale-100"
          sizes="(max-width: 639px) 100vw, (max-width: 1023px) min(40vw, 280px), 280px"
        />
      </Link>
      <div className="flex min-w-0 flex-1 flex-col gap-3 px-4 sm:h-full sm:justify-between sm:px-0">
        <div className="flex flex-col gap-3">
          {(tile.isLive || tile.startsSoon) && (
            <div className="flex flex-wrap items-center gap-2">
              {tile.isLive ? (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-red-200 bg-red-50 px-2.5 py-0.5 font-label text-[10px] font-semibold uppercase tracking-[0.08em] text-red-900 dark:border-red-900/40 dark:bg-red-950/40 dark:text-red-100">
                  <span
                    className="size-1.5 shrink-0 rounded-full bg-red-600 motion-safe:animate-pulse"
                    aria-hidden
                  />
                  Live
                </span>
              ) : null}
              {tile.startsSoon && !tile.isLive ? (
                <span className="inline-flex items-center rounded-full border border-neutral-300 bg-neutral-100 px-2.5 py-0.5 font-label text-[10px] font-semibold uppercase tracking-[0.08em] text-neutral-800 dark:border-outline dark:bg-surface-container-high dark:text-on-surface-variant">
                  Starts soon
                </span>
              ) : null}
            </div>
          )}
          <p className="font-body text-sm uppercase leading-4 text-[#191919] dark:text-on-surface-variant">
            <span className="font-medium">{tile.auctionKindLabel}</span>
            <span className="font-normal"> | {tile.dateLabel}</span>
          </p>
          <div className="flex flex-col gap-1">
            <h3
              id={`auction-title-${tile.id}`}
              className="line-clamp-2 font-headline text-base font-semibold leading-6 text-[#050505] sm:min-h-[3rem] dark:text-on-surface"
            >
              <Link href={tile.href} className="underline-offset-4 hover:underline">
                {tile.title}
              </Link>
            </h3>
            <p className="font-body text-sm font-normal uppercase leading-4 text-[#191919] dark:text-on-surface-variant">
              {itemsLabel}
            </p>
          </div>
        </div>
      </div>
    </article>
  );
}
