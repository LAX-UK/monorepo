"use client";

import { AdminDataTable } from "@/components/admin/admin-data-table";
import { AdminStatusBadge } from "@/components/admin/admin-status-badge";
import type { AdminSubmissionTableRow } from "@/components/admin/admin-submissions-data-table";
import { BulkActionsToolbar } from "@/components/admin/bulk-actions-toolbar";
import { CatalogMobileCardShell } from "@/components/admin/catalog/catalog-mobile-card-shell";
import { CatalogVirtualizedList } from "@/components/admin/catalog/catalog-virtualized-list";
import { SubmissionInlineActions } from "@/components/admin/submission-inline-actions";
import { FilterEmptyState } from "@/components/app/filter-empty-state";
import { useTableDensity } from "@/components/layout/density-provider";
import { getSubmissionBulkOperations } from "@/lib/admin/bulk-ops/submissions";
import { useBulkSelection } from "@/lib/admin/use-bulk-selection";
import { Button, EntityList } from "@auction/ui";
import type { ColumnDef, OnChangeFn, RowSelectionState } from "@tanstack/react-table";
import Link from "next/link";
import type { ReactNode } from "react";
import { useMemo } from "react";

function submissionColumns(): ColumnDef<AdminSubmissionTableRow>[] {
  return [
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => <AdminStatusBadge domain="submission" status={row.original.status} />,
    },
    {
      accessorKey: "title",
      header: "Submission",
      cell: ({ row }) => (
        <Link
          href={`/admin/submissions/${row.original.id}`}
          className="font-headline text-base text-on-surface hover:text-primary"
        >
          {row.original.title}
        </Link>
      ),
    },
    {
      accessorKey: "sellerPreview",
      header: "Seller",
      cell: ({ row }) => (
        <span className="font-body text-xs text-on-surface-variant">
          {row.original.sellerPreview}
        </span>
      ),
    },
    {
      accessorKey: "createdAtLabel",
      header: "Created",
      cell: ({ row }) => (
        <span className="font-body text-xs text-on-surface-variant">
          {row.original.createdAtLabel}
        </span>
      ),
    },
    {
      id: "actions",
      header: "",
      cell: ({ row }) => (
        <div className="flex justify-end gap-2">
          <Button variant="ghost" size="sm" asChild>
            <Link href={`/admin/submissions/${row.original.id}`}>View</Link>
          </Button>
          <SubmissionInlineActions submissionId={row.original.id} status={row.original.status} />
        </div>
      ),
      enableSorting: false,
    },
  ];
}

function SubmissionsMobileCards({
  rows,
  rowSelection,
  onRowSelectionChange,
}: {
  rows: AdminSubmissionTableRow[];
  rowSelection?: RowSelectionState;
  onRowSelectionChange?: OnChangeFn<RowSelectionState>;
}) {
  return (
    <CatalogVirtualizedList itemCount={rows.length}>
      {rows.map((r) => (
        <CatalogMobileCardShell
          key={r.id}
          id={r.id}
          title={r.title}
          selected={rowSelection?.[r.id]}
          onSelectedChange={
            onRowSelectionChange
              ? (checked) => {
                  onRowSelectionChange((prev) => ({
                    ...prev,
                    [r.id]: checked,
                  }));
                }
              : undefined
          }
          selectionLabel={`Select ${r.title}`}
          status={
            <div className="flex flex-wrap items-center gap-2">
              <AdminStatusBadge domain="submission" status={r.status} />
              <span className="font-body text-[10px] text-on-surface-variant">
                {r.createdAtLabel}
              </span>
            </div>
          }
          footer={
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" className="min-h-11 flex-1" asChild>
                <Link href={`/admin/submissions/${r.id}`}>Review</Link>
              </Button>
              <SubmissionInlineActions submissionId={r.id} status={r.status} />
            </div>
          }
        >
          <Link
            href={`/admin/submissions/${r.id}`}
            className="font-headline text-sm text-on-surface hover:text-primary"
          >
            {r.title}
          </Link>
          <p className="mt-1 font-body text-xs text-on-surface-variant">{r.sellerPreview}</p>
        </CatalogMobileCardShell>
      ))}
    </CatalogVirtualizedList>
  );
}

type Props = {
  rows: AdminSubmissionTableRow[];
  /** When omitted, filters are rendered by the parent (e.g. AdminListPage toolbar). */
  filterForm?: ReactNode;
};

export function AdminSubmissionsBoard({ rows, filterForm }: Props) {
  const { density } = useTableDensity();
  const { rowSelection, setRowSelection, selectedIds, clear, selectAllOnPage } = useBulkSelection();
  const columns = useMemo(() => submissionColumns(), []);
  const bulkOperations = useMemo(() => getSubmissionBulkOperations(), []);
  const pageIds = useMemo(() => rows.map((r) => r.id), [rows]);

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
              <FilterEmptyState
                entity="submissions"
                segment="admin"
                hasActiveFilters={Boolean(filterForm)}
              />
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
          />
        }
      />
      <BulkActionsToolbar
        selectedIds={selectedIds}
        operations={bulkOperations}
        onClear={clear}
        pageRowCount={pageIds.length}
        onSelectAllOnPage={() => selectAllOnPage(pageIds)}
      />
    </div>
  );
}
