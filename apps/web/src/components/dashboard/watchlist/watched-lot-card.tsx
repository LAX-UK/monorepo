import { BidCloseCountdown } from "@/components/dashboard/bids/bid-close-countdown";
import { LotCardGrid } from "@/components/marketing/lot-card";
import { MarketingWatchlistHeart } from "@/components/marketing/watchlist-heart-button";
import { LOT_CARD_GRID_SLOTS } from "@/lib/media/overlay-slot-presets";
import { CLIENT_ROUTES } from "@/lib/navigation/client-routes";
import type { WatchedLotBadge, WatchedLotCardVm } from "@/lib/watching/watching.vm";
import { DotStatusPill, type DotStatusPillTone } from "@auction/ui/components/dot-status-pill";

const BADGE_TONE: Record<WatchedLotBadge, DotStatusPillTone> = {
  winning: "success",
  outbid: "critical",
  absentee: "pending",
  "closing-soon": "warning",
  live: "live",
  upcoming: "info",
  sold: "sold",
  closed: "neutral",
};

/**
 * A followed lot as the catalogue shows it, with where the person stands on it in the corner and
 * the heart to stop following. The same card as the public site, so a lot looks the same
 * everywhere.
 */
export function WatchedLotCard({ card }: { card: WatchedLotCardVm }) {
  return (
    <LotCardGrid
      className="h-full"
      lotId={card.lotId}
      href={card.href}
      // Status sits bottom-left on the image, as on catalogue cards, clear of the heart.
      bottomLeft={<DotStatusPill label={card.badgeLabel} tone={BADGE_TONE[card.badge]} />}
      imageOverlays={
        <MarketingWatchlistHeart
          lotId={card.lotId}
          lotTitle={card.title}
          initialWatching
          isAuthenticated
          loginNextPath={CLIENT_ROUTES.watching}
        />
      }
      adaptiveMedia={{
        src: card.image,
        objectFit: "contain",
        slots: LOT_CARD_GRID_SLOTS,
        alt: card.title,
        sizes: "(max-width: 768px) 50vw, 25vw",
        label: "Lot artwork",
      }}
      title={
        <>
          {card.lotLabel ? (
            <p className="font-body text-xs font-semibold text-on-surface">{card.lotLabel}</p>
          ) : null}
          <h3 className="mt-1 line-clamp-2 font-headline text-sm font-semibold text-on-surface md:text-base">
            {card.title}
          </h3>
          {card.estimate ? (
            <p className="mt-1 line-clamp-1 font-body text-xs text-on-surface-variant md:text-sm">
              {card.estimate}
            </p>
          ) : null}
        </>
      }
      meta={
        <p className="mt-2 flex flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5 font-body text-sm">
          <span className="font-medium tabular-nums text-on-surface">{card.figure}</span>
          <span className="shrink-0 text-on-surface-variant">
            {card.timing.kind === "countdown" ? (
              <BidCloseCountdown endsAt={card.timing.endsAt} />
            ) : (
              card.timing.label
            )}
          </span>
        </p>
      }
    />
  );
}
