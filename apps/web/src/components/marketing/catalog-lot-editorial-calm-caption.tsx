"use client";

import { LotCardBidderState } from "@/components/lot-card/lot-card-bidder-state";
import { LotCardLine } from "@/components/lot-card/lot-card-line";
import { LotEstimateLine } from "@/components/lot-card/lot-estimate-line";
import { LotStatusBadge } from "@/components/marketing/lot-status-badge";
import { isPublicLotStatus } from "@/lib/catalog/public-catalog-visibility";
import { lotCardLineModel, lotCardShowsStatusBadge } from "@/lib/lot-card/lot-card-line";
import { lotStatusBadgeProps } from "@/lib/presenters/lot-status-badge-props";
import type { CatalogLotVM } from "@auction/types";

type CatalogLotEditorialCalmCaptionProps = {
  lot: CatalogLotVM;
  title: string;
  subtitle: string | null;
  estimate: string | null;
  /** The lot page, so an outbid bidder can go straight to bidding. */
  lotHref: string;
};

/** Client-rendered caption for editorial calm cards — avoids RSC slot key warnings. */
export function CatalogLotEditorialCalmCaption({
  lot,
  title,
  subtitle,
  estimate,
  lotHref,
}: CatalogLotEditorialCalmCaptionProps) {
  const line = lotCardLineModel(lot, new Date());
  return (
    <div className="space-y-2">
      <div className="space-y-2">
        <h2 className="font-headline text-[length:var(--text-display-sm)] font-medium leading-tight text-on-surface group-hover:text-link">
          {title}
        </h2>
        {subtitle ? <p className="font-body text-sm text-on-surface-variant">{subtitle}</p> : null}
        {isPublicLotStatus(lot.status) && lotCardShowsStatusBadge(line) ? (
          <LotStatusBadge {...lotStatusBadgeProps(lot)} />
        ) : null}
      </div>
      <div className="flex flex-col gap-1.5 pt-2">
        <LotEstimateLine value={estimate} />
        <LotCardLine model={line} />
        <LotCardBidderState lotId={lot.id} lotHref={lotHref} lotTitle={title} />
      </div>
    </div>
  );
}
