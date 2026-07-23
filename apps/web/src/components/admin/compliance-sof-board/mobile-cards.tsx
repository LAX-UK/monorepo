"use client";

import { AdminStatusBadge } from "@/components/admin/admin-status-badge";
import { SofReopenButton } from "@/components/admin/compliance-sof-board/sof-reopen-button";
import { type SofListStatus, buildSofCaseDetailHref } from "@/lib/admin/sof-list-query";
import type { AdminSofTableRow } from "@/lib/data/view-models/admin-sof-table.vm";
import { Button } from "@auction/ui/components/button";
import Link from "next/link";

type Props = {
  rows: AdminSofTableRow[];
  status: SofListStatus;
  canReopen: boolean;
  listReturnTarget?: string | undefined;
};

export function SofMobileCards({ rows, status, canReopen, listReturnTarget }: Props) {
  if (status === "rejected") {
    return (
      <ul className="space-y-2">
        {rows.map((row) => {
          return (
            <li key={row.id} className="rounded-lg border border-outline-variant/40 p-4">
              <div className="flex flex-wrap items-center gap-2">
                <AdminStatusBadge domain="sofCase" status={row.displayStatus} />
                <span className="font-body text-sm text-on-surface">{row.triggerLabel}</span>
              </div>
              <p className="mt-2 font-body text-sm">
                <Link href={`/admin/clients/${row.userId}`} className="text-link underline">
                  {row.buyerLabel}
                </Link>
              </p>
              {row.settlementSummary ? (
                <p className="mt-1 font-body text-xs text-on-surface-variant">
                  {row.settlementSummary}
                </p>
              ) : null}
              <p className="mt-2 font-body text-sm text-on-surface-variant">{row.exposureLabel}</p>
              <p className="mt-1 font-body text-xs text-on-surface-variant">
                Reviewed {row.reviewedLabel}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button type="button" variant="secondary" size="sm" asChild>
                  <Link href={buildSofCaseDetailHref(row.id, status, listReturnTarget)}>
                    View case
                  </Link>
                </Button>
                {canReopen ? (
                  <SofReopenButton caseId={row.id} variant="outline" size="sm">
                    Reopen for review
                  </SofReopenButton>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>
    );
  }

  return (
    <ul className="space-y-2">
      {rows.map((row) => (
        <li key={row.id} className="relative">
          <div className="rounded-lg border border-outline-variant/40 p-4 text-left">
            <div className="flex flex-wrap items-center gap-2">
              {status === "pending" ? (
                <AdminStatusBadge domain="sofCase" status={row.displayStatus} />
              ) : null}
              <span className="font-body text-sm text-on-surface">{row.triggerLabel}</span>
            </div>
            <p className="relative z-10 mt-2 font-body text-sm">
              <Link
                href={`/admin/clients/${row.userId}`}
                className="text-link underline"
                onClick={(e) => e.stopPropagation()}
              >
                {row.buyerLabel}
              </Link>
            </p>
            {row.settlementSummary ? (
              <p className="mt-1 font-body text-xs text-on-surface-variant">
                {row.settlementSummary}
              </p>
            ) : null}
            <p className="mt-2 font-body text-sm text-on-surface-variant">{row.exposureLabel}</p>
            {status === "pending" ? (
              <p className="mt-1 font-body text-xs text-on-surface-variant">
                {row.triageLabel} · {row.evidenceCount} evidence · Opened {row.openedLabel}
              </p>
            ) : (
              <p className="mt-1 font-body text-xs text-on-surface-variant">
                Reviewed {row.reviewedLabel}
              </p>
            )}
            <Link
              href={buildSofCaseDetailHref(row.id, status, listReturnTarget)}
              className="absolute inset-0 z-0 rounded-lg"
              aria-label={
                status === "pending"
                  ? `Review source of funds case for ${row.buyerLabel}`
                  : `View source of funds case for ${row.buyerLabel}`
              }
            >
              <span className="sr-only">{status === "pending" ? "Review case" : "View case"}</span>
            </Link>
          </div>
        </li>
      ))}
    </ul>
  );
}
