"use client";

import { AdminStaffDataTable } from "@/components/admin-staff-data-table";
import { MarkPayoutPaidRowAction } from "@/components/forms/finance/mark-payout-paid-row-action.client";
import { DecideSaleAuthorityRequestForm } from "@/components/forms/people/decide-sale-authority-request-form.client";
import { RevokeStaffRoleAction } from "@/components/forms/people/revoke-staff-role-action.client";
import { ReleaseStockHoldAction } from "@/components/forms/sales/release-stock-hold-action.client";
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

type OrderRow = {
  orderId: string;
  status: string;
  totalPence: number;
  createdAt: string;
};

export function OrdersStaffListTable({ items }: { items: OrderRow[] }) {
  const columns = useMemo<ColumnDef<OrderRow, unknown>[]>(
    () => [
      {
        id: "order",
        header: "Order",
        cell: ({ row }) => (
          <Link href={`/orders/${row.original.orderId}`} className="underline">
            {row.original.orderId.slice(0, 8)}
          </Link>
        ),
      },
      { accessorKey: "status", header: "Status" },
      {
        id: "total",
        header: "Total",
        cell: ({ row }) => `£${(row.original.totalPence / 100).toFixed(2)}`,
      },
      {
        id: "created",
        header: "Created",
        cell: ({ row }) => new Date(row.original.createdAt).toLocaleDateString("en-GB"),
      },
    ],
    [],
  );
  return (
    <AdminStaffDataTable
      columns={columns}
      data={items}
      getRowId={(row) => row.orderId}
      empty={{
        title: "No orders yet",
        description: "Orders appear here as soon as a customer completes checkout.",
      }}
      ariaLabel="Orders"
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

type HoldRow = {
  holdId: string;
  artworkTitle: string;
  editionNumber: number;
  status: string;
  expiresAt: string;
};

export function StockHoldsStaffListTable({ items }: { items: HoldRow[] }) {
  const columns = useMemo<ColumnDef<HoldRow, unknown>[]>(
    () => [
      { accessorKey: "artworkTitle", header: "Artwork" },
      {
        id: "edition",
        header: "Edition",
        cell: ({ row }) => String(row.original.editionNumber),
      },
      { accessorKey: "status", header: "Status" },
      {
        id: "expires",
        header: "Expires",
        cell: ({ row }) => new Date(row.original.expiresAt).toLocaleDateString("en-GB"),
      },
      {
        id: "actions",
        header: "",
        cell: ({ row }) =>
          row.original.status === "active" ? (
            <ReleaseStockHoldAction
              holdId={row.original.holdId}
              artworkTitle={row.original.artworkTitle}
              editionNumber={row.original.editionNumber}
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
      getRowId={(row) => row.holdId}
      empty={{
        title: "No stock holds",
        description:
          "Hold an edition for a client with the form above, and it will be listed here until it is released or expires.",
      }}
      ariaLabel="Stock holds"
    />
  );
}

type PayoutRow = {
  payoutId: string;
  ownerDisplayName: string;
  netPence: number;
  status: string;
  payoutDueAt: string;
};

export function PayoutsStaffListTable({ items }: { items: PayoutRow[] }) {
  const columns = useMemo<ColumnDef<PayoutRow, unknown>[]>(
    () => [
      { accessorKey: "ownerDisplayName", header: "Owner" },
      {
        id: "net",
        header: "Net",
        cell: ({ row }) => `£${(row.original.netPence / 100).toFixed(2)}`,
      },
      { accessorKey: "status", header: "Status" },
      {
        id: "due",
        header: "Due",
        cell: ({ row }) => new Date(row.original.payoutDueAt).toLocaleDateString("en-GB"),
      },
      {
        id: "actions",
        header: "",
        cell: ({ row }) =>
          row.original.status !== "paid" ? (
            <MarkPayoutPaidRowAction
              payoutId={row.original.payoutId}
              ownerDisplayName={row.original.ownerDisplayName}
              netPence={row.original.netPence}
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
      getRowId={(row) => row.payoutId}
      empty={{
        title: "No payouts due",
        description:
          "Payouts are created when a sale completes. Anything waiting to be paid will be listed here.",
      }}
      ariaLabel="Payouts"
    />
  );
}

type ThirdPartySaleRow = {
  saleId: string;
  artworkTitle: string;
  editionNumber: number;
  status: string;
  grossPence: number;
};

export function ThirdPartySalesStaffListTable({ items }: { items: ThirdPartySaleRow[] }) {
  const columns = useMemo<ColumnDef<ThirdPartySaleRow, unknown>[]>(
    () => [
      { accessorKey: "artworkTitle", header: "Artwork" },
      {
        id: "edition",
        header: "Edition",
        cell: ({ row }) => String(row.original.editionNumber),
      },
      { accessorKey: "status", header: "Status" },
      {
        id: "gross",
        header: "Gross",
        cell: ({ row }) => `£${(row.original.grossPence / 100).toFixed(2)}`,
      },
    ],
    [],
  );
  return (
    <AdminStaffDataTable
      columns={columns}
      data={items}
      getRowId={(row) => row.saleId}
      empty={{
        title: "No third-party sales recorded",
        description: "Record a sale made outside the shop with the form above to see it here.",
      }}
      ariaLabel="Third-party sales"
    />
  );
}

type StaffRow = {
  staffMemberId: string;
  identitySubjectId: string;
  role: string;
  disabledAt: string | null;
};

export function StaffMembersListTable({ items }: { items: StaffRow[] }) {
  const columns = useMemo<ColumnDef<StaffRow, unknown>[]>(
    () => [
      {
        id: "subject",
        header: "Subject",
        cell: ({ row }) => row.original.identitySubjectId.slice(0, 12),
      },
      { accessorKey: "role", header: "Role" },
      {
        id: "status",
        header: "Status",
        cell: ({ row }) => (row.original.disabledAt ? "disabled" : "active"),
      },
      {
        id: "actions",
        header: "",
        cell: ({ row }) =>
          row.original.disabledAt ? (
            "—"
          ) : (
            <RevokeStaffRoleAction
              identitySubjectId={row.original.identitySubjectId}
              role={row.original.role}
            />
          ),
      },
    ],
    [],
  );
  return (
    <AdminStaffDataTable
      columns={columns}
      data={items}
      getRowId={(row) => row.staffMemberId}
      empty={{
        title: "No other staff yet",
        description: "Give someone a role with the form above and they will be listed here.",
      }}
      ariaLabel="Staff members"
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
