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
import { MarketingWorkCard } from "@auction/marketing-ui";
import type { Lot } from "@auction/types";
import { isPublicLotStatus } from "@auction/validators";

type Props = {
  lot: Lot;
  /** How the lot's department shows its picture; a wall work by default. */
  displayStyle?: DepartmentDisplayStyle;
};

/** One work in a department row: the shared work card with the lot's status, medium and price. */
export function DepartmentWorkCard({ lot, displayStyle = "wall" }: Props) {
  const estimate = lotEstimateLine(lot);
  const medium = lot.medium?.trim() || null;
  const line = lotCardLineModel(lot, new Date());
  return (
    <MarketingWorkCard
      href={lotPath(lot)}
      title={lot.title}
      mediaStyle={displayStyle}
      media={
        <MediaImage
          src={lot.images[0]}
          alt={lot.title}
          label="Lot artwork"
          sizes="(max-width: 768px) 50vw, 25vw"
        />
      }
      {...(isPublicLotStatus(lot.status) && lotCardShowsStatusBadge(line)
        ? { mediaStatus: <LotStatusBadge {...lotStatusBadgeProps(lot)} /> }
        : {})}
      details={
        <>
          {medium ? <p className="line-clamp-1">{medium}</p> : null}
          <LotEstimateLine value={estimate} />
        </>
      }
      footer={
        <div className="flex w-full min-w-0 flex-col gap-1.5">
          <LotCardLine model={line} />
          <LotCardBidderState lotId={lot.id} lotHref={lotPath(lot)} lotTitle={lot.title} />
        </div>
      }
    />
  );
}
