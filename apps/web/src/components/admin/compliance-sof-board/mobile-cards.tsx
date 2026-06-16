"use client";

import { AdminStatusBadge } from "@/components/admin/admin-status-badge";
import type { AdminSofTableRow } from "@/lib/data/view-models/admin-sof-table.vm";
import Link from "next/link";

type Props = {
  rows: AdminSofTableRow[];
};

export function SofMobileCards({ rows }: Props) {
  return (
    <ul className="space-y-2">
      {rows.map((row) => (
        <li key={row.id} className="relative">
          <div className="rounded-lg border border-outline-variant/40 p-4 text-left">
            <div className="flex flex-wrap items-center gap-2">
              <AdminStatusBadge domain="sofCase" status={row.displayStatus} />
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
            <p className="mt-1 font-body text-xs text-on-surface-variant">
              {row.triageLabel} · Opened {row.openedLabel}
            </p>
            <Link
              href={`/admin/compliance/source-of-funds/${row.id}`}
              className="absolute inset-0 z-0 rounded-lg"
              aria-label={`Review source of funds case for ${row.buyerLabel}`}
            >
              <span className="sr-only">Review case</span>
            </Link>
          </div>
        </li>
      ))}
    </ul>
  );
}
