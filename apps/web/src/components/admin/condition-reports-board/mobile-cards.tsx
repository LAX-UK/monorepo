"use client";

import { AdminStatusBadge } from "@/components/admin/admin-status-badge";
import { CatalogMobileCardShell } from "@/components/admin/catalog/catalog-mobile-card-shell";
import type { AdminConditionReportRequestRow } from "@/lib/data/http/admin.server";
import { Button } from "@auction/ui/components/button";

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
        <CatalogMobileCardShell
          key={row.id}
          id={row.id}
          title={row.lotTitle ?? row.lotId}
          selectionLabel={`Open ${row.lotTitle ?? "request"}`}
          status={<AdminStatusBadge domain="conditionReport" status={row.status} />}
          footer={
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="min-h-11 w-full"
              onClick={() => onOpen(row)}
            >
              Open
            </Button>
          }
        >
          <p className="font-headline text-sm text-on-surface">{row.lotTitle ?? row.lotId}</p>
          <p className="mt-1 font-body text-xs text-on-surface-variant">
            Lot {row.lotId.slice(0, 8)}…
          </p>
        </CatalogMobileCardShell>
      ))}
    </ul>
  );
}
