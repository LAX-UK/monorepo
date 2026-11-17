import { LOT_CARD_STATUS_CORNER, LotCard } from "@/components/lot-card/lot-card";
import { lotCardGridAction } from "@/components/lot-card/lot-card-action";
import { LotCardBidderState } from "@/components/lot-card/lot-card-bidder-state";
import { LotCardLine } from "@/components/lot-card/lot-card-line";
import { LotCardQuickLook } from "@/components/lot-card/lot-card-quick-look";
import { LotEstimateLine } from "@/components/lot-card/lot-estimate-line";
import { lotQuickLookFromLot } from "@/components/marketing/lot-quick-look/mappers";
import { LotStatusBadge } from "@/components/marketing/lot-status-badge";
import { OwnerBadge } from "@/components/marketing/owner-badge";
import { MarketingWatchlistHeart } from "@/components/marketing/watchlist-heart-button";
import { MediaImage } from "@/components/ui/media-image";
import { lotCardLineModel, lotCardShowsStatusBadge } from "@/lib/lot-card/lot-card-line";
import { lotEstimateLine } from "@/lib/lot-marketing-display";
import { toCatalogLotVM } from "@/lib/lot/to-catalog-lot-vm";
import { lotStatusBadgeProps } from "@/lib/presenters/lot-status-badge-props";
import { lotPath } from "@/lib/seo/url";
import { MarketingWorkGrid } from "@auction/marketing-ui/marketing-work-card";
import type { Lot } from "@auction/types";
import { isPublicLotStatus } from "@auction/validators";

/** Who is looking, for each work's save heart and quick look. */
export type ArtistWorksWatch = {
  isAuthenticated: boolean;
  watchedLotIds: readonly string[];
  /** Where signing in from a heart comes back to: the artist page. */
  loginNextPath: string;
};

type Props = {
  lots: Lot[];
  currentUserId: string | null;
  /** Names the list for assistive technology: "On sale" or "Past results". */
  label: string;
  watch: ArtistWorksWatch;
};

function lotYearMedium(lot: Lot): string | null {
  const year = lot.createdAt instanceof Date ? lot.createdAt.getUTCFullYear() : null;
  const medium = lot.medium?.trim() || null;
  if (year && medium) return `${year} · ${medium}`;
  if (year) return String(year);
  if (medium) return medium;
  return null;
}

/** One of the artist's works as the one lot card. */
function ArtistWork({
  lot,
  currentUserId,
  watch,
}: {
  lot: Lot;
  currentUserId: string | null;
  watch: ArtistWorksWatch;
}) {
  const href = lotPath(lot);
  const line = lotCardLineModel(lot, new Date());
  const owned = Boolean(currentUserId && lot.sellerId === currentUserId);
  const watchable = lot.status === "active" || lot.status === "scheduled";
  return (
    <LotCard
      href={href}
      title={lot.title}
      lotLabel={lot.lotNumber != null ? `Lot ${lot.lotNumber}` : null}
      mediaStyle="wall"
      media={
        <MediaImage
          src={lot.images[0]}
          alt={lot.title}
          label="Lot artwork"
          sizes="(max-width: 768px) 50vw, (max-width: 1280px) 33vw, 25vw"
        />
      }
      badge={owned ? <OwnerBadge owned /> : null}
      status={
        isPublicLotStatus(lot.status) && lotCardShowsStatusBadge(line) ? (
          <div className={LOT_CARD_STATUS_CORNER}>
            <LotStatusBadge {...lotStatusBadgeProps(lot)} />
          </div>
        ) : null
      }
      save={
        watchable ? (
          <MarketingWatchlistHeart
            lotId={lot.id}
            lotTitle={lot.title}
            initialWatching={watch.watchedLotIds.includes(lot.id)}
            isAuthenticated={watch.isAuthenticated}
            loginNextPath={watch.loginNextPath}
            layout="inline"
            surface="inline"
          />
        ) : null
      }
      quickLook={<LotCardQuickLook vm={lotQuickLookFromLot(toCatalogLotVM(lot))} options={watch} />}
      subtitle={lotYearMedium(lot)}
      meta={
        <>
          <LotEstimateLine value={lotEstimateLine(lot)} />
          <LotCardLine model={line} />
          <LotCardBidderState lotId={lot.id} lotHref={href} lotTitle={lot.title} />
        </>
      }
      action={lotCardGridAction({ ...lot, href })}
    />
  );
}

export function ArtistWorksGrid({ lots, currentUserId, label, watch }: Props) {
  return (
    <MarketingWorkGrid aria-label={label}>
      {lots.map((lot) => (
        <ArtistWork key={lot.id} lot={lot} currentUserId={currentUserId} watch={watch} />
      ))}
    </MarketingWorkGrid>
  );
}
