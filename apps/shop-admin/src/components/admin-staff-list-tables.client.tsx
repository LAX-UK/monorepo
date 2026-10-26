"use client";

import { AdminStaffDataTable } from "@/components/admin-staff-data-table";
import type { ColumnDef } from "@tanstack/react-table";
import Link from "next/link";
import { useMemo } from "react";

type ArtistRow = {
  artistId: string;
  slug: string;
  displayName: string;
  discipline: string | null;
};

export function ArtistsStaffListTable({ items }: { items: ArtistRow[] }) {
  const columns = useMemo<ColumnDef<ArtistRow, unknown>[]>(
    () => [
      { accessorKey: "displayName", header: "Name" },
      { accessorKey: "slug", header: "Slug" },
      {
        id: "discipline",
        header: "Discipline",
        cell: ({ row }) => row.original.discipline ?? "—",
      },
      {
        id: "actions",
        header: "",
        cell: ({ row }) => (
          <Link href={`/artists/${row.original.artistId}`} className="underline">
            View
          </Link>
        ),
      },
    ],
    [],
  );
  return (
    <AdminStaffDataTable
      columns={columns}
      data={items}
      getRowId={(row) => row.artistId}
      empty={{
        title: "No artists yet",
        description: "Artists appear here once they are imported with their first artwork.",
      }}
      ariaLabel="Artists"
    />
  );
}
