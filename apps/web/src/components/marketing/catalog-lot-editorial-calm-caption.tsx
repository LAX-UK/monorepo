"use client";

import { LotStatusBadge } from "@/components/marketing/lot-status-badge";
import { formatMoney } from "@/lib/format-currency";
import type { Lot } from "@auction/types";

type CatalogLotEditorialCalmCaptionProps = {
  lot: Lot;
  title: string;
  subtitle: string | null;
  estimate: string | null;
};

/** Client-rendered caption for editorial calm cards — avoids RSC slot key warnings. */
export function CatalogLotEditorialCalmCaption({
  lot,
  title,
  subtitle,
  estimate,
}: CatalogLotEditorialCalmCaptionProps) {
  return (
    <div className="space-y-2">
      <div className="space-y-2">
        <h2 className="font-headline text-2xl font-light leading-tight text-on-surface group-hover:text-primary">
          {title}
        </h2>
        {subtitle ? <p className="font-body text-sm text-on-surface-variant">{subtitle}</p> : null}
        {lot.status !== "draft" ? (
          <LotStatusBadge
            status={lot.status}
            startTime={lot.startTime.toISOString()}
            endTime={lot.endTime.toISOString()}
          />
        ) : null}
      </div>
      <div className="flex flex-wrap items-baseline justify-between gap-4 pt-2">
        <p className="font-label text-xs uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-primary">
          {formatMoney(lot.currentPrice)}
        </p>
        {estimate ? (
          <p className="font-label text-[length:var(--text-label-2)] uppercase tracking-wider text-on-surface-variant">
            Est. {estimate}
          </p>
        ) : null}
      </div>
    </div>
  );
}
