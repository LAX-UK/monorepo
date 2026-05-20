"use client";

import { AdminStatusBadge } from "@/components/admin/admin-status-badge";
import type { AdminPayoutRow } from "@/lib/data/http/admin.server";
import { formatMoney } from "@/lib/ui/format";
import { Button } from "@auction/ui";

export function PayoutsMobileCards({
  rows,
  onOpen,
}: {
  rows: AdminPayoutRow[];
  onOpen: (row: AdminPayoutRow) => void;
}) {
  return (
    <ul className="space-y-3">
      {rows.map((row) => (
        <li
          key={row.id}
          className="rounded-lg border border-border-hairline bg-surface-container-low/30 p-4"
        >
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="font-mono text-xs text-on-surface-variant">{row.id.slice(0, 12)}…</p>
              <p className="mt-1 text-sm font-medium tabular-nums">
                {formatMoney(row.netAmount, row.currency)}
              </p>
            </div>
            <AdminStatusBadge domain="payout" status={row.status} />
          </div>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="mt-3"
            onClick={() => onOpen(row)}
          >
            Details
          </Button>
        </li>
      ))}
    </ul>
  );
}
