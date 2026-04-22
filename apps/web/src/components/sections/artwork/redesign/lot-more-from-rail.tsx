"use client";

import { OwnerBadge } from "@/components/marketing/owner-badge";
import type { LotRelatedRailVM } from "@/components/sections/artwork/artwork-view-models";
import { ArtworkWatchToggle } from "@/components/sections/artwork/artwork-watch-toggle";
import { formatCountdownForDisplay } from "@/lib/format-countdown";
import { formatMoney } from "@/lib/format-currency";
import { TINY_IMAGE_BLUR } from "@/lib/image-blur";
import { Button } from "@auction/ui/components/button";
import { ChevronRight } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

type Props = {
  rail: LotRelatedRailVM;
  currentUserId?: string | null;
  isAuthenticated: boolean;
  /** Lot ids in the user’s watchlist (for `initialWatching`). */
  watchedLotIds: readonly string[];
};

/**
 * Figma: “More from …” with up to four 320px cards and Bid / Follow CTAs.
 */
export function LotMoreFromRail({
  rail,
  currentUserId = null,
  isAuthenticated,
  watchedLotIds,
}: Props) {
  if (rail.cards.length === 0 || !rail.heading) {
    return null;
  }

  return (
    <section className="mt-20 w-full border-t border-outline-variant/10 pt-16">
      <div className="mb-10 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-base leading-4 text-[#474747] dark:text-brand-400">More from</p>
          <h2 className="mt-1 text-2xl font-semibold leading-6 text-[#050505] dark:text-on-surface">
            {rail.heading.startsWith("More from ")
              ? rail.heading.slice("More from ".length)
              : rail.heading}
          </h2>
        </div>
        {rail.viewAuctionHref ? (
          <Button
            variant="link"
            asChild
            className="h-auto min-h-0 p-0 text-base font-semibold text-[#050505] dark:text-on-surface"
          >
            <Link
              href={rail.viewAuctionHref}
              className="inline-flex items-center gap-1 !no-underline"
            >
              view auction
              <ChevronRight className="size-5" aria-hidden />
            </Link>
          </Button>
        ) : null}
      </div>
      <ul className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">
        {rail.cards.map((c) => {
          const endMs = new Date(c.endTime).getTime() - Date.now();
          const closing = formatCountdownForDisplay(endMs);
          return (
            <li key={c.id} className="min-w-0 max-w-[320px]">
              <div className="flex flex-col gap-4">
                <Link
                  href={c.href}
                  className="group relative block w-full max-w-[320px] overflow-hidden bg-[#0A0A0A]"
                >
                  <div className="relative aspect-[320/340] w-full max-w-[320px]">
                    {c.imageUrl ? (
                      <Image
                        src={c.imageUrl}
                        alt=""
                        fill
                        placeholder="blur"
                        blurDataURL={TINY_IMAGE_BLUR}
                        className="object-cover transition-transform duration-500 motion-safe:group-hover:scale-105"
                        sizes="(max-width: 1023px) 100vw, 42vw"
                      />
                    ) : (
                      <div className="absolute inset-0 bg-surface-container-low" />
                    )}
                    <OwnerBadge
                      owned={Boolean(currentUserId && c.sellerId === currentUserId)}
                      className="absolute right-2 top-2"
                    />
                  </div>
                </Link>
                <div className="flex max-w-[320px] flex-col gap-3">
                  <p
                    className="text-sm font-bold uppercase leading-4 text-[#E17100] dark:text-orange-500"
                    style={{ color: "#E17100" }}
                  >
                    {c.lotNumber != null ? `LOT ${c.lotNumber}` : "LOT"}
                  </p>
                  <div>
                    <p className="text-xl font-semibold leading-6 text-[#050505] dark:text-on-surface">
                      {c.title}
                    </p>
                    <p className="mt-1 text-sm font-light text-[#191919] dark:text-brand-500">
                      {c.artistOrSellerName}
                    </p>
                  </div>
                  {c.estimateLine ? (
                    <div>
                      <p className="text-xs text-[#474747] dark:text-brand-400">Estimate</p>
                      <p className="text-sm font-medium text-[#474747] dark:text-brand-400">
                        {c.estimateLine}
                      </p>
                    </div>
                  ) : null}
                  <div>
                    <p className="text-xs text-[#474747] dark:text-brand-400">Current bid</p>
                    <p className="text-sm font-semibold text-[#050505] dark:text-on-surface">
                      {formatMoney(c.currentPrice)}
                    </p>
                  </div>
                  <p className="text-sm text-[#474747] dark:text-on-surface">
                    <span className="text-xs">Closing: </span>
                    <span className="font-semibold text-[#050505] dark:text-on-surface">
                      {closing}
                    </span>
                  </p>
                  <div className="flex flex-row gap-4 pt-1">
                    <Button
                      variant="outline"
                      asChild
                      className="h-10 min-h-10 flex-1 rounded border-[#A3A3A3] text-base font-semibold text-[#0A0A0A] dark:text-on-surface"
                    >
                      <Link href={`${c.href}#bid-interactive-anchor`}>Bid</Link>
                    </Button>
                    <div className="min-w-0 flex-1">
                      <ArtworkWatchToggle
                        lotId={c.id}
                        initialWatching={watchedLotIds.includes(c.id)}
                        isAuthenticated={isAuthenticated}
                        appearance="outlined-block"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
