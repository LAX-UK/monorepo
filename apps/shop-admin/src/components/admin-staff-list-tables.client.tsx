"use client";

import { AdminStaffDataTable } from "@/components/admin-staff-data-table";
import { DecideSaleAuthorityRequestForm } from "@/components/forms/people/decide-sale-authority-request-form.client";
import { formatAdminDetailDateTime, formatAdminDetailGbpPence } from "@/lib/admin-detail-format";
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

type RequestRow = {
  requestId: string;
  artworkTitle: string;
  ownerDisplayName: string;
  requestedCount: number;
  status: string;
};

export function SaleAuthorityRequestsStaffListTable({ items }: { items: RequestRow[] }) {
  const columns = useMemo<ColumnDef<RequestRow, unknown>[]>(
    () => [
      { accessorKey: "artworkTitle", header: "Artwork" },
      { accessorKey: "ownerDisplayName", header: "Owner" },
      {
        id: "requested",
        header: "Requested",
        cell: ({ row }) => String(row.original.requestedCount),
      },
      { accessorKey: "status", header: "Status" },
      {
        id: "actions",
        header: "Actions",
        cell: ({ row }) =>
          row.original.status === "pending" ? (
            <DecideSaleAuthorityRequestForm
              requestId={row.original.requestId}
              requestedCount={row.original.requestedCount}
              artworkTitle={row.original.artworkTitle}
              ownerDisplayName={row.original.ownerDisplayName}
            />
          ) : (
            "—"
          ),
      },
    ],
    [],
  );
  return (
    <AdminStaffDataTable
      columns={columns}
      data={items}
      getRowId={(row) => row.requestId}
      empty={{
        title: "No requests waiting",
        description:
          "Artists ask for a higher sale limit from their account. New requests will be listed here for review.",
      }}
      ariaLabel="Sale limit requests"
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

type DisputeRow = {
  disputeId: string;
  orderId: string;
  stripeDisputeId: string;
  status: string;
  amountPence: number;
  openedAt: string;
};

export function DisputesStaffListTable({ items }: { items: DisputeRow[] }) {
  const columns = useMemo<ColumnDef<DisputeRow, unknown>[]>(
    () => [
      { accessorKey: "status", header: "Status" },
      {
        id: "amount",
        header: "Amount",
        cell: ({ row }) => formatAdminDetailGbpPence(row.original.amountPence),
      },
      {
        id: "order",
        header: "Order",
        cell: ({ row }) => (
          <Link href={`/orders/${row.original.orderId}`} className="underline">
            {row.original.orderId.slice(0, 8)}
          </Link>
        ),
      },
      { accessorKey: "stripeDisputeId", header: "Stripe dispute" },
      {
        id: "opened",
        header: "Opened",
        cell: ({ row }) => formatAdminDetailDateTime(row.original.openedAt),
      },
    ],
    [],
  );
  return (
    <AdminStaffDataTable
      columns={columns}
      data={items}
      getRowId={(row) => row.disputeId}
      empty={{
        title: "No disputes",
        description: "Card disputes raised with the payment provider will be listed here.",
      }}
      ariaLabel="Disputes"
    />
  );
}
