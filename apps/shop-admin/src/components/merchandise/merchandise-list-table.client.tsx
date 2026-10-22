"use client";

import { AdminStaffDataTable } from "@/components/admin-staff-data-table";
import { MerchandiseStatusBadge } from "@/components/merchandise/merchandise-status-badge";
import type { MerchandiseListRow } from "@/server/domain/merchandise-list.vm";
import type { ColumnDef } from "@tanstack/react-table";
import Link from "next/link";

const COLUMNS: ColumnDef<MerchandiseListRow, unknown>[] = [
  {
    id: "title",
    header: "Product",
    cell: ({ row }) => (
      <div className="min-w-0">
        <Link
          href={`/merchandise/${row.original.id}`}
          className="font-medium text-primary underline-offset-4 hover:underline"
        >
          {row.original.title}
        </Link>
        <p className="font-mono text-xs text-on-surface-variant">/{row.original.slug}</p>
      </div>
    ),
  },
  { id: "variants", header: "Variants", cell: ({ row }) => row.original.variants },
  { id: "price", header: "Price", cell: ({ row }) => row.original.price },
  { id: "stock", header: "In stock", cell: ({ row }) => row.original.stock },
  {
    id: "status",
    header: "Status",
    cell: ({ row }) => <MerchandiseStatusBadge status={row.original.status} />,
  },
];

export function MerchandiseListTable({ rows }: { rows: MerchandiseListRow[] }) {
  return (
    <AdminStaffDataTable
      columns={COLUMNS}
      data={rows}
      getRowId={(row) => row.id}
      empty={{
        title: "No products",
        description: "Create a product to start selling merchandise on the shop.",
      }}
      ariaLabel="Products"
    />
  );
}
