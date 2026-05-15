"use client";

import {
  artistStatusLabel as artistStatusText,
  artistStatusToBadgeVariant,
} from "@/lib/admin/status-badge-variants";
import { artistKindMeta } from "@/lib/artists/kind-presenter";
import type { AdminArtistDuplicateHit } from "@/lib/data/http/admin.server";
import { DataTable, EntityTableShell, StatusBadge } from "@auction/ui";
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
      cell: ({ row }) => (
        <StatusBadge variant={artistStatusToBadgeVariant(row.original.status)}>
          {artistStatusText[row.original.status]}
        </StatusBadge>
      ),
    },
    {
      id: "open",
      header: "",
      cell: ({ row }) => (
        <Link
          href={`/admin/artists/${row.original.id}`}
          className="font-label text-xs uppercase tracking-widest text-primary hover:underline"
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
    <EntityTableShell
      responsiveMode="scroll"
      table={<DataTable columns={cols} data={rows} emptyMessage="No duplicate candidates." />}
    />
  );
}
