"use client";

import { AdminStatusBadge } from "@/components/admin/admin-status-badge";
import { AdminTableMoneyCell } from "@/components/admin/admin-table-money-cell";
import type { AdminPayoutBoardRow } from "@/lib/data/view-models/admin-payouts-table.vm";
import { formatDate } from "@/lib/ui/format";
import { Button } from "@auction/ui";
import Link from "next/link";

export function PayoutsMobileCards({
  rows,
  onOpen,
}: {
  rows: AdminPayoutBoardRow[];
  onOpen: (row: AdminPayoutBoardRow) => void;
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
              <AdminTableMoneyCell display={row.netAmountDisplay} emphasis="default" />
              <p className="mt-1 text-xs text-on-surface-variant">
                {formatDate(row.periodStart)} → {formatDate(row.periodEnd)}
              </p>
              <Link
                href={`/admin/legal-entities/${row.legalEntityId}`}
                className="mt-1 inline-block text-xs text-link underline"
              >
                View legal entity
              </Link>
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
