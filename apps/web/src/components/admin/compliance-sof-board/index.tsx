"use client";

import { AdminDataTable } from "@/components/admin/admin-data-table";
import { AdminPreviewSheetHeader } from "@/components/admin/admin-preview-sheet-header";
import { sofColumns } from "@/components/admin/compliance-sof-board/columns";
import { SofDrawerContent } from "@/components/admin/compliance-sof-board/drawer";
import { SofMobileCards } from "@/components/admin/compliance-sof-board/mobile-cards";
import { useTableDensity } from "@/components/layout/density-provider";
import type { AdminSofTableRow } from "@/lib/data/view-models/admin-sof-table.vm";
import { EntityList, Sheet, SheetContent } from "@auction/ui";
import { useCallback, useMemo, useState } from "react";

type Props = {
  rows: AdminSofTableRow[];
  canTriage: boolean;
  canDecide: boolean;
  currentUserId: string;
};

export function ComplianceSofBoard({ rows, canTriage, canDecide, currentUserId }: Props) {
  const { density } = useTableDensity();
  const [selected, setSelected] = useState<AdminSofTableRow | null>(null);
  const onOpen = useCallback((row: AdminSofTableRow) => setSelected(row), []);
  const columns = useMemo(() => sofColumns(onOpen), [onOpen]);

  return (
    <>
      <EntityList
        responsiveMode="auto"
        density={density}
        table={
          <AdminDataTable
            ariaLabel="Source of Funds cases pending review"
            columns={columns}
            data={rows}
            emptyMessage="No pending Source of Funds cases."
            density={density}
            getRowId={(r) => r.id}
            stickyFirstColumn
          />
        }
        cards={<SofMobileCards rows={rows} onOpen={onOpen} />}
      />

      <Sheet open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <SheetContent side="right" className="w-full max-w-lg overflow-y-auto">
          {selected ? (
            <SofDrawerContent
              row={selected}
              canTriage={canTriage}
              canDecide={canDecide}
              currentUserId={currentUserId}
            />
          ) : (
            <AdminPreviewSheetHeader title="Source of Funds" />
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}
