import { LotQuickLookTrigger } from "@/components/marketing/lot-quick-look/lot-quick-look-trigger";
import { lotQuickLookFromLotCardVM } from "@/components/marketing/lot-quick-look/mappers";
import { LotStatusTimer } from "@/components/marketing/lot-status-badge";
import { LotViewTransitionLink } from "@/components/marketing/lot-view-transition-link";
import { MarketingLotTile } from "@/components/marketing/marketing-lot-tile";
import { MarketingWatchlistHeart } from "@/components/marketing/watchlist-heart-button";
import type { LotCardVM } from "@/components/sections/home/home-view-models";

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
      articleClassName="h-full"
      topOverlay={
        <LotStatusTimer
          variant="endingSoon"
          status={item.status}
          startTime={item.startTime}
          endTime={item.endTime}
        />
      }
      cornerAction={
        <div className="pointer-events-auto absolute right-3 top-3 z-10">
          <MarketingWatchlistHeart
            lotId={item.id}
            lotTitle={item.title}
            initialWatching={initialWatching}
            isAuthenticated={isAuthenticated}
            loginNextPath={loginNextPath}
            layout="inline"
          />
        </div>
      }
      belowImage={
        <div className="flex min-w-0 flex-1 flex-col gap-3">
          <div key="heading" className="flex min-w-0 flex-col gap-1">
            <LotViewTransitionLink
              lotId={item.id}
              href={item.href}
              className="line-clamp-2 min-h-12 text-[20px] font-semibold leading-6 text-[#050505] underline-offset-2 hover:underline dark:text-on-surface"
            >
              {item.title}
            </LotViewTransitionLink>
            <p className="line-clamp-1 min-h-4 text-sm font-light leading-4 text-[#191919] dark:text-on-surface-variant">
              {item.artistName}
            </p>
          </div>

          {rows ? (
            <>
              <div key="estimate" className="flex min-w-0 flex-col gap-1">
                <span className="text-xs font-normal leading-4 text-[#474747] dark:text-on-surface-variant">
                  {rows.estimate.label}
                </span>
                <span className="line-clamp-1 text-sm font-semibold leading-6 text-[#050505] dark:text-on-surface">
                  {rows.estimate.value}
                </span>
              </div>
              <div key="current" className="flex min-w-0 flex-col gap-1">
                <span className="text-xs font-normal leading-4 text-[#474747] dark:text-on-surface-variant">
                  {rows.current.label}
                </span>
                <span className="line-clamp-1 text-sm font-medium leading-6 text-[#474747] dark:text-on-surface-variant">
                  {rows.current.value}
                </span>
              </div>
            </>
          ) : (
            <div key="price" className="flex min-w-0 flex-col gap-1">
              <span className="text-xs font-normal leading-4 text-[#474747] dark:text-on-surface-variant">
                {item.priceLabel}
              </span>
              <span className="line-clamp-1 text-sm font-semibold leading-6 text-[#050505] dark:text-on-surface">
                {item.priceFormatted}
              </span>
            </div>
          )}

          <div key="actions" className="mt-auto inline-flex w-full items-start gap-6">
            <LotViewTransitionLink
              key="bid"
              lotId={item.id}
              href={item.href}
              className="flex h-10 flex-1 items-center justify-center rounded border border-[#A3A3A3] bg-transparent text-center text-base font-semibold leading-6 tracking-[0.05em] text-[#0A0A0A] outline-offset-2 hover:bg-black/[0.03] focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary dark:border-neutral-500 dark:text-on-surface dark:hover:bg-white/[0.06]"
            >
              Bid
            </LotViewTransitionLink>
            <LotQuickLookTrigger
              key="quick-look"
              vm={lotQuickLookFromLotCardVM(item)}
              layout="inline"
              className="h-10 w-10 rounded border-0 bg-transparent px-2.5 text-[#0A0A0A] hover:bg-black/[0.03] dark:text-on-surface dark:hover:bg-white/[0.06]"
              options={{
                isAuthenticated,
                watchedLotIds,
                loginNextPath,
              }}
            />
          </div>
        </div>
      }
    />
  );
}
