import { LotCardBidderState } from "@/components/lot-card/lot-card-bidder-state";
import { LotCardLine } from "@/components/lot-card/lot-card-line";
import { LotEstimateLine } from "@/components/lot-card/lot-estimate-line";
import { MarketingWatchlistHeart } from "@/components/marketing/watchlist-heart-button";
import { MediaImage } from "@/components/ui/media-image";
import type { HomeLotCard } from "@/lib/home-sections/types";
import { MarketingWorkCard, MarketingWorkGrid } from "@auction/marketing-ui/marketing-work-card";

export type HomeLotWatch = {
  isAuthenticated: boolean;
  watchedLotIds: readonly string[];
};

function LotCard({ lot, watch }: { lot: HomeLotCard; watch: HomeLotWatch }) {
  return (
    <MarketingWorkCard
      href={lot.href}
      title={lot.title}
      mediaStyle={lot.displayStyle}
      media={
        <MediaImage
          src={lot.imageUrl}
          alt={lot.title}
          label="Lot artwork"
          sizes="(max-width: 768px) 50vw, (max-width: 1280px) 33vw, 25vw"
        />
      }
      {...(lot.watchable
        ? {
            overlayAction: (
              <MarketingWatchlistHeart
                lotId={lot.id}
                lotTitle={lot.title}
                initialWatching={watch.watchedLotIds.includes(lot.id)}
                isAuthenticated={watch.isAuthenticated}
                loginNextPath="/"
                layout="inline"
                surface="onImage"
              />
            ),
          }
        : {})}
      {...(lot.artistName ? { subtitle: <p className="line-clamp-1">{lot.artistName}</p> } : {})}
      details={lot.details.map((line) => (
        <p key={line} className="line-clamp-1">
          {line}
        </p>
      ))}
      footer={
        <div className="flex w-full min-w-0 flex-col gap-1.5">
          <LotEstimateLine value={lot.estimate} />
          <LotCardLine model={lot.line} />
          <LotCardBidderState lotId={lot.id} lotHref={lot.href} lotTitle={lot.title} />
        </div>
      }
    />
  );
}

/** Lots as the shared work cards. The sections around it say which lots these are. */
export function HomeLotGrid({
  lots,
  label,
  watch,
}: {
  lots: readonly HomeLotCard[];
  label: string;
  watch: HomeLotWatch;
}) {
  return (
    <MarketingWorkGrid aria-label={label}>
      {lots.map((lot) => (
        <LotCard key={lot.id} lot={lot} watch={watch} />
      ))}
    </MarketingWorkGrid>
  );
}
