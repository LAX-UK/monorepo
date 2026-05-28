"use client";

import type { InSaleDisplayRow } from "@/app/dashboard/seller/in-sale/in-sale.vm";
import {
  DashboardListRowCard,
  DashboardMobileList,
} from "@/components/dashboard/primitives/dashboard-list-row-card";
import { DashboardLotCountdown } from "@/components/dashboard/primitives/dashboard-lot-countdown";
import { MediaImage } from "@/components/ui/media-image";
import { StatusBadge } from "@auction/ui/components/status-badge";
import Link from "next/link";

function badgeVariant(tone: InSaleDisplayRow["statusTone"]) {
  switch (tone) {
    case "success":
      return "success" as const;
    case "danger":
      return "danger" as const;
    case "info":
      return "info" as const;
    case "neutral":
      return "neutral" as const;
  }
}

function ReserveBadge({ row }: { row: InSaleDisplayRow }) {
  if (row.reserveLabel === "No reserve") {
    return <span className="text-xs text-on-surface-variant">{row.reserveLabel}</span>;
  }
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[var(--text-label-caps-tracking,0.22em)] ${
        row.reserveMet ? "bg-success/10 text-success" : "bg-error/10 text-error"
      }`}
    >
      {row.reserveLabel}
    </span>
  );
}

type Props = {
  rows: InSaleDisplayRow[];
};

export function InSaleMobileList({ rows }: Props) {
  return (
    <DashboardMobileList>
      {rows.map((row) => (
        <li key={row.id}>
          <DashboardListRowCard
            thumbnail={
              <Link
                href={row.lotHref}
                className="relative size-14 shrink-0 overflow-hidden rounded-lg bg-surface-container-high"
              >
                <MediaImage src={row.imageUrl} alt="" label="Lot artwork" sizes="56px" />
              </Link>
            }
            title={
              <>
                <span className="font-mono text-[10px] text-on-surface-variant tabular-nums">
                  {row.lotNumberLabel}
                </span>
                <Link
                  href={row.lotHref}
                  className="block truncate font-headline text-sm font-semibold text-on-surface underline-offset-4 hover:underline"
                >
                  {row.title}
                </Link>
              </>
            }
            subtitle={
              row.saleTitle && row.saleHref ? (
                <p className="mt-0.5 truncate text-xs text-on-surface-variant">
                  In{" "}
                  <Link href={row.saleHref} className="underline underline-offset-2">
                    {row.saleTitle}
                  </Link>
                </p>
              ) : undefined
            }
            trailing={
              <span className="shrink-0 text-sm font-semibold tabular-nums">
                {row.currentPriceLabel}
              </span>
            }
            badges={
              <>
                <StatusBadge variant={badgeVariant(row.statusTone)} size="sm">
                  {row.statusLabel}
                </StatusBadge>
                <ReserveBadge row={row} />
              </>
            }
            afterBadges={
              row.status === "active" || row.status === "scheduled" ? (
                <div className="mt-1">
                  <DashboardLotCountdown
                    status={row.status}
                    startTime={row.startTimeIso}
                    endTime={row.endTimeIso}
                  />
                </div>
              ) : (
                <p className="mt-1 text-xs text-on-surface-variant">
                  Ends <time dateTime={row.endTimeIso}>{row.endTimeLabel}</time>
                </p>
              )
            }
          />
        </li>
      ))}
    </DashboardMobileList>
  );
}
