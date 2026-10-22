"use client";

import { AdminStaffDataTable } from "@/components/admin-staff-data-table";
import { EditorialStatusBadge } from "@/components/editorial/editorial-status-badge";
import type { EditorialEntityCopy } from "@/lib/editorial-entities";
import type { EditorialListRow } from "@/server/domain/editorial-list.vm";
import type { ColumnDef } from "@tanstack/react-table";
import Link from "next/link";
import { useMemo } from "react";

export type EditorialListColumns = {
  /** Header for the kind or city column; null hides the column. */
  descriptor: string | null;
  dates: boolean;
};

export function EditorialListTable({
  entity,
  rows,
  columns: shown,
  empty,
}: {
  entity: EditorialEntityCopy;
  rows: EditorialListRow[];
  columns: EditorialListColumns;
  empty: { title: string; description: string };
}) {
  const columns = useMemo<ColumnDef<EditorialListRow, unknown>[]>(
    () => [
      {
        id: "title",
        header: entity.kind === "venues" ? "Name" : "Title",
        cell: ({ row }) => (
          <div className="min-w-0">
            <Link
              href={`/editorial/${entity.kind}/${row.original.id}`}
              className="font-medium text-primary underline-offset-4 hover:underline"
            >
              {row.original.title}
            </Link>
            <p className="font-mono text-xs text-on-surface-variant">/{row.original.slug}</p>
          </div>
        ),
      },
      ...(shown.descriptor
        ? [
            {
              id: "descriptor",
              header: shown.descriptor,
              cell: ({ row }) => row.original.descriptor ?? "—",
            } satisfies ColumnDef<EditorialListRow, unknown>,
          ]
        : []),
      {
        id: "status",
        header: "Status",
        cell: ({ row }) => <EditorialStatusBadge status={row.original.status} />,
      },
      ...(shown.dates
        ? [
            {
              id: "dates",
              header: "Dates",
              cell: ({ row }) => row.original.dates ?? "—",
            } satisfies ColumnDef<EditorialListRow, unknown>,
          ]
        : []),
      {
        id: "updated",
        header: "Last updated",
        cell: ({ row }) => row.original.updated,
      },
    ],
    [entity.kind, shown.descriptor, shown.dates],
  );
  return (
    <AdminStaffDataTable
      columns={columns}
      data={rows}
      getRowId={(row) => row.id}
      empty={empty}
      ariaLabel={entity.title}
    />
  );
}
