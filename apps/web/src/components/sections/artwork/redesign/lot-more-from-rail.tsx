"use client";

import { LotQuickLookTrigger } from "@/components/marketing/lot-quick-look/lot-quick-look-trigger";
import {
  lotQuickLookFromRailCard,
  lotQuickLookRailDeck,
} from "@/components/marketing/lot-quick-look/mappers";
import { MarketingLotOverlayActions } from "@/components/marketing/lot-quick-look/marketing-lot-overlay-actions";
import { OwnerBadge } from "@/components/marketing/owner-badge";
import type { LotRelatedRailVM } from "@/components/sections/artwork/artwork-view-models";
import { ArtworkWatchToggle } from "@/components/sections/artwork/artwork-watch-toggle";
import { MediaImage } from "@/components/ui/media-image";
import { formatCountdownForDisplay } from "@/lib/format-countdown";
import { formatMoney } from "@/lib/format-currency";
import { useClientClock } from "@/lib/time/use-client-clock";
import { Button } from "@auction/ui/components/button";
import { ChevronRight } from "lucide-react";
import Link from "next/link";

type Props = {
  rail: LotRelatedRailVM;
  currentUserId?: string | null;
  isAuthenticated: boolean;
  /** Lot ids in the user's watchlist (for `initialWatching`). */
  watchedLotIds: readonly string[];
  /** `rich` (default) keeps the historical card with estimate / current bid /
   * Bid + Watch CTAs. `compact` renders a slimmed mockup tile (image + title,
   * artist · price). Both layouts are LSP-substitutable.
   */
  density?: "rich" | "compact";
};

/** Figma: “More from …” with up to four 320px cards and Bid / Follow CTAs.
 */
export function LotMoreFromRail({
  rail,
  currentUserId = null,
  isAuthenticated,
  watchedLotIds,
  density = "rich",
}: Props) {
  // `null` during SSR + first client render so the per-card "Closing: …" text
  // matches between server and client; updates every 30s after mount.
  const nowMs = useClientClock(30_000);
  if (rail.cards.length === 0 || !rail.heading) {
    return null;
  }
  const isCompact = density === "compact";
  const quickLookDeck = lotQuickLookRailDeck(rail.cards);

  return (
    <section className="mt-20 w-full border-t border-border-hairline pt-16">
      <div className="mb-10 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-base leading-4 text-on-surface-variant">More from</p>
          <h2 className="mt-1 text-2xl font-semibold leading-6 text-on-surface">
            {rail.heading.startsWith("More from ")
              ? rail.heading.slice("More from ".length)
              : rail.heading}
          </h2>
        </div>
        {rail.viewAuctionHref ? (
          <Button
            variant="link"
            asChild
            className="h-auto min-h-0 p-0 text-base font-semibold text-on-surface"
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
      <ul className="flex list-none gap-5 overflow-x-auto pb-3">
        {rail.cards.map((c, cardIndex) => {
          const closing =
            nowMs == null ? null : formatCountdownForDisplay(new Date(c.endTime).getTime() - nowMs);
          return (
            <li key={c.id} className="w-[200px] shrink-0 min-w-0">
              <div className="flex flex-col gap-4">
                <Link
                  href={c.href}
                  className="group relative block w-full overflow-hidden bg-brand-900"
                >
                  <div className="relative aspect-[200/240] w-full">
                    <MediaImage
                      src={c.imageUrl}
                      alt=""
                      label="Lot artwork"
                      imgClassName="transition-transform duration-500 motion-safe:group-hover:scale-105"
                      sizes="(max-width: 1023px) 100vw, 42vw"
                    />
                    {isCompact ? (
                      <MarketingLotOverlayActions
                        lotId={c.id}
                        lotTitle={c.title}
                        initialWatching={watchedLotIds.includes(c.id)}
                        isAuthenticated={isAuthenticated}
                        loginNextPath={c.href}
                        vm={lotQuickLookFromRailCard(c)}
                        quickLookOptions={{
                          deck: quickLookDeck,
                          deckIndex: cardIndex,
                          deckSourceLabel: rail.heading,
                          isAuthenticated,
                          watchedLotIds,
                          loginNextPath: c.href,
                        }}
                        inset="compact"
                        topRightAddon={
                          <OwnerBadge
                            owned={Boolean(currentUserId && c.sellerId === currentUserId)}
                            className="pointer-events-auto"
                          />
                        }
                      />
                    ) : null}
                    {!isCompact ? (
                      <>
                        <OwnerBadge
                          owned={Boolean(currentUserId && c.sellerId === currentUserId)}
                          className="absolute right-2 top-2"
                        />
                        <div className="pointer-events-auto absolute bottom-2 left-2 z-10">
                          <LotQuickLookTrigger
                            vm={lotQuickLookFromRailCard(c)}
                            layout="overlay"
                            options={{
                              deck: quickLookDeck,
                              deckIndex: cardIndex,
                              deckSourceLabel: rail.heading,
                              isAuthenticated,
                              watchedLotIds,
                              loginNextPath: c.href,
                            }}
                          />
                        </div>
                      </>
                    ) : null}
                  </div>
                </Link>
                {isCompact ? (
                  <div className="flex flex-col gap-1">
                    <Link
                      href={c.href}
                      className="text-sm font-semibold leading-5 text-on-surface underline-offset-2 hover:underline"
                    >
                      {c.title}
                    </Link>
                    <p className="text-xs text-on-surface-variant">
                      {c.artistOrSellerName} {"\u00B7"}{" "}
                      <span className="text-on-surface">{formatMoney(c.currentPrice)}</span>
                    </p>
                  </div>
                ) : (
                  <div className="flex flex-col gap-2">
                    <p className="text-sm font-bold uppercase leading-4 text-warning">
                      {c.lotNumber != null ? `LOT ${c.lotNumber}` : "LOT"}
                    </p>
                    <div>
                      <p className="text-sm font-semibold leading-5 text-on-surface underline-offset-2 group-hover:underline">
                        {c.title}
                      </p>
                      <p className="mt-1 text-sm font-light text-on-surface-variant">
                        {c.artistOrSellerName}
                      </p>
                    </div>
                    {c.estimateLine ? (
                      <div>
                        <p className="text-xs text-on-surface-variant">Estimate</p>
                        <p className="text-sm font-medium text-on-surface-variant">
                          {c.estimateLine}
                        </p>
                      </div>
                    ) : null}
                    <div>
                      <p className="text-xs text-on-surface-variant">Current bid</p>
                      <p className="text-sm font-semibold text-on-surface">
                        {formatMoney(c.currentPrice)}
                      </p>
                    </div>
                    <p className="text-sm text-on-surface-variant">
                      <span className="text-xs">Closing: </span>
                      <span className="font-semibold text-on-surface" suppressHydrationWarning>
                        {closing ?? "\u00A0"}
                      </span>
                    </p>
                    <div className="flex flex-col gap-2 pt-1 w-full">
                      {c.deliveryMode !== "onsite" ? (
                        <Button
                          variant="outline"
                          asChild
                          className="h-10 min-h-10 w-full rounded border-outline-variant text-base font-semibold text-on-surface"
                        >
                          <Link href={`${c.href}#bid-interactive-anchor`}>Bid</Link>
                        </Button>
                      ) : null}
                      <div className="min-w-0 w-full">
                        <ArtworkWatchToggle
                          lotId={c.id}
                          initialWatching={watchedLotIds.includes(c.id)}
                          isAuthenticated={isAuthenticated}
                          loginNextPath={c.href}
                          appearance="outlined-block"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
