"use client";

import { AdminDataTable } from "@/components/admin/admin-data-table";
import { AdminPreviewSheetHeader } from "@/components/admin/admin-preview-sheet-header";
import { AdminStatusBadge } from "@/components/admin/admin-status-badge";
import { amlColumns } from "@/components/admin/compliance-aml-board/columns";
import { AmlDrawerContent } from "@/components/admin/compliance-aml-board/drawer";
import { AmlMobileCards } from "@/components/admin/compliance-aml-board/mobile-cards";
import { useTableDensity } from "@/components/layout/density-provider";
import type { AdminAmlTableRow } from "@/lib/data/view-models/admin-aml-table.vm";
import { EntityList, Sheet, SheetContent } from "@auction/ui";
import { useCallback, useMemo, useState } from "react";

type Props = {
  rows: AdminAmlTableRow[];
  canTriage: boolean;
  canDecide: boolean;
  currentUserId: string;
};

export function ComplianceAmlBoard({ rows, canTriage, canDecide, currentUserId }: Props) {
  const { density } = useTableDensity();
  const [selected, setSelected] = useState<AdminAmlTableRow | null>(null);
  const onOpen = useCallback((row: AdminAmlTableRow) => setSelected(row), []);
  const columns = useMemo(() => amlColumns(onOpen), [onOpen]);

  return (
    <>
      <EntityList
        responsiveMode="auto"
        density={density}
        table={
          <AdminDataTable
            ariaLabel="AML screenings pending review"
            columns={columns}
            data={rows}
            emptyMessage="No pending AML screenings."
            density={density}
            getRowId={(r) => r.id}
            stickyFirstColumn
          />
        }
        cards={<AmlMobileCards rows={rows} onOpen={onOpen} />}
      />

      <Sheet open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <SheetContent side="right" className="w-full max-w-lg overflow-y-auto">
          {selected ? (
            <div className="space-y-4 pt-2">
              <AdminPreviewSheetHeader
                title="Watchlist screening"
                subtitle={
                  <div className="flex flex-wrap gap-2">
                    <AdminStatusBadge domain="amlMatch" status={selected.matchStatus} />
                    <AdminStatusBadge domain="amlDecision" status={selected.decisionOutcome} />
                  </div>
                }
              />
              <AmlDrawerContent
                row={selected}
                canTriage={canTriage}
                canDecide={canDecide}
                currentUserId={currentUserId}
              />
            </div>
          ) : null}
        </SheetContent>
      </Sheet>
    </>
  );
}
