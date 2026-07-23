"use client";

import { AdminStatusBadge } from "@/components/admin/admin-status-badge";
import { AdminTableDateTimeCell } from "@/components/admin/admin-table-datetime-cell";
import { CatalogMobileCardShell } from "@/components/admin/catalog/catalog-mobile-card-shell";
import type { AdminConditionReportRequestRow } from "@/lib/data/http/admin-condition-reports.shared";
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
          status={
            <div className="flex flex-col gap-1.5">
              <AdminStatusBadge domain="conditionReport" status={row.status} />
              <span className="truncate font-body text-[10px] text-on-surface-variant">
                {row.requesterEmail ?? row.requestedByUserId}
                {row.createdAt ? (
                  <>
                    {" · "}
                    <AdminTableDateTimeCell
                      iso={row.createdAt}
                      mode="timestamp"
                      className="inline-block"
                    />
                  </>
                ) : null}
              </span>
            </div>
          }
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
        />
      ))}
    </ul>
  );
}
