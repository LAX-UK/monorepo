"use client";

import { LotStatusTimer } from "@/components/marketing/lot-status-badge";
import { MarketingWatchlistHeart } from "@/components/marketing/watchlist-heart-button";
import type { LotCardVM } from "@/components/sections/home/home-view-models";
import { SALE_CARD_SHELL_CLASSNAME } from "@/components/sections/sales/card/sale-card-shell";
import { AdaptiveFrameImage } from "@/components/ui/adaptive-frame-image";
import {
  AdaptiveMediaFrame,
  AdaptiveMediaFrameContainer,
} from "@/components/ui/adaptive-media-frame";
import { HOME_LOT_TILE_SLOTS } from "@/lib/media/overlay-slot-presets";
import { cn } from "@auction/ui";
import Link from "next/link";

/** Mirrors `UrgencySectionVariant` in `lax-urgency-section` (kept local to avoid circular imports). */
export type UrgencyLotRowListVariant = "endingSoon" | "liveNow" | "upcoming";

type Props = {
  item: LotCardVM;
  variant: UrgencyLotRowListVariant;
  isAuthenticated: boolean;
  watchedLotIds: readonly string[];
  loginNextPath: string;
};

/** Neutralises absolute image-overlay positioning so the timer sits in normal flow. */
const INLINE_TIMER_SURFACE =
  "relative bottom-auto left-auto z-0 max-w-full shadow-sm motion-reduce:shadow-none";

/** Dense list row for home urgency rail (Ending Soon / Live Now / Upcoming). */
export function UrgencyLotRow({
  item,
  variant,
  isAuthenticated,
  watchedLotIds,
  loginNextPath,
}: Props) {
  const rows = item.endingSoonPriceRows;
  const initialWatching = watchedLotIds.includes(item.id);
  const priceLabel = rows?.estimate.label ?? item.priceLabel;
  const priceValue = rows?.estimate.value ?? item.priceFormatted;
  const ctaLabel = variant === "liveNow" ? "Place bid" : "View lot";

  const watchlistProps = {
    lotId: item.id,
    lotTitle: item.title,
    initialWatching,
    isAuthenticated,
    loginNextPath,
  } as const;

  const timerProps = {
    status: item.status,
    startTime: item.startTime,
    endTime: item.endTime,
  } as const;

  return (
    <article className={cn(SALE_CARD_SHELL_CLASSNAME, "p-3 sm:p-4 lg:p-5")}>
      <div className="flex flex-col lg:flex-row lg:items-stretch lg:gap-6">
        <AdaptiveMediaFrame
          src={item.imageUrl}
          objectFit="cover"
          slots={HOME_LOT_TILE_SLOTS}
          className="relative w-full shrink-0 lg:w-44"
        >
          <AdaptiveMediaFrameContainer className="relative aspect-[4/3] w-full overflow-hidden rounded-md bg-surface-container-high dark:bg-surface-container-high">
            <Link
              href={item.href}
              className="group absolute inset-0 z-0 overflow-hidden outline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring"
              aria-label={`${item.title} — view artwork`}
            >
              <AdaptiveFrameImage
                src={item.imageUrl}
                alt={item.imageAlt}
                objectFit="cover"
                label="Lot artwork"
                className="size-full"
                imgClassName="size-full object-cover transition-transform duration-700 ease-out motion-safe:group-hover:scale-[1.03] motion-reduce:group-hover:scale-100"
                sizes="(max-width: 1023px) 100vw, 176px"
              />
            </Link>

            <div className="lg:hidden">
              <LotStatusTimer variant="endingSoon" {...timerProps} />
            </div>

            <div className="pointer-events-auto absolute right-3 top-3 z-10 lg:hidden">
              <MarketingWatchlistHeart {...watchlistProps} layout="inline" surface="onImage" />
            </div>
          </AdaptiveMediaFrameContainer>
        </AdaptiveMediaFrame>

        <div className="flex min-w-0 flex-1 flex-col gap-4 pt-4 lg:flex-row lg:gap-6 lg:pt-0">
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <div className="hidden flex-wrap items-center gap-2 lg:flex">
              <LotStatusTimer
                variant="default"
                pillSurfaceClassName={INLINE_TIMER_SURFACE}
                {...timerProps}
              />
            </div>
            <Link
              href={item.href}
              className="line-clamp-2 font-headline text-sm font-semibold leading-snug text-on-surface underline-offset-2 hover:underline sm:text-base"
            >
              {item.title}
            </Link>
            <p className="text-xs font-light leading-4 text-on-surface-variant">
              {item.artistName}
            </p>

            {rows ? (
              <div className="flex flex-col gap-3">
                <div className="flex flex-col gap-0.5">
                  <span className="text-[10px] font-normal uppercase leading-4 tracking-wide text-on-surface-variant">
                    {rows.estimate.label}
                  </span>
                  <span className="text-sm font-semibold leading-5 text-on-surface">
                    {rows.estimate.value}
                  </span>
                </div>
                <div className="flex flex-col gap-0.5">
                  <span className="text-[10px] font-normal uppercase leading-4 tracking-wide text-on-surface-variant">
                    {rows.current.label}
                  </span>
                  <span className="text-base font-semibold tabular-nums leading-6 text-on-surface">
                    {rows.current.value}
                  </span>
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-0.5">
                <span className="text-[10px] font-normal uppercase leading-4 tracking-wide text-on-surface-variant">
                  {priceLabel}
                </span>
                <span className="text-sm font-semibold leading-5 text-on-surface">
                  {priceValue}
                </span>
              </div>
            )}
          </div>

          <div className="flex flex-row items-center justify-end gap-3 border-t border-border-hairline pt-3 lg:mt-0 lg:flex-col lg:items-end lg:justify-center lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0">
            <div className="hidden lg:block">
              <MarketingWatchlistHeart {...watchlistProps} layout="inline" surface="inline" />
            </div>
            <Link
              href={item.href}
              className="inline-flex h-10 min-h-[44px] min-w-[7.5rem] flex-1 items-center justify-center rounded-md border border-outline-variant/40 bg-transparent px-4 text-center text-sm font-semibold leading-5 tracking-wide text-on-surface outline-offset-2 transition-colors hover:bg-surface-container-high/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring sm:flex-initial lg:min-w-[9rem]"
            >
              {ctaLabel}
            </Link>
          </div>
        </div>
      </div>
    </article>
  );
}
