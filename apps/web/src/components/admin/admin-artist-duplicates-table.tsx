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
          className="font-label text-xs uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-link hover:underline"
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

  const cards = (
    <ul className="space-y-3 lg:hidden">
      {rows.map((row) => (
        <li
          key={row.id}
          className="rounded-lg border border-outline-variant/20 bg-surface-container-lowest p-4"
        >
          <p className="font-medium text-on-surface">{row.displayName}</p>
          <p className="mt-1 text-xs text-on-surface-variant">{artistKindMeta(row.kind).badge}</p>
          <div className="mt-2">
            <AdminStatusBadge domain="artist" status={row.status} />
          </div>
          <Link
            href={`/admin/artists/${row.id}`}
            className="mt-3 inline-block font-label text-xs uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-link hover:underline"
          >
            View
          </Link>
        </li>
      ))}
    </ul>
  );

  return (
    <EntityList
      responsiveMode="auto"
      table={
        <AdminDataTable
          ariaLabel="Artist duplicate candidates"
          columns={cols}
          data={rows}
          emptyMessage="No duplicate candidates."
        />
      }
      cards={cards}
    />
  );
}
