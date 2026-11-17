import { LOT_CARD_STATUS_CORNER, LotCard } from "@/components/lot-card/lot-card";
import { lotCardGridAction } from "@/components/lot-card/lot-card-action";
import { LotCardBidderState } from "@/components/lot-card/lot-card-bidder-state";
import { LotCardLine } from "@/components/lot-card/lot-card-line";
import { LotEstimateLine } from "@/components/lot-card/lot-estimate-line";
import { LotStatusBadge } from "@/components/marketing/lot-status-badge";
import { MediaImage } from "@/components/ui/media-image";
import { lotCardLineModel, lotCardShowsStatusBadge } from "@/lib/lot-card/lot-card-line";
import { lotEstimateLine } from "@/lib/lot-marketing-display";
import { lotStatusBadgeProps } from "@/lib/presenters/lot-status-badge-props";
import { lotPath } from "@/lib/seo/url";
import type { DepartmentDisplayStyle } from "@auction/domain";
import type { Lot } from "@auction/types";
import { isPublicLotStatus } from "@auction/validators";

type Props = {
  lot: Lot;
  /** How the lot's department shows its picture; a wall work by default. */
  displayStyle?: DepartmentDisplayStyle;
};

/**
 * One work in a department row (the sell pages): the one lot card with the lot's status, medium
 * and price. These pages are the same for everyone (cached, no viewer read), so the card carries
 * no save heart and no quick look, whose state belongs to the person looking; the picture and the
 * title open the lot page.
 */
export function DepartmentWorkCard({ lot, displayStyle = "wall" }: Props) {
  const href = lotPath(lot);
  const line = lotCardLineModel(lot, new Date());
  return (
    <LotCard
      href={href}
      title={lot.title}
      lotLabel={lot.lotNumber != null ? `Lot ${lot.lotNumber}` : null}
      mediaStyle={displayStyle}
      media={
        <MediaImage
          src={lot.images[0]}
          alt={lot.title}
          label="Lot artwork"
          sizes="(max-width: 768px) 50vw, 25vw"
        />
      }
      status={
        isPublicLotStatus(lot.status) && lotCardShowsStatusBadge(line) ? (
          <div className={LOT_CARD_STATUS_CORNER}>
            <LotStatusBadge {...lotStatusBadgeProps(lot)} />
          </div>
        ) : null
      }
      subtitle={lot.medium?.trim() || null}
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
