"use client";

import { AdminDataTable } from "@/components/admin/admin-data-table";
import { AdminLotFulfilmentQueueCard } from "@/components/admin/admin-lot-fulfilment-queue-card";
import { AdminPreviewSheetHeader } from "@/components/admin/admin-preview-sheet-header";
import { lotFulfilmentColumns } from "@/components/admin/lot-fulfilment-board/columns";
import { useTableDensity } from "@/components/layout/density-provider";
import type { AdminLotFulfilmentListRow } from "@/lib/data/http/admin.server";
import { EntityList, Sheet, SheetContent } from "@auction/ui";
import type { ReactNode } from "react";
import { useCallback, useMemo, useState } from "react";

type Props = {
  rows: AdminLotFulfilmentListRow[];
  returnStatus: string;
  statusChips?: ReactNode;
};

export function AdminLotFulfilmentBoard({ rows, returnStatus, statusChips }: Props) {
  const { density } = useTableDensity();
  const [selected, setSelected] = useState<AdminLotFulfilmentListRow | null>(null);
  const onOpen = useCallback((row: AdminLotFulfilmentListRow) => setSelected(row), []);
  const columns = useMemo(() => lotFulfilmentColumns(onOpen), [onOpen]);

  return (
    <>
      <EntityList
        responsiveMode="auto"
        density={density}
        {...(statusChips ? { filters: statusChips } : {})}
        table={
          <AdminDataTable
            ariaLabel="Lot fulfilment"
            columns={columns}
            data={rows}
            emptyMessage="No fulfilment rows in this view."
            density={density}
            getRowId={(r) => r.id}
          />
        }
        cards={
          <ul className="space-y-4">
            {rows.map((row) => (
              <AdminLotFulfilmentQueueCard key={row.id} row={row} returnStatus={returnStatus} />
            ))}
          </ul>
        }
      />
      <Sheet open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <SheetContent side="right" className="w-full max-w-md overflow-y-auto sm:max-w-lg">
          {selected ? (
            <div className="space-y-4 pt-2">
              <AdminPreviewSheetHeader
                title={selected.lotTitle ?? "Lot fulfilment"}
                fullPageHref={`/admin/lots/${selected.lotId}`}
                subtitle={
                  <p className="text-sm text-on-surface-variant">
                    {selected.status.replaceAll("_", " ")}
                  </p>
                }
              />
              <AdminLotFulfilmentQueueCard row={selected} returnStatus={returnStatus} embedded />
            </div>
          ) : null}
        </SheetContent>
      </Sheet>
    </>
  );
}
