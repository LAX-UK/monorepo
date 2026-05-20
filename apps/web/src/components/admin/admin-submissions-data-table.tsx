"use client";

import { AdminDataTable } from "@/components/admin/admin-data-table";
import { AdminStatusBadge } from "@/components/admin/admin-status-badge";
import type { ItemSubmissionStatus } from "@auction/types";
import type { ColumnDef } from "@tanstack/react-table";
import Link from "next/link";
import { useMemo } from "react";

export type AdminSubmissionTableRow = {
  id: string;
  title: string;
  sellerPreview: string;
  status: ItemSubmissionStatus;
  createdAtLabel: string;
};

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
      cell: ({ row }) => <AdminStatusBadge domain="submission" status={row.original.status} />,
    },
    {
      id: "open",
      header: "",
      cell: ({ row }) => (
        <Link
          href={`/admin/submissions/${row.original.id}`}
          className="font-label text-xs font-bold uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-primary underline-offset-4 hover:underline"
        >
          Open
        </Link>
      ),
      enableSorting: false,
    },
  ];
}

type Props = {
  rows: AdminSubmissionTableRow[];
};

export function AdminSubmissionsDataTable({ rows }: Props) {
  const columns = useMemo(() => submissionColumns(), []);
  return (
    <AdminDataTable
      ariaLabel="Submissions"
      columns={columns}
      data={rows}
      emptyMessage="No submissions."
    />
  );
}
