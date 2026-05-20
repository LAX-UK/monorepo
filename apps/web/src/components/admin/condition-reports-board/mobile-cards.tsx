"use client";

import type { AdminConditionReportRequestRow } from "@/lib/data/http/admin.server";
import { Button } from "@auction/ui";

export function ConditionReportsMobileCards({
  rows,
  onOpen,
}: {
  rows: AdminConditionReportRequestRow[];
  onOpen: (row: AdminConditionReportRequestRow) => void;
}) {
  return (
    <ul className="space-y-3">
      {rows.map((row) => (
        <li key={row.id} className="rounded-lg border border-border-hairline p-4">
          <p className="font-medium">{row.lotTitle ?? row.lotId}</p>
          <p className="mt-1 text-xs text-on-surface-variant">{row.status.replaceAll("_", " ")}</p>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="mt-3"
            onClick={() => onOpen(row)}
          >
            Open
          </Button>
        </li>
      ))}
    </ul>
  );
}
