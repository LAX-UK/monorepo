"use client";

import { DashboardMobileLotThumbnail } from "@/components/dashboard/list/dashboard-mobile-lot-thumbnail";
import {
  DashboardListRowCard,
  DashboardMobileList,
} from "@/components/dashboard/primitives/dashboard-list-row-card";
import { useDashboardListRowPaddingClass } from "@/hooks/use-dashboard-list-density";
import {
  isComplianceManualReviewReason,
  manualReviewQueueEyebrow,
} from "@/lib/admin/compliance-manual-review";
import type { PaymentDisplayRow } from "@/lib/data/view-models/dashboard-payments.vm";
import { paymentDisplayDotStatus } from "@/lib/presenters/payment-status";
import { lotPath } from "@/lib/seo/url";
import { Button } from "@auction/ui/components/button";
import { DotStatusPill } from "@auction/ui/components/dot-status-pill";
import Link from "next/link";

function PrimaryAction({ row }: { row: PaymentDisplayRow }) {
  const action = row.primaryAction;
  if (action.kind === "none") {
    return <span className="text-xs text-on-surface-variant">—</span>;
  }
  if (action.kind === "review") {
    return (
      <Link
        href={action.href}
        className="inline-flex min-h-11 items-center text-xs font-semibold text-warning underline underline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        title={`${isComplianceManualReviewReason(action.reason) ? "Compliance" : "Finance"} review required`}
      >
        {manualReviewQueueEyebrow(action.reason)}
      </Link>
    );
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
      className="inline-flex min-h-11 items-center text-xs font-semibold text-link underline underline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
    >
      {action.label}
    </a>
  );
}

type Props = {
  rows: PaymentDisplayRow[];
};

export function PaymentsMobileList({ rows }: Props) {
  const rowPadding = useDashboardListRowPaddingClass();
  return (
    <DashboardMobileList>
      {rows.map((row) => (
        <li key={row.id}>
          <DashboardListRowCard
            className={rowPadding}
            thumbnail={
              <DashboardMobileLotThumbnail
                href={lotPath({ id: row.lotId, title: row.lotTitle })}
                src={row.lotImageUrl}
                alt={`${row.lotTitle} thumbnail`}
              />
            }
            title={
              <Link
                href={lotPath({ id: row.lotId, title: row.lotTitle })}
                className="block truncate font-headline text-sm font-semibold text-on-surface underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
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
                {(() => {
                  const presentation = paymentDisplayDotStatus(row.statusLabel, row.statusTone);
                  return <DotStatusPill label={presentation.label} tone={presentation.tone} />;
                })()}
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
