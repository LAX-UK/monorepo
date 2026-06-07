"use client";

import { AdminDataTable } from "@/components/admin/admin-data-table";
import { AdminPreviewSheetHeader } from "@/components/admin/admin-preview-sheet-header";
import type { AdminSubmissionTableRow } from "@/components/admin/admin-submissions-data-table";
import { BulkActionsToolbar } from "@/components/admin/bulk-actions-toolbar";
import { submissionColumns } from "@/components/admin/submissions-board/columns";
import { SubmissionDrawerContent } from "@/components/admin/submissions-board/drawer";
import { SubmissionsMobileCards } from "@/components/admin/submissions-board/mobile-cards";
import { useTableDensity } from "@/components/layout/density-provider";
import { getSubmissionBulkOperations } from "@/lib/admin/bulk-ops/submissions";
import {
  areSubmissionBulkIdsActionable,
  mergeSubmissionBlocksAccept,
  mergeSubmissionStatuses,
} from "@/lib/admin/submission-bulk-selection";
import { useBulkSelection } from "@/lib/admin/use-bulk-selection";
import { EntityList, Sheet, SheetContent } from "@auction/ui";
import type { ReactNode } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";

type Props = {
  rows: AdminSubmissionTableRow[];
  filterForm?: ReactNode;
};

export function AdminSubmissionsBoard({ rows, filterForm }: Props) {
  const { density } = useTableDensity();
  const [selected, setSelected] = useState<AdminSubmissionTableRow | null>(null);
  const onOpen = useCallback((row: AdminSubmissionTableRow) => setSelected(row), []);
  const { rowSelection, setRowSelection, selectedIds, clear, selectAllOnPage } = useBulkSelection();
  const columns = useMemo(() => submissionColumns(onOpen), [onOpen]);
  const bulkOperations = useMemo(() => getSubmissionBulkOperations(), []);
  const pageIds = useMemo(() => rows.map((r) => r.id), [rows]);
  const [statusById, setStatusById] = useState<Map<string, string>>(() => new Map());
  const [blocksAcceptById, setBlocksAcceptById] = useState<Map<string, boolean>>(() => new Map());

  useEffect(() => {
    setStatusById((prev) => mergeSubmissionStatuses(prev, rows));
    setBlocksAcceptById((prev) => mergeSubmissionBlocksAccept(prev, rows));
  }, [rows]);

  const selectedBulkActionable = useMemo(
    () => areSubmissionBulkIdsActionable(selectedIds, statusById, blocksAcceptById),
    [selectedIds, statusById, blocksAcceptById],
  );

  return (
    <div className="space-y-4">
      <EntityList
        responsiveMode="auto"
        density={density}
        {...(filterForm ? { filters: filterForm } : {})}
        table={
          <AdminDataTable
            ariaLabel="Submissions"
            columns={columns}
            data={rows}
            emptyComponent={
              <p className="py-8 text-center font-body text-sm text-on-surface-variant">
                No submissions on this page.
              </p>
            }
            density={density}
            enableRowSelection
            getRowId={(row) => row.id}
            rowSelection={rowSelection}
            onRowSelectionChange={setRowSelection}
            showColumnPicker
            columnVisibilityStorageKey="admin-submissions-columns"
          />
        }
        cards={
          <SubmissionsMobileCards
            rows={rows}
            rowSelection={rowSelection}
            onRowSelectionChange={setRowSelection}
            onOpen={onOpen}
          />
        }
      />
      <BulkActionsToolbar
        selectedIds={selectedIds}
        operations={selectedBulkActionable ? bulkOperations : []}
        onClear={clear}
        preflightWarning={
          selectedIds.length > 0 && !selectedBulkActionable
            ? "Bulk approve and reject are available only for submissions under review without missing required fields. Start review first or fix quality gaps."
            : null
        }
        pageRowCount={pageIds.length}
        onSelectAllOnPage={() => selectAllOnPage(pageIds)}
      />

      <Sheet open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <SheetContent side="right" className="w-full max-w-md overflow-y-auto sm:max-w-lg">
          {selected ? (
            <div className="space-y-4 pt-2">
              <AdminPreviewSheetHeader
                title={selected.title}
                fullPageHref={`/admin/submissions/${selected.id}`}
                subtitle={
                  <p className="truncate font-body text-sm text-on-surface-variant">
                    {selected.sellerPreview}
                  </p>
                }
              />
              <SubmissionDrawerContent row={selected} />
            </div>
          ) : null}
        </SheetContent>
      </Sheet>
    </div>
  );
}
