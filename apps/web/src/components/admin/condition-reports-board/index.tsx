"use client";

import { AdminDataTable } from "@/components/admin/admin-data-table";
import { AdminPreviewSheetHeader } from "@/components/admin/admin-preview-sheet-header";
import { conditionReportColumns } from "@/components/admin/condition-reports-board/columns";
import { ConditionReportDrawerContent } from "@/components/admin/condition-reports-board/drawer";
import { ConditionReportsMobileCards } from "@/components/admin/condition-reports-board/mobile-cards";
import { useTableDensity } from "@/components/layout/density-provider";
import type { AdminConditionReportRequestRow } from "@/lib/data/http/admin.server";
import { EntityList, Sheet, SheetContent } from "@auction/ui";
import { useCallback, useMemo, useState } from "react";

export function AdminConditionReportsBoard({ rows }: { rows: AdminConditionReportRequestRow[] }) {
  const { density } = useTableDensity();
  const [selected, setSelected] = useState<AdminConditionReportRequestRow | null>(null);
  const onOpen = useCallback((row: AdminConditionReportRequestRow) => setSelected(row), []);
  const columns = useMemo(() => conditionReportColumns(onOpen), [onOpen]);

  return (
    <>
      <EntityList
        responsiveMode="auto"
        density={density}
        table={
          <AdminDataTable
            ariaLabel="Condition report requests"
            columns={columns}
            data={rows}
            emptyMessage="No condition report requests on this page."
            density={density}
            getRowId={(r) => r.id}
          />
        }
        cards={<ConditionReportsMobileCards rows={rows} onOpen={onOpen} />}
      />
      <Sheet open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <SheetContent side="right" className="w-full max-w-md overflow-y-auto sm:max-w-lg">
          {selected ? (
            <div className="space-y-4 pt-2">
              <AdminPreviewSheetHeader
                title={selected.lotTitle ?? "Condition report"}
                fullPageHref={`/admin/lots/${selected.lotId}`}
                subtitle={
                  <p className="text-sm text-on-surface-variant">
                    {selected.status.replaceAll("_", " ")}
                  </p>
                }
              />
              <ConditionReportDrawerContent row={selected} />
            </div>
          ) : null}
        </SheetContent>
      </Sheet>
    </>
  );
}
