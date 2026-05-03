"use client";

import type { AdminSubmissionTableRow } from "@/components/admin/admin-submissions-data-table";
import { useTableDensity } from "@/components/layout/density-provider";
import { SubmissionStatusBadge } from "@/components/ui/submission-status-badge";
import { DataTable, EntityTableShell } from "@auction/ui";
import { Input } from "@auction/ui/components/input";
import type { ColumnDef } from "@tanstack/react-table";
import Link from "next/link";
import type { ReactNode } from "react";
import { useMemo, useState } from "react";

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
      id: "open",
      header: "",
      cell: ({ row }) => (
        <Link
          href={`/admin/submissions/${row.original.id}`}
          className="font-label text-xs font-bold uppercase tracking-widest text-primary underline-offset-4 hover:underline"
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
  filterForm: ReactNode;
};

export function AdminSubmissionsBoard({ rows, filterForm }: Props) {
  const { density } = useTableDensity();
  const [q, setQ] = useState("");
  const columns = useMemo(() => submissionColumns(), []);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return rows;
    return rows.filter((r) => r.title.toLowerCase().includes(needle));
  }, [rows, q]);

  const cards = (
    <ul className="space-y-3">
      {filtered.map((r) => (
        <li
          key={r.id}
          className="rounded-sm border border-outline-variant/15 bg-surface-container-lowest/80 p-4"
        >
          <Link href={`/admin/submissions/${r.id}`} className="block min-h-11">
            <p className="font-headline text-base text-on-surface">{r.title}</p>
            <p className="mt-1 text-xs text-on-surface-variant">{r.sellerPreview}</p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <SubmissionStatusBadge status={r.status} />
              <span className="text-[10px] text-on-surface-variant">{r.createdAtLabel}</span>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );

  return (
    <EntityTableShell
      responsiveMode="auto"
      density={density}
      filters={filterForm}
      search={
        <div className="grid w-full min-w-0 flex-1 gap-1 sm:max-w-md">
          <label
            htmlFor="admin-submissions-client-q"
            className="font-label text-xs uppercase tracking-widest text-secondary"
          >
            Filter title (client)
          </label>
          <Input
            id="admin-submissions-client-q"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Narrow loaded rows…"
            className="min-h-11 text-base md:text-sm"
          />
        </div>
      }
      table={
        <DataTable
          columns={columns}
          data={filtered}
          emptyMessage="No submissions match this filter."
          density={density}
        />
      }
      cards={cards}
    />
  );
}
