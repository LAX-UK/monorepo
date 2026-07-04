"use client";

import { AdminStatusBadge } from "@/components/admin/admin-status-badge";
import type { AdminAmlTableRow } from "@/lib/data/view-models/admin-aml-table.vm";
import { Button } from "@auction/ui/components/button";

type Props = {
  rows: AdminAmlTableRow[];
  onOpen: (row: AdminAmlTableRow) => void;
};

export function AmlMobileCards({ rows, onOpen }: Props) {
  return (
    <ul className="space-y-2">
      {rows.map((row) => (
        <li key={row.id}>
          <Button
            type="button"
            variant="ghost"
            className="h-auto w-full justify-start rounded-lg border border-outline-variant/40 p-4 text-left whitespace-normal"
            onClick={() => onOpen(row)}
          >
            <div className="flex flex-wrap items-center gap-2">
              <AdminStatusBadge domain="amlMatch" status={row.matchStatus} />
              <AdminStatusBadge domain="amlDecision" status={row.decisionOutcome} />
            </div>
            <p className="mt-2 font-body text-sm text-on-surface">{row.triageLabel}</p>
            <p className="mt-1 font-body text-xs text-on-surface-variant">
              {row.categoriesLabel} · {row.totalHits} hit{row.totalHits === 1 ? "" : "s"}
            </p>
          </Button>
        </li>
      ))}
    </ul>
  );
}
