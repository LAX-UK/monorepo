"use client";

import { AdminStatusBadge } from "@/components/admin/admin-status-badge";
import type { AdminSubmissionTableRow } from "@/components/admin/admin-submissions-data-table";
import { SubmissionInlineActions } from "@/components/admin/submission-inline-actions";
import { Button } from "@auction/ui";
import type { ColumnDef } from "@tanstack/react-table";
import Link from "next/link";

export function submissionColumns(
  onOpen: (row: AdminSubmissionTableRow) => void,
): ColumnDef<AdminSubmissionTableRow>[] {
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
        <Button
          type="button"
          variant="link"
          className="h-auto max-w-[14rem] truncate px-0 py-0 text-left font-headline text-base text-primary"
          onClick={() => onOpen(row.original)}
        >
          {row.original.title}
        </Button>
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
          <Button variant="ghost" size="sm" className="min-h-11" asChild>
            <Link href={`/admin/submissions/${row.original.id}`}>View</Link>
          </Button>
          <SubmissionInlineActions submissionId={row.original.id} status={row.original.status} />
        </div>
      ),
      enableSorting: false,
    },
  ];
}
