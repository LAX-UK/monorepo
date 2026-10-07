"use client";

import {
  MarkPayoutPaidRowAction,
  ReleaseStockHoldForm,
  RevokeStaffRoleForm,
} from "@/components/admin-staff-action-forms.client";
import { AdminStaffDataTable } from "@/components/admin-staff-data-table";
import { RequestDecisionForm } from "@/components/request-decision-form";
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
            <RequestDecisionForm
              requestId={row.original.requestId}
              requestedCount={row.original.requestedCount}
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
            <ReleaseStockHoldForm holdId={row.original.holdId} />
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
            <MarkPayoutPaidRowAction payoutId={row.original.payoutId} />
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
      ariaLabel="Third-party sales"
    />
  );
}

type MerchandiseRow = {
  productId: string;
  slug: string;
  title: string;
  variantCount: number;
  fromPricePence: number | null;
  totalOnHand: number;
};

export function MerchandiseStaffListTable({ items }: { items: MerchandiseRow[] }) {
  const columns = useMemo<ColumnDef<MerchandiseRow, unknown>[]>(
    () => [
      { accessorKey: "title", header: "Title" },
      { accessorKey: "slug", header: "Slug" },
      {
        id: "variants",
        header: "Variants",
        cell: ({ row }) => String(row.original.variantCount),
      },
      {
        id: "fromPrice",
        header: "From price",
        cell: ({ row }) =>
          row.original.fromPricePence === null
            ? "—"
            : `£${(row.original.fromPricePence / 100).toFixed(2)}`,
      },
      {
        id: "onHand",
        header: "Total on hand",
        cell: ({ row }) => String(row.original.totalOnHand),
      },
    ],
    [],
  );
  return (
    <AdminStaffDataTable
      columns={columns}
      data={items}
      getRowId={(row) => row.productId}
      ariaLabel="Merchandise products"
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
            <RevokeStaffRoleForm identitySubjectId={row.original.identitySubjectId} />
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
      ariaLabel="Staff members"
    />
  );
}
