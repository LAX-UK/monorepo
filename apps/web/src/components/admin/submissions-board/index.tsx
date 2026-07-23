"use client";

import { AdminDataTable } from "@/components/admin/admin-data-table";
import { BulkActionsToolbar } from "@/components/admin/bulk-actions-toolbar";
import { CatalogBoardTableHeader } from "@/components/admin/catalog/catalog-board-table-header";
import { CatalogPagination } from "@/components/admin/catalog/catalog-pagination";
import type {
  CatalogTableFilterControlsBaseProps,
  CatalogTableFilterControlsProps,
} from "@/components/admin/catalog/catalog-table-filter-controls";
import { AdminSubmissionsFilterFields } from "@/components/admin/filters/admin-submissions-filter-fields";
import { submissionColumns } from "@/components/admin/submissions-board/columns";
import { SubmissionsMobileCards } from "@/components/admin/submissions-board/mobile-cards";
import { ExportButton } from "@/components/exports/export-button";
import { useTableDensity } from "@/components/layout/density-provider";
import type { SubmissionDecisionQueue } from "@/lib/admin/admin-list-controllers";
import { getSubmissionBulkOperations } from "@/lib/admin/bulk-ops/submissions";
import type { AdminSubmissionTableRow } from "@/lib/admin/catalog/submission-table-row";
import { submissionsFilterAdapter } from "@/lib/admin/filters/submissions-filter-adapter";
import {
  areSubmissionBulkIdsActionable,
  mergeSubmissionBlocksAccept,
  mergeSubmissionStatuses,
} from "@/lib/admin/submission-bulk-selection";
import { useBulkSelection } from "@/lib/admin/use-bulk-selection";
import type { CategoryNode } from "@auction/types";
import { cn } from "@auction/ui";
import { EntityList } from "@auction/ui";
import { Badge } from "@auction/ui/components/badge";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

export type SubmissionsBoardPagination = {
  offset: number;
  limit: number;
  countOnPage: number;
  total?: number;
  prevHref: string | null;
  nextHref: string | null;
};

export type SubmissionFilterSheetProps = {
  categories: CategoryNode[];
  queue: SubmissionDecisionQueue;
};

type Props = {
  rows: AdminSubmissionTableRow[];
  filterControls?: CatalogTableFilterControlsBaseProps;
  submissionFilterSheet?: SubmissionFilterSheetProps;
  exportFilters?: Record<string, unknown>;
  pagination?: SubmissionsBoardPagination | null;
  /** Total submissions in current queue (for header count badge). */
  listTotalCount?: number;
};

export function AdminSubmissionsBoard({
  rows,
  filterControls,
  submissionFilterSheet,
  exportFilters,
  pagination,
  listTotalCount,
}: Props) {
  const router = useRouter();
  const { density } = useTableDensity();
  const onOpen = useCallback(
    (row: AdminSubmissionTableRow) => {
      const params = new URLSearchParams(window.location.search);
      params.set("preview", row.id);
      router.push(`/admin/submissions?${params.toString()}`);
    },
    [router],
  );
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

  const tableFilterControls = useMemo((): CatalogTableFilterControlsProps | undefined => {
    if (!filterControls || !submissionFilterSheet) return undefined;
    return {
      ...filterControls,
      sheetFilters: <AdminSubmissionsFilterFields categories={submissionFilterSheet.categories} />,
      transactional: {
        adapter: submissionsFilterAdapter,
        preserved: { queue: submissionFilterSheet.queue },
      },
    };
  }, [filterControls, submissionFilterSheet]);

  const headerCount = listTotalCount ?? rows.length;

  return (
    <div className="space-y-4">
      <div
        className={cn(
          "overflow-hidden rounded-shell-card border border-shell-stroke bg-surface-container-lowest shadow-[var(--shadow-rest)]",
        )}
      >
        <CatalogBoardTableHeader
          leading={
            <>
              <h2 className="font-headline text-base font-semibold text-on-surface sm:text-lg">
                Submissions
              </h2>
              <Badge
                variant="secondary"
                className="h-6 min-w-6 rounded-full bg-on-surface px-2 font-label text-xs font-semibold text-surface-container-lowest"
              >
                {headerCount > 99 ? "99+" : headerCount}
              </Badge>
            </>
          }
          {...(tableFilterControls ? { filterControls: tableFilterControls } : {})}
          trailing={
            exportFilters ? (
              <ExportButton
                key="submissions-export"
                entityType="submissions"
                filters={exportFilters}
              />
            ) : null
          }
        />
        <div className="p-4 sm:p-6">
          <EntityList
            responsiveMode="auto"
            density={density}
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
                stickyHeader
                enableKeyboardNav
                getRowId={(row) => row.id}
                getRowHref={(row) => `/admin/submissions/${row.id}`}
                rowSelection={rowSelection}
                onRowSelectionChange={setRowSelection}
                showColumnPicker
                columnVisibilityStorageKey="admin-submissions-columns"
                className="[&_table]:border-0"
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
        </div>
        {pagination ? (
          <div className="border-t border-shell-stroke px-4 py-3 sm:px-6">
            <CatalogPagination {...pagination} />
          </div>
        ) : null}
      </div>
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
    </div>
  );
}
