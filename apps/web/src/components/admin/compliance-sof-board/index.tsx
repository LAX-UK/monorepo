"use client";

import { AdminDataTable } from "@/components/admin/admin-data-table";
import { AdminPreviewSheetHeader } from "@/components/admin/admin-preview-sheet-header";
import { AdminStatusBadge } from "@/components/admin/admin-status-badge";
import { sofColumns } from "@/components/admin/compliance-sof-board/columns";
import { SofDrawerContent } from "@/components/admin/compliance-sof-board/drawer";
import { SofMobileCards } from "@/components/admin/compliance-sof-board/mobile-cards";
import { useTableDensity } from "@/components/layout/density-provider";
import { fetchAdminSofCaseDetailAction } from "@/lib/actions/compliance";
import type { AdminSourceOfFundsDetail } from "@/lib/data/http/compliance.server";
import type { AdminSofTableRow } from "@/lib/data/view-models/admin-sof-table.vm";
import { EntityList, Sheet, SheetContent } from "@auction/ui";
import { useCallback, useEffect, useMemo, useState, useTransition } from "react";

type Props = {
  rows: AdminSofTableRow[];
  canTriage: boolean;
  canDecide: boolean;
  currentUserId: string;
};

export function ComplianceSofBoard({ rows, canTriage, canDecide, currentUserId }: Props) {
  const { density } = useTableDensity();
  const [selected, setSelected] = useState<AdminSofTableRow | null>(null);
  const [detail, setDetail] = useState<AdminSourceOfFundsDetail | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [detailLoading, startDetailTransition] = useTransition();

  const onOpen = useCallback((row: AdminSofTableRow) => setSelected(row), []);
  const columns = useMemo(() => sofColumns(onOpen), [onOpen]);

  const loadDetail = useCallback((caseId: string) => {
    startDetailTransition(async () => {
      setDetailError(null);
      const result = await fetchAdminSofCaseDetailAction(caseId);
      if (result.ok) {
        setDetail(result.data);
      } else {
        setDetail(null);
        setDetailError(result.error);
      }
    });
  }, []);

  useEffect(() => {
    if (!selected) {
      setDetail(null);
      setDetailError(null);
      return;
    }
    loadDetail(selected.id);
  }, [selected, loadDetail]);

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
            <div className="space-y-4 pt-2">
              <AdminPreviewSheetHeader
                title="Source of Funds"
                subtitle={<AdminStatusBadge domain="sofCase" status={selected.displayStatus} />}
              />
              <SofDrawerContent
                row={selected}
                detail={detail}
                detailLoading={detailLoading}
                detailError={detailError}
                onRetryDetail={() => loadDetail(selected.id)}
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
