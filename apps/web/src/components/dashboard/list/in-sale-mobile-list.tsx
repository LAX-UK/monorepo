"use client";

import type { InSaleDisplayRow } from "@/app/dashboard/seller/in-sale/in-sale.vm";
import { DashboardMobileLotThumbnail } from "@/components/dashboard/list/dashboard-mobile-lot-thumbnail";
import {
  DashboardDesktopList,
  DashboardListRowCard,
  DashboardMobileList,
} from "@/components/dashboard/primitives/dashboard-list-row-card";
import { DashboardLotCountdown } from "@/components/dashboard/primitives/dashboard-lot-countdown";
import { useDashboardListRowPaddingClass } from "@/hooks/use-dashboard-list-density";
import { StatusBadge } from "@auction/ui/components/status-badge";
import { Surface } from "@auction/ui/components/surface";
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
  const rowPadding = useDashboardListRowPaddingClass();
  return (
    <DashboardMobileList>
      {rows.map((row) => (
        <li key={row.id}>
          <DashboardListRowCard
            className={rowPadding}
            thumbnail={<DashboardMobileLotThumbnail href={row.lotHref} src={row.imageUrl} />}
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
              row.status === "ended" ? (
                <p className="mt-2">
                  <Link
                    href="/dashboard/submissions/new"
                    className="font-body text-xs text-link underline-offset-4 hover:underline"
                  >
                    Sell again
                  </Link>
                </p>
              ) : row.status === "active" || row.status === "scheduled" ? (
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

function InSaleDesktopRowCard({ row }: { row: InSaleDisplayRow }) {
  return (
    <li className="lift-row">
      <Surface variant="card" padding="md">
        <div className="grid gap-3 text-sm sm:grid-cols-[auto_1fr_auto_auto_auto] sm:items-center">
          <div className="font-mono text-xs text-on-surface-variant tabular-nums sm:min-w-12">
            {row.lotNumberLabel}
          </div>
          <div className="min-w-0">
            <Link
              href={row.lotHref}
              className="block truncate font-headline text-sm font-semibold text-on-surface underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              {row.title}
            </Link>
            {row.saleTitle && row.saleHref ? (
              <p className="text-xs text-on-surface-variant">
                In{" "}
                <Link
                  href={row.saleHref}
                  className="underline underline-offset-2 hover:text-on-surface focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                >
                  {row.saleTitle}
                </Link>
                {" · ends "}
                <time dateTime={row.endTimeIso}>{row.endTimeLabel}</time>
              </p>
            ) : (
              <p className="text-xs text-on-surface-variant">
                Ends <time dateTime={row.endTimeIso}>{row.endTimeLabel}</time>
              </p>
            )}
          </div>
          <div className="text-right text-base font-semibold tabular-nums">
            {row.currentPriceLabel}
          </div>
          <div className="flex items-center justify-end">
            <ReserveBadge row={row} />
          </div>
          <div className="flex items-center justify-end gap-2">
            <StatusBadge variant={badgeVariant(row.statusTone)} size="sm">
              {row.statusLabel}
            </StatusBadge>
            {row.status === "ended" ? (
              <Link
                href="/dashboard/submissions/new"
                className="font-body text-xs text-link underline-offset-4 hover:underline"
              >
                Sell again
              </Link>
            ) : null}
          </div>
        </div>
      </Surface>
    </li>
  );
}

export function InSaleDesktopList({ rows }: Props) {
  return (
    <DashboardDesktopList className="overflow-visible border-0 bg-transparent shadow-none ring-0">
      <ul className="space-y-3">
        {rows.map((row) => (
          <InSaleDesktopRowCard key={row.id} row={row} />
        ))}
      </ul>
    </DashboardDesktopList>
  );
}
