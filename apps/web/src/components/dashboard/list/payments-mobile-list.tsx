"use client";

import {
  DashboardListRowCard,
  DashboardMobileList,
} from "@/components/dashboard/primitives/dashboard-list-row-card";
import { MediaImage } from "@/components/ui/media-image";
import type { PaymentDisplayRow } from "@/lib/data/view-models/dashboard-payments.vm";
import { lotPath } from "@/lib/seo/url";
import { Button } from "@auction/ui/components/button";
import { StatusBadge } from "@auction/ui/components/status-badge";
import Link from "next/link";

function statusVariant(tone: PaymentDisplayRow["statusTone"]) {
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

function PrimaryAction({ row }: { row: PaymentDisplayRow }) {
  const action = row.primaryAction;
  if (action.kind === "none") {
    return <span className="text-xs text-on-surface-variant">—</span>;
  }
  if (action.kind === "pay") {
    return (
      <Button variant="primary" size="sm" asChild>
        <Link href={action.href}>{action.label}</Link>
      </Button>
    );
  }
  return (
    <a
      href={action.href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={action.ariaLabel}
      className="inline-flex min-h-11 items-center text-xs font-semibold text-primary underline underline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
    >
      {action.label}
    </a>
  );
}

type Props = {
  rows: PaymentDisplayRow[];
};

export function PaymentsMobileList({ rows }: Props) {
  return (
    <DashboardMobileList>
      {rows.map((row) => (
        <li key={row.id}>
          <DashboardListRowCard
            thumbnail={
              <Link
                href={lotPath({ id: row.lotId, title: row.lotTitle })}
                className="relative size-14 shrink-0 overflow-hidden rounded-lg bg-surface-container-high focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                aria-label={`View ${row.lotTitle}`}
              >
                <MediaImage src={row.lotImageUrl} alt="" label="Lot artwork" sizes="56px" />
              </Link>
            }
            title={
              <Link
                href={lotPath({ id: row.lotId, title: row.lotTitle })}
                className="block truncate font-headline text-sm font-semibold text-on-surface underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              >
                {row.lotTitle}
              </Link>
            }
            subtitle={
              <p className="text-xs text-on-surface-variant">
                <time dateTime={row.createdAtIso}>{row.createdAtLabel}</time>
                {row.invoiceNumber ? <> · Invoice {row.invoiceNumber}</> : null}
              </p>
            }
            badges={
              <>
                <span className="text-base font-semibold tabular-nums text-on-surface">
                  {row.amountLabel}
                </span>
                <StatusBadge variant={statusVariant(row.statusTone)} size="sm">
                  {row.statusLabel}
                </StatusBadge>
              </>
            }
            footer={<PrimaryAction row={row} />}
            footerIndented
          />
        </li>
      ))}
    </DashboardMobileList>
  );
}
