"use client";

import { AdminDataTable } from "@/components/admin/admin-data-table";
import type { AdminSubmissionTableRow } from "@/components/admin/admin-submissions-data-table";
import { BulkActionsToolbar } from "@/components/admin/bulk-actions-toolbar";
import { SubmissionInlineActions } from "@/components/admin/submission-inline-actions";
import { useTableDensity } from "@/components/layout/density-provider";
import { SubmissionStatusBadge } from "@/components/ui/submission-status-badge";
import { getSubmissionBulkOperations } from "@/lib/admin/bulk-ops/submissions";
import { useBulkSelection } from "@/lib/admin/use-bulk-selection";
import { Button, EntityList } from "@auction/ui";
import type { ColumnDef } from "@tanstack/react-table";
import Link from "next/link";
import type { ReactNode } from "react";
import { useMemo } from "react";

function submissionColumns(): ColumnDef<AdminSubmissionTableRow>[] {
  return [
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
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => <SubmissionStatusBadge status={row.original.status} />,
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

type Props = {
  rows: AdminSubmissionTableRow[];
  /** When omitted, filters are rendered by the parent (e.g. AdminListPage toolbar). */
  filterForm?: ReactNode;
};

export function AdminSubmissionsBoard({ rows, filterForm }: Props) {
  const { density } = useTableDensity();
  const { rowSelection, setRowSelection, selectedIds, clear } = useBulkSelection();
  const columns = useMemo(() => submissionColumns(), []);
  const bulkOperations = useMemo(() => getSubmissionBulkOperations(), []);

  const cards = (
    <ul className="space-y-3">
      {rows.map((r) => (
        <li
          key={r.id}
          className="rounded-sm border border-border-hairline bg-surface-container-lowest/80 p-4"
        >
          <Link href={`/admin/submissions/${r.id}`} className="block min-h-11">
            <p className="font-headline text-base text-on-surface">{r.title}</p>
            <p className="mt-1 text-xs text-on-surface-variant">{r.sellerPreview}</p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <SubmissionStatusBadge status={r.status} />
              <span className="text-[10px] text-on-surface-variant">{r.createdAtLabel}</span>
            </div>
          </Link>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button variant="ghost" size="sm" asChild>
              <Link href={`/admin/submissions/${r.id}`}>View</Link>
            </Button>
            <SubmissionInlineActions submissionId={r.id} status={r.status} />
          </div>
        </li>
      ))}
    </ul>
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
            emptyMessage="No submissions match this filter."
            density={density}
            enableRowSelection
            getRowId={(row) => row.id}
            rowSelection={rowSelection}
            onRowSelectionChange={setRowSelection}
            showColumnPicker
            columnVisibilityStorageKey="admin-submissions-columns"
          />
        }
        cards={cards}
      />
      <BulkActionsToolbar selectedIds={selectedIds} operations={bulkOperations} onClear={clear} />
    </div>
  );
}
