"use client";

import { AdminStatusBadge } from "@/components/admin/admin-status-badge";
import type { AdminSofTableRow } from "@/lib/data/view-models/admin-sof-table.vm";

type Props = {
  rows: AdminSofTableRow[];
  onOpen: (row: AdminSofTableRow) => void;
};

export function SofMobileCards({ rows, onOpen }: Props) {
  return (
    <ul className="space-y-2">
      {rows.map((row) => (
        <li key={row.id}>
          <button
            type="button"
            className="w-full rounded-lg border border-outline-variant/40 p-4 text-left"
            onClick={() => onOpen(row)}
          >
            <div className="flex flex-wrap items-center gap-2">
              <AdminStatusBadge domain="sofCase" status={row.status} />
              <span className="font-body text-sm text-on-surface">{row.triggerLabel}</span>
            </div>
            <p className="mt-2 font-body text-sm text-on-surface-variant">{row.exposureLabel}</p>
            <p className="mt-1 font-body text-xs text-on-surface-variant">{row.triageLabel}</p>
          </button>
        </li>
      ))}
    </ul>
  );
}
