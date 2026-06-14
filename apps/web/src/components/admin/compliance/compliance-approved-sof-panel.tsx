"use client";

import { AdminStatusBadge } from "@/components/admin/admin-status-badge";
import type { AdminSourceOfFundsRow } from "@/lib/data/http/compliance.server";
import { buildAdminSofTableRow } from "@/lib/data/view-models/admin-sof-table.vm";
import Link from "next/link";

type Props = {
  rows: AdminSourceOfFundsRow[];
};

export function ComplianceApprovedSofPanel({ rows }: Props) {
  if (rows.length === 0) return null;

  return (
    <section className="space-y-3 rounded-lg border border-outline-variant/40 p-4">
      <h2 className="font-headline text-sm font-semibold text-on-surface">Recently approved</h2>
      <p className="font-body text-sm text-on-surface-variant">
        Approved cases clear the settlement gate for the buyer (subject to validity and exposure
        limits). These cases no longer appear in the pending queue.
      </p>
      <ul className="divide-y divide-outline-variant/30">
        {rows.map((row) => {
          const vm = buildAdminSofTableRow(row);
          return (
            <li key={row.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <div className="flex min-w-0 flex-col gap-1 text-sm sm:flex-row sm:flex-wrap sm:items-center sm:gap-2">
                <Link
                  href={`/admin/clients/${row.userId}`}
                  className="font-medium text-link underline"
                >
                  View client profile
                </Link>
                <AdminStatusBadge domain="sofCase" status="approved" />
                <span className="text-on-surface-variant">
                  {vm.triggerLabel} · {vm.exposureLabel}
                </span>
                {row.reviewedAt ? (
                  <span className="text-on-surface-variant">
                    Approved {new Date(row.reviewedAt).toLocaleDateString()}
                  </span>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
