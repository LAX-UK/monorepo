"use client";

import { AdminDataTable } from "@/components/admin/admin-data-table";
import { AdminPreviewSheetHeader } from "@/components/admin/admin-preview-sheet-header";
import { disputeColumns } from "@/components/admin/disputes-board/columns";
import { DisputeDrawerContent } from "@/components/admin/disputes-board/drawer";
import { DisputesMobileCards } from "@/components/admin/disputes-board/mobile-cards";
import { useTableDensity } from "@/components/layout/density-provider";
import type { AdminDisputeTableRow } from "@/lib/data/view-models/admin-disputes-table.vm";
import { EntityList, Sheet, SheetContent } from "@auction/ui";
import { useCallback, useMemo, useState } from "react";

type Props = {
  rows: AdminDisputeTableRow[];
};

export function AdminDisputesBoard({ rows }: Props) {
  const { density } = useTableDensity();
  const [selected, setSelected] = useState<AdminDisputeTableRow | null>(null);
  const onOpen = useCallback((row: AdminDisputeTableRow) => setSelected(row), []);
  const columns = useMemo(() => disputeColumns(onOpen), [onOpen]);

  return (
    <>
      <EntityList
        responsiveMode="auto"
        density={density}
        table={
          <AdminDataTable
            ariaLabel="Payment disputes"
            columns={columns}
            data={rows}
            emptyMessage="No disputes match this filter."
            density={density}
            stickyFirstColumn
            showColumnPicker
          />
        }
        cards={<DisputesMobileCards rows={rows} onOpen={onOpen} />}
      />

      <Sheet open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <SheetContent side="right" className="w-full max-w-md overflow-y-auto sm:max-w-lg">
          {selected ? (
            <div className="space-y-4 pt-2">
              <AdminPreviewSheetHeader
                title="Dispute case"
                fullPageHref="/admin/disputes"
                subtitle={
                  <p className="truncate font-body text-sm text-on-surface-variant">
                    {selected.lotTitle ?? selected.stripeDisputeId}
                  </p>
                }
              />
              <DisputeDrawerContent row={selected} onClose={() => setSelected(null)} />
            </div>
          ) : null}
        </SheetContent>
      </Sheet>
    </>
  );
}
