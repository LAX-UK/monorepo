"use client";

import { AdminStaffDataTable } from "@/components/admin-staff-data-table";
import { formatAdminDetailDateTime } from "@/lib/admin-detail-format";
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

type ClientRow = { partyId: string; displayName: string; kind: string };

export function ClientsStaffListTable({ items }: { items: ClientRow[] }) {
  const columns = useMemo<ColumnDef<ClientRow, unknown>[]>(
    () => [
      { accessorKey: "displayName", header: "Name" },
      { accessorKey: "kind", header: "Kind" },
      {
        id: "actions",
        header: "",
        cell: ({ row }) => (
          <Link href={`/clients/${row.original.partyId}`} className="underline">
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
      getRowId={(row) => row.partyId}
      empty={{
        title: "No clients yet",
        description: "Collectors and owners appear here after their first order or purchase.",
      }}
      ariaLabel="Clients"
    />
  );
}

type AuditRow = {
  auditId: string;
  actorSubjectId: string;
  capability: string;
  action: string;
  targetType: string;
  targetId: string;
  createdAt: string;
};

export function AuditStaffListTable({ items }: { items: AuditRow[] }) {
  const columns = useMemo<ColumnDef<AuditRow, unknown>[]>(
    () => [
      {
        id: "when",
        header: "When",
        cell: ({ row }) => (
          <time dateTime={row.original.createdAt}>
            {formatAdminDetailDateTime(row.original.createdAt)}
          </time>
        ),
      },
      {
        id: "actor",
        header: "Actor",
        cell: ({ row }) => (
          <span title={row.original.actorSubjectId}>{row.original.actorSubjectId.slice(0, 8)}</span>
        ),
      },
      { accessorKey: "action", header: "Action" },
      {
        id: "target",
        header: "Target",
        cell: ({ row }) => (
          <span title={row.original.targetId}>
            {row.original.targetType} {row.original.targetId.slice(0, 8)}
          </span>
        ),
      },
    ],
    [],
  );
  return (
    <AdminStaffDataTable
      columns={columns}
      data={items}
      getRowId={(row) => row.auditId}
      empty={{
        title: "No audit entries yet",
        description: "Changes made by staff are recorded here, newest first.",
      }}
      ariaLabel="Audit log"
    />
  );
}
