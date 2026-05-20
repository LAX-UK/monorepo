"use client";

import { AdminDataTable } from "@/components/admin/admin-data-table";
import { AdminStatusBadge } from "@/components/admin/admin-status-badge";
import { artistKindMeta } from "@/lib/artists/kind-presenter";
import type { AdminArtistDuplicateHit } from "@/lib/data/http/admin.server";
import { EntityList } from "@auction/ui";
import type { ColumnDef } from "@tanstack/react-table";
import Link from "next/link";
import { useMemo } from "react";

function columns(): ColumnDef<AdminArtistDuplicateHit>[] {
  return [
    {
      accessorKey: "displayName",
      header: "Name",
      cell: ({ row }) => (
        <span className="font-medium text-on-surface">{row.original.displayName}</span>
      ),
    },
    {
      accessorKey: "kind",
      header: "Kind",
      cell: ({ row }) => (
        <span className="text-on-surface-variant">{artistKindMeta(row.original.kind).badge}</span>
      ),
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => <AdminStatusBadge domain="artist" status={row.original.status} />,
    },
    {
      id: "open",
      header: "",
      cell: ({ row }) => (
        <Link
          href={`/admin/artists/${row.original.id}`}
          className="font-label text-xs uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-primary hover:underline"
        >
          View
        </Link>
      ),
      enableSorting: false,
    },
  ];
}

export function AdminArtistDuplicatesTable({ rows }: { rows: AdminArtistDuplicateHit[] }) {
  const cols = useMemo(() => columns(), []);
  return (
    <EntityList
      responsiveMode="scroll"
      table={
        <AdminDataTable
          ariaLabel="Artist duplicate candidates"
          columns={cols}
          data={rows}
          emptyMessage="No duplicate candidates."
        />
      }
    />
  );
}
