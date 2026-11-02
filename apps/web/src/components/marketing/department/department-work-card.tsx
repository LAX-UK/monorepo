import { LotStatusBadge } from "@/components/marketing/lot-status-badge";
import { MediaImage } from "@/components/ui/media-image";
import { lotEstimateLine } from "@/lib/lot-marketing-display";
import { lotPriceDisplay } from "@/lib/lot-price-display";
import { lotStatusBadgeProps } from "@/lib/presenters/lot-status-badge-props";
import { lotPath } from "@/lib/seo/url";
import { MarketingWorkCard } from "@auction/marketing-ui";
import type { Lot } from "@auction/types";
import { isPublicLotStatus } from "@auction/validators";

type Props = {
  lot: Lot;
  /** Replaces the lot's own price line: a sold work's price with the buyer's premium. */
  price?: { label: string; value: string };
};

/** One work in a department row: the shared work card with the lot's status, medium and price. */
export function DepartmentWorkCard({ lot, price }: Props) {
  const estimate = lotEstimateLine(lot);
  const medium = lot.medium?.trim() || null;
  const line = price ?? lotPriceDisplay(lot);
  return (
    <MarketingWorkCard
      href={lotPath(lot)}
      title={lot.title}
      media={
        <MediaImage
          src={lot.images[0]}
          alt={lot.title}
          label="Lot artwork"
          sizes="(max-width: 768px) 50vw, 25vw"
        />
      }
      {...(isPublicLotStatus(lot.status)
        ? { mediaStatus: <LotStatusBadge {...lotStatusBadgeProps(lot)} /> }
        : {})}
      details={
        <>
          {medium ? <p className="line-clamp-1">{medium}</p> : null}
          {estimate ? <p className="line-clamp-1">Estimate {estimate}</p> : null}
        </>
      }
      footer={
        <p className="line-clamp-1">
          {line.label} {line.value}
        </p>
      }
    />
  );
}
