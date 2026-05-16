import { LotCard } from "@/components/marketing/lot-card";
import { MarketingWatchlistHeart } from "@/components/marketing/watchlist-heart-button";
import type { EditorsPickLotCardVM } from "@/components/sections/home/home-view-models";
import { Button } from "@auction/ui/components/button";
import Link from "next/link";

type Props = {
  lot: EditorsPickLotCardVM;
  index: number;
  isAuthenticated: boolean;
  watchedLotIds: readonly string[];
  loginNextPath?: string;
};

/** Presentational tile for the home “Editor’s Picks” strip (Figma). */
export function EditorsPickMarketingCard({
  lot,
  index,
  isAuthenticated,
  watchedLotIds,
  loginNextPath = "/",
}: Props) {
  const initialWatching = watchedLotIds.includes(lot.id);

  return (
    <LotCard.HeroTile
      lotId={lot.id}
      index={index}
      href={lot.href}
      linkAriaLabel={`${lot.title} — view artwork`}
      imageUrl={lot.imageUrl}
      imageAlt={lot.imageAlt}
      sizes="280px"
      cornerAction={
        <MarketingWatchlistHeart
          lotId={lot.id}
          lotTitle={lot.title}
          initialWatching={initialWatching}
          isAuthenticated={isAuthenticated}
          loginNextPath={loginNextPath}
        />
      }
      belowImage={
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <Link
              href={lot.href}
              className="font-headline text-[20px] font-semibold leading-6 text-[#050505] underline-offset-2 hover:underline dark:text-on-surface"
            >
              {lot.title}
            </Link>
            <p className="font-body text-sm font-light leading-4 text-[#191919] dark:text-on-surface-variant">
              {lot.artistName}
            </p>
          </div>
          <div className="flex flex-col gap-1">
            <span className="font-body text-xs font-normal leading-4 text-[#474747] dark:text-on-surface-variant">
              {lot.estimateLabel}
            </span>
            <span className="font-body text-sm font-medium leading-4 text-[#474747] dark:text-on-surface-variant">
              {lot.estimateValue}
            </span>
          </div>
          <Button
            variant="outline"
            asChild
            className="h-10 w-full rounded border-[#A3A3A3] text-base font-semibold tracking-[0.05em] text-[#0A0A0A] dark:border-neutral-500 dark:text-on-surface"
          >
            <Link href={lot.href}>View Lot</Link>
          </Button>
        </div>
      }
    />
  );
}
