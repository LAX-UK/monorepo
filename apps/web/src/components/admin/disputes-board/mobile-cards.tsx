"use client";

import { AdminStatusBadge } from "@/components/admin/admin-status-badge";
import { AdminTableMoneyCell } from "@/components/admin/admin-table-money-cell";
import type { AdminDisputeTableRow } from "@/lib/data/view-models/admin-disputes-table.vm";
import { formatDateTime } from "@/lib/ui/format";
import { Button } from "@auction/ui/components/button";
import { Surface } from "@auction/ui/components/surface";

type Props = {
  rows: AdminDisputeTableRow[];
  onOpen: (row: AdminDisputeTableRow) => void;
};

export function DisputesMobileCards({ rows, onOpen }: Props) {
  return (
    <ul className="space-y-3">
      {rows.map((row) => (
        <li key={row.stripeDisputeId}>
          <Button
            type="button"
            variant="ghost"
            className="h-auto w-full justify-start p-0 text-left whitespace-normal hover:bg-transparent"
            onClick={() => onOpen(row)}
          >
            <Surface variant="quiet" padding="md" className="space-y-2">
              <div className="flex items-start justify-between gap-2">
                <p className="font-body text-sm font-medium text-on-surface">
                  {row.lotTitle ?? "Dispute case"}
                </p>
                <AdminStatusBadge domain="dispute" status={row.status} />
              </div>
              <AdminTableMoneyCell display={row.amountDisplay} emphasis="default" />
              <p className="font-body text-xs text-on-surface-variant">
                {row.reasonLabel} · opened {formatDateTime(row.openedAt)}
              </p>
            </Surface>
          </Button>
        </li>
      ))}
    </ul>
  );
}
