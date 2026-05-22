import { LotStatusTimer } from "@/components/marketing/lot-status-badge";
import { LotViewTransitionLink } from "@/components/marketing/lot-view-transition-link";
import { MarketingLotTile } from "@/components/marketing/marketing-lot-tile";
import { MarketingWatchlistHeart } from "@/components/marketing/watchlist-heart-button";
import type { LotCardVM } from "@/components/sections/home/home-view-models";
import { Eye } from "lucide-react";

type Props = {
  item: LotCardVM;
  index: number;
  isAuthenticated: boolean;
  watchedLotIds: readonly string[];
  loginNextPath: string;
};

/** Figma B3 lot tile: fixed 340px art, glass live tag, dual price rows, bid row. */
export function UrgencyLotCard({
  item,
  index,
  isAuthenticated,
  watchedLotIds,
  loginNextPath,
}: Props) {
  const rows = item.endingSoonPriceRows;
  const initialWatching = watchedLotIds.includes(item.id);

  return (
    <MarketingLotTile
      lotId={item.id}
      index={index}
      href={item.href}
      linkAriaLabel={`${item.title} — view artwork`}
      imageUrl={item.imageUrl}
      imageAlt={item.imageAlt}
      sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
      topOverlay={
        <LotStatusTimer
          variant="endingSoon"
          status={item.status}
          startTime={item.startTime}
          endTime={item.endTime}
        />
      }
      cornerAction={
        <MarketingWatchlistHeart
          lotId={item.id}
          lotTitle={item.title}
          initialWatching={initialWatching}
          isAuthenticated={isAuthenticated}
          loginNextPath={loginNextPath}
        />
      }
      belowImage={
        <div className="flex w-full flex-col gap-3">
          <div className="flex flex-col gap-1">
            <LotViewTransitionLink
              lotId={item.id}
              href={item.href}
              className="group text-[20px] font-semibold leading-6 text-[#050505] underline-offset-2 hover:underline dark:text-on-surface"
            >
              {item.title}
            </LotViewTransitionLink>
            <p className="text-sm font-light leading-4 text-[#191919] dark:text-on-surface-variant">
              {item.artistName}
            </p>
          </div>

          {rows ? (
            <>
              <div className="flex flex-col gap-1">
                <span className="text-xs font-normal leading-4 text-[#474747] dark:text-on-surface-variant">
                  {rows.estimate.label}
                </span>
                <span className="text-sm font-semibold leading-6 text-[#050505] dark:text-on-surface">
                  {rows.estimate.value}
                </span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-xs font-normal leading-4 text-[#474747] dark:text-on-surface-variant">
                  {rows.current.label}
                </span>
                <span className="text-sm font-medium leading-6 text-[#474747] dark:text-on-surface-variant">
                  {rows.current.value}
                </span>
              </div>
            </>
          ) : (
            <div className="flex flex-col gap-1">
              <span className="text-xs font-normal leading-4 text-[#474747] dark:text-on-surface-variant">
                {item.priceLabel}
              </span>
              <span className="text-sm font-semibold leading-6 text-[#050505] dark:text-on-surface">
                {item.priceFormatted}
              </span>
            </div>
          )}

          <div className="inline-flex w-full items-start gap-6">
            <LotViewTransitionLink
              lotId={item.id}
              href={item.href}
              className="flex h-10 flex-1 items-center justify-center rounded border border-[#A3A3A3] bg-transparent text-center text-base font-semibold leading-6 tracking-[0.05em] text-[#0A0A0A] outline-offset-2 hover:bg-black/[0.03] focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary dark:border-neutral-500 dark:text-on-surface dark:hover:bg-white/[0.06]"
            >
              Bid
            </LotViewTransitionLink>
            <LotViewTransitionLink
              lotId={item.id}
              href={item.href}
              aria-label={`View details for ${item.title}`}
              className="flex h-10 items-center justify-center rounded px-2.5 text-[#0A0A0A] outline-offset-2 hover:bg-black/[0.03] focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary dark:text-on-surface dark:hover:bg-white/[0.06]"
            >
              <Eye className="size-5 shrink-0" aria-hidden />
            </LotViewTransitionLink>
          </div>
        </div>
      }
    />
  );
}
