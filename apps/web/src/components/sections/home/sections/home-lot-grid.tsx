import { LotCard } from "@/components/lot-card/lot-card";
import { lotCardGridAction } from "@/components/lot-card/lot-card-action";
import { LotCardBidderState } from "@/components/lot-card/lot-card-bidder-state";
import { LotCardLine } from "@/components/lot-card/lot-card-line";
import { LotCardQuickLook } from "@/components/lot-card/lot-card-quick-look";
import { LotEstimateLine } from "@/components/lot-card/lot-estimate-line";
import { lotQuickLookFromHomeLot } from "@/components/marketing/lot-quick-look/mappers";
import { MarketingWatchlistHeart } from "@/components/marketing/watchlist-heart-button";
import { MediaImage } from "@/components/ui/media-image";
import type { HomeLotCard } from "@/lib/home-sections/types";
import { MarketingWorkGrid } from "@auction/marketing-ui/marketing-work-card";

export type HomeLotWatch = {
  isAuthenticated: boolean;
  watchedLotIds: readonly string[];
};

/** A home rail lot as the one lot card: heart on the "Lot N" line, quick look on hover. */
function HomeLot({ lot, watch }: { lot: HomeLotCard; watch: HomeLotWatch }) {
  return (
    <LotCard
      href={lot.href}
      title={lot.title}
      lotLabel={lot.lotLabel}
      mediaStyle={lot.displayStyle}
      media={
        <MediaImage
          src={lot.imageUrl}
          alt={lot.title}
          label="Lot artwork"
          sizes="(max-width: 768px) 50vw, (max-width: 1280px) 33vw, 25vw"
        />
      }
      save={
        lot.watchable ? (
          <MarketingWatchlistHeart
            lotId={lot.id}
            lotTitle={lot.title}
            initialWatching={watch.watchedLotIds.includes(lot.id)}
            isAuthenticated={watch.isAuthenticated}
            loginNextPath="/"
            layout="inline"
            surface="inline"
          />
        ) : null
      }
      quickLook={
        <LotCardQuickLook
          vm={lotQuickLookFromHomeLot(lot)}
          options={{
            isAuthenticated: watch.isAuthenticated,
            watchedLotIds: watch.watchedLotIds,
            loginNextPath: "/",
          }}
        />
      }
      subtitle={lot.artistName}
      meta={
        <>
          <LotEstimateLine value={lot.estimate} />
          <LotCardLine model={lot.line} />
          <LotCardBidderState lotId={lot.id} lotHref={lot.href} lotTitle={lot.title} />
        </>
      }
      action={lotCardGridAction(lot)}
    />
  );
}

/** Lots as the one lot card. The sections around it say which lots these are. */
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
        <HomeLot key={lot.id} lot={lot} watch={watch} />
      ))}
    </MarketingWorkGrid>
  );
}
