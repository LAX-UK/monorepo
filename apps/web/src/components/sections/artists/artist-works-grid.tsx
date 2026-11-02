import { LotStatusBadge } from "@/components/marketing/lot-status-badge";
import { OwnerBadge } from "@/components/marketing/owner-badge";
import { MediaImage } from "@/components/ui/media-image";
import { lotEstimateLine } from "@/lib/lot-marketing-display";
import { lotPriceDisplay } from "@/lib/lot-price-display";
import { lotStatusBadgeProps } from "@/lib/presenters/lot-status-badge-props";
import { lotPath } from "@/lib/seo/url";
import { MarketingWorkCard, MarketingWorkGrid } from "@auction/marketing-ui";
import type { Lot } from "@auction/types";
import { isPublicLotStatus } from "@auction/validators";

type Props = {
  lots: Lot[];
  currentUserId: string | null;
  /** Names the list for assistive technology: "On sale" or "Past results". */
  label: string;
};

type LotCatalogCardProps = {
  lot: Lot;
  currentUserId: string | null;
};

function lotYearMedium(lot: Lot): string | null {
  const year = lot.createdAt instanceof Date ? lot.createdAt.getUTCFullYear() : null;
  const medium = lot.medium?.trim() || null;
  if (year && medium) return `${year} \u00B7 ${medium}`;
  if (year) return String(year);
  if (medium) return medium;
  return null;
}

function LotCatalogCard({ lot, currentUserId }: LotCatalogCardProps) {
  const est = lotEstimateLine(lot);
  const price = lotPriceDisplay(lot);
  const yearMedium = lotYearMedium(lot);
  const owned = Boolean(currentUserId && lot.sellerId === currentUserId);

  return (
    <MarketingWorkCard
      href={lotPath(lot)}
      title={lot.title}
      media={
        <MediaImage
          src={lot.images[0]}
          alt={lot.title}
          label="Lot artwork"
          sizes="(max-width: 768px) 50vw, (max-width: 1280px) 33vw, 25vw"
        />
      }
      {...(owned ? { mediaBadge: <OwnerBadge owned /> } : {})}
      {...(isPublicLotStatus(lot.status)
        ? { mediaStatus: <LotStatusBadge {...lotStatusBadgeProps(lot)} /> }
        : {})}
      details={
        <>
          {yearMedium ? <p className="line-clamp-1">{yearMedium}</p> : null}
          {est ? <p className="line-clamp-1">Estimate {est}</p> : null}
        </>
      }
      footer={
        <p className="line-clamp-1">
          {price.label} {price.value}
        </p>
      }
    />
  );
}

export function ArtistWorksGrid({ lots, currentUserId, label }: Props) {
  return (
    <MarketingWorkGrid aria-label={label}>
      {lots.map((lot) => (
        <LotCatalogCard key={lot.id} lot={lot} currentUserId={currentUserId} />
      ))}
    </MarketingWorkGrid>
  );
}
