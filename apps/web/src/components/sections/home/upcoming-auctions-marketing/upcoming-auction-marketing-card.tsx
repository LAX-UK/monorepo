import type { HomeUpcomingAuctionTileVM } from "@/components/sections/home/home-view-models";
import { MediaImage } from "@/components/ui/media-image";
import { cn } from "@auction/ui";
import Link from "next/link";

type Props = {
  tile: HomeUpcomingAuctionTileVM;
  /** When exactly two tiles use a 2-col grid, let each card span its cell (same row). */
  fillGridCell?: boolean;
};

export function UpcomingAuctionMarketingCard({ tile, fillGridCell = false }: Props) {
  const itemsLabel = tile.lotCount === 1 ? "1 Item" : `${tile.lotCount} Items`;

  return (
    <article
      className={cn(
        "flex min-w-0 flex-col items-start gap-6 bg-white py-8 sm:flex-row dark:bg-surface-container-low",
        fillGridCell ? "w-full max-w-none" : "w-full max-w-[664px] flex-none",
      )}
    >
      <Link
        href={tile.href}
        className="group relative block aspect-[220/150] w-full max-w-[220px] shrink-0 overflow-hidden bg-surface-container-high outline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary sm:h-[150px] sm:w-[220px] sm:max-w-none dark:bg-surface-container-high"
        aria-labelledby={`auction-title-${tile.id}`}
      >
        <MediaImage
          src={tile.coverImageUrl}
          alt={tile.coverImageAlt}
          label="Auction cover"
          className="size-full"
          imgClassName="size-full object-cover transition-transform duration-700 ease-out motion-safe:group-hover:scale-105 motion-reduce:group-hover:scale-100"
          sizes="220px"
        />
      </Link>
      <div className="flex min-w-0 flex-1 flex-col gap-10">
        <div className="flex flex-col gap-4">
          <p className="font-body text-sm uppercase leading-4 text-[#191919] dark:text-on-surface-variant">
            <span className="font-medium">{tile.auctionKindLabel}</span>
            <span className="font-normal"> | {tile.dateLabel}</span>
          </p>
          <div className="flex flex-col gap-4">
            <h3
              id={`auction-title-${tile.id}`}
              className="font-headline text-base font-semibold leading-6 text-[#050505] dark:text-on-surface"
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
